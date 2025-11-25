// ====== USIS Brain · Schema Definitions ======
// 定义系统中所有结构化数据的Schema，确保AI驱动的意图理解和数据处理的一致性

// ========================================
// 1. Intent Schema - 用户意图的结构化表示
// ========================================

/**
 * @typedef {Object} Intent
 * @property {string} intentType - 意图类型: 'stock_query', 'sector_heatmap', 'index_query', 'market_overview', 'news', 'macro', 'casual', 'meta'
 * @property {Array<Entity>} entities - 提取的实体列表（公司名、股票代码、行业等）
 * @property {string} mode - 场景模式: 'premarket', 'intraday', 'postmarket', 'diagnose', 'news', 'casual', 'meta'
 * @property {string|null} exchange - 交易所提示: 'US', 'Spain', 'HK', 'CN', 'EU', null
 * @property {string|null} sector - 行业/板块: 'energy', 'technology', 'financials', 'healthcare', etc.
 * @property {Array<string>} actions - 需要执行的动作: ['fetch_quotes', 'fetch_news', 'generate_heatmap', 'generate_chart']
 * @property {string} responseMode - 响应模式: 'news', 'analysis', 'advice', 'hold_recommendation', 'full_report'
 * @property {string} timeHorizon - 时间窗口: '2h', '24h', '7d'
 * @property {Object|null} positionContext - 持仓信息: {buyPrice: number, holdingIntent: boolean, profitStatus: string}
 * @property {number} confidence - 置信度 (0-1)
 * @property {string} reasoning - AI的推理过程（用于调试）
 * @property {string} language - 用户语言: 'zh', 'en', 'es'
 */

/**
 * @typedef {Object} Entity
 * @property {string} type - 实体类型: 'company', 'symbol', 'sector', 'index', 'macro_indicator'
 * @property {string} value - 提取的值（如公司名"Grifols"、符号"AAPL"）
 * @property {string|null} normalizedValue - 规范化后的值（AI理解后的标准形式）
 * @property {number} confidence - 置信度 (0-1)
 * @property {string|null} exchangeHint - 实体级交易所提示 (优先级高于intent.exchange)
 * @property {number|null} exchangeConfidence - 交易所提示的置信度 (0-1)
 */

// Intent类型枚举
const INTENT_TYPES = {
  STOCK_QUERY: 'stock_query',           // 股票查询（单个或多个）
  SECTOR_HEATMAP: 'sector_heatmap',     // 行业板块热力图
  INDEX_QUERY: 'index_query',           // 指数查询
  MARKET_OVERVIEW: 'market_overview',   // 市场总览
  NEWS: 'news',                         // 新闻资讯
  MACRO: 'macro',                       // 宏观经济
  CASUAL: 'casual',                     // 闲聊
  META: 'meta'                          // 元信息（清除记忆、帮助等）
};

// 实体类型枚举
const ENTITY_TYPES = {
  COMPANY: 'company',               // 公司名称（如"Grifols", "苹果"）
  SYMBOL: 'symbol',                 // 股票代码（如"AAPL", "IBE.MC"）
  SECTOR: 'sector',                 // 行业板块（如"能源", "technology"）
  INDEX: 'index',                   // 指数（如"S&P 500", "IBEX35"）
  MACRO_INDICATOR: 'macro_indicator' // 宏观指标（如"CPI", "利率"）
};

// 交易所枚举
const EXCHANGES = {
  US: 'US',           // 美国（NYSE, NASDAQ）
  SPAIN: 'Spain',     // 西班牙（BME）
  HK: 'HK',           // 香港
  CN: 'CN',           // 中国大陆
  EU: 'EU',           // 欧洲其他
  UK: 'UK',           // 英国
  JP: 'JP',           // 日本
  GLOBAL: 'Global'    // 全球/多市场
};

// GICS 11大行业分类（Global Industry Classification Standard）
const SECTORS = {
  ENERGY: 'energy',                     // 能源
  MATERIALS: 'materials',               // 材料
  INDUSTRIALS: 'industrials',           // 工业
  CONSUMER_DISCRETIONARY: 'consumer_discretionary', // 非必需消费品
  CONSUMER_STAPLES: 'consumer_staples', // 必需消费品
  HEALTHCARE: 'healthcare',             // 医疗保健
  FINANCIALS: 'financials',             // 金融
  INFORMATION_TECHNOLOGY: 'information_technology', // 信息技术
  COMMUNICATION_SERVICES: 'communication_services', // 通信服务
  UTILITIES: 'utilities',               // 公用事业
  REAL_ESTATE: 'real_estate'            // 房地产
};

// ========================================
// 2. Data Request Schema - 数据请求的结构化表示
// ========================================

/**
 * @typedef {Object} DataRequest
 * @property {Array<string>} symbols - 需要获取数据的股票代码列表
 * @property {Array<string>} dataTypes - 需要的数据类型: ['quote', 'news', 'fundamentals', 'technicals', 'sentiment']
 * @property {HeatmapParams|null} heatmapParams - 热力图参数（如果需要）
 * @property {string} priority - 优先级: 'high', 'medium', 'low'
 */

/**
 * @typedef {Object} HeatmapParams
 * @property {string} dataset - 数据集: 'USA', 'IBEX35', 'FTSE100', 'DAX', 'CAC40', 'CRYPTO'
 * @property {string|null} section - 行业筛选: 'energy', 'technology', 'financials', etc. (null表示全市场)
 * @property {string} color - 颜色方案: 'change' (涨跌), 'change_abs' (绝对涨跌), 'volume'
 * @property {string} group - 分组方式: 'sector' (行业), 'exchange' (交易所)
 */

// ========================================
// 3. Analyst Input Schema - 传给AI分析的数据格式
// ========================================

/**
 * @typedef {Object} AnalystInput
 * @property {MarketData} marketData - 市场数据（带来源和时间戳）
 * @property {Metadata} metadata - 数据元信息
 * @property {string} userQuery - 用户原始查询
 * @property {Intent} intent - 解析后的意图
 * @property {string} mode - 分析模式
 * @property {string} language - 目标语言
 */

/**
 * @typedef {Object} MarketData
 * @property {boolean} collected - 数据是否成功采集
 * @property {Object} quotes - 股票报价数据 { symbol: QuoteData }
 * @property {Array} news - 新闻数据
 * @property {Object} fundamentals - 基本面数据
 * @property {Object} technicals - 技术指标
 * @property {string} summary - 数据摘要（用于AI快速理解）
 */

/**
 * @typedef {Object} QuoteData
 * @property {string} symbol - 股票代码
 * @property {number} currentPrice - 当前价格
 * @property {number} change - 涨跌额
 * @property {number} changePercent - 涨跌幅
 * @property {number} volume - 成交量
 * @property {number} timestamp - 数据时间戳
 * @property {string} source - 数据来源: 'finnhub', 'alpha_vantage', 'cache'
 * @property {number} freshnessScore - 新鲜度评分 (0-1, 1表示实时)
 */

/**
 * @typedef {Object} Metadata
 * @property {string} requestId - 请求ID
 * @property {number} timestamp - 请求时间戳
 * @property {Array<DataProvenance>} dataSources - 数据来源列表
 * @property {Object} dataQuality - 数据质量评估
 * @property {boolean} complete - 数据是否完整
 * @property {Array<string>} missingFields - 缺失的字段
 */

/**
 * @typedef {Object} DataProvenance
 * @property {string} provider - 数据提供商: 'finnhub', 'alpha_vantage', 'fred', 'sec_edgar'
 * @property {string} endpoint - API端点
 * @property {number} timestamp - 数据获取时间
 * @property {number} freshnessMinutes - 数据新鲜度（分钟）
 * @property {string} status - 状态: 'success', 'partial', 'failed'
 */

// ========================================
// 4. Validation Helpers - Schema验证辅助函数
// ========================================

/**
 * 验证Intent对象是否符合Schema
 */
function validateIntent(intent) {
  const required = ['intentType', 'entities', 'mode', 'confidence'];
  const missing = required.filter(field => !(field in intent));
  
  if (missing.length > 0) {
    throw new Error(`Invalid Intent: missing fields ${missing.join(', ')}`);
  }
  
  if (!Object.values(INTENT_TYPES).includes(intent.intentType)) {
    throw new Error(`Invalid intentType: ${intent.intentType}`);
  }
  
  if (intent.confidence < 0 || intent.confidence > 1) {
    throw new Error(`Invalid confidence: ${intent.confidence} (must be 0-1)`);
  }
  
  return true;
}

/**
 * 验证MarketData对象是否符合Schema
 */
function validateMarketData(marketData) {
  if (typeof marketData !== 'object' || marketData === null) {
    throw new Error('Invalid MarketData: must be an object');
  }
  
  if (!('collected' in marketData)) {
    throw new Error('Invalid MarketData: missing "collected" field');
  }
  
  return true;
}

/**
 * 创建Intent对象的工厂函数
 */
function createIntent({
  intentType = INTENT_TYPES.STOCK_QUERY,
  entities = [],
  mode = 'intraday',
  exchange = null,
  sector = null,
  actions = [],
  responseMode = 'full_report',
  timeHorizon = '2h',
  positionContext = null,
  confidence = 0.5,
  reasoning = '',
  language = 'zh'
} = {}) {
  return {
    intentType,
    entities,
    mode,
    exchange,
    sector,
    actions,
    responseMode,
    timeHorizon,
    positionContext,
    confidence,
    reasoning,
    language
  };
}

/**
 * 创建Entity对象的工厂函数
 */
function createEntity({
  type,
  value,
  normalizedValue = null,
  confidence = 1.0,
  exchangeHint = null,           // 🆕 v6.2: 实体级交易所提示
  exchangeConfidence = null      // 🆕 v6.2: 交易所提示置信度
}) {
  return {
    type,
    value,
    normalizedValue,
    confidence,
    exchangeHint,
    exchangeConfidence
  };
}

// ========================================
// Exports
// ========================================

module.exports = {
  // Enums
  INTENT_TYPES,
  ENTITY_TYPES,
  EXCHANGES,
  SECTORS,
  
  // Factory functions
  createIntent,
  createEntity,
  
  // Validation
  validateIntent,
  validateMarketData
};
