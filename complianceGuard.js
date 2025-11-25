// ====== Compliance Guard ======
// 验证AI输出的数字是否存在于数据payload中
// 这是防止AI编造数据的最后一道防线

/**
 * 验证AI响应中的数字是否来自真实数据
 * @param {string} aiResponse - AI生成的响应文本
 * @param {Object} marketData - 原始市场数据
 * @returns {Object} - {valid: boolean, violations: Array<string>, confidence: number}
 */
function validateResponse(aiResponse, marketData) {
  console.log(`\n🛡️  [Compliance Guard] 开始验证AI响应`);
  
  const violations = [];
  const warnings = [];
  
  // 1. 提取AI响应中的数字
  const numbersInResponse = extractNumbers(aiResponse);
  console.log(`   📊 响应中的数字: ${numbersInResponse.length}个`);
  
  // 2. 提取数据中的合法数字
  const validNumbers = extractValidNumbers(marketData);
  console.log(`   ✅ 数据中的合法数字: ${validNumbers.size}个`);
  
  // 3. 验证每个数字
  numbersInResponse.forEach(({ value, context }) => {
    const normalized = normalizeNumber(value);
    
    // 检查是否存在于合法数字集合中（允许一定误差）
    const isValid = isNumberValid(normalized, validNumbers);
    
    if (!isValid) {
      // 检查是否是常见的非股市数字（如时间、日期等）
      if (isCommonNonMarketNumber(value, context)) {
        // 不是违规，但记录警告
        warnings.push(`数字${value}可能不是市场数据（上下文: "${context}"）`);
      } else {
        // 可能是编造的市场数据
        violations.push(`可疑数字: ${value} (上下文: "${context}") - 未在提供的数据中找到`);
      }
    }
  });
  
  // 4. 计算置信度
  const totalNumbers = numbersInResponse.length;
  const validCount = totalNumbers - violations.length;
  const confidence = totalNumbers > 0 ? validCount / totalNumbers : 1.0;
  
  // 5. 输出验证结果
  if (violations.length > 0) {
    console.log(`   ⚠️  发现${violations.length}个可疑数字:`);
    violations.forEach(v => console.log(`      - ${v}`));
  }
  
  if (warnings.length > 0) {
    console.log(`   ℹ️  ${warnings.length}个警告:`);
    warnings.forEach(w => console.log(`      - ${w}`));
  }
  
  const isValid = violations.length === 0;
  
  console.log(`${isValid ? '✅' : '❌'} [Compliance Guard] 验证${isValid ? '通过' : '失败'} (置信度: ${(confidence * 100).toFixed(0)}%)`);
  
  return {
    valid: isValid,
    violations,
    warnings,
    confidence,
    stats: {
      totalNumbers: totalNumbers,
      validNumbers: validCount,
      suspiciousNumbers: violations.length
    }
  };
}

/**
 * 从文本中提取数字及其上下文
 */
function extractNumbers(text) {
  const numbers = [];
  
  // 正则：匹配各种数字格式
  // 例如: 1234, 1,234, 1234.56, $1234, +5.67%, -3.21%
  const patterns = [
    // 价格：$1234.56 或 1234.56
    /\$?\d{1,3}(?:,\d{3})*(?:\.\d{1,4})?/g,
    // 百分比：+5.67% 或 -3.21%
    /[+-]?\d+(?:\.\d{1,2})?%/g,
    // 普通数字：1234
    /\b\d{1,10}\b/g
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const value = match[0];
      const index = match.index;
      
      // 提取上下文（前后20个字符）
      const start = Math.max(0, index - 20);
      const end = Math.min(text.length, index + value.length + 20);
      const context = text.substring(start, end).replace(/\n/g, ' ').trim();
      
      numbers.push({ value, context, index });
    }
  });
  
  // 去重（按value和index）
  const unique = [];
  const seen = new Set();
  
  numbers.forEach(n => {
    const key = `${n.value}_${n.index}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(n);
    }
  });
  
  return unique;
}

/**
 * 从marketData中提取所有合法数字
 */
function extractValidNumbers(marketData) {
  const validNumbers = new Set();
  
  // 1. 从报价数据中提取
  if (marketData.quotes) {
    Object.values(marketData.quotes).forEach(quote => {
      if (!quote) return;
      
      // 价格相关
      addNumber(validNumbers, quote.currentPrice);
      addNumber(validNumbers, quote.change);
      addNumber(validNumbers, quote.changePercent);
      addNumber(validNumbers, quote.high);
      addNumber(validNumbers, quote.low);
      addNumber(validNumbers, quote.open);
      addNumber(validNumbers, quote.previousClose);
      
      // 时间相关（分钟数）
      addNumber(validNumbers, quote.dataAgeMinutes);
      
      // 百分比相关
      addNumber(validNumbers, quote.freshnessScore * 100);  // 转换为百分比
    });
  }
  
  // 2. 从元数据中提取
  if (marketData.metadata && marketData.metadata.dataQuality) {
    const quality = marketData.metadata.dataQuality;
    addNumber(validNumbers, quality.overallScore * 100);
    addNumber(validNumbers, quality.freshnessAvg * 100);
    addNumber(validNumbers, quality.reliableSources);
  }
  
  return validNumbers;
}

/**
 * 添加数字到合法集合（包括其舍入变体）
 */
function addNumber(set, num) {
  if (num === null || num === undefined || isNaN(num)) return;
  
  // 添加原始值
  set.add(num);
  
  // 添加舍入变体（因为AI可能会舍入数字）
  set.add(Math.round(num));
  set.add(Math.round(num * 10) / 10);  // 1位小数
  set.add(Math.round(num * 100) / 100);  // 2位小数
  set.add(Math.round(num * 1000) / 1000);  // 3位小数
  
  // 添加绝对值（因为AI可能省略符号）
  set.add(Math.abs(num));
  set.add(Math.abs(Math.round(num * 100) / 100));
}

/**
 * 规范化数字（移除格式化符号）
 */
function normalizeNumber(numStr) {
  // 移除 $, +, %, 逗号等
  let cleaned = numStr.replace(/[\$,+%]/g, '');
  
  // 处理负号
  cleaned = cleaned.replace(/−/g, '-');  // 替换全角负号
  
  return parseFloat(cleaned);
}

/**
 * 检查数字是否在合法集合中（允许一定误差）
 */
function isNumberValid(num, validNumbers) {
  if (isNaN(num)) return false;
  
  // 直接匹配
  if (validNumbers.has(num)) return true;
  
  // 允许±1%的误差（处理浮点数精度问题）
  const tolerance = 0.01;
  
  for (const validNum of validNumbers) {
    if (Math.abs(num - validNum) / Math.max(Math.abs(validNum), 1) < tolerance) {
      return true;
    }
  }
  
  return false;
}

/**
 * 检查是否是常见的非市场数字
 * @param {string} value - 数字字符串
 * @param {string} context - 上下文
 */
function isCommonNonMarketNumber(value, context) {
  const num = parseFloat(value.replace(/[^\d.-]/g, ''));
  
  // 时间相关（如"9点"、"16点"）
  if (num >= 0 && num <= 24 && /点|时|hour|am|pm/i.test(context)) {
    return true;
  }
  
  // 日期相关（如"2025年"、"11月5日"）
  if ((num >= 2020 && num <= 2030) || (num >= 1 && num <= 31)) {
    if (/年|月|日|year|month|day/i.test(context)) {
      return true;
    }
  }
  
  // 数量相关（如"3个模型"、"5条新闻"）
  if (num >= 1 && num <= 20 && /个|条|只|笔|models|news|items/i.test(context)) {
    return true;
  }
  
  // 分钟、秒（如"60分钟"、"120秒"）
  if (/分钟|秒|minutes|seconds|mins|secs/i.test(context)) {
    return true;
  }
  
  return false;
}

/**
 * 重新生成响应（当验证失败时）
 * @param {Object} validationResult - 验证结果
 * @param {Object} marketData - 市场数据
 * @returns {string} - 修正建议
 */
function generateCorrectionSuggestion(validationResult, marketData) {
  if (validationResult.valid) return null;
  
  let suggestion = `⚠️ 检测到响应中包含可疑数字，这些数字未在提供的数据中找到：\n\n`;
  
  validationResult.violations.forEach((v, i) => {
    suggestion += `${i + 1}. ${v}\n`;
  });
  
  suggestion += `\n请重新生成响应，确保所有数字都来自提供的数据。\n`;
  suggestion += `\n可用的数据摘要：\n${marketData.summary || '无'}`;
  
  return suggestion;
}

module.exports = {
  validateResponse,
  generateCorrectionSuggestion
};
