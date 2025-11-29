/**
 * Text Cleaner Engine v2.0
 * 修复 AI 生成的常见问题：重复单词、口癖、冗长段落等
 * 专门针对机构研报的专业化文本清理
 */

/**
 * 去除连续重复的单词
 * 例如: "organic organic growth trajectory trajectory" → "organic growth trajectory"
 * v2.3 增强版：捕获所有长度的重复词，包括 "we we", "the the"
 */
function removeDuplicateWords(text) {
  if (!text) return text;
  
  let cleaned = text;
  
  for (let round = 0; round < 5; round++) {
    const before = cleaned;
    
    // Pattern 1: 直接重复 ANY word (including short ones like "we we", "the the")
    cleaned = cleaned.replace(/\b(\w+)\s+\1\b/gi, '$1');
    
    // Pattern 2: 多次重复 "word word word" → "word"
    cleaned = cleaned.replace(/\b(\w+)(\s+\1)+\b/gi, '$1');
    
    // Pattern 3: 跨标点重复 "word, word" → "word"
    cleaned = cleaned.replace(/\b(\w+)[,;]\s*\1\b/gi, '$1');
    
    // Pattern 4: 短语重复 "word1 word2 word1 word2" → "word1 word2"
    cleaned = cleaned.replace(/\b((\w{2,})\s+(\w{2,}))\s+\2\s+\3\b/gi, '$1');
    
    // Pattern 5: 跨换行重复
    cleaned = cleaned.replace(/\b(\w+)\s*\n\s*\1\b/gi, '$1');
    
    if (cleaned === before) break;
  }
  
  // 清理多余空格
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  
  return cleaned;
}

/**
 * 限制分析师名字引用次数
 * 解决 "John Smith argues... John Smith believes... John Smith highlights..." 过度重复问题
 * @param {string} text - 输入文本
 * @param {string} analystName - 分析师名字
 * @param {number} maxMentions - 最大引用次数（默认3次）
 */
function limitAnalystMentions(text, analystName, maxMentions = 3) {
  if (!text || !analystName) return text;
  
  const namePattern = new RegExp(`\\b${analystName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
  const matches = text.match(namePattern);
  
  if (!matches || matches.length <= maxMentions) return text;
  
  let mentionCount = 0;
  const cleaned = text.replace(namePattern, (match) => {
    mentionCount++;
    if (mentionCount <= maxMentions) {
      return match;
    }
    return 'our team';
  });
  
  return cleaned;
}

/**
 * 限制 "we believe" 等学术性短语
 * 每篇报告最多出现2次，其余替换为更简洁的表达
 */
function limitAcademicPhrases(text) {
  if (!text) return text;
  
  let cleaned = text;
  
  // "We believe" family - limit to 2 occurrences
  const believePatterns = [
    { pattern: /\bWe believe (that )?/gi, replacement: '' },
    { pattern: /\bWe think (that )?/gi, replacement: '' },
    { pattern: /\bWe expect (that )?/gi, replacement: 'We expect ' },
    { pattern: /\bWe anticipate (that )?/gi, replacement: '' },
    { pattern: /\bWe view /gi, replacement: '' },
    { pattern: /\bWe see /gi, replacement: '' },
  ];
  
  // Count total "we believe" type phrases
  let believeCount = 0;
  believePatterns.forEach(({ pattern }) => {
    const matches = cleaned.match(pattern);
    if (matches) believeCount += matches.length;
  });
  
  // If more than 2, remove most of them
  if (believeCount > 2) {
    let kept = 0;
    believePatterns.forEach(({ pattern, replacement }) => {
      cleaned = cleaned.replace(pattern, (match) => {
        kept++;
        if (kept <= 2) return match;
        return replacement;
      });
    });
  }
  
  // Remove verbose connecting phrases
  const verbosePatterns = [
    /\bIn addition to (this|that),?\s*/gi,
    /\bFurthermore,?\s*/gi,
    /\bMoreover,?\s*/gi,
    /\bAdditionally,?\s*/gi,
    /\bConsequently,?\s*/gi,
    /\bAccordingly,?\s*/gi,
    /\bThus,?\s*/gi,
    /\bHence,?\s*/gi,
    /\bTherefore,?\s*/gi,
    /\bAs such,?\s*/gi,
    /\bGoing forward,?\s*/gi,
    /\bLooking ahead,?\s*/gi,
    /\bIn the coming (quarters?|years?),?\s*/gi,
    /\bOver the (medium|long)[- ]term,?\s*/gi,
    /\bOn a go-forward basis,?\s*/gi,
  ];
  
  verbosePatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });
  
  // Capitalize first letter after removal if needed
  cleaned = cleaned.replace(/\.\s+([a-z])/g, (match, letter) => '. ' + letter.toUpperCase());
  
  return cleaned;
}

/**
 * 去除常见 AI 口癖短语
 * v2.0 增强版：包含更多叙事转折词和不专业表达
 */
function removeAICliches(text) {
  if (!text) return text;
  
  let cleaned = text;
  
  // 阶段 1: 删除引导性口癖（直接删除，不影响后续内容）
  const leadInCliches = [
    /It'?s worth noting that /gi,
    /It'?s important to note that /gi,
    /It should be noted that /gi,
    /Notably,?\s*/gi,
    /Importantly,?\s*/gi,
    /Interestingly,?\s*/gi,
    /Remarkably,?\s*/gi,
    /With this in mind,?\s*/gi,
    /Considering these factors,?\s*/gi,
    /Given this backdrop,?\s*/gi,
    /In this context,?\s*/gi,
    /Against this backdrop,?\s*/gi,
    /Looking ahead,?\s*/gi,
    /Moving forward,?\s*/gi,
    /That being said,?\s*/gi,
    /Having said that,?\s*/gi,
    /It goes without saying that /gi,
    /Needless to say,?\s*/gi,
    /As we can see,?\s*/gi,
    /As mentioned (earlier|above|previously),?\s*/gi,
    /To put it simply,?\s*/gi,
    /In essence,?\s*/gi,
    /At the end of the day,?\s*/gi,
    /When all is said and done,?\s*/gi,
  ];
  
  leadInCliches.forEach(cliche => {
    cleaned = cleaned.replace(cliche, '');
  });
  
  // 阶段 2: 替换不专业形容词（保留完整上下文）
  const adjectiveReplacements = [
    { pattern: /\b(E|e)xciting\b/g, replacement: 'notable' },
    { pattern: /\b(A|a)mazing\b/g, replacement: 'strong' },
    { pattern: /\b(I|i)ncredible\b/g, replacement: 'substantial' },
    { pattern: /\b(F|f)antastic\b/g, replacement: 'solid' },
    { pattern: /\b(T|t)remendous\b/g, replacement: 'significant' },
    { pattern: /\b(G|g)ame[- ]?changing\b/g, replacement: 'transformative' },
    { pattern: /\b(R|r)evolutionary\b/g, replacement: 'innovative' },
    { pattern: /\b(U|u)nprecedented\b/g, replacement: 'notable' },
    { pattern: /\b(M|m)assive\b/g, replacement: 'substantial' },
    { pattern: /\b(H|h)uge\b/g, replacement: 'significant' },
    { pattern: /\b(A|a)wesome\b/g, replacement: 'favorable' },
    { pattern: /\b(W|w)onderful\b/g, replacement: 'positive' },
  ];
  
  adjectiveReplacements.forEach(({ pattern, replacement }) => {
    cleaned = cleaned.replace(pattern, (match) => {
      return match[0] === match[0].toUpperCase() 
        ? replacement.charAt(0).toUpperCase() + replacement.slice(1)
        : replacement;
    });
  });
  
  // 阶段 3: 删除夸张的量化表达
  const exaggeratedPatterns = [
    /\b(potentially|possibly)\s+add(ing|s)?\s+\$?\d+[\.\d]*\s*[BMT]?\s*(in\s+)?(revenue|value|market\s+cap)/gi,
    /\b(could|may|might)\s+increase\s+\$?\d+[\.\d]*[-–]\d+[\.\d]*%?\s*(in\s+)?(revenue|value)/gi,
    /\bupwards\s+of\s+\$\d+[\.\d]*\s*[BMT]/gi,
  ];
  
  exaggeratedPatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
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
 * 控制段落长度 - 确保符合投行报告风格
 * 每段不超过5-6行（约150-200词）
 */
function controlParagraphLength(text, maxWordsPerParagraph = 180) {
  if (!text) return text;
  
  const paragraphs = text.split(/\n\n+/);
  const processedParagraphs = [];
  
  for (const para of paragraphs) {
    const words = para.split(/\s+/);
    
    if (words.length <= maxWordsPerParagraph) {
      processedParagraphs.push(para);
    } else {
      // 按句子分割过长段落
      const sentences = para.match(/[^.!?]+[.!?]+/g) || [para];
      let currentChunk = [];
      let currentWordCount = 0;
      
      for (const sentence of sentences) {
        const sentenceWords = sentence.trim().split(/\s+/).length;
        
        if (currentWordCount + sentenceWords > maxWordsPerParagraph && currentChunk.length > 0) {
          processedParagraphs.push(currentChunk.join(' '));
          currentChunk = [sentence.trim()];
          currentWordCount = sentenceWords;
        } else {
          currentChunk.push(sentence.trim());
          currentWordCount += sentenceWords;
        }
      }
      
      if (currentChunk.length > 0) {
        processedParagraphs.push(currentChunk.join(' '));
      }
    }
  }
  
  return processedParagraphs.join('\n\n');
}

/**
 * 检测并去除重复段落（完全或高度相似）
 * 解决 Valuation Framework 等内容被复制粘贴两次的问题
 */
function deduplicateParagraphs(text, similarityThreshold = 0.85) {
  if (!text) return text;
  
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 50);
  const uniqueParagraphs = [];
  const seenSignatures = new Set();
  
  for (const para of paragraphs) {
    // 创建段落签名：取前50个字符 + 词数
    const normalized = para.toLowerCase().replace(/\s+/g, ' ').trim();
    const signature = normalized.substring(0, 80) + '_' + normalized.length;
    
    // 检查是否已存在高度相似的段落
    let isDuplicate = false;
    
    // 完全匹配检查
    if (seenSignatures.has(signature)) {
      isDuplicate = true;
    } else {
      // 部分匹配检查：如果前80个字符相同，视为重复
      for (const seen of seenSignatures) {
        const seenPrefix = seen.split('_')[0];
        const currentPrefix = signature.split('_')[0];
        if (seenPrefix === currentPrefix && seenPrefix.length > 60) {
          isDuplicate = true;
          break;
        }
      }
    }
    
    if (!isDuplicate) {
      uniqueParagraphs.push(para);
      seenSignatures.add(signature);
    }
  }
  
  return uniqueParagraphs.join('\n\n');
}

/**
 * 精简过度的分析师引用
 * 避免过多 "John Smith argues that..." 的叙事风格
 */
function reduceAnalystMentions(text, maxMentions = 4) {
  if (!text) return text;
  
  // 匹配分析师名字引用模式（假设分析师名是大写开头的两个词）
  const analystPattern = /(?:In\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)'?s?\s+(view|opinion|analysis|assessment|perspective|argues?|notes?|observes?|believes?|highlights?|emphasizes?|points?\s+out)/gi;
  
  let count = 0;
  const cleaned = text.replace(analystPattern, (match, name, verb) => {
    count++;
    if (count <= maxMentions) {
      return match; // 保留前几次
    }
    // 替换为更简洁的表达
    const simplifiedVerbs = {
      'view': 'Our view',
      'opinion': 'We believe',
      'analysis': 'Our analysis',
      'argues': 'We argue',
      'notes': 'We note',
      'observes': 'We observe',
      'believes': 'We believe',
      'highlights': 'We highlight',
      'emphasizes': 'We emphasize',
      'points out': 'We note'
    };
    const verbLower = verb.toLowerCase().replace(/s$/, '');
    return simplifiedVerbs[verbLower] || 'We note';
  });
  
  return cleaned;
}

/**
 * 主清理函数：组合所有清理步骤
 * v2.0 增强版：包含段落控制和去重
 */
function cleanText(text, options = {}) {
  if (!text || typeof text !== 'string') return text;
  
  const {
    deduplicateParagraphsEnabled = true,
    controlParagraphLengthEnabled = true,
    reduceAnalystMentionsEnabled = true,
    maxWordsPerParagraph = 180,
    maxAnalystMentions = 4
  } = options;
  
  let cleaned = text;
  
  // 步骤1：去除重复单词
  cleaned = removeDuplicateWords(cleaned);
  
  // 步骤2：去除AI口癖
  cleaned = removeAICliches(cleaned);
  
  // 步骤3：去重段落（解决内容复制粘贴问题）
  if (deduplicateParagraphsEnabled) {
    cleaned = deduplicateParagraphs(cleaned);
  }
  
  // 步骤4：控制段落长度
  if (controlParagraphLengthEnabled) {
    cleaned = controlParagraphLength(cleaned, maxWordsPerParagraph);
  }
  
  // 步骤5：精简分析师引用
  if (reduceAnalystMentionsEnabled) {
    cleaned = reduceAnalystMentions(cleaned, maxAnalystMentions);
  }
  
  // 步骤6：限制学术性短语（we believe等）
  cleaned = limitAcademicPhrases(cleaned);
  
  // 步骤7：修复格式问题
  cleaned = fixFormatting(cleaned);
  
  return cleaned;
}

/**
 * 轻量版清理：仅处理重复和格式
 * 用于不需要段落控制的场景
 * 🔧 v7.5: Now includes limitAcademicPhrases for consistent enforcement
 */
function cleanTextLight(text) {
  if (!text || typeof text !== 'string') return text;
  
  let cleaned = text;
  cleaned = removeDuplicateWords(cleaned);
  cleaned = removeAICliches(cleaned);
  cleaned = limitAcademicPhrases(cleaned); // 🔧 v7.5: Enforce across all paths
  cleaned = fixFormatting(cleaned);
  
  return cleaned;
}

module.exports = {
  cleanText,
  cleanTextLight,
  removeDuplicateWords,
  removeAICliches,
  fixFormatting,
  controlParagraphLength,
  deduplicateParagraphs,
  reduceAnalystMentions,
  limitAnalystMentions,
  limitAcademicPhrases
};
