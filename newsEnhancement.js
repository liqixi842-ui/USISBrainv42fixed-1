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
   * Generate AI commentary for news item
   * @param {Object} newsItem - News item with title and summary
   * @returns {Promise<string>} AI-generated commentary (30-50 chars)
   */
  async generateCommentary(newsItem) {
    try {
      if (!this.openaiKey) {
        console.warn('⚠️  [Enhancement] OPENAI_API_KEY not configured, skipping commentary');
        return '';
      }

      const { title, summary, symbols = [] } = newsItem;
      const symbolList = symbols.slice(0, 3).join(', ');

      const prompt = `作为金融分析师，为以下新闻生成30-50字的"未来影响"评论，聚焦于对市场/行业的实质影响：

标题：${title}
摘要：${summary || ''}
相关股票：${symbolList || '无'}

要求：
1. 30-50字，简洁专业
2. 聚焦未来影响（不重复新闻内容）
3. 使用中文
4. 可以预测价格趋势、行业变化、政策影响等
5. 避免废话，直接给出分析

示例格式："预计将推动XX板块上涨，长期利好XX行业发展"

未来影响：`;

      const response = await fetch(this.openaiEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: '你是专业的金融分析师，擅长预测新闻对市场的影响。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 100,
          temperature: 0.7
        }),
        signal: AbortSignal.timeout(15000) // 15s timeout
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
