/**
 * USIS News v3.0 - Content Enhancement Service
 * 
 * Handles:
 * 1. Translation (Google Translate): English/Spanish/German → Chinese (FREE, no API key)
 * 2. AI Commentary (GPT-4o): Generate future impact analysis
 */

const fetch = require('node-fetch');
const translate = require('@vitalets/google-translate-api').translate;

class NewsEnhancementService {
  constructor() {
    this.openaiKey = process.env.OPENAI_API_KEY;
    this.openaiEndpoint = 'https://api.openai.com/v1/chat/completions';
    
    console.log('✅ [Enhancement] Google Translate configured (FREE, no API key required)');
  }

  /**
   * Detect if text is Chinese
   */
  isChinese(text) {
    if (!text) return false;
    // Check if text contains Chinese characters
    return /[\u4e00-\u9fa5]/.test(text);
  }

  /**
   * Translate text to Chinese using Google Translate (FREE)
   * @param {string} text - Text to translate
   * @param {string} sourceLang - Source language (auto-detected)
   * @returns {Promise<string>} Translated text
   */
  async translateToChinese(text, sourceLang = 'auto') {
    try {
      if (!text || this.isChinese(text)) {
        return text; // Already Chinese or empty
      }

      // Use Google Translate (free, no API key required)
      const result = await translate(text, { 
        to: 'zh-CN',
        autoCorrect: true
      });

      const translated = result.text;

      if (translated && translated !== text) {
        console.log(`✅ [Enhancement] Translated: ${text.substring(0, 50)}... → ${translated.substring(0, 50)}...`);
        return translated;
      }

      return text; // Fallback to original

    } catch (error) {
      console.error('❌ [Enhancement] Translation failed:', error.message);
      return text; // Return original on error
    }
  }

  /**
   * Generate professional investment analysis commentary
   * @param {Object} newsItem - News item with title and summary
   * @returns {Promise<string>} Professional investment analysis (100-200 chars)
   */
  async generateCommentary(newsItem) {
    try {
      if (!this.openaiKey) {
        console.warn('⚠️  [Enhancement] OPENAI_API_KEY not configured, skipping commentary');
        return '';
      }

      const { title, summary, symbols = [] } = newsItem;
      const symbolList = symbols.slice(0, 3).join(', ');

      const prompt = `作为专业投资分析师，为以下财经新闻撰写深度投资影响分析，适合分享到专业投资群组：

【新闻标题】${title}

【新闻摘要】${summary || '无'}

【相关股票】${symbolList || '无'}

请撰写100-150字的专业投资分析，必须包含：

1. **短期影响**（1-3个月）：对相关板块/个股的预期影响
2. **长期趋势**（6-12个月）：行业发展方向或政策影响
3. **投资建议**：具体的操作建议（关注/观望/规避等）

要求：
- 语言专业，逻辑严谨，避免AI生成痕迹
- 基于新闻内容给出实质性分析，不重复新闻内容
- 如有相关股票，必须提及具体影响
- 适合直接转发到投资群组

投资影响分析：`;

      const response = await fetch(this.openaiEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: '你是资深投资分析师，擅长深度分析财经新闻对市场的影响，撰写适合专业投资者阅读的分析报告。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 400,
          temperature: 0.6
        }),
        signal: AbortSignal.timeout(20000) // 20s timeout
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const commentary = data.choices?.[0]?.message?.content?.trim();

      if (commentary) {
        console.log(`💡 [Enhancement] Generated commentary: ${commentary.substring(0, 50)}...`);
        return commentary;
      }

      return '';

    } catch (error) {
      console.error('❌ [Enhancement] Commentary generation failed:', error.message);
      return ''; // Return empty on error
    }
  }

  /**
   * Enhance news item with translation and AI commentary
   * @param {Object} newsItem - Original news item
   * @returns {Promise<Object>} Enhanced news item
   */
  async enhanceNewsItem(newsItem) {
    try {
      const enhanced = { ...newsItem };

      // Translate title if not Chinese
      if (!this.isChinese(newsItem.title)) {
        enhanced.translated_title = await this.translateToChinese(newsItem.title);
      }

      // Translate summary if not Chinese
      if (newsItem.summary && !this.isChinese(newsItem.summary)) {
        enhanced.translated_summary = await this.translateToChinese(newsItem.summary);
      }

      // Generate AI commentary
      enhanced.ai_commentary = await this.generateCommentary(newsItem);

      return enhanced;

    } catch (error) {
      console.error('❌ [Enhancement] Enhancement failed:', error.message);
      return newsItem; // Return original on error
    }
  }
}

module.exports = { NewsEnhancementService };
