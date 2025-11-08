// ====== 个股走势图服务 v5.0 ======
// 类似heatmapService，但专注于个股K线图分析
// 复用screenshotProviders三层截图系统

const { captureStockChartSmart } = require('./screenshotProviders');  // 🆕 使用专用函数
const VisionAnalyzer = require('./visionAnalyzer');
const { fetchMarketData, fetchCompanyProfile } = require('./dataBroker');

/**
 * 智能映射Finnhub交易所名称到TradingView前缀
 * @param {string} finnhubExchange - Finnhub返回的交易所全名（如 "NASDAQ NMS - GLOBAL MARKET", "NEW YORK STOCK EXCHANGE"）
 * @returns {string} TradingView交易所前缀（如 "NASDAQ", "NYSE"）
 */
function mapExchangeToTradingView(finnhubExchange) {
  if (!finnhubExchange) return 'NASDAQ'; // 默认NASDAQ
  
  const exchange = finnhubExchange.toUpperCase();
  
  // 🧠 智能映射：匹配关键词而非硬编码列表
  if (exchange.includes('NASDAQ')) return 'NASDAQ';
  if (exchange.includes('NYSE') || exchange.includes('NEW YORK')) return 'NYSE';
  if (exchange.includes('HONG KONG') || exchange.includes('HKEX')) return 'HKEX';
  if (exchange.includes('SHANGHAI')) return 'SSE';
  if (exchange.includes('SHENZHEN')) return 'SZSE';
  if (exchange.includes('TOKYO')) return 'TSE';
  if (exchange.includes('LONDON') || exchange.includes('LSE')) return 'LSE';
  if (exchange.includes('EURONEXT')) return 'EURONEXT';
  if (exchange.includes('XETRA') || exchange.includes('FRANKFURT')) return 'XETRA';
  if (exchange.includes('TORONTO') || exchange.includes('TSX')) return 'TSX';
  
  // 默认返回NASDAQ（最常见）
  console.log(`   ⚠️  未识别的交易所: ${finnhubExchange}，使用NASDAQ作为默认`);
  return 'NASDAQ';
}

/**
 * 构建TradingView个股图表URL（智能版本 - 使用API查询交易所）
 * @param {string} symbol - 股票代码（如 "AAPL", "CVX"）
 * @param {Object} options - 图表选项
 * @param {string} options.exchangeInfo - 可选：Finnhub返回的交易所信息
 * @returns {string} TradingView图表URL
 */
function buildStockChartURL(symbol, options = {}) {
  const {
    interval = 'D',        // D=日线, 60=1小时, 15=15分钟
    theme = 'light',       // light/dark
    style = '1',           // 1=蜡烛图, 0=柱状图, 9=线图
    timezone = 'America/New_York',
    studies = 'BB@tv-basicstudies,MACD@tv-basicstudies', // 布林带+MACD
    locale = 'en',
    exchangeInfo = null    // 🆕 智能分析师：使用API查询的真实交易所信息
  } = options;
  
  // 标准化symbol格式
  let normalizedSymbol = symbol.toUpperCase();
  
  // 如果没有交易所前缀，智能添加
  if (!normalizedSymbol.includes(':')) {
    if (exchangeInfo) {
      // 🧠 智能路径：根据API返回的真实交易所信息
      const tvExchange = mapExchangeToTradingView(exchangeInfo);
      normalizedSymbol = `${tvExchange}:${normalizedSymbol}`;
      console.log(`   🧠 [智能映射] ${symbol} → ${normalizedSymbol} (来源: Finnhub API)`);
    } else {
      // ⚠️ 降级路径：无API数据时使用默认值
      normalizedSymbol = `NASDAQ:${normalizedSymbol}`;
      console.log(`   ⚠️  [降级模式] ${symbol} → ${normalizedSymbol} (未查询API)`);
    }
  }
  
  const params = new URLSearchParams({
    symbol: normalizedSymbol,
    interval: interval,
    theme: theme,
    style: style,
    timezone: timezone,
    locale: locale
  });
  
  // 添加技术指标
  if (studies) {
    params.append('studies', studies);
  }
  
  return `https://www.tradingview.com/chart/?${params.toString()}`;
}

/**
 * 生成个股走势图并进行AI分析
 * @param {string} symbol - 股票代码
 * @param {Object} options - 配置选项
 * @returns {Promise<Object>} 包含图表、分析等信息
 */
async function generateStockChart(symbol, options = {}) {
  try {
    const startTime = Date.now();
    console.log(`\n📈 [Stock Chart] 生成${symbol}走势图`);
    
    // 🧠 1️⃣ 智能查询：先获取公司信息（包括交易所）
    let exchangeInfo = null;
    try {
      const profileResult = await fetchCompanyProfile(symbol);
      if (profileResult && profileResult.profile) {
        exchangeInfo = profileResult.profile.exchange;
        console.log(`🏦 [Exchange Info] ${symbol} 在 ${exchangeInfo} 上市`);
      }
    } catch (profileError) {
      console.log(`⚠️  [Profile Lookup] 跳过: ${profileError.message}`);
    }
    
    // 2️⃣ 构建图表URL（使用真实的交易所信息）
    const chartURL = buildStockChartURL(symbol, { ...options, exchangeInfo });
    console.log(`📍 [Chart URL] ${chartURL}`);
    
    // 3️⃣ 获取实时数据（用于上下文）
    let stockData = null;
    try {
      const marketData = await fetchMarketData([symbol]);
      // 🔧 修复：quotes是对象，不是数组
      stockData = marketData.quotes ? marketData.quotes[symbol] : null;
      console.log(`📊 [Market Data] ${stockData ? `已获取 (price=$${stockData.currentPrice})` : '获取失败'}`);
    } catch (dataError) {
      console.log(`⚠️  [Market Data] 跳过: ${dataError.message}`);
    }
    
    // 4️⃣ 使用个股专用截图服务（调用N8N stock_analysis_full）
    try {
      const screenshotResult = await captureStockChartSmart({
        tradingViewUrl: chartURL,
        symbol: symbol
      });
      
      console.log(`✅ [Screenshot] 成功 (provider=${screenshotResult.provider})`);
      
      // 4️⃣ Vision AI分析K线图
      let chartAnalysis = null;
      let analysisMetadata = {};
      
      try {
        console.log('🔬 [Vision] 启动K线图技术分析');
        const visionAnalyzer = new VisionAnalyzer();
        
        const marketContext = {
          symbol: symbol,
          currentPrice: stockData?.currentPrice || 'N/A',  // 🔧 修复：使用包装后的字段
          changePercent: stockData?.changePercent || 0,    // 🔧 修复：使用包装后的字段
          companyName: stockData?.name || symbol,
          exchange: stockData?.exchange || 'N/A',
          positionContext: options.positionContext || null  // 🆕 v3.2: 持仓信息
        };
        
        const visualAnalysis = await visionAnalyzer.analyzeStockChart(
          screenshotResult.buffer,
          marketContext
        );
        
        chartAnalysis = visualAnalysis.rawAnalysis;
        analysisMetadata = {
          analysis_type: 'vision_technical',
          confidence: visualAnalysis.confidence || 0.85
        };
        
        console.log('📋 [Vision] 技术分析完成');
        
      } catch (visionError) {
        console.log(`⚠️  [Vision Failed] ${visionError.message}`);
        chartAnalysis = '暂无技术分析（Vision服务异常）';
        analysisMetadata = {
          analysis_type: 'fallback',
          error: visionError.message
        };
      }
      
      const elapsed = Date.now() - startTime;
      
      return {
        ok: true,
        symbol: symbol,
        buffer: screenshotResult.buffer,
        chartURL: chartURL,
        stockData: stockData,
        chartAnalysis: chartAnalysis,
        provider: screenshotResult.provider,
        meta: {
          ...screenshotResult.meta,
          analysis: analysisMetadata
        },
        elapsed_ms: elapsed
      };
      
    } catch (screenshotError) {
      console.error(`❌ [Screenshot Failed] ${screenshotError.message}`);
      throw screenshotError;
    }
    
  } catch (error) {
    console.error(`🔥 [Stock Chart Service Error] ${error.message}`);
    throw error;
  }
}

/**
 * 格式化股票数据为可读文本
 * @param {Object} stockData - Finnhub股票数据
 * @returns {string} 格式化的数据摘要
 */
function formatStockData(stockData) {
  if (!stockData) return '暂无实时数据';
  
  const change = stockData.d || 0;
  const changePercent = stockData.dp || 0;
  const changeSymbol = change >= 0 ? '+' : '';
  
  return `
## 实时行情数据

**代码**: ${stockData.symbol || 'N/A'}
**当前价**: $${stockData.c?.toFixed(2) || 'N/A'}
**涨跌额**: ${changeSymbol}${change.toFixed(2)} (${changeSymbol}${changePercent.toFixed(2)}%)
**开盘价**: $${stockData.o?.toFixed(2) || 'N/A'}
**最高价**: $${stockData.h?.toFixed(2) || 'N/A'}
**最低价**: $${stockData.l?.toFixed(2) || 'N/A'}
**昨收价**: $${stockData.pc?.toFixed(2) || 'N/A'}
`.trim();
}

module.exports = {
  generateStockChart,
  buildStockChartURL,
  formatStockData
};
