/**
 * 🆕 v6.0: 多AI模型统一调用器
 * 支持OpenAI、DeepSeek、Mistral、Perplexity等多个模型
 * 提供智能路由、降级机制和成本追踪
 */

const fetch = require('node-fetch');

class MultiAIProvider {
  constructor() {
    // API密钥配置
    this.apiKeys = {
      openai: process.env.OPENAI_API_KEY,
      deepseek: process.env.DEEPSEEK_API_KEY,
      mistral: process.env.MISTRAL_API_KEY,
      perplexity: process.env.PERPLEXITY_API_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY, // 待配置
      google: process.env.GOOGLE_API_KEY // 待配置
    };

    // 模型配置
    this.models = {
      // OpenAI系列（已有）
      'gpt-4o': {
        provider: 'openai',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        costPer1kTokens: { input: 0.0025, output: 0.01 },
        maxTokens: 128000,
        features: ['通用分析', '英文优先', '多模态']
      },
      'gpt-4o-mini': {
        provider: 'openai',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        costPer1kTokens: { input: 0.00015, output: 0.0006 },
        maxTokens: 128000,
        features: ['快速响应', '成本优化']
      },
      
      // DeepSeek V3（中文财经专家）
      'deepseek-chat': {
        provider: 'deepseek',
        endpoint: 'https://api.deepseek.com/v1/chat/completions',
        costPer1kTokens: { input: 0.00027, output: 0.0011 },
        maxTokens: 64000,
        features: ['中文财经', 'A股分析', '本土化术语', '成本极低']
      },
      
      // Mistral Large（快速推理）
      'mistral-large-latest': {
        provider: 'mistral',
        endpoint: 'https://api.mistral.ai/v1/chat/completions',
        costPer1kTokens: { input: 0.002, output: 0.006 },
        maxTokens: 128000,
        features: ['快速推理', '多语言', '函数调用']
      },
      
      // Perplexity（实时搜索增强）
      'sonar-pro': {
        provider: 'perplexity',
        endpoint: 'https://api.perplexity.ai/chat/completions',
        costPer1kTokens: { input: 0.001, output: 0.001 },
        maxTokens: 127000,
        features: ['实时搜索', '引用来源', '最新信息']
      }
    };

    // 智能路由规则
    this.routingRules = {
      'chinese_analysis': 'deepseek-chat', // 中文分析优先DeepSeek
      'quick_response': 'mistral-large-latest', // 快速响应用Mistral
      'real_time_search': 'sonar-pro', // 实时信息用Perplexity
      'long_context': 'gpt-4o', // 长文分析用GPT-4o
      'default': 'gpt-4o-mini' // 默认用最经济的模型
    };

    // 成本追踪
    this.costTracking = {
      totalCalls: 0,
      totalTokens: { input: 0, output: 0 },
      totalCost: 0,
      byModel: {}
    };
  }

  /**
   * 智能路由：根据任务类型和上下文选择最佳模型
   * @param {string} taskType - 任务类型（chinese_analysis, quick_response等）
   * @param {Object} context - 上下文信息
   * @returns {string} 推荐的模型名称
   */
  selectModel(taskType, context = {}) {
    // 检测中文输入
    if (context.text && /[\u4e00-\u9fa5]/.test(context.text)) {
      console.log('🇨🇳 [MultiAI] 检测到中文输入，路由到DeepSeek');
      return 'deepseek-chat';
    }

    // 检测是否需要实时信息
    if (context.requiresRealTime || /最新|今天|实时|现在/.test(context.text || '')) {
      console.log('🔍 [MultiAI] 需要实时信息，路由到Perplexity');
      return 'sonar-pro';
    }

    // 根据任务类型路由
    const model = this.routingRules[taskType] || this.routingRules.default;
    console.log(`🧠 [MultiAI] 任务类型: ${taskType}, 选择模型: ${model}`);
    return model;
  }

  /**
   * 统一的模型调用接口
   * @param {string} modelName - 模型名称
   * @param {Array} messages - 对话消息
   * @param {Object} options - 调用选项
   * @returns {Promise<Object>} 生成结果
   */
  async generate(modelName, messages, options = {}) {
    const startTime = Date.now();
    const modelConfig = this.models[modelName];
    
    if (!modelConfig) {
      throw new Error(`不支持的模型: ${modelName}`);
    }

    const provider = modelConfig.provider;
    const apiKey = this.apiKeys[provider];

    if (!apiKey) {
      console.warn(`⚠️  [MultiAI] ${provider} API密钥未配置，降级到默认模型`);
      return this.fallbackGenerate(messages, options);
    }

    try {
      console.log(`🚀 [MultiAI] 调用 ${modelName} (${provider})`);

      const response = await this.callProvider(
        provider,
        modelConfig.endpoint,
        apiKey,
        modelName,
        messages,
        options
      );

      // 成本追踪
      const cost = this.trackCost(modelName, response.usage);
      const elapsed = Date.now() - startTime;

      console.log(`✅ [MultiAI] ${modelName} 完成 (${elapsed}ms, $${cost.toFixed(4)})`);

      return {
        success: true,
        text: response.content,
        model: modelName,
        provider: provider,
        usage: response.usage,
        cost_usd: cost,
        elapsed_ms: elapsed,
        features: modelConfig.features
      };

    } catch (error) {
      console.error(`❌ [MultiAI] ${modelName} 调用失败:`, error.message);
      
      // 降级处理
      if (modelName !== 'gpt-4o-mini') {
        console.log(`🔄 [MultiAI] 降级到备用模型`);
        return this.fallbackGenerate(messages, options);
      }
      
      throw error;
    }
  }

  /**
   * 调用特定提供商的API
   */
  async callProvider(provider, endpoint, apiKey, model, messages, options) {
    const requestBody = {
      model: model,
      messages: messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 2048
    };

    // Perplexity特殊参数
    if (provider === 'perplexity') {
      requestBody.return_citations = true;
      requestBody.return_images = false;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API调用失败 (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    // 统一响应格式
    return {
      content: data.choices[0].message.content,
      usage: {
        prompt_tokens: data.usage?.prompt_tokens || 0,
        completion_tokens: data.usage?.completion_tokens || 0,
        total_tokens: data.usage?.total_tokens || 0
      },
      citations: data.citations || [] // Perplexity专属
    };
  }

  /**
   * 降级到备用模型（OpenAI GPT-4o-mini）
   */
  async fallbackGenerate(messages, options) {
    console.log('🛡️  [MultiAI] 使用备用模型: gpt-4o-mini');
    return this.generate('gpt-4o-mini', messages, options);
  }

  /**
   * 成本追踪
   */
  trackCost(modelName, usage) {
    const modelConfig = this.models[modelName];
    const inputCost = (usage.prompt_tokens / 1000) * modelConfig.costPer1kTokens.input;
    const outputCost = (usage.completion_tokens / 1000) * modelConfig.costPer1kTokens.output;
    const totalCost = inputCost + outputCost;

    // 更新追踪数据
    this.costTracking.totalCalls++;
    this.costTracking.totalTokens.input += usage.prompt_tokens;
    this.costTracking.totalTokens.output += usage.completion_tokens;
    this.costTracking.totalCost += totalCost;

    if (!this.costTracking.byModel[modelName]) {
      this.costTracking.byModel[modelName] = {
        calls: 0,
        tokens: { input: 0, output: 0 },
        cost: 0
      };
    }

    this.costTracking.byModel[modelName].calls++;
    this.costTracking.byModel[modelName].tokens.input += usage.prompt_tokens;
    this.costTracking.byModel[modelName].tokens.output += usage.completion_tokens;
    this.costTracking.byModel[modelName].cost += totalCost;

    return totalCost;
  }

  /**
   * 获取成本统计
   */
  getCostReport() {
    return {
      summary: {
        totalCalls: this.costTracking.totalCalls,
        totalTokens: this.costTracking.totalTokens.input + this.costTracking.totalTokens.output,
        totalCost: this.costTracking.totalCost
      },
      byModel: this.costTracking.byModel
    };
  }
}

// 单例模式
let instance = null;

function getMultiAIProvider() {
  if (!instance) {
    instance = new MultiAIProvider();
  }
  return instance;
}

module.exports = {
  MultiAIProvider,
  getMultiAIProvider
};
