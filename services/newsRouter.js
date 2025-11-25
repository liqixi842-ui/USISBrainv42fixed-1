/**
 * ═══════════════════════════════════════════════════════════════
 * USIS Brain v7.1 - News Router (Unified Entry Point)
 * ═══════════════════════════════════════════════════════════════
 * 
 * Purpose: Centralized routing for all news-related operations
 * Integrates: Scoring, Summarization, Translation, Deduplication
 * 
 * Architecture:
 * - User-side queries: /news command → newsRouter → newsQueryService
 * - N8N ingest: RSS → newsRouter → newsIngestAPI → Database
 * - Shared utilities: All pipelines use same scoring/summarization/translation
 */

const { getStatelessScorer } = require('../newsScoring');
const { generateSummaries, batchGenerateSummaries } = require('./newsAutoSummarizer');
const { translateNewsSummary, batchTranslateSummaries } = require('../utils/newsTranslationService');
const { getDeduplicator } = require('../newsDeduplication');

/**
 * Process a single news article through the full pipeline
 * @param {Object} article - News article object
 * @param {Object} options - Processing options
 * @param {boolean} options.generateSummary - Generate AI summaries (default: false)
 * @param {boolean} options.translate - Translate to multiple languages (default: false)
 * @param {string} options.language - Target language for summary (default: 'en')
 * @param {string} options.symbol - Stock symbol for relevance scoring
 * @returns {Promise<Object>} Processed article with scores, summaries, translations
 */
async function processNewsArticle(article, options = {}) {
  const {
    generateSummary = false,
    translate = false,
    language = 'en',
    symbol = null
  } = options;
  
  const startTime = Date.now();
  console.log(`\n🔄 [NewsRouter] Processing article: ${article.headline?.substring(0, 60)}...`);
  
  try {
    // Step 1: Score the article (ImpactRank 2.0)
    let scoreResult = null;
    if (symbol) {
      console.log(`📊 [NewsRouter] Scoring article for symbol: ${symbol}`);
      
      // Get stateless scorer instance and call score method
      const scorer = getStatelessScorer();
      scoreResult = await scorer.score(article, symbol);
      
      article.composite_score = scoreResult.composite_score;
      article.impact_level = scoreResult.impact_level;
      article.breakdown = scoreResult.breakdown;
    }
    
    // Step 2: Generate AI summaries (optional, only if requested or high-impact)
    const shouldSummarize = generateSummary || (scoreResult && scoreResult.composite_score >= 6.0);
    
    if (shouldSummarize) {
      try {
        console.log(`📝 [NewsRouter] Generating AI summaries...`);
        const summaries = await generateSummaries(article, language);
        
        article.long_summary = summaries.long_summary;
        article.short_summary = summaries.short_summary;
        article.key_metrics = summaries.key_metrics;
        article.market_impact = summaries.market_impact;
        article.summarization_success = true;
        
        console.log(`✅ [NewsRouter] Summaries generated`);
      } catch (summaryError) {
        console.warn(`⚠️  [NewsRouter] Summary generation failed: ${summaryError.message}`);
        article.long_summary = null;
        article.short_summary = null;
        article.key_metrics = [];
        article.market_impact = null;
        article.summarization_success = false;
      }
    }
    
    // Step 3: Translate (optional)
    if (translate) {
      try {
        console.log(`🌐 [NewsRouter] Translating to multiple languages...`);
        const translations = await translateNewsSummary(article.summary || article.headline);
        
        article.summary_en = translations.en;
        article.summary_cn = translations.cn;
        article.summary_es = translations.es;
        article.translation_success = true;
        
        console.log(`✅ [NewsRouter] Translation complete`);
      } catch (translationError) {
        console.warn(`⚠️  [NewsRouter] Translation failed: ${translationError.message}`);
        article.translation_success = false;
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ [NewsRouter] Processing complete (${duration}ms)`);
    
    return {
      success: true,
      article,
      processing_time_ms: duration
    };
    
  } catch (error) {
    console.error(`❌ [NewsRouter] Processing failed: ${error.message}`);
    return {
      success: false,
      article,
      error: error.message,
      processing_time_ms: Date.now() - startTime
    };
  }
}

/**
 * Process multiple news articles in batch
 * @param {Array<Object>} articles - Array of news articles
 * @param {Object} options - Processing options (same as processNewsArticle)
 * @returns {Promise<Array<Object>>} Array of processed articles
 */
async function processBatchNewsArticles(articles, options = {}) {
  const {
    generateSummary = false,
    translate = false,
    language = 'en',
    symbol = null,
    deduplicate = true
  } = options;
  
  console.log(`\n🔄 [NewsRouter] Processing batch of ${articles.length} articles`);
  const startTime = Date.now();
  
  try {
    let processedArticles = [...articles];
    
    // Step 1: Deduplicate if requested
    if (deduplicate) {
      console.log(`🔍 [NewsRouter] Deduplicating articles...`);
      const beforeCount = processedArticles.length;
      
      // Use deduplication module
      const deduplicator = getDeduplicator();
      processedArticles = await deduplicator.deduplicateByContent(processedArticles);
      
      const removedCount = beforeCount - processedArticles.length;
      
      if (removedCount > 0) {
        console.log(`✅ [NewsRouter] Removed ${removedCount} duplicate(s)`);
      }
    }
    
    // Step 2: Score all articles
    if (symbol) {
      console.log(`📊 [NewsRouter] Scoring ${processedArticles.length} articles for ${symbol}...`);
      
      // Get scorer instance once for efficiency
      const scorer = getStatelessScorer();
      
      for (const article of processedArticles) {
        try {
          const scoreResult = await scorer.score(article, symbol);
          
          article.composite_score = scoreResult.composite_score;
          article.impact_level = scoreResult.impact_level;
          article.breakdown = scoreResult.breakdown;
        } catch (scoreError) {
          console.warn(`⚠️  [NewsRouter] Scoring failed for article: ${scoreError.message}`);
          article.composite_score = 5.0; // Default medium score
          article.impact_level = 'Medium';
        }
      }
    }
    
    // Step 3: Batch generate summaries (optional)
    if (generateSummary) {
      console.log(`📝 [NewsRouter] Batch generating summaries...`);
      
      const articlesWithSummaries = await batchGenerateSummaries(processedArticles, language, {
        maxConcurrent: 3,
        delayMs: 500
      });
      
      processedArticles = articlesWithSummaries;
    }
    
    // Step 4: Batch translate (optional)
    if (translate) {
      console.log(`🌐 [NewsRouter] Batch translating summaries...`);
      
      const summariesToTranslate = processedArticles.map(a => a.summary || a.headline);
      const translations = await batchTranslateSummaries(summariesToTranslate, {
        batchSize: 3,
        delayMs: 500
      });
      
      processedArticles = processedArticles.map((article, index) => ({
        ...article,
        summary_en: translations[index].en,
        summary_cn: translations[index].cn,
        summary_es: translations[index].es,
        translation_success: translations[index].translation_success
      }));
    }
    
    const duration = Date.now() - startTime;
    const successCount = processedArticles.filter(a => a.summarization_success !== false).length;
    
    console.log(`✅ [NewsRouter] Batch processing complete`);
    console.log(`   ├─ Total: ${processedArticles.length} articles`);
    console.log(`   ├─ Success: ${successCount}`);
    console.log(`   └─ Duration: ${duration}ms`);
    
    return processedArticles;
    
  } catch (error) {
    console.error(`❌ [NewsRouter] Batch processing failed: ${error.message}`);
    return articles; // Return original articles on failure
  }
}

/**
 * Deduplicate news articles
 * @param {Array<Object>} articles - Array of news articles
 * @returns {Array<Object>} Deduplicated articles
 */
async function deduplicateArticles(articles) {
  console.log(`🔍 [NewsRouter] Deduplicating ${articles.length} articles...`);
  
  try {
    const deduplicator = getDeduplicator();
    const deduplicated = await deduplicator.deduplicateByContent(articles);
    const removedCount = articles.length - deduplicated.length;
    
    if (removedCount > 0) {
      console.log(`✅ [NewsRouter] Removed ${removedCount} duplicate(s)`);
    } else {
      console.log(`✅ [NewsRouter] No duplicates found`);
    }
    
    return deduplicated;
  } catch (error) {
    console.error(`❌ [NewsRouter] Deduplication failed: ${error.message}`);
    return articles; // Return original on failure
  }
}

/**
 * Score a single news article (ImpactRank 2.0)
 * @param {Object} article - News article
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} Score result
 */
async function scoreArticle(article, symbol) {
  try {
    // Get stateless scorer instance and call score method
    const scorer = getStatelessScorer();
    const scoreResult = await scorer.score(article, symbol);
    
    console.log(`📊 [NewsRouter] Score: ${scoreResult.composite_score}/10 (${scoreResult.impact_level})`);
    return scoreResult;
  } catch (error) {
    console.error(`❌ [NewsRouter] Scoring failed: ${error.message}`);
    return {
      composite_score: 5.0,
      impact_level: 'Medium',
      breakdown: 'Error',
      error: error.message
    };
  }
}

/**
 * Generate AI summaries for an article
 * @param {Object} article - News article
 * @param {string} language - Target language (default: 'en')
 * @returns {Promise<Object>} Summary result
 */
async function summarizeArticle(article, language = 'en') {
  try {
    const summaries = await generateSummaries(article, language);
    console.log(`📝 [NewsRouter] Summaries generated: ${summaries.word_count.long}w + ${summaries.word_count.short}w`);
    return summaries;
  } catch (error) {
    console.error(`❌ [NewsRouter] Summarization failed: ${error.message}`);
    throw error;
  }
}

/**
 * Translate an article summary to multiple languages
 * @param {string} summary - Article summary
 * @returns {Promise<Object>} Translation result { en, cn, es }
 */
async function translateArticle(summary) {
  try {
    const translations = await translateNewsSummary(summary);
    console.log(`🌐 [NewsRouter] Translations complete`);
    return translations;
  } catch (error) {
    console.error(`❌ [NewsRouter] Translation failed: ${error.message}`);
    throw error;
  }
}

/**
 * Get router statistics
 */
function getRouterStats() {
  const { getCacheStats } = require('../utils/newsTranslationService');
  
  return {
    translation_cache: getCacheStats(),
    router_version: '7.1'
  };
}

module.exports = {
  // Main processing functions
  processNewsArticle,
  processBatchNewsArticles,
  
  // Individual operations
  scoreArticle,
  summarizeArticle,
  translateArticle,
  deduplicateArticles,
  
  // Utilities
  getRouterStats
};
