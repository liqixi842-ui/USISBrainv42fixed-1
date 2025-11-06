// ====== 个股走势图服务 v5.0 ======
// 类似heatmapService，但专注于个股K线图分析
// 复用screenshotProviders三层截图系统

const { captureHeatmapSmart } = require('./screenshotProviders');
const VisionAnalyzer = require('./visionAnalyzer');
const { fetchMarketData } = require('./dataBroker');

/**
 * 构建TradingView个股图表URL
 * @param {string} symbol - 股票代码（如 "AAPL", "NASDAQ:NVDA", "BME:GRF"）
 * @param {Object} options - 图表选项
 * @returns {string} TradingView图表URL
 */
function buildStockChartURL(symbol, options = {}) {
  const {
    interval = 'D',        // D=日线, 60=1小时, 15=15分钟
    theme = 'light',       // light/dark
    style = '1',           // 1=蜡烛图, 0=柱状图, 9=线图
    timezone = 'America/New_York',
    studies = 'BB@tv-basicstudies,MACD@tv-basicstudies', // 布林带+MACD
    locale = 'en'
  } = options;
  
  // 标准化symbol格式
  let normalizedSymbol = symbol.toUpperCase();
  
  // 如果没有交易所前缀，根据常见股票添加
  if (!normalizedSymbol.includes(':')) {
    // 美股默认NASDAQ，可以根据需要调整
    if (/^[A-Z]{1,5}$/.test(normalizedSymbol)) {
      normalizedSymbol = `NASDAQ:${normalizedSymbol}`;
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
    
    // 1️⃣ 构建图表URL
    const chartURL = buildStockChartURL(symbol, options);
    console.log(`📍 [Chart URL] ${chartURL}`);
    
    // 2️⃣ 获取实时数据（用于上下文）
    let stockData = null;
    try {
      const marketData = await fetchMarketData([symbol]);
      stockData = marketData.quotes && marketData.quotes.length > 0 
        ? marketData.quotes[0] 
        : null;
      console.log(`📊 [Market Data] ${stockData ? '已获取' : '获取失败'}`);
    } catch (dataError) {
      console.log(`⚠️  [Market Data] 跳过: ${dataError.message}`);
    }
    
    // 3️⃣ 使用智能截图服务（复用热力图系统）
    try {
      const screenshotResult = await captureHeatmapSmart({
        tradingViewUrl: chartURL,
        dataset: symbol,
        region: 'AUTO',
        sector: undefined
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
          currentPrice: stockData?.c || 'N/A',
          changePercent: stockData?.dp || 0,
          companyName: stockData?.name || symbol,
          exchange: stockData?.exchange || 'N/A'
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
