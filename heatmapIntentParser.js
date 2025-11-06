// ====== 智能热力图意图解析器 ======
// v4.3: LLM驱动的自然语言解析（地区/指数/行业）

const { generateWithGPT5 } = require("./gpt5Brain");

// 地区→指数默认映射
const REGION_INDEX_MAP = {
  'US': 'SPX500',
  'JP': 'NIKKEI225',
  'ES': 'IBEX35',
  'DE': 'DAX40',
  'FR': 'CAC40',
  'UK': 'FTSE100',
  'EU': 'EURO50',
  'HK': 'HSI',
  'CN': 'CSI300',
  'IN': 'NIFTY50'
};

// 指数→地区反向映射（防串台）
const INDEX_REGION_MAP = {
  'SPX500': 'US', 'NASDAQ100': 'US', 'DJ30': 'US',
  'NIKKEI225': 'JP',
  'IBEX35': 'ES',
  'DAX40': 'DE',
  'CAC40': 'FR',
  'FTSE100': 'UK',
  'EURO50': 'EU',
  'HSI': 'HK',
  'CSI300': 'CN',
  'NIFTY50': 'IN'
};

// 行业枚举
const SECTORS = [
  'technology', 'financials', 'healthcare', 'industrials', 'energy',
  'materials', 'consumer_discretionary', 'consumer_staples',
  'communication_services', 'utilities', 'real_estate'
];

// 行业中文名称
const SECTOR_CN_NAMES = {
  'technology': '科技',
  'financials': '金融',
  'healthcare': '医疗保健',
  'industrials': '工业',
  'energy': '能源',
  'materials': '材料',
  'consumer_discretionary': '可选消费',
  'consumer_staples': '必需消费',
  'communication_services': '通信服务',
  'utilities': '公用事业',
  'real_estate': '房地产'
};

/**
 * 🔍 轻量级解析（仅规则，不调用LLM）- v5.0 完整映射体系
 * @param {string} text - 用户输入文本
 * @returns {Object} 解析结果
 */
function extractHeatmapQueryRulesOnly(text) {
  const raw = text || "";
  const norm = raw.normalize("NFKC");
  const lc = norm.toLowerCase();
  
  // 1️⃣ 市场映射表（20+全球市场）
  const marketMap = {
    // 美洲
    'us|美股|美国|spx|sp500|标普': { index: 'SPX500', name: '标普500', region: 'US' },
    'nasdaq|纳斯达克|纳指': { index: 'NAS100', name: '纳斯达克100', region: 'US' },
    'dow|道指|道琼斯': { index: 'DJI', name: '道琼斯', region: 'US' },
    'russell|罗素': { index: 'RUT', name: '罗素2000', region: 'US' },
    'tsx|加拿大': { index: 'TSX', name: '加拿大TSX', region: 'CA' },
    'brazil|巴西': { index: 'IBOV', name: '巴西IBOV', region: 'BR' },
    'mexico|墨西哥': { index: 'MEXBOL', name: '墨西哥MEXBOL', region: 'MX' },
    
    // 欧洲
    'spain|西班牙|ibex': { index: 'IBEX35', name: '西班牙IBEX35', region: 'ES' },
    'germany|德国|dax': { index: 'DAX', name: '德国DAX', region: 'DE' },
    'france|法国|cac': { index: 'CAC40', name: '法国CAC40', region: 'FR' },
    'uk|英国|ftse|富时': { index: 'FTSE', name: '英国富时', region: 'UK' },
    'italy|意大利': { index: 'FTSEMIB', name: '意大利FTSEMIB', region: 'IT' },
    'netherlands|荷兰': { index: 'AEX', name: '荷兰AEX', region: 'NL' },
    'switzerland|瑞士': { index: 'SMI', name: '瑞士SMI', region: 'CH' },
    
    // 亚洲
    'japan|日本|nikkei|日経': { index: 'NIKKEI225', name: '日经225', region: 'JP' },
    'hk|香港|恒生|hang seng|hsi': { index: 'HSI', name: '恒生指数', region: 'HK' },
    'china|中国|上证': { index: 'SSE50', name: '上证50', region: 'CN' },
    'shenzhen|深圳|深证': { index: 'SZI', name: '深证成指', region: 'CN' },
    'korea|韩国|kospi': { index: 'KOSPI', name: '韩国KOSPI', region: 'KR' },
    'taiwan|台湾|twii': { index: 'TWII', name: '台湾加权', region: 'TW' },
    'india|印度|nifty': { index: 'NIFTY', name: '印度NIFTY', region: 'IN' },
    'australia|澳洲|澳大利亚': { index: 'AS51', name: '澳洲AS51', region: 'AU' },
    
    // 其他
    'russia|俄罗斯': { index: 'IMOEX', name: '俄罗斯IMOEX', region: 'RU' },
    'singapore|新加坡': { index: 'STI', name: '新加坡STI', region: 'SG' }
  };
  
  // 2️⃣ 板块映射表（10+行业）
  const sectorMap = {
    '科技|技术|technology|tech': 'technology',
    '金融|financials|finance|银行': 'financial',
    '医疗|healthcare|health|保健': 'healthcare',
    '能源|energy|石油|oil': 'energy',
    '原材料|materials|材料': 'basic_materials',
    '工业|industrials|制造': 'industrials',
    '消费|consumer|零售': 'consumer_cyclical',
    '防御|defensive|日用': 'consumer_defensive',
    '公用|utilities|电力': 'utilities',
    '房地产|real estate|地产': 'real_estate',
    '电信|telecom|通信': 'telecommunications'
  };
  
  // 3️⃣ 精确板块数据集映射（标普500子行业）
  const sectorDatasetMap = {
    // 美股板块精确映射
    '美股金融|us financials|美国金融': { 
      dataset: 'SP500-40', 
      name: '标普500金融板块',
      components: ['JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'BLK', 'SCHW']
    },
    '美股科技|us technology|美国科技': { 
      dataset: 'SP500-45', 
      name: '标普500信息技术',
      components: ['AAPL', 'MSFT', 'NVDA', 'AVGO', 'CRM', 'ORCL', 'ADBE']
    },
    '美股医疗|us healthcare|美国医疗': { 
      dataset: 'SP500-35', 
      name: '标普500医疗保健',
      components: ['UNH', 'JNJ', 'LLY', 'ABBV', 'MRK', 'TMO', 'ABT']
    },
    '美股能源|us energy|美国能源': { 
      dataset: 'SP500-10', 
      name: '标普500能源',
      components: ['XOM', 'CVX', 'COP', 'EOG', 'SLB', 'MPC', 'PSX']
    },
    '美股消费|us consumer|美国消费': { 
      dataset: 'SP500-25', 
      name: '标普500可选消费',
      components: ['AMZN', 'TSLA', 'HD', 'MCD', 'NKE', 'SBUX', 'TJX']
    },
    '美股工业|us industrials|美国工业': { 
      dataset: 'SP500-20', 
      name: '标普500工业',
      components: ['UNP', 'HON', 'UPS', 'RTX', 'LMT', 'BA', 'CAT']
    },
    '美股通信|us communication|美国通信': { 
      dataset: 'SP500-50', 
      name: '标普500通信服务',
      components: ['GOOGL', 'META', 'NFLX', 'DIS', 'CMCSA', 'T', 'VZ']
    },
    '美股材料|us materials|美国材料': { 
      dataset: 'SP500-15', 
      name: '标普500材料',
      components: ['LIN', 'APD', 'ECL', 'SHW', 'FCX', 'NEM', 'DOW']
    },
    '美股公用|us utilities|美国公用': { 
      dataset: 'SP500-55', 
      name: '标普500公用事业',
      components: ['NEE', 'DUK', 'SO', 'D', 'AEP', 'EXC', 'SRE']
    },
    '美股地产|us real estate|美国地产': { 
      dataset: 'SP500-60', 
      name: '标普500房地产',
      components: ['PLD', 'AMT', 'CCI', 'EQIX', 'PSA', 'WELL', 'DLR']
    }
  };
  
  const parsed = {
    region: 'AUTO',
    index: 'AUTO',
    sector: 'AUTO',
    dataset: null,
    sectorName: null,
    components: [],
    confidence: 0.6,
    rules_fired: [],
    rationale: '规则引擎v5.0完整映射'
  };
  
  // 4️⃣ 精确板块数据集匹配（优先级最高）
  for (const [pattern, config] of Object.entries(sectorDatasetMap)) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(lc)) {
      parsed.dataset = config.dataset;
      parsed.sectorName = config.name;
      parsed.components = config.components;
      parsed.index = 'SPX500'; // 基础指数
      parsed.region = 'US';
      parsed.sector = config.dataset.split('-')[1]; // 提取GICS代码
      parsed.confidence = 0.95;
      parsed.rules_fired.push(`精确板块匹配: ${config.name} (${config.dataset})`);
      parsed.rationale = `精确匹配到${config.name}，使用TradingView数据集${config.dataset}`;
      return parsed; // 立即返回，优先级最高
    }
  }
  
  // 5️⃣ 智能市场匹配
  for (const [pattern, data] of Object.entries(marketMap)) {
    const regex = new RegExp(pattern, 'iu');
    if (regex.test(norm)) {
      parsed.index = data.index;
      parsed.region = data.region;
      parsed.confidence = 0.85;
      parsed.rules_fired.push(`match_market_${data.index}`);
      parsed.rationale = `检测到${data.name}关键词`;
      console.log(`🎯 [市场匹配] ${pattern} → ${data.name} (${data.index})`);
      break;
    }
  }
  
  // 4️⃣ 智能板块匹配
  for (const [pattern, sector] of Object.entries(sectorMap)) {
    const regex = new RegExp(pattern, 'iu');
    if (regex.test(norm)) {
      parsed.sector = sector;
      parsed.rules_fired.push(`match_sector_${sector}`);
      console.log(`🎯 [板块匹配] ${pattern} → ${sector}`);
      break;
    }
  }
  
  // 5️⃣ 特殊组合逻辑
  // 纳斯达克+科技股优化
  if ((parsed.sector === 'technology' || /科技/.test(norm)) && parsed.index === 'SPX500') {
    parsed.index = 'NAS100';
    parsed.region = 'US';
    parsed.rules_fired.push('optimize_tech_to_nasdaq');
    console.log(`💡 [智能优化] 科技板块 → NAS100`);
  }
  
  // A股特定逻辑
  if (/a股|沪深/.test(norm)) {
    parsed.index = /深圳|深证/.test(norm) ? 'SZI' : 'SSE50';
    parsed.region = 'CN';
    parsed.rules_fired.push('detect_china_a_shares');
  }
  
  // 6️⃣ 回退规则
  if (parsed.index === 'AUTO') {
    parsed.index = 'SPX500';
    parsed.region = 'US';
    parsed.rules_fired.push('fallback_to_spx500');
  }
  
  // 7️⃣ 🔒 西班牙防串台校验（最高优先级）
  if (parsed.region === 'ES' && parsed.index !== 'IBEX35') {
    parsed.index = 'IBEX35';
    parsed.rules_fired.push('region_guard_ES_to_IBEX35');
    console.log(`🚨 [防串台] ES地区强制 → IBEX35`);
  }
  
  return {
    text: raw,
    region: parsed.region,
    index: parsed.index,
    sector: parsed.sector,
    dataset: parsed.dataset, // 精确板块数据集
    sectorName: parsed.sectorName, // 板块中文名称
    components: parsed.components, // 主要成分股
    confidence: parsed.confidence,
    rules_fired: parsed.rules_fired,
    rationale: parsed.rationale
  };
}

/**
 * 使用GPT-5解析热力图查询意图
 * @param {string} text - 用户输入文本
 * @param {boolean} debugMode - 是否启用调试模式
 * @returns {Promise<Object>} 结构化查询结果
 */
async function extractHeatmapQuery(text, debugMode = false) {
  console.log(`\n🎨 [Heatmap Parser] 解析热力图请求: "${text}"${debugMode ? ' (DEBUG模式)' : ''}`);
  
  // 规范化文本
  const raw = text || "";
  const norm = raw.normalize("NFKC");
  const lc = norm.toLowerCase();
  
  // 检测是否包含 #dbg
  const hasDebugFlag = /#dbg/i.test(text);
  const actualDebugMode = debugMode || hasDebugFlag;
  
  const prompt = `你是一个金融市场热力图查询解析器。请将用户的自然语言请求解析为结构化JSON。

用户输入: "${text}"

请返回JSON格式（不要markdown代码块）：
{
  "region": "US|JP|ES|DE|FR|UK|EU|HK|CN|IN|AUTO",
  "index": "SPX500|NASDAQ100|DJ30|NIKKEI225|IBEX35|DAX40|CAC40|FTSE100|EURO50|HSI|CSI300|NIFTY50|AUTO",
  "sector": "technology|financials|healthcare|industrials|energy|materials|consumer_discretionary|consumer_staples|communication_services|utilities|real_estate|AUTO",
  "locale": "auto|zh-CN|en-US|es-ES|ja-JP|de-DE|fr-FR",
  "confidence": 0.0~1.0,
  "rationale": "简要理由"
}

映射规则：
- 地区词汇：美股/美/美国→US，日本/日股→JP，西班牙→ES，德国→DE，法国→FR，英国→UK，欧洲→EU，香港→HK，中国/A股→CN，印度→IN
- 指数词汇：纳指/纳斯达克100/NDX/QQQ→NASDAQ100，道指/DJIA→DJ30，日经225→NIKKEI225，IBEX35→IBEX35，DAX40→DAX40，CAC40→CAC40，FTSE100→FTSE100，Euro Stoxx 50→EURO50，恒生→HSI，沪深300→CSI300，Nifty 50→NIFTY50
- 行业词汇：科技/技术→technology，金融→financials，医疗/保健→healthcare，工业/制造→industrials，能源/石油→energy，材料/原材料→materials，可选消费/零售→consumer_discretionary，必需消费/日用品→consumer_staples，通信/电信→communication_services，公用事业→utilities，房地产/地产→real_estate
- 语言：若提及"西语/español"→es-ES，"日语/日本語"→ja-JP，"德语/Deutsch"→de-DE，"法语/français"→fr-FR，否则auto
- 没提指数但提地区时：US默认SPX500，JP默认NIKKEI225，ES默认IBEX35，DE默认DAX40，FR默认CAC40，UK默认FTSE100，EU默认EURO50，HK默认HSI，CN默认CSI300，IN默认NIFTY50
- 都没提时：region=AUTO, index=AUTO, sector=AUTO

示例：
- "美股的科技股热力图" → region=US, index=SPX500, sector=technology, locale=auto
- "日本大盘热力图" → region=JP, index=NIKKEI225, sector=AUTO, locale=auto
- "西班牙热力图（金融）" → region=ES, index=IBEX35, sector=financials, locale=auto
- "纳斯达克100" → region=US, index=NASDAQ100, sector=AUTO, locale=auto

只返回JSON，不要其他内容。`;

  try {
    const response = await generateWithGPT5({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1, // 低温度确保稳定输出
      max_tokens: 300
    });
    
    let parsed;
    try {
      // 移除可能的markdown代码块标记
      const cleanedText = response.text
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      parsed = JSON.parse(cleanedText);
    } catch (parseErr) {
      console.error('❌ JSON解析失败，使用保守默认值');
      parsed = {
        region: 'AUTO',
        index: 'AUTO',
        sector: 'AUTO',
        locale: 'auto',
        confidence: 0.3,
        rationale: 'JSON解析失败'
      };
    }
    
    // 🆕 添加 rules_fired 追踪
    if (!parsed.rules_fired) {
      parsed.rules_fired = [];
    }
    
    // 🔒 Hotfix: 西班牙IBEX35强制锁定（关键词检测）- 最高优先级
    const debugInfo = { force: [] };
    const saidSpain = /(西班牙|spain|ibex\s*35?|ibex)/iu.test(norm);
    if (saidSpain) {
      parsed.region = 'ES';
      parsed.index = 'IBEX35';
      parsed.confidence = Math.max(parsed.confidence || 0, 0.90);
      parsed.rationale = (parsed.rationale ? parsed.rationale + ' ; ' : '') + 'force: Spain/IBEX keyword';
      parsed.rules_fired.push('force_lock_ES_IBEX35');
      debugInfo.force.push('spain_keyword_lock');
      console.log('🔒 [强制锁定] 检测到西班牙关键词 → ES/IBEX35');
    }
    
    // 防串台：检查region和index是否匹配
    if (parsed.index !== 'AUTO' && parsed.region !== 'AUTO') {
      const expectedRegion = INDEX_REGION_MAP[parsed.index];
      if (expectedRegion && expectedRegion !== parsed.region) {
        console.log(`⚠️  [防串台] 地区/指数不匹配: ${parsed.region}/${parsed.index} → 强制修正为 ${expectedRegion}/${parsed.index}`);
        parsed.region = expectedRegion;
        parsed.rules_fired.push('region_guard');
        debugInfo.force.push('region_guard');
      }
    }
    
    // 🆕 修改回退策略：仅当region和index都是AUTO时才回退SPX500
    if (parsed.region && parsed.region !== 'AUTO') {
      // region已识别，使用映射表强制对应指数
      if (!parsed.index || parsed.index === 'AUTO') {
        const defaultIndex = REGION_INDEX_MAP[parsed.region];
        if (defaultIndex) {
          console.log(`📍 [强制映射] ${parsed.region} → ${defaultIndex} (不允许回退SPX500)`);
          parsed.index = defaultIndex;
          parsed.rules_fired.push('map_region_to_default_index');
          debugInfo.force.push('region_to_index_mapping');
        } else {
          // 映射表中不存在的region，保守使用SPX500
          console.log(`⚠️  [未知地区] ${parsed.region} 不在映射表中，回退SPX500`);
          parsed.index = 'SPX500';
          parsed.rules_fired.push('fallback_unknown_region');
        }
      }
    } else {
      // region是AUTO，检查index
      if (!parsed.index || parsed.index === 'AUTO') {
        // 两者都是AUTO，默认美股
        console.log('📍 [默认] 使用美股 SPX500');
        parsed.region = 'US';
        parsed.index = 'SPX500';
        parsed.rules_fired.push('fallback_SPX500_only_when_no_region_and_no_index');
        debugInfo.force.push('default_us');
      }
    }
    
    // 🛡️ 西班牙防串台最终校验
    if (parsed.region === 'ES' && parsed.index !== 'IBEX35') {
      console.log(`🚨 [防串台] ES地区但index=${parsed.index} → 强制修正为IBEX35`);
      parsed.index = 'IBEX35';
      parsed.rules_fired.push('region_guard_fix_ES_to_IBEX35');
      debugInfo.force.push('region_guard: ES->IBEX35');
    }
    
    // 添加原始文本和增强debug信息
    parsed.raw = text;
    parsed.debug = debugInfo;
    parsed.debug.selected = {
      region: parsed.region,
      index: parsed.index,
      sector: parsed.sector || 'AUTO'
    };
    
    console.log(`✅ [Heatmap Parser] 解析结果:`, JSON.stringify(parsed, null, 2));
    return parsed;
    
  } catch (error) {
    console.error('❌ [Heatmap Parser] 解析失败:', error.message);
    
    // 保守降级：返回美股默认配置
    return {
      region: 'US',
      index: 'SPX500',
      sector: 'AUTO',
      locale: 'auto',
      confidence: 0.3,
      rationale: `解析失败: ${error.message}`,
      raw: text,
      debug: { force: null }
    };
  }
}

/**
 * 构造TradingView热力图URL - v5.0支持板块筛选
 * @param {Object} query - 解析后的查询结果
 * @returns {string} TradingView URL
 */
function buildTradingViewURL(query) {
  const { index, locale, sector } = query;
  
  // 日本市场使用特殊参数结构
  if (index === 'NIKKEI225') {
    console.log('🎌 使用日本市场专用参数');
    
    const japanParams = {
      dataSource: "NI225",
      blockColor: "change",
      blockSize: "market_cap_basic", 
      grouping: "sector"
    };
    
    const hashParams = encodeURIComponent(JSON.stringify(japanParams));
    const url = `https://www.tradingview.com/heatmap/stock/#${hashParams}`;
    console.log(`🔗 [TradingView URL - Japan] ${url}`);
    return url;
  }
  
  // 其他市场保持原有逻辑
  const baseUrl = 'https://www.tradingview.com/heatmap/stock/';
  const params = new URLSearchParams({
    color: 'change',
    dataset: index,
    group: sector !== 'AUTO' ? 'industry' : 'sector',
    blockSize: 'market_cap_basic',
    blockColor: 'change'
  });
  
  // 语言参数
  if (locale && locale !== 'auto') {
    const langCode = locale.split('-')[0];
    params.set('lang', langCode);
  }
  
  // 板块筛选
  if (sector && sector !== 'AUTO') {
    params.set('filter', sector);
    console.log(`🎯 [板块筛选] 启用 filter=${sector}`);
  }
  
  const url = `${baseUrl}?${params.toString()}`;
  console.log(`🔗 [TradingView URL] ${url}`);
  return url;
}

/**
 * 生成热力图自动简评
 * @param {Object} query - 解析后的查询结果
 * @returns {string} 简评文本
 */
function generateHeatmapSummary(query) {
  const { index, sector, locale, region } = query;
  
  // 指数名称映射
  const indexNames = {
    'SPX500': { zh: '标普500', en: 'S&P 500' },
    'NASDAQ100': { zh: '纳斯达克100', en: 'NASDAQ 100' },
    'DJ30': { zh: '道琼斯30', en: 'Dow Jones 30' },
    'NIKKEI225': { zh: '日经225', en: 'Nikkei 225' },
    'IBEX35': { zh: 'IBEX35', en: 'IBEX 35' },
    'DAX40': { zh: 'DAX40', en: 'DAX 40' },
    'CAC40': { zh: 'CAC40', en: 'CAC 40' },
    'FTSE100': { zh: '富时100', en: 'FTSE 100' },
    'EURO50': { zh: '欧洲斯托克50', en: 'Euro Stoxx 50' },
    'HSI': { zh: '恒生指数', en: 'Hang Seng Index' },
    'CSI300': { zh: '沪深300', en: 'CSI 300' },
    'NIFTY50': { zh: 'Nifty 50', en: 'Nifty 50' }
  };
  
  const isChinese = locale === 'zh-CN' || locale === 'auto';
  const indexName = indexNames[index] ? (isChinese ? indexNames[index].zh : indexNames[index].en) : index;
  
  let summary = '';
  
  if (isChinese) {
    summary = `📊 ${indexName} 实时热力图\n\n`;
    
    if (sector && sector !== 'AUTO') {
      const sectorName = SECTOR_CN_NAMES[sector] || sector;
      summary += `🎯 聚焦板块：${sectorName}\n`;
      summary += `当前热力图展示了${indexName}成分股的实时表现，其中${sectorName}板块的相对强弱值得关注。\n\n`;
    } else {
      summary += `当前热力图展示了${indexName}所有成分股的实时表现，可直观观察各板块涨跌分布。\n\n`;
    }
    
    summary += `💡 使用提示：\n`;
    summary += `• 绿色=上涨，红色=下跌，色块大小=市值\n`;
    summary += `• 数据来源：TradingView 实时行情\n`;
    summary += `• 仅供参考，不构成投资建议`;
  } else {
    summary = `📊 ${indexName} Real-time Heatmap\n\n`;
    
    if (sector && sector !== 'AUTO') {
      summary += `🎯 Focus: ${sector.replace(/_/g, ' ')}\n`;
      summary += `This heatmap shows real-time performance of ${indexName} constituents, with focus on the ${sector.replace(/_/g, ' ')} sector.\n\n`;
    } else {
      summary += `This heatmap shows real-time performance of all ${indexName} constituents across sectors.\n\n`;
    }
    
    summary += `💡 Tips:\n`;
    summary += `• Green=up, Red=down, Size=market cap\n`;
    summary += `• Data source: TradingView live quotes\n`;
    summary += `• For reference only, not investment advice`;
  }
  
  return summary;
}

/**
 * 生成Telegram消息标题
 * @param {Object} query - 解析后的查询结果
 * @returns {string} 标题文本
 */
function generateCaption(query) {
  const { index, sector, locale } = query;
  
  const indexNames = {
    'SPX500': '标普500', 'NASDAQ100': '纳斯达克100', 'DJ30': '道琼斯30',
    'NIKKEI225': '日经225', 'IBEX35': 'IBEX35', 'DAX40': 'DAX40',
    'CAC40': 'CAC40', 'FTSE100': '富时100', 'EURO50': '欧洲斯托克50',
    'HSI': '恒生指数', 'CSI300': '沪深300', 'NIFTY50': 'Nifty 50'
  };
  
  const indexName = indexNames[index] || index;
  let caption = `📊 ${indexName} 板块热力图`;
  
  if (sector && sector !== 'AUTO') {
    const sectorName = SECTOR_CN_NAMES[sector] || sector;
    caption += ` · 聚焦：${sectorName}`;
  }
  
  caption += `\n🔴 数据来源: TradingView`;
  
  // 低置信度警告
  if (query.confidence < 0.45) {
    caption += `\n⚠️ 可能需要确认市场/指数`;
  }
  
  return caption;
}

/**
 * 🔍 生成诊断报告（含自检样例）
 * @param {string} text - 用户输入文本
 * @param {Object} parsed - 解析结果
 * @returns {Object} 诊断报告
 */
function generateDebugReport(text, parsed) {
  const raw = text || "";
  const norm = raw.normalize("NFKC");
  const lc = norm.toLowerCase();
  
  const url = buildTradingViewURL(parsed);
  
  // 自检样例
  const samples = [
    "西班牙热力图 带分析 #dbg",
    "Spain IBEX heatmap #dbg",
    "日本大盘热力图 #dbg",
    "美股的科技股的热力图 #dbg"
  ];
  
  const selftest = samples.map(sample => extractHeatmapQueryRulesOnly(sample));
  
  return {
    input: { raw, norm, lc },
    parsed: {
      region: parsed.region,
      index: parsed.index,
      sector: parsed.sector || 'AUTO',
      confidence: parsed.confidence,
      rules_fired: parsed.rules_fired || [],
      rationale: parsed.rationale || ''
    },
    action_preview: {
      provider: 'screenshotapi',
      url,
      expected_region: parsed.region,
      dataset: parsed.index
    },
    selftest
  };
}

module.exports = {
  extractHeatmapQuery,
  extractHeatmapQueryRulesOnly,
  buildTradingViewURL,
  generateHeatmapSummary,
  generateCaption,
  generateDebugReport,
  SECTOR_CN_NAMES,
  REGION_INDEX_MAP,
  INDEX_REGION_MAP
};
