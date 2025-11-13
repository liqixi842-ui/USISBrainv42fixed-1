// ====== Symbol Resolver ======
// 智能股票代码解析器 - 使用Finnhub Symbol Lookup API
// 将公司名称（如"Grifols", "Sabadell"）转换为正确的股票代码

const fetch = require("node-fetch");
const { ENTITY_TYPES, EXCHANGES } = require("./schemas");

const FINNHUB_KEY = process.env.FINNHUB_API_KEY;

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
      // 优先尝试静态映射（更快、更准确）
      const staticResults = lookupStatic(companyName);
      if (staticResults.length > 0) {
        symbols.push(staticResults[0].symbol);
        console.log(`   ✓ 静态映射找到: ${staticResults[0].symbol}`);
        continue;
      }
      
      // 如果静态映射失败，尝试Finnhub API
      try {
        const resolvedSymbols = await lookupSymbol(companyName, intent.exchange);
        
        if (resolvedSymbols.length > 0) {
          const bestMatch = selectBestMatch(resolvedSymbols, intent.exchange, companyName);
          symbols.push(bestMatch.symbol);
          console.log(`   ✓ Finnhub找到: ${bestMatch.symbol} (${bestMatch.description})`);
        } else {
          console.log(`   ⚠️  未找到符号: ${companyName}`);
        }
      } catch (apiError) {
        // 🛡️ Fallback: API失败时，将公司名作为符号尝试（适用于已知代码如AAPL, TSLA等）
        console.log(`   ⚠️  Finnhub API失败，尝试使用公司名作为代码: ${companyName}`);
        symbols.push(companyName.toUpperCase());
      }
    } catch (error) {
      console.error(`   ❌ 查找失败: ${companyName} - ${error.message}`);
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
  resolveSymbols,
  lookupSymbol,
  STATIC_SYMBOL_MAP
};
