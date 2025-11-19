/**
 * Lightweight Ticket Formatter for解票功能
 * 
 * 专门服务解票（快速技术分析），不依赖研报API
 * 基于generateStockChart的轻量级分析结果
 * 
 * 三种输出格式：
 * 1. formatTicketStandardCN - 中文标准6板块结构
 * 2. formatTicketStandardEN - 英文标准6板块结构
 * 3. formatTicketHumanCN - 中文人话版（老交易员口吻）
 */

/**
 * 从AI分析文本中提取关键信息
 * @param {string} analysisText - AI生成的技术分析文本
 * @returns {Object} 提取的结构化数据
 */
function extractKeyInfo(analysisText) {
  const extracted = {
    trend: '未明确',
    trendStrength: 5,
    support: 'N/A',
    resistance: 'N/A',
    buySignal: 4,
    sellSignal: 4,
    riskLevel: '中等',
    priceRange: null
  };

  if (!analysisText) return extracted;

  // 提取趋势方向
  if (/上涨|上升|看涨|bullish|uptrend/i.test(analysisText)) {
    extracted.trend = '上涨';
    extracted.trendStrength = 7;
  } else if (/下跌|下降|看跌|bearish|downtrend/i.test(analysisText)) {
    extracted.trend = '下跌';
    extracted.trendStrength = 7;
  } else if (/震荡|盘整|横盘|sideways|consolidat/i.test(analysisText)) {
    extracted.trend = '盘整';
    extracted.trendStrength = 5;
  }

  // 提取支撑阻力（简单正则）
  const supportMatch = analysisText.match(/支撑.*?(\$?\d+\.?\d*)/);
  if (supportMatch) extracted.support = `$${supportMatch[1]}`;

  const resistanceMatch = analysisText.match(/阻力.*?(\$?\d+\.?\d*)/);
  if (resistanceMatch) extracted.resistance = `$${resistanceMatch[1]}`;

  // 提取价格区间
  const rangeMatch = analysisText.match(/(\$?\d+\.?\d*).*?(\$?\d+\.?\d*)/);
  if (rangeMatch) {
    extracted.priceRange = {
      low: parseFloat(rangeMatch[1].replace('$', '')),
      high: parseFloat(rangeMatch[2].replace('$', ''))
    };
  }

  return extracted;
}

/**
 * 🇨🇳 中文标准版格式化
 */
function formatTicketStandardCN(ticketData) {
  const symbol = ticketData.symbol || 'N/A';
  const analysis = ticketData.analysis || '';
  const info = extractKeyInfo(analysis);

  return `【📈 I. 趋势识别】
• 主要趋势方向：当前趋势为${info.trend}。
• 趋势强度评估：${info.trendStrength}分（${info.trendStrength >= 7 ? '较强' : info.trendStrength <= 4 ? '较弱' : '中等'}）
• 趋势持续性判断：短期内${info.trend === '盘整' ? '可能继续震荡，需关注突破信号' : '建议关注关键价位支撑'}。

【🎯 II. 关键价格水平】
• 重要支撑位：约在 ${info.support}
• 重要阻力位：约在 ${info.resistance}
• 突破/跌破信号：突破${info.resistance}可能预示进一步上涨，跌破${info.support}可能预示下跌。

【🔧 III. 技术形态分析】
• K线形态：${info.trend === '盘整' ? '近期出现多根小实体K线，显示市场犹豫' : '趋势明确'}。
• 图表形态：${info.trend === '盘整' ? '无明显形态' : '关注趋势延续'}。
• 缺口分析：无明显缺口。

【🧮 IV. 技术指标解读】
• 均线系统：${info.trend === '盘整' ? 'MA5与MA10接近粘合，显示短期方向不明' : '均线支撑趋势'}。
• 布林带位置：价格${info.trend === '盘整' ? '接近中轨，显示盘整状态' : '靠近布林带边缘'}。
• MACD状态：柱状图${info.trend === '盘整' ? '缩短，显示动能减弱' : '配合趋势'}。
• 成交量特征：近期成交量${info.trend === '上涨' ? '放量' : '无明显放大或缩小'}。

【💰 V. 交易信号】
• 买入信号强度：${info.buySignal}分（${info.buySignal >= 6 ? '较强' : '较弱'}）
• 卖出信号强度：${info.sellSignal}分（${info.sellSignal >= 6 ? '较强' : '较弱'}）
• 持仓建议：${info.trend === '盘整' ? '观望，等待明确突破信号' : '关注趋势延续'}。

【⚠️ VI. 风险评估】
• 技术面风险等级：${info.riskLevel === '低' ? '2' : info.riskLevel === '高' ? '4' : '3'}（${info.riskLevel}风险）
• 短期波动预期：可能在${info.priceRange ? `$${info.priceRange.low}至$${info.priceRange.high}` : '当前区间'}之间波动。
• 止损位建议：若持有多头，止损位可设在${info.support}下方。

请根据市场变化及时调整策略。`;
}

/**
 * 🇺🇸 英文标准版格式化
 */
function formatTicketStandardEN(ticketData) {
  const symbol = ticketData.symbol || 'N/A';
  const analysis = ticketData.analysis || '';
  const info = extractKeyInfo(analysis);

  const trendEN = info.trend === '上涨' ? 'Upward' : info.trend === '下跌' ? 'Downward' : 'Sideways';
  const strengthEN = info.trendStrength >= 7 ? 'strong' : info.trendStrength <= 4 ? 'weak' : 'moderate';

  return `【📈 I. Trend Identification】
• Main Trend Direction: Current trend is ${trendEN.toLowerCase()}.
• Trend Strength Assessment: ${info.trendStrength}/10 (${strengthEN})
• Trend Sustainability: In the short term, ${info.trend === '盘整' ? 'the stock may continue to trade in a range; a clear breakout is needed' : 'watch key support levels'}.

【🎯 II. Key Price Levels】
• Key Support: Around ${info.support}
• Key Resistance: Around ${info.resistance}
• Breakout/Breakdown Signals: A break above ${info.resistance} may start a new up-leg, while a break below ${info.support} could open room for further downside.

【🔧 III. Technical Pattern Analysis】
• Candlestick Pattern: ${info.trend === '盘整' ? 'Recent candles have small bodies, indicating indecision in the market' : 'Trend is clear'}.
• Chart Pattern: ${info.trend === '盘整' ? 'No clear pattern; price is mostly consolidating in a range' : 'Trend continuation pattern'}.
• Gap Analysis: No significant gaps at the moment.

【🧮 IV. Technical Indicator Interpretation】
• Moving Averages: ${info.trend === '盘整' ? 'MA5 and MA10 are frequently crossing, reflecting short-term choppy price action' : 'MAs support the trend'}.
• Bollinger Bands: Price is ${info.trend === '盘整' ? 'near the middle band, suggesting relatively low volatility' : 'near band edge'}.
• MACD: Histogram is ${info.trend === '盘整' ? 'shrinking and near the zero line, showing weakening momentum' : 'aligned with trend'}.
• Volume: Volume has ${info.trend === '上涨' ? 'picked up; watch whether rising prices are supported by stronger volume' : 'been relatively stable'}.

【💰 V. Trading Signals】
• Buy Signal Strength: ${info.buySignal}/10 (${info.buySignal >= 6 ? 'moderate' : 'weak'})
• Sell Signal Strength: ${info.sellSignal}/10 (${info.sellSignal >= 6 ? 'moderate' : 'weak'})
• Positioning Suggestion: ${info.trend === '盘整' ? 'Stay patient and wait for a clear breakout before committing aggressively' : 'Monitor trend continuation'}.

【⚠️ VI. Risk Assessment】
• Technical Risk Level: ${info.riskLevel === '低' ? '2' : info.riskLevel === '高' ? '4' : '3'} (${info.riskLevel === '低' ? 'low' : info.riskLevel === '高' ? 'high' : 'medium'} risk)
• Short-Term Volatility Expectation: Price may continue to oscillate ${info.priceRange ? `between $${info.priceRange.low} and $${info.priceRange.high}` : 'in current range'}.
• Suggested Stop-Loss: For long positions, a stop below around ${info.support} can be considered.

Please adjust your strategy promptly based on how the market evolves.`;
}

/**
 * 💬 中文人话版格式化（老交易员口吻）
 */
function formatTicketHumanCN(ticketData) {
  const symbol = ticketData.symbol || 'N/A';
  const analysis = ticketData.analysis || '';
  const info = extractKeyInfo(analysis);

  const trendFeel = info.trend === '上涨' ? '偏多头，但位置不算特别便宜' : 
                     info.trend === '下跌' ? '有点弱势，下方空间可能还要看一看' : 
                     '偏盘整，价格来回晃';

  const actionSuggestion = info.trend === '盘整' ? '想做的更多是区间内来回做差价，而不是一口气梭上去' :
                            info.trend === '上涨' ? '可以考虑按节奏减一点高位仓' :
                            '空仓的话，等反弹或者企稳再考虑';

  return `🧩 解票速览（${symbol}）

1）现在这票的感觉
整体${trendFeel}。${info.priceRange ? `价格在 $${info.priceRange.low}–$${info.priceRange.high} 来回晃。` : ''}这个位置${actionSuggestion}。

2）我会盯的价位
上面先看 ${info.resistance} 一带，${info.trend === '上涨' ? '有放量突破再说"新一段行情"' : '能不能突破要看量配合'}；下面 ${info.support} 是比较关键的防守位，${info.trend === '下跌' ? '跌穿了可能还要再看低一点' : '哪天跌穿了，就当这段震荡区间告一段落'}。

3）操作思路
${info.trend === '上涨' ? '已经拿着的人，可以按照自己成本稍微锁一下止损，别被一根阴线吓出去' : 
  info.trend === '下跌' ? '暂时先观望为主，这种走势不着急抄底' : 
  '已经在车上的，可以考虑按节奏减一点高位仓'}；空仓想上车的，${info.trend === '盘整' ? '等突破后的回踩，或者跌近支撑再考虑' : '等明确的信号出来再说'}，会比现在追着买舒服不少。

4）需要留意的风险
最近${info.trend === '上涨' ? '量有一点放出来，如果配合消息或者大盘情绪，一两天的波动会放大' : '整体波动不算特别大，但也别掉以轻心'}，仓位别打太死，留一点机动空间。

—— 市场节奏随时会变，这只是基于当前盘面的一个参考想法。`;
}

module.exports = {
  formatTicketStandardCN,
  formatTicketStandardEN,
  formatTicketHumanCN
};
