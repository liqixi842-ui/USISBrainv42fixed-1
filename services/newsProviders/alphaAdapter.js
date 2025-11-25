/**
 * Alpha Vantage News Provider Adapter
 * 
 * Normalizes Alpha Vantage API responses into unified news article format.
 * 
 * Alpha Vantage API Response Structure:
 * {
 *   time_published: "20240124T153000",  // YYYYMMDDTHHMMSS format
 *   title: "Article Title",
 *   summary: "Article description...",
 *   url: "https://...",
 *   source: "Reuters",
 *   ticker_sentiment: [                // Optional
 *     { ticker: "AAPL", relevance_score: "0.8" }
 *   ]
 * }
 * 
 * @module services/newsProviders/alphaAdapter
 */

/**
 * Generate a unique ID for a news article
 * @param {Object} article - Raw Alpha Vantage article
 * @returns {string} Unique article ID
 */
function generateArticleId(article) {
  const timestamp = article.time_published || Date.now();
  const titleHash = (article.title || '').substring(0, 30).replace(/\s/g, '_');
  return `alpha_${timestamp}_${titleHash}`;
}

/**
 * Normalize Alpha Vantage datetime to ISO8601 format
 * @param {string} alphaDateTime - Alpha Vantage datetime (YYYYMMDDTHHMMSS)
 * @returns {string} ISO8601 formatted datetime
 */
function normalizeDateTime(alphaDateTime) {
  try {
    if (!alphaDateTime) {
      return new Date().toISOString();
    }
    
    // Alpha Vantage format: "20240124T153000"
    // Extract: YYYY-MM-DD HH:MM:SS
    const year = alphaDateTime.substring(0, 4);
    const month = alphaDateTime.substring(4, 6);
    const day = alphaDateTime.substring(6, 8);
    const hour = alphaDateTime.substring(9, 11) || '00';
    const minute = alphaDateTime.substring(11, 13) || '00';
    const second = alphaDateTime.substring(13, 15) || '00';
    
    // Construct ISO8601 string
    const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
    
    // Validate the date
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      console.warn('⚠️  [AlphaAdapter] Invalid datetime, using current time');
      return new Date().toISOString();
    }
    
    return date.toISOString();
  } catch (error) {
    console.error('❌ [AlphaAdapter] DateTime conversion failed:', error.message);
    return new Date().toISOString();
  }
}

/**
 * Extract primary symbol from ticker sentiment array
 * @param {Array} tickerSentiment - Ticker sentiment array
 * @param {string} requestedSymbol - Symbol from original request
 * @returns {string|null} Primary symbol
 */
function extractSymbol(tickerSentiment, requestedSymbol = null) {
  // If we have a requested symbol, use it
  if (requestedSymbol) {
    return requestedSymbol;
  }
  
  // Otherwise, try to extract from ticker sentiment
  if (!Array.isArray(tickerSentiment) || tickerSentiment.length === 0) {
    return null;
  }
  
  // Return the ticker with highest relevance score
  const sorted = tickerSentiment.sort((a, b) => {
    const scoreA = parseFloat(a.relevance_score || 0);
    const scoreB = parseFloat(b.relevance_score || 0);
    return scoreB - scoreA;
  });
  
  return sorted[0].ticker || null;
}

/**
 * Map a single Alpha Vantage article to normalized format
 * @param {Object} article - Raw Alpha Vantage article
 * @param {string} symbol - Stock symbol (optional)
 * @returns {Object} Normalized article
 */
function mapArticle(article, symbol = null) {
  if (!article || typeof article !== 'object') {
    throw new Error('Invalid article object');
  }
  
  // Required field validation
  if (!article.title) {
    throw new Error('Missing required field: title');
  }
  
  return {
    // Unique identifier
    id: generateArticleId(article),
    
    // Core fields
    symbol: extractSymbol(article.ticker_sentiment, symbol),
    symbols: symbol ? [symbol] : (extractSymbol(article.ticker_sentiment, symbol) ? [extractSymbol(article.ticker_sentiment, symbol)] : []), // Array for scorer
    headline: article.title.trim(),
    
    // Summary fields
    // Alpha provides a summary, use it as rawSummary fallback
    // Will be enhanced by newsAutoSummarizer
    summaryShort: null,  // Will be filled by newsAutoSummarizer (100-150 words)
    summaryLong: null,   // Will be filled by newsAutoSummarizer (300-500 words)
    
    // Metadata
    source: article.source || 'Alpha Vantage',
    publishedAt: normalizeDateTime(article.time_published),
    url: article.url || '',
    
    // Impact scoring (to be filled by newsScoring)
    impactScore: null,
    impactLevel: null,
    impactEmoji: null,
    impactReason: null,
    
    // Language (Alpha Vantage primarily provides English content)
    language: 'en',
    
    // Provider tracking
    provider: 'alpha_vantage',
    
    // Raw summary from provider (used as fallback)
    rawSummary: article.summary || null,
    
    // Additional metadata
    tickerSentiment: article.ticker_sentiment || []
  };
}

/**
 * Map an array of Alpha Vantage articles to normalized format
 * @param {Array<Object>} articles - Raw Alpha Vantage articles
 * @param {string} symbol - Stock symbol (optional)
 * @returns {Array<Object>} Normalized articles
 */
function mapArticles(articles, symbol = null) {
  if (!Array.isArray(articles)) {
    console.warn('⚠️  [AlphaAdapter] Expected array, got:', typeof articles);
    return [];
  }
  
  const normalized = [];
  
  for (const article of articles) {
    try {
      const mappedArticle = mapArticle(article, symbol);
      normalized.push(mappedArticle);
    } catch (error) {
      console.warn('⚠️  [AlphaAdapter] Failed to map article:', error.message);
      // Continue processing other articles
    }
  }
  
  console.log(`✅ [AlphaAdapter] Normalized ${normalized.length}/${articles.length} articles`);
  return normalized;
}

/**
 * Validate normalized article structure
 * @param {Object} article - Normalized article
 * @returns {boolean} True if valid
 */
function validateNormalized(article) {
  const requiredFields = ['id', 'headline', 'publishedAt', 'source', 'language', 'provider'];
  
  for (const field of requiredFields) {
    if (article[field] === undefined || article[field] === null) {
      console.error(`❌ [AlphaAdapter] Missing required field: ${field}`);
      return false;
    }
  }
  
  // Validate publishedAt is valid ISO8601
  try {
    const date = new Date(article.publishedAt);
    if (isNaN(date.getTime())) {
      console.error('❌ [AlphaAdapter] Invalid publishedAt format');
      return false;
    }
  } catch (error) {
    console.error('❌ [AlphaAdapter] publishedAt validation failed');
    return false;
  }
  
  return true;
}

module.exports = {
  mapArticle,
  mapArticles,
  validateNormalized,
  normalizeDateTime
};
