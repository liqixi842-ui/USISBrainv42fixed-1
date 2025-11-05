// ====== Symbol Resolver ======
// 智能股票代码解析器 - 使用Finnhub Symbol Lookup API
// 将公司名称（如"Grifols", "Sabadell"）转换为正确的股票代码

const fetch = require("node-fetch");
const { ENTITY_TYPES, EXCHANGES } = require("./schemas");

const FINNHUB_KEY = process.env.FINNHUB_API_KEY;

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
  
  // 1. 直接使用已识别的符号
  for (const entity of symbolEntities) {
    symbols.push(entity.value);
    console.log(`   ✓ 使用符号实体: ${entity.value}`);
  }
  
  // 2. 解析公司名称 → 股票代码
  for (const entity of companyEntities) {
    const companyName = entity.value;
    console.log(`   🔍 查找公司: ${companyName}`);
    
    try {
      const resolvedSymbols = await lookupSymbol(companyName, intent.exchange);
      
      if (resolvedSymbols.length > 0) {
        const bestMatch = selectBestMatch(resolvedSymbols, intent.exchange, companyName);
        symbols.push(bestMatch.symbol);
        console.log(`   ✓ 找到符号: ${bestMatch.symbol} (${bestMatch.description})`);
      } else {
        console.log(`   ⚠️  未找到符号: ${companyName}`);
      }
    } catch (error) {
      console.error(`   ❌ 查找失败: ${companyName} - ${error.message}`);
    }
  }
  
  // 3. 去重
  const uniqueSymbols = [...new Set(symbols)];
  
  console.log(`✅ [Symbol Resolver] 解析完成: [${uniqueSymbols.join(', ')}]`);
  return uniqueSymbols;
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
    const response = await fetch(url, { timeout: 10000 });
    
    if (!response.ok) {
      throw new Error(`Finnhub API error: ${response.status}`);
    }
    
    const data = await response.json();
    const results = data.result || [];
    
    console.log(`   📊 找到 ${results.length} 个匹配结果`);
    
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
    console.error(`   ❌ Finnhub查询失败:`, error.message);
    return [];
  }
}

/**
 * 根据交易所筛选结果
 */
function filterByExchange(results, exchangeHint) {
  const exchangeKeywords = {
    [EXCHANGES.US]: ['us', 'nasdaq', 'nyse', 'american'],
    [EXCHANGES.SPAIN]: ['madrid', 'bmad', 'spain', 'mc', 'bcn'],
    [EXCHANGES.HK]: ['hong kong', 'hk', 'hkex'],
    [EXCHANGES.CN]: ['shanghai', 'shenzhen', 'china', 'ss', 'sz'],
    [EXCHANGES.UK]: ['london', 'lse', 'uk'],
    [EXCHANGES.EU]: ['euronext', 'paris', 'amsterdam', 'frankfurt'],
    [EXCHANGES.JP]: ['tokyo', 'japan', 'tyo']
  };
  
  const keywords = exchangeKeywords[exchangeHint] || [];
  
  if (keywords.length === 0) return results;
  
  return results.filter(result => {
    const exchangeLower = (result.displaySymbol || '').toLowerCase();
    const typeLower = (result.type || '').toLowerCase();
    
    return keywords.some(kw => 
      exchangeLower.includes(kw) || typeLower.includes(kw)
    );
  });
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
  
  // 如果只有一个匹配，直接返回
  if (matches.length === 1) {
    return {
      symbol: matches[0].symbol || matches[0].displaySymbol,
      description: matches[0].description,
      exchange: matches[0].type
    };
  }
  
  // 评分机制：交易所匹配 + 名称相似度
  const scored = matches.map(match => {
    let score = 0;
    
    // 1. 交易所匹配（如果有提示）
    if (exchangeHint) {
      const matchExchange = (match.displaySymbol || '').toLowerCase();
      const exchangeMap = {
        'Spain': ['.mc', '.bcn', 'madrid'],
        'US': ['nasdaq', 'nyse', 'us'],
        'HK': ['.hk', 'hong kong'],
        'CN': ['.ss', '.sz', 'shanghai', 'shenzhen']
      };
      
      const keywords = exchangeMap[exchangeHint] || [];
      if (keywords.some(kw => matchExchange.includes(kw))) {
        score += 10;
      }
    }
    
    // 2. 名称相似度（简单字符串包含）
    const descLower = (match.description || '').toLowerCase();
    const queryLower = originalQuery.toLowerCase();
    
    if (descLower.includes(queryLower)) score += 5;
    if (descLower.startsWith(queryLower)) score += 3;
    
    // 3. 优先股票而非其他类型
    if ((match.type || '').toLowerCase().includes('common stock')) score += 2;
    
    return { ...match, score };
  });
  
  // 按分数排序
  scored.sort((a, b) => b.score - a.score);
  
  const best = scored[0];
  
  console.log(`   🏆 最佳匹配: ${best.symbol} (分数: ${best.score})`);
  
  return {
    symbol: best.symbol || best.displaySymbol,
    description: best.description,
    exchange: best.type
  };
}

/**
 * 静态映射表 - 用于常见股票的快速查找（备用方案）
 * 这不是主要方法，只是在Finnhub失败时的备用
 */
const STATIC_SYMBOL_MAP = {
  // 西班牙主要股票
  'grifols': 'GRF.MC',
  'sabadell': 'SAB.MC',
  'santander': 'SAN.MC',
  'bbva': 'BBVA.MC',
  'telefonica': 'TEF.MC',
  'iberdrola': 'IBE.MC',
  'repsol': 'REP.MC',
  'inditex': 'ITX.MC',
  
  // 中文名称映射
  '电力公司': 'IBE.MC',
  '西班牙电信': 'TEF.MC',
  '桑坦德': 'SAN.MC',
  '毕尔巴鄂': 'BBVA.MC',
  
  // 美国常见股票
  'apple': 'AAPL',
  'microsoft': 'MSFT',
  'tesla': 'TSLA',
  'nvidia': 'NVDA',
  
  // 香港常见股票
  'tencent': '0700.HK',
  'alibaba': '9988.HK'
};

/**
 * 使用静态映射表查找（备用方案）
 */
function lookupStatic(query) {
  const lowerQuery = query.toLowerCase();
  
  for (const [key, symbol] of Object.entries(STATIC_SYMBOL_MAP)) {
    if (key.includes(lowerQuery) || lowerQuery.includes(key)) {
      console.log(`   📚 静态映射匹配: ${query} → ${symbol}`);
      return [{ symbol, description: query, type: 'static' }];
    }
  }
  
  return [];
}

module.exports = {
  resolveSymbols,
  lookupSymbol,
  STATIC_SYMBOL_MAP
};
