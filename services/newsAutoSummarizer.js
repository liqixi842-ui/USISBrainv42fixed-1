/**
 * ═══════════════════════════════════════════════════════════════
 * USIS Brain v7.0 - News Auto Summarizer
 * ═══════════════════════════════════════════════════════════════
 * 
 * Purpose: Generate dual-format summaries for news articles
 * - Long Summary (300-500 words): Deep analysis with context
 * - Short Summary (100-150 words): Quick snapshot for push notifications
 * 
 * Uses: gpt5Brain.js auto-fallback chain (gpt-5-mini → gpt-4o → gpt-4o-mini)
 * 
 * Architecture:
 * 1. Single API call generates both summaries simultaneously
 * 2. Structured JSON output for reliable parsing
 * 3. Batch processing support for multiple articles
 * 4. Multi-language support (EN/CN/ES)
 */

const { callModelWithFallback } = require('../gpt5Brain');

/**
 * Generate dual-format summaries for a news article
 * @param {Object} article - News article object
 * @param {string} article.title - Article title
 * @param {string} article.summary - Original article summary/content
 * @param {string} article.url - Article URL
 * @param {string} [language='en'] - Target language (en/zh/es)
 * @returns {Promise<Object>} { long_summary, short_summary, word_count }
 */
async function generateSummaries(article, language = 'en') {
  const { title, summary, url } = article;
  
  console.log(`\n📝 [AutoSummarizer] Generating summaries for: ${title.substring(0, 50)}...`);
  console.log(`   ├─ Language: ${language.toUpperCase()}`);
  console.log(`   └─ Original length: ${summary.length} chars\n`);
  
  const languageInstructions = getLanguageInstructions(language);
  
  const systemPrompt = `You are a professional financial news editor specializing in concise, institutional-grade market summaries.

Your task: Generate TWO summaries from the provided news article:

1. LONG SUMMARY (300-500 words)
   - Deep analysis with full context
   - Include key facts, implications, and market impact
   - Maintain institutional tone (sell-side analyst style)
   - Cite specific numbers, names, and dates
   - Structure: Context → Key Points → Market Implications

2. SHORT SUMMARY (100-150 words)
   - Essential facts only
   - One-paragraph format
   - Focus on immediate market impact
   - Remove fluff and background details
   - Structure: What happened → Why it matters

${languageInstructions}

CRITICAL RULES:
- Use precise financial terminology
- NO marketing language or hype
- NO phrases like "compelling opportunity" or "exciting development"
- Cite actual data and metrics when available
- Maintain neutral, analytical tone

OUTPUT FORMAT (strict JSON):
{
  "long_summary": "...",
  "short_summary": "...",
  "key_metrics": ["metric1", "metric2", ...],
  "market_impact": "High|Medium|Low"
}`;

  const userPrompt = `Article Title: ${title}

Original Summary:
${summary}

Source: ${url}

Generate both summaries following the format specified. Ensure word counts are within specified ranges.`;

  try {
    const startTime = Date.now();
    
    // Call GPT-5 mini → GPT-4o → GPT-4o-mini fallback chain
    const result = await callModelWithFallback({
      systemPrompt,
      userPrompt,
      requestStartTime: startTime
    });
    
    const duration = Date.now() - startTime;
    
    // Parse JSON response (gpt5Brain returns 'text' not 'content')
    let parsed;
    try {
      parsed = JSON.parse(result.text);
    } catch (parseError) {
      console.error(`❌ [AutoSummarizer] JSON parse error: ${parseError.message}`);
      console.error(`   Raw response: ${result.text.substring(0, 200)}...`);
      throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
    }
    
    // Validate word counts
    const longWordCount = countWords(parsed.long_summary);
    const shortWordCount = countWords(parsed.short_summary);
    
    console.log(`✅ [AutoSummarizer] Summaries generated in ${duration} ms`);
    console.log(`   ├─ Model: ${result.model}`);
    console.log(`   ├─ Long: ${longWordCount} words (target: 300-500)`);
    console.log(`   ├─ Short: ${shortWordCount} words (target: 100-150)`);
    console.log(`   └─ Market Impact: ${parsed.market_impact || 'N/A'}\n`);
    
    // Warn if out of range
    if (longWordCount < 300 || longWordCount > 500) {
      console.warn(`⚠️  [AutoSummarizer] Long summary out of range: ${longWordCount} words`);
    }
    if (shortWordCount < 100 || shortWordCount > 150) {
      console.warn(`⚠️  [AutoSummarizer] Short summary out of range: ${shortWordCount} words`);
    }
    
    return {
      long_summary: parsed.long_summary,
      short_summary: parsed.short_summary,
      key_metrics: parsed.key_metrics || [],
      market_impact: parsed.market_impact || 'Medium',
      word_count: {
        long: longWordCount,
        short: shortWordCount
      },
      model_used: result.model,
      generation_time_ms: duration
    };
    
  } catch (error) {
    console.error(`❌ [AutoSummarizer] Failed to generate summaries: ${error.message}`);
    
    // Rethrow error to let callers handle failure appropriately
    // Callers can decide whether to use fallback or skip summarization
    throw new Error(`AI summary generation failed: ${error.message}`);
  }
}

/**
 * Batch generate summaries for multiple articles
 * @param {Array<Object>} articles - Array of news articles
 * @param {string} [language='en'] - Target language
 * @param {Object} [options] - Batch options
 * @param {number} [options.maxConcurrent=3] - Max concurrent API calls
 * @param {number} [options.delayMs=500] - Delay between batches
 * @returns {Promise<Array<Object>>} Array of articles with summaries
 */
async function batchGenerateSummaries(articles, language = 'en', options = {}) {
  const { maxConcurrent = 3, delayMs = 500 } = options;
  
  console.log(`\n📦 [AutoSummarizer] Batch processing ${articles.length} articles`);
  console.log(`   ├─ Language: ${language.toUpperCase()}`);
  console.log(`   ├─ Max Concurrent: ${maxConcurrent}`);
  console.log(`   └─ Delay: ${delayMs} ms\n`);
  
  const results = [];
  
  for (let i = 0; i < articles.length; i += maxConcurrent) {
    const batch = articles.slice(i, i + maxConcurrent);
    
    console.log(`🔄 [AutoSummarizer] Processing batch ${Math.floor(i / maxConcurrent) + 1}/${Math.ceil(articles.length / maxConcurrent)}`);
    
    const batchPromises = batch.map(article => 
      generateSummaries(article, language)
        .then(summaries => ({ 
          ...article, 
          ...summaries, 
          summarization_success: true,  // Explicit flag for callers
          summarization_error: null
        }))
        .catch(error => ({
          ...article,
          long_summary: null,  // Explicitly null, not fallback
          short_summary: null,
          key_metrics: [],
          market_impact: null,
          summarization_success: false,  // Failed summarization
          summarization_error: error.message
        }))
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Delay between batches to avoid rate limiting
    if (i + maxConcurrent < articles.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  const successCount = results.filter(r => r.summarization_success === true).length;
  console.log(`\n✅ [AutoSummarizer] Batch complete: ${successCount}/${articles.length} successful\n`);
  
  return results;
}

/**
 * Get language-specific instructions
 */
function getLanguageInstructions(language) {
  switch (language.toLowerCase()) {
    case 'zh':
    case 'cn':
      return `Language: Write summaries in Simplified Chinese (简体中文)
Target audience: Chinese institutional investors and traders
Terminology: Use standard mainland China financial terms (e.g., "财报" not "財報")`;
      
    case 'es':
      return `Language: Write summaries in Spanish
Target audience: Spanish-speaking institutional investors
Terminology: Use international financial Spanish (e.g., "beneficios" for earnings)`;
      
    case 'en':
    default:
      return `Language: Write summaries in English
Target audience: Global institutional investors
Terminology: Use standard Wall Street/City of London financial terms`;
  }
}

/**
 * Fallback summary generation (when AI fails)
 */
function generateFallbackSummaries(article, language) {
  console.warn(`⚠️  [AutoSummarizer] Using fallback summaries for: ${article.title}`);
  
  const original = article.summary || article.title;
  
  // Simple truncation fallback
  const longSummary = original.length > 2000 
    ? original.substring(0, 2000) + '...'
    : original;
    
  const shortSummary = original.length > 500
    ? original.substring(0, 500) + '...'
    : original;
  
  return {
    long_summary: longSummary,
    short_summary: shortSummary,
    key_metrics: [],
    market_impact: 'Medium',
    word_count: {
      long: countWords(longSummary),
      short: countWords(shortSummary)
    },
    model_used: 'fallback',
    generation_time_ms: 0,
    is_fallback: true
  };
}

/**
 * Count words in text (works for English, Chinese, Spanish)
 */
function countWords(text) {
  if (!text) return 0;
  
  // For Chinese: count characters (excluding punctuation)
  if (/[\u4e00-\u9fa5]/.test(text)) {
    return text.replace(/[^\u4e00-\u9fa5]/g, '').length;
  }
  
  // For English/Spanish: count space-separated words
  return text.trim().split(/\s+/).length;
}

/**
 * Validate summary quality
 * @param {Object} summary - Summary object from generateSummaries
 * @returns {Object} Validation result with warnings
 */
function validateSummary(summary) {
  const warnings = [];
  
  // Check word counts
  if (summary.word_count.long < 300) {
    warnings.push(`Long summary too short: ${summary.word_count.long} words (target: 300-500)`);
  }
  if (summary.word_count.long > 500) {
    warnings.push(`Long summary too long: ${summary.word_count.long} words (target: 300-500)`);
  }
  if (summary.word_count.short < 100) {
    warnings.push(`Short summary too short: ${summary.word_count.short} words (target: 100-150)`);
  }
  if (summary.word_count.short > 150) {
    warnings.push(`Short summary too long: ${summary.word_count.short} words (target: 100-150)`);
  }
  
  // Check for prohibited marketing language
  const prohibitedPhrases = [
    'compelling opportunity',
    'exciting development',
    'attractive valuation',
    'strong buy',
    'must-have',
    'game-changer'
  ];
  
  const combinedText = (summary.long_summary + ' ' + summary.short_summary).toLowerCase();
  prohibitedPhrases.forEach(phrase => {
    if (combinedText.includes(phrase)) {
      warnings.push(`Contains prohibited phrase: "${phrase}"`);
    }
  });
  
  return {
    valid: warnings.length === 0,
    warnings: warnings,
    score: Math.max(0, 100 - (warnings.length * 20)) // Quality score out of 100
  };
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS (CommonJS)
// ═══════════════════════════════════════════════════════════════

module.exports = {
  generateSummaries,
  batchGenerateSummaries,
  validateSummary,
  countWords
};
