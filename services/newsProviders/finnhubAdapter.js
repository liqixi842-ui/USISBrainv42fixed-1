/**
 * Finnhub News Provider Adapter
 * 
 * Normalizes Finnhub API responses into unified news article format.
 * 
 * Finnhub API Response Structure:
 * {
 *   datetime: 1234567890,           // Unix timestamp (seconds)
 *   headline: "Article Title",
 *   source: "Reuters",
 *   url: "https://...",
 *   summary: "Short description",   // Optional, not always provided
 *   related: "AAPL"                 // Symbol (optional)
 * }
 * 
 * @module services/newsProviders/finnhubAdapter
 */

/**
 * Generate a unique ID for a news article
 * @param {Object} article - Raw Finnhub article
 * @returns {string} Unique article ID
 */
function generateArticleId(article) {
  const timestamp = article.datetime || Date.now() / 1000;
  const headlineHash = (article.headline || '').substring(0, 30).replace(/\s/g, '_');
  return `finnhub_${timestamp}_${headlineHash}`;
}

/**
 * Normalize Finnhub datetime to ISO8601 format
 * @param {number} unixTimestamp - Unix timestamp in seconds
 * @returns {string} ISO8601 formatted datetime
 */
function normalizeDateTime(unixTimestamp) {
  try {
    if (!unixTimestamp) {
      return new Date().toISOString();
    }
    
    // Finnhub uses seconds, JavaScript uses milliseconds
    const date = new Date(unixTimestamp * 1000);
    
    // Validate the date
    if (isNaN(date.getTime())) {
      console.warn('⚠️  [FinnhubAdapter] Invalid datetime, using current time');
      return new Date().toISOString();
    }
    
    return date.toISOString();
  } catch (error) {
    console.error('❌ [FinnhubAdapter] DateTime conversion failed:', error.message);
    return new Date().toISOString();
  }
}

/**
 * Map a single Finnhub article to normalized format
 * @param {Object} article - Raw Finnhub article
 * @param {string} symbol - Stock symbol (optional)
 * @returns {Object} Normalized article
 */
function mapArticle(article, symbol = null) {
  if (!article || typeof article !== 'object') {
    throw new Error('Invalid article object');
  }
  
  // Required field validation
  if (!article.headline) {
    throw new Error('Missing required field: headline');
  }
  
  return {
    // Unique identifier
    id: generateArticleId(article),
    
    // Core fields
    symbol: symbol || article.related || null,
    symbols: symbol ? [symbol] : (article.related ? [article.related] : []), // Array for scorer
    headline: article.headline.trim(),
    
    // Summary fields (to be filled by summarizer)
    summaryShort: null,  // Will be filled by newsAutoSummarizer (100-150 words)
    summaryLong: null,   // Will be filled by newsAutoSummarizer (300-500 words)
    
    // Metadata
    source: article.source || 'Finnhub',
    publishedAt: normalizeDateTime(article.datetime),
    url: article.url || '',
    
    // Impact scoring (to be filled by newsScoring)
    impactScore: null,
    impactLevel: null,
    impactEmoji: null,
    impactReason: null,
    
    // Language (Finnhub primarily provides English content)
    language: 'en',
    
    // Provider tracking
    provider: 'finnhub',
    
    // Raw summary from provider (if available, used as fallback)
    rawSummary: article.summary || null
  };
}

/**
 * Map an array of Finnhub articles to normalized format
 * @param {Array<Object>} articles - Raw Finnhub articles
 * @param {string} symbol - Stock symbol (optional)
 * @returns {Array<Object>} Normalized articles
 */
function mapArticles(articles, symbol = null) {
  if (!Array.isArray(articles)) {
    console.warn('⚠️  [FinnhubAdapter] Expected array, got:', typeof articles);
    return [];
  }
  
  const normalized = [];
  
  for (const article of articles) {
    try {
      const mappedArticle = mapArticle(article, symbol);
      normalized.push(mappedArticle);
    } catch (error) {
      console.warn('⚠️  [FinnhubAdapter] Failed to map article:', error.message);
      // Continue processing other articles
    }
  }
  
  console.log(`✅ [FinnhubAdapter] Normalized ${normalized.length}/${articles.length} articles`);
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
      console.error(`❌ [FinnhubAdapter] Missing required field: ${field}`);
      return false;
    }
  }
  
  // Validate publishedAt is valid ISO8601
  try {
    const date = new Date(article.publishedAt);
    if (isNaN(date.getTime())) {
      console.error('❌ [FinnhubAdapter] Invalid publishedAt format');
      return false;
    }
  } catch (error) {
    console.error('❌ [FinnhubAdapter] publishedAt validation failed');
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
