/**
 * 🆕 v6.0: 多语言分析引擎
 * P0优先级：DeepSeek中文财经分析 + DeepL精准翻译
 */

const { getMultiAIProvider } = require('./multiAiProvider');
const fetch = require('node-fetch');

class MultiLanguageAnalyzer {
  constructor() {
    this.aiProvider = getMultiAIProvider();
    this.deeplApiKey = process.env.DEEPL_API_KEY;
    this.deeplEndpoint = 'https://api-free.deepl.com/v2/translate';
    
    // 支持的语言
    this.supportedLanguages = {
      'zh': { name: '中文', modelPreference: 'deepseek-chat' },
      'en': { name: 'English', modelPreference: 'gpt-4o-mini' },
      'ja': { name: '日本語', modelPreference: 'gpt-4o-mini' },
      'ko': { name: '한국어', modelPreference: 'gpt-4o-mini' },
      'es': { name: 'Español', modelPreference: 'mistral-large-latest' },
      'de': { name: 'Deutsch', modelPreference: 'mistral-large-latest' },
      'fr': { name: 'Français', modelPreference: 'mistral-large-latest' }
    };
  }

  /**
   * 检测输入语言
   * @param {string} text - 输入文本
   * @returns {string} 语言代码
   */
  detectLanguage(text) {
    if (/[\u4e00-\u9fa5]/.test(text)) {
      return 'zh'; // 中文
    } else if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) {
      return 'ja'; // 日文
    } else if (/[\uac00-\ud7af]/.test(text)) {
      return 'ko'; // 韩文
    } else {
      return 'en'; // 默认英文
    }
  }

  /**
   * 使用DeepL翻译文本
   * @param {string} text - 待翻译文本
   * @param {string} targetLang - 目标语言（'ZH', 'EN', 'JA'等）
   * @param {string} sourceLang - 源语言（可选）
   * @returns {Promise<string>} 翻译结果
   */
  async translateWithDeepL(text, targetLang, sourceLang = null) {
    if (!this.deeplApiKey) {
      console.warn('⚠️  [MultiLang] DeepL API密钥未配置，跳过翻译');
      return text;
    }

    try {
      console.log(`🌐 [DeepL] 翻译: ${sourceLang || 'auto'} → ${targetLang}`);

      const params = new URLSearchParams({
        auth_key: this.deeplApiKey,
        text: text,
        target_lang: targetLang.toUpperCase()
      });

      if (sourceLang) {
        params.append('source_lang', sourceLang.toUpperCase());
      }

      const response = await fetch(this.deeplEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      });

      if (!response.ok) {
        throw new Error(`DeepL API错误: ${response.status}`);
      }

      const data = await response.json();
      const translated = data.translations[0].text;

      console.log(`✅ [DeepL] 翻译完成 (${text.length} → ${translated.length} 字符)`);
      return translated;

    } catch (error) {
      console.error(`❌ [DeepL] 翻译失败:`, error.message);
      return text; // 降级：返回原文
    }
  }

  /**
   * 🇨🇳 中文财经分析（DeepSeek专属）
   * @param {string} text - 中文输入
   * @param {Object} marketData - 市场数据
   * @param {Object} options - 分析选项
   * @returns {Promise<Object>} 分析结果
   */
  async analyzeInChinese(text, marketData, options = {}) {
    console.log('🇨🇳 [MultiLang] 启动DeepSeek中文财经分析');

    // 构建中文分析提示词
    const systemPrompt = `你是一位专业的中文财经分析师，精通A股、港股、美股市场。

【核心能力】
1. 深度理解中文财经术语和本土投资逻辑
2. 熟悉中国监管政策和市场特点
3. 结合技术面和基本面给出专业建议

【输出要求】
- 使用专业但易懂的中文表达
- 数据引用准确，避免臆测
- 给出具体的操作建议和风险提示`;

    const userPrompt = `${text}

【市场数据】
${JSON.stringify(marketData, null, 2)}

请基于以上数据进行专业的中文财经分析。`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    // 使用DeepSeek模型
    const result = await this.aiProvider.generate(
      'deepseek-chat',
      messages,
      { temperature: 0.7, maxTokens: 2048 }
    );

    return {
      ...result,
      language: 'zh',
      modelReason: 'Chinese financial analysis - DeepSeek优化'
    };
  }

  /**
   * 多语言输出：生成多种语言版本的分析报告
   * @param {string} originalAnalysis - 原始分析（通常是中文或英文）
   * @param {Array<string>} targetLanguages - 目标语言列表
   * @returns {Promise<Object>} 多语言版本
   */
  async generateMultilingualOutput(originalAnalysis, targetLanguages = ['en', 'zh']) {
    console.log(`🌍 [MultiLang] 生成多语言输出: ${targetLanguages.join(', ')}`);

    const outputs = {
      original: originalAnalysis
    };

    // 并行翻译
    const translations = await Promise.all(
      targetLanguages.map(async (lang) => {
        try {
          // DeepL语言代码映射
          const deeplLangMap = {
            'zh': 'ZH',
            'en': 'EN',
            'ja': 'JA',
            'ko': 'KO', // DeepL暂不支持韩语
            'es': 'ES',
            'de': 'DE',
            'fr': 'FR'
          };

          const targetLang = deeplLangMap[lang];
          if (!targetLang) {
            console.warn(`⚠️  [MultiLang] 不支持的语言: ${lang}`);
            return { lang, text: originalAnalysis };
          }

          const translated = await this.translateWithDeepL(
            originalAnalysis,
            targetLang
          );

          return { lang, text: translated };
        } catch (error) {
          console.error(`❌ [MultiLang] ${lang}翻译失败:`, error.message);
          return { lang, text: originalAnalysis };
        }
      })
    );

    // 组装结果
    translations.forEach(({ lang, text }) => {
      outputs[lang] = text;
    });

    return outputs;
  }

  /**
   * 智能分析：自动检测语言并选择最佳模型
   * @param {string} text - 用户输入
   * @param {Object} marketData - 市场数据
   * @param {Object} options - 分析选项
   * @returns {Promise<Object>} 分析结果
   */
  async smartAnalyze(text, marketData, options = {}) {
    const detectedLang = this.detectLanguage(text);
    const langConfig = this.supportedLanguages[detectedLang];

    console.log(`🌐 [MultiLang] 检测语言: ${langConfig.name}, 推荐模型: ${langConfig.modelPreference}`);

    // 中文输入 → DeepSeek专属优化
    if (detectedLang === 'zh') {
      return this.analyzeInChinese(text, marketData, options);
    }

    // 其他语言 → 通用模型
    const systemPrompt = `You are a professional financial analyst. Provide clear, data-driven analysis.`;
    const userPrompt = `${text}\n\nMarket Data:\n${JSON.stringify(marketData, null, 2)}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const result = await this.aiProvider.generate(
      langConfig.modelPreference,
      messages,
      { temperature: 0.7, maxTokens: 2048 }
    );

    return {
      ...result,
      language: detectedLang,
      modelReason: `${langConfig.name} input - ${langConfig.modelPreference} optimized`
    };
  }
}

module.exports = MultiLanguageAnalyzer;
