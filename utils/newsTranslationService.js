/**
 * ═══════════════════════════════════════════════════════════════
 * USIS Brain v7.1 - News Translation Service (Enhanced)
 * ═══════════════════════════════════════════════════════════════
 * 
 * Purpose: Translate news summaries to multiple languages
 * Supports: English (base), Chinese (zh-CN), Spanish (es)
 * Provider: Google Translate API or OpenAI (fallback)
 * 
 * Features:
 * - LRU Cache (1000 entries max)
 * - Batch processing (3-5 items at once)
 * - Non-blocking error handling
 * - Language detection fallback for short text
 */

const { translate } = require('@vitalets/google-translate-api');

/**
 * Simple LRU Cache implementation
 */
class LRUCache {
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }
  
  get(key) {
    if (!this.cache.has(key)) return null;
    
    // Move to end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    
    return value;
  }
  
  set(key, value) {
    // Delete if already exists (to re-insert at end)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    
    // Add new entry
    this.cache.set(key, value);
    
    // Evict oldest if over max size
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }
  
  has(key) {
    return this.cache.has(key);
  }
  
  clear() {
    this.cache.clear();
  }
  
  get size() {
    return this.cache.size;
  }
}

// Global translation cache (LRU, max 1000 entries)
const translationCache = new LRUCache(1000);

/**
 * Generate cache key for translation
 */
function getCacheKey(text, targetLang) {
  // Use first 100 chars + length + target lang as key
  const textSnippet = text.substring(0, 100);
  return `${targetLang}:${text.length}:${textSnippet}`;
}

/**
 * Translate text to multiple languages (with caching)
 * @param {string} text - Source text (assumed to be English)
 * @param {Array<string>} targetLangs - Target language codes (e.g., ['zh-CN', 'es'])
 * @returns {Promise<Object>} Object with language codes as keys
 */
async function translateToMultipleLanguages(text, targetLangs = ['zh-CN', 'es']) {
  // Handle empty or very short text
  if (!text || text.trim().length === 0) {
    console.log(`⚠️  [Translation] Empty text, skipping`);
    const fallback = {};
    targetLangs.forEach(lang => {
      fallback[lang] = '[No text to translate]';
    });
    return fallback;
  }
  
  // Language detection fallback: if text is too short (< 10 chars), use original
  if (text.trim().length < 10) {
    console.log(`⚠️  [Translation] Text too short (${text.length} chars), using original`);
    const fallback = {};
    targetLangs.forEach(lang => {
      fallback[lang] = text;
    });
    return fallback;
  }
  
  const results = {};
  
  for (const lang of targetLangs) {
    try {
      // Check cache first
      const cacheKey = getCacheKey(text, lang);
      const cached = translationCache.get(cacheKey);
      
      if (cached) {
        console.log(`💾 [Translation] Cache hit for ${lang}`);
        results[lang] = cached;
        continue;
      }
      
      console.log(`🌐 [Translation] Translating to ${lang}...`);
      const translated = await translateText(text, lang);
      results[lang] = translated;
      
      // Store in cache
      translationCache.set(cacheKey, translated);
      
      console.log(`✅ [Translation] ${lang}: ${translated.substring(0, 50)}...`);
      
      // Add throttling delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`❌ [Translation] Failed for ${lang}: ${error.message}`);
      results[lang] = text; // Non-blocking: fallback to original text
    }
  }
  
  return results;
}

/**
 * Translate text to a single language using Google Translate
 * @param {string} text - Source text
 * @param {string} targetLang - Target language code
 * @returns {Promise<string>} Translated text
 */
async function translateText(text, targetLang) {
  try {
    const result = await translate(text, { 
      to: targetLang,
      from: 'en' // Assume source is English
    });
    
    return result.text;
    
  } catch (error) {
    console.error(`⚠️  [Translation] Google Translate failed: ${error.message}`);
    
    // Fallback: Try OpenAI translation
    try {
      return await translateWithOpenAI(text, targetLang);
    } catch (aiError) {
      console.error(`❌ [Translation] OpenAI fallback failed: ${aiError.message}`);
      throw new Error(`Translation failed for ${targetLang}`);
    }
  }
}

/**
 * Fallback: Translate using OpenAI
 * @param {string} text - Source text
 * @param {string} targetLang - Target language code
 * @returns {Promise<string>} Translated text
 */
async function translateWithOpenAI(text, targetLang) {
  const { generateWithGPT5 } = require('../gpt5Brain');
  
  const langNames = {
    'zh-CN': 'Chinese (Simplified)',
    'zh-TW': 'Chinese (Traditional)',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'ja': 'Japanese',
    'ko': 'Korean'
  };
  
  const langName = langNames[targetLang] || targetLang;
  
  const prompt = `Translate the following English text to ${langName}. Return ONLY the translation, no explanations:

${text}`;

  const result = await generateWithGPT5({
    text: prompt,
    mode: 'translation',
    scene: 'news'
  });
  
  return result.text || text;
}

/**
 * Translate a news article summary to all supported languages
 * @param {string} summary - English summary
 * @returns {Promise<Object>} Object with translations { en, cn, es }
 */
async function translateNewsSummary(summary) {
  // English is the base language
  const translations = {
    en: summary || '[No summary available]'
  };
  
  try {
    // Translate to Chinese and Spanish with error handling
    const multiLang = await translateToMultipleLanguages(summary, ['zh-CN', 'es']);
    
    translations.cn = multiLang['zh-CN'] || summary || '[Translation unavailable]';
    translations.es = multiLang['es'] || summary || '[Translation unavailable]';
    
  } catch (error) {
    console.error(`❌ [Translation] Failed to translate summary: ${error.message}`);
    // Fallback: use original text instead of error message
    translations.cn = summary || '[Translation unavailable]';
    translations.es = summary || '[Translation unavailable]';
  }
  
  return translations;
}

/**
 * Batch translate multiple summaries (enhanced with parallel processing)
 * @param {Array<string>} summaries - Array of English summaries
 * @param {Object} options - Batch options
 * @param {number} options.batchSize - Number of translations to process in parallel (default: 3)
 * @param {number} options.delayMs - Delay between batches in ms (default: 500)
 * @returns {Promise<Array<Object>>} Array of translation objects
 */
async function batchTranslateSummaries(summaries, options = {}) {
  const { batchSize = 3, delayMs = 500 } = options;
  const results = [];
  
  console.log(`🔄 [BatchTranslate] Processing ${summaries.length} summaries in batches of ${batchSize}`);
  
  for (let i = 0; i < summaries.length; i += batchSize) {
    const batch = summaries.slice(i, i + batchSize);
    const batchIndex = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(summaries.length / batchSize);
    
    console.log(`🔄 [BatchTranslate] Batch ${batchIndex}/${totalBatches} (${batch.length} items)`);
    
    // Process batch in parallel (non-blocking)
    const batchPromises = batch.map(async (summary) => {
      try {
        const translations = await translateNewsSummary(summary);
        return { 
          ...translations, 
          translation_success: true,
          translation_error: null
        };
      } catch (error) {
        console.error(`❌ [BatchTranslate] Failed for summary: ${error.message}`);
        // Non-blocking fallback: return original summary
        return {
          en: summary || '[No summary]',
          cn: summary || '[Translation unavailable]',
          es: summary || '[Translation unavailable]',
          translation_success: false,
          translation_error: error.message
        };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Add delay between batches to avoid rate limiting
    if (i + batchSize < summaries.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  const successCount = results.filter(r => r.translation_success === true).length;
  const failCount = results.filter(r => r.translation_success === false).length;
  
  console.log(`✅ [BatchTranslate] Complete: ${successCount} successful, ${failCount} failed`);
  console.log(`💾 [Cache] Current size: ${translationCache.size} entries`);
  
  return results;
}

/**
 * Get cache statistics
 */
function getCacheStats() {
  return {
    size: translationCache.size,
    maxSize: translationCache.maxSize
  };
}

/**
 * Clear translation cache (for testing or memory management)
 */
function clearCache() {
  translationCache.clear();
  console.log(`🗑️  [Translation] Cache cleared`);
}

module.exports = {
  translateText,
  translateToMultipleLanguages,
  translateNewsSummary,
  batchTranslateSummaries,
  getCacheStats,
  clearCache
};
