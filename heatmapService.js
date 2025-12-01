// 热力图服务模块 - v5.0 Enhanced Vision Upgrade
// 独立模块，避免循环依赖
// 新增：GPT-4o视觉分析 + 增强数据经纪人 + 专业报告生成

const { extractHeatmapQueryRulesOnly, buildTradingViewURL, generateHeatmapSummary, generateCaption } = require("./heatmapIntentParser");
const { captureHeatmapSmart, captureHeatmapRouter } = require('./screenshotProviders');
const { generateWithGPT5 } = require('./gpt5Brain');
const VisionAnalyzer = require('./visionAnalyzer');
const EnhancedDataBroker = require('./enhancedDataBroker');
const ProfessionalReporter = require('./professionalReporter');

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
      'HSI': '恒生指数', 'CSI300': '沪深300', 'NIFTY50': 'Nifty 50',
      'TSX': '加拿大TSX', 'AS200': '澳洲ASX200', 'KOSPI': '韩国KOSPI',
      'CRYPTO': '加密货币', 'FTSE': '英国富时', 'DAX': '德国DAX'
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
    
    // 🛡️ Fallback: 当无法确定指数时，默认使用SPX500
    if (!query.index || query.index === 'AUTO') {
      console.log('⚠️  [Fallback] 未指定具体指数，默认使用SPX500');
      query.index = 'SPX500';
      query.region = 'US';
    }
    
    const caption = generateCaption(query);
    const summary = generateHeatmapSummary(query);
    const tradingViewUrl = buildTradingViewURL(query);
    
    // 🚨 关键校验：西班牙IBEX35（三层防护第1层）
    if (query.region === 'ES' && query.index !== 'IBEX35') {
      console.error(`🚨 [防串台] 规则引擎层拦截：西班牙地区强制使用IBEX35`);
      throw new Error(`防串台失败：西班牙地区必须使用IBEX35，当前为${query.index}`);
    }
    
    // 2️⃣ 使用可插拔Provider系统截图（美国→N8N，国际→Browserless）
    try {
      // 国际市场需要更长超时（Browserless 渲染 + JavaScript 执行）
      const intlMarkets = ['TSX', 'DAX', 'DAX40', 'FTSE', 'FTSE100', 'CAC40', 'AS51', 'AS200', 'KOSPI', 'NIKKEI225', 'IBEX35'];
      const isIntlMarket = intlMarkets.includes(query.index);
      const timeoutDuration = isIntlMarket ? 65000 : 35000;  // 国际65秒，美国35秒
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('热力图生成超时，请稍后重试')), timeoutDuration);
      });
      
      if (isIntlMarket) {
        console.log(`🌍 [国际市场] ${query.index} - 使用 Browserless 渲染 (超时 ${timeoutDuration/1000}s)`);
      }
      
      // 创建截图Promise（使用智能路由：美国→N8N，国际→Browserless）
      const screenshotPromise = captureHeatmapRouter({
        tradingViewUrl,
        marketIndex: query.index,  // 🆕 传递市场指数用于路由判断
        dataset: query.dataset || query.index,
        region: query.region,
        sector: query.sector !== 'AUTO' ? query.sector : undefined,
        sectorName: query.sectorName
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
      
      // 🆕 v5.0 Enhanced: 视觉AI + 增强数据 + 专业报告
      let marketAnalysis;
      let analysisMetadata = {};
      let professionalReport = null;
      
      const marketContext = {
        index: query.index,
        region: query.region,
        sector: query.sector !== 'AUTO' ? query.sector : null,
        dataset: query.dataset || null, // 精确板块数据集
        sectorName: query.sectorName || null, // 板块中文名称
        components: query.components || [] // 主要成分股
      };
      
      // 判断是否使用增强分析（重要市场）
      const importantMarkets = ['NIKKEI225', 'SPX500', 'NASDAQ100', 'HSI', 'DAX40', 'IBEX35', 'CRYPTO'];
      const useEnhancedAnalysis = importantMarkets.includes(query.index);
      
      if (useEnhancedAnalysis) {
        try {
          console.log('🔬 [Enhanced Analysis] 启用增强分析模式');
          
          // 1. 视觉分析（GPT-4o）
          const visionAnalyzer = new VisionAnalyzer();
          const visualAnalysis = await visionAnalyzer.analyzeHeatmapImage(
            result.buffer,
            marketContext
          );
          console.log(`👁️  [Vision] 识别到${visualAnalysis.sectors.length}个板块`);
          
          // 2. 增强数据采集
          const dataBroker = new EnhancedDataBroker();
          const marketData = await dataBroker.fetchComprehensiveMarketData(
            query.index,
            query.region,
            marketContext.sector
          );
          console.log(`📊 [Data] 获取${marketData.components.length}个成分股数据`);
          
          // 3. 生成专业报告
          const reporter = new ProfessionalReporter();
          professionalReport = await reporter.generateHeatmapAnalysisReport(
            visualAnalysis,
            marketData,
            marketData.economics || [],
            marketData.news || { articles: [] }
          );
          console.log('📋 [Report] 专业报告生成完成');
          
          marketAnalysis = professionalReport.rawAnalysis;
          analysisMetadata = {
            analysis_type: 'enhanced_vision',
            visual_sectors: visualAnalysis.sectors.length,
            data_components: marketData.components.length,
            confidence: professionalReport.dataConfidence,
            risk_level: professionalReport.riskAssessment
          };
          
        } catch (enhancedError) {
          console.log('⚠️  [Enhanced Analysis Failed] 降级到基础视觉分析');
          console.log(`   错误: ${enhancedError.message}`);
          
          // Fallback 1: 基础视觉分析
          try {
            const visionAnalyzer = new VisionAnalyzer();
            const visualAnalysis = await visionAnalyzer.analyzeHeatmapImage(
              result.buffer,
              marketContext
            );
            marketAnalysis = visualAnalysis.rawAnalysis;
            analysisMetadata = {
              analysis_type: 'vision_basic',
              enhanced_error: enhancedError.message
            };
          } catch (visionError) {
            console.log('⚠️  [Vision Failed] 降级到文本分析');
            
            // Fallback 2: 文本分析
            marketAnalysis = await generateMarketAnalysis(query.index, userText);
            analysisMetadata = {
              analysis_type: 'text_legacy',
              enhanced_error: enhancedError.message,
              vision_error: visionError.message
            };
          }
        }
      } else {
        // 非重要市场使用基础视觉分析
        try {
          console.log('👁️  [Basic Vision] 使用基础视觉分析');
          const visionAnalyzer = new VisionAnalyzer();
          const visualAnalysis = await visionAnalyzer.analyzeHeatmapImage(
            result.buffer,
            marketContext
          );
          marketAnalysis = visualAnalysis.rawAnalysis;
          analysisMetadata = {
            analysis_type: 'vision_basic',
            visual_sectors: visualAnalysis.sectors.length
          };
        } catch (visionError) {
          console.log('⚠️  [Vision Failed] 降级到文本分析');
          marketAnalysis = await generateMarketAnalysis(query.index, userText);
          analysisMetadata = {
            analysis_type: 'text_legacy',
            vision_error: visionError.message
          };
        }
      }
      
      return {
        ok: true,
        buffer: result.buffer,
        source: result.provider,
        provider: result.provider,  // 🔧 兼容 heatmap-bot 期望的字段名
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
        marketAnalysis: marketAnalysis,  // 🔧 修复：使用正确的字段名
        summary: summary,
        professionalReport: professionalReport
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
