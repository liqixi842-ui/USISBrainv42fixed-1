// ====== Response Formatter - 输出模板系统 ======
// 根据responseMode生成不同格式的输出
// 支持：NEWS_ONLY, ANALYSIS_ONLY, ADVICE_ONLY, FULL_REPORT

/**
 * 格式化响应输出
 * @param {string} mode - 输出模式 ('news' | 'analysis' | 'advice' | 'full_report')
 * @param {Object} data - 数据对象
 * @param {Array} data.news - 新闻列表
 * @param {Object} data.analysis - 分析内容
 * @param {Object} data.advice - 建议内容
 * @param {Object} data.symbols - 符号信息
 * @param {string} data.lang - 语言（zh/en/es）
 * @returns {string} - 格式化后的文本
 */
function formatResponse(mode, data) {
  const { news = [], analysis = {}, advice = {}, symbols = [], lang = 'zh' } = data;
  
  console.log(`\n📝 [Response Formatter] 格式化输出`);
  console.log(`   - 模式: ${mode}`);
  console.log(`   - 语言: ${lang}`);
  console.log(`   - 新闻数: ${news.length}`);
  
  switch (mode) {
    case 'news':
    case 'NEWS_ONLY':
      return formatNewsOnly(news, symbols, lang);
    
    case 'analysis':
    case 'ANALYSIS_ONLY':
      return formatAnalysisOnly(analysis, symbols, lang);
    
    case 'advice':
    case 'ADVICE_ONLY':
      return formatAdviceOnly(advice, symbols, lang);
    
    case 'full_report':
    case 'FULL_REPORT':
      return formatFullReport(news, analysis, advice, symbols, lang);
    
    default:
      return formatFullReport(news, analysis, advice, symbols, lang);
  }
}

/**
 * 格式化纯新闻输出
 */
function formatNewsOnly(news, symbols, lang) {
  if (!news || news.length === 0) {
    return lang === 'zh' ? '⚠️ 暂无相关新闻' : 'ℹ️ No recent news available';
  }
  
  const header = lang === 'zh' ? '📰 市场资讯' : '📰 Market News';
  const lines = [header, ''];
  
  news.forEach((item, index) => {
    const emoji = getImpactEmoji(item.impact_score);
    const timeStr = formatTimeAgo(item.time, lang);
    
    // 标题行
    lines.push(`${emoji} ${item.title}`);
    
    // 详情行（来源 + 时间 + 影响）
    const source = `📌 ${item.source}`;
    const time = `⏰ ${timeStr}`;
    const reason = `💡 ${item.reason}`;
    lines.push(`   ${source} | ${time}`);
    lines.push(`   ${reason}`);
    
    // 相关股票
    if (item.tickers && item.tickers.length > 0) {
      const tickersStr = item.tickers.slice(0, 3).join(', ');
      lines.push(`   🏷️ ${tickersStr}`);
    }
    
    lines.push(''); // 空行分隔
  });
  
  return lines.join('\n');
}

/**
 * 格式化纯分析输出
 */
function formatAnalysisOnly(analysis, symbols, lang) {
  if (!analysis || !analysis.summary) {
    return lang === 'zh' ? '⚠️ 暂无分析内容' : 'ℹ️ No analysis available';
  }
  
  const header = lang === 'zh' ? '📊 市场分析' : '📊 Market Analysis';
  const lines = [header, ''];
  
  // 1. 总体概况
  if (analysis.summary) {
    lines.push('🔍 市场概况');
    lines.push(analysis.summary);
    lines.push('');
  }
  
  // 2. 场景推演
  if (analysis.scenarios && analysis.scenarios.length > 0) {
    lines.push('🎯 场景推演');
    analysis.scenarios.forEach(scenario => {
      const prob = (scenario.prob * 100).toFixed(0);
      lines.push(`\n📌 ${scenario.case} (概率: ${prob}%)`);
      lines.push(`   ${scenario.implication}`);
    });
    lines.push('');
  }
  
  // 3. 技术分析（如果有）
  if (analysis.technical) {
    lines.push('📈 技术要点');
    lines.push(analysis.technical);
    lines.push('');
  }
  
  // 4. 基本面分析（如果有）
  if (analysis.fundamental) {
    lines.push('📋 基本面');
    lines.push(analysis.fundamental);
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * 格式化纯建议输出
 */
function formatAdviceOnly(advice, symbols, lang) {
  if (!advice || Object.keys(advice).length === 0) {
    return lang === 'zh' ? '⚠️ 暂无操作建议' : 'ℹ️ No advice available';
  }
  
  const header = lang === 'zh' ? '💡 操作建议' : '💡 Trading Advice';
  const lines = [header, ''];
  
  // 1. 仓位建议
  if (advice.positioning) {
    lines.push('🎯 仓位管理');
    lines.push(`   ${advice.positioning}`);
    lines.push('');
  }
  
  // 2. 风险控制
  if (advice.risk_controls && advice.risk_controls.length > 0) {
    lines.push('⚠️ 风险控制');
    advice.risk_controls.forEach(control => {
      lines.push(`   • ${control}`);
    });
    lines.push('');
  }
  
  // 3. 观察清单
  if (advice.watchlist && advice.watchlist.length > 0) {
    lines.push('👀 重点观察');
    advice.watchlist.forEach(item => {
      lines.push(`   • ${item}`);
    });
    lines.push('');
  }
  
  // 4. 触发条件
  if (advice.triggers && advice.triggers.length > 0) {
    lines.push('🔔 触发条件');
    advice.triggers.forEach(trigger => {
      lines.push(`   • ${trigger}`);
    });
    lines.push('');
  }
  
  // 免责声明
  const disclaimer = lang === 'zh' 
    ? '⚠️ 以上建议仅供参考，不构成投资建议。投资有风险，决策需谨慎。'
    : '⚠️ This advice is for reference only and does not constitute investment advice. Investment involves risks.';
  lines.push(disclaimer);
  
  return lines.join('\n');
}

/**
 * 格式化完整报告
 */
function formatFullReport(news, analysis, advice, symbols, lang) {
  const sections = [];
  
  // 标题
  const title = lang === 'zh' ? '📊 USIS 智能市场分析报告' : '📊 USIS Market Intelligence Report';
  sections.push(title);
  sections.push('━'.repeat(40));
  sections.push('');
  
  // 1. 新闻资讯
  if (news && news.length > 0) {
    sections.push(formatNewsOnly(news, symbols, lang));
    sections.push('━'.repeat(40));
    sections.push('');
  }
  
  // 2. 市场分析
  if (analysis && analysis.summary) {
    sections.push(formatAnalysisOnly(analysis, symbols, lang));
    sections.push('━'.repeat(40));
    sections.push('');
  }
  
  // 3. 操作建议
  if (advice && Object.keys(advice).length > 0) {
    sections.push(formatAdviceOnly(advice, symbols, lang));
    sections.push('━'.repeat(40));
  }
  
  return sections.join('\n');
}

/**
 * 根据impact_score返回emoji
 */
function getImpactEmoji(score) {
  if (score >= 0.8) return '🔴';  // 高影响
  if (score >= 0.5) return '🟠';  // 中等影响
  return '🟢';  // 低影响
}

/**
 * 格式化时间（相对时间）
 */
function formatTimeAgo(isoTime, lang) {
  const now = Date.now();
  const time = new Date(isoTime).getTime();
  const diffMinutes = Math.floor((now - time) / 60000);
  
  if (lang === 'zh') {
    if (diffMinutes < 1) return '刚刚';
    if (diffMinutes < 60) return `${diffMinutes}分钟前`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}小时前`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}天前`;
  } else {
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }
}

/**
 * 验证输出合规性（确保AI遵守mode限制）
 * @param {string} mode - 输出模式
 * @param {string} text - AI生成的文本
 * @returns {Object} - {compliant: boolean, violations: Array}
 */
function validateOutputCompliance(mode, text) {
  const violations = [];
  const lowerText = text.toLowerCase();
  
  if (mode === 'news' || mode === 'NEWS_ONLY') {
    // 纯新闻模式不应包含"建议"、"推荐"等词
    const forbiddenPatterns = ['建议', 'recommend', 'suggest', 'advice', '仓位', 'position'];
    forbiddenPatterns.forEach(pattern => {
      if (lowerText.includes(pattern)) {
        violations.push(`NEWS_ONLY模式不应包含"${pattern}"`);
      }
    });
  }
  
  if (mode === 'analysis' || mode === 'ANALYSIS_ONLY') {
    // 纯分析模式不应包含具体操作建议
    const forbiddenPatterns = ['买入', 'sell', 'buy', '止损', 'stop loss', '建仓'];
    forbiddenPatterns.forEach(pattern => {
      if (lowerText.includes(pattern)) {
        violations.push(`ANALYSIS_ONLY模式不应包含"${pattern}"`);
      }
    });
  }
  
  if (mode === 'advice' || mode === 'ADVICE_ONLY') {
    // 纯建议模式应该简洁，不需要冗长分析
    const wordCount = text.split(/\s+/).length;
    if (wordCount > 300) {
      violations.push(`ADVICE_ONLY模式文本过长 (${wordCount}词)，应保持简洁`);
    }
  }
  
  return {
    compliant: violations.length === 0,
    violations
  };
}

/**
 * 提取AI生成内容的关键部分（用于模板填充）
 * @param {string} aiText - AI生成的完整文本
 * @param {string} mode - 输出模式
 * @returns {Object} - 提取的结构化数据
 */
function extractStructuredContent(aiText, mode) {
  // 简单的启发式提取（未来可用LLM优化）
  const lines = aiText.split('\n').filter(line => line.trim());
  
  const extracted = {
    summary: '',
    scenarios: [],
    technical: '',
    fundamental: '',
    positioning: '',
    risk_controls: [],
    watchlist: [],
    triggers: []
  };
  
  // 提取第一段作为摘要
  const firstParagraph = lines.slice(0, 3).join(' ');
  extracted.summary = firstParagraph;
  
  // 提取场景（基于关键词）
  lines.forEach(line => {
    if (line.includes('场景') || line.includes('scenario')) {
      const match = line.match(/(\d+)%/);
      if (match) {
        extracted.scenarios.push({
          case: line.split(':')[0] || '基准',
          prob: parseInt(match[1]) / 100,
          implication: line
        });
      }
    }
  });
  
  return extracted;
}

/**
 * ====== v2.0 升级: Markdown转中文符号格式化 ======
 * 功能：消除Markdown噪音，提升中文可读性
 */

/**
 * 核心Markdown格式化函数
 * 将Markdown格式转换为简洁的中文符号格式
 * @param {string} text - Markdown格式文本
 * @param {Object} options - 格式化选项
 * @returns {string} - 中文符号格式文本
 */
function formatMarkdownToChinese(text, options = {}) {
  if (!text) return '';
  
  let formatted = text;
  
  // 1. 转换标题: ### 标题 → 【标题】
  formatted = formatted.replace(/^###\s+(.+)$/gm, '【$1】');
  formatted = formatted.replace(/^##\s+(.+)$/gm, '【$1】');
  formatted = formatted.replace(/^#\s+(.+)$/gm, '【$1】');
  
  // 2. 去除标题中的加粗符号
  formatted = formatted.replace(/【\*\*(.+?)\*\*】/g, '【$1】');
  
  // 3. 转换列表: - 项目 → • 项目（保留缩进）
  formatted = formatted.replace(/^([\s]*)[-*]\s+/gm, '$1• ');
  
  // 4. 去除加粗和斜体符号
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '$1');  // **text**
  formatted = formatted.replace(/(?<!\*)\*(?!\*)(.+?)\*(?!\*)/g, '$1');  // *text*
  formatted = formatted.replace(/__(.+?)__/g, '$1');  // __text__
  formatted = formatted.replace(/_(.+?)_/g, '$1');  // _text_
  
  // 5. 简化分割线
  formatted = formatted.replace(/^[-*_]{3,}$/gm, '');
  
  // 6. 移除表格符号
  formatted = formatted.replace(/^\|.*\|$/gm, '');
  formatted = formatted.replace(/^\|[-:\s|]+\|$/gm, '');
  
  // 7. 清理空行（最多保留一个）
  formatted = formatted.replace(/[ \t]+$/gm, '');
  formatted = formatted.replace(/\n{3,}/g, '\n\n');
  formatted = formatted.trim();
  
  // 8. 智能添加emoji（可选）
  if (options.addEmoji !== false) {
    formatted = addSmartEmojis(formatted);
  }
  
  return formatted;
}

/**
 * 智能添加emoji到标题
 */
function addSmartEmojis(text) {
  const emojiMap = {
    '趋势': '📈',
    '风险': '⚠️',
    '支撑': '🛡️',
    '压力': '🔝',
    '买入': '✅',
    '卖出': '⛔',
    '持有': '💎',
    '建议': '💡',
    '数据': '📊',
    '新闻': '📰',
    '技术': '🔧',
    '基本面': '📈',
    '交易': '💰',
    '关键': '🎯',
    '价格': '💲',
    '成交量': '📊',
    '形态': '📉',
    '指标': '📐',
    '操作': '⚡'
  };
  
  for (const [keyword, emoji] of Object.entries(emojiMap)) {
    const regex = new RegExp(`【([^】]*${keyword}[^】]*)】`, 'g');
    text = text.replace(regex, (match, content) => {
      // 避免重复添加emoji
      if (content.trim().match(/^[\p{Emoji}]/u)) {
        return match;
      }
      return `【${emoji} ${content}】`;
    });
  }
  
  return text;
}

/**
 * 格式化持仓信息（特殊格式）
 * 用于持仓建议场景
 */
function formatPositionInfo(buyPrice, currentPrice, symbol = '') {
  if (!buyPrice || !currentPrice || currentPrice === 'N/A') return '';
  
  const profitLoss = currentPrice - buyPrice;
  const profitPercent = ((profitLoss / buyPrice) * 100).toFixed(2);
  const sign = profitLoss >= 0 ? '+' : '';
  const symbolText = symbol ? `${symbol} ` : '';
  
  return `
⚠️ ${symbolText}持仓信息
• 买入成本: $${buyPrice}
• 当前价格: $${currentPrice}
• 当前盈亏: ${sign}$${Math.abs(profitLoss).toFixed(2)} (${sign}${profitPercent}%)
`;
}

/**
 * 格式化技术分析（Vision AI专用）
 * 将Markdown转换为中文符号格式，并添加持仓信息
 */
function formatTechnicalAnalysis(rawAnalysis, options = {}) {
  const { positionContext = null, symbol = '' } = options;
  
  // 1. 先转换Markdown格式
  let formatted = formatMarkdownToChinese(rawAnalysis, { addEmoji: true });
  
  // 2. 如果有持仓信息，添加到开头
  if (positionContext && positionContext.buyPrice) {
    const currentPrice = positionContext.currentPrice || positionContext.stockData?.currentPrice;
    
    if (currentPrice && currentPrice !== 'N/A') {
      const positionInfo = formatPositionInfo(
        positionContext.buyPrice,
        currentPrice,
        symbol
      );
      formatted = positionInfo + '\n' + formatted;
    }
  }
  
  return formatted;
}

/**
 * 格式化简短消息（错误、提示等）
 */
function formatShortMessage(message, type = 'info') {
  const icons = {
    'error': '❌',
    'warning': '⚠️',
    'success': '✅',
    'info': 'ℹ️'
  };
  
  const icon = icons[type] || icons['info'];
  return `${icon} ${message}`;
}

module.exports = {
  // 原有功能
  formatResponse,
  formatNewsOnly,
  formatAnalysisOnly,
  formatAdviceOnly,
  formatFullReport,
  validateOutputCompliance,
  extractStructuredContent,
  
  // 🆕 v2.0 新增功能
  formatMarkdownToChinese,
  formatTechnicalAnalysis,
  formatPositionInfo,
  formatShortMessage,
  addSmartEmojis
};
