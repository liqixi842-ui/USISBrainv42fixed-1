/**
 * symbolResolver/validator.js
 * 候选符号快速验证
 * 
 * 通过调用Twelve Data /price接口验证符号有效性
 * - 成功：返回有效价格 → validated=true
 * - 失败：返回错误/null → validated=false
 */

const fetch = require("node-fetch");
const { toTwelveData } = require("../normalize");

const TWELVE_DATA_KEY = process.env.TWELVE_DATA_API_KEY;

// 默认验证选项
const DEFAULT_VALIDATION_OPTIONS = {
  timeout: 3000,        // 3秒超时
  enabled: true,        // 默认启用
  maxCandidates: 2      // 最多验证前2个候选
};

/**
 * 验证单个候选符号
 * @param {Object} candidate - 候选对象 {ticker, exchange}
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<boolean>} true=有效, false=无效
 */
async function validateCandidate(candidate, timeout = 3000) {
  if (!TWELVE_DATA_KEY) {
    console.warn(`   ⚠️  [Validator] TWELVE_DATA_API_KEY未配置，跳过验证`);
    return null; // null表示未验证
  }
  
  try {
    // 转换为Twelve Data格式（COL:XMAD）
    const tdSymbol = toTwelveData(candidate);
    
    const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(tdSymbol)}&apikey=${TWELVE_DATA_KEY}`;
    
    console.log(`   🔍 [Validator] 验证: ${tdSymbol}`);
    
    // 创建超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log(`   ❌ [Validator] HTTP ${response.status}: ${tdSymbol}`);
      return false;
    }
    
    const data = await response.json();
    
    // 检查响应格式
    if (data.status === 'error') {
      console.log(`   ❌ [Validator] API错误: ${data.message || 'unknown'}`);
      return false;
    }
    
    // 检查价格有效性
    const price = parseFloat(data.price);
    
    if (isNaN(price) || price <= 0) {
      console.log(`   ❌ [Validator] 无效价格: ${data.price}`);
      return false;
    }
    
    console.log(`   ✅ [Validator] 有效 - ${tdSymbol} = ${price}`);
    return true;
    
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log(`   ⏱️  [Validator] 超时: ${candidate.ticker}`);
    } else {
      console.log(`   ❌ [Validator] 验证失败: ${error.message}`);
    }
    return false;
  }
}

/**
 * 批量快速验证候选列表（异步并发）
 * @param {Array<Object>} candidates - 候选列表
 * @param {Object} options - 验证选项
 * @returns {Promise<Object>} 验证结果映射 {ticker:exchange => boolean}
 */
async function quickValidate(candidates, options = DEFAULT_VALIDATION_OPTIONS) {
  const opts = { ...DEFAULT_VALIDATION_OPTIONS, ...options };
  
  if (!opts.enabled) {
    console.log(`   ⏭️  [Validator] 验证已禁用`);
    return {};
  }
  
  if (!TWELVE_DATA_KEY) {
    console.log(`   ⏭️  [Validator] API密钥未配置，跳过验证`);
    return {};
  }
  
  // 只验证前N个候选
  const toValidate = candidates.slice(0, opts.maxCandidates);
  
  console.log(`\n🔍 [Validator] 开始验证 ${toValidate.length} 个候选 (timeout=${opts.timeout}ms)`);
  
  const results = {};
  
  // 并发验证所有候选
  const validationPromises = toValidate.map(async (candidate) => {
    const key = `${candidate.ticker}:${candidate.exchange}`;
    const isValid = await validateCandidate(candidate, opts.timeout);
    results[key] = isValid;
  });
  
  // 等待所有验证完成
  await Promise.allSettled(validationPromises);
  
  // 统计结果
  const validCount = Object.values(results).filter(v => v === true).length;
  const invalidCount = Object.values(results).filter(v => v === false).length;
  const unknownCount = Object.values(results).filter(v => v === null).length;
  
  console.log(`✅ [Validator] 验证完成: ${validCount} 有效, ${invalidCount} 无效, ${unknownCount} 未知`);
  
  return results;
}

/**
 * 验证单个符号（简化接口）
 * @param {string} ticker - 股票代码
 * @param {string} exchange - 交易所
 * @returns {Promise<boolean>}
 */
async function validateSymbol(ticker, exchange) {
  return validateCandidate({ ticker, exchange });
}

module.exports = {
  quickValidate,
  validateCandidate,
  validateSymbol,
  DEFAULT_VALIDATION_OPTIONS
};
