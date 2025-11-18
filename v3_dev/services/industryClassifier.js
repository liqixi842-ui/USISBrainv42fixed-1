/**
 * Industry Classifier v5.1
 * 行业分类器 - 根据交易所、国家、公司名等信息识别行业类型
 * 用于动态调整报告模板和 AI prompt 风格
 */

/**
 * 行业类型定义
 */
const INDUSTRY_TYPES = {
  TECH: 'technology',
  REIT: 'reit',
  FINANCIAL: 'financial',
  CONSUMER: 'consumer',
  ENERGY: 'energy',
  HEALTHCARE: 'healthcare',
  INDUSTRIAL: 'industrial',
  MATERIALS: 'materials',
  UTILITIES: 'utilities',
  TELECOM: 'telecommunications',
  UNKNOWN: 'unknown'
};

/**
 * REIT 关键词列表
 */
const REIT_KEYWORDS = [
  'inmobiliaria', 'colonial', 'socimi', 'reit', 'realty', 
  'properties', 'real estate', 'land', 'towers', 'storage',
  'apartments', 'residential', 'commercial', 'industrial properties',
  'equity residential', 'prologis', 'simon property', 'welltower',
  'merlin properties', 'hispania', 'lar', 'arima'
];

/**
 * 科技股关键词列表
 */
const TECH_KEYWORDS = [
  'nvidia', 'nvda', 'semiconductor', 'chip', 'gpu', 'ai', 'cloud',
  'software', 'tech', 'digital', 'cyber', 'data', 'meta', 'alphabet',
  'microsoft', 'apple', 'amazon', 'tesla', 'platform', 'saas'
];

/**
 * 金融股关键词列表
 */
const FINANCIAL_KEYWORDS = [
  'bank', 'banco', 'santander', 'bbva', 'sabadell', 'caixabank',
  'insurance', 'seguros', 'fintech', 'payment', 'capital', 'asset management',
  'jpmorgan', 'goldman', 'wells fargo', 'hsbc'
];

/**
 * 能源股关键词列表
 */
const ENERGY_KEYWORDS = [
  'oil', 'gas', 'petroleum', 'energia', 'repsol', 'exxon', 'chevron',
  'shell', 'bp', 'renewable', 'solar', 'wind', 'iberdrola', 'endesa'
];

/**
 * 电信股关键词列表
 */
const TELECOM_KEYWORDS = [
  'telefonica', 'telecom', 'vodafone', 'orange', 'verizon', 'att',
  'wireless', 'mobile', 'broadband', 'fiber'
];

/**
 * 根据公司名、交易所、国家等信息识别行业
 * @param {Object} symbolInfo - 符号信息
 * @param {string} symbolInfo.displayName - 公司名
 * @param {string} symbolInfo.exchange - 交易所
 * @param {string} symbolInfo.country - 国家
 * @param {string} symbolInfo.symbol - 股票代码
 * @returns {string} - 行业类型
 */
function classifyIndustry(symbolInfo) {
  if (!symbolInfo) {
    return INDUSTRY_TYPES.UNKNOWN;
  }

  const { displayName = '', exchange = '', country = '', symbol = '' } = symbolInfo;
  const searchText = `${displayName} ${symbol}`.toLowerCase();

  console.log(`🏭 [Industry Classifier] Analyzing: ${displayName}`);
  console.log(`   Symbol: ${symbol}`);
  console.log(`   Exchange: ${exchange}`);
  console.log(`   Country: ${country}`);

  // 优先级 1: REIT 检测
  if (REIT_KEYWORDS.some(kw => searchText.includes(kw.toLowerCase()))) {
    console.log(`   ✅ Industry: REIT`);
    return INDUSTRY_TYPES.REIT;
  }

  // 优先级 2: 科技股检测
  if (TECH_KEYWORDS.some(kw => searchText.includes(kw.toLowerCase()))) {
    console.log(`   ✅ Industry: Technology`);
    return INDUSTRY_TYPES.TECH;
  }

  // 优先级 3: 金融股检测
  if (FINANCIAL_KEYWORDS.some(kw => searchText.includes(kw.toLowerCase()))) {
    console.log(`   ✅ Industry: Financial`);
    return INDUSTRY_TYPES.FINANCIAL;
  }

  // 优先级 4: 能源股检测
  if (ENERGY_KEYWORDS.some(kw => searchText.includes(kw.toLowerCase()))) {
    console.log(`   ✅ Industry: Energy`);
    return INDUSTRY_TYPES.ENERGY;
  }

  // 优先级 5: 电信股检测
  if (TELECOM_KEYWORDS.some(kw => searchText.includes(kw.toLowerCase()))) {
    console.log(`   ✅ Industry: Telecommunications`);
    return INDUSTRY_TYPES.TELECOM;
  }

  // 默认：未知行业
  console.log(`   ⚠️  Industry: Unknown (defaulting to generic)`);
  return INDUSTRY_TYPES.UNKNOWN;
}

/**
 * 根据行业返回适合的 AI prompt 风格指南
 * @param {string} industry - 行业类型
 * @returns {Object} - { focus, metrics, tone }
 */
function getIndustryPromptGuidance(industry) {
  const guidance = {
    [INDUSTRY_TYPES.REIT]: {
      focus: 'Real estate portfolio quality, occupancy rates, rental yield, NAV discount/premium, property valuations, geographic diversification',
      metrics: 'FFO (Funds From Operations), AFFO, NAV per share, loan-to-value ratio, occupancy %, rent growth, cap rates',
      tone: 'Focus on asset quality, income stability, and dividend sustainability. Emphasize location strategy and tenant quality.'
    },
    [INDUSTRY_TYPES.TECH]: {
      focus: 'Innovation pipeline, cloud adoption, AI integration, platform effects, competitive moats, R&D efficiency',
      metrics: 'Revenue growth, gross margin, operating leverage, free cash flow, customer acquisition cost, net revenue retention',
      tone: 'Emphasize growth trajectory, technological leadership, and market share dynamics. Focus on secular trends and competitive positioning.'
    },
    [INDUSTRY_TYPES.FINANCIAL]: {
      focus: 'Asset quality, capital adequacy, loan growth, net interest margin, fee income diversification, regulatory compliance',
      metrics: 'ROE, ROA, NIM (Net Interest Margin), CET1 ratio, NPL ratio, cost-to-income ratio, loan loss provisions',
      tone: 'Focus on balance sheet strength, credit quality, and capital management. Emphasize risk-adjusted returns and regulatory headwinds/tailwinds.'
    },
    [INDUSTRY_TYPES.ENERGY]: {
      focus: 'Commodity price sensitivity, production costs, reserve replacement, energy transition strategy, regulatory environment',
      metrics: 'Production volumes, reserve life, EBITDA per barrel, breakeven oil price, debt/EBITDA, capex discipline',
      tone: 'Emphasize commodity cycle positioning, cost competitiveness, and energy transition readiness. Focus on cash generation and shareholder returns.'
    },
    [INDUSTRY_TYPES.CONSUMER]: {
      focus: 'Brand strength, channel dynamics, pricing power, innovation pipeline, market share trends',
      metrics: 'Same-store sales growth, gross margin, inventory turnover, customer lifetime value, brand equity',
      tone: 'Focus on consumer trends, competitive positioning, and operational execution. Emphasize category leadership and innovation.'
    },
    [INDUSTRY_TYPES.TELECOM]: {
      focus: 'Network quality, subscriber growth, ARPU trends, 5G rollout, fiber penetration, competitive intensity',
      metrics: 'Subscriber count, ARPU, churn rate, capex intensity, EBITDA margin, spectrum efficiency',
      tone: 'Emphasize infrastructure quality, customer retention, and regulatory landscape. Focus on cash flow stability and network investment returns.'
    },
    [INDUSTRY_TYPES.UNKNOWN]: {
      focus: 'Business model strength, competitive positioning, market dynamics, operational efficiency, growth prospects',
      metrics: 'Revenue growth, profit margins, return on capital, free cash flow, market share',
      tone: 'Maintain balanced institutional tone. Focus on fundamental drivers and competitive advantages.'
    }
  };

  return guidance[industry] || guidance[INDUSTRY_TYPES.UNKNOWN];
}

module.exports = {
  INDUSTRY_TYPES,
  classifyIndustry,
  getIndustryPromptGuidance
};
