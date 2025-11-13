// ====== Data Broker with Anti-Hallucination Mechanism ======
// 数据代理：中心化API调用，强制数据来源追踪，防止AI编造数据
// v4.2: 并行数据获取 + 软超时 + 缓存

const fetch = require("node-fetch");

const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const TWELVE_DATA_KEY = process.env.TWELVE_DATA_API_KEY;

// 🆕 v4.2: 软超时配置（环境变量可控）
const SLOW_SOURCE_TIMEOUT = parseInt(process.env.SLOW_SOURCE_TIMEOUT_MS) || 7000;

// 🆕 v4.2: 简单内存缓存（后续可升级为Redis）
const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 120; // 默认120秒
const dataCache = new Map();

// 🔒 Provider能力缓存（避免重复尝试已知受限的provider）
const providerCapabilityCache = {
  twelvedata_tier_limited: false // Twelve Data免费版受限标记
};

/**
 * 🆕 v4.2: 缓存辅助函数
 */
function getCacheKey(type, ...params) {
  return `${type}:${params.join(':')}`;
}

function getFromCache(key) {
  const cached = dataCache.get(key);
  if (!cached) return null;
  
  const age = (Date.now() - cached.timestamp) / 1000;
  if (age > CACHE_TTL) {
    dataCache.delete(key);
    return null;
  }
  
  return cached.data;
}

function setCache(key, data) {
  dataCache.set(key, {
    data,
    timestamp: Date.now()
  });
}

/**
 * 🆕 v4.2: Promise超时包装器（软超时，仍返回部分数据）
 */
async function withSoftTimeout(promise, timeoutMs, fallbackValue, sourceName) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => {
        console.warn(`⏱️  [Data Broker] ${sourceName} 超时(${timeoutMs}ms)，使用降级数据`);
        resolve(fallbackValue);
      }, timeoutMs);
    })
  ]);
}

/**
 * 数据代理 - 获取市场数据并附加来源元数据
 * @param {Array<string>} symbols - 股票代码列表
 * @param {Array<string>} dataTypes - 需要的数据类型 ['quote', 'news', 'fundamentals']
 * @returns {Promise<Object>} - 带来源元数据的市场数据
 */
async function fetchMarketData(symbols = [], dataTypes = ['quote']) {
  console.log(`\n📊 [Data Broker v4.2] 开始获取市场数据（并行模式）`);
  console.log(`   - 符号: [${symbols.join(', ')}]`);
  console.log(`   - 数据类型: [${dataTypes.join(', ')}]`);
  
  const startTime = Date.now();
  const timings = {}; // 🆕 记录各数据源耗时
  
  const marketData = {
    collected: false,
    quotes: {},
    news: [],
    fundamentals: {},
    metadata: {
      requestId: generateRequestId(),
      timestamp: Date.now(),
      dataSources: [],
      dataQuality: {},
      complete: true,
      missingFields: [],
      cache_hits: 0, // 🆕 缓存命中数
      cache_total: 0  // 🆕 缓存查询总数
    }
  };
  
  try {
    // 🆕 v4.2: 并行获取所有数据源（quotes + news + 其他）
    const fetchTasks = [];
    
    // 1. 报价数据任务
    if (dataTypes.includes('quote') && symbols.length > 0) {
      const quoteTask = (async () => {
        const t0 = Date.now();
        const quoteResults = await fetchQuotes(symbols);
        timings.quotes = Date.now() - t0;
        return { type: 'quotes', data: quoteResults };
      })();
      
      fetchTasks.push(
        withSoftTimeout(
          quoteTask,
          SLOW_SOURCE_TIMEOUT,
          { type: 'quotes', data: { quotes: {}, sources: [] } },
          'Quotes'
        )
      );
    }
    
    // 2. 新闻数据任务
    if (dataTypes.includes('news') && symbols.length > 0) {
      const newsTask = (async () => {
        const t0 = Date.now();
        const newsResults = await fetchNews(symbols[0]);
        timings.news = Date.now() - t0;
        return { type: 'news', data: newsResults };
      })();
      
      fetchTasks.push(
        withSoftTimeout(
          newsTask,
          SLOW_SOURCE_TIMEOUT,
          { type: 'news', data: { news: [], sources: [] } },
          'News'
        )
      );
    }
    
    // 🆕 并行执行所有任务
    const results = await Promise.all(fetchTasks);
    
    // 🆕 整合结果
    for (const result of results) {
      if (result.type === 'quotes') {
        marketData.quotes = result.data.quotes;
        marketData.metadata.dataSources.push(...result.data.sources);
        
        // 🆕 聚合缓存统计
        if (result.data.cacheHits !== undefined) {
          marketData.metadata.cache_hits += result.data.cacheHits;
          marketData.metadata.cache_total += result.data.cacheTotal;
        }
        
        // 检查数据完整性
        const missingQuotes = symbols.filter(s => !marketData.quotes[s]);
        if (missingQuotes.length > 0) {
          marketData.metadata.complete = false;
          marketData.metadata.missingFields.push(...missingQuotes.map(s => `quote:${s}`));
        }
      } else if (result.type === 'news') {
        marketData.news = result.data.news;
        marketData.metadata.dataSources.push(...result.data.sources);
        
        // 🆕 聚合缓存统计
        if (result.data.cacheHits !== undefined) {
          marketData.metadata.cache_hits += result.data.cacheHits;
          marketData.metadata.cache_total += result.data.cacheTotal;
        }
      }
    }
    
    // 3. 数据质量评估
    marketData.metadata.dataQuality = assessDataQuality(marketData);
    
    // 4. 生成数据摘要（用于AI快速理解）
    marketData.summary = generateDataSummary(marketData, symbols);
    
    // 5. 标记数据采集成功
    marketData.collected = Object.keys(marketData.quotes).length > 0;
    
    const elapsedTime = Date.now() - startTime;
    marketData.metadata.timings = timings; // 🆕 附加timing信息
    
    console.log(`✅ [Data Broker v4.2] 数据采集完成 (${elapsedTime}ms)`);
    console.log(`   - 成功: ${marketData.collected}`);
    console.log(`   - 报价数: ${Object.keys(marketData.quotes).length}/${symbols.length}`);
    console.log(`   - 数据质量: ${marketData.metadata.dataQuality.overallScore.toFixed(2)}`);
    console.log(`   - 并行耗时: ${JSON.stringify(timings)}`);
    console.log(`   - 缓存命中: ${marketData.metadata.cache_hits}/${marketData.metadata.cache_total}`);
    
    return marketData;
    
  } catch (error) {
    console.error(`❌ [Data Broker] 数据采集失败:`, error.message);
    
    marketData.collected = false;
    marketData.metadata.complete = false;
    marketData.metadata.error = error.message;
    
    return marketData;
  }
}

/**
 * 🆕 v4.2: 获取股票报价（并行模式 + 缓存）
 */
async function fetchQuotes(symbols) {
  const quotes = {};
  const sources = [];
  let cacheHits = 0;
  
  // 🆕 并行获取所有符号的报价
  const quotePromises = symbols.map(async (symbol) => {
    try {
      // 🆕 先查缓存
      const cacheKey = getCacheKey('quote', symbol);
      const cached = getFromCache(cacheKey);
      
      if (cached) {
        console.log(`   💾 [Cache Hit] ${symbol} 报价命中缓存`);
        cacheHits++;
        return { symbol, ...cached };
      }
      
      // 缓存未命中，从API获取
      const quoteData = await fetchSingleQuote(symbol);
      
      if (quoteData && quoteData.quote) {
        // 🆕 存入缓存
        setCache(cacheKey, {
          quote: quoteData.quote,
          source: quoteData.source
        });
        
        return { symbol, quote: quoteData.quote, source: quoteData.source };
      }
      
      return { symbol, quote: null, source: quoteData?.source };
      
    } catch (error) {
      console.error(`   ⚠️  获取${symbol}报价失败:`, error.message);
      return { symbol, quote: null, source: null };
    }
  });
  
  // 🆕 等待所有报价并行完成
  const results = await Promise.all(quotePromises);
  
  // 整合结果
  for (const result of results) {
    if (result.quote) {
      quotes[result.symbol] = result.quote;
    }
    if (result.source) {
      sources.push(result.source);
    }
  }
  
  console.log(`   📈 报价获取完成: ${Object.keys(quotes).length}/${symbols.length} (缓存命中: ${cacheHits})`);
  
  return { quotes, sources, cacheHits, cacheTotal: symbols.length };
}

/**
 * 🌍 从Twelve Data获取实时股价（全球股票支持：欧洲、加拿大、亚洲）
 * @param {string} symbol - 纯股票代码（如SAB、RY）
 * @param {string} exchange - 交易所代码（如BME、TSX），可选
 */
async function fetchQuoteFromTwelveData(symbol, exchange = null) {
  if (!TWELVE_DATA_KEY) {
    throw new Error("TWELVE_DATA_API_KEY not configured");
  }
  
  // 构建URL（使用exchange参数而非后缀格式）
  let url = `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${TWELVE_DATA_KEY}`;
  if (exchange) {
    url += `&exchange=${exchange}`;
  }
  
  const fetchTime = Date.now();
  
  try {
    const response = await fetch(url, { timeout: 10000 });
    
    // ⚠️ 始终解析JSON body，即使HTTP状态码非200（Twelve Data付费限制返回403/401 JSON）
    const data = await response.json();
    
    // 🔒 优先检查付费计划限制（Twelve Data实际返回403/401或404）
    const isTierLimited = (
      (data.status === 'error') &&
      (data.code === 404 || data.code === 403 || data.code === 401 || response.status === 403 || response.status === 401) &&
      data.message && (
        data.message.includes('Pro plan') ||
        data.message.includes('Grow plan') ||
        data.message.toLowerCase().includes('paid account') ||
        data.message.toLowerCase().includes('upgrade') ||
        data.message.toLowerCase().includes('available starting')
      )
    );
    
    if (isTierLimited) {
      // 🔒 返回特殊标记，而非抛出异常（让调用方设置能力缓存）
      console.warn(`   🔒 [Tier Limit] Twelve Data限制检测: ${data.message}`);
      const source = {
        provider: 'twelvedata',
        endpoint: '/quote',
        symbol: symbol,
        timestamp: fetchTime,
        status: 'tier_limited',
        error: data.message
      };
      return { quote: null, source, tierLimited: true };
    }
    
    // 检查HTTP错误（排除已处理的tier限制）
    if (!response.ok) {
      throw new Error(`Twelve Data API error: ${response.status} - ${data.message || 'Unknown error'}`);
    }
    
    // 检查其他错误响应
    if (data.status === 'error' || data.code === 400) {
      throw new Error(data.message || 'Symbol not found in Twelve Data');
    }
    
    // 验证数据有效性
    if (!data.close || !data.symbol) {
      throw new Error(`No quote data from Twelve Data for ${symbol}`);
    }
    
    const currentPrice = parseFloat(data.close);
    const change = parseFloat(data.change);
    const changePercent = parseFloat(data.percent_change);
    const previousClose = parseFloat(data.previous_close);
    const high = parseFloat(data.high);
    const low = parseFloat(data.low);
    const open = parseFloat(data.open);
    
    const quote = {
      symbol: symbol,
      currentPrice: currentPrice,
      change: change,
      changePercent: changePercent,
      high: high,
      low: low,
      open: open,
      previousClose: previousClose,
      timestamp: Date.now(),
      source: 'twelvedata',
      freshnessScore: 1.0,
      dataAgeMinutes: 0
    };
    
    const source = {
      provider: 'twelvedata',
      endpoint: '/quote',
      symbol: symbol,
      timestamp: fetchTime,
      freshnessMinutes: 0,
      status: 'success'
    };
    
    return { quote, source };
    
  } catch (error) {
    console.error(`   ❌ Twelve Data quote失败 (${symbol}):`, error.message);
    
    const source = {
      provider: 'twelvedata',
      endpoint: '/quote',
      symbol: symbol,
      timestamp: fetchTime,
      status: 'failed',
      error: error.message
    };
    
    return { quote: null, source };
  }
}

/**
 * 🆕 从Alpha Vantage获取实时股价（备用数据源）
 */
async function fetchQuoteFromAlphaVantage(symbol) {
  if (!ALPHA_VANTAGE_KEY) {
    throw new Error("ALPHA_VANTAGE_API_KEY not configured");
  }
  
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`;
  const fetchTime = Date.now();
  
  try {
    const response = await fetch(url, { timeout: 10000 });
    
    if (!response.ok) {
      throw new Error(`Alpha Vantage API error: ${response.status}`);
    }
    
    const data = await response.json();
    const globalQuote = data['Global Quote'];
    
    if (!globalQuote || !globalQuote['05. price']) {
      throw new Error(`No quote data from Alpha Vantage for ${symbol}`);
    }
    
    const currentPrice = parseFloat(globalQuote['05. price']);
    const change = parseFloat(globalQuote['09. change']);
    const changePercent = parseFloat(globalQuote['10. change percent'].replace('%', ''));
    const previousClose = parseFloat(globalQuote['08. previous close']);
    const high = parseFloat(globalQuote['03. high']);
    const low = parseFloat(globalQuote['04. low']);
    const open = parseFloat(globalQuote['02. open']);
    
    const quote = {
      symbol: symbol,
      currentPrice: currentPrice,
      change: change,
      changePercent: changePercent,
      high: high,
      low: low,
      open: open,
      previousClose: previousClose,
      timestamp: Date.now(),
      source: 'alphavantage',
      freshnessScore: 1.0,
      dataAgeMinutes: 0
    };
    
    const source = {
      provider: 'alphavantage',
      endpoint: '/GLOBAL_QUOTE',
      symbol: symbol,
      timestamp: fetchTime,
      freshnessMinutes: 0,
      status: 'success'
    };
    
    return { quote, source };
    
  } catch (error) {
    console.error(`   ❌ Alpha Vantage quote失败 (${symbol}):`, error.message);
    
    const source = {
      provider: 'alphavantage',
      endpoint: '/GLOBAL_QUOTE',
      symbol: symbol,
      timestamp: fetchTime,
      status: 'failed',
      error: error.message
    };
    
    return { quote: null, source };
  }
}

/**
 * 🌐 符号格式转换：为不同API provider准备正确的符号格式
 * @returns {Object} - { symbol: string, exchange?: string }
 */
function convertSymbolForProvider(symbol, provider) {
  // Twelve Data专用格式转换（使用exchange参数，不用后缀）
  if (provider === 'twelvedata') {
    // 处理冒号格式（BME:SAB）
    if (symbol.includes(':')) {
      const [exchange, ticker] = symbol.split(':');
      
      // 🌍 Twelve Data交易所代码映射
      const EXCHANGE_MAP = {
        // 欧洲主要交易所
        'BME': 'BME',      // 马德里证券交易所
        'EPA': 'Euronext', // 巴黎泛欧交易所
        'LSE': 'LSE',      // 伦敦证券交易所
        'FRA': 'FSX',      // 法兰克福证券交易所
        'XETRA': 'XETRA',  // 德国XETRA
        'MIL': 'MTA',      // 米兰证券交易所
        'AMS': 'Euronext', // 阿姆斯特丹泛欧交易所
        
        // 北美交易所
        'TSX': 'TSX',      // 多伦多证券交易所
        'TSXV': 'TSXV',    // 多伦多创业板
        'NYSE': 'NYSE',    // 纽约证券交易所
        'NASDAQ': 'NASDAQ',// 纳斯达克
        
        // 亚太交易所
        'HKEX': 'HKEX',    // 香港交易所
        'TSE': 'TSE',      // 东京证券交易所
        'ASX': 'ASX'       // 澳大利亚证券交易所
      };
      
      const mappedExchange = EXCHANGE_MAP[exchange];
      if (mappedExchange) {
        return { symbol: ticker, exchange: mappedExchange };
      }
      
      console.warn(`   ⚠️  [Twelve Data Convert] 未知交易所代码: ${exchange}，使用纯ticker`);
      return { symbol: ticker };
    }
    
    // 🔧 处理点后缀格式（SAB.MC, RY.TO, BP.L）
    if (symbol.includes('.')) {
      const [ticker, suffix] = symbol.split('.');
      
      // ⚠️ 检测美国股票类别后缀（BRK.B, BRK.A, PR.X等），直接保留原样
      const US_SHARE_CLASS_PATTERN = /^[A-Z]$|^PR$/; // 单字母或PR
      if (US_SHARE_CLASS_PATTERN.test(suffix)) {
        console.log(`   🇺🇸 [Twelve Data Convert] 检测到美国股票类别: ${symbol}，保持原样`);
        return { symbol }; // 不拆分，直接返回
      }
      
      // 后缀到Twelve Data交易所的映射
      const SUFFIX_TO_EXCHANGE = {
        // 欧洲
        'MC': 'BME',       // 马德里 → .MC
        'PA': 'Euronext',  // 巴黎 → .PA
        'L': 'LSE',        // 伦敦 → .L
        'F': 'FSX',        // 法兰克福 → .F
        'DE': 'XETRA',     // XETRA → .DE
        'MI': 'MTA',       // 米兰 → .MI
        'AS': 'Euronext',  // 阿姆斯特丹 → .AS
        
        // 北美
        'TO': 'TSX',       // 多伦多 → .TO
        'V': 'TSXV',       // 多伦多创业板 → .V
        
        // 亚太
        'HK': 'HKEX',      // 香港 → .HK
        'T': 'TSE',        // 东京 → .T
        'AX': 'ASX'        // 澳大利亚 → .AX
      };
      
      const mappedExchange = SUFFIX_TO_EXCHANGE[suffix];
      if (mappedExchange) {
        return { symbol: ticker, exchange: mappedExchange };
      }
      
      // 未知后缀，保留原样（可能是其他类型的股票代码）
      console.warn(`   ⚠️  [Twelve Data Convert] 未知后缀: ${suffix}，保持原样: ${symbol}`);
      return { symbol };
    }
    
    // 无前缀/后缀，直接返回（美国主板股票）
    return { symbol };
  }
  
  // Alpha Vantage专用格式转换
  if (provider === 'alphavantage') {
    // 如果有交易所前缀（BME:GRF），转换为Alpha Vantage格式
    if (symbol.includes(':')) {
      const [exchange, ticker] = symbol.split(':');
      
      // 🔧 交易所代码到Alpha Vantage后缀的映射
      // 使用resolveSymbols的标准化格式（EPA, LSE等）
      const EXCHANGE_TO_SUFFIX = {
        // 欧洲主要交易所
        'BME': 'MC',      // 马德里证券交易所 → .MC
        'EPA': 'PA',      // 巴黎泛欧交易所 → .PA
        'LSE': 'L',       // 伦敦证券交易所 → .L
        'FRA': 'F',       // 法兰克福证券交易所 → .F
        'XETRA': 'DE',    // 德国XETRA → .DE
        'MIL': 'MI',      // 米兰证券交易所 → .MI
        'AMS': 'AS',      // 阿姆斯特丹泛欧交易所 → .AS
        'SIX': 'SW',      // 瑞士证券交易所 → .SW
        'BRU': 'BR',      // 布鲁塞尔泛欧交易所 → .BR
        'VIE': 'VI',      // 维也纳证券交易所 → .VI
        
        // 亚太交易所
        'HKEX': 'HK',     // 香港交易所 → .HK
        'SSE': 'SS',      // 上海证券交易所 → .SS
        'SZSE': 'SZ',     // 深圳证券交易所 → .SZ
        'TSE': 'T',       // 东京证券交易所 → .T
        'JPX': 'T',       // 日本交易所集团 → .T
        'JP': 'T',        // 日本（通用代码）→ .T
        'SGX': 'SI',      // 新加坡交易所 → .SI
        'KRX': 'KS',      // 韩国交易所 → .KS
        'KS': 'KS',       // 韩国（通用代码）→ .KS
        'ASX': 'AX',      // 澳大利亚证券交易所 → .AX
        'BSE': 'BO',      // 孟买证券交易所 → .BO
        'NSE': 'NS',      // 印度国家证券交易所 → .NS
        'TWO': 'TWO',     // 台湾柜买中心 → .TWO
        'TWSE': 'TW',     // 台湾证券交易所 → .TW
        
        // 北美交易所
        'TSX': 'TO',      // 多伦多证券交易所 → .TO
        'TSXV': 'V',      // 多伦多创业板 → .V
        'NYSE': '',       // 纽约证券交易所（无后缀）
        'NASDAQ': '',     // 纳斯达克（无后缀）
        'OTC': '',        // 美国场外交易（无后缀或.O/.PK）
        'OTCQB': '',      // OTC QB市场
        'OTCQX': ''       // OTC QX市场
      };
      
      const suffix = EXCHANGE_TO_SUFFIX[exchange];
      if (suffix !== undefined) {
        // suffix为空字符串时（NYSE, NASDAQ），直接返回ticker
        return suffix ? `${ticker}.${suffix}` : ticker;
      }
      
      // 未知交易所，记录警告并返回纯ticker
      console.warn(`   ⚠️  [Symbol Convert] 未知交易所代码: ${exchange}，使用纯ticker: ${ticker}`);
      return ticker;
    }
    
    // 无前缀，直接返回（美国主板股票或已有后缀的符号）
    return symbol;
  }
  
  // Finnhub使用原始符号（保持交易所前缀）
  return symbol;
}

/**
 * 获取单个股票报价（智能3层降级：Finnhub → Twelve Data → Alpha Vantage）
 */
async function fetchSingleQuote(symbol) {
  let quote = null;
  let source = null;
  
  console.log(`   🔍 [Symbol Resolution] 原始符号: ${symbol}`);
  
  // 策略1: 优先使用Finnhub（美国主板股票）
  if (FINNHUB_KEY) {
    const finnhubSymbol = convertSymbolForProvider(symbol, 'finnhub');
    console.log(`   📊 [Finnhub] 使用符号: ${finnhubSymbol}`);
    
    const url = `https://finnhub.io/api/v1/quote?symbol=${finnhubSymbol}&token=${FINNHUB_KEY}`;
    const fetchTime = Date.now();
    
    try {
      const response = await fetch(url, { timeout: 10000 });
      
      if (!response.ok) {
        throw new Error(`Finnhub API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // 🔧 修复：c===0 视为硬失败（Finnhub不支持），触发降级
      if (data.c && data.c !== 0) {
        // 计算新鲜度评分（基于时间戳）
        const dataAge = Date.now() - (data.t * 1000);
        const freshnessScore = calculateFreshnessScore(dataAge);
        
        quote = {
          symbol: symbol,
          currentPrice: data.c,
          change: data.d,
          changePercent: data.dp,
          high: data.h,
          low: data.l,
          open: data.o,
          previousClose: data.pc,
          timestamp: data.t * 1000,
          source: 'finnhub',
          freshnessScore: freshnessScore,
          dataAgeMinutes: Math.floor(dataAge / 60000)
        };
        
        source = {
          provider: 'finnhub',
          endpoint: '/quote',
          symbol: symbol,
          timestamp: fetchTime,
          freshnessMinutes: Math.floor(dataAge / 60000),
          status: 'success'
        };
        
        return { quote, source };
      } else {
        // ⚠️ Finnhub返回c=0（不支持该股票），显式触发降级
        throw new Error(`Finnhub不支持${finnhubSymbol}（返回c=0，可能是欧洲/加拿大/OTC股票）`);
      }
      
    } catch (error) {
      console.warn(`   ⚠️  Finnhub失败，尝试Twelve Data降级: ${error.message}`);
    }
  }
  
  // 策略2: 降级到Twelve Data（欧洲、加拿大、全球股票）
  // 🔒 如果已知免费版受限，跳过Twelve Data直接尝试Alpha Vantage
  if (TWELVE_DATA_KEY && !quote && !providerCapabilityCache.twelvedata_tier_limited) {
    const { symbol: twelveSymbol, exchange } = convertSymbolForProvider(symbol, 'twelvedata');
    console.log(`   🌍 [降级] Twelve Data使用符号: ${twelveSymbol}${exchange ? ` (exchange: ${exchange})` : ''}`);
    
    try {
      const twelveResult = await fetchQuoteFromTwelveData(twelveSymbol, exchange);
      
      // 🔒 检测到tier限制，设置全局标记并继续降级
      if (twelveResult.tierLimited) {
        console.warn(`   🔒 [Capability Cache] Twelve Data免费版受限，后续请求将跳过`);
        providerCapabilityCache.twelvedata_tier_limited = true;
        // 不返回，继续尝试Alpha Vantage
      } else if (twelveResult.quote) {
        twelveResult.quote.symbol = symbol;
        return twelveResult;
      }
    } catch (error) {
      console.error(`   ❌ Twelve Data降级失败:`, error.message);
    }
  } else if (providerCapabilityCache.twelvedata_tier_limited) {
    console.log(`   ⏭️  [Skip] Twelve Data已知受限，直接尝试Alpha Vantage`);
  }
  
  // 策略3: 降级到Alpha Vantage（加拿大、部分全球股票）
  if (ALPHA_VANTAGE_KEY && !quote) {
    const alphaSymbol = convertSymbolForProvider(symbol, 'alphavantage');
    console.log(`   🔄 [降级] Alpha Vantage使用符号: ${alphaSymbol}`);
    
    try {
      const alphaResult = await fetchQuoteFromAlphaVantage(alphaSymbol);
      if (alphaResult.quote) {
        alphaResult.quote.symbol = symbol;
        return alphaResult;
      }
    } catch (error) {
      console.error(`   ❌ Alpha Vantage降级也失败:`, error.message);
    }
  }
  
  // 策略4: 所有数据源都失败
  const fetchTime = Date.now();
  source = {
    provider: 'none',
    endpoint: 'N/A',
    symbol: symbol,
    timestamp: fetchTime,
    status: 'failed',
    error: 'All data sources failed (Finnhub, Twelve Data, Alpha Vantage)'
  };
  
  return { quote: null, source };
}

/**
 * 🆕 v4.2: 获取新闻数据（支持缓存）
 */
async function fetchNews(symbol) {
  const news = [];
  const sources = [];
  
  if (!FINNHUB_KEY) {
    return { news, sources, cacheHits: 0, cacheTotal: 1 };
  }
  
  try {
    // 🆕 先查缓存
    const cacheKey = getCacheKey('news', symbol);
    const cached = getFromCache(cacheKey);
    
    if (cached) {
      console.log(`   💾 [Cache Hit] ${symbol} 新闻命中缓存`);
      return { 
        news: cached.news, 
        sources: cached.sources, 
        cacheHits: 1,  // 🔧 修复：正确报告缓存命中
        cacheTotal: 1 
      };
    }
    
    // 获取公司新闻（最近7天）
    const today = new Date();
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const from = lastWeek.toISOString().split('T')[0];
    const to = today.toISOString().split('T')[0];
    
    const url = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${FINNHUB_KEY}`;
    const fetchTime = Date.now();
    
    const response = await fetch(url, { timeout: 10000 });
    
    if (response.ok) {
      const data = await response.json();
      
      // 取最新的5条新闻
      const recentNews = (data || []).slice(0, 5).map(item => ({
        headline: item.headline,
        summary: item.summary,
        source: item.source,
        url: item.url,
        datetime: item.datetime * 1000
      }));
      
      news.push(...recentNews);
      
      sources.push({
        provider: 'finnhub',
        endpoint: '/company-news',
        symbol: symbol,
        timestamp: fetchTime,
        freshnessMinutes: 0,  // 新闻是实时的
        status: 'success'
      });
      
      // 🆕 存入缓存
      setCache(cacheKey, { news, sources });
    }
    
  } catch (error) {
    console.error(`   ⚠️  获取新闻失败:`, error.message);
  }
  
  // 🔧 修复：缓存未命中时正确报告0
  return { news, sources, cacheHits: 0, cacheTotal: 1 };
}

/**
 * 🆕 v5.0: 获取公司概况（市值、行业、PE等）
 * Endpoint: /stock/profile2
 */
async function fetchCompanyProfile(symbol) {
  if (!FINNHUB_KEY) {
    return { profile: null, source: null };
  }
  
  try {
    // 先查缓存（公司信息变化慢，缓存时间长）
    const cacheKey = getCacheKey('profile', symbol);
    const cached = getFromCache(cacheKey);
    
    if (cached) {
      console.log(`   💾 [Cache Hit] ${symbol} 公司概况命中缓存`);
      return cached;
    }
    
    const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_KEY}`;
    const fetchTime = Date.now();
    
    const response = await fetch(url, { timeout: 10000 });
    
    if (!response.ok) {
      throw new Error(`Finnhub profile API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // 验证数据有效性
    if (!data || !data.ticker) {
      throw new Error(`Invalid profile data for ${symbol}`);
    }
    
    const profile = {
      symbol: data.ticker,
      companyName: data.name,
      country: data.country,
      currency: data.currency,
      exchange: data.exchange,
      ipo: data.ipo,
      marketCapitalization: data.marketCapitalization, // 市值（百万美元）
      shareOutstanding: data.shareOutstanding, // 流通股数（百万）
      logo: data.logo,
      phone: data.phone,
      weburl: data.weburl,
      finnhubIndustry: data.finnhubIndustry, // 行业分类
      source: 'finnhub'
    };
    
    const source = {
      provider: 'finnhub',
      endpoint: '/stock/profile2',
      symbol: symbol,
      timestamp: fetchTime,
      status: 'success'
    };
    
    const result = { profile, source };
    
    // 存入缓存（公司信息TTL可以更长）
    setCache(cacheKey, result);
    
    return result;
    
  } catch (error) {
    console.error(`   ⚠️  获取公司概况失败 (${symbol}):`, error.message);
    
    const source = {
      provider: 'finnhub',
      endpoint: '/stock/profile2',
      symbol: symbol,
      timestamp: Date.now(),
      status: 'failed',
      error: error.message
    };
    
    return { profile: null, source };
  }
}

/**
 * 🆕 v5.0: 获取基本面和技术指标
 * Endpoint: /stock/metric
 */
async function fetchStockMetrics(symbol) {
  if (!FINNHUB_KEY) {
    return { metrics: null, source: null };
  }
  
  try {
    // 先查缓存
    const cacheKey = getCacheKey('metrics', symbol);
    const cached = getFromCache(cacheKey);
    
    if (cached) {
      console.log(`   💾 [Cache Hit] ${symbol} 指标数据命中缓存`);
      return cached;
    }
    
    const url = `https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_KEY}`;
    const fetchTime = Date.now();
    
    const response = await fetch(url, { timeout: 10000 });
    
    if (!response.ok) {
      throw new Error(`Finnhub metrics API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // 提取关键指标
    const metrics = {
      symbol: symbol,
      // 估值指标
      peRatio: data.metric?.peBasicExclExtraTTM || data.metric?.peNormalizedAnnual,
      pbRatio: data.metric?.pbAnnual,
      psRatio: data.metric?.psTTM,
      dividendYield: data.metric?.dividendYieldIndicatedAnnual,
      marketCap: data.metric?.marketCapitalization, // 🔧 v4.0: 添加市值
      
      // 盈利能力
      profitMargin: data.metric?.netProfitMarginTTM,
      roa: data.metric?.roaTTM, // 资产回报率
      roe: data.metric?.roeTTM, // 净资产收益率
      
      // 成长性
      revenueGrowth: data.metric?.revenueGrowthTTMYoy, // 同比增长
      epsGrowth: data.metric?.epsGrowthTTMYoy,
      
      // 技术指标 (52周高低点等)
      high52Week: data.metric?.['52WeekHigh'],
      low52Week: data.metric?.['52WeekLow'],
      priceRelativeToSP500: data.metric?.['52WeekPriceReturnDaily'], // 相对S&P500表现
      beta: data.metric?.beta,
      
      // 其他
      averageVolume: data.metric?.['10DayAverageTradingVolume'],
      
      source: 'finnhub',
      timestamp: fetchTime,
      metric: data.metric // 🔧 v4.0: 保留原始metric对象供normalizeFinancialData使用
    };
    
    const source = {
      provider: 'finnhub',
      endpoint: '/stock/metric',
      symbol: symbol,
      timestamp: fetchTime,
      status: 'success'
    };
    
    const result = { metrics, source };
    
    // 存入缓存
    setCache(cacheKey, result);
    
    return result;
    
  } catch (error) {
    console.error(`   ⚠️  获取指标数据失败 (${symbol}):`, error.message);
    
    const source = {
      provider: 'finnhub',
      endpoint: '/stock/metric',
      symbol: symbol,
      timestamp: Date.now(),
      status: 'failed',
      error: error.message
    };
    
    return { metrics: null, source };
  }
}

/**
 * 计算数据新鲜度评分
 * @param {number} dataAgeMs - 数据年龄（毫秒）
 * @returns {number} - 新鲜度评分 (0-1)
 */
function calculateFreshnessScore(dataAgeMs) {
  const ageMinutes = dataAgeMs / 60000;
  
  // 新鲜度评分曲线：
  // 0-5分钟: 1.0 (实时)
  // 5-15分钟: 0.8 (很新鲜)
  // 15-60分钟: 0.6 (较新鲜)
  // 1-4小时: 0.4 (一般)
  // >4小时: 0.2 (陈旧)
  
  if (ageMinutes <= 5) return 1.0;
  if (ageMinutes <= 15) return 0.8;
  if (ageMinutes <= 60) return 0.6;
  if (ageMinutes <= 240) return 0.4;
  return 0.2;
}

/**
 * 评估数据质量
 */
function assessDataQuality(marketData) {
  const { quotes, news, metadata } = marketData;
  
  let overallScore = 0;
  let count = 0;
  
  // 1. 报价数据质量
  Object.values(quotes).forEach(quote => {
    if (quote && quote.freshnessScore) {
      overallScore += quote.freshnessScore;
      count++;
    }
  });
  
  // 2. 数据完整性
  const completenessScore = metadata.complete ? 1.0 : 0.5;
  overallScore += completenessScore;
  count++;
  
  // 3. 数据来源可靠性
  const hasReliableSource = metadata.dataSources.some(s => s.status === 'success');
  if (hasReliableSource) {
    overallScore += 0.8;
    count++;
  }
  
  const finalScore = count > 0 ? overallScore / count : 0;
  
  return {
    overallScore: finalScore,
    freshnessAvg: Object.values(quotes).reduce((sum, q) => sum + (q?.freshnessScore || 0), 0) / Object.keys(quotes).length || 0,
    completeness: completenessScore,
    reliableSources: metadata.dataSources.filter(s => s.status === 'success').length
  };
}

/**
 * 生成数据摘要（用于AI理解）
 */
function generateDataSummary(marketData, requestedSymbols) {
  const { quotes, metadata } = marketData;
  
  const summaryLines = [];
  
  summaryLines.push(`📊 市场数据采集结果:`);
  summaryLines.push(`   - 请求符号: ${requestedSymbols.length}个`);
  summaryLines.push(`   - 成功获取: ${Object.keys(quotes).length}个`);
  summaryLines.push(`   - 数据质量: ${(metadata.dataQuality.overallScore * 100).toFixed(0)}%`);
  summaryLines.push(`   - 数据新鲜度: ${(metadata.dataQuality.freshnessAvg * 100).toFixed(0)}%`);
  
  // 列出每个股票的数据
  Object.entries(quotes).forEach(([symbol, quote]) => {
    if (quote) {
      summaryLines.push(
        `   - ${symbol}: 当前$${quote.currentPrice.toFixed(2)}, ` +
        `涨跌${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%, ` +
        `数据年龄${quote.dataAgeMinutes}分钟`
      );
    }
  });
  
  // 警告缺失数据
  if (metadata.missingFields.length > 0) {
    summaryLines.push(`   ⚠️  缺失数据: ${metadata.missingFields.join(', ')}`);
  }
  
  return summaryLines.join('\n');
}

/**
 * 生成请求ID
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 验证数据是否可用于AI分析
 * @param {Object} marketData - 市场数据
 * @returns {Object} - {valid: boolean, reason: string}
 */
function validateDataForAnalysis(marketData) {
  // 关键验证：防止AI在没有数据时编造
  
  if (!marketData.collected) {
    return {
      valid: false,
      reason: '未能采集到任何市场数据，无法进行分析'
    };
  }
  
  if (Object.keys(marketData.quotes).length === 0) {
    return {
      valid: false,
      reason: '没有有效的股票报价数据'
    };
  }
  
  // 检查数据质量
  if (marketData.metadata.dataQuality.overallScore < 0.3) {
    return {
      valid: false,
      reason: '数据质量过低，可能不够准确'
    };
  }
  
  return {
    valid: true,
    reason: '数据有效'
  };
}

/**
 * 🆕 v5.0: 数据驱动分析 - 并行获取多维度数据
 * @param {string} symbol - 股票代码
 * @returns {Promise<Object>} 包含报价、公司概况、指标、新闻的完整数据包
 */
async function fetchDataDrivenAnalysis(symbol) {
  console.log(`\n📈 [Data-Driven Analysis] 获取${symbol}多维数据...`);
  
  const startTime = Date.now();
  
  // 并行获取所有维度数据
  const [quoteResult, profileResult, metricsResult, newsResult] = await Promise.all([
    (async () => {
      try {
        const marketData = await fetchMarketData([symbol], ['quote']);
        return marketData.quotes[symbol] || null;
      } catch (err) {
        console.error(`  ⚠️  实时报价获取失败: ${err.message}`);
        return null;
      }
    })(),
    
    fetchCompanyProfile(symbol).catch(err => {
      console.error(`  ⚠️  公司概况获取失败: ${err.message}`);
      return { profile: null, source: null };
    }),
    
    fetchStockMetrics(symbol).catch(err => {
      console.error(`  ⚠️  指标数据获取失败: ${err.message}`);
      return { metrics: null, source: null };
    }),
    
    fetchNews(symbol).catch(err => {
      console.error(`  ⚠️  新闻数据获取失败: ${err.message}`);
      return { news: [], sources: [] };
    })
  ]);
  
  const elapsed = Date.now() - startTime;
  
  // 计算数据完整性
  const dataCompleteness = {
    hasQuote: !!quoteResult,
    hasProfile: !!profileResult.profile,
    hasMetrics: !!metricsResult.metrics,
    hasNews: newsResult.news.length > 0,
    completenessScore: [
      !!quoteResult,
      !!profileResult.profile,
      !!metricsResult.metrics,
      newsResult.news.length > 0
    ].filter(Boolean).length / 4
  };
  
  console.log(`✅ [Data-Driven Analysis] 完成 (${elapsed}ms, 完整度: ${(dataCompleteness.completenessScore * 100).toFixed(0)}%)`);
  
  return {
    symbol: symbol,
    quote: quoteResult,
    profile: profileResult.profile,
    metrics: metricsResult.metrics,
    news: newsResult.news,
    metadata: {
      timestamp: Date.now(),
      elapsed_ms: elapsed,
      completeness: dataCompleteness
    }
  };
}

/**
 * 🆕 v6.2: Twelve Data技术指标获取 - 并行获取多个指标
 * @param {string} symbol - 股票代码
 * @param {string} interval - 时间间隔 (1day, 1h, 15min等)
 * @returns {Promise<Object>} 技术指标数据
 */
async function fetchTechnicalIndicators(symbol, interval = '1day') {
  console.log(`\n📈 [Twelve Data] 获取${symbol}技术指标 (${interval})...`);
  
  if (!TWELVE_DATA_KEY) {
    console.warn('   ⚠️  TWELVE_DATA_API_KEY未配置，跳过技术指标');
    return { indicators: null, source: null };
  }
  
  const baseUrl = 'https://api.twelvedata.com';
  const startTime = Date.now();
  
  // 🔧 辅助函数：检查HTTP响应和API错误
  const fetchIndicator = async (url, parser) => {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const data = await res.json();
    if (data.status === 'error') {
      throw new Error(data.message || 'API returned error status');
    }
    return parser(data);
  };
  
  // 并行获取5个核心技术指标
  const indicators = await Promise.allSettled([
    // RSI - 相对强弱指标
    fetchIndicator(
      `${baseUrl}/rsi?symbol=${symbol}&interval=${interval}&time_period=14&apikey=${TWELVE_DATA_KEY}`,
      data => ({
        name: 'RSI',
        value: parseFloat(data.values?.[0]?.rsi),
        timestamp: data.values?.[0]?.datetime,
        period: 14,
        status: 'ok'
      })
    ),
    
    // MACD - 移动平均收敛散度
    fetchIndicator(
      `${baseUrl}/macd?symbol=${symbol}&interval=${interval}&apikey=${TWELVE_DATA_KEY}`,
      data => ({
        name: 'MACD',
        macd: parseFloat(data.values?.[0]?.macd),
        signal: parseFloat(data.values?.[0]?.macd_signal),
        histogram: parseFloat(data.values?.[0]?.macd_hist),
        timestamp: data.values?.[0]?.datetime,
        status: 'ok'
      })
    ),
    
    // EMA - 指数移动平均线
    fetchIndicator(
      `${baseUrl}/ema?symbol=${symbol}&interval=${interval}&time_period=20&apikey=${TWELVE_DATA_KEY}`,
      data => ({
        name: 'EMA_20',
        value: parseFloat(data.values?.[0]?.ema),
        timestamp: data.values?.[0]?.datetime,
        period: 20,
        status: 'ok'
      })
    ),
    
    // BBANDS - 布林带
    fetchIndicator(
      `${baseUrl}/bbands?symbol=${symbol}&interval=${interval}&time_period=20&apikey=${TWELVE_DATA_KEY}`,
      data => ({
        name: 'BBANDS',
        upper: parseFloat(data.values?.[0]?.upper_band),
        middle: parseFloat(data.values?.[0]?.middle_band),
        lower: parseFloat(data.values?.[0]?.lower_band),
        timestamp: data.values?.[0]?.datetime,
        status: 'ok'
      })
    ),
    
    // ADX - 平均趋向指标
    fetchIndicator(
      `${baseUrl}/adx?symbol=${symbol}&interval=${interval}&time_period=14&apikey=${TWELVE_DATA_KEY}`,
      data => ({
        name: 'ADX',
        value: parseFloat(data.values?.[0]?.adx),
        timestamp: data.values?.[0]?.datetime,
        period: 14,
        status: 'ok'
      })
    )
  ]);
  
  const elapsed = Date.now() - startTime;
  
  // 🔧 处理结果，保留错误信息以供下游判断
  const results = {
    rsi: indicators[0].status === 'fulfilled' ? indicators[0].value : { error: indicators[0].reason?.message },
    macd: indicators[1].status === 'fulfilled' ? indicators[1].value : { error: indicators[1].reason?.message },
    ema: indicators[2].status === 'fulfilled' ? indicators[2].value : { error: indicators[2].reason?.message },
    bbands: indicators[3].status === 'fulfilled' ? indicators[3].value : { error: indicators[3].reason?.message },
    adx: indicators[4].status === 'fulfilled' ? indicators[4].value : { error: indicators[4].reason?.message },
    metadata: {
      symbol,
      interval,
      timestamp: Date.now(),
      elapsed_ms: elapsed,
      source: 'Twelve Data',
      success_count: indicators.filter(r => r.status === 'fulfilled').length,
      total_count: indicators.length
    }
  };
  
  console.log(`✅ [Technical Indicators] 完成 (${elapsed}ms, 成功率: ${results.metadata.success_count}/${results.metadata.total_count})`);
  return { technical: results, source: 'Twelve Data' };
}

/**
 * 🆕 v6.2: Twelve Data基本面数据获取 - 财报三表
 * @param {string} symbol - 股票代码
 * @returns {Promise<Object>} 基本面数据
 */
async function fetchFundamentals(symbol) {
  console.log(`\n📊 [Twelve Data] 获取${symbol}基本面数据...`);
  
  if (!TWELVE_DATA_KEY) {
    console.warn('   ⚠️  TWELVE_DATA_API_KEY未配置，跳过基本面数据');
    return { fundamentals: null, source: null };
  }
  
  const baseUrl = 'https://api.twelvedata.com';
  const startTime = Date.now();
  
  // 🔧 辅助函数：检查HTTP响应和API错误
  const fetchFundamental = async (url) => {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const data = await res.json();
    if (data.status === 'error') {
      throw new Error(data.message || 'API returned error status');
    }
    return data;
  };
  
  // 并行获取4个基本面数据源
  const fundamentals = await Promise.allSettled([
    // 利润表 (Income Statement)
    fetchFundamental(`${baseUrl}/income_statement?symbol=${symbol}&period=annual&apikey=${TWELVE_DATA_KEY}`)
      .then(data => ({ name: 'income_statement', data: data.income_statement?.[0], timestamp: data.income_statement?.[0]?.fiscal_date })),
    
    // 资产负债表 (Balance Sheet)
    fetchFundamental(`${baseUrl}/balance_sheet?symbol=${symbol}&period=annual&apikey=${TWELVE_DATA_KEY}`)
      .then(data => ({ name: 'balance_sheet', data: data.balance_sheet?.[0], timestamp: data.balance_sheet?.[0]?.fiscal_date })),
    
    // 现金流量表 (Cash Flow)
    fetchFundamental(`${baseUrl}/cash_flow?symbol=${symbol}&period=annual&apikey=${TWELVE_DATA_KEY}`)
      .then(data => ({ name: 'cash_flow', data: data.cash_flow?.[0], timestamp: data.cash_flow?.[0]?.fiscal_date })),
    
    // 统计数据 (Statistics - PE, Market Cap等)
    fetchFundamental(`${baseUrl}/statistics?symbol=${symbol}&apikey=${TWELVE_DATA_KEY}`)
      .then(data => ({ name: 'statistics', data: data.statistics }))
  ]);
  
  const elapsed = Date.now() - startTime;
  
  const results = {
    income_statement: fundamentals[0].status === 'fulfilled' ? fundamentals[0].value : { error: fundamentals[0].reason?.message },
    balance_sheet: fundamentals[1].status === 'fulfilled' ? fundamentals[1].value : { error: fundamentals[1].reason?.message },
    cash_flow: fundamentals[2].status === 'fulfilled' ? fundamentals[2].value : { error: fundamentals[2].reason?.message },
    statistics: fundamentals[3].status === 'fulfilled' ? fundamentals[3].value : { error: fundamentals[3].reason?.message },
    metadata: {
      symbol,
      timestamp: Date.now(),
      elapsed_ms: elapsed,
      source: 'Twelve Data',
      success_count: fundamentals.filter(r => r.status === 'fulfilled').length,
      total_count: fundamentals.length
    }
  };
  
  console.log(`✅ [Fundamentals] 完成 (${elapsed}ms, 成功率: ${results.metadata.success_count}/${results.metadata.total_count})`);
  return { fundamentals: results, source: 'Twelve Data' };
}

/**
 * 🆕 v6.2: Twelve Data分析师评级和价格目标
 * @param {string} symbol - 股票代码
 * @returns {Promise<Object>} 分析师评级数据
 */
async function fetchAnalystRatings(symbol) {
  console.log(`\n👔 [Twelve Data] 获取${symbol}分析师评级...`);
  
  if (!TWELVE_DATA_KEY) {
    console.warn('   ⚠️  TWELVE_DATA_API_KEY未配置，跳过分析师评级');
    return { ratings: null, source: null };
  }
  
  const baseUrl = 'https://api.twelvedata.com';
  const startTime = Date.now();
  
  // 🔧 辅助函数：检查HTTP响应和API错误
  const fetchRating = async (url) => {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const data = await res.json();
    if (data.status === 'error') {
      throw new Error(data.message || 'API returned error status');
    }
    return data;
  };
  
  // 并行获取分析师相关数据
  const ratingsData = await Promise.allSettled([
    // 推荐评级
    fetchRating(`${baseUrl}/recommendations?symbol=${symbol}&apikey=${TWELVE_DATA_KEY}`),
    
    // 价格目标
    fetchRating(`${baseUrl}/price_target?symbol=${symbol}&apikey=${TWELVE_DATA_KEY}`)
  ]);
  
  const elapsed = Date.now() - startTime;
  
  const results = {
    recommendations: ratingsData[0].status === 'fulfilled' ? ratingsData[0].value : { error: ratingsData[0].reason?.message },
    price_target: ratingsData[1].status === 'fulfilled' ? ratingsData[1].value : { error: ratingsData[1].reason?.message },
    metadata: {
      symbol,
      timestamp: Date.now(),
      elapsed_ms: elapsed,
      source: 'Twelve Data',
      success_count: ratingsData.filter(r => r.status === 'fulfilled').length,
      total_count: ratingsData.length
    }
  };
  
  console.log(`✅ [Analyst Ratings] 完成 (${elapsed}ms, 成功率: ${results.metadata.success_count}/${results.metadata.total_count})`);
  return { ratings: results, source: 'Twelve Data' };
}

/**
 * 🆕 v6.2: 全面数据驱动分析 - 整合所有Twelve Data功能
 * @param {string} symbol - 股票代码
 * @returns {Promise<Object>} 完整的分析数据包
 */
async function fetchComprehensiveAnalysis(symbol) {
  console.log(`\n🚀 [Comprehensive Analysis] 获取${symbol}全面分析数据...`);
  
  const startTime = Date.now();
  
  // 超级并行：同时获取6个维度的数据
  const [quoteData, profileData, technicalData, fundamentalData, analystData, newsData] = await Promise.all([
    // 1. 实时报价
    fetchMarketData([symbol], ['quote']).then(d => d.quotes[symbol]).catch(() => null),
    
    // 2. 公司概况
    fetchCompanyProfile(symbol).catch(() => ({ profile: null, source: null })),
    
    // 3. 技术指标
    fetchTechnicalIndicators(symbol).catch(() => ({ technical: null, source: null })),
    
    // 4. 基本面数据
    fetchFundamentals(symbol).catch(() => ({ fundamentals: null, source: null })),
    
    // 5. 分析师评级
    fetchAnalystRatings(symbol).catch(() => ({ ratings: null, source: null })),
    
    // 6. 新闻
    fetchNews(symbol).catch(() => ({ news: [], sources: [] }))
  ]);
  
  const elapsed = Date.now() - startTime;
  
  // 计算数据完整性评分
  const dataCompleteness = {
    hasQuote: !!quoteData,
    hasProfile: !!profileData.profile,
    hasTechnical: !!technicalData.technical,
    hasFundamentals: !!fundamentalData.fundamentals,
    hasAnalystRatings: !!analystData.ratings,
    hasNews: newsData.news?.length > 0,
    completenessScore: [
      !!quoteData,
      !!profileData.profile,
      !!technicalData.technical,
      !!fundamentalData.fundamentals,
      !!analystData.ratings,
      newsData.news?.length > 0
    ].filter(Boolean).length / 6
  };
  
  console.log(`✅ [Comprehensive Analysis] 完成 (${elapsed}ms, 完整度: ${(dataCompleteness.completenessScore * 100).toFixed(0)}%)`);
  
  return {
    symbol,
    quote: quoteData,
    profile: profileData.profile,
    technical_indicators: technicalData.technical,
    fundamentals: fundamentalData.fundamentals,
    analyst_ratings: analystData.ratings,
    news: newsData.news || [],
    metadata: {
      timestamp: Date.now(),
      elapsed_ms: elapsed,
      completeness: dataCompleteness,
      sources: {
        quote: 'Multi-source',
        profile: profileData.source,
        technical: technicalData.source,
        fundamentals: fundamentalData.source,
        analyst: analystData.source,
        news: newsData.sources
      }
    }
  };
}

/**
 * 🆕 v6.2: 获取历史价格数据（用于研报）
 * @param {string} symbol - 股票代码
 * @param {Object} options - { months: 12 } 获取月数
 * @returns {Promise<Array>} - 历史价格数组
 */
async function fetchHistoricalPrices(symbol, options = {}) {
  const { months = 12 } = options;
  console.log(`\n📈 [Data Broker] 获取${symbol}历史价格（${months}个月）`);
  
  try {
    // 计算日期范围
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    
    const formatDate = (date) => {
      return date.toISOString().split('T')[0]; // YYYY-MM-DD
    };
    
    // 优先使用Twelve Data（支持全球交易所）
    if (TWELVE_DATA_KEY) {
      const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&start_date=${formatDate(startDate)}&end_date=${formatDate(endDate)}&apikey=${TWELVE_DATA_KEY}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'ok' && data.values) {
        console.log(`✅ [Twelve Data] 获取到${data.values.length}条历史数据`);
        return data.values.map(v => ({
          date: v.datetime,
          open: parseFloat(v.open),
          high: parseFloat(v.high),
          low: parseFloat(v.low),
          close: parseFloat(v.close),
          volume: parseInt(v.volume)
        }));
      }
    }
    
    // 降级到Alpha Vantage
    if (ALPHA_VANTAGE_KEY) {
      const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=full&apikey=${ALPHA_VANTAGE_KEY}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data['Time Series (Daily)']) {
        const timeSeries = data['Time Series (Daily)'];
        const prices = Object.keys(timeSeries)
          .filter(date => new Date(date) >= startDate)
          .map(date => ({
            date,
            open: parseFloat(timeSeries[date]['1. open']),
            high: parseFloat(timeSeries[date]['2. high']),
            low: parseFloat(timeSeries[date]['3. low']),
            close: parseFloat(timeSeries[date]['4. close']),
            volume: parseInt(timeSeries[date]['5. volume'])
          }))
          .sort((a, b) => new Date(a.date) - new Date(b.date));
        
        console.log(`✅ [Alpha Vantage] 获取到${prices.length}条历史数据`);
        return prices;
      }
    }
    
    console.warn('⚠️  历史价格数据获取失败，返回空数组');
    return [];
    
  } catch (error) {
    console.error(`❌ [Historical Prices] 获取失败: ${error.message}`);
    return [];
  }
}

/**
 * 🆕 v4.0: 获取同行基准数据（用于深度研报对比表）
 * @param {string} symbol - 股票代码
 * @param {Object} existingMetrics - 可选，已获取的目标公司metrics（避免重复调用）
 * @returns {Promise<Object>} - 同行公司列表及其关键指标
 */
async function fetchPeerBenchmarks(symbol, existingMetrics = null) {
  console.log(`\n📊 [Peer Benchmarks] 获取${symbol}的同行对比数据`);
  
  // 🔒 先查缓存（TTL 20分钟，因为同行关系准静态）
  const cacheKey = getCacheKey('peer_benchmarks', symbol);
  const cached = getFromCache(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp) < 20 * 60 * 1000) {
    console.log(`   💾 [Cache Hit] 同行基准数据命中缓存`);
    return cached;
  }
  
  if (!FINNHUB_KEY) {
    console.warn('   ⚠️  Finnhub API密钥缺失，跳过同行分析');
    return {
      targetSymbol: symbol,
      peers: [],
      benchmarks: {},
      source: 'unavailable'
    };
  }
  
  try {
    // 1. 获取同行公司列表（Finnhub /stock/peers）
    const peersUrl = `https://finnhub.io/api/v1/stock/peers?symbol=${symbol}&token=${FINNHUB_KEY}`;
    const peersResponse = await fetch(peersUrl, { timeout: 10000 });
    
    if (!peersResponse.ok) {
      throw new Error(`Finnhub peers API error: ${peersResponse.status}`);
    }
    
    const peersData = await peersResponse.json();
    const peerSymbols = Array.isArray(peersData) ? peersData.slice(0, 4) : []; // 取前4个同行
    
    if (peerSymbols.length === 0) {
      console.warn(`   ⚠️  未找到${symbol}的同行公司`);
      const result = {
        targetSymbol: symbol,
        peers: [],
        benchmarks: {},
        source: 'finnhub',
        timestamp: Date.now()
      };
      setCache(cacheKey, result);
      return result;
    }
    
    console.log(`   ✅ 找到${peerSymbols.length}个同行: ${peerSymbols.join(', ')}`);
    
    // 2. 🔧 重用目标公司已获取的metrics（避免重复调用）
    let targetMetricsData = existingMetrics;
    if (!targetMetricsData) {
      const { metrics } = await fetchStockMetrics(symbol);
      targetMetricsData = metrics;
    }
    
    // 3. 🔧 使用Promise.allSettled并行获取同行metrics（支持部分成功）
    const peerMetricsPromises = peerSymbols.map((sym) => 
      fetchStockMetrics(sym)
        .then(({ metrics }) => ({
          symbol: sym,
          pe: metrics?.peRatio || null,
          pb: metrics?.pbRatio || null,
          ps: metrics?.psRatio || null,
          marketCap: metrics?.marketCap || null,
          profitMargin: metrics?.profitMargin || null, // 🔧 v4.0 FIX: Finnhub已返回百分比，不要再×100
          roe: metrics?.roe || null, // 🔧 v4.0 FIX: Finnhub已返回百分比，不要再×100
          status: 'success'
        }))
        .catch((e) => ({
          symbol: sym,
          pe: null,
          pb: null,
          ps: null,
          marketCap: null,
          profitMargin: null,
          roe: null,
          status: 'failed',
          error: e.message
        }))
    );
    
    const peerResults = await Promise.allSettled(peerMetricsPromises);
    const peerMetrics = peerResults
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);
    
    // 4. 构建目标公司metrics
    const targetMetrics = {
      symbol,
      pe: targetMetricsData?.peRatio || null,
      pb: targetMetricsData?.pbRatio || null,
      ps: targetMetricsData?.psRatio || null,
      marketCap: targetMetricsData?.marketCap || null,
      profitMargin: targetMetricsData?.profitMargin || null, // 🔧 v4.0 FIX: Finnhub已返回百分比，不要再×100
      roe: targetMetricsData?.roe || null // 🔧 v4.0 FIX: Finnhub已返回百分比，不要再×100
    };
    
    // 5. 计算行业平均值（排除null和failed值）
    const successfulPeers = peerMetrics.filter(m => m.status === 'success');
    const peValues = successfulPeers.map(m => m.pe).filter(v => v !== null);
    const roeValues = successfulPeers.map(m => m.roe).filter(v => v !== null);
    
    const avgPE = peValues.length > 0 
      ? peValues.reduce((sum, v) => sum + v, 0) / peValues.length
      : null;
    const avgROE = roeValues.length > 0
      ? roeValues.reduce((sum, v) => sum + v, 0) / roeValues.length
      : null;
    
    const failedCount = peerMetrics.filter(m => m.status === 'failed').length;
    
    console.log(`   📈 行业平均PE: ${avgPE ? avgPE.toFixed(2) : 'N/A'}, 平均ROE: ${avgROE ? avgROE.toFixed(2) + '%' : 'N/A'}`);
    if (failedCount > 0) {
      console.warn(`   ⚠️  ${failedCount}/${peerMetrics.length}个同行数据获取失败`);
    }
    
    const result = {
      targetSymbol: symbol,
      targetMetrics,
      peers: peerMetrics,
      benchmarks: {
        avgPE: avgPE ? Number(avgPE.toFixed(2)) : null,
        avgROE: avgROE ? Number(avgROE.toFixed(2)) : null,
        peerCount: successfulPeers.length,
        failedCount
      },
      source: 'finnhub',
      timestamp: Date.now()
    };
    
    // 🔒 存入缓存（20分钟TTL）
    setCache(cacheKey, result);
    
    return result;
    
  } catch (error) {
    console.error(`   ❌ [Peer Benchmarks] 获取失败: ${error.message}`);
    return {
      targetSymbol: symbol,
      peers: [],
      benchmarks: {},
      source: 'failed',
      error: error.message,
      timestamp: Date.now()
    };
  }
}

module.exports = {
  fetchMarketData,
  validateDataForAnalysis,
  calculateFreshnessScore,
  fetchCompanyProfile,
  fetchStockMetrics,
  fetchDataDrivenAnalysis,
  // 🆕 v6.2: Twelve Data集成
  fetchTechnicalIndicators,
  fetchFundamentals,
  fetchAnalystRatings,
  fetchComprehensiveAnalysis,
  fetchHistoricalPrices,  // 🆕 历史价格数据
  fetchPeerBenchmarks     // 🆕 v4.0: 同行基准数据
};
