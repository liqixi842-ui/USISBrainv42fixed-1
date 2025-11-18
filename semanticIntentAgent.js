// ====== Semantic Intent Agent ======
// 使用AI理解用户意图，而非正则表达式和关键词匹配
// 这是从"工作流"到"智能"的核心转变

const fetch = require("node-fetch");
const { createIntent, createEntity, INTENT_TYPES, ENTITY_TYPES, EXCHANGES, SECTORS } = require("./schemas");

const OPENAI_KEY = process.env.OPENAI_API_KEY;

/**
 * 语义意图理解Agent - 用AI解析用户意图
 * @param {string} userText - 用户原始输入
 * @param {Array} userHistory - 用户历史记录（用于上下文理解）
 * @returns {Promise<Intent>} - 结构化的意图对象
 */
async function parseUserIntent(userText, userHistory = []) {
  console.log(`\n🧠 [Semantic Intent Agent] 开始解析用户意图: "${userText}"`);
  
  // 🆕 快速检测：研报命令（v5格式：研报, 股票代码, 机构名字, 老师名字, 语言）
  const trimmedText = userText.trim();
  if (trimmedText.startsWith('研报') || trimmedText.startsWith('/研报')) {
    console.log(`📊 [Quick Detection] 检测到研报命令，解析参数...`);
    const reportParams = parseResearchReportCommand(userText);
    if (reportParams) {
      return createIntent({
        intentType: 'RESEARCH_REPORT_V5',
        entities: [createEntity({ type: 'symbol', value: reportParams.symbol })],
        mode: 'research_report_v5',
        actions: [{ 
          type: 'generate_research_report_v5', 
          symbol: reportParams.symbol,
          firm: reportParams.firm,
          analyst: reportParams.analyst,
          lang: reportParams.lang,
          reason: '用户请求生成v5研报'
        }],
        confidence: 1.0,
        reasoning: `用户使用简化协议请求生成研报: ${reportParams.symbol}`,
        language: reportParams.lang,
        responseMode: 'research_report_v5',
        reportParams
      });
    }
  }
  
  // 🆕 快速检测：纯新闻命令（不调用AI，直接返回）
  if (/^(新闻|资讯|news|市场动态|头条)[\s!！?？。.]*$/i.test(trimmedText)) {
    console.log(`📰 [Quick Detection] 检测到纯新闻命令，直接返回news intent`);
    return createIntent({
      intentType: INTENT_TYPES.NEWS,
      entities: [],
      mode: 'news',
      actions: [{ type: 'fetch_news', reason: '用户请求新闻资讯' }],
      confidence: 1.0,
      reasoning: '用户直接请求新闻资讯',
      language: /[\u4e00-\u9fa5]/.test(userText) ? 'zh' : 'en',
      responseMode: 'news',
      timeHorizon: '2h'
    });
  }
  
  // 构建AI Prompt - 让AI理解意图而非关键词匹配
  const systemPrompt = buildIntentPrompt();
  const userPrompt = buildUserPrompt(userText, userHistory);
  
  try {
    // 🛡️ 创建AbortController进行15秒超时保护
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    // 调用GPT-4o-mini进行快速意图理解
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,  // 低温度确保稳定输出
        max_tokens: 1000
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    const rawIntent = JSON.parse(data.choices[0].message.content);
    
    // 转换AI输出为标准Intent Schema
    const intent = normalizeIntent(rawIntent);
    
    console.log(`✅ [Semantic Intent Agent] 意图理解完成:`);
    console.log(`   - 类型: ${intent.intentType}`);
    console.log(`   - 实体: ${intent.entities.map(e => `${e.value}(${e.type})`).join(', ')}`);
    console.log(`   - 交易所: ${intent.exchange || '未指定'}`);
    console.log(`   - 行业: ${intent.sector || '未指定'}`);
    console.log(`   - 置信度: ${intent.confidence.toFixed(2)}`);
    console.log(`   - 推理: ${intent.reasoning}`);
    
    return intent;
    
  } catch (error) {
    console.error(`❌ [Semantic Intent Agent] 意图解析失败:`, error.message);
    
    // 降级：返回基础意图
    return createFallbackIntent(userText);
  }
}

/**
 * 构建AI系统Prompt
 */
function buildIntentPrompt() {
  return `你是USIS Brain的意图理解专家。你的任务是理解用户的股票市场查询意图，并返回结构化的JSON。

**你的职责**：
1. 识别意图类型（股票查询、行业热力图、指数查询、新闻、宏观、闲聊等）
2. 提取实体（公司名称、股票代码、行业、指数等）
3. **【关键】推断交易所（exchange字段）**：
   - 明确国家/市场提示："西班牙股票" → "Spain"
   - 明确交易所提示："BME上市的" → "Spain"
   - 公司所属地："Colonial是西班牙公司" → "Spain"
   - 符号后缀：".MC" → "Spain", ".HK" → "HK", ".L" → "UK"
   - **重要**：有明确国家/交易所信息时，exchange字段必须设置，不能为null
4. 识别用户需要的动作（获取报价、新闻、热力图等）
5. **识别输出模式（responseMode）**：用户想要什么类型的输出？
   - 'news': 只要新闻资讯（"给我新闻"、"两小时内新闻"、"盘前资讯"）
   - 'analysis': 只要分析（"分析一下"、"怎么看"、"技术分析"）
   - 'advice': 只要建议（"给建议"、"怎么操作"、"仓位建议"）
   - 'hold_recommendation': 持仓建议（"续抱"、"继续持有"、"卖出时机"、"止盈止损"）
   - 'full_report': 要完整报告（默认，或明确要"全面分析"）
6. **识别时间窗口（timeHorizon）**：新闻的时间范围
   - "2小时内"、"两小时"、"最近"、"盘前" → "2h"
   - "24小时"、"今天"、"全天" → "24h"
   - "本周"、"一周" → "7d"
7. **识别持仓信息（positionContext）**：用户的持仓情况
   - 买入价格（"31.51买进"、"成本30美元"）→ extractedPrice: 31.51
   - 持仓意图（"续抱"、"继续持有"、"何时卖出"）→ holdingIntent: true
   - 盈亏状况（"被套"、"盈利中"、"亏损"）→ profitStatus: "loss"/"profit"

**关键原则**：
- 使用语义理解，不要依赖关键词匹配
- "Grifols" → 识别为西班牙公司，type='company', exchange='Spain'
- "sab" → 可能是"Sabadell"银行的简称, exchange='Spain'
- "能源板块" → sector='energy'
- "银行板块" → sector='financials'
- "西班牙热力图" → exchange='Spain', 需要heatmap
- "分析西班牙股票 COL" → exchange='Spain', entities=[{type:'symbol', value:'COL', exchangeHint:'Spain', exchangeConfidence:1.0}]
- "香港股票腾讯" → exchange='HK', entities=[{type:'company', value:'腾讯', exchangeHint:'HK', exchangeConfidence:1.0}]
- **对于非美国市场，exchange字段和entity.exchangeHint必须设置，这是符号解析的关键依据**
- **entity.exchangeHint优先级高于intent.exchange**，用于处理多市场混合查询

**支持的意图类型**：
- stock_query: 查询单个或多个股票
- sector_heatmap: 行业板块热力图
- index_query: 指数查询（如S&P 500, IBEX35）
- market_overview: 市场总览
- news: 新闻资讯
- macro: 宏观经济
- casual: 闲聊
- meta: 系统操作（清除记忆、帮助等）

**实体类型**：
- company: 公司名称（如"Grifols", "苹果", "Telefonica"）
- symbol: 股票代码（如"AAPL", "IBE.MC"）
- sector: 行业（energy, technology, financials, healthcare等）
- index: 指数（"S&P 500", "IBEX35", "恒生指数"）

**交易所**：
US, Spain, HK, CN, EU, UK, JP, Global

**输出JSON格式**：
{
  "intentType": "stock_query",
  "entities": [
    {
      "type": "symbol",
      "value": "DKNG",
      "normalizedValue": "DKNG",
      "confidence": 0.95,
      "exchangeHint": "US",
      "exchangeConfidence": 1.0
    }
  ],
  "mode": "intraday",
  "exchange": "US",
  "sector": null,
  "actions": ["fetch_quotes", "fetch_news"],
  "responseMode": "hold_recommendation",
  "timeHorizon": "2h",
  "positionContext": {
    "buyPrice": 31.51,
    "holdingIntent": true,
    "profitStatus": "unknown"
  },
  "confidence": 0.9,
  "reasoning": "用户持有DKNG股票，成本31.51美元，询问是否应该续抱"
}

**responseMode示例**：
- "AAPL 新闻" → responseMode="news", timeHorizon="2h"
- "分析TSLA" → responseMode="analysis"
- "给我西班牙热力图和建议" → responseMode="advice"
- "DKNG 31.51买进，给续抱建议" → responseMode="hold_recommendation", positionContext={buyPrice:31.51, holdingIntent:true}
- "IBEX35 全面分析" → responseMode="full_report"
- "两小时内影响IBEX的新闻" → responseMode="news", timeHorizon="2h"

**持仓场景识别示例**：
- "NVDA 500美元买的，现在怎么办" → positionContext={buyPrice:500, holdingIntent:true}
- "TSLA被套了，何时止损" → positionContext={profitStatus:"loss", holdingIntent:true}
- "AAPL盈利20%，继续持有还是卖出" → positionContext={profitStatus:"profit", holdingIntent:true}
- "NFLX 1093买入，给出操作建议" → positionContext={buyPrice:1093, holdingIntent:true}
- "成本价30，现在该不该卖" → positionContext={buyPrice:30, holdingIntent:true}
- "亏了10%，要不要割肉" → positionContext={profitStatus:"loss", holdingIntent:true}

**同义词映射**：
- 买入、买进、建仓、入场 → 都表示买入
- 操作建议、续抱建议、持仓建议、交易建议 → 都是hold_recommendation
- 卖出时机、止盈止损、何时出场 → 都是持仓建议场景`;
}

/**
 * 构建用户Prompt
 */
function buildUserPrompt(userText, userHistory) {
  let prompt = `用户查询: "${userText}"\n\n`;
  
  // 添加用户历史上下文（最近3条）
  if (userHistory && userHistory.length > 0) {
    prompt += `用户最近历史（用于上下文理解）:\n`;
    userHistory.slice(-3).forEach((h, i) => {
      prompt += `${i + 1}. ${h.request_text || ''} (${h.mode || 'unknown'})\n`;
    });
    prompt += `\n`;
  }
  
  // 添加当前时间上下文（用于判断premarket/intraday/postmarket）
  const now = new Date();
  const etHour = parseInt(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    hour12: false
  }).format(now));
  
  let timeContext = '';
  if (etHour >= 6 && etHour < 9) timeContext = '盘前时段(premarket)';
  else if (etHour >= 9 && etHour < 16) timeContext = '盘中时段(intraday)';
  else if (etHour >= 16 && etHour < 22) timeContext = '盘后时段(postmarket)';
  else timeContext = '非交易时段';
  
  prompt += `当前时间: 美东${etHour}点 (${timeContext})\n\n`;
  prompt += `请分析用户意图并返回JSON。`;
  
  return prompt;
}

/**
 * 规范化AI输出为标准Intent Schema
 */
function normalizeIntent(rawIntent) {
  // 确保所有必需字段存在
  const intent = createIntent({
    intentType: rawIntent.intentType || INTENT_TYPES.STOCK_QUERY,
    entities: (rawIntent.entities || []).map(e => createEntity(e)),
    mode: rawIntent.mode || 'intraday',
    exchange: rawIntent.exchange || null,
    sector: rawIntent.sector || null,
    actions: rawIntent.actions || [],
    responseMode: normalizeResponseMode(rawIntent.responseMode),
    timeHorizon: rawIntent.timeHorizon || '2h',
    positionContext: rawIntent.positionContext || null,
    confidence: rawIntent.confidence || 0.5,
    reasoning: rawIntent.reasoning || '',
    language: detectLanguage(rawIntent)
  });
  
  return intent;
}

/**
 * 规范化responseMode（支持同义词）
 */
function normalizeResponseMode(mode) {
  if (!mode) return 'full_report';
  
  const normalized = mode.toLowerCase();
  
  // 同义词映射
  const synonyms = {
    'news': ['news', 'news_only', '新闻', '资讯'],
    'analysis': ['analysis', 'analysis_only', '分析', '观点', '看法'],
    'advice': ['advice', 'advice_only', '建议', '推荐', '操作'],
    'hold_recommendation': ['hold_recommendation', 'hold', 'holding', '续抱', '持仓', '继续持有', '卖出时机'],
    'full_report': ['full_report', 'full', 'complete', '完整', '全面']
  };
  
  for (const [standard, variants] of Object.entries(synonyms)) {
    if (variants.some(v => normalized.includes(v))) {
      return standard;
    }
  }
  
  return 'full_report';
}

/**
 * 检测语言
 */
function detectLanguage(rawIntent) {
  // 从实体或原始文本中检测语言
  if (rawIntent.language) return rawIntent.language;
  
  // 简单检测：如果有中文实体，返回zh
  const hasChineseEntity = (rawIntent.entities || []).some(e => 
    /[\u4e00-\u9fa5]/.test(e.value)
  );
  
  return hasChineseEntity ? 'zh' : 'en';
}

/**
 * 创建降级Intent（当AI解析失败时）
 */
function createFallbackIntent(userText) {
  console.log(`⚠️  [Semantic Intent Agent] 使用降级Intent`);
  
  // 简单的降级逻辑
  const lowerText = userText.toLowerCase();
  
  let intentType = INTENT_TYPES.STOCK_QUERY;
  const actions = [];
  let mode = 'intraday';
  
  // 检测热力图意图
  if (/热力图|heatmap/.test(userText)) {
    intentType = INTENT_TYPES.SECTOR_HEATMAP;
    actions.push('generate_heatmap');
  }
  
  // 检测新闻意图
  if (/新闻|news|资讯/.test(userText)) {
    mode = 'news';
    actions.push('fetch_news');
  }
  
  return createIntent({
    intentType,
    entities: [],  // 降级时不提取实体
    mode,
    actions,
    confidence: 0.3,  // 低置信度
    reasoning: 'AI解析失败，使用降级逻辑',
    language: /[\u4e00-\u9fa5]/.test(userText) ? 'zh' : 'en'
  });
}

/**
 * 🆕 v5.1: 解析符号描述（支持完整格式）
 * 格式: "Inmobiliaria Colonial (BME:COL, Spain)"
 * @param {string} symbolInput - 符号描述字符串
 * @returns {Object} - { displayName, symbol, exchange, country, industry }
 */
function parseSymbolDescription(symbolInput) {
  const input = symbolInput.trim();
  
  // 检测是否为完整描述格式：Name (EXCHANGE:SYMBOL, Country)
  const fullFormatMatch = input.match(/^(.+?)\s*\(([A-Z]+):([A-Z0-9.]+)\s*,\s*([^)]+)\)$/);
  
  if (fullFormatMatch) {
    const [, name, exchange, symbol, country] = fullFormatMatch;
    return {
      displayName: name.trim(),
      symbol: `${exchange}:${symbol}`,
      exchange: exchange.trim(),
      country: country.trim(),
      rawSymbol: symbol.trim(),
      isFullFormat: true
    };
  }
  
  // 检测带交易所前缀的格式：NASDAQ:NVDA
  const prefixMatch = input.match(/^([A-Z]+):([A-Z0-9.]+)$/);
  if (prefixMatch) {
    const [, exchange, symbol] = prefixMatch;
    return {
      displayName: symbol,
      symbol: `${exchange}:${symbol}`,
      exchange: exchange,
      country: null,
      rawSymbol: symbol,
      isFullFormat: false
    };
  }
  
  // 简单格式：NVDA
  return {
    displayName: input.toUpperCase(),
    symbol: input.toUpperCase(),
    exchange: null,
    country: null,
    rawSymbol: input.toUpperCase(),
    isFullFormat: false
  };
}

/**
 * 解析研报命令（v5简化协议 + v5.1完整标的描述）
 * 格式: 研报, 股票代码, 机构名字, 老师名字, 语言
 * 新增: 股票代码可以是完整描述 "Inmobiliaria Colonial (BME:COL, Spain)"
 * @param {string} userText - 用户输入
 * @returns {Object|null} - 解析结果 { symbol, firm, analyst, lang, symbolInfo } 或 null
 */
function parseResearchReportCommand(userText) {
  console.log(`📊 [Parse Report Command] 输入: "${userText}"`);
  
  // 语言映射表
  const languageMap = {
    '中文': 'zh', '中': 'zh', 'chinese': 'zh', 'zh': 'zh',
    '英文': 'en', '英': 'en', 'english': 'en', 'en': 'en',
    '西班牙语': 'es', '西班牙': 'es', '西': 'es', 'spanish': 'es', 'es': 'es',
    '法语': 'fr', '法': 'fr', 'french': 'fr', 'fr': 'fr',
    '德语': 'de', '德': 'de', 'german': 'de', 'de': 'de',
    '日语': 'ja', '日': 'ja', 'japanese': 'ja', 'ja': 'ja',
    '韩语': 'ko', '韩': 'ko', 'korean': 'ko', 'ko': 'ko'
  };
  
  // 去除命令前缀 /研报 或 研报
  let text = userText.trim();
  if (text.startsWith('/研报')) {
    text = text.substring(3).trim();
  } else if (text.startsWith('研报')) {
    text = text.substring(2).trim();
  }
  
  // 去除开头的逗号或空格
  text = text.replace(/^[,，\s]+/, '');
  
  // 按逗号分割（支持中英文逗号）
  const parts = text.split(/[,，]/).map(p => p.trim()).filter(p => p.length > 0);
  
  console.log(`   解析字段数: ${parts.length}`, parts);
  
  // 至少需要股票代码
  if (parts.length === 0) {
    console.log(`   ❌ 缺少股票代码`);
    return null;
  }
  
  // 提取参数（带默认值）
  const symbolInput = parts[0] || '';
  const firm = (parts[1] || 'USIS Research Division').trim();
  const analyst = (parts[2] || 'System (USIS Brain)').trim();
  const langRaw = (parts[3] || '英文').toLowerCase().trim();
  
  // 🆕 v5.1: 解析符号描述
  const symbolInfo = parseSymbolDescription(symbolInput);
  
  if (!symbolInfo || !symbolInfo.symbol) {
    console.log(`   ❌ 股票代码无效: "${symbolInput}"`);
    return null;
  }
  
  // 映射语言
  const lang = languageMap[langRaw] || 'en';
  
  const result = {
    symbol: symbolInfo.symbol,
    firm,
    analyst,
    lang,
    symbolInfo
  };
  
  console.log(`✅ [Parse Report Command] 解析成功:`);
  console.log(`   股票: ${symbolInfo.symbol} (${symbolInfo.displayName})`);
  if (symbolInfo.exchange) console.log(`   交易所: ${symbolInfo.exchange}`);
  if (symbolInfo.country) console.log(`   国家: ${symbolInfo.country}`);
  console.log(`   机构: ${firm}`);
  console.log(`   分析师: ${analyst}`);
  console.log(`   语言: ${lang} (原始: ${langRaw})`);
  
  return result;
}

module.exports = {
  parseUserIntent,
  parseResearchReportCommand,
  parseSymbolDescription
};
