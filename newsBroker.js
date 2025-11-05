// ====== News Broker with ImpactRank Scoring System ======
// 新闻代理：多源聚合、紧急度评分、时间窗口筛选
// ImpactRank = 主题相关度 × 来源权威度 × 新鲜度衰减 × 市值权重

const fetch = require("node-fetch");

const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_API_KEY;

// 来源权威度评分（0-1）
const SOURCE_AUTHORITY = {
  // 一线财经媒体
  'Bloomberg': 1.0,
  'Reuters': 1.0,
  'Financial Times': 1.0,
  'Wall Street Journal': 1.0,
  'CNBC': 0.9,
  'MarketWatch': 0.9,
  'Seeking Alpha': 0.85,
  'Barron\'s': 0.85,
  // 西班牙媒体
  'El Economista': 0.9,
  'Expansión': 0.9,
  'Cinco Días': 0.85,
  // 德国媒体
  'Handelsblatt': 0.9,
  'Börsen-Zeitung': 0.85,
  // 英国媒体
  'BBC Business': 0.9,
  'The Economist': 0.95,
  // 其他
  'Yahoo Finance': 0.75,
  'Investing.com': 0.7,
  'default': 0.5
};

// 市值权重系数（用于计算影响力）
const MARKET_CAP_WEIGHT = {
  'mega': 1.5,    // >200B
  'large': 1.2,   // 10B-200B
  'mid': 1.0,     // 2B-10B
  'small': 0.8,   // <2B
  'unknown': 0.9
};

/**
 * 获取新闻并评分（ImpactRank算法）
 * @param {Object} options - 配置选项
 * @param {Array<string>} options.symbols - 股票代码列表
 * @param {string} options.region - 区域提示（ES/US/UK等）
 * @param {number} options.timeWindowMinutes - 时间窗口（分钟，默认120）
 * @param {number} options.topN - 返回Top N条新闻（默认5）
 * @param {Array<string>} options.sectors - 行业过滤（可选）
 * @returns {Promise<Array>} - 排序后的新闻列表
 */
async function fetchAndRankNews(options = {}) {
  const {
    symbols = [],
    region = 'US',
    timeWindowMinutes = 120,  // 默认2小时
    topN = 5,
    sectors = []
  } = options;

  console.log(`\n📰 [News Broker] 开始获取新闻`);
  console.log(`   - 符号: [${symbols.join(', ')}]`);
  console.log(`   - 区域: ${region}`);
  console.log(`   - 时间窗口: ${timeWindowMinutes}分钟`);
  console.log(`   - Top N: ${topN}`);

  const startTime = Date.now();
  const allNews = [];

  try {
    // 1. 从Finnhub获取公司新闻
    if (symbols.length > 0) {
      for (const symbol of symbols.slice(0, 3)) {  // 限制最多3个符号，避免超时
        const companyNews = await fetchFinnhubCompanyNews(symbol, timeWindowMinutes);
        allNews.push(...companyNews);
      }
    }

    // 2. 获取市场级新闻（通用/区域相关）
    const marketNews = await fetchFinnhubMarketNews(region, timeWindowMinutes);
    allNews.push(...marketNews);

    // 3. 去重（按URL）
    const uniqueNews = deduplicateNews(allNews);

    // 4. 计算ImpactRank评分
    const scoredNews = uniqueNews.map(newsItem => {
      const score = calculateImpactRank(newsItem, symbols, region, sectors);
      return { ...newsItem, impact_score: score };
    });

    // 5. 排序并取Top N
    const rankedNews = scoredNews
      .sort((a, b) => b.impact_score - a.impact_score)
      .slice(0, topN);

    const elapsedTime = Date.now() - startTime;
    console.log(`✅ [News Broker] 新闻获取完成 (${elapsedTime}ms)`);
    console.log(`   - 原始新闻: ${allNews.length}条`);
    console.log(`   - 去重后: ${uniqueNews.length}条`);
    console.log(`   - Top ${topN}: ${rankedNews.length}条`);

    return rankedNews;

  } catch (error) {
    console.error(`❌ [News Broker] 新闻获取失败:`, error.message);
    return [];
  }
}

/**
 * 从Finnhub获取公司新闻
 */
async function fetchFinnhubCompanyNews(symbol, timeWindowMinutes) {
  if (!FINNHUB_KEY) {
    console.warn('   ⚠️  FINNHUB_API_KEY未配置，跳过Finnhub新闻');
    return [];
  }

  try {
    const now = new Date();
    const from = new Date(now.getTime() - timeWindowMinutes * 60 * 1000);
    
    const fromDate = from.toISOString().split('T')[0];
    const toDate = now.toISOString().split('T')[0];
    
    const url = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${fromDate}&to=${toDate}&token=${FINNHUB_KEY}`;
    
    const response = await fetch(url, { timeout: 10000 });
    
    if (!response.ok) {
      if (response.status === 403 || response.status === 429) {
        console.warn(`   ⚠️  Finnhub API限流 (${response.status})，跳过${symbol}`);
        return [];
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    // 只保留时间窗口内的新闻
    const cutoffTime = now.getTime() - timeWindowMinutes * 60 * 1000;
    const recentNews = (data || [])
      .filter(item => (item.datetime * 1000) >= cutoffTime)
      .map(item => ({
        title: item.headline,
        summary: item.summary || '',
        source: item.source || 'Unknown',
        url: item.url,
        datetime: item.datetime * 1000,
        tickers: [symbol],
        category: item.category || 'company',
        provenance: {
          provider: 'finnhub',
          endpoint: 'company-news',
          fetchTime: Date.now()
        }
      }));

    console.log(`   📊 Finnhub ${symbol}: ${recentNews.length}条新闻`);
    return recentNews;

  } catch (error) {
    console.error(`   ❌ Finnhub公司新闻失败 (${symbol}):`, error.message);
    return [];
  }
}

/**
 * 从Finnhub获取市场新闻（通用/宏观）
 */
async function fetchFinnhubMarketNews(region, timeWindowMinutes) {
  if (!FINNHUB_KEY) {
    return [];
  }

  try {
    // Finnhub市场新闻端点（通用新闻，不限符号）
    const url = `https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`;
    
    const response = await fetch(url, { timeout: 10000 });
    
    if (!response.ok) {
      if (response.status === 403 || response.status === 429) {
        console.warn(`   ⚠️  Finnhub市场新闻API限流，跳过`);
        return [];
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    const now = Date.now();
    const cutoffTime = now - timeWindowMinutes * 60 * 1000;
    
    const recentNews = (data || [])
      .filter(item => (item.datetime * 1000) >= cutoffTime)
      .map(item => ({
        title: item.headline,
        summary: item.summary || '',
        source: item.source || 'Unknown',
        url: item.url,
        datetime: item.datetime * 1000,
        tickers: item.related ? item.related.split(',') : [],
        category: 'market',
        provenance: {
          provider: 'finnhub',
          endpoint: 'market-news',
          fetchTime: Date.now()
        }
      }));

    console.log(`   📊 Finnhub市场新闻: ${recentNews.length}条`);
    return recentNews;

  } catch (error) {
    console.error(`   ❌ Finnhub市场新闻失败:`, error.message);
    return [];
  }
}

/**
 * 去重新闻（按URL）
 */
function deduplicateNews(newsArray) {
  const seen = new Set();
  const unique = [];

  for (const item of newsArray) {
    const key = item.url || item.title;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  return unique;
}

/**
 * 计算ImpactRank评分
 * ImpactRank = 主题相关度 × 来源权威度 × 新鲜度衰减 × 市值权重
 * 
 * @param {Object} newsItem - 新闻项
 * @param {Array<string>} targetSymbols - 目标符号
 * @param {string} region - 区域
 * @param {Array<string>} sectors - 行业
 * @returns {number} - 评分（0-1）
 */
function calculateImpactRank(newsItem, targetSymbols, region, sectors) {
  // 1. 主题相关度（0-1）
  const topicRelevance = calculateTopicRelevance(newsItem, targetSymbols, region, sectors);
  
  // 2. 来源权威度（0-1）
  const sourceAuthority = SOURCE_AUTHORITY[newsItem.source] || SOURCE_AUTHORITY.default;
  
  // 3. 新鲜度衰减（0-1）
  const freshnessDecay = calculateFreshnessDecay(newsItem.datetime);
  
  // 4. 市值权重（0.8-1.5）
  const marketCapWeight = estimateMarketCapWeight(newsItem.tickers);
  
  // 综合评分
  const impactScore = topicRelevance * sourceAuthority * freshnessDecay * marketCapWeight;
  
  // 存储评分细节（调试用）
  newsItem.scoring_details = {
    topic_relevance: topicRelevance.toFixed(3),
    source_authority: sourceAuthority.toFixed(3),
    freshness_decay: freshnessDecay.toFixed(3),
    market_cap_weight: marketCapWeight.toFixed(3)
  };
  
  return impactScore;
}

/**
 * 计算主题相关度
 */
function calculateTopicRelevance(newsItem, targetSymbols, region, sectors) {
  let relevance = 0;
  
  const title = newsItem.title.toLowerCase();
  const summary = (newsItem.summary || '').toLowerCase();
  const content = title + ' ' + summary;
  
  // 1. 符号匹配（最高权重）
  if (targetSymbols.length > 0) {
    const symbolMatch = targetSymbols.some(symbol => {
      const base = symbol.split(':').pop();  // 去除交易所前缀
      return newsItem.tickers.some(ticker => ticker.includes(base)) ||
             content.includes(base.toLowerCase());
    });
    if (symbolMatch) relevance += 0.6;
  }
  
  // 2. 区域/指数匹配
  const regionKeywords = {
    'ES': ['spain', 'ibex', 'madrid', 'españa', 'español'],
    'US': ['dow', 'nasdaq', 's&p', 'wall street', 'nyse'],
    'UK': ['ftse', 'london', 'britain', 'uk'],
    'DE': ['dax', 'frankfurt', 'germany', 'deutschland'],
    'FR': ['cac', 'paris', 'france'],
    'JP': ['nikkei', 'tokyo', 'japan'],
    'CN': ['shanghai', 'shenzhen', 'china', 'hang seng', 'hk']
  };
  
  const keywords = regionKeywords[region] || [];
  const regionMatch = keywords.some(kw => content.includes(kw));
  if (regionMatch) relevance += 0.3;
  
  // 3. 行业匹配
  if (sectors.length > 0) {
    const sectorMatch = sectors.some(sector => 
      content.includes(sector.toLowerCase())
    );
    if (sectorMatch) relevance += 0.2;
  }
  
  // 4. 类别权重
  if (newsItem.category === 'company') relevance += 0.1;
  if (newsItem.category === 'earnings') relevance += 0.15;
  
  // 5. 关键词匹配（市场影响力）
  const impactKeywords = [
    'breaking', 'alert', 'crisis', 'crash', 'surge', 'plunge',
    'earnings', 'merger', 'acquisition', 'bankruptcy', 'ipo',
    'fed', 'central bank', 'interest rate', 'inflation', 'gdp',
    '突发', '暴跌', '暴涨', '财报', '并购', '破产', '央行', '利率'
  ];
  
  const keywordMatch = impactKeywords.some(kw => content.includes(kw));
  if (keywordMatch) relevance += 0.15;
  
  // 确保不超过1.0
  return Math.min(relevance, 1.0);
}

/**
 * 计算新鲜度衰减
 * 使用指数衰减公式: e^(-Δt/40min)
 * Δt ≤ 120min (2小时窗口)
 */
function calculateFreshnessDecay(newsTimestamp) {
  const now = Date.now();
  const ageMinutes = (now - newsTimestamp) / 60000;
  
  // 指数衰减，半衰期40分钟
  const decay = Math.exp(-ageMinutes / 40);
  
  return Math.max(decay, 0.1);  // 最低保留0.1
}

/**
 * 估算市值权重（基于符号启发式）
 */
function estimateMarketCapWeight(tickers) {
  if (!tickers || tickers.length === 0) {
    return MARKET_CAP_WEIGHT.unknown;
  }
  
  // 大市值符号（启发式）
  const megaCaps = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META'];
  const hasMega = tickers.some(t => megaCaps.some(m => t.includes(m)));
  
  if (hasMega) return MARKET_CAP_WEIGHT.mega;
  
  // 默认中等市值
  return MARKET_CAP_WEIGHT.mid;
}

/**
 * 生成新闻摘要（为什么重要）
 */
function generateImpactReason(newsItem, impactScore) {
  const reasons = [];
  
  // 基于评分给出理由
  if (impactScore > 0.7) {
    reasons.push('高相关性');
  }
  
  if (newsItem.scoring_details.freshness_decay > 0.7) {
    reasons.push('刚刚发布');
  }
  
  if (newsItem.scoring_details.source_authority > 0.85) {
    reasons.push('权威来源');
  }
  
  if (newsItem.scoring_details.market_cap_weight > 1.1) {
    reasons.push('涉及重要公司');
  }
  
  if (newsItem.category === 'earnings') {
    reasons.push('财报发布');
  }
  
  return reasons.length > 0 ? reasons.join(' + ') : '市场相关';
}

/**
 * 格式化新闻输出（添加reason字段）
 */
function formatNewsOutput(rankedNews) {
  return rankedNews.map(newsItem => ({
    title: newsItem.title,
    time: new Date(newsItem.datetime).toISOString(),
    impact_score: parseFloat(newsItem.impact_score.toFixed(3)),
    reason: generateImpactReason(newsItem, newsItem.impact_score),
    source: newsItem.source,
    tickers: newsItem.tickers,
    url: newsItem.url,
    summary: newsItem.summary
  }));
}

module.exports = {
  fetchAndRankNews,
  formatNewsOutput
};
