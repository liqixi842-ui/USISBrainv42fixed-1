// ====== Analysis Prompt Builder with Anti-Hallucination ======
// 构建AI分析prompt，强制使用实时数据，禁止编造

const { validateDataForAnalysis } = require("./dataBroker");

/**
 * 构建分析Prompt - 带强制数据引用和反编造机制
 * @param {Object} marketData - 市场数据（来自dataBroker）
 * @param {Intent} intent - 用户意图
 * @param {string} userQuery - 用户原始查询
 * @param {string} mode - 分析模式
 * @param {string} language - 目标语言
 * @returns {string} - 完整的分析prompt
 */
function buildAnalysisPrompt({
  marketData,
  intent,
  userQuery,
  mode = 'intraday',
  language = 'zh'
}) {
  console.log(`\n📝 [Analysis Prompt] 构建分析prompt`);
  
  // 1. 验证数据有效性
  const validation = validateDataForAnalysis(marketData);
  if (!validation.valid) {
    throw new Error(`数据验证失败: ${validation.reason}`);
  }
  
  // 2. 构建系统Prompt
  const systemPrompt = buildSystemPrompt(mode, language);
  
  // 3. 构建数据注入Prompt
  const dataPrompt = buildDataPrompt(marketData);
  
  // 4. 构建用户查询Prompt
  const queryPrompt = buildQueryPrompt(userQuery, intent);
  
  // 5. 构建反编造检查清单
  const checklistPrompt = buildChecklistPrompt();
  
  // 组合完整prompt
  const fullPrompt = `${systemPrompt}\n\n${dataPrompt}\n\n${queryPrompt}\n\n${checklistPrompt}`;
  
  console.log(`✅ [Analysis Prompt] Prompt构建完成 (${fullPrompt.length}字符)`);
  
  return fullPrompt;
}

/**
 * 构建系统Prompt
 */
function buildSystemPrompt(mode, language) {
  const modeDescriptions = {
    premarket: '盘前简报分析师',
    intraday: '盘中实时分析师',
    postmarket: '盘后复盘分析师',
    diagnose: '个股诊断专家',
    news: '市场资讯分析师'
  };
  
  const roleDescription = modeDescriptions[mode] || '市场分析师';
  
  return `你是USIS Brain的${roleDescription}。

⚠️ **严格数据使用规则（必须遵守）**：

1. **禁止使用任何训练数据**
   - 你不得使用任何来自训练数据集的股票价格、指数值、或市场数据
   - 你的分析必须100%基于下方"📊 实时市场数据"部分提供的数据
   - 如果数据中没有某个值，你必须明确说"数据未提供"，绝不能猜测或使用历史知识

2. **强制数据引用**
   - 当你提到任何数字（价格、涨跌幅、指数值）时，必须确保该数字存在于提供的数据中
   - 例如：不要说"标普500在4300点"，除非数据中明确提供了这个值
   - 例如：不要说"IBEX35指数为8000点"，除非数据中明确提供了这个值

3. **数据缺失时的处理**
   - 如果请求的股票数据未能获取，你必须明确告知用户"无法获取XX的实时数据"
   - 不要用任何理由编造数据（即使是"大约"、"估计"、"通常"等表述也不允许）
   - 如果数据质量评分低于60%，建议用户稍后重试

4. **数据来源追踪**
   - 数据中包含了来源和时间戳信息
   - 如果数据年龄超过60分钟，提醒用户数据可能不是最新的

你的目标是提供准确、可靠、基于真实数据的分析，而不是基于猜测或训练数据的"可能性"分析。`;
}

/**
 * 构建数据注入Prompt
 */
function buildDataPrompt(marketData) {
  const { quotes, news, metadata } = marketData;
  const { calculateSupportResistance, formatLevelsForPrompt } = require('./technicalLevels');
  
  let dataPrompt = `\n========================================\n`;
  dataPrompt += `📊 实时市场数据（这是你唯一可以使用的数据源）\n`;
  dataPrompt += `========================================\n\n`;
  
  // 1. 数据元信息
  dataPrompt += `**数据元信息**:\n`;
  dataPrompt += `- 请求ID: ${metadata.requestId}\n`;
  dataPrompt += `- 采集时间: ${new Date(metadata.timestamp).toISOString()}\n`;
  dataPrompt += `- 数据质量评分: ${(metadata.dataQuality.overallScore * 100).toFixed(0)}%\n`;
  dataPrompt += `- 数据新鲜度: ${(metadata.dataQuality.freshnessAvg * 100).toFixed(0)}%\n`;
  dataPrompt += `- 数据完整性: ${metadata.complete ? '完整' : '部分缺失'}\n`;
  
  if (metadata.missingFields.length > 0) {
    dataPrompt += `- ⚠️ 缺失字段: ${metadata.missingFields.join(', ')}\n`;
  }
  
  dataPrompt += `\n`;
  
  // 2. 股票报价数据
  if (Object.keys(quotes).length > 0) {
    dataPrompt += `**股票报价数据** (以下是完整的可用数据):\n\n`;
    
    Object.entries(quotes).forEach(([symbol, quote]) => {
      dataPrompt += `【${symbol}】\n`;
      
      // 🆕 v3.1: 处理null或缺失数据的情况
      if (quote && quote.currentPrice !== undefined && quote.currentPrice !== null) {
        dataPrompt += `  - 当前价格: $${quote.currentPrice.toFixed(2)}\n`;
        dataPrompt += `  - 涨跌额: ${quote.change >= 0 ? '+' : ''}$${quote.change.toFixed(2)}\n`;
        dataPrompt += `  - 涨跌幅: ${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%\n`;
        dataPrompt += `  - 今日最高: $${quote.high.toFixed(2)}\n`;
        dataPrompt += `  - 今日最低: $${quote.low.toFixed(2)}\n`;
        dataPrompt += `  - 开盘价: $${quote.open.toFixed(2)}\n`;
        dataPrompt += `  - 昨收价: $${quote.previousClose.toFixed(2)}\n`;
        dataPrompt += `  - 数据时间: ${new Date(quote.timestamp).toISOString()}\n`;
        dataPrompt += `  - 数据年龄: ${quote.dataAgeMinutes}分钟\n`;
        dataPrompt += `  - 数据来源: ${quote.source}\n`;
        dataPrompt += `  - 新鲜度评分: ${(quote.freshnessScore * 100).toFixed(0)}%\n`;
        
        // 🆕 添加技术分析数据（支撑压力位）
        const technicalLevels = calculateSupportResistance(quote);
        if (technicalLevels) {
          dataPrompt += formatLevelsForPrompt(technicalLevels);
        }
      } else {
        dataPrompt += `  ⚠️ 数据不可用（API调用失败或数据源暂时不可访问）\n`;
      }
      
      dataPrompt += `\n`;
    });
  } else {
    dataPrompt += `**股票报价数据**: 无\n\n`;
  }
  
  // 3. 新闻数据（如果有）
  if (news && news.length > 0) {
    dataPrompt += `**相关新闻** (最新${news.length}条):\n\n`;
    news.forEach((item, i) => {
      dataPrompt += `${i + 1}. ${item.headline}\n`;
      dataPrompt += `   来源: ${item.source} | 时间: ${new Date(item.datetime).toISOString()}\n`;
      if (item.summary) {
        dataPrompt += `   摘要: ${item.summary.substring(0, 200)}...\n`;
      }
      dataPrompt += `\n`;
    });
  }
  
  // 4. 数据来源详情
  dataPrompt += `\n**数据来源详情**:\n`;
  metadata.dataSources.forEach((source, i) => {
    dataPrompt += `${i + 1}. ${source.provider} - ${source.endpoint}\n`;
    dataPrompt += `   符号: ${source.symbol || 'N/A'}\n`;
    dataPrompt += `   状态: ${source.status}\n`;
    dataPrompt += `   数据年龄: ${source.freshnessMinutes}分钟\n`;
    if (source.error) {
      dataPrompt += `   错误: ${source.error}\n`;
    }
    dataPrompt += `\n`;
  });
  
  dataPrompt += `========================================\n`;
  dataPrompt += `⚠️ 重要提醒：以上是你可以使用的全部数据。如果某个值不在上方数据中，你必须说"数据未提供"，绝不能使用训练数据或猜测。\n`;
  dataPrompt += `========================================\n`;
  
  return dataPrompt;
}

/**
 * 构建查询Prompt
 */
function buildQueryPrompt(userQuery, intent) {
  let prompt = `\n**用户查询**:\n`;
  prompt += `"${userQuery}"\n\n`;
  
  prompt += `**解析的意图**:\n`;
  prompt += `- 意图类型: ${intent.intentType}\n`;
  prompt += `- 分析模式: ${intent.mode}\n`;
  prompt += `- 响应模式: ${intent.responseMode || 'full_report'}\n`;
  
  if (intent.entities && intent.entities.length > 0) {
    prompt += `- 识别的实体: ${intent.entities.map(e => `${e.value}(${e.type})`).join(', ')}\n`;
  }
  
  if (intent.exchange) {
    prompt += `- 交易所: ${intent.exchange}\n`;
  }
  
  if (intent.sector) {
    prompt += `- 行业板块: ${intent.sector}\n`;
  }
  
  // 🆕 v3.2: 持仓信息（个性化分析关键）
  if (intent.positionContext && intent.positionContext.buyPrice) {
    prompt += `\n⚠️ **重要：用户持仓信息**（必须基于此提供个性化建议）:\n`;
    prompt += `- 买入成本: $${intent.positionContext.buyPrice}\n`;
    
    if (intent.positionContext.holdingIntent) {
      prompt += `- 持仓意图: 询问续抱、止盈、止损建议\n`;
    }
    
    if (intent.positionContext.profitStatus) {
      prompt += `- 当前状态: ${intent.positionContext.profitStatus === 'profit' ? '盈利' : intent.positionContext.profitStatus === 'loss' ? '亏损' : '未知'}\n`;
    }
    
    prompt += `\n📊 **你的任务**：\n`;
    prompt += `1. 计算当前价格相对于买入成本的盈亏情况（使用上方实时数据中的当前价格）\n`;
    prompt += `2. 基于技术分析和市场数据，给出明确的操作建议（继续持有、部分止盈、或止损）\n`;
    prompt += `3. 提供具体的止盈位、止损位建议\n`;
    prompt += `4. 分析当前持仓的风险收益比\n`;
    prompt += `\n`;
  }
  
  prompt += `\n请基于上方提供的实时数据进行分析。\n`;
  
  return prompt;
}

/**
 * 构建反编造检查清单
 */
function buildChecklistPrompt() {
  return `\n**✅ 回答前检查清单（必须完成）**:

在生成回答之前，请确认：

□ 我提到的所有数字（价格、涨跌幅、指数值）都存在于上方"📊 实时市场数据"中
□ 我没有使用任何来自训练数据的市场信息
□ 如果某个数据缺失，我明确说明了"数据未提供"而不是猜测
□ 我引用的数据包含了来源和时间信息
□ 如果数据年龄超过60分钟，我已提醒用户

如果以上任何一项未满足，请修改你的回答直到满足所有条件。

现在，请提供你的分析：`;
}

/**
 * 构建错误响应（当数据无法获取时）
 */
function buildErrorResponse(reason, language = 'zh') {
  const messages = {
    zh: `⚠️ 抱歉，无法完成分析：${reason}

这可能是因为：
1. 股票代码不正确或不存在
2. 数据提供商暂时无法访问
3. 请求的市场数据不可用

建议：
- 检查股票代码是否正确
- 稍后重试
- 或尝试其他股票`,
    
    en: `⚠️ Sorry, unable to complete analysis: ${reason}

This may be because:
1. Stock symbol is incorrect or doesn't exist
2. Data provider temporarily unavailable
3. Requested market data not available

Suggestions:
- Verify stock symbol is correct
- Try again later
- Or try other stocks`
  };
  
  return messages[language] || messages.zh;
}

module.exports = {
  buildAnalysisPrompt,
  buildErrorResponse
};
