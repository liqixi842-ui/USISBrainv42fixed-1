/**
 * Text Cleaner Engine v1.0
 * 修复 AI 生成的常见问题：重复单词、口癖等
 */

/**
 * 去除连续重复的单词
 * 例如: "organic organic growth" → "organic growth"
 */
function removeDuplicateWords(text) {
  if (!text) return text;
  
  // 正则：匹配连续重复的单词（忽略大小写）
  // \b(\w+)\s+\1\b 会匹配 "word word" 这样的模式
  const pattern = /\b(\w+)\s+\1\b/gi;
  
  let cleaned = text;
  let iterations = 0;
  const maxIterations = 5; // 防止无限循环
  
  // 多次清理直到没有重复为止（处理 "word word word" 的情况）
  while (pattern.test(cleaned) && iterations < maxIterations) {
    cleaned = cleaned.replace(pattern, '$1');
    iterations++;
  }
  
  return cleaned;
}

/**
 * 去除常见 AI 口癖短语
 * 修复版：保留完整短语，只替换形容词
 */
function removeAICliches(text) {
  if (!text) return text;
  
  let cleaned = text;
  
  // 阶段 1: 删除引导性口癖（直接删除，不影响后续内容）
  const leadInCliches = [
    /It'?s worth noting that /gi,
    /It'?s important to note that /gi,
    /It should be noted that /gi,
    /Notably, /gi,
    /Importantly, /gi,
    /Interestingly, /gi,
    /Remarkably, /gi,
  ];
  
  leadInCliches.forEach(cliche => {
    cleaned = cleaned.replace(cliche, '');
  });
  
  // 阶段 2: 替换形容词短语（保留完整上下文）
  const adjectiveReplacements = [
    { pattern: /\b(E|e)xciting\b/g, replacement: 'compelling' },
    { pattern: /\b(A|a)mazing\b/g, replacement: 'strong' },
    { pattern: /\b(I|i)ncredible\b/g, replacement: 'exceptional' },
    { pattern: /\b(F|f)antastic\b/g, replacement: 'solid' },
    { pattern: /\b(T|t)remendous\b/g, replacement: 'significant' },
  ];
  
  adjectiveReplacements.forEach(({ pattern, replacement }) => {
    cleaned = cleaned.replace(pattern, (match) => {
      // 保留原始大小写：如果第一个字母大写，替换词也大写
      return match[0] === match[0].toUpperCase() 
        ? replacement.charAt(0).toUpperCase() + replacement.slice(1)
        : replacement;
    });
  });
  
  // 清理多余空格
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  
  return cleaned.trim();
}

/**
 * 修复格式问题
 */
function fixFormatting(text) {
  if (!text) return text;
  
  let fixed = text;
  
  // 修复多个连续句号
  fixed = fixed.replace(/\.{2,}/g, '.');
  
  // 修复多个连续逗号
  fixed = fixed.replace(/,{2,}/g, ',');
  
  // 修复空格+标点
  fixed = fixed.replace(/\s+([.,;:!?])/g, '$1');
  
  // 修复标点+缺少空格
  fixed = fixed.replace(/([.,;:!?])([A-Z])/g, '$1 $2');
  
  // 修复多个空格
  fixed = fixed.replace(/\s{2,}/g, ' ');
  
  return fixed.trim();
}

/**
 * 主清理函数：组合所有清理步骤
 */
function cleanText(text) {
  if (!text || typeof text !== 'string') return text;
  
  let cleaned = text;
  
  // 步骤1：去除重复单词
  cleaned = removeDuplicateWords(cleaned);
  
  // 步骤2：去除AI口癖
  cleaned = removeAICliches(cleaned);
  
  // 步骤3：修复格式问题
  cleaned = fixFormatting(cleaned);
  
  return cleaned;
}

module.exports = {
  cleanText,
  removeDuplicateWords,
  removeAICliches,
  fixFormatting
};
