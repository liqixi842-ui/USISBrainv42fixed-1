/**
 * ═══════════════════════════════════════════════════════════════
 * USIS Brain v7.7 - News Query Service (On-Demand News Fetching)
 * ═══════════════════════════════════════════════════════════════
 * 
 * Purpose: Fetch and score news for real-time bot queries
 * Provider Cascade: Finnhub → Twelve Data → Alpha Vantage
 * Integration: Uses ImpactRank 2.0 scoring from newsScoring.js
 * 
 * Unlike newsIngestAPI (designed for N8N push), this service:
 * - Fetches news on-demand for specific symbols
 * - Works without database (stateless scoring)
 * - Returns Telegram-ready structured data
 */

const fetch = require('node-fetch');
const { getStatelessScorer } = require('../newsScoring');
const { generateSummaries, batchGenerateSummaries } = require('./newsAutoSummarizer');
const finnhubAdapter = require('./newsProviders/finnhubAdapter');
const alphaAdapter = require('./newsProviders/alphaAdapter');

// API Keys
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY;
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

/**
 * Provider cascade configuration
 * Cascade: Finnhub (primary) → Alpha Vantage (backup)
 * Note: Twelve Data news API is not yet available, removed from cascade
 */
const PROVIDERS = {
  finnhub: {
    name: 'Finnhub',
    tier: 4, // Premium media tier
    enabled: !!FINNHUB_API_KEY,
    timeout: 15000
  },
  alphaVantage: {
    name: 'Alpha Vantage',
    tier: 3, // Industry/aggregators tier
    enabled: !!ALPHA_VANTAGE_API_KEY,
    timeout: 15000
  }
  // Twelve Data: News API not yet implemented
  // Will be added when endpoint becomes available
};

/**
 * Main function: Fetch and score news for a symbol
 * @param {string} symbol - Stock symbol (e.g., 'AAPL', 'NVDA')
 * @param {Object} options - Query options
 * @param {number} options.limit - Max articles to return (default: 5)
 * @param {number} options.days - Days of history to fetch (default: 7)
 * @param {boolean} options.generateSummaries - Generate AI summaries (long + short) (default: false)
 * @param {string} options.language - Language for summaries (en/zh/es) (default: 'en')
 * @returns {Promise<Array>} Array of scored news articles
 */
async function fetchAndScoreNews(symbol, options = {}) {
  const { limit = 5, days = 7, generateSummaries: shouldGenerateSummaries = false, language = 'en' } = options;
  
  console.log(`\n📰 [NewsQuery] Fetching news for ${symbol}`);
  console.log(`   ├─ Limit: ${limit} articles`);
  console.log(`   └─ History: ${days} days\n`);
  
  // Try providers in cascade order
  let articles = [];
  let usedProvider = null;
  let providerErrors = [];
  
  for (const [key, config] of Object.entries(PROVIDERS)) {
    if (!config.enabled) {
      console.log(`⏭️  [NewsQuery] ${config.name} - API key not configured`);
      continue;
    }
    
    try {
      console.log(`🔄 [NewsQuery] Trying ${config.name}...`);
      
      if (key === 'finnhub') {
        const rawArticles = await fetchFromFinnhub(symbol, days, config.timeout);
        articles = finnhubAdapter.mapArticles(rawArticles, symbol);
      } else if (key === 'alphaVantage') {
        const rawArticles = await fetchFromAlphaVantage(symbol, days, config.timeout);
        articles = alphaAdapter.mapArticles(rawArticles, symbol);
      }
      
      if (articles.length > 0) {
        // Add provider tier metadata to each article
        articles = articles.map(article => ({
          ...article,
          providerTier: config.tier
        }));
        
        usedProvider = config.name;
        console.log(`✅ [NewsQuery] ${config.name} returned ${articles.length} normalized articles`);
        break; // Success - stop cascade
      } else {
        console.log(`⚠️  [NewsQuery] ${config.name} returned 0 articles`);
        providerErrors.push({ provider: config.name, error: 'No articles returned' });
      }
      
    } catch (error) {
      console.error(`❌ [NewsQuery] ${config.name} failed: ${error.message}`);
      providerErrors.push({ provider: config.name, error: error.message });
      // Continue to next provider
    }
  }
  
  // No articles from any provider
  if (articles.length === 0) {
    console.log(`\n❌ [NewsQuery] All providers failed or returned no news`);
    providerErrors.forEach(({ provider, error }) => {
      console.log(`   ├─ ${provider}: ${error}`);
    });
    
    // Check if this is a configuration issue
    if (!FINNHUB_API_KEY && !ALPHA_VANTAGE_API_KEY) {
      throw new Error('No news API keys configured. Please set FINNHUB_API_KEY or ALPHA_VANTAGE_API_KEY in environment variables.');
    }
    
    // Otherwise, no news found (legitimate scenario)
    return [];
  }
  
  // Deduplicate by URL
  const deduplicated = deduplicateByUrl(articles);
  
  // 🔧 v7.7: Filter by relevance to queried symbol
  const relevant = filterByRelevance(deduplicated, symbol);
  
  // Score articles using ImpactRank 2.0
  console.log(`📊 [NewsQuery] Scoring articles with ImpactRank 2.0...`);
  const scored = await scoreArticles(relevant);
  
  // 🔧 v7.7: Two-pass filtering with strict relevance threshold
  // Pass 1: Filter out low-relevance articles
  // Threshold 4 requires at least: ticker in metadata (3) + one textual mention
  // Or: company name in headline (8) alone, or symbol in headline (10) alone
  const MIN_RELEVANCE_THRESHOLD = 4;
  const relevantArticles = scored.filter(a => (a._relevanceScore || 0) >= MIN_RELEVANCE_THRESHOLD);
  
  console.log(`🎯 [NewsQuery] Relevance gate: ${scored.length} → ${relevantArticles.length} articles (threshold: ${MIN_RELEVANCE_THRESHOLD})`);
  
  // No fallback - strictly enforce relevance requirement
  const articlesToSort = relevantArticles;
  
  // Pass 2: Hybrid sort combining relevance and impact
  // Formula: hybrid = (normalized_relevance * 0.4) + (impact * 0.6)
  // But cap impact contribution when relevance is low
  const withHybridScore = articlesToSort.map(article => {
    const relevance = article._relevanceScore || 0;
    const impact = article.composite_score || 0;
    
    // Normalize relevance to 0-10 scale (max is ~13)
    const normalizedRelevance = Math.min(10, relevance * 0.77);
    
    // Cap impact contribution for low-relevance articles
    const relevanceFactor = Math.min(1, relevance / 5); // 0-1 scale
    const cappedImpact = impact * relevanceFactor;
    
    const hybridScore = (normalizedRelevance * 0.4) + (cappedImpact * 0.6);
    return { ...article, _hybridScore: hybridScore };
  });
  
  // Sort by hybrid score and limit
  const topArticles = withHybridScore
    .sort((a, b) => (b._hybridScore || 0) - (a._hybridScore || 0))
    .slice(0, limit);
  
  console.log(`\n✅ [NewsQuery] Returning top ${topArticles.length} articles from ${usedProvider}`);
  topArticles.forEach((article, i) => {
    const hybrid = article._hybridScore || 0;
    const impact = article.impactScore || article.composite_score || 0;
    const relevance = article._relevanceScore || 0;
    const headline = article.headline || 'No title';
    console.log(`   ${i + 1}. Hybrid: ${hybrid.toFixed(1)} (R:${relevance}, I:${impact.toFixed(1)}) - ${headline.substring(0, 40)}...`);
  });
  
  // Optional: Generate AI summaries (long + short)
  if (shouldGenerateSummaries && topArticles.length > 0) {
    console.log(`\n📝 [NewsQuery] Generating AI summaries (${language.toUpperCase()})...`);
    
    try {
      const articlesWithSummaries = await batchGenerateSummaries(topArticles, language, {
        maxConcurrent: 3,
        delayMs: 500
      });
      
      // Count only successful AI-generated summaries (not fallbacks)
      const successCount = articlesWithSummaries.filter(a => a.summarization_success === true).length;
      const failCount = articlesWithSummaries.filter(a => a.summarization_success === false).length;
      
      console.log(`✅ [NewsQuery] AI summaries: ${successCount} successful, ${failCount} failed`);
      
      return articlesWithSummaries;
    } catch (summaryError) {
      console.error(`⚠️  [NewsQuery] Summary generation failed: ${summaryError.message}`);
      console.log(`   └─ Returning articles without enhanced summaries\n`);
      return topArticles;
    }
  }
  
  return topArticles;
}

/**
 * Fetch news from Finnhub API
 */
async function fetchFromFinnhub(symbol, days, timeout) {
  const today = new Date();
  const pastDate = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
  
  const fromDate = pastDate.toISOString().split('T')[0];
  const toDate = today.toISOString().split('T')[0];
  
  const url = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${fromDate}&to=${toDate}&token=${FINNHUB_API_KEY}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'USIS-Brain/7.0' }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const news = await response.json();
    
    // Return raw Finnhub data (adapter will normalize)
    return news.filter(article => article.headline && article.datetime);
      
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

// Twelve Data News API - Not yet implemented
// Will be added when Twelve Data provides a news endpoint
// Expected format: https://api.twelvedata.com/news?symbol=AAPL&apikey=xxx

/**
 * Fetch news from Alpha Vantage API
 */
async function fetchFromAlphaVantage(symbol, days, timeout) {
  const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'USIS-Brain/7.0' }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.feed || !Array.isArray(data.feed)) {
      return [];
    }
    
    // Filter by date
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    // Return raw Alpha Vantage data (adapter will normalize)
    return data.feed.filter(article => {
      const pubTime = new Date(article.time_published).getTime();
      return pubTime >= cutoffTime && article.title;
    });
      
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

/**
 * 🔧 v7.7: Filter articles by relevance to queried symbol
 * Ensures returned news is directly related to the stock, not just mentioning it
 * 
 * Uses multiple signals:
 * 1. Symbol in headline (highest weight)
 * 2. Company name in content
 * 3. Related tickers from provider
 * 
 * @param {Array} articles - Normalized articles with provider metadata
 * @param {string} symbol - Stock symbol
 * @returns {Array} Filtered articles (preserves all metadata)
 */
function filterByRelevance(articles, symbol) {
  if (!symbol || !articles || articles.length === 0) {
    return articles;
  }
  
  const symbolUpper = symbol.toUpperCase();
  const companyNames = getCompanyNames(symbolUpper);
  
  // Score each article for relevance
  const scored = articles.map(article => {
    const headline = (article.headline || '').toUpperCase();
    const summary = (article.rawSummary || article.summary || '').toUpperCase();
    const content = headline + ' ' + summary;
    
    let relevanceScore = 0;
    
    // Signal 1: Symbol in headline (highest weight: +10)
    if (headline.includes(symbolUpper)) {
      relevanceScore += 10;
    }
    
    // Signal 2: Company name in headline (+8) or summary (+4)
    for (const name of companyNames) {
      if (headline.includes(name.toUpperCase())) {
        relevanceScore += 8;
        break;
      } else if (summary.includes(name.toUpperCase())) {
        relevanceScore += 4;
        break;
      }
    }
    
    // Signal 3: Symbol in related tickers (+3)
    if (article.symbols && article.symbols.includes(symbolUpper)) {
      relevanceScore += 3;
    }
    
    // Penalty: Generic market news (-5)
    const genericPatterns = ['MARKET WRAP', 'S&P 500', 'STOCKS TODAY', 'DOW JONES', 'NASDAQ COMPOSITE'];
    if (genericPatterns.some(p => headline.includes(p))) {
      relevanceScore -= 5;
    }
    
    return { ...article, _relevanceScore: relevanceScore };
  });
  
  // 🔧 v7.7: Don't filter, just sort by relevance score
  // This preserves all articles while prioritizing relevant ones
  const sorted = scored.sort((a, b) => b._relevanceScore - a._relevanceScore);
  
  const highlyRelevant = scored.filter(a => a._relevanceScore >= 8).length;
  const relevant = scored.filter(a => a._relevanceScore > 0).length;
  
  console.log(`🎯 [NewsQuery] Relevance scoring: ${articles.length} articles for ${symbol}`);
  console.log(`   ├─ Highly relevant (8+): ${highlyRelevant}`);
  console.log(`   └─ Relevant (>0): ${relevant}`);
  
  return sorted;
}

/**
 * Get common company names for a symbol
 * Used for relevance filtering
 */
function getCompanyNames(symbol) {
  const knownCompanies = {
    'AAPL': ['APPLE', 'IPHONE', 'IPAD', 'MACBOOK', 'TIM COOK'],
    'NVDA': ['NVIDIA', 'GEFORCE', 'RTX', 'JENSEN HUANG', 'GPU'],
    'MSFT': ['MICROSOFT', 'WINDOWS', 'AZURE', 'SATYA NADELLA', 'XBOX'],
    'GOOGL': ['GOOGLE', 'ALPHABET', 'YOUTUBE', 'ANDROID', 'SUNDAR PICHAI'],
    'GOOG': ['GOOGLE', 'ALPHABET', 'YOUTUBE', 'ANDROID', 'SUNDAR PICHAI'],
    'AMZN': ['AMAZON', 'AWS', 'PRIME', 'ANDY JASSY', 'BEZOS'],
    'META': ['META', 'FACEBOOK', 'INSTAGRAM', 'WHATSAPP', 'ZUCKERBERG'],
    'TSLA': ['TESLA', 'ELON MUSK', 'MODEL S', 'MODEL 3', 'MODEL Y', 'CYBERTRUCK'],
    'AMD': ['AMD', 'ADVANCED MICRO', 'RYZEN', 'RADEON', 'LISA SU'],
    'INTC': ['INTEL', 'CORE I', 'XEON', 'PAT GELSINGER'],
    'NFLX': ['NETFLIX', 'STREAMING'],
    'DIS': ['DISNEY', 'DISNEY+', 'MARVEL', 'PIXAR'],
    'BA': ['BOEING', '737', '787', 'DREAMLINER'],
    'JPM': ['JPMORGAN', 'JP MORGAN', 'CHASE', 'JAMIE DIMON'],
    'GS': ['GOLDMAN SACHS', 'GOLDMAN'],
    'V': ['VISA'],
    'MA': ['MASTERCARD'],
    'WMT': ['WALMART'],
    'COST': ['COSTCO'],
    'HD': ['HOME DEPOT'],
    'NKE': ['NIKE'],
    'SBUX': ['STARBUCKS'],
    'MCD': ['MCDONALD'],
    'KO': ['COCA-COLA', 'COCA COLA', 'COKE'],
    'PEP': ['PEPSI', 'PEPSICO'],
    'PFE': ['PFIZER'],
    'JNJ': ['JOHNSON', 'J&J'],
    'UNH': ['UNITEDHEALTH', 'UNITED HEALTH'],
    'XOM': ['EXXON', 'EXXONMOBIL'],
    'CVX': ['CHEVRON'],
    'CRM': ['SALESFORCE'],
    'ORCL': ['ORACLE'],
    'IBM': ['IBM'],
    'CSCO': ['CISCO']
  };
  
  return knownCompanies[symbol] || [symbol];
}

/**
 * Deduplicate articles by URL
 * Works with normalized article structure
 */
function deduplicateByUrl(articles) {
  const seen = new Set();
  const deduplicated = [];
  
  for (const article of articles) {
    // Use URL as dedup key (or headline if URL missing)
    const key = article.url || article.headline?.substring(0, 100) || article.id;
    
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(article);
    }
  }
  
  console.log(`🔄 [NewsQuery] Deduplicated: ${articles.length} → ${deduplicated.length} articles`);
  return deduplicated;
}

/**
 * Score articles using ImpactRank 2.0 (stateless mode)
 */
async function scoreArticles(articles) {
  const scorer = getStatelessScorer();
  
  const scored = [];
  
  for (const article of articles) {
    try {
      // Prepare article for scoring (newsScoring expects specific structure)
      const articleForScoring = {
        title: article.headline, // newsScoring uses 'title' not 'headline'
        headline: article.headline,
        summary: article.rawSummary || article.headline,
        symbols: article.symbols || [], // Required: array for relevance calculation
        published_at: new Date(article.publishedAt),
        source: article.source,
        url: article.url
      };
      
      // Use stateless scoring with correct signature
      const scoreResult = await scorer.scoreArticle(
        articleForScoring,
        article.providerTier || 3, // Provider tier (default: 3)
        {
          mode: 'stateless', // Don't query DB
          corroboration: 0, // No historical data available
          symbols: [article.symbol] // Array of symbols
        }
      );
      
      // Map impact score to level and emoji
      const impact_level = getImpactLevel(scoreResult.composite_score);
      const impact_emoji = getImpactEmoji(scoreResult.composite_score);
      const impact_reason = generateImpactReason(scoreResult);
      
      scored.push({
        ...article,
        // ImpactRank 2.0 scores
        impactScore: scoreResult.composite_score || 0,
        impactLevel: impact_level,
        impactEmoji: impact_emoji,
        impactReason: impact_reason,
        // Keep legacy field names for compatibility
        composite_score: scoreResult.composite_score || 0,
        impact_score: scoreResult.composite_score || 0,
        impact_level: impact_level,
        impact_reason: impact_reason,
        score_breakdown: scoreResult.breakdown || scoreResult.scores
      });
      
    } catch (error) {
      console.error(`⚠️  [NewsQuery] Failed to score article: ${error.message}`);
      
      // 🔧 v7.7: Fallback with Chinese-friendly reason
      scored.push({
        ...article,
        impactScore: 5.0,
        impactLevel: 'Medium',
        impactEmoji: '🟡',
        impactReason: 'general market news', // Use known key for translation
        composite_score: 5.0,
        impact_score: 5.0,
        impact_level: 'Medium',
        impact_reason: 'general market news',
        score_breakdown: null
      });
    }
  }
  
  return scored;
}

/**
 * Map numeric score to impact level
 */
function getImpactLevel(score) {
  if (score >= 7.0) return 'High';
  if (score >= 4.0) return 'Medium';
  return 'Low';
}

/**
 * Map numeric score to impact emoji
 */
function getImpactEmoji(score) {
  if (score >= 7.0) return '🔴'; // High impact - Red circle
  if (score >= 4.0) return '🟡'; // Medium impact - Yellow circle
  return '🟢'; // Low impact - Green circle
}

/**
 * Generate human-readable impact reason
 */
function generateImpactReason(scoreResult) {
  const { scores } = scoreResult;
  
  const reasons = [];
  
  // Freshness
  if (scores.freshness >= 0.8) {
    reasons.push('breaking news');
  } else if (scores.freshness >= 0.5) {
    reasons.push('recent update');
  }
  
  // Impact keywords
  if (scores.impact >= 0.85) {
    reasons.push('critical market event');
  } else if (scores.impact >= 0.6) {
    reasons.push('significant development');
  }
  
  // Source quality
  if (scores.source_quality >= 0.8) {
    reasons.push('premium source');
  }
  
  // Fallback
  if (reasons.length === 0) {
    reasons.push('general market news');
  }
  
  return reasons.join(', ');
}

module.exports = {
  fetchAndScoreNews,
  // Re-export summarizer functions for direct use
  generateSummaries,
  batchGenerateSummaries
};
