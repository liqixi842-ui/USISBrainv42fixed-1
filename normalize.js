/**
 * normalize.js
 * 交易所映射与符号格式规范化
 * 
 * 核心功能：
 * 1. 国家/交易所同义词统一映射
 * 2. Twelve Data ↔ TradingView 格式转换
 * 3. 规范化候选对象
 */

// 交易所映射表（可扩展）
const EXCHANGE_MAP = {
  // 西班牙
  ES: { preferred: "BME", aliases: ["BME", "XMAD", "MC"], country: "Spain" },
  SPAIN: { preferred: "BME", aliases: ["BME", "XMAD", "MC"], country: "Spain" },
  ESPAÑA: { preferred: "BME", aliases: ["BME", "XMAD", "MC"], country: "Spain" },
  
  // 美国
  US: { preferred: "NASDAQ", aliases: ["NASDAQ", "NYSE", "AMEX", "US"], country: "United States" },
  USA: { preferred: "NASDAQ", aliases: ["NASDAQ", "NYSE", "AMEX", "US"], country: "United States" },
  
  // 香港
  HK: { preferred: "HKEX", aliases: ["HKEX", "HKG"], country: "Hong Kong" },
  HONGKONG: { preferred: "HKEX", aliases: ["HKEX", "HKG"], country: "Hong Kong" },
  
  // 中国
  CN: { preferred: "SSE", aliases: ["SSE", "SZSE", "SHH", "SHZ"], country: "China" },
  CHINA: { preferred: "SSE", aliases: ["SSE", "SZSE", "SHH", "SHZ"], country: "China" },
  
  // 英国
  UK: { preferred: "LSE", aliases: ["LSE", "LON"], country: "United Kingdom" },
  
  // 日本
  JP: { preferred: "TSE", aliases: ["TSE", "JPX"], country: "Japan" },
  JAPAN: { preferred: "TSE", aliases: ["TSE", "JPX"], country: "Japan" },
};

// Twelve Data 交易所代码 → 规范化代码
const TD_EXCHANGE_NORMALIZATION = {
  XMAD: "BME",    // 西班牙马德里交易所
  MC: "BME",      // Madrid 另一种表示
  NASDAQ: "NASDAQ",
  NYSE: "NYSE",
  HKEX: "HKEX",
  HKG: "HKEX",
  SSE: "SSE",
  SZSE: "SZSE",
  LSE: "LSE",
  LON: "LSE",
  TSE: "TSE",
  JPX: "TSE",
};

/**
 * 规范化国家/交易所代码
 * @param {string} code - 国家或交易所代码（如 "Spain", "ES", "BME"）
 * @returns {Object|undefined} - {preferred, aliases, country}
 */
function normalizeCountry(code) {
  if (!code) return undefined;
  
  const key = code.toUpperCase().trim();
  
  // 直接命中
  if (EXCHANGE_MAP[key]) {
    return EXCHANGE_MAP[key];
  }
  
  // 模糊匹配（支持部分匹配）
  for (const [k, v] of Object.entries(EXCHANGE_MAP)) {
    if (key.includes(k) || k.includes(key)) {
      return v;
    }
    if (v.country.toUpperCase().includes(key)) {
      return v;
    }
  }
  
  return undefined;
}

/**
 * 规范化 Twelve Data 交易所代码
 * @param {string} exchange - Twelve Data 返回的交易所代码（如 "XMAD"）
 * @returns {string} - 规范化后的代码（如 "BME"）
 */
function normalizeTDExchange(exchange) {
  if (!exchange) return exchange;
  
  const upper = exchange.toUpperCase().trim();
  return TD_EXCHANGE_NORMALIZATION[upper] || upper;
}

/**
 * 转换为 TradingView 格式
 * @param {Object} candidate - {ticker, exchange}
 * @returns {string} - "BME:COL"
 */
function toTradingView(candidate) {
  const { ticker, exchange } = candidate;
  if (!exchange) return ticker;
  return `${exchange}:${ticker}`;
}

/**
 * 转换为 Twelve Data 格式
 * @param {Object} candidate - {ticker, exchange}
 * @returns {string} - "COL:XMAD"
 */
function toTwelveData(candidate) {
  const { ticker, exchange } = candidate;
  if (!exchange) return ticker;
  
  // 反向映射：BME → XMAD
  const tdExchange = exchange === "BME" ? "XMAD" : exchange;
  return `${ticker}:${tdExchange}`;
}

/**
 * 规范化候选对象（统一字段）
 * @param {Object} rawCandidate - Twelve Data 原始返回
 * @returns {Object} - 规范化的候选对象
 */
function normalizeCandidate(rawCandidate) {
  return {
    ticker: rawCandidate.symbol || rawCandidate.ticker,
    exchange: normalizeTDExchange(rawCandidate.exchange),
    name: rawCandidate.instrument_name || rawCandidate.name,
    country: rawCandidate.country,
    currency: rawCandidate.currency,
    type: rawCandidate.type,
    source: "twelvedata",
    score: 0,
    reasons: [],
  };
}

/**
 * 检查交易所是否匹配
 * @param {string} candidateExchange - 候选交易所
 * @param {Object} preferredMap - normalizeCountry() 返回的映射
 * @returns {number} - 匹配分数 (0/30/40)
 */
function scoreExchangeMatch(candidateExchange, preferredMap) {
  if (!preferredMap || !candidateExchange) return 0;
  
  const upper = candidateExchange.toUpperCase();
  
  // 精确匹配首选交易所
  if (upper === preferredMap.preferred) return 40;
  
  // 匹配别名
  if (preferredMap.aliases.some(alias => alias.toUpperCase() === upper)) return 30;
  
  return 0;
}

module.exports = {
  normalizeCountry,
  normalizeTDExchange,
  toTradingView,
  toTwelveData,
  normalizeCandidate,
  scoreExchangeMatch,
  EXCHANGE_MAP,
};
