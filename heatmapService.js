// 热力图服务模块 - v5.0
// 独立模块，避免循环依赖

const { extractHeatmapQueryRulesOnly, buildTradingViewURL, generateHeatmapSummary, generateCaption } = require("./heatmapIntentParser");
const { captureHeatmapSmart } = require('./screenshotProviders');
const { generateWithGPT5 } = require('./gpt5Brain');

/**
 * 生成AI市场分析
 * @param {string} marketIndex - 市场指数名称
 * @param {string} userQuery - 用户原始查询
 * @returns {Promise<string>} AI分析结果
 */
async function generateMarketAnalysis(marketIndex, userQuery) {
  try {
    console.log(`🤖 开始分析${marketIndex}市场`);
    
    const indexNames = {
      'SPX500': '标普500', 'NASDAQ100': '纳斯达克100', 'DJ30': '道琼斯30',
      'NIKKEI225': '日经225', 'IBEX35': 'IBEX35', 'DAX40': 'DAX40',
      'CAC40': 'CAC40', 'FTSE100': '富时100', 'EURO50': '欧洲斯托克50',
      'HSI': '恒生指数', 'CSI300': '沪深300', 'NIFTY50': 'Nifty 50'
    };
    
    const indexName = indexNames[marketIndex] || marketIndex;
    
    const prompt = `作为专业股票分析师，基于${indexName}热力图提供简要市场分析：
- 当前市场整体趋势
- 表现最好和最差的板块
- 简要的投资建议
请用简洁专业的中文回答，控制在150字以内。`;
    
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
    const indexNames = {
      'NIKKEI225': '日经225', 'IBEX35': 'IBEX35', 'DAX40': 'DAX40',
      'SPX500': '标普500', 'NASDAQ100': '纳斯达克100'
    };
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
      
      // 生成AI市场分析
      const marketAnalysis = await generateMarketAnalysis(query.index, userText);
      
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
          debug: query.debug
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
