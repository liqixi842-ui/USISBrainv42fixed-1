const { callOpenAI } = require('../aiService');

const PLACEHOLDER_PATTERNS = [
  /additional\s+factor/i,
  /\bfactor\s*[123]\b/i,
  /placeholder/i,
  /to be determined/i,
  /tbd/i,
  /\[.*?\]/
];

function isPlaceholder(text) {
  return PLACEHOLDER_PATTERNS.some(pattern => pattern.test(text));
}

function fixSentence(text) {
  if (!text) return text;
  
  let fixed = text.trim();
  
  // Fix broken sentences: ". supported" → ". Supported"
  fixed = fixed.replace(/\.\s*([a-z])/g, (match, letter) => '. ' + letter.toUpperCase());
  
  // Ensure starts with capital
  if (fixed.length > 0) {
    fixed = fixed.charAt(0).toUpperCase() + fixed.slice(1);
  }
  
  // Ensure ends with period
  if (!fixed.endsWith('.') && !fixed.endsWith('!') && !fixed.endsWith('?')) {
    fixed += '.';
  }
  
  return fixed;
}

/**
 * 🛡️ Critical Fix: 确保 Risk 段落不包含利好词汇
 * 保守策略：只替换最明显的短语，避免破坏复杂语法
 */
function removeUpsideLanguageFromRisks(text) {
  if (!text || typeof text !== 'string') return text;
  
  let cleaned = text;
  
  // 阶段 1: 移除"如果缓解会有利好"这类明显不属于 Risk 的表述
  // 使用更精确的匹配，避免删除整句导致空字符串
  if (/if.*(?:resolved|mitigated|addressed)/i.test(text) && /upside|benefit|opportunity/i.test(text)) {
    // 匹配并删除upside子句，保留其他内容
    cleaned = cleaned.replace(/,?\s*(?:but\s+|and\s+)?if.*(?:resolved|mitigated|addressed).*?(?:upside|benefit|opportunity)[^.,;]*[.,;]?\s*/gi, ' ');
  }
  
  // 阶段 2: 只替换最安全的短语（不涉及复杂语法）
  const safeReplacements = [
    { pattern: /\bupside potential\b/gi, replacement: 'potential impact' },
    { pattern: /\bpotential upside\b/gi, replacement: 'potential effect' },
    { pattern: /\bpositive impact\b/gi, replacement: 'material impact' },
    { pattern: /\bfavorable outcome\b/gi, replacement: 'alternative outcome' },
    { pattern: /\bstrong upside\b/gi, replacement: 'strong potential' },
    { pattern: /\bsignificant upside\b/gi, replacement: 'significant potential' },
  ];
  
  safeReplacements.forEach(({ pattern, replacement }) => {
    cleaned = cleaned.replace(pattern, replacement);
  });
  
  // 阶段 3: 强化清理 - 标点/空格规范化
  cleaned = cleaned.replace(/\s{2,}/g, ' ');                    // 多个空格 → 单个空格
  cleaned = cleaned.replace(/\s+([.,;:!?])/g, '$1');            // 空格+标点 → 标点
  cleaned = cleaned.replace(/([.,;])\s*\1+/g, '$1');            // 连续标点 → 单个标点
  cleaned = cleaned.replace(/,\s*\./g, '.');                    // 逗号+句号 → 句号
  cleaned = cleaned.replace(/([.,;:!?])([A-Z])/g, '$1 $2');     // 标点后加空格
  
  // 阶段 4: 清理句首的悬挂标点
  cleaned = cleaned.replace(/^[,;:\s]+/, '');                   // 删除句首逗号、分号、冒号
  cleaned = cleaned.replace(/\s+$/, '');                        // 删除句尾空格
  
  // 阶段 5: 如果清理后太短，返回空字符串（会在上层被过滤掉）
  if (cleaned.length < 20) {
    return '';
  }
  
  return cleaned.trim();
}

async function enhanceWithQuantification(item, symbol, isRisk = true) {
  if (!item || item.length < 20) return item;
  
  // Check if already quantified
  const hasNumbers = /\d+/.test(item);
  const hasTimeframe = /(month|quarter|year|H[12]|[QFY]Y\d{2})/i.test(item);
  
  if (hasNumbers && hasTimeframe) {
    return item;
  }
  
  try {
    const prompt = `You are a sell-side equity analyst. Enhance this ${isRisk ? 'risk' : 'catalyst'} item with realistic quantification.

Stock: ${symbol}
Item: "${item}"

Requirements:
1. Add realistic numbers (e.g., "2-4pt margin compression", "15-20% revenue upside")
2. Add timeframe if missing (e.g., "over next 12 months", "in FY25")
3. Keep sentence under 250 characters
4. Must sound like Goldman Sachs / Morgan Stanley
5. Return ONLY the enhanced sentence, no explanation

Enhanced item:`;

    const response = await callOpenAI([
      { role: 'system', content: 'You are a sell-side equity research analyst writing institutional-grade reports.' },
      { role: 'user', content: prompt }
    ], {
      model: 'gpt-4o-mini',
      max_tokens: 100,
      temperature: 0.3
    });
    
    const enhanced = response.trim();
    
    // Validate enhancement
    if (enhanced.length > 250 || enhanced.length < item.length * 0.8) {
      return item;
    }
    
    return fixSentence(enhanced);
    
  } catch (error) {
    console.error('[RiskCatalystEngine] Enhancement failed:', error.message);
    return item;
  }
}

async function processItems(items, symbol, isRisk = true, minItems = 6, maxItems = 8) {
  if (!items || !Array.isArray(items)) return [];
  
  console.log(`\n[RiskCatalystEngine] Processing ${items.length} ${isRisk ? 'risks' : 'catalysts'} for ${symbol}`);
  
  // Step 1: Filter out placeholders and short items
  let filtered = items.filter(item => {
    if (!item || typeof item !== 'string') return false;
    if (item.length < 30) return false;
    if (isPlaceholder(item)) return false;
    return true;
  });
  
  console.log(`  ├─ After filtering: ${filtered.length} items`);
  
  // Step 2: Fix sentences
  filtered = filtered.map(item => fixSentence(item));
  
  // Step 2.5: 🛡️ Critical Fix - 如果是 Risk，移除利好词汇
  if (isRisk) {
    filtered = filtered.map(item => removeUpsideLanguageFromRisks(item));
    console.log(`  ├─ Removed upside language from risks`);
  }
  
  // Step 3: Enhance with quantification (for top items)
  const enhanced = [];
  for (let i = 0; i < Math.min(filtered.length, maxItems); i++) {
    const item = filtered[i];
    
    // Only enhance items that need it (missing numbers or timeframe)
    const needsEnhancement = !/\d+/.test(item) || !/(month|quarter|year|H[12]|[QFY]Y)/i.test(item);
    
    if (needsEnhancement && i < 5) {
      const enhancedItem = await enhanceWithQuantification(item, symbol, isRisk);
      enhanced.push(enhancedItem);
    } else {
      enhanced.push(item);
    }
  }
  
  console.log(`  └─ Final output: ${enhanced.length} items\n`);
  
  // Ensure we have minimum items
  if (enhanced.length < minItems) {
    console.warn(`[RiskCatalystEngine] Only ${enhanced.length} ${isRisk ? 'risks' : 'catalysts'}, expected ${minItems}+`);
  }
  
  return enhanced;
}

async function processRisksAndCatalysts(report) {
  if (!report || !report.symbol) return report;
  
  console.log(`\n════════════════════════════════════════════════════════════════`);
  console.log(`[RiskCatalystEngine v2] Processing ${report.symbol}`);
  console.log(`════════════════════════════════════════════════════════════════`);
  
  // Process risks
  if (report.risks_text && Array.isArray(report.risks_text)) {
    report.risks_text = await processItems(report.risks_text, report.symbol, true, 6, 8);
  }
  
  // Process catalysts
  if (report.catalysts_text && Array.isArray(report.catalysts_text)) {
    report.catalysts_text = await processItems(report.catalysts_text, report.symbol, false, 6, 8);
  }
  
  return report;
}

module.exports = {
  processRisksAndCatalysts,
  enhanceWithQuantification,
  isPlaceholder,
  fixSentence,
  removeUpsideLanguageFromRisks
};
