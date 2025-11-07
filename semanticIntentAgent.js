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
  
  // 构建AI Prompt - 让AI理解意图而非关键词匹配
  const systemPrompt = buildIntentPrompt();
  const userPrompt = buildUserPrompt(userText, userHistory);
  
  try {
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
      })
    });
    
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
3. 推断交易所（美国、西班牙、香港等）
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
- "Grifols" → 识别为西班牙公司，type='company'
- "sab" → 可能是"Sabadell"银行的简称
- "能源板块" → sector='energy'
- "银行板块" → sector='financials'
- "西班牙热力图" → 推断exchange='Spain', 需要heatmap
- 对于非美国市场，优先推断交易所

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
    {"type": "symbol", "value": "DKNG", "normalizedValue": "DKNG", "confidence": 0.95}
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
- "AAPL盈利20%，继续持有还是卖出" → positionContext={profitStatus:"profit", holdingIntent:true}`;
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

module.exports = {
  parseUserIntent
};
