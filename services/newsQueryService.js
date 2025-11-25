/**
 * ═══════════════════════════════════════════════════════════════
 * USIS Brain v7.0 - News Query Service (On-Demand News Fetching)
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
  
  // Score articles using ImpactRank 2.0
  console.log(`📊 [NewsQuery] Scoring articles with ImpactRank 2.0...`);
  const scored = await scoreArticles(deduplicated);
  
  // Sort by score (highest first) and limit
  const topArticles = scored
    .sort((a, b) => (b.composite_score || 0) - (a.composite_score || 0))
    .slice(0, limit);
  
  console.log(`\n✅ [NewsQuery] Returning top ${topArticles.length} articles from ${usedProvider}`);
  topArticles.forEach((article, i) => {
    const score = article.impactScore || article.composite_score || 0;
    const headline = article.headline || 'No title';
    console.log(`   ${i + 1}. Score: ${score.toFixed(1)}/10 - ${headline.substring(0, 50)}...`);
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
      
      // Fallback: assign default score
      scored.push({
        ...article,
        impactScore: 5.0,
        impactLevel: 'Medium',
        impactEmoji: '🟡',
        impactReason: 'Default scoring (error in ImpactRank)',
        composite_score: 5.0,
        impact_score: 5.0,
        impact_level: 'Medium',
        impact_reason: 'Default scoring (error in ImpactRank)',
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
