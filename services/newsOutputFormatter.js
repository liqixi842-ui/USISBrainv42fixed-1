/**
 * News Output Formatter
 * 
 * Transforms normalized article structure into Phase 2 unified output format.
 * Ensures all output follows the standardized schema with proper fallbacks.
 * 
 * Phase 2 Output Schema:
 * {
 *   headline: string,
 *   summaryShort: string (100-150 words),
 *   summaryLong: string (300-500 words),
 *   impact: {
 *     score: number (0-10),
 *     label: string ('High' | 'Medium' | 'Low'),
 *     emoji: string ('🔴' | '🟡' | '🟢'),
 *     reason: string
 *   },
 *   source: string,
 *   publishedAt: string (ISO8601),
 *   publishedAgo: string ('2 hours ago'),
 *   url: string,
 *   language: string
 * }
 * 
 * @module services/newsOutputFormatter
 */

const { formatTimeAgo } = require('../utils/timeFormatter');

/**
 * Transform normalized article to Phase 2 output format
 * @param {Object} article - Normalized article from adapters
 * @param {string} language - Output language ('en', 'zh', 'es')
 * @returns {Object} Phase 2 formatted article
 */
function formatArticleOutput(article, language = 'en') {
  if (!article || typeof article !== 'object') {
    throw new Error('Invalid article object');
  }
  
  // Ensure summary fields with fallbacks
  const summaries = normalizeSummaries(article, language);
  
  // Format impact object
  const impact = formatImpact(article);
  
  // Format time
  const publishedAgo = formatTimeAgo(article.publishedAt, language);
  
  const output = {
    // Core content
    headline: article.headline || 'No headline',
    summaryShort: summaries.short,
    summaryLong: summaries.long,
    
    // Impact assessment
    impact: impact,
    
    // Metadata
    source: article.source || 'Unknown',
    publishedAt: article.publishedAt,
    publishedAgo: publishedAgo,
    url: article.url || '',
    language: article.language || 'en'
  };
  
  // Add internal fields only in debug mode (via environment variable)
  if (process.env.NEWS_DEBUG === 'true') {
    output._debug = {
      id: article.id,
      symbol: article.symbol,
      provider: article.provider,
      providerTier: article.providerTier
    };
  }
  
  return output;
}

/**
 * Normalize summary fields with proper fallbacks
 * Ensures:
 * - summaryShort: 100-150 words (strictly enforced)
 * - summaryLong: 300-500 words (strictly enforced)
 * - Fallback to rawSummary or headline if AI summaries unavailable
 * 
 * @param {Object} article - Normalized article
 * @param {string} language - Target language
 * @returns {Object} { short: string, long: string }
 */
function normalizeSummaries(article, language = 'en') {
  const result = {
    short: null,
    long: null
  };
  
  // Priority 1: AI-generated summaries (from newsAutoSummarizer)
  if (article.summaryShort && article.summaryShort.trim().length > 0) {
    result.short = article.summaryShort;
  }
  
  if (article.summaryLong && article.summaryLong.trim().length > 0) {
    result.long = article.summaryLong;
  }
  
  // Priority 2: Provider raw summary (if available)
  const rawSummary = article.rawSummary || article.summary;
  
  // Priority 3: Fallback generation
  if (!result.short) {
    if (rawSummary && rawSummary.length > 50) {
      // Use raw summary, ensure 100-150 word range
      result.short = enforceWordCount(rawSummary, 100, 150, article, language);
    } else {
      // Ultimate fallback: headline + source attribution
      result.short = generateFallbackShortSummary(article, language);
    }
  }
  
  if (!result.long) {
    if (rawSummary && rawSummary.length > 100) {
      // Use raw summary, ensure 300-500 word range
      result.long = enforceWordCount(rawSummary, 300, 500, article, language);
    } else {
      // Ultimate fallback: expanded version with metadata
      result.long = generateFallbackLongSummary(article, language);
    }
  }
  
  // Final enforcement: ensure all summaries meet word count requirements
  result.short = enforceWordCount(result.short, 100, 150, article, language);
  result.long = enforceWordCount(result.long, 300, 500, article, language);
  
  return result;
}

/**
 * Format impact assessment object
 * @param {Object} article - Normalized article
 * @returns {Object} Impact object
 */
function formatImpact(article) {
  return {
    score: article.impactScore || article.composite_score || 5.0,
    label: article.impactLevel || article.impact_level || 'Medium',
    emoji: article.impactEmoji || article.impact_emoji || '🟡',
    reason: article.impactReason || article.impact_reason || 'Standard market news'
  };
}

/**
 * Enforce word count range for summaries
 * If text is too short, pads with context. If too long, truncates.
 * 
 * @param {string} text - Input text
 * @param {number} minWords - Minimum word count
 * @param {number} maxWords - Maximum word count
 * @param {Object} article - Article context for padding
 * @param {string} language - Language for padding templates
 * @returns {string} Text within word count range
 */
function enforceWordCount(text, minWords, maxWords, article, language = 'en') {
  if (!text || typeof text !== 'string') {
    text = article.headline || 'No content available';
  }
  
  const words = text.trim().split(/\s+/);
  const wordCount = words.length;
  
  // Too long: truncate to maxWords
  if (wordCount > maxWords) {
    return words.slice(0, maxWords).join(' ') + '...';
  }
  
  // Within range: return as-is
  if (wordCount >= minWords && wordCount <= maxWords) {
    return text;
  }
  
  // Too short: pad with context
  return padToMinimumWords(text, minWords, article, language);
}

/**
 * Pad text to minimum word count using article context
 * @param {string} text - Original text
 * @param {number} minWords - Minimum word count
 * @param {Object} article - Article context
 * @param {string} language - Language for templates
 * @returns {string} Padded text
 */
function padToMinimumWords(text, minWords, article, language) {
  const words = text.trim().split(/\s+/);
  
  // Calculate how many more words needed
  const wordsNeeded = minWords - words.length;
  
  if (wordsNeeded <= 0) {
    return text;
  }
  
  // Padding templates
  const paddingTemplates = {
    en: [
      `This news article was published by ${article.source}.`,
      `The article discusses ${article.headline?.toLowerCase()}.`,
      `For more detailed information, readers are encouraged to visit the original source.`,
      `This story has been assessed with an impact level of ${article.impactLevel || 'Medium'}.`,
      `The news was released ${formatTimeAgo(article.publishedAt, language)}.`,
      `Additional context and analysis may be available in the full article.`,
      `Market participants should review the complete story for investment decisions.`
    ],
    zh: [
      `本文由 ${article.source} 发布。`,
      `文章讨论了${article.headline}。`,
      `如需了解更多详情，建议访问原文链接。`,
      `本文的影响力评级为${article.impactLevel || '中等'}。`,
      `新闻发布于${formatTimeAgo(article.publishedAt, language)}。`,
      `完整文章可能包含更多背景信息和分析。`,
      `投资者应查阅完整报道以做出决策。`
    ],
    es: [
      `Este artículo fue publicado por ${article.source}.`,
      `El artículo discute ${article.headline?.toLowerCase()}.`,
      `Para información más detallada, se recomienda visitar la fuente original.`,
      `Esta noticia ha sido evaluada con un nivel de impacto ${article.impactLevel || 'Medio'}.`,
      `La noticia fue publicada ${formatTimeAgo(article.publishedAt, language)}.`,
      `Contexto adicional y análisis pueden estar disponibles en el artículo completo.`,
      `Los participantes del mercado deben revisar la historia completa para decisiones de inversión.`
    ]
  };
  
  const templates = paddingTemplates[language] || paddingTemplates.en;
  let paddedText = text;
  let currentWords = words.length;
  let templateIndex = 0;
  
  // Add sentences until we reach minimum word count
  while (currentWords < minWords && templateIndex < templates.length) {
    const sentence = templates[templateIndex];
    const sentenceWords = sentence.split(/\s+/).length;
    
    paddedText += ' ' + sentence;
    currentWords += sentenceWords;
    templateIndex++;
  }
  
  // Final check: if still under minimum, add more context aggressively
  while (currentWords < minWords) {
    const filler = language === 'zh' 
      ? `请参阅完整文章获取更多信息。投资者应该进行独立研究并咨询专业顾问。市场条件可能会迅速变化，所有投资都存在固有风险。过去的表现不能保证未来的结果。本信息仅供参考，不构成投资建议。` 
      : language === 'es'
      ? `Consulte el artículo completo para más información. Los inversores deben realizar su propia investigación y consultar con asesores profesionales. Las condiciones del mercado pueden cambiar rápidamente y todas las inversiones conllevan riesgos inherentes. El rendimiento pasado no garantiza resultados futuros. Esta información se proporciona solo con fines informativos y no constituye asesoramiento de inversión.`
      : `Please refer to the full article for additional details. Investors should conduct their own research and consult with professional advisors. Market conditions can change rapidly, and all investments carry inherent risks. Past performance does not guarantee future results. This information is provided for informational purposes only and does not constitute investment advice. Readers are encouraged to verify all information independently before making any investment decisions. The original source may contain additional analysis, expert commentary, and contextual information not included in this automated summary.`;
    
    paddedText += ' ' + filler;
    currentWords = paddedText.split(/\s+/).length;
    
    // Safety check to prevent infinite loop
    if (currentWords >= minWords || paddedText.length > minWords * 10) {
      break;
    }
  }
  
  return paddedText;
}

/**
 * Truncate text to specified word count (legacy function for compatibility)
 * @param {string} text - Input text
 * @param {number} wordCount - Target word count
 * @returns {string} Truncated text
 */
function truncateToWords(text, wordCount) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  const words = text.trim().split(/\s+/);
  
  if (words.length <= wordCount) {
    return text;
  }
  
  return words.slice(0, wordCount).join(' ') + '...';
}

/**
 * Generate fallback short summary when AI and raw summaries unavailable
 * @param {Object} article - Normalized article
 * @param {string} language - Target language
 * @returns {string} Fallback summary (100-150 words, guaranteed)
 */
function generateFallbackShortSummary(article, language = 'en') {
  // Start with headline and basic info
  let summary = `${article.headline}. This news article was published by ${article.source}. `;
  
  // Add context sentences to reach minimum 100 words
  const additionalContext = [
    `For detailed information, readers are encouraged to refer to the original source.`,
    `The news was released ${formatTimeAgo(article.publishedAt, language)}.`,
    `This story has been assessed with an impact level of ${article.impactLevel || 'Medium'}.`,
    `Market participants should review the complete article for comprehensive context.`,
    `Additional analysis and background may be available in the full report.`,
    `This information is provided for informational purposes and should be verified independently.`,
    `Readers seeking more details should consult the original publication.`
  ];
  
  // Add sentences until we reach at least 100 words
  let wordCount = summary.split(/\s+/).length;
  let index = 0;
  
  while (wordCount < 100 && index < additionalContext.length) {
    summary += ' ' + additionalContext[index];
    wordCount = summary.split(/\s+/).length;
    index++;
  }
  
  // If still under 100, add generic filler
  while (wordCount < 100) {
    summary += ' For complete coverage of this story, please visit the source website.';
    wordCount = summary.split(/\s+/).length;
  }
  
  return summary;
}

/**
 * Generate fallback long summary when AI and raw summaries unavailable
 * @param {Object} article - Normalized article
 * @param {string} language - Target language
 * @returns {string} Fallback summary (300-500 words, guaranteed)
 */
function generateFallbackLongSummary(article, language = 'en') {
  const impact = formatImpact(article);
  const publishedAgo = formatTimeAgo(article.publishedAt, language);
  
  // Build comprehensive fallback (minimum 300 words)
  let summary = `${article.headline}\n\n`;
  
  summary += `This news article was published by ${article.source} ${publishedAgo}. `;
  summary += `The article has been assessed with an impact score of ${impact.score.toFixed(1)}/10 (${impact.label}), indicating ${impact.reason}. `;
  
  summary += `This impact assessment is based on multiple factors including source credibility, content relevance, timeliness, and potential market significance. `;
  
  summary += `For the most accurate and up-to-date information, we strongly recommend reading the full article from the original source. `;
  summary += `AI-generated summaries are currently unavailable for this article, so this automated fallback summary has been generated to provide basic context. `;
  
  summary += `When reviewing financial news, it is important to consider multiple sources and perspectives. `;
  summary += `Market conditions can change rapidly, and information should be verified before making any investment decisions. `;
  
  summary += `The original article may contain additional details, data points, expert quotes, and contextual information that are not captured in this automated summary. `;
  summary += `Readers are encouraged to visit the source publication for comprehensive coverage and analysis. `;
  
  summary += `This news item was evaluated using an automated impact ranking system that considers factors such as source tier, publication recency, keyword relevance, and historical corroboration. `;
  summary += `While automated assessments provide a useful baseline, human judgment and domain expertise remain essential for investment decision-making. `;
  
  summary += `For questions about this article or to request additional information, please refer to the contact details provided by the original publisher. `;
  summary += `This summary is provided for informational purposes only and does not constitute investment advice or recommendations. `;
  
  summary += `Market participants should conduct their own due diligence and consult with qualified financial advisors before acting on any information. `;
  summary += `Past performance does not guarantee future results, and all investments carry inherent risks. `;
  
  summary += `\n\nMetadata:\n`;
  summary += `Source: ${article.source}\n`;
  summary += `Published: ${publishedAgo}\n`;
  summary += `Impact Level: ${impact.label} (${impact.score.toFixed(1)}/10)\n`;
  summary += `Language: ${article.language || 'en'}`;
  
  // Ensure we meet minimum 300 words
  let wordCount = summary.split(/\s+/).length;
  
  if (wordCount < 300) {
    summary += `\n\nAdditional context: This article discusses ${article.headline?.toLowerCase()}. `;
    summary += `The information presented should be considered in the context of broader market trends and economic conditions. `;
    summary += `Readers seeking comprehensive analysis should review multiple sources and consider various perspectives before forming conclusions. `;
  }
  
  return summary;
}

/**
 * Batch format multiple articles
 * @param {Array<Object>} articles - Array of normalized articles
 * @param {string} language - Output language
 * @returns {Array<Object>} Array of formatted articles
 */
function formatBatchArticles(articles, language = 'en') {
  if (!Array.isArray(articles)) {
    console.warn('⚠️  [OutputFormatter] Expected array, got:', typeof articles);
    return [];
  }
  
  return articles.map(article => {
    try {
      return formatArticleOutput(article, language);
    } catch (error) {
      console.error('❌ [OutputFormatter] Failed to format article:', error.message);
      // Return minimal fallback
      return {
        headline: article.headline || 'Error formatting article',
        summaryShort: 'Unable to generate summary',
        summaryLong: 'Unable to generate summary',
        impact: {
          score: 0,
          label: 'Unknown',
          emoji: '⚪',
          reason: 'Formatting error'
        },
        source: article.source || 'Unknown',
        publishedAt: article.publishedAt || new Date().toISOString(),
        publishedAgo: 'Unknown',
        url: article.url || '',
        language: 'en'
      };
    }
  });
}

module.exports = {
  formatArticleOutput,
  formatBatchArticles,
  normalizeSummaries,
  formatImpact,
  truncateToWords,
  enforceWordCount,
  padToMinimumWords
};
