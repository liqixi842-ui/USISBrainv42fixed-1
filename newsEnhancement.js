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

      // Simplified prompt: focus on investment analysis only
      const prompt = `你是资深投资分析师，基于新闻标题和摘要，为投资群组撰写150-200字的深度投资影响分析。

【新闻标题】${title}
【新闻摘要】${summary || title}
【相关股票】${symbolList || '无'}

要求撰写150-200字的投资分析，必须包含：
1. 短期影响（1-3个月）：对相关板块/个股的预期影响，具体到涨跌幅度
2. 长期趋势（6-12个月）：行业发展方向或政策影响
3. 投资建议：给出明确的操作建议（买入/持有/观望/规避）
4. 相关机会：如果有相关的投资机会，请具体说明

语言要求：
- 专业但易懂，适合分享到投资群组
- 避免空话套话，给出实质性分析
- 最少150字，确保内容充实

投资分析：`;

      console.log(`🤖 [AI] Calling GPT-4o for detailed analysis (max_tokens: 800)...`);
      
      const requestBody = {
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: '你是资深投资分析师，必须撰写详细的财经新闻分析。严格遵守字数要求（第一段最少200字，第二段最少100字）。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 800,
        temperature: 0.7
      };
      
      const response = await fetch(this.openaiEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(25000) // 25s timeout
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const fullContent = data.choices?.[0]?.message?.content?.trim();
      const tokensUsed = data.usage?.total_tokens || 0;
      
      console.log(`🤖 [AI] Response: ${fullContent?.length || 0} chars, ${tokensUsed} tokens used`);

      if (fullContent && fullContent.length > 100) {
        // Split by double newline to separate two parts
        const parts = fullContent.split(/\n\n+/);
        
        if (parts.length >= 2) {
          // Two distinct parts found
          const contentSummary = parts[0].trim();
          const investmentImpact = parts.slice(1).join('\n\n').trim();
          
          const commentary = `📋 详细解读\n${contentSummary}\n\n💡 投资影响\n${investmentImpact}`;
          
          console.log(`💡 [Enhancement] Generated ${commentary.length}-char analysis`);
          return commentary;
        } else {
          // Single block - use as-is with prefix
          const commentary = `📋 ${fullContent}`;
          console.log(`💡 [Enhancement] Generated ${commentary.length}-char content`);
          return commentary;
        }
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
