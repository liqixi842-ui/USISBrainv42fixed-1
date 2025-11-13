/**
 * symbolResolver/scoring.js
 * 多维度候选评分系统
 * 
 * 评分维度（总分100）：
 * - 交易所匹配：0-40分
 * - 股票代码匹配：0-25分
 * - 名称相似度：0-15分
 * - 货币/类型：0-10分
 * - 验证奖励：0-10分
 */

const { scoreExchangeMatch } = require("../normalize");

// 默认评分权重
const DEFAULT_WEIGHTS = {
  exchangeMatch: 40,
  countryMatch: 20,
  tickerMatch: 25,
  nameSimilarity: 15,
  currencyMatch: 5,
  typeMatch: 5,
  validationBonus: 10
};

/**
 * 计算字符串相似度（简化版Jaro-Winkler）
 * @param {string} s1 
 * @param {string} s2 
 * @returns {number} 0-1
 */
function stringSimilarity(s1, s2) {
  if (!s1 || !s2) return 0;
  
  const lower1 = s1.toLowerCase().trim();
  const lower2 = s2.toLowerCase().trim();
  
  // 精确匹配
  if (lower1 === lower2) return 1.0;
  
  // 包含匹配
  if (lower1.includes(lower2) || lower2.includes(lower1)) {
    return 0.7;
  }
  
  // 开头匹配
  if (lower1.startsWith(lower2) || lower2.startsWith(lower1)) {
    return 0.6;
  }
  
  // 简化的编辑距离
  const maxLen = Math.max(lower1.length, lower2.length);
  let matches = 0;
  
  for (let i = 0; i < Math.min(lower1.length, lower2.length); i++) {
    if (lower1[i] === lower2[i]) matches++;
  }
  
  return matches / maxLen;
}

/**
 * 对候选列表进行多维度评分
 * @param {Array<Object>} candidates - 候选列表
 * @param {Object} context - 评分上下文
 * @param {Object} [weights=DEFAULT_WEIGHTS] - 评分权重
 * @returns {Array<Object>} 排序后的候选列表（带score和reasons字段）
 */
function scoreCandidates(candidates, context, weights = DEFAULT_WEIGHTS) {
  if (!candidates || candidates.length === 0) {
    return [];
  }
  
  const { ticker, nameHint, exchangeHint, exchangeMap } = context;
  
  console.log(`\n📊 [Scoring] 开始评分 ${candidates.length} 个候选`);
  console.log(`   Context: ticker=${ticker}, nameHint=${nameHint}, exchangeHint=${exchangeHint}`);
  
  const scored = candidates.map(candidate => {
    const reasons = [];
    let score = 0;
    
    // 1. 交易所/国家匹配（0-40分）
    if (exchangeMap && candidate.exchange) {
      const exchangeScore = scoreExchangeMatch(candidate.exchange, exchangeMap);
      
      if (exchangeScore === 40) {
        score += weights.exchangeMatch;
        reasons.push(`exchange:preferred(${candidate.exchange})`);
      } else if (exchangeScore === 30) {
        score += weights.exchangeMatch * 0.75;
        reasons.push(`exchange:alias(${candidate.exchange})`);
      }
    }
    
    // 国家匹配（额外奖励）
    if (exchangeMap && candidate.country) {
      const countryLower = candidate.country.toLowerCase();
      const expectedCountry = exchangeMap.country.toLowerCase();
      
      if (countryLower.includes(expectedCountry) || expectedCountry.includes(countryLower)) {
        score += weights.countryMatch;
        reasons.push(`country:match(${candidate.country})`);
      }
    }
    
    // 2. 股票代码匹配（0-25分）
    if (ticker && candidate.ticker) {
      const tickerLower = candidate.ticker.toLowerCase();
      const queryTickerLower = ticker.toLowerCase();
      
      if (tickerLower === queryTickerLower) {
        score += weights.tickerMatch;
        reasons.push('ticker:exact');
      } else if (tickerLower.includes(queryTickerLower) || queryTickerLower.includes(tickerLower)) {
        score += weights.tickerMatch * 0.5;
        reasons.push('ticker:partial');
      }
    }
    
    // 3. 名称相似度（0-15分）
    if (nameHint && candidate.name) {
      const similarity = stringSimilarity(nameHint, candidate.name);
      const nameScore = similarity * weights.nameSimilarity;
      
      if (nameScore > 0) {
        score += nameScore;
        reasons.push(`name:similarity(${(similarity * 100).toFixed(0)}%)`);
      }
    }
    
    // 4. 货币匹配（0-5分）
    if (candidate.currency) {
      const currencyUpper = candidate.currency.toUpperCase();
      
      // 根据交易所推断预期货币
      const expectedCurrencies = {
        'BME': 'EUR',
        'EPA': 'EUR',
        'XETRA': 'EUR',
        'MIL': 'EUR',
        'NASDAQ': 'USD',
        'NYSE': 'USD',
        'LSE': 'GBP',
        'HKEX': 'HKD',
        'TSE': 'JPY',
        'SSE': 'CNY',
        'SZSE': 'CNY'
      };
      
      const expectedCurrency = exchangeMap ? expectedCurrencies[exchangeMap.preferred] : null;
      
      if (expectedCurrency && currencyUpper === expectedCurrency) {
        score += weights.currencyMatch;
        reasons.push(`currency:match(${currencyUpper})`);
      }
    }
    
    // 5. 证券类型匹配（0-5分）
    if (candidate.type) {
      const typeLower = candidate.type.toLowerCase();
      
      // 优先普通股
      if (typeLower.includes('common stock') || typeLower.includes('equity')) {
        score += weights.typeMatch;
        reasons.push('type:common_stock');
      } else if (typeLower.includes('preferred')) {
        score += weights.typeMatch * 0.5;
        reasons.push('type:preferred');
      }
    }
    
    return {
      ...candidate,
      score: Math.round(score * 10) / 10, // 保留1位小数
      reasons
    };
  });
  
  // 按分数降序排序
  scored.sort((a, b) => b.score - a.score);
  
  // 输出评分详情
  console.log(`\n🏆 [Scoring] 评分结果（Top 5）:`);
  scored.slice(0, 5).forEach((c, i) => {
    console.log(`   ${i + 1}. ${c.exchange}:${c.ticker} - ${c.score}分`);
    console.log(`      Reasons: ${c.reasons.join(', ')}`);
  });
  
  return scored;
}

/**
 * 应用验证奖励
 * @param {Array<Object>} candidates - 候选列表
 * @param {Object} validationResults - 验证结果 {ticker: boolean}
 * @param {number} bonus - 奖励分数（默认10）
 * @returns {Array<Object>} 更新后的候选列表
 */
function applyValidationBonus(candidates, validationResults, bonus = DEFAULT_WEIGHTS.validationBonus) {
  return candidates.map(candidate => {
    const key = `${candidate.ticker}:${candidate.exchange}`;
    const validated = validationResults[key];
    
    if (validated === true) {
      return {
        ...candidate,
        score: candidate.score + bonus,
        reasons: [...candidate.reasons, `validated:+${bonus}pts`],
        validated: true
      };
    } else if (validated === false) {
      return {
        ...candidate,
        reasons: [...candidate.reasons, 'validated:failed'],
        validated: false
      };
    }
    
    return candidate;
  });
}

module.exports = {
  scoreCandidates,
  applyValidationBonus,
  DEFAULT_WEIGHTS,
  stringSimilarity
};
