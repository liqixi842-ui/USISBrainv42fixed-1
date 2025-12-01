// ====== Symbol Resolver ======
// 🌍 全球股票代码解析器 - 多数据源编排（Finnhub + Twelve Data）
// 将公司名称（如"Grifols", "Sabadell"）转换为正确的股票代码

const fetch = require("node-fetch");
const { ENTITY_TYPES, EXCHANGES } = require("./schemas");
const { 
  normalizeCountry, 
  toTradingView, 
  toTwelveData, 
  normalizeCandidate,
  scoreExchangeMatch 
} = require("./normalize");

const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
const TWELVE_DATA_KEY = process.env.TWELVE_DATA_API_KEY;

// 🆕 v7.0: 公司名 → 股票代码映射（常用公司，支持中英文）
// 🆕 v7.7.2: 扩展英文公司名支持
const CHINESE_COMPANY_MAP = {
  // 美股科技巨头（中英文）
  '苹果': 'AAPL',
  'apple': 'AAPL',
  'microsoft': 'MSFT',
  'google': 'GOOGL',
  'alphabet': 'GOOGL',
  'amazon': 'AMZN',
  'tesla': 'TSLA',
  'nvidia': 'NVDA',
  'facebook': 'META',
  'netflix': 'NFLX',
  'intel': 'INTC',
  'amd': 'AMD',
  'qualcomm': 'QCOM',
  'broadcom': 'AVGO',
  'cisco': 'CSCO',
  'oracle': 'ORCL',
  'ibm': 'IBM',
  'disney': 'DIS',
  'nike': 'NKE',
  'starbucks': 'SBUX',
  'mcdonalds': 'MCD',
  'walmart': 'WMT',
  'costco': 'COST',
  'boeing': 'BA',
  'jpmorgan': 'JPM',
  'goldman': 'GS',
  'berkshire': 'BRK.B',
  'blackrock': 'BLK',
  'coca-cola': 'KO',
  'cocacola': 'KO',
  'pepsi': 'PEP',
  'pfizer': 'PFE',
  'johnson': 'JNJ',
  'exxon': 'XOM',
  'chevron': 'CVX',
  '微软': 'MSFT',
  '谷歌': 'GOOGL',
  '亚马逊': 'AMZN',
  '特斯拉': 'TSLA',
  '英伟达': 'NVDA',
  '脸书': 'META',
  'meta': 'META',
  '奈飞': 'NFLX',
  '网飞': 'NFLX',
  
  // 中概股
  '阿里': 'BABA',
  '阿里巴巴': 'BABA',
  '腾讯': '0700.HK',
  '百度': 'BIDU',
  '京东': 'JD',
  '拼多多': 'PDD',
  '蔚来': 'NIO',
  '小鹏': 'XPEV',
  '理想': 'LI',
  '哔哩哔哩': 'BILI',
  'B站': 'BILI',
  '网易': 'NTES',
  '携程': 'TCOM',
  '新东方': 'EDU',
  
  // 金融
  '摩根大通': 'JPM',
  '高盛': 'GS',
  '美国银行': 'BAC',
  '富国银行': 'WFC',
  '花旗': 'C',
  '伯克希尔': 'BRK.B',
  '巴菲特': 'BRK.B',
  '贝莱德': 'BLK',
  'visa': 'V',
  '万事达': 'MA',
  
  // 消费
  '星巴克': 'SBUX',
  '麦当劳': 'MCD',
  '可口可乐': 'KO',
  '百事': 'PEP',
  '耐克': 'NKE',
  '沃尔玛': 'WMT',
  '好市多': 'COST',
  '迪士尼': 'DIS',
  
  // 科技/芯片
  '英特尔': 'INTC',
  'AMD': 'AMD',
  '高通': 'QCOM',
  '台积电': 'TSM',
  '博通': 'AVGO',
  '德州仪器': 'TXN',
  '超威': 'AMD',
  
  // 医药
  '辉瑞': 'PFE',
  '强生': 'JNJ',
  '默克': 'MRK',
  '礼来': 'LLY',
  '诺和诺德': 'NVO',
  '艾伯维': 'ABBV',
  
  // 能源
  '埃克森美孚': 'XOM',
  '雪佛龙': 'CVX',
  '壳牌': 'SHEL',
  
  // 其他
  '波音': 'BA',
  '洛克希德': 'LMT',
  '3M': 'MMM',
  'IBM': 'IBM',
  '甲骨文': 'ORCL',
  'salesforce': 'CRM',
  'adobe': 'ADBE',
  'zoom': 'ZM',
  'uber': 'UBER',
  '优步': 'UBER',
  'airbnb': 'ABNB',
  '爱彼迎': 'ABNB',
  'spotify': 'SPOT',
  'paypal': 'PYPL',
  '贝宝': 'PYPL',
  'coinbase': 'COIN',
  'robinhood': 'HOOD',
  '英特尔': 'INTC',
  '思科': 'CSCO'
};

/**
 * 🆕 v7.0: 中文公司名快速解析
 * @param {string} input - 用户输入（可能是中文公司名）
 * @returns {string|null} - 股票代码或null
 */
function resolveChineseCompanyName(input) {
  if (!input) return null;
  
  const normalized = input.trim().toLowerCase();
  
  // 直接匹配
  if (CHINESE_COMPANY_MAP[normalized]) {
    console.log(`   🇨🇳 [中文映射] "${input}" → ${CHINESE_COMPANY_MAP[normalized]}`);
    return CHINESE_COMPANY_MAP[normalized];
  }
  
  // 遍历匹配（支持部分匹配）
  for (const [name, symbol] of Object.entries(CHINESE_COMPANY_MAP)) {
    if (normalized.includes(name) || name.includes(normalized)) {
      console.log(`   🇨🇳 [中文映射] "${input}" → ${symbol} (匹配: ${name})`);
      return symbol;
    }
  }
  
  return null;
}

// 🆕 数据源优先级配置（可根据需要调整）
const DATA_SOURCE_PRIORITY = {
  // 当Twelve Data Pro可用时，优先使用它（更高限额、更多市场）
  symbol_search: TWELVE_DATA_KEY ? ['twelvedata', 'finnhub'] : ['finnhub', 'twelvedata']
};

/**
 * 🆕 v6.1: 提取查询关键词（避免公司全名太长导致API失败）
 * "Colonial SFL SOCIMI SA" → "Colonial"
 * "Apple Inc." → "Apple"
 * "Royal Bank of Canada" → "Royal Bank"
 */
function extractSearchKeyword(companyName) {
  // 移除常见公司后缀
  const suffixes = [
    'Inc\\.?', 'Corp\\.?', 'Corporation', 'Company', 'Co\\.?',
    'Ltd\\.?', 'Limited', 'S\\.A\\.?', 'SA', 'SOCIMI', 'SFL',
    'Group', 'Holdings', 'PLC', 'LLC', 'LP', 'AG'
  ];
  
  let keyword = companyName;
  const suffixPattern = new RegExp(`\\s+(${suffixes.join('|')})\\s*$`, 'i');
  keyword = keyword.replace(suffixPattern, '').trim();
  
  // 如果还是太长（>20字符），取前2-3个单词
  if (keyword.length > 20) {
    const words = keyword.split(/\s+/);
    keyword = words.slice(0, Math.min(3, words.length)).join(' ');
  }
  
  return keyword.trim();
}

/**
 * 🆕 v4.2: 符号归一化（欧洲后缀 → Finnhub前缀）
 * GRF.MC → BME:GRF (Madrid)
 * SAP.DE → XETRA:SAP (Frankfurt)
 */
function normalizeSymbol(raw) {
  const s = (raw || '').trim().toUpperCase();
  const map = [
    { re: /\.MC$/,  to: sym => `BME:${sym.replace(/\.MC$/, '')}` },    // Madrid
    { re: /\.PA$/,  to: sym => `EPA:${sym.replace(/\.PA$/, '')}` },    // Paris
    { re: /\.DE$/,  to: sym => `XETRA:${sym.replace(/\.DE$/, '')}` },  // Frankfurt
    { re: /\.MI$/,  to: sym => `MIL:${sym.replace(/\.MI$/, '')}` },    // Milan
    { re: /\.L$/,   to: sym => `LSE:${sym.replace(/\.L$/, '')}` }      // London
  ];
  for (const r of map) {
    if (r.re.test(s)) {
      const normalized = r.to(s);
      console.log(`   🔄 [Normalize] ${s} → ${normalized}`);
      return normalized;
    }
  }
  return s; // 已带前缀或美股，原样返回
}

/**
 * 解析股票代码 - 从Intent中的实体提取正确的股票代码
 * @param {Intent} intent - 语义意图对象
 * @returns {Promise<Array<string>>} - 解析后的股票代码列表
 */
async function resolveSymbols(intent) {
  console.log(`\n📍 [Symbol Resolver] 开始解析股票代码`);
  
  const symbols = [];
  const entities = intent.entities || [];
  
  // 分类实体
  const companyEntities = entities.filter(e => e.type === ENTITY_TYPES.COMPANY);
  const symbolEntities = entities.filter(e => e.type === ENTITY_TYPES.SYMBOL);
  
  // 1. 处理已识别的符号
  // 🆕 v6.1: 如果有交易所提示且符号不明确，需要查询验证
  for (const entity of symbolEntities) {
    const symbolValue = entity.value;
    
    // 如果符号已经带交易所前缀（如"BME:COL", "TSX:RY"），直接使用
    if (symbolValue.includes(':') || symbolValue.includes('.')) {
      symbols.push(symbolValue);
      console.log(`   ✓ 使用符号实体（已带交易所）: ${symbolValue}`);
      continue;
    }
    
    // 🆕 如果有交易所提示，查询API确认正确的交易所代码
    if (intent.exchange) {
      console.log(`   🔍 符号"${symbolValue}"需要验证交易所 (提示: ${intent.exchange})`);
      
      try {
        let resolved = false;
        const providers = DATA_SOURCE_PRIORITY.symbol_search;
        
        for (const provider of providers) {
          if (resolved) break;
          
          try {
            let resolvedSymbols = [];
            
            if (provider === 'finnhub' && FINNHUB_KEY) {
              resolvedSymbols = await lookupSymbol(symbolValue, intent.exchange);
            } else if (provider === 'twelvedata' && TWELVE_DATA_KEY) {
              resolvedSymbols = await lookupSymbolFromTwelveData(symbolValue, intent.exchange);
            } else {
              continue;
            }
            
            if (resolvedSymbols.length > 0) {
              const bestMatch = selectBestMatch(resolvedSymbols, intent.exchange, symbolValue);
              symbols.push(bestMatch.symbol);
              console.log(`   ✅ [${provider.toUpperCase()}] ${symbolValue} → ${bestMatch.symbol} (${bestMatch.description})`);
              resolved = true;
            }
          } catch (apiError) {
            console.warn(`   ⚠️  [${provider.toUpperCase()}] 失败: ${apiError.message}`);
          }
        }
        
        // 如果API查询失败，使用原始符号
        if (!resolved) {
          symbols.push(symbolValue);
          console.log(`   ⚠️  API查询失败，使用原始符号: ${symbolValue}`);
        }
      } catch (error) {
        symbols.push(symbolValue);
        console.log(`   ⚠️  验证失败，使用原始符号: ${symbolValue}`);
      }
    } else {
      // 无交易所提示，直接使用
      symbols.push(symbolValue);
      console.log(`   ✓ 使用符号实体: ${symbolValue}`);
    }
  }
  
  // 2. 解析公司名称 → 股票代码
  for (const entity of companyEntities) {
    const companyName = entity.value;
    console.log(`   🔍 查找: ${companyName}`);
    
    try {
      let resolved = false;
      
      // 🆕 v6.1: 提取查询关键词（避免公司全名太长）
      const searchQuery = extractSearchKeyword(companyName);
      console.log(`   🔑 查询关键词: "${searchQuery}"`);
      
      // Layer 1: 多数据源API查询（智能编排）
      // 🆕 v6.0: 支持Finnhub + Twelve Data双数据源
      const providers = DATA_SOURCE_PRIORITY.symbol_search;
      
      for (const provider of providers) {
        if (resolved) break; // 已找到，跳过其他数据源
        
        try {
          let resolvedSymbols = [];
          
          if (provider === 'finnhub' && FINNHUB_KEY) {
            resolvedSymbols = await lookupSymbol(searchQuery, intent.exchange);
          } else if (provider === 'twelvedata' && TWELVE_DATA_KEY) {
            resolvedSymbols = await lookupSymbolFromTwelveData(searchQuery, intent.exchange);
          } else {
            continue; // 跳过未配置的数据源
          }
          
          if (resolvedSymbols.length > 0) {
            const bestMatch = selectBestMatch(resolvedSymbols, intent.exchange, companyName);
            symbols.push(bestMatch.symbol);
            console.log(`   ✅ [${provider.toUpperCase()}] ${companyName} → ${bestMatch.symbol} (${bestMatch.description})`);
            resolved = true;
          } else {
            console.log(`   ⚠️  [${provider.toUpperCase()}] 没有找到: ${searchQuery}`);
          }
        } catch (apiError) {
          console.warn(`   ⚠️  [${provider.toUpperCase()}] 失败: ${apiError.message}`);
          // 继续尝试下一个数据源
        }
      }
      
      // Layer 2: 静态映射（备用，常见股票快速查找）
      if (!resolved) {
        const staticResults = lookupStatic(companyName);
        if (staticResults.length > 0) {
          symbols.push(staticResults[0].symbol);
          console.log(`   ✅ [静态映射] ${companyName} → ${staticResults[0].symbol}`);
          resolved = true;
        }
      }
      
      // Layer 3: 直接使用输入（用户可能直接输入了代码）
      if (!resolved) {
        const normalized = companyName.toUpperCase().trim();
        symbols.push(normalized);
        console.log(`   ⚠️  [Fallback] 使用原始输入: ${normalized}`);
      }
      
    } catch (error) {
      console.error(`   ❌ 解析失败: ${companyName} - ${error.message}`);
      // 最终Fallback：使用原始输入
      symbols.push(companyName.toUpperCase());
    }
  }
  
  // 3. 去重
  const uniqueSymbols = [...new Set(symbols)];
  
  // 🆕 v4.2: 归一化符号（欧洲后缀 → Finnhub前缀）
  const normalizedSymbols = uniqueSymbols.map(sym => normalizeSymbol(sym));
  
  console.log(`✅ [Symbol Resolver] 解析完成: [${normalizedSymbols.join(', ')}]`);
  return normalizedSymbols;
}

/**
 * 使用Finnhub Symbol Lookup API查找股票代码
 * @param {string} query - 搜索查询（公司名称或部分符号）
 * @param {string|null} exchangeHint - 交易所提示
 * @returns {Promise<Array>} - 匹配的股票列表
 */
async function lookupSymbol(query, exchangeHint = null) {
  if (!FINNHUB_KEY) {
    throw new Error("FINNHUB_API_KEY not configured");
  }
  
  const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${FINNHUB_KEY}`;
  
  console.log(`   🌐 Finnhub查询: "${query}" (交易所提示: ${exchangeHint || '无'})`);
  
  try {
    // 🛡️ 创建AbortController进行10秒超时保护
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, { 
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // 🆕 详细错误处理
    if (!response.ok) {
      const errorBody = await response.text();
      const errorMsg = `Finnhub API HTTP ${response.status}: ${errorBody.substring(0, 200)}`;
      console.error(`   ❌ ${errorMsg}`);
      
      // 🔧 区分错误类型，决定是否重试
      if (response.status === 401) {
        throw new Error('Finnhub API认证失败 - 检查FINNHUB_API_KEY');
      } else if (response.status === 429) {
        throw new Error('Finnhub API限流 - 请稍后重试');
      } else if (response.status >= 500) {
        throw new Error('Finnhub服务器错误 - 使用备用数据源');
      } else {
        throw new Error(errorMsg);
      }
    }
    
    const data = await response.json();
    const results = data.result || [];
    
    console.log(`   📊 Finnhub返回 ${results.length} 个匹配结果`);
    
    // 如果有交易所提示，优先返回该交易所的结果
    if (exchangeHint && results.length > 0) {
      const exchangeFiltered = filterByExchange(results, exchangeHint);
      if (exchangeFiltered.length > 0) {
        console.log(`   🎯 交易所筛选后: ${exchangeFiltered.length} 个结果`);
        return exchangeFiltered;
      }
    }
    
    return results;
    
  } catch (error) {
    // 🆕 不再静默失败，抛出异常让调用方处理
    console.error(`   ❌ Finnhub Symbol Lookup失败:`, error.message);
    throw error;  // ⭐ 关键：抛出异常而非返回[]
  }
}

/**
 * 🆕 v6.0: 使用Twelve Data Symbol Search API查找股票代码
 * 支持80个全球交易所（Pro计划）
 * @param {string} query - 搜索查询（公司名称或部分符号）
 * @param {string|null} exchangeHint - 交易所提示
 * @returns {Promise<Array>} - 匹配的股票列表
 */
async function lookupSymbolFromTwelveData(query, exchangeHint = null) {
  if (!TWELVE_DATA_KEY) {
    throw new Error("TWELVE_DATA_API_KEY not configured");
  }
  
  const url = `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(query)}&apikey=${TWELVE_DATA_KEY}`;
  
  console.log(`   🌐 Twelve Data查询: "${query}" (交易所提示: ${exchangeHint || '无'})`);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, { 
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // 错误处理
    if (!response.ok) {
      const errorBody = await response.text();
      const errorMsg = `Twelve Data API HTTP ${response.status}: ${errorBody.substring(0, 200)}`;
      console.error(`   ❌ ${errorMsg}`);
      
      if (response.status === 401 || response.status === 403) {
        throw new Error('Twelve Data API认证失败 - 检查TWELVE_DATA_API_KEY');
      } else if (response.status === 429) {
        throw new Error('Twelve Data API限流 - 每分钟610次已用完');
      } else if (response.status >= 500) {
        throw new Error('Twelve Data服务器错误 - 使用备用数据源');
      } else {
        throw new Error(errorMsg);
      }
    }
    
    const data = await response.json();
    
    // Twelve Data返回格式: { data: [...], status: "ok" }
    const results = data.data || [];
    
    console.log(`   📊 Twelve Data返回 ${results.length} 个匹配结果`);
    
    // 转换为标准格式（与Finnhub兼容）
    const normalizedResults = results.map(item => ({
      symbol: item.symbol,
      displaySymbol: item.symbol,
      description: item.instrument_name || item.symbol,
      type: `${item.exchange} ${item.type}`,
      exchange: item.exchange,
      country: item.country,
      currency: item.currency
    }));
    
    // 如果有交易所提示，优先返回该交易所的结果
    if (exchangeHint && normalizedResults.length > 0) {
      const exchangeFiltered = filterByExchange(normalizedResults, exchangeHint);
      if (exchangeFiltered.length > 0) {
        console.log(`   🎯 交易所筛选后: ${exchangeFiltered.length} 个结果`);
        return exchangeFiltered;
      }
    }
    
    return normalizedResults;
    
  } catch (error) {
    console.error(`   ❌ Twelve Data Symbol Search失败:`, error.message);
    throw error;
  }
}

/**
 * 根据交易所筛选结果
 * 🔧 v6.2: 修复Twelve Data过滤逻辑 - 正确检查exchange和country字段
 */
function filterByExchange(results, exchangeHint) {
  const exchangeKeywords = {
    [EXCHANGES.US]: {
      exchanges: ['nasdaq', 'nyse', 'amex', 'otc', 'us'],
      countries: ['united states', 'usa'],
      symbols: []
    },
    [EXCHANGES.SPAIN]: {
      exchanges: ['madrid', 'bmad', 'bme', 'mta', 'spain'],
      countries: ['spain'],
      symbols: ['.mc', '.bcn']
    },
    [EXCHANGES.HK]: {
      exchanges: ['hong kong', 'hk', 'hkex', 'hkg'],
      countries: ['hong kong'],
      symbols: ['.hk']
    },
    [EXCHANGES.CN]: {
      exchanges: ['shanghai', 'shenzhen', 'china', 'ss', 'sz', 'sse', 'szse'],
      countries: ['china'],
      symbols: ['.ss', '.sz']
    },
    [EXCHANGES.UK]: {
      exchanges: ['london', 'lse', 'uk'],
      countries: ['united kingdom', 'uk'],
      symbols: ['.l']
    },
    [EXCHANGES.EU]: {
      exchanges: ['euronext', 'paris', 'amsterdam', 'frankfurt', 'xetra'],
      countries: ['france', 'netherlands', 'germany'],
      symbols: ['.pa', '.as', '.de']
    },
    [EXCHANGES.JP]: {
      exchanges: ['tokyo', 'japan', 'tyo', 'tse'],
      countries: ['japan'],
      symbols: ['.t']
    },
    'canada': {
      exchanges: ['tsx', 'tsxv', 'toronto'],
      countries: ['canada'],
      symbols: ['.to', '.v']
    },
    'brazil': {
      exchanges: ['bovespa', 'b3', 'bvmf'],
      countries: ['brazil'],
      symbols: ['.sa']
    },
    'australia': {
      exchanges: ['asx', 'australia'],
      countries: ['australia'],
      symbols: ['.ax']
    }
  };
  
  const criteria = exchangeKeywords[exchangeHint] || exchangeKeywords[exchangeHint?.toLowerCase()];
  
  if (!criteria) {
    console.log(`   ⚠️  未知交易所提示: ${exchangeHint}，返回所有结果`);
    return results;
  }
  
  const filtered = results.filter(result => {
    // 🔧 关键修复：检查正确的字段
    const resultExchange = (result.exchange || '').toLowerCase();
    const resultCountry = (result.country || '').toLowerCase();
    const resultSymbol = (result.symbol || result.displaySymbol || '').toLowerCase();
    const resultType = (result.type || '').toLowerCase();
    
    // 检查交易所名称匹配
    const exchangeMatch = criteria.exchanges.some(kw => 
      resultExchange.includes(kw) || resultType.includes(kw)
    );
    
    // 检查国家匹配
    const countryMatch = criteria.countries.some(kw => 
      resultCountry.includes(kw)
    );
    
    // 检查符号后缀匹配（如.MC, .TO等）
    const symbolMatch = criteria.symbols.some(suffix => 
      resultSymbol.includes(suffix)
    );
    
    const matched = exchangeMatch || countryMatch || symbolMatch;
    
    if (matched) {
      console.log(`   ✅ 匹配: ${result.symbol} (交易所: ${result.exchange}, 国家: ${result.country})`);
    }
    
    return matched;
  });
  
  return filtered;
}

/**
 * 🆕 统一的交易所前缀格式化函数
 * @param {string} symbol - 原始符号
 * @param {string} exchange - 交易所代码
 * @returns {string} - 格式化后的符号（带交易所前缀）
 */
function formatSymbolWithExchange(symbol, exchange) {
  if (!symbol) return null;

  const sym = symbol.trim().toUpperCase();
  const ex = (exchange || '').trim().toUpperCase();

  // 西班牙交易所（BME / BMEX / XMAD / Bolsa de Madrid）
  if (
    ex === 'BME' ||
    ex === 'BMEX' ||
    ex === 'XMAD' ||
    ex.includes('BOLSA DE MADRID') ||
    ex.includes('MADRID')
  ) {
    return `BME:${sym}`;
  }

  // 纳斯达克
  if (ex === 'NASDAQ' || ex === 'XNAS' || ex.includes('NASDAQ')) {
    return `NASDAQ:${sym}`;
  }

  // 纽约证券交易所
  if (ex === 'NYSE' || ex === 'XNYS' || ex.includes('NEW YORK')) {
    return `NYSE:${sym}`;
  }

  // 多伦多证券交易所
  if (ex === 'TSX' || ex === 'XTSE' || ex === 'TSE') {
    return `TSX:${sym}`;
  }

  // OTC市场
  if (ex === 'OTC' || ex.includes('OTC')) {
    return `OTC:${sym}`;
  }

  // 默认行为：如果有exchange且符号未包含前缀，添加前缀
  if (ex && !sym.includes(':')) {
    return `${ex}:${sym}`;
  }

  return sym;
}

/**
 * 选择最佳匹配
 * @param {Array} matches - Finnhub返回的匹配列表
 * @param {string|null} exchangeHint - 交易所提示
 * @param {string} originalQuery - 原始查询
 * @returns {Object} - 最佳匹配 {symbol, description, exchange}
 */
function selectBestMatch(matches, exchangeHint, originalQuery) {
  if (matches.length === 0) {
    throw new Error("No matches found");
  }
  
  // 如果只有一个匹配，使用格式化函数处理
  if (matches.length === 1) {
    const match = matches[0];
    const rawSymbol = match.symbol || match.displaySymbol;
    const exchange = match.exchange || match.type;
    const finalSymbol = formatSymbolWithExchange(rawSymbol, exchange);
    
    console.log(`   📌 单个匹配，最终符号: ${finalSymbol}`);
    
    // 🆕 单个匹配也输出调试日志
    if (process.env.ENABLE_SYMBOL_DEBUG === 'true') {
      console.log('[SYMBOL_DEBUG] resolution_debug', JSON.stringify({
        input: originalQuery,
        exchange_hint: exchangeHint,
        candidates: [{
          symbol: rawSymbol,
          exchange: exchange,
          country: match.country,
          description: match.description || match.instrument_name,
          score: 1000,
          source: match.mic_code ? 'twelvedata' : 'finnhub'
        }],
        selected: {
          symbol: rawSymbol,
          exchange: exchange,
          score: 1000,
          description: match.description || match.instrument_name
        },
        final_symbol: finalSymbol
      }, null, 2));
    }
    
    return {
      symbol: finalSymbol,
      description: match.description || match.instrument_name,
      exchange: exchange
    };
  }
  
  // 🆕 v6.1: 改进评分机制 - 交易所匹配优先级大幅提升
  const scored = matches.map(match => {
    let score = 0;
    
    // 1. 交易所匹配（最高优先级）⭐
    if (exchangeHint) {
      const matchSymbol = (match.displaySymbol || match.symbol || '').toLowerCase();
      const matchExchange = (match.exchange || match.type || '').toLowerCase();
      const matchCountry = (match.country || '').toLowerCase();
      
      // 🆕 扩展交易所映射表（支持Twelve Data + Finnhub）
      const exchangeMap = {
        'spain': {
          exchanges: ['bme', 'madrid', 'mta', 'bmad'],
          suffixes: ['.mc', '.bcn'],
          countries: ['spain']
        },
        'us': {
          exchanges: ['nasdaq', 'nyse', 'amex', 'otc', 'us'],
          suffixes: [],
          countries: ['united states']
        },
        'canada': {
          exchanges: ['tsx', 'tsxv', 'toronto'],
          suffixes: ['.to', '.v'],
          countries: ['canada']
        },
        'hk': {
          exchanges: ['hkex', 'hong kong', 'hkg'],
          suffixes: ['.hk'],
          countries: ['hong kong']
        },
        'cn': {
          exchanges: ['shanghai', 'shenzhen', 'sse', 'szse'],
          suffixes: ['.ss', '.sz'],
          countries: ['china']
        },
        'brazil': {
          exchanges: ['bovespa', 'b3', 'bvmf'],
          suffixes: [],
          countries: ['brazil']
        },
        'australia': {
          exchanges: ['asx'],
          suffixes: ['.ax'],
          countries: ['australia']
        }
      };
      
      const hintKey = exchangeHint.toLowerCase();
      const criteria = exchangeMap[hintKey];
      
      if (criteria) {
        // 交易所代码匹配（最高分）
        if (criteria.exchanges.some(ex => matchExchange.includes(ex))) {
          score += 100; // 🔥 之前只有10分，现在100分确保优先
        }
        // 国家匹配
        if (criteria.countries.some(country => matchCountry.includes(country))) {
          score += 80;
        }
        // 符号后缀匹配
        if (criteria.suffixes.some(suffix => matchSymbol.endsWith(suffix))) {
          score += 60;
        }
      }
    }
    
    // 2. 🆕 精确符号匹配（最高优先级）
    const matchSymbol = (match.symbol || match.displaySymbol || '').toLowerCase();
    const querySymbol = originalQuery.toLowerCase().trim();
    
    if (matchSymbol === querySymbol) {
      score += 1000;  // 精确匹配 → 绝对优先
      console.log(`   🎯 精确符号匹配: ${match.symbol}`);
    }
    
    // 3. 名称相似度
    const descLower = (match.description || match.instrument_name || '').toLowerCase();
    const queryLower = originalQuery.toLowerCase();
    
    if (descLower.includes(queryLower)) score += 5;
    if (descLower.startsWith(queryLower)) score += 3;
    
    // 4. 优先股票而非其他类型
    const typeStr = (match.type || '').toLowerCase();
    if (typeStr.includes('common stock') || typeStr.includes('stock')) score += 2;
    
    return { ...match, score };
  });
  
  // 按分数排序
  scored.sort((a, b) => b.score - a.score);
  
  const best = scored[0];
  
  console.log(`   🏆 最佳匹配: ${best.symbol} (分数: ${best.score})`);
  
  // 🆕 使用统一的前缀格式化函数
  const finalSymbol = formatSymbolWithExchange(
    best.symbol || best.displaySymbol, 
    best.exchange || best.type
  );
  
  console.log(`   📌 最终符号: ${finalSymbol}`);
  
  // 🆕 结构化调试日志（仅在debug模式下）
  if (process.env.ENABLE_SYMBOL_DEBUG === 'true') {
    console.log('[SYMBOL_DEBUG] resolution_debug', JSON.stringify({
      input: originalQuery,
      exchange_hint: exchangeHint,
      candidates: scored.slice(0, 10).map(c => ({
        symbol: c.symbol || c.displaySymbol,
        exchange: c.exchange || c.type,
        country: c.country,
        description: c.description || c.instrument_name,
        score: c.score,
        source: c.mic_code ? 'twelvedata' : 'finnhub'
      })),
      selected: {
        symbol: best.symbol || best.displaySymbol,
        exchange: best.exchange || best.type,
        score: best.score,
        description: best.description || best.instrument_name
      },
      final_symbol: finalSymbol
    }, null, 2));
  }
  
  return {
    symbol: finalSymbol,
    description: best.description || best.instrument_name,
    exchange: best.exchange || best.type
  };
}

/**
 * 静态映射表 - 用于常见股票的快速查找（备用方案）
 * 这不是主要方法，只是在Finnhub失败时的备用
 */
const STATIC_SYMBOL_MAP = {
  // 🆕 直接代码映射（1:1）- 支持直接输入股票代码
  'aapl': 'AAPL', 'nvda': 'NVDA', 'tsla': 'TSLA', 'msft': 'MSFT', 'googl': 'GOOGL',
  'amzn': 'AMZN', 'meta': 'META', 'nflx': 'NFLX', 'amd': 'AMD', 'intc': 'INTC',
  
  // 🆕 OTC股票（补充IGTA, SCPJ等）
  'igta': 'OTC:IGTA',       // Inception Growth Acquisition
  'scpj': 'OTC:SCPJ',       // Scope Industries
  
  // 🆕 加拿大主要股票
  'ry': 'TSX:RY',           // Royal Bank of Canada
  'td': 'TSX:TD',           // Toronto-Dominion Bank
  'bns': 'TSX:BNS',         // Bank of Nova Scotia
  'bmo': 'TSX:BMO',         // Bank of Montreal
  'shop': 'TSX:SHOP',       // Shopify
  'shopify': 'TSX:SHOP',
  'enb': 'TSX:ENB',         // Enbridge
  'cnq': 'TSX:CNQ',         // Canadian Natural Resources
  '加拿大皇家银行': 'TSX:RY',
  '多伦多道明银行': 'TSX:TD',
  
  // 西班牙主要股票（使用美国OTC ADR代码，Finnhub免费版不支持欧洲交易所）
  'grifols': 'GRFS',        // Grifols ADR (OTC)
  'sabadell': 'BNDSY',      // Banco de Sabadell ADR (OTC)
  'santander': 'SAN',       // Banco Santander (NYSE)
  'bbva': 'BBVXF',          // BBVA ADR (OTC)
  'telefonica': 'TEF',      // Telefonica (NYSE)
  'iberdrola': 'IBDRY',     // Iberdrola ADR (OTC)
  'repsol': 'REPYY',        // Repsol ADR (OTC)
  'inditex': 'IDEXY',       // Inditex ADR (OTC)
  
  // 西班牙中文名称映射
  '电力公司': 'IBDRY',
  '西班牙电信': 'TEF',
  '桑坦德': 'SAN',
  '毕尔巴鄂': 'BBVXF',
  
  // 美国常见股票（英文+中文）
  'apple': 'AAPL',
  '苹果': 'AAPL',       // 🆕 添加苹果中文映射
  'microsoft': 'MSFT',
  'tesla': 'TSLA',
  'nvidia': 'NVDA',
  '特斯拉': 'TSLA',
  '微软': 'MSFT',
  '谷歌': 'GOOGL', 'google': 'GOOGL', '字母表': 'GOOGL', 'alphabet': 'GOOGL',
  '亚马逊': 'AMZN', 'amazon': 'AMZN',
  '英伟达': 'NVDA',
  '脸书': 'META', 'facebook': 'META', 'meta': 'META',
  '奈飞': 'NFLX', 'netflix': 'NFLX',
  '英特尔': 'INTC', 'intel': 'INTC',
  '高通': 'QCOM', 'qualcomm': 'QCOM',
  '台积电': 'TSM', 'tsmc': 'TSM',
  '可口可乐': 'KO', 'coca cola': 'KO', 'coke': 'KO',
  '迪士尼': 'DIS', 'disney': 'DIS',
  '波音': 'BA', 'boeing': 'BA',
  '耐克': 'NKE', 'nike': 'NKE',
  '星巴克': 'SBUX', 'starbucks': 'SBUX',
  '麦当劳': 'MCD', 'mcdonalds': 'MCD',
  '通用电气': 'GE', 'ge': 'GE',
  '摩根大通': 'JPM', 'jpmorgan': 'JPM',
  '高盛': 'GS', 'goldman': 'GS',
  '辉瑞': 'PFE', 'pfizer': 'PFE',
  '强生': 'JNJ', 'johnson': 'JNJ',
  '沃尔玛': 'WMT', 'walmart': 'WMT',
  '家得宝': 'HD', 'home depot': 'HD',
  'amd': 'AMD', '超微': 'AMD',
  '埃克森': 'XOM', 'exxon': 'XOM',
  '雪佛龙': 'CVX', 'chevron': 'CVX',
  '宝洁': 'PG', 'procter': 'PG',
  '维萨': 'V', 'visa': 'V',
  '万事达': 'MA', 'mastercard': 'MA',
  '伯克希尔': 'BRK.B', 'berkshire': 'BRK.B',
  '联合健康': 'UNH', 'unitedhealth': 'UNH',
  '礼来': 'LLY', 'eli lilly': 'LLY',
  '艾伯维': 'ABBV', 'abbvie': 'ABBV',
  '美国银行': 'BAC', 'bank of america': 'BAC',
  
  // 香港常见股票（英文+中文）
  'tencent': '0700.HK', '腾讯': '0700.HK',
  'alibaba': '9988.HK', '阿里巴巴': '9988.HK',
  '小米': '1810.HK', 'xiaomi': '1810.HK',
  '美团': '3690.HK', 'meituan': '3690.HK',
  '京东': '9618.HK', 'jd': '9618.HK',
  '比亚迪': '1211.HK', 'byd': '1211.HK',
  '中国移动': '0941.HK',
  '中国电信': '0728.HK',
  '中国联通': '0762.HK',
  '工商银行': '1398.HK',
  '建设银行': '0939.HK',
  '中国银行': '3988.HK',
  '农业银行': '1288.HK',
  '中国平安': '2318.HK',
  '中国人寿': '2628.HK',
  '中石油': '0857.HK',
  '中石化': '0386.HK',
  '中国神华': '1088.HK'
};

/**
 * 🆕 v5.0: 智能分层查找（精确 → 模糊 → Levenshtein）
 * 优先级：
 * 1. 精确ticker匹配（AAPL → AAPL）
 * 2. 别名字典匹配（苹果 → AAPL）
 * 3. Levenshtein模糊匹配（Appple → Apple → AAPL）
 */
function lookupStatic(query) {
  const normalized = query.toLowerCase().trim();
  
  // Layer 1: 精确ticker匹配（最快）
  if (STATIC_SYMBOL_MAP[normalized]) {
    console.log(`   🎯 [精确匹配] ${query} → ${STATIC_SYMBOL_MAP[normalized]}`);
    return [{ symbol: STATIC_SYMBOL_MAP[normalized], description: query, type: 'exact' }];
  }
  
  // Layer 2: 别名部分匹配（支持中文、缩写）
  for (const [key, symbol] of Object.entries(STATIC_SYMBOL_MAP)) {
    // 双向包含（支持"苹果公司" → "apple"）
    if (key.includes(normalized) || normalized.includes(key)) {
      // 🆕 最小匹配长度过滤（避免"a" → "apple"）
      if (key.length >= 2 && normalized.length >= 2) {
        console.log(`   📚 [别名匹配] ${query} → ${symbol} (via ${key})`);
        return [{ symbol, description: query, type: 'alias' }];
      }
    }
  }
  
  // Layer 3: Levenshtein模糊匹配（容错拼写错误）
  const fuzzyMatches = [];
  for (const [key, symbol] of Object.entries(STATIC_SYMBOL_MAP)) {
    const distance = levenshteinDistance(normalized, key);
    const maxDistance = Math.max(2, Math.floor(key.length * 0.3)); // 30%容错
    
    if (distance <= maxDistance && key.length >= 3) {
      fuzzyMatches.push({ symbol, key, distance, description: query });
    }
  }
  
  if (fuzzyMatches.length > 0) {
    // 返回距离最小的匹配
    fuzzyMatches.sort((a, b) => a.distance - b.distance);
    const best = fuzzyMatches[0];
    console.log(`   🔍 [模糊匹配] ${query} → ${best.symbol} (距离: ${best.distance}, via ${best.key})`);
    return [{ symbol: best.symbol, description: best.description, type: 'fuzzy' }];
  }
  
  return [];
}

/**
 * Levenshtein距离算法（编辑距离）
 * 计算两个字符串的相似度
 */
function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = [];
  
  // 初始化矩阵
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  // 填充矩阵
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // 删除
        matrix[i][j - 1] + 1,      // 插入
        matrix[i - 1][j - 1] + cost // 替换
      );
    }
  }
  
  return matrix[len1][len2];
}

module.exports = {
  resolveChineseCompanyName,
  resolveSymbols,
  lookupSymbol,
  lookupSymbolFromTwelveData,
  selectBestMatch,
  STATIC_SYMBOL_MAP
};
