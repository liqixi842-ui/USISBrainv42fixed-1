// 热力图服务模块 - v5.0 Vision Upgrade
// 独立模块，避免循环依赖
// 新增：GPT-4 Vision视觉分析能力

const { extractHeatmapQueryRulesOnly, buildTradingViewURL, generateHeatmapSummary, generateCaption } = require("./heatmapIntentParser");
const { captureHeatmapSmart } = require('./screenshotProviders');
const { generateWithGPT5 } = require('./gpt5Brain');
const VisionAnalysisService = require('./visionAnalysis');

/**
 * 生成AI市场分析 - 基于可观察热力图特征
 * @param {string} marketIndex - 市场指数名称
 * @param {string} userQuery - 用户原始查询
 * @returns {Promise<string>} AI分析结果
 */
async function generateMarketAnalysis(marketIndex, userQuery) {
  try {
    console.log(`🤖 生成${marketIndex}基于热力图特征的专业分析`);
    
    const indexNames = {
      'SPX500': '标普500', 'NASDAQ100': '纳斯达克100', 'DJ30': '道琼斯30',
      'NIKKEI225': '日经225', 'IBEX35': 'IBEX35', 'DAX40': 'DAX40',
      'CAC40': 'CAC40', 'FTSE100': '富时100', 'EURO50': '欧洲斯托克50',
      'HSI': '恒生指数', 'CSI300': '沪深300', 'NIFTY50': 'Nifty 50'
    };
    
    const indexName = indexNames[marketIndex] || marketIndex;
    
    const prompt = `你刚刚生成了${indexName}的实时热力图。作为专业分析师，请基于热力图中可见的以下特征提供分析：

可观察特征（请根据实际图像描述）：
- 绿色/红色板块分布情况
- 大市值股票的表现
- 板块轮动迹象
- 市场广度（上涨股票数量vs下跌）

基于这些可见特征，请提供：
1. 【当前判断】市场处于什么状态？（普涨/分化/普跌）
2. 【机会识别】哪个板块最具吸引力？为什么？
3. 【风险提示】需要警惕什么信号？
4. 【操作建议】具体的交易思路（入场/出场条件）

要求：避免宏观套话，基于"看到的"图像特征说话，提供可执行建议。
如果热力图显示大面积绿色，指出可能的延续性；如果红绿混杂，提示震荡策略。

用简洁专业的中文回答，控制在200字以内。`;
    
    const analysis = await generateWithGPT5({
      text: prompt,
      marketData: {},
      semanticIntent: { action: 'heatmap_analysis', symbols: [] },
      mode: 'analysis',
      scene: 'intraday',
      symbols: []
    });
    
    return analysis.text || `📊 ${indexName}实时热力图已生成。建议关注板块轮动和资金流向。`;
    
  } catch (error) {
    console.log('❌ AI分析失败，使用备用分析:', error.message);
    const indexName = indexNames[marketIndex] || marketIndex;
    return `📊 ${indexName}实时热力图已生成。建议关注板块轮动和资金流向。`;
  }
}

/**
 * 智能热力图生成（纯规则引擎 + 可插拔Provider系统）
 * @param {string} userText - 用户输入文本
 * @returns {Promise<Object>} 包含 buffer、caption、summary 等的结果对象
 */
async function generateSmartHeatmap(userText) {
  try {
    const startTime = Date.now();
    console.log(`\n🧠 [Smart Heatmap] 处理请求: "${userText}"`);
    
    // 1️⃣ 使用纯规则引擎解析（不依赖GPT-5，100%准确）
    const query = extractHeatmapQueryRulesOnly(userText);
    console.log(`🎯 [规则引擎] 解析结果: region=${query.region}, index=${query.index}, sector=${query.sector}`);
    
    const caption = generateCaption(query);
    const summary = generateHeatmapSummary(query);
    const tradingViewUrl = buildTradingViewURL(query);
    
    // 确保index有值
    if (!query.index || query.index === 'AUTO') {
      throw new Error('无法确定目标指数，请提供更具体的地区或指数信息');
    }
    
    // 🚨 关键校验：西班牙IBEX35（三层防护第1层）
    if (query.region === 'ES' && query.index !== 'IBEX35') {
      console.error(`🚨 [防串台] 规则引擎层拦截：西班牙地区强制使用IBEX35`);
      throw new Error(`防串台失败：西班牙地区必须使用IBEX35，当前为${query.index}`);
    }
    
    // 2️⃣ 使用可插拔Provider系统截图（n8n → Browserless）
    try {
      // 创建超时Promise（35秒，略长于Provider的30秒）
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('热力图生成超时，请稍后重试')), 35000);
      });
      
      // 创建截图Promise
      const screenshotPromise = captureHeatmapSmart({
        tradingViewUrl,
        dataset: query.index,
        region: query.region,
        sector: query.sector !== 'AUTO' ? query.sector : undefined
      });
      
      // 使用Promise.race竞争，哪个先完成用哪个
      const result = await Promise.race([screenshotPromise, timeoutPromise]);
      
      const elapsed = Date.now() - startTime;
      
      // 🚨 关键校验：西班牙IBEX35（三层防护第2层）
      if (query.region === 'ES' && query.index !== 'IBEX35') {
        console.error(`🚨 [防串台] Provider响应层拦截：西班牙地区必须使用IBEX35`);
        throw new Error(`防串台失败：西班牙地区必须使用IBEX35，当前为${query.index}`);
      }
      
      console.log(`✅ [Smart Heatmap] 完成 (${elapsed}ms, provider=${result.provider})`);
      
      // 🆕 v5.0: 视觉AI分析（基于真实图像内容）
      let marketAnalysis;
      let analysisMetadata = {};
      
      try {
        const visionService = new VisionAnalysisService(process.env.OPENAI_API_KEY);
        const marketContext = {
          index: query.index,
          region: query.region,
          sector: query.sector
        };
        
        // 检查是否应该使用视觉分析（成本优化）
        const useVision = visionService.shouldUseVisionAnalysis('standard', query.index);
        
        if (useVision) {
          console.log('👁️  [Vision Mode] 启用视觉AI分析');
          const visionResult = await visionService.analyzeHeatmapVision(
            result.buffer,
            marketContext
          );
          marketAnalysis = visionResult.text;
          analysisMetadata = visionResult.metadata;
        } else {
          console.log('📝 [Text Mode] 使用文本模式分析');
          const fallbackResult = await visionService.analyzeHeatmapFallback(
            marketContext,
            { generateWithGPT5 }
          );
          marketAnalysis = fallbackResult.text;
          analysisMetadata = fallbackResult.metadata;
        }
        
      } catch (visionError) {
        console.log('⚠️  [Vision Fallback] 视觉分析失败，切换到文本模式');
        console.log(`   错误: ${visionError.message}`);
        
        // 降级到旧的文本分析
        marketAnalysis = await generateMarketAnalysis(query.index, userText);
        analysisMetadata = { analysis_type: 'text_legacy', error: visionError.message };
      }
      
      return {
        ok: true,
        buffer: result.buffer,
        source: result.provider,
        query: query,
        meta: {
          ...result.meta,
          dataset: query.index,
          expected_region: query.region,
          locale: query.locale,
          sector: query.sector,
          debug: query.debug,
          analysis: analysisMetadata
        },
        elapsed_ms: elapsed,
        caption: marketAnalysis,
        summary: summary
      };
    } catch (error) {
      console.error(`❌ [Smart Heatmap] 失败:`, error.message);
      throw error;
    }
  } catch (error) {
    console.error(`🔥 [热力图服务错误]`, error.message);
    throw error;
  }
}

module.exports = {
  generateSmartHeatmap
};
