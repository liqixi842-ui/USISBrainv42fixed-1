// USIS Brain v5.0 - Vision Analysis Service
// GPT-4 Vision集成模块 - 真正的热力图视觉分析

const fetch = require('node-fetch');

/**
 * 视觉分析服务类
 * 集成GPT-4 Vision实现热力图图像识别和分析
 */
class VisionAnalysisService {
  constructor(openaiApiKey) {
    this.apiKey = openaiApiKey;
    this.baseURL = 'https://api.openai.com/v1/chat/completions';
    this.modelConfig = {
      model: 'gpt-4-vision-preview',
      max_tokens: 1500,
      timeout_ms: 30000
    };
  }

  /**
   * 分析热力图图像 - 核心视觉AI功能
   * @param {Buffer} imageBuffer - 热力图图像buffer
   * @param {Object} marketContext - 市场上下文信息
   * @returns {Promise<string>} 视觉分析结果
   */
  async analyzeHeatmapVision(imageBuffer, marketContext) {
    try {
      console.log('👁️  [视觉AI] 开始分析热力图图像');
      console.log(`   市场: ${marketContext.index} (${marketContext.region})`);
      
      const startTime = Date.now();
      const base64Image = imageBuffer.toString('base64');
      
      // 构建市场特定的分析提示词
      const analysisPrompt = this.buildVisionPrompt(marketContext);
      
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.modelConfig.model,
          max_tokens: this.modelConfig.max_tokens,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: analysisPrompt
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${base64Image}`,
                    detail: 'high'
                  }
                }
              ]
            }
          ],
          temperature: 0.3
        }),
        timeout: this.modelConfig.timeout_ms
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`视觉API错误 ${response.status}: ${errorText.slice(0, 200)}`);
      }

      const data = await response.json();
      const analysis = data.choices[0].message.content;
      
      const elapsed = Date.now() - startTime;
      const cost = this.estimateVisionCost(data.usage);
      
      console.log(`✅ [视觉AI] 分析完成 (${elapsed}ms, ~$${cost.toFixed(4)})`);
      console.log(`   Token使用: ${data.usage.total_tokens}`);
      
      return {
        text: analysis,
        metadata: {
          analysis_type: 'vision_based',
          model: this.modelConfig.model,
          elapsed_ms: elapsed,
          cost_usd: cost,
          tokens: data.usage.total_tokens
        }
      };
      
    } catch (error) {
      console.error('❌ [视觉AI] 分析失败:', error.message);
      throw error;
    }
  }

  /**
   * 构建视觉分析提示词 - 针对不同市场定制
   * @param {Object} marketContext - 市场上下文
   * @returns {string} 完整的分析提示词
   */
  buildVisionPrompt(marketContext) {
    const marketNames = {
      'NIKKEI225': '日经225',
      'SPX500': '标普500',
      'NASDAQ100': '纳斯达克100',
      'IBEX35': 'IBEX35',
      'DAX40': 'DAX40',
      'HSI': '恒生指数'
    };
    
    const marketName = marketNames[marketContext.index] || marketContext.index;
    
    return `你是一个专业股票交易员，请分析这张${marketName}实时热力图。

【任务】基于你实际看到的图像内容，提供精准的市场分析。

【视觉特征分析】
1. 绿色/红色板块分布比例（哪种颜色占主导？）
2. 大市值股票的表现（找出图中最大的色块，它们是什么颜色？）
3. 市场广度（上涨股票数量vs下跌股票数量的对比）
4. 资金流向集中度（资金是集中在某几个板块，还是分散？）

【交易洞察】
1. 【机会识别】当前最具潜力的2-3个具体板块（基于绿色深浅和市值大小）
2. 【风险信号】需要警惕的板块或趋势（大面积红色或深红色区域）
3. 【操作建议】具体的交易思路：
   - 如果大面积绿色：指出可能的延续性和追涨机会
   - 如果红绿混杂：提示震荡策略和观望理由
   - 如果大面积红色：建议防御性操作或等待反弹

【要求】
- 必须基于图像实际内容说话，不要假设
- 描述具体看到的颜色分布和板块特征
- 提供可执行的交易思路（入场点位、止损建议）
- 用简洁专业的中文，控制在200字以内

市场背景：${marketName} (${marketContext.region})`;
  }

  /**
   * 备选方案：使用文本模式分析（当视觉AI不可用时）
   * @param {Object} marketContext - 市场上下文
   * @param {Object} gpt5Brain - GPT-5引擎实例
   * @returns {Promise<string>} 文本分析结果
   */
  async analyzeHeatmapFallback(marketContext, gpt5Brain) {
    console.log('🔄 [备选分析] 使用文本模式分析');
    
    const marketNames = {
      'NIKKEI225': '日经225',
      'SPX500': '标普500',
      'NASDAQ100': '纳斯达克100',
      'IBEX35': 'IBEX35',
      'DAX40': 'DAX40',
      'HSI': '恒生指数'
    };
    
    const marketName = marketNames[marketContext.index] || marketContext.index;
    
    const prompt = `作为专业交易员，基于${marketName}热力图的典型模式提供分析框架：

请用户观察热力图时关注以下关键指标：

【观察要点】
1. 绿色板块集中度 - 反映主力资金流向
2. 红色板块分布 - 识别抛压区域和风险板块
3. 大市值股票颜色 - 判断权重股是否带动指数
4. 整体颜色分布 - 评估市场广度（涨跌家数对比）

【分析框架】
- 若绿色占优：市场情绪偏多，关注强势板块持续性
- 若红绿均衡：震荡格局，建议观望或高抛低吸
- 若红色占优：防御为主，等待企稳信号

【操作建议】
基于${marketName}当前市场环境，建议重点关注以下板块的轮动机会，并设置合理止损。

用简洁专业的中文回答，控制在150字以内。`;
    
    const result = await gpt5Brain.generateWithGPT5({
      text: prompt,
      marketData: {},
      semanticIntent: { action: 'heatmap_analysis', symbols: [] },
      mode: 'analysis',
      scene: 'intraday',
      symbols: []
    });
    
    return {
      text: result.text || `📊 ${marketName}热力图已生成。建议关注板块轮动和资金流向。`,
      metadata: {
        analysis_type: 'text_fallback',
        model: 'gpt-5-mini',
        elapsed_ms: result.elapsed_ms || 0,
        cost_usd: result.cost_usd || 0
      }
    };
  }

  /**
   * 成本优化：判断是否应该使用视觉分析
   * @param {string} userTier - 用户等级
   * @param {string} marketIndex - 市场指数
   * @returns {boolean} 是否使用视觉分析
   */
  shouldUseVisionAnalysis(userTier, marketIndex) {
    // 用户等级策略
    const userTiers = {
      'premium': true,    // 高级用户始终使用
      'standard': true,   // 标准用户主要市场使用
      'basic': false      // 基础用户使用文本分析
    };
    
    // 重要市场列表
    const importantMarkets = ['NIKKEI225', 'SPX500', 'NASDAQ100', 'HSI', 'DAX40', 'IBEX35'];
    
    // 如果未指定用户等级，默认为standard
    const tier = userTier || 'standard';
    
    // 如果是高级用户，所有市场都用视觉分析
    if (tier === 'premium') {
      return true;
    }
    
    // 标准用户只对重要市场使用视觉分析
    if (tier === 'standard') {
      return importantMarkets.includes(marketIndex);
    }
    
    // 基础用户不使用视觉分析
    return false;
  }

  /**
   * 估算视觉API成本
   * @param {Object} usage - Token使用量
   * @returns {number} 估算成本（美元）
   */
  estimateVisionCost(usage) {
    if (!usage) return 0;
    
    // GPT-4 Vision定价（近似值）
    // Input: $0.01 / 1K tokens
    // Output: $0.03 / 1K tokens
    const inputCost = (usage.prompt_tokens || 0) / 1000 * 0.01;
    const outputCost = (usage.completion_tokens || 0) / 1000 * 0.03;
    
    return inputCost + outputCost;
  }
}

module.exports = VisionAnalysisService;
