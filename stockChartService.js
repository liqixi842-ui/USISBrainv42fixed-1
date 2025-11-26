// ====== 个股走势图服务 v6.0 - 深度可靠性增强版 ======
// 类似heatmapService，但专注于个股K线图分析
// 复用screenshotProviders三层截图系统
// 🆕 v6.0: 分阶段超时、结构化诊断日志、渐进式降级

// 🛡️ v6.1: 延迟加载Chromium依赖（防止启动时OOM - 节省600MB内存）
let _captureStockChartSmart = null;
let _VisionAnalyzer = null;

let _captureWithBrowserlessTv = null;

function loadScreenshotProvider() {
  if (!_captureStockChartSmart) {
    ({ captureStockChartSmart: _captureStockChartSmart } = require('./screenshotProviders'));
    console.log('🔄 [LazyLoad] screenshotProviders已加载');
  }
  return _captureStockChartSmart;
}

function loadBrowserlessProvider() {
  if (!_captureWithBrowserlessTv) {
    ({ captureWithBrowserlessTv: _captureWithBrowserlessTv } = require('./screenshotProviders'));
    console.log('🔄 [LazyLoad] Browserless provider已加载');
    const hasCookie = !!process.env.TRADINGVIEW_COOKIE;
    if (hasCookie) {
      console.log('📊 [StockChart] Browserless using TradingView Pro cookie (no ads)');
    } else {
      console.log('📊 [StockChart] Browserless now uses chart_embed mode');
    }
  }
  return _captureWithBrowserlessTv;
}

function loadVisionAnalyzer() {
  if (!_VisionAnalyzer) {
    _VisionAnalyzer = require('./visionAnalyzer');
    console.log('🔄 [LazyLoad] VisionAnalyzer已加载');
  }
  return _VisionAnalyzer;
}

const { fetchMarketData, fetchCompanyProfile, fetchComprehensiveAnalysis } = require('./dataBroker');
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
  // 🔧 v6.2: 西班牙交易所优先（关键修复）
  if (exchange.includes('BME') || exchange.includes('XMAD') || exchange.includes('MADRID') || exchange.includes('SPAIN')) return 'BME';
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
/**
 * 🔧 验证TradingView符号格式（ChatGPT建议）
 * @param {string} symbol - 符号字符串
 * @returns {boolean} 是否有效
 */
function validateTVSymbol(symbol) {
  // 格式：EXCHANGE:TICKER（如BME:COL, NASDAQ:AAPL, SSE:600519）
  const validPattern = /^[A-Z0-9]+:[A-Z0-9.\-]+$/;
  return validPattern.test(symbol);
}

function buildStockChartURL(symbol, options = {}) {
  const {
    interval = 'D',        // D=日线, 60=1小时, 15=15分钟
    theme = 'light',       // light/dark
    style = '1',           // 1=蜡烛图, 0=柱状图, 9=线图
    timezone = 'America/New_York',
    studies = 'BB@tv-basicstudies,MACD@tv-basicstudies', // 布林带+MACD
    locale = 'en',
    exchangeInfo = null,   // 🆕 智能分析师：使用API查询的真实交易所信息
    exchangePreference = null  // 🆕 v6.2: 交易所偏好（用于降级模式）
  } = options;
  
  // 标准化symbol格式
  let normalizedSymbol = symbol.toUpperCase();
  
  // 🆕 v7.0: 自动识别后缀格式并转换为 TradingView 前缀格式
  // .T → TSE (日本东京), .HK → HKEX (香港), .MC → BME (西班牙马德里)
  const SUFFIX_TO_PREFIX = {
    '.T': 'TSE',      // 日本东京证券交易所
    '.HK': 'HKEX',    // 香港交易所
    '.MC': 'BME',     // 西班牙马德里交易所
    '.PA': 'EURONEXT',// 法国巴黎交易所
    '.DE': 'XETRA',   // 德国法兰克福交易所
    '.L': 'LSE',      // 伦敦证券交易所
    '.MI': 'MIL',     // 意大利米兰交易所
    '.TO': 'TSX',     // 加拿大多伦多交易所
    '.SS': 'SSE',     // 上海证券交易所
    '.SZ': 'SZSE',    // 深圳证券交易所
    '.AX': 'ASX',     // 澳大利亚证券交易所
    '.KS': 'KRX',     // 韩国证券交易所
    '.TW': 'TWSE',    // 台湾证券交易所
  };
  
  // 检查并转换后缀格式
  for (const [suffix, prefix] of Object.entries(SUFFIX_TO_PREFIX)) {
    if (normalizedSymbol.endsWith(suffix)) {
      const ticker = normalizedSymbol.slice(0, -suffix.length);
      normalizedSymbol = `${prefix}:${ticker}`;
      console.log(`   🌍 [后缀转换] ${symbol} → ${normalizedSymbol} (${suffix} → ${prefix})`);
      break;
    }
  }
  
  // 如果没有交易所前缀，智能添加
  if (!normalizedSymbol.includes(':')) {
    if (exchangeInfo) {
      // 🧠 智能路径：根据API返回的真实交易所信息
      const tvExchange = mapExchangeToTradingView(exchangeInfo);
      normalizedSymbol = `${tvExchange}:${normalizedSymbol}`;
      console.log(`   🧠 [智能映射] ${symbol} → ${normalizedSymbol} (来源: Finnhub API)`);
    } else {
      // ⚠️ 降级路径：根据exchangePreference决定交易所
      let fallbackExchange = 'NASDAQ';  // 默认美股
      let downgradeDisabled = false;
      
      // 🆕 v6.2: 检查exchangePreference，禁止美股降级（如果明确指定了其他地区）
      if (exchangePreference) {
        // 🔧 Normalize: 提取关键词（处理 "Spain/BME", "BME:COL", "XMAD" 等格式）
        const normalized = exchangePreference.toUpperCase().trim();
        const tokens = normalized.split(/[\/:\s,]+/);  // 分割: "Spain/BME" → ["SPAIN", "BME"]
        const pref = normalized.toLowerCase();
        
        // 检查tokens中是否包含关键词
        const hasToken = (keywords) => tokens.some(t => keywords.includes(t.toLowerCase()));
        
        // 西班牙交易所
        if (hasToken(['spain', 'es', 'españa', 'bme', 'xmad', 'madrid'])) {
          fallbackExchange = 'BME';
          downgradeDisabled = true;
          console.log(`🎯 [Symbol Policy] region=ES, downgradeDisabled=true, input=${symbol}, hint=${exchangePreference}`);
        }
        // 加拿大交易所
        else if (hasToken(['canada', 'ca', 'tsx', 'tsxv'])) {
          fallbackExchange = 'TSX';
          downgradeDisabled = true;
          console.log(`🎯 [Symbol Policy] region=CA, downgradeDisabled=true, input=${symbol}, hint=${exchangePreference}`);
        }
        // 香港交易所（使用后缀格式）
        else if (hasToken(['hk', 'hong', 'kong', 'hkex', 'hongkong'])) {
          // 香港股票使用后缀格式（如0700.HK），不添加前缀
          normalizedSymbol = `${normalizedSymbol}.HK`;
          console.log(`🎯 [Symbol Policy] region=HK, using suffix format, input=${symbol}`);
          console.log(`   ⚠️  [降级模式] ${symbol} → ${normalizedSymbol} (未查询API)`);
          console.log(`📊 [final_symbol_for_tv] "${normalizedSymbol}" → TradingView`);
          
          const params = new URLSearchParams({
            symbol: normalizedSymbol,
            interval: interval,
            theme: theme,
            style: style,
            timezone: timezone,
            locale: locale
          });
          if (studies) params.append('studies', studies);
          return `https://www.tradingview.com/chart/?${params.toString()}`;
        }
        // 中国交易所（使用后缀格式）
        else if (hasToken(['cn', 'china', 'shanghai', 'shenzhen', 'sse', 'szse'])) {
          // 中国A股使用后缀格式（如600519.SS），暂时默认上海
          normalizedSymbol = `${normalizedSymbol}.SS`;
          console.log(`🎯 [Symbol Policy] region=CN, using suffix format, input=${symbol}`);
          console.log(`   ⚠️  [降级模式] ${symbol} → ${normalizedSymbol} (未查询API)`);
          console.log(`📊 [final_symbol_for_tv] "${normalizedSymbol}" → TradingView`);
          
          const params = new URLSearchParams({
            symbol: normalizedSymbol,
            interval: interval,
            theme: theme,
            style: style,
            timezone: timezone,
            locale: locale
          });
          if (studies) params.append('studies', studies);
          return `https://www.tradingview.com/chart/?${params.toString()}`;
        }
        // 美国（明确允许）
        else if (hasToken(['us', 'usa', 'united', 'states', 'nasdaq', 'nyse'])) {
          fallbackExchange = 'NASDAQ';
          // 美国是默认值，不设置downgradeDisabled
        }
      }
      
      normalizedSymbol = `${fallbackExchange}:${normalizedSymbol}`;
      console.log(`   ⚠️  [降级模式] ${symbol} → ${normalizedSymbol} (未查询API)`);
    }
  }
  
  // 🔧 ChatGPT建议：输出前强校验
  if (!validateTVSymbol(normalizedSymbol)) {
    console.error(`❌ [Symbol Validation] 符号格式无效: "${normalizedSymbol}"`);
    console.error(`   期望格式: EXCHANGE:TICKER (如 BME:COL, NASDAQ:AAPL)`);
    throw new Error(`Invalid TradingView symbol format: ${normalizedSymbol}`);
  }
  
  // 📊 ChatGPT建议：记录final_symbol_for_tv
  console.log(`📊 [final_symbol_for_tv] "${normalizedSymbol}" → TradingView`);
  
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
      // 🆕 优先使用Browserless（自动关闭TradingView弹窗）
      console.log(`📸 [StockChart] 优先尝试Browserless截图`);
      
      try {
        const tvSymbol = chartURL.match(/symbol=([^&]+)/)?.[1] || symbol;
        const browserlessCapture = loadBrowserlessProvider();
        screenshotResult = await runWithTimeout('Phase2-Browserless', async () => {
          return await browserlessCapture(decodeURIComponent(tvSymbol));
        }, TIMEOUTS.SCREENSHOT);
        
        console.log(`✅ [StockChart] Browserless截图成功`);
        
      } catch (browserlessError) {
        console.error(`❌ [StockChart] Browserless失败: ${browserlessError.message}`);
        console.log(`🔄 [StockChart] 降级到N8N ScreenshotAPI`);
        
        // Fallback到N8N ScreenshotAPI
        screenshotResult = await runWithTimeout('Phase2-Screenshot', async () => {
          return await retryHelper.execute(
            `captureScreenshot-${symbol}`,
            () => loadScreenshotProvider()({ tradingViewUrl: chartURL, symbol }),
            { timeout: TIMEOUTS.SCREENSHOT }
          );
        }, TIMEOUTS.SCREENSHOT);
      }

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
async function buildFallbackResponse(symbol, stockData, positionContext, diagnostics, startTime) {
  console.log(`🔄 [Fallback] 使用Twelve Data深度分析替代截图模式`);
  
  // 🛡️ 安全检查：如果没有基础数据，跳过Twelve Data调用
  if (!stockData || !stockData.currentPrice) {
    console.log(`⚠️ [Fallback] 缺少基础数据，跳过Twelve Data，返回基础分析`);
    diagnostics.totalDuration = Date.now() - startTime;
    
    return {
      ok: true,
      success: false,
      symbol,
      buffer: null,
      chartURL: null,
      stockData: null,
      chartAnalysis: basicAnalysis(symbol, null, positionContext),
      provider: 'fallback',
      meta: {
        analysis: { analysis_type: 'basic_fallback', reason: 'no_stock_data' },
        diagnostics
      },
      elapsed_ms: diagnostics.totalDuration
    };
  }
  
  // 🆕 v6.2: 调用Twelve Data综合分析（技术指标 + 基本面 + 分析师评级）
  // 🛡️ 超时保护：15秒超时（避免延迟过长）
  let comprehensiveData = null;
  try {
    comprehensiveData = await runWithTimeout(
      'fetchComprehensiveAnalysis',
      () => fetchComprehensiveAnalysis(symbol),
      { timeout: 15000 } // 15秒超时
    );
    console.log(`✅ [Fallback] Twelve Data综合分析已获取`);
  } catch (error) {
    console.log(`⚠️ [Fallback] Twelve Data获取失败，降级到基础分析: ${error.message}`);
  }
  
  // 生成分析文本（带错误保护）
  let chartAnalysis;
  if (comprehensiveData) {
    try {
      chartAnalysis = await buildEnhancedAnalysis(symbol, stockData, positionContext, comprehensiveData);
    } catch (aiError) {
      console.error(`❌ [Fallback] AI分析失败，降级到基础分析: ${aiError.message}`);
      chartAnalysis = basicAnalysis(symbol, stockData, positionContext);
      comprehensiveData = null; // 标记为未使用
    }
  } else {
    chartAnalysis = basicAnalysis(symbol, stockData, positionContext);
  }
  
  diagnostics.totalDuration = Date.now() - startTime;
  
  console.log(`NFLX_SUMMARY|${symbol}|data=${diagnostics.phases.dataFetch?.status || 'failed'}|chart=skipped|vision=skipped|duration=${diagnostics.totalDuration}|fallback=${comprehensiveData ? 'twelve_data' : 'basic'}`);
  
  // 🎯 v6.1修复：即使截图失败，也返回ok: true让数据驱动分析能继续执行
  return {
    ok: true,  // ✅ 关键修改：保持true让index.js继续调用generateDataDrivenStockAnalysis
    success: false,  // ⚠️ 标记为降级模式（无截图/Vision AI）
    symbol,
    buffer: null,
    chartURL: null,
    stockData,  // ✅ 包含实时数据，供技术分析使用
    chartAnalysis,  // 增强分析（Twelve Data）或基础分析（fallback）
    comprehensiveData,  // 🆕 v6.2: 传递综合数据供后续AI分析使用
    provider: comprehensiveData ? 'twelve_data_fallback' : 'fallback',
    meta: {
      analysis: {
        analysis_type: comprehensiveData ? 'twelve_data_enhanced' : 'basic_fallback',
        reason: diagnostics.fallbackReason,
        note: comprehensiveData ? 'Twelve Data comprehensive analysis available' : 'stockData available for data-driven analysis'
      },
      diagnostics
    },
    elapsed_ms: diagnostics.totalDuration
  };
}

/**
 * 🆕 v6.2: 增强分析函数（使用Twelve Data综合数据）
 * @param {string} symbol - 股票代码
 * @param {Object} stockData - 市场数据
 * @param {Object} positionContext - 持仓信息
 * @param {Object} comprehensiveData - Twelve Data综合分析数据
 * @returns {Promise<string>} 增强分析文本
 */
async function buildEnhancedAnalysis(symbol, stockData, positionContext, comprehensiveData) {
  const { generateWithGPT5 } = require('./gpt5Brain');
  
  console.log(`📊 [Enhanced Analysis] 使用Twelve Data生成深度分析`);
  
  // 构建数据包（兼容gpt5Brain的格式）
  const dataPackage = {
    symbol,
    quote: stockData,
    profile: comprehensiveData.profile || null,
    metrics: comprehensiveData.statistics || null,
    news: [], // Fallback模式下跳过新闻
    technical_indicators: comprehensiveData.technical_indicators || null,
    fundamentals: comprehensiveData.fundamentals || null,
    analyst_ratings: comprehensiveData.analyst_ratings || null
  };
  
  // 构建上下文
  const context = {
    userText: positionContext ? `我持有${symbol}，买入成本$${positionContext.buyPrice}` : `分析${symbol}`,
    positionContext: positionContext || null,
    language: 'zh' // 默认中文
  };
  
  try {
    // 调用GPT-5 Brain生成机构级分析（无截图模式）
    const aiAnalysis = await generateWithGPT5(dataPackage, null, context);
    return aiAnalysis;
  } catch (aiError) {
    console.error(`❌ [Enhanced Analysis] AI生成失败: ${aiError.message}`);
    // 降级到基础分析
    return basicAnalysis(symbol, stockData, positionContext);
  }
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
