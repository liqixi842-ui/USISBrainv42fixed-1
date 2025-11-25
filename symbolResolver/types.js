/**
 * symbolResolver/types.js
 * 符号解析器的共享类型定义
 */

/**
 * @typedef {Object} Intent
 * @property {string} raw - 原始用户输入
 * @property {string} [ticker] - 股票代码（如"COL"）
 * @property {string} [nameHint] - 公司名称提示（如"Colonial"）
 * @property {string} [countryHint] - 国家提示（如"ES", "Spain"）
 * @property {string} [exchangeHint] - 交易所提示（如"BME", "XMAD"）
 * @property {Entity[]} [entities] - 语义实体列表
 * @property {string} [exchange] - 全局交易所提示（向后兼容）
 */

/**
 * @typedef {Object} Entity
 * @property {string} type - 实体类型（symbol/company）
 * @property {string} value - 实体值
 * @property {string} [exchangeHint] - 实体级交易所提示
 * @property {number} [exchangeConfidence] - 交易所提示置信度（0-1）
 */

/**
 * @typedef {Object} Candidate
 * @property {string} ticker - 股票代码（如"COL"）
 * @property {string} exchange - 交易所代码（如"BME", "XMAD"）
 * @property {string} [name] - 公司全名（如"Inmobiliaria Colonial SOCIMI, S.A."）
 * @property {string} [country] - 国家（如"Spain"）
 * @property {string} [currency] - 货币（如"EUR"）
 * @property {string} [isin] - ISIN代码（可选）
 * @property {string} [type] - 证券类型
 * @property {string} source - 数据源（"twelvedata" | "finnhub" | "cache" | "manual"）
 * @property {number} score - 综合评分（0-100）
 * @property {string[]} reasons - 评分原因列表
 * @property {boolean} [validated] - 是否通过快速验证
 */

/**
 * @typedef {Object} ScoringContext
 * @property {string} [ticker] - 查询的股票代码
 * @property {string} [nameHint] - 公司名称提示
 * @property {string} [exchangeHint] - 交易所提示
 * @property {Object} [exchangeMap] - normalizeCountry()返回的映射
 * @property {Object} [weights] - 评分权重配置
 */

/**
 * @typedef {Object} ScoringWeights
 * @property {number} exchangeMatch - 交易所精确匹配权重（默认40）
 * @property {number} countryMatch - 国家匹配权重（默认20）
 * @property {number} tickerMatch - 代码匹配权重（默认25）
 * @property {number} nameSimilarity - 名称相似度权重（默认15）
 * @property {number} currencyMatch - 货币匹配权重（默认5）
 * @property {number} typeMatch - 证券类型权重（默认5）
 * @property {number} validationBonus - 验证通过奖励（默认10）
 */

/**
 * @typedef {Object} QualifiedSymbol
 * @property {string} tv - TradingView格式（"BME:COL"）
 * @property {string} td - Twelve Data格式（"COL:XMAD"）
 */

/**
 * @typedef {Object} ResolveResult
 * @property {QualifiedSymbol} qualified - 符号的不同格式
 * @property {number} confidence - 置信度（0-100）
 * @property {Candidate} winner - 最佳候选
 * @property {Candidate[]} alternates - 备选候选列表（top-3）
 * @property {string} [disambiguationPrompt] - 歧义消解提示（confidence<70时）
 */

/**
 * @typedef {Object} ValidationOptions
 * @property {number} timeout - 验证超时时间（毫秒，默认3000）
 * @property {boolean} enabled - 是否启用验证（默认true）
 * @property {number} maxCandidates - 验证的最大候选数（默认2）
 */

module.exports = {
  // 导出JSDoc类型供其他模块使用
};
