// ====== 个股走势图服务 v6.0 - 深度可靠性增强版 ======
// 类似heatmapService，但专注于个股K线图分析
// 复用screenshotProviders三层截图系统
// 🆕 v6.0: 分阶段超时、结构化诊断日志、渐进式降级

// 🛡️ v6.1: 延迟加载Chromium依赖（防止启动时OOM - 节省600MB内存）
let _captureStockChartSmart = null;
let _VisionAnalyzer = null;

function loadScreenshotProvider() {
  if (!_captureStockChartSmart) {
    ({ captureStockChartSmart: _captureStockChartSmart } = require('./screenshotProviders'));
    console.log('🔄 [LazyLoad] screenshotProviders已加载');
  }
  return _captureStockChartSmart;
}

function loadVisionAnalyzer() {
  if (!_VisionAnalyzer) {
    _VisionAnalyzer = require('./visionAnalyzer');
    console.log('🔄 [LazyLoad] VisionAnalyzer已加载');
  }
  return _VisionAnalyzer;
}

const { fetchMarketData, fetchCompanyProfile } = require('./dataBroker');
const { runWithTimeout, RetryHelper } = require('./utils/asyncTools');

// 🆕 v6.0: 阶段超时配置（环境变量可配置）
const TIMEOUTS = {
  DATA_FETCH: parseInt(process.env.DATA_FETCH_TIMEOUT) || 10000,      // 10s
  SCREENSHOT: parseInt(process.env.SCREENSHOT_TIMEOUT) || 30000,      // 30s (N8N平均14.6s + 余量)
  VISION_AI: parseInt(process.env.VISION_AI_TIMEOUT) || 20000,        // 20s
  TOTAL: parseInt(process.env.TOTAL_TIMEOUT) || 75000                 // 75s（预留5s给Telegram）
};

// 🆕 v6.0: 重试助手实例
const retryHelper = new RetryHelper({
  maxRetries: 2,
  baseDelay: 1500,
  backoffFactor: 2,
  jitter: 250
});

// 🚨 NFLX专用：失败计数器和强制降级
const nflxFailureTracker = {
  count: 0,
  lastReset: Date.now(),
  MAX_FAILURES: 3,
  RESET_INTERVAL: 300000 // 5分钟重置计数
};

function shouldForceNFLXFallback(symbol) {
  if (symbol !== 'NFLX') return false;
  
  // 定期重置计数器
  if (Date.now() - nflxFailureTracker.lastReset > nflxFailureTracker.RESET_INTERVAL) {
    nflxFailureTracker.count = 0;
    nflxFailureTracker.lastReset = Date.now();
  }
  
  return nflxFailureTracker.count >= nflxFailureTracker.MAX_FAILURES;
}

function recordNFLXFailure() {
  nflxFailureTracker.count++;
  console.warn(`🚨 NFLX失败计数: ${nflxFailureTracker.count}/${nflxFailureTracker.MAX_FAILURES}`);
}

function recordNFLXSuccess() {
  nflxFailureTracker.count = 0;
  console.log(`✅ NFLX成功，重置失败计数`);
}

/**
 * 智能映射Finnhub交易所名称到TradingView前缀
 * @param {string} finnhubExchange - Finnhub返回的交易所全名（如 "NASDAQ NMS - GLOBAL MARKET", "NEW YORK STOCK EXCHANGE"）
 * @returns {string} TradingView交易所前缀（如 "NASDAQ", "NYSE"）
 */
function mapExchangeToTradingView(finnhubExchange) {
  if (!finnhubExchange) return 'NASDAQ'; // 默认NASDAQ
  
  const exchange = finnhubExchange.toUpperCase();
  
  // 🧠 智能映射：匹配关键词而非硬编码列表
  if (exchange.includes('OTC') || exchange.includes('PINK') || exchange.includes('OTCMKTS')) return 'OTC';
  if (exchange.includes('NASDAQ')) return 'NASDAQ';
  if (exchange.includes('NYSE') || exchange.includes('NEW YORK')) return 'NYSE';
  if (exchange.includes('HONG KONG') || exchange.includes('HKEX')) return 'HKEX';
  if (exchange.includes('SHANGHAI')) return 'SSE';
  if (exchange.includes('SHENZHEN')) return 'SZSE';
  if (exchange.includes('TOKYO')) return 'TSE';
  if (exchange.includes('LONDON') || exchange.includes('LSE')) return 'LSE';
  if (exchange.includes('EURONEXT')) return 'EURONEXT';
  if (exchange.includes('XETRA') || exchange.includes('FRANKFURT')) return 'XETRA';
  if (exchange.includes('TORONTO') || exchange.includes('TSX') || exchange.includes('CANADA')) {
    // 区分TSX和TSXV（创业板）
    if (exchange.includes('VENTURE') || exchange.includes('TSXV')) return 'TSXV';
    return 'TSX';
  }
  
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
 * 🆕 v6.0: 生成个股走势图并进行AI分析（深度可靠性增强版）
 * 支持分阶段超时、结构化诊断日志、渐进式降级
 * 
 * @param {string} symbol - 股票代码
 * @param {Object} options - 配置选项
 * @returns {Promise<Object>} 包含图表、分析等信息
 */
async function generateStockChart(symbol, options = {}) {
  const startTime = Date.now();
  const diagnostics = {
    symbol,
    phases: {},
    fallback: false,
    totalDuration: 0
  };

  try {
    console.log(`\n📈 [Stock Chart v6.0] 生成${symbol}走势图（深度可靠性增强）`);
    
    // 🚨 NFLX快速通道：强制降级检查
    if (shouldForceNFLXFallback(symbol)) {
      console.warn(`🔄 [NFLX快速通道] 检测到连续失败，强制使用基础分析`);
      diagnostics.fallback = true;
      diagnostics.fallbackReason = 'nflx_repeated_failures';
      
      // 仍然尝试获取基础数据
      let stockData = null;
      try {
        const marketData = await fetchMarketData([symbol]);
        stockData = marketData.quotes ? marketData.quotes[symbol] : null;
      } catch (dataError) {
        console.error(`❌ [NFLX快速通道] 数据获取失败: ${dataError.message}`);
      }
      
      return buildFallbackResponse(symbol, stockData, options.positionContext, diagnostics, startTime);
    }
    
    // ===== PHASE 1: 数据获取 (10s timeout) =====
    const phase1Start = Date.now();
    let exchangeInfo = null;
    let stockData = null;
    
    try {
      // 🔁 使用重试机制获取数据
      await runWithTimeout('Phase1-DataFetch', async () => {
        // Profile查询（不强制成功）
        try {
          const profileResult = await retryHelper.execute(
            `fetchCompanyProfile-${symbol}`,
            () => fetchCompanyProfile(symbol),
            { timeout: TIMEOUTS.DATA_FETCH / 2 }
          );
          if (profileResult && profileResult.profile) {
            exchangeInfo = profileResult.profile.exchange;
          }
        } catch (profileError) {
          console.log(`⚠️  [Profile] 跳过: ${profileError.message}`);
        }

        // Market数据（关键数据）
        const marketData = await retryHelper.execute(
          `fetchMarketData-${symbol}`,
          () => fetchMarketData([symbol]),
          { timeout: TIMEOUTS.DATA_FETCH / 2 }
        );
        stockData = marketData.quotes ? marketData.quotes[symbol] : null;
      }, TIMEOUTS.DATA_FETCH);

      diagnostics.phases.dataFetch = {
        status: 'success',
        duration: Date.now() - phase1Start,
        hasExchangeInfo: !!exchangeInfo,
        hasStockData: !!stockData
      };
      
      console.log(`NFLX_DIAG|${symbol}|phase=dataFetch|status=success|ms=${Date.now() - phase1Start}|price=${stockData?.currentPrice || 'N/A'}`);
      
    } catch (dataError) {
      diagnostics.phases.dataFetch = {
        status: 'failed',
        duration: Date.now() - phase1Start,
        error: dataError.message
      };
      
      console.error(`NFLX_DIAG|${symbol}|phase=dataFetch|status=failed|ms=${Date.now() - phase1Start}|error=${dataError.message}`);
      
      // 数据获取失败 → 直接降级
      console.warn(`⚠️  [Fallback Triggered] 数据获取失败，使用basicAnalysis`);
      diagnostics.fallback = true;
      diagnostics.fallbackReason = 'data_fetch_failed';
      
      return buildFallbackResponse(symbol, null, options.positionContext, diagnostics, startTime);
    }

    // ===== PHASE 2: 图表生成 (15s timeout) =====
    const chartURL = buildStockChartURL(symbol, { ...options, exchangeInfo });
    const phase2Start = Date.now();
    let screenshotResult = null;
    
    try {
      screenshotResult = await runWithTimeout('Phase2-Screenshot', async () => {
        return await retryHelper.execute(
          `captureScreenshot-${symbol}`,
          () => loadScreenshotProvider()({ tradingViewUrl: chartURL, symbol }),
          { timeout: TIMEOUTS.SCREENSHOT }
        );
      }, TIMEOUTS.SCREENSHOT);

      diagnostics.phases.screenshot = {
        status: 'success',
        duration: Date.now() - phase2Start,
        provider: screenshotResult.provider
      };
      
      console.log(`NFLX_DIAG|${symbol}|phase=screenshot|status=success|ms=${Date.now() - phase2Start}|provider=${screenshotResult.provider}`);
      
    } catch (screenshotError) {
      diagnostics.phases.screenshot = {
        status: 'failed',
        duration: Date.now() - phase2Start,
        error: screenshotError.message
      };
      
      console.error(`NFLX_DIAG|${symbol}|phase=screenshot|status=failed|ms=${Date.now() - phase2Start}|error=${screenshotError.message}`);
      
      // 截图失败 → 降级（仍有stockData）
      console.warn(`⚠️  [Fallback Triggered] 截图失败，使用basicAnalysis`);
      diagnostics.fallback = true;
      diagnostics.fallbackReason = 'screenshot_failed';
      
      return buildFallbackResponse(symbol, stockData, options.positionContext, diagnostics, startTime);
    }

    // ===== PHASE 3: Vision AI分析 (20s timeout) =====
    const phase3Start = Date.now();
    let chartAnalysis = null;
    let analysisMetadata = {};
    
    try {
      const visionResult = await runWithTimeout('Phase3-VisionAI', async () => {
        const VisionAnalyzerClass = loadVisionAnalyzer();
        const visionAnalyzer = new VisionAnalyzerClass();
        const marketContext = {
          symbol,
          currentPrice: stockData?.currentPrice || 'N/A',
          changePercent: stockData?.changePercent || 0,
          companyName: stockData?.name || symbol,
          exchange: stockData?.exchange || 'N/A',
          positionContext: options.positionContext || null
        };
        
        return await visionAnalyzer.analyzeStockChart(screenshotResult.buffer, marketContext);
      }, TIMEOUTS.VISION_AI);

      chartAnalysis = visionResult.rawAnalysis;
      analysisMetadata = {
        analysis_type: 'vision_technical',
        confidence: visionResult.confidence || 0.85,
        formatted: true
      };

      diagnostics.phases.visionAI = {
        status: 'success',
        duration: Date.now() - phase3Start,
        confidence: visionResult.confidence
      };
      
      console.log(`NFLX_DIAG|${symbol}|phase=visionAI|status=success|ms=${Date.now() - phase3Start}|confidence=${visionResult.confidence}`);
      
    } catch (visionError) {
      diagnostics.phases.visionAI = {
        status: 'failed',
        duration: Date.now() - phase3Start,
        error: visionError.message
      };
      
      console.error(`NFLX_DIAG|${symbol}|phase=visionAI|status=failed|ms=${Date.now() - phase3Start}|error=${visionError.message}`);
      
      // Vision失败 → 软降级（保留截图，使用基础分析补充）
      chartAnalysis = basicAnalysis(symbol, stockData, options.positionContext);
      analysisMetadata = {
        analysis_type: 'basic_fallback',
        error: visionError.message
      };
      
      console.warn(`⚠️  [Soft Fallback] Vision AI失败，使用basicAnalysis补充`);
    }

    // ===== 成功返回 =====
    diagnostics.totalDuration = Date.now() - startTime;
    
    console.log(`NFLX_SUMMARY|${symbol}|data=success|chart=success|vision=${diagnostics.phases.visionAI?.status || 'skipped'}|duration=${diagnostics.totalDuration}|fallback=${diagnostics.fallback}`);
    
    // 🚨 NFLX成功记录
    if (symbol === 'NFLX') {
      recordNFLXSuccess();
    }
    
    return {
      ok: true,
      success: true,
      symbol,
      buffer: screenshotResult.buffer,
      chartURL,
      stockData,
      chartAnalysis,
      provider: screenshotResult.provider,
      meta: {
        ...screenshotResult.meta,
        analysis: analysisMetadata,
        diagnostics
      },
      elapsed_ms: diagnostics.totalDuration
    };
    
  } catch (error) {
    diagnostics.totalDuration = Date.now() - startTime;
    console.error(`🔥 [Stock Chart Service Error] ${error.message}`);
    console.error(`NFLX_SUMMARY|${symbol}|data=${diagnostics.phases.dataFetch?.status || 'unknown'}|chart=${diagnostics.phases.screenshot?.status || 'unknown'}|vision=${diagnostics.phases.visionAI?.status || 'unknown'}|duration=${diagnostics.totalDuration}|fallback=${diagnostics.fallback}|error=${error.message}`);
    
    // 🚨 NFLX失败记录
    if (symbol === 'NFLX') {
      recordNFLXFailure();
    }
    
    throw error;
  }
}

/**
 * 🆕 v6.0: 构建降级响应
 * @private
 */
function buildFallbackResponse(symbol, stockData, positionContext, diagnostics, startTime) {
  const chartAnalysis = basicAnalysis(symbol, stockData, positionContext);
  diagnostics.totalDuration = Date.now() - startTime;
  
  console.log(`NFLX_SUMMARY|${symbol}|data=${diagnostics.phases.dataFetch?.status || 'failed'}|chart=skipped|vision=skipped|duration=${diagnostics.totalDuration}|fallback=basic`);
  
  // 🎯 v6.1修复：即使截图失败，也返回ok: true让数据驱动分析能继续执行
  return {
    ok: true,  // ✅ 关键修改：保持true让index.js继续调用generateDataDrivenStockAnalysis
    success: false,  // ⚠️ 标记为降级模式（无截图/Vision AI）
    symbol,
    buffer: null,
    chartURL: null,
    stockData,  // ✅ 包含实时数据，供技术分析使用
    chartAnalysis,  // 基础分析（fallback）
    provider: 'fallback',
    meta: {
      analysis: {
        analysis_type: 'basic_fallback',  // 标记为fallback模式
        reason: diagnostics.fallbackReason,
        note: 'stockData available for data-driven analysis'  // 提示数据可用
      },
      diagnostics
    },
    elapsed_ms: diagnostics.totalDuration
  };
}

/**
 * 🆕 v6.0: 基础分析函数（降级方案）
 * 当完整分析失败时，提供轻量级文本分析
 * 跳过截图和Vision AI，仅使用实时数据
 * 
 * @param {string} symbol - 股票代码
 * @param {Object} stockData - 市场数据
 * @param {Object} positionContext - 持仓信息
 * @returns {string} 基础分析文本
 */
function basicAnalysis(symbol, stockData, positionContext = null) {
  if (!stockData || !stockData.currentPrice) {
    return `【基础分析】${symbol}\n\n暂无实时数据，无法提供分析建议。请稍后重试。`;
  }

  const currentPrice = stockData.currentPrice;
  const changePercent = stockData.changePercent || 0;
  const trend = changePercent > 0 ? '上涨' : changePercent < 0 ? '下跌' : '持平';
  const trendEmoji = changePercent > 0 ? '📈' : changePercent < 0 ? '📉' : '➡️';

  let analysis = `【基础分析】${symbol}\n\n`;
  
  // 实时行情
  analysis += `【实时行情】\n`;
  analysis += `• 当前价格：$${currentPrice.toFixed(2)}\n`;
  analysis += `• 涨跌幅：${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%\n`;
  analysis += `• 趋势：${trend} ${trendEmoji}\n\n`;

  // 🆕 v3.2: 持仓分析
  if (positionContext && positionContext.buyPrice) {
    const buyPrice = positionContext.buyPrice;
    const profitLoss = currentPrice - buyPrice;
    const profitPercent = ((profitLoss / buyPrice) * 100).toFixed(2);
    const profitStatus = profitLoss > 0 ? '盈利' : profitLoss < 0 ? '亏损' : '持平';
    const profitEmoji = profitLoss > 0 ? '🟢' : profitLoss < 0 ? '🔴' : '⚪';

    analysis += `【持仓状态】${profitEmoji}\n`;
    analysis += `• 买入成本：$${buyPrice.toFixed(2)}\n`;
    analysis += `• 当前盈亏：${profitLoss >= 0 ? '+$' : '-$'}${Math.abs(profitLoss).toFixed(2)} (${profitPercent >= 0 ? '+' : ''}${profitPercent}%)\n`;
    analysis += `• 盈亏状态：${profitStatus}\n\n`;

    // 简单建议
    analysis += `【操作建议】\n`;
    if (profitLoss > buyPrice * 0.15) {
      analysis += `• 建议：考虑部分止盈（已盈利${profitPercent}%）\n`;
      analysis += `• 止盈位：$${(currentPrice * 1.05).toFixed(2)}（再涨5%）\n`;
    } else if (profitLoss < -buyPrice * 0.1) {
      analysis += `• 建议：评估止损（已亏损${Math.abs(profitPercent)}%）\n`;
      analysis += `• 止损位：$${(buyPrice * 0.95).toFixed(2)}（-5%）\n`;
    } else {
      analysis += `• 建议：继续持有，密切关注市场动态\n`;
    }
  } else {
    // 通用建议
    analysis += `【市场建议】\n`;
    if (changePercent > 3) {
      analysis += `• 短期：涨幅较大，注意回调风险\n`;
    } else if (changePercent < -3) {
      analysis += `• 短期：跌幅较大，可能存在反弹机会\n`;
    } else {
      analysis += `• 短期：走势平稳，建议观望\n`;
    }
  }

  // 移除旧的"未包含技术图表分析"警告 - 现在总是包含技术分析

  return analysis;
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
