// ====== Data Broker with Anti-Hallucination Mechanism ======
// 数据代理：中心化API调用，强制数据来源追踪，防止AI编造数据
// v4.2: 并行数据获取 + 软超时 + 缓存

const fetch = require("node-fetch");

const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_API_KEY;

// 🆕 v4.2: 软超时配置（环境变量可控）
const SLOW_SOURCE_TIMEOUT = parseInt(process.env.SLOW_SOURCE_TIMEOUT_MS) || 7000;

// 🆕 v4.2: 简单内存缓存（后续可升级为Redis）
const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 120; // 默认120秒
const dataCache = new Map();

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
 * 获取单个股票报价（智能降级：Finnhub → Alpha Vantage）
 */
async function fetchSingleQuote(symbol) {
  let quote = null;
  let source = null;
  
  // 策略1: 优先使用Finnhub
  if (FINNHUB_KEY) {
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`;
    const fetchTime = Date.now();
    
    try {
      const response = await fetch(url, { timeout: 10000 });
      
      if (!response.ok) {
        throw new Error(`Finnhub API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // 验证数据有效性
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
      }
      
    } catch (error) {
      console.warn(`   ⚠️  Finnhub失败，尝试Alpha Vantage降级: ${error.message}`);
    }
  }
  
  // 策略2: 降级到Alpha Vantage
  if (ALPHA_VANTAGE_KEY && !quote) {
    console.log(`   🔄 [降级] 使用Alpha Vantage获取${symbol}报价`);
    try {
      const alphaResult = await fetchQuoteFromAlphaVantage(symbol);
      if (alphaResult.quote) {
        return alphaResult;
      }
    } catch (error) {
      console.error(`   ❌ Alpha Vantage降级也失败:`, error.message);
    }
  }
  
  // 策略3: 所有数据源都失败
  const fetchTime = Date.now();
  source = {
    provider: 'none',
    endpoint: 'N/A',
    symbol: symbol,
    timestamp: fetchTime,
    status: 'failed',
    error: 'All data sources failed'
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
      timestamp: fetchTime
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

module.exports = {
  fetchMarketData,
  validateDataForAnalysis,
  calculateFreshnessScore,
  fetchCompanyProfile,
  fetchStockMetrics,
  fetchDataDrivenAnalysis
};
