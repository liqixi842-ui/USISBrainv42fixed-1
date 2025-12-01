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
 * 🔍 轻量级解析（仅规则，不调用LLM）- v5.1 智能市场+板块解析
 * @param {string} text - 用户输入文本
 * @returns {Object} 解析结果
 */
function extractHeatmapQueryRulesOnly(text) {
  const raw = text || "";
  const norm = raw.normalize("NFKC");
  const lc = norm.toLowerCase();
  
  console.log(`\n🧠 [热力图解析器 v5.1] 输入: "${raw}"`);
  
  // 1️⃣ 市场关键词映射表（优先级排序）
  const marketKeywords = [
    // 美国市场（多个入口）
    { keywords: ['纳斯达克', '纳指', 'nasdaq', 'qqq', 'ndx'], index: 'NASDAQ100', name: '纳斯达克100', region: 'US' },
    { keywords: ['道指', '道琼斯', 'dow', 'djia', 'dji'], index: 'DJI', name: '道琼斯', region: 'US' },
    { keywords: ['罗素', 'russell', 'rut'], index: 'RUT', name: '罗素2000', region: 'US' },
    { keywords: ['标普', 'sp500', 'spx', 's&p'], index: 'SPX500', name: '标普500', region: 'US' },
    { keywords: ['美股', '美国', 'us market', 'usa'], index: 'SPX500', name: '标普500', region: 'US' },
    
    // 加拿大市场（重点优化）
    { keywords: ['加拿大', '加股', 'tsx', 'canada', 'canadian'], index: 'TSX', name: '加拿大TSX', region: 'CA' },
    
    // 拉美市场
    { keywords: ['巴西', 'brazil', 'ibov', 'bovespa'], index: 'IBOV', name: '巴西IBOV', region: 'BR' },
    { keywords: ['墨西哥', 'mexico', 'mexbol'], index: 'MEXBOL', name: '墨西哥MEXBOL', region: 'MX' },
    
    // 欧洲市场
    { keywords: ['西班牙', 'spain', 'ibex'], index: 'IBEX35', name: '西班牙IBEX35', region: 'ES' },
    { keywords: ['德国', 'germany', 'dax'], index: 'DAX', name: '德国DAX', region: 'DE' },
    { keywords: ['法国', 'france', 'cac'], index: 'CAC40', name: '法国CAC40', region: 'FR' },
    { keywords: ['英国', 'uk', 'ftse', '富时', 'london'], index: 'FTSE', name: '英国富时', region: 'UK' },
    { keywords: ['意大利', 'italy', 'ftsemib'], index: 'FTSEMIB', name: '意大利FTSEMIB', region: 'IT' },
    { keywords: ['荷兰', 'netherlands', 'aex'], index: 'AEX', name: '荷兰AEX', region: 'NL' },
    { keywords: ['瑞士', 'switzerland', 'smi'], index: 'SMI', name: '瑞士SMI', region: 'CH' },
    { keywords: ['欧洲', 'europe', 'euro50', 'stoxx'], index: 'EURO50', name: '欧洲斯托克50', region: 'EU' },
    
    // 亚洲市场
    { keywords: ['日本', 'japan', 'nikkei', '日経', '日经'], index: 'NIKKEI225', name: '日经225', region: 'JP' },
    { keywords: ['香港', 'hk', '恒生', 'hang seng', 'hsi', '港股'], index: 'HSI', name: '恒生指数', region: 'HK' },
    { keywords: ['上证', 'sse', '沪市'], index: 'SSE50', name: '上证50', region: 'CN' },
    { keywords: ['深圳', '深证', 'shenzhen', 'szse'], index: 'SZI', name: '深证成指', region: 'CN' },
    { keywords: ['a股', '中国股市', 'china a'], index: 'SSE50', name: '上证50', region: 'CN' },
    { keywords: ['韩国', 'korea', 'kospi'], index: 'KOSPI', name: '韩国KOSPI', region: 'KR' },
    { keywords: ['台湾', 'taiwan', 'twii', '台股'], index: 'TWII', name: '台湾加权', region: 'TW' },
    { keywords: ['印度', 'india', 'nifty'], index: 'NIFTY', name: '印度NIFTY', region: 'IN' },
    { keywords: ['澳洲', '澳大利亚', 'australia', 'asx'], index: 'AS51', name: '澳洲AS51', region: 'AU' },
    { keywords: ['新加坡', 'singapore', 'sti'], index: 'STI', name: '新加坡STI', region: 'SG' },
    
    // 其他
    { keywords: ['俄罗斯', 'russia', 'imoex'], index: 'IMOEX', name: '俄罗斯IMOEX', region: 'RU' },
    
    // 加密货币
    { keywords: ['加密货币', '虚拟货币', '数字货币', '币圈', '比特币', 'btc', 'eth', 'crypto'], index: 'CRYPTO', name: '加密货币', region: 'CRYPTO' }
  ];
  
  // 2️⃣ 板块关键词映射表（支持更多变体）
  const sectorKeywords = [
    { keywords: ['科技股', '科技', '技术', 'technology', 'tech', '高科技', '互联网'], sector: 'technology', name: '科技' },
    { keywords: ['银行股', '银行', '金融股', '金融', 'finance', 'financials', 'bank', '保险'], sector: 'financial', name: '金融' },
    { keywords: ['医疗股', '医疗', '医药', '保健', 'healthcare', 'health', '生物'], sector: 'healthcare', name: '医疗' },
    { keywords: ['能源股', '能源', '石油', 'energy', 'oil', '天然气'], sector: 'energy', name: '能源' },
    { keywords: ['原材料', '材料', 'materials', '矿业'], sector: 'basic_materials', name: '材料' },
    { keywords: ['工业股', '工业', '制造', 'industrials', '制造业'], sector: 'industrials', name: '工业' },
    { keywords: ['消费股', '消费', '零售', 'consumer', '可选消费'], sector: 'consumer_cyclical', name: '消费' },
    { keywords: ['必需消费', '日用', 'defensive', 'staples'], sector: 'consumer_defensive', name: '必需消费' },
    { keywords: ['公用事业', '公用', 'utilities', '电力', '水务'], sector: 'utilities', name: '公用事业' },
    { keywords: ['房地产', '地产', 'real estate', 'reit'], sector: 'real_estate', name: '房地产' },
    { keywords: ['通信', '电信', 'telecom', 'communication'], sector: 'telecommunications', name: '通信' }
  ];
  
  // 3️⃣ "大盘"关键词 = 全市场（所有板块）
  const mainMarketKeywords = ['大盘', '股市', '市场', '整体', 'market', 'index', '指数'];
  
  // 🔄 解析市场
  let matchedMarket = null;
  for (const market of marketKeywords) {
    for (const keyword of market.keywords) {
      if (lc.includes(keyword) || norm.includes(keyword)) {
        matchedMarket = market;
        console.log(`✅ [市场匹配] "${keyword}" → ${market.name} (${market.index})`);
        break;
      }
    }
    if (matchedMarket) break;
  }
  
  // 🔄 解析板块
  let matchedSector = null;
  for (const sector of sectorKeywords) {
    for (const keyword of sector.keywords) {
      if (lc.includes(keyword) || norm.includes(keyword)) {
        matchedSector = sector;
        console.log(`✅ [板块匹配] "${keyword}" → ${sector.name} (${sector.sector})`);
        break;
      }
    }
    if (matchedSector) break;
  }
  
  // 🔄 检测"大盘"意图（全市场）
  let isMainMarket = false;
  for (const keyword of mainMarketKeywords) {
    if (lc.includes(keyword) || norm.includes(keyword)) {
      isMainMarket = true;
      console.log(`✅ [大盘意图] "${keyword}" → 全市场模式`);
      break;
    }
  }
  
  // 兼容旧 sectorMap 格式
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
    rationale: '规则引擎v5.1智能解析'
  };
  
  // 4️⃣ 精确板块数据集匹配（优先级最高 - 仅美股）
  for (const [pattern, config] of Object.entries(sectorDatasetMap)) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(lc)) {
      parsed.dataset = config.dataset;
      parsed.sectorName = config.name;
      parsed.components = config.components;
      parsed.index = 'SPX500';
      parsed.region = 'US';
      parsed.sector = config.dataset.split('-')[1];
      parsed.confidence = 0.95;
      parsed.rules_fired.push(`精确板块匹配: ${config.name} (${config.dataset})`);
      parsed.rationale = `精确匹配到${config.name}，使用TradingView数据集${config.dataset}`;
      console.log(`🎯 [精确板块] ${config.name} → ${config.dataset}`);
      return parsed;
    }
  }
  
  // 5️⃣ 使用新的智能匹配结果
  if (matchedMarket) {
    parsed.index = matchedMarket.index;
    parsed.region = matchedMarket.region;
    parsed.confidence = 0.85;
    parsed.rules_fired.push(`market_${matchedMarket.index}`);
    parsed.rationale = `检测到${matchedMarket.name}关键词`;
  }
  
  if (matchedSector) {
    parsed.sector = matchedSector.sector;
    parsed.sectorName = matchedSector.name;
    parsed.rules_fired.push(`sector_${matchedSector.sector}`);
  }
  
  // 6️⃣ 智能组合逻辑
  // 美国+科技股 → NASDAQ100（更合适）
  if (parsed.region === 'US' && parsed.sector === 'technology' && parsed.index === 'SPX500') {
    parsed.index = 'NASDAQ100';
    parsed.rules_fired.push('optimize_us_tech_to_nasdaq');
    console.log(`💡 [智能优化] 美国科技 → NASDAQ100`);
  }
  
  // "大盘"意图 + 有市场匹配 → 清除板块筛选（显示全市场）
  if (isMainMarket && matchedMarket && !matchedSector) {
    parsed.sector = 'AUTO';
    parsed.rules_fired.push('main_market_all_sectors');
    console.log(`💡 [大盘模式] ${matchedMarket.name} → 全板块`);
  }
  
  // A股特定逻辑
  if (/a股|沪深/.test(lc)) {
    parsed.index = /深圳|深证/.test(lc) ? 'SZI' : 'SSE50';
    parsed.region = 'CN';
    parsed.rules_fired.push('detect_china_a_shares');
  }
  
  // 7️⃣ 回退规则（只有在没有任何匹配时才使用美股默认）
  if (parsed.index === 'AUTO') {
    parsed.index = 'SPX500';
    parsed.region = 'US';
    parsed.rules_fired.push('fallback_to_spx500');
  }
  
  // 8️⃣ 🔒 西班牙防串台校验（最高优先级）
  if (parsed.region === 'ES' && parsed.index !== 'IBEX35') {
    parsed.index = 'IBEX35';
    parsed.rules_fired.push('region_guard_ES_to_IBEX35');
    console.log(`🚨 [防串台] ES地区强制 → IBEX35`);
  }
  
  // 🎯 最终解析结果日志
  console.log(`\n📊 [热力图解析结果]`);
  console.log(`   输入: "${raw}"`);
  console.log(`   市场: ${parsed.index} (${parsed.region})`);
  console.log(`   板块: ${parsed.sector}${parsed.sectorName ? ` (${parsed.sectorName})` : ''}`);
  console.log(`   规则: ${parsed.rules_fired.join(', ')}`);
  console.log(`   置信度: ${parsed.confidence}`);
  
  return {
    text: raw,
    region: parsed.region,
    index: parsed.index,
    sector: parsed.sector,
    dataset: parsed.dataset,
    sectorName: parsed.sectorName,
    components: parsed.components,
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

=== OUTPUT FORMAT (STRICT JSON) ===
无论用户输入什么，你必须严格输出下面格式的 JSON：

{
  "region": "US | EU | CN | JP | HK | ...",
  "index": "SPX500 | NASDAQ100 | DJ30 | SSE | SZSE | HK50 | ...",
  "sector": "technology | finance | energy | healthcare | all | ...",
  "locale": "auto",
  "confidence": 0~1,
  "rationale": "解释模型如何解析出这些字段",
  "rules_fired": ["..."],
  "raw": "<原始用户输入>",
  "debug": {
    "force": [],
    "selected": { "region": "...", "index": "...", "sector": "..." }
  }
}

必须是合法 JSON，不允许出现多余文字或自然语言段落。
如果无法判断 sector，请使用 "sector": "all"。
如果提到"纳指/Nasdaq"，请使用 "index": "NASDAQ100"。
如果无法判断 region，默认 "region": "US"。

映射规则：
- 地区词汇：美股/美/美国→US，加拿大/加股→CA，日本/日股→JP，西班牙→ES，德国→DE，法国→FR，英国→UK，欧洲→EU，香港/港股→HK，中国/A股→CN，印度→IN，巴西→BR，墨西哥→MX，澳洲/澳大利亚→AU，韩国→KR，台湾/台股→TW，新加坡→SG
- 指数词汇：标普/标普500/SP500/SPX→SPX500，纳指/纳斯达克/纳斯达克100/NDX/QQQ/NASDAQ→NASDAQ100，道指/DJIA/DJ→DJ30，罗素/Russell→RUT，TSX/加拿大→TSX，日经225→NIKKEI225，IBEX35→IBEX35，DAX40/德国DAX→DAX40，CAC40→CAC40，FTSE100/富时→FTSE100，Euro Stoxx 50→EURO50，恒生/HSI→HSI，上证50→SSE50，深证成指→SZI，沪深300/CSI300→CSI300，Nifty 50/印度→NIFTY50，IBOV/巴西→IBOV，KOSPI/韩国→KOSPI，ASX/澳洲→AS51，台湾加权/TWII→TWII
- 行业词汇：科技/技术/科技股→technology，金融/银行/银行股/金融股→financials，医疗/保健/医药→healthcare，工业/制造→industrials，能源/石油/能源股→energy，材料/原材料→materials，可选消费/零售/消费股→consumer_discretionary，必需消费/日用品→consumer_staples，通信/电信→communication_services，公用事业→utilities，房地产/地产→real_estate，所有/全部/大盘/股市/市场/整体→all
- 语言：若提及"西语/español"→es-ES，"日语/日本語"→ja-JP，"德语/Deutsch"→de-DE，"法语/français"→fr-FR，否则auto
- 没提指数但提地区时：US默认SPX500，CA默认TSX，JP默认NIKKEI225，ES默认IBEX35，DE默认DAX40，FR默认CAC40，UK默认FTSE100，EU默认EURO50，HK默认HSI，CN默认SSE50，IN默认NIFTY50，BR默认IBOV，AU默认AS51，KR默认KOSPI，TW默认TWII
- 都没提时：region=AUTO, index=AUTO, sector=all

示例JSON输出：
{"region":"US","index":"SPX500","sector":"technology","locale":"auto","confidence":0.95,"rationale":"用户提到美股的科技股","rules_fired":[],"raw":"美股的科技股热力图","debug":{"force":[],"selected":{"region":"US","index":"SPX500","sector":"technology"}}}

{"region":"US","index":"NASDAQ100","sector":"technology","locale":"auto","confidence":0.98,"rationale":"用户提到纳指科技股","rules_fired":[],"raw":"纳指科技股热力图","debug":{"force":[],"selected":{"region":"US","index":"NASDAQ100","sector":"technology"}}}

{"region":"ES","index":"IBEX35","sector":"financials","locale":"auto","confidence":0.95,"rationale":"用户提到西班牙金融板块","rules_fired":[],"raw":"西班牙IBEX金融板块热力图","debug":{"force":[],"selected":{"region":"ES","index":"IBEX35","sector":"financials"}}}

严格要求：只返回一行纯JSON，不要任何markdown标记、代码块标记、注释或其他文字。`;

  try {
    const response = await generateWithGPT5({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.0, // 零温度确保完全确定性输出
      max_tokens: 500,
      top_p: 1
    });
    
    let parsed;
    let firstAttemptSuccess = false;
    
    try {
      // 移除可能的markdown代码块标记和其他干扰字符
      let cleanedText = response.text
        .replace(/```json\n?/gi, '')
        .replace(/```\n?/g, '')
        .replace(/^[^{]*/, '') // 移除开头的非JSON字符
        .replace(/[^}]*$/, '') // 移除结尾的非JSON字符
        .trim();
      
      console.log('[HEATMAP][NL-2] LLM 原始输出:', response.text.substring(0, 200));
      console.log('[HEATMAP][NL-2] 清理后 JSON:', cleanedText.substring(0, 200));
      
      parsed = JSON.parse(cleanedText);
      console.log('✅ [HEATMAP][NL-2] JSON 解析成功:', parsed);
      firstAttemptSuccess = true;
    } catch (parseErr) {
      console.error('❌ [HEATMAP][NL-2] JSON解析失败（第一次）:', parseErr.message);
      console.error('    LLM 返回内容:', response.text);
      console.log('    触发二次请求...');
      
      // 二次请求：更强硬的 prompt
      try {
        const retryPrompt = `RETURN ONLY JSON — NO NATURAL LANGUAGE

用户输入: "${text}"

返回严格 JSON 格式（不要任何额外文字）：
{"region":"US|JP|ES|...","index":"SPX500|NASDAQ100|...","sector":"technology|financials|all|...","locale":"auto","confidence":0.0~1.0,"rationale":"...","rules_fired":[],"raw":"${text}","debug":{"force":[],"selected":{}}}

纳指→NASDAQ100，标普→SPX500，sector不确定用all。只返回JSON，不要markdown。`;

        const retryResponse = await generateWithGPT5({
          messages: [{ role: 'user', content: retryPrompt }],
          temperature: 0.0,
          max_tokens: 500,
          top_p: 1
        });
        
        let retryCleanedText = retryResponse.text
          .replace(/```json\n?/gi, '')
          .replace(/```\n?/g, '')
          .replace(/^[^{]*/, '')
          .replace(/[^}]*$/, '')
          .trim();
        
        console.log('[HEATMAP][NL-2] 二次请求 LLM 输出:', retryResponse.text.substring(0, 200));
        console.log('[HEATMAP][NL-2] 二次请求清理后:', retryCleanedText.substring(0, 200));
        
        parsed = JSON.parse(retryCleanedText);
        console.log('✅ [HEATMAP][NL-2] 二次请求 JSON 解析成功:', parsed);
        if (!parsed.rules_fired) parsed.rules_fired = [];
        parsed.rules_fired.push('llm_retry_success');
      } catch (retryErr) {
        console.error('❌ [HEATMAP][NL-2] 二次请求也失败:', retryErr.message);
        console.log('    使用规则集 fallback');
        
        // Fallback 到规则集
        const ruleFallback = extractHeatmapQueryRulesOnly(text);
        parsed = {
          region: ruleFallback.region || 'AUTO',
          index: ruleFallback.index || 'AUTO',
          sector: ruleFallback.sector || 'all',
          locale: 'auto',
          confidence: 0.4,
          rationale: '二次LLM失败，使用规则集fallback',
          rules_fired: ['llm_retry_failed', 'rules_only_fallback'],
          raw: text,
          debug: { force: [], selected: {} }
        };
      }
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
  
  // 🆕 TradingView 数据集映射表 - 将内部索引名转换为TV识别的数据集名
  const TRADINGVIEW_DATASET_MAP = {
    // 美股
    'SPX500': 'SPX500',
    'NASDAQ100': 'NASDAQ100',
    'NAS100': 'NASDAQ100',
    'DJ30': 'DJ30',
    'DJI': 'DJ30',
    'RUT': 'RUT',
    
    // 加拿大
    'TSX': 'TSX60',
    
    // 欧洲
    'DAX': 'DAX40',
    'DAX40': 'DAX40',
    'CAC40': 'CAC40',
    'FTSE': 'FTSE100',
    'FTSE100': 'FTSE100',
    'IBEX35': 'IBEX35',
    'EURO50': 'EURO50',
    
    // 亚太
    'HSI': 'HSI',
    'CSI300': 'CSI300',
    'SSE50': 'SSE50',
    'KOSPI': 'KOSPI',
    'AS51': 'AS51',
    'AS200': 'AS200',
    'TWII': 'TWII',
    'NIFTY': 'NIFTY50',
    'NIFTY50': 'NIFTY50',
    
    // 其他
    'IBOV': 'IBOV'
  };
  
  // 🆕 加密货币热力图 - 使用不同的URL结构
  if (index === 'CRYPTO') {
    console.log('🪙 使用加密货币热力图');
    const url = 'https://www.tradingview.com/heatmap/crypto/';
    console.log(`🔗 [TradingView URL - Crypto] ${url}`);
    return url;
  }
  
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
  
  // 🆕 加拿大市场 - 使用 MarketScreener TSX 热力图（截图后裁剪广告）
  if (index === 'TSX') {
    console.log('🍁 使用加拿大市场 - MarketScreener TSX (带裁剪)');
    const cacheBuster = Date.now();
    const url = `https://ca.marketscreener.com/quote/index/TSX-COMPOSITE-7454/heatmap/?v=${cacheBuster}`;
    console.log(`🔗 [MarketScreener URL - TSX] ${url}`);
    return url;
  }
  
  // 🆕 德国DAX市场 - 使用 MarketScreener
  if (index === 'DAX' || index === 'DAX40') {
    console.log('🇩🇪 使用德国市场 - MarketScreener DAX');
    const cacheBuster = Date.now();
    const url = `https://www.marketscreener.com/quote/index/DAX-6455680/heatmap/?v=${cacheBuster}`;
    console.log(`🔗 [MarketScreener URL - DAX] ${url}`);
    return url;
  }
  
  // 🆕 英国FTSE市场 - 使用 MarketScreener
  if (index === 'FTSE' || index === 'FTSE100') {
    console.log('🇬🇧 使用英国市场 - MarketScreener FTSE');
    const cacheBuster = Date.now();
    const url = `https://www.marketscreener.com/quote/index/FTSE-100-26/heatmap/?v=${cacheBuster}`;
    console.log(`🔗 [MarketScreener URL - FTSE] ${url}`);
    return url;
  }
  
  // 🆕 法国CAC市场 - 使用 MarketScreener
  if (index === 'CAC40') {
    console.log('🇫🇷 使用法国市场 - MarketScreener CAC');
    const cacheBuster = Date.now();
    const url = `https://www.marketscreener.com/quote/index/CAC-40-4941/heatmap/?v=${cacheBuster}`;
    console.log(`🔗 [MarketScreener URL - CAC] ${url}`);
    return url;
  }
  
  // 🆕 澳大利亚市场 - 使用 MarketScreener
  if (index === 'AS51' || index === 'AS200') {
    console.log('🇦🇺 使用澳大利亚市场 - MarketScreener ASX');
    const cacheBuster = Date.now();
    const url = `https://www.marketscreener.com/quote/index/S-P-ASX-200-4899/heatmap/?v=${cacheBuster}`;
    console.log(`🔗 [MarketScreener URL - ASX] ${url}`);
    return url;
  }
  
  // 🆕 韩国KOSPI市场 - 使用 MarketScreener
  if (index === 'KOSPI') {
    console.log('🇰🇷 使用韩国市场 - MarketScreener KOSPI');
    const cacheBuster = Date.now();
    const url = `https://www.marketscreener.com/quote/index/KOSPI-INDEX-7467/heatmap/?v=${cacheBuster}`;
    console.log(`🔗 [MarketScreener URL - KOSPI] ${url}`);
    return url;
  }
  
  // 🆕 使用映射表获取正确的TradingView数据集名称
  const tvDataset = TRADINGVIEW_DATASET_MAP[index] || index;
  console.log(`🎯 [Dataset Mapping] ${index} → ${tvDataset}`);
  
  // 其他市场保持原有逻辑
  const baseUrl = 'https://www.tradingview.com/heatmap/stock/';
  const params = new URLSearchParams({
    color: 'change',
    dataset: tvDataset,
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
    'DJI': { zh: '道琼斯30', en: 'Dow Jones 30' },
    'NIKKEI225': { zh: '日经225', en: 'Nikkei 225' },
    'IBEX35': { zh: 'IBEX35', en: 'IBEX 35' },
    'DAX40': { zh: 'DAX40', en: 'DAX 40' },
    'DAX': { zh: '德国DAX', en: 'German DAX' },
    'CAC40': { zh: 'CAC40', en: 'CAC 40' },
    'FTSE100': { zh: '富时100', en: 'FTSE 100' },
    'FTSE': { zh: '英国富时', en: 'UK FTSE' },
    'EURO50': { zh: '欧洲斯托克50', en: 'Euro Stoxx 50' },
    'HSI': { zh: '恒生指数', en: 'Hang Seng Index' },
    'CSI300': { zh: '沪深300', en: 'CSI 300' },
    'SSE50': { zh: '上证50', en: 'SSE 50' },
    'NIFTY50': { zh: 'Nifty 50', en: 'Nifty 50' },
    'NIFTY': { zh: '印度Nifty', en: 'India Nifty' },
    'CRYPTO': { zh: '加密货币', en: 'Cryptocurrency' },
    'TSX': { zh: '加拿大TSX', en: 'Canada TSX' },
    'AS51': { zh: '澳洲ASX', en: 'Australia ASX' },
    'AS200': { zh: '澳洲ASX200', en: 'Australia ASX 200' },
    'KOSPI': { zh: '韩国KOSPI', en: 'Korea KOSPI' },
    'TWII': { zh: '台湾加权', en: 'Taiwan TWII' },
    'IBOV': { zh: '巴西IBOV', en: 'Brazil IBOV' },
    'RUT': { zh: '罗素2000', en: 'Russell 2000' }
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
    'SPX500': '标普500', 'NASDAQ100': '纳斯达克100', 'DJ30': '道琼斯30', 'DJI': '道琼斯30',
    'NIKKEI225': '日经225', 'IBEX35': 'IBEX35', 'DAX40': 'DAX40', 'DAX': '德国DAX',
    'CAC40': 'CAC40', 'FTSE100': '富时100', 'FTSE': '英国富时', 'EURO50': '欧洲斯托克50',
    'HSI': '恒生指数', 'CSI300': '沪深300', 'SSE50': '上证50', 'SZI': '深证成指',
    'NIFTY50': 'Nifty 50', 'NIFTY': '印度Nifty',
    'TSX': '加拿大TSX', 'IBOV': '巴西IBOV', 'MEXBOL': '墨西哥MEXBOL',
    'AS51': '澳洲ASX', 'KOSPI': '韩国KOSPI', 'TWII': '台湾加权',
    'RUT': '罗素2000', 'CRYPTO': '加密货币',
    'STI': '新加坡STI', 'IMOEX': '俄罗斯IMOEX', 'AEX': '荷兰AEX', 'SMI': '瑞士SMI'
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
  parseHeatmapQuery: extractHeatmapQuery,  // Alias for NL-2 integration
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
