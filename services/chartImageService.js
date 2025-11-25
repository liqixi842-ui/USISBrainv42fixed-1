/**
 * chartImageService.js
 * 
 * Phase 6A: K线图截图服务
 * Phase 7: 添加无广告 Widget 模式
 * 用于 Premium PDF 增强 - 自动插入 K线截图到 PDF 报告中
 * 
 * 功能：
 * - 生成日线 K线图（Daily K-line chart）
 * - 返回 PNG Buffer，可直接插入 PDF
 * - 复用现有的 screenshot providers (Browserless + N8N)
 * - Phase 7: 使用 TradingView Widget Embed (无广告)
 */

const { buildStockChartURL } = require('../stockChartService.js');
const { captureStockChartSmart, captureWithBrowserlessTv } = require('../screenshotProviders.js');

/**
 * 构建 TradingView Widget URL（无广告版本）
 * Phase 7: Widget embed 模式，避免广告和促销遮挡
 * @param {string} symbol - 股票代码
 * @param {Object} options - 配置选项
 * @returns {string} Widget URL
 */
function buildCleanWidgetURL(symbol, options = {}) {
  const {
    interval = 'D',
    theme = 'light',
    studies = 'BB@tv-basicstudies%2CMACD@tv-basicstudies',
    width = 1200,
    height = 600,
    exchangeInfo = null
  } = options;

  // 构建完整的 TradingView symbol（包含交易所前缀）
  let tvSymbol = symbol;
  
  // 如果没有提供 exchangeInfo，尝试智能推断
  if (!symbol.includes(':')) {
    if (exchangeInfo && exchangeInfo.mic) {
      // 使用 Finnhub exchange info
      const exchangeMap = {
        'XNAS': 'NASDAQ',
        'XNYS': 'NYSE',
        'ARCX': 'AMEX',
        'BATS': 'BATS'
      };
      const exchange = exchangeMap[exchangeInfo.mic] || 'NASDAQ';
      tvSymbol = `${exchange}:${symbol}`;
    } else {
      // 默认使用 NASDAQ（适用于大多数美股）
      tvSymbol = `NASDAQ:${symbol}`;
    }
  }

  console.log(`📊 [CleanWidget] "${symbol}" → "${tvSymbol}"`);

  // 使用 TradingView Widget Embed URL（无广告）
  const widgetUrl = `https://www.tradingview.com/embed-widget/advanced-chart/` +
    `?symbol=${encodeURIComponent(tvSymbol)}` +
    `&interval=${interval}` +
    `&theme=${theme}` +
    `&style=1` + // 蜡烛图
    `&withdateranges=true` +
    `&hide_side_toolbar=false` +
    `&studies=${studies}` +
    `&width=${width}` +
    `&height=${height}` +
    `&locale=en`;

  return widgetUrl;
}

/**
 * 获取日线 K线图 PNG Buffer
 * @param {string} symbol - 股票代码（如 NVDA, TSLA）
 * @param {Object} options - 可选配置
 * @param {string} options.interval - 时间间隔（D=日线, W=周线）
 * @param {string} options.theme - 主题（light, dark）
 * @param {string} options.exchangeInfo - Finnhub 交易所信息
 * @returns {Promise<Buffer|null>} PNG buffer 或 null（失败时）
 */
async function getDailyKlineImage(symbol, options = {}) {
  const {
    interval = 'D',        // 默认日线
    theme = 'light',       // 默认浅色主题（适合 PDF）
    exchangeInfo = null,
    timeout = 45000,       // 45 秒超时
    retries = 2            // 最多重试 2 次
  } = options;
  
  console.log(`\n📊 [ChartImageService] 获取 K线图: ${symbol}`);
  console.log(`   ├─ 时间间隔: ${interval}`);
  console.log(`   ├─ 主题: ${theme}`);
  console.log(`   └─ 超时: ${timeout}ms\n`);
  
  try {
    // Step 1: 构建 TradingView Widget URL（Phase 7: 无广告）
    const chartUrl = buildCleanWidgetURL(symbol, {
      interval: interval,
      theme: theme,
      studies: 'BB@tv-basicstudies%2CMACD@tv-basicstudies',  // 布林带 + MACD
      width: 1200,
      height: 600,
      exchangeInfo: exchangeInfo
    });
    
    console.log(`✅ [ChartImageService] Clean Widget URL: ${chartUrl.substring(0, 100)}...`);
    
    // Step 2: 尝试使用 N8N 截图服务（优先）
    try {
      console.log(`📸 [ChartImageService] 尝试 N8N 截图服务...`);
      const result = await captureStockChartSmart({
        tradingViewUrl: chartUrl,
        symbol: symbol,
        timeoutMs: timeout,
        maxRetries: retries
      });
      
      if (result.success && result.buffer) {
        console.log(`✅ [ChartImageService] N8N 截图成功: ${(result.buffer.length / 1024).toFixed(2)} KB`);
        return result.buffer;
      }
      
      console.warn(`⚠️  [ChartImageService] N8N 截图失败，尝试 Browserless...`);
    } catch (n8nError) {
      console.warn(`⚠️  [ChartImageService] N8N 错误: ${n8nError.message}`);
      console.log(`📸 [ChartImageService] 降级到 Browserless...`);
    }
    
    // Step 3: 降级使用 Browserless（高质量备用）
    try {
      const browserlessResult = await captureWithBrowserlessTv({
        tradingViewUrl: chartUrl,
        symbol: symbol,
        timeoutMs: timeout
      });
      
      if (browserlessResult.success && browserlessResult.buffer) {
        console.log(`✅ [ChartImageService] Browserless 截图成功: ${(browserlessResult.buffer.length / 1024).toFixed(2)} KB`);
        return browserlessResult.buffer;
      }
    } catch (browserlessError) {
      console.error(`❌ [ChartImageService] Browserless 错误: ${browserlessError.message}`);
    }
    
    // Step 4: 所有方法都失败
    console.error(`❌ [ChartImageService] 所有截图方法均失败`);
    return null;
    
  } catch (error) {
    console.error(`❌ [ChartImageService] 致命错误: ${error.message}`);
    console.error(error.stack);
    return null;
  }
}

/**
 * 获取多时间框架 K线图（可选功能）
 * @param {string} symbol - 股票代码
 * @param {Array<string>} intervals - 时间间隔数组（如 ['D', 'W', '60']）
 * @returns {Promise<Object>} { daily: Buffer, weekly: Buffer, hourly: Buffer }
 */
async function getMultiTimeframeCharts(symbol, intervals = ['D', 'W']) {
  const charts = {};
  
  console.log(`\n📊 [ChartImageService] 获取多时间框架图表: ${symbol}`);
  console.log(`   └─ 时间框架: ${intervals.join(', ')}\n`);
  
  for (const interval of intervals) {
    const buffer = await getDailyKlineImage(symbol, { interval });
    
    // 映射名称
    const name = {
      'D': 'daily',
      'W': 'weekly',
      '60': 'hourly',
      '15': 'intraday'
    }[interval] || interval;
    
    charts[name] = buffer;
  }
  
  return charts;
}

/**
 * 验证图表 Buffer 是否有效
 * @param {Buffer} buffer - PNG Buffer
 * @returns {boolean} 是否有效
 */
function validateChartBuffer(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    console.error(`❌ [ChartImageService] Invalid buffer: not a Buffer instance`);
    return false;
  }
  
  if (buffer.length < 1000) {
    console.error(`❌ [ChartImageService] Invalid buffer: too small (${buffer.length} bytes)`);
    return false;
  }
  
  // 检查 PNG 文件头
  const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  if (!buffer.slice(0, 8).equals(pngSignature)) {
    console.error(`❌ [ChartImageService] Invalid buffer: not a PNG file`);
    return false;
  }
  
  console.log(`✅ [ChartImageService] Valid PNG buffer: ${(buffer.length / 1024).toFixed(2)} KB`);
  return true;
}

module.exports = {
  getDailyKlineImage,
  getMultiTimeframeCharts,
  validateChartBuffer
};
