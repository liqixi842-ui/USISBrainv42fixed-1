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
 * 🛡️ 数据清洗/兜底层 - 处理N/A和异常价格区间
 * @param {Object} rawLevels - 原始价格水平数据
 * @returns {Object} 清洗后的数据（null表示无有效数据）
 */
function sanitizeLevels(rawLevels) {
  const { support, resistance, rangeLow, rangeHigh } = rawLevels || {};

  // 统一转成数字或 null
  const toNum = (v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'string') {
      const upper = v.toUpperCase();
      if (upper === 'N/A' || upper === 'NA' || upper === '') return null;
      v = v.replace(/[$,]/g, ''); // 移除 $ 和逗号
    }
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  let supportNum = toNum(support);
  let resistanceNum = toNum(resistance);
  let rangeLowNum = toNum(rangeLow);
  let rangeHighNum = toNum(rangeHigh);

  // 区间上下颠倒时自动交换
  if (rangeLowNum !== null && rangeHighNum !== null && rangeLowNum > rangeHighNum) {
    [rangeLowNum, rangeHighNum] = [rangeHighNum, rangeLowNum];
  }

  // 支撑阻力颠倒时自动交换
  if (supportNum !== null && resistanceNum !== null && supportNum > resistanceNum) {
    [supportNum, resistanceNum] = [resistanceNum, supportNum];
  }

  return {
    support: supportNum,
    resistance: resistanceNum,
    rangeLow: rangeLowNum,
    rangeHigh: rangeHighNum
  };
}

/**
 * 从AI分析文本中提取关键信息
 * @param {string} analysisText - AI生成的技术分析文本
 * @returns {Object} 提取的结构化数据
 */
function extractKeyInfo(analysisText) {
  const extracted = {
    trend: '未明确',
    trendStrength: 5,
    support: null,
    resistance: null,
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
  const resistanceMatch = analysisText.match(/阻力.*?(\$?\d+\.?\d*)/);

  // 提取价格区间
  const rangeMatch = analysisText.match(/(\$?\d+\.?\d*).*?(\$?\d+\.?\d*)/);
  let rangeLow = null;
  let rangeHigh = null;
  if (rangeMatch) {
    rangeLow = rangeMatch[1].replace('$', '');
    rangeHigh = rangeMatch[2].replace('$', '');
  }

  // 🛡️ 使用数据清洗层
  const cleaned = sanitizeLevels({
    support: supportMatch ? supportMatch[1] : null,
    resistance: resistanceMatch ? resistanceMatch[1] : null,
    rangeLow: rangeLow,
    rangeHigh: rangeHigh
  });

  extracted.support = cleaned.support;
  extracted.resistance = cleaned.resistance;
  if (cleaned.rangeLow !== null && cleaned.rangeHigh !== null) {
    extracted.priceRange = {
      low: cleaned.rangeLow,
      high: cleaned.rangeHigh
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

  // 🛡️ 兜底文案处理
  const supportText = info.support !== null 
    ? `约在 $${info.support.toFixed(2)}` 
    : '当前尚未形成清晰支撑区域';
  
  const resistanceText = info.resistance !== null 
    ? `约在 $${info.resistance.toFixed(2)}` 
    : '当前尚未形成清晰阻力区域';
  
  const breakoutText = (info.support !== null && info.resistance !== null)
    ? `突破$${info.resistance.toFixed(2)}可能预示进一步上涨，跌破$${info.support.toFixed(2)}可能预示下跌。`
    : '待关键价位形成后，可根据突破方向判断趋势。';
  
  const rangeText = info.priceRange 
    ? `可能在$${info.priceRange.low.toFixed(2)}至$${info.priceRange.high.toFixed(2)}之间波动` 
    : '以关键支撑位和阻力位为主要参考';
  
  const stopLossText = info.support !== null
    ? `若持有多头，止损位可设在$${info.support.toFixed(2)}下方`
    : '建议根据个人风险承受能力设定止损位';

  return `【📈 I. 趋势识别】
• 主要趋势方向：当前趋势为${info.trend}。
• 趋势强度评估：${info.trendStrength}分（${info.trendStrength >= 7 ? '较强' : info.trendStrength <= 4 ? '较弱' : '中等'}）
• 趋势持续性判断：短期内${info.trend === '盘整' ? '可能继续震荡，需关注突破信号' : '建议关注关键价位支撑'}。

【🎯 II. 关键价格水平】
• 重要支撑位：${supportText}
• 重要阻力位：${resistanceText}
• 突破/跌破信号：${breakoutText}

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
• 短期波动预期：${rangeText}。
• 止损位建议：${stopLossText}。

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

  // 🛡️ 兜底文案处理
  const supportText = info.support !== null 
    ? `Around $${info.support.toFixed(2)}` 
    : 'No clear support zone yet';
  
  const resistanceText = info.resistance !== null 
    ? `Around $${info.resistance.toFixed(2)}` 
    : 'No clear resistance zone yet';
  
  const breakoutText = (info.support !== null && info.resistance !== null)
    ? `A break above $${info.resistance.toFixed(2)} may start a new up-leg, while a break below $${info.support.toFixed(2)} could open room for further downside.`
    : 'Watch for key levels to form before making breakout decisions.';
  
  const rangeText = info.priceRange 
    ? `between $${info.priceRange.low.toFixed(2)} and $${info.priceRange.high.toFixed(2)}` 
    : 'within current trading range; use key support/resistance as reference';
  
  const stopLossText = info.support !== null
    ? `For long positions, a stop below around $${info.support.toFixed(2)} can be considered`
    : 'Set stop-loss based on personal risk tolerance';

  return `【📈 I. Trend Identification】
• Main Trend Direction: Current trend is ${trendEN.toLowerCase()}.
• Trend Strength Assessment: ${info.trendStrength}/10 (${strengthEN})
• Trend Sustainability: In the short term, ${info.trend === '盘整' ? 'the stock may continue to trade in a range; a clear breakout is needed' : 'watch key support levels'}.

【🎯 II. Key Price Levels】
• Key Support: ${supportText}
• Key Resistance: ${resistanceText}
• Breakout/Breakdown Signals: ${breakoutText}

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
• Short-Term Volatility Expectation: Price may continue to oscillate ${rangeText}.
• Suggested Stop-Loss: ${stopLossText}.

Please adjust your strategy promptly based on how the market evolves.`;
}

/**
 * 🇪🇸 西班牙语标准版格式化
 */
function formatTicketStandardES(ticketData) {
  const symbol = ticketData.symbol || 'N/A';
  const analysis = ticketData.analysis || '';
  const info = extractKeyInfo(analysis);

  const trendES = info.trend === '上涨' ? 'Alcista' : info.trend === '下跌' ? 'Bajista' : 'Lateral';
  const strengthES = info.trendStrength >= 7 ? 'fuerte' : info.trendStrength <= 4 ? 'débil' : 'moderada';

  const supportText = info.support !== null 
    ? `Alrededor de $${info.support.toFixed(2)}` 
    : 'Aún no se ha formado una zona de soporte clara';
  
  const resistanceText = info.resistance !== null 
    ? `Alrededor de $${info.resistance.toFixed(2)}` 
    : 'Aún no se ha formado una zona de resistencia clara';
  
  const breakoutText = (info.support !== null && info.resistance !== null)
    ? `Una ruptura por encima de $${info.resistance.toFixed(2)} podría iniciar un nuevo tramo alcista, mientras que una caída por debajo de $${info.support.toFixed(2)} abriría espacio para más bajadas.`
    : 'Espere a que se formen niveles clave antes de tomar decisiones de ruptura.';
  
  const rangeText = info.priceRange 
    ? `entre $${info.priceRange.low.toFixed(2)} y $${info.priceRange.high.toFixed(2)}` 
    : 'dentro del rango actual; use soporte/resistencia clave como referencia';
  
  const stopLossText = info.support !== null
    ? `Para posiciones largas, considere un stop por debajo de $${info.support.toFixed(2)}`
    : 'Establezca el stop-loss según su tolerancia al riesgo';

  return `【📈 I. Identificación de Tendencia】
• Dirección Principal: La tendencia actual es ${trendES.toLowerCase()}.
• Evaluación de Fuerza: ${info.trendStrength}/10 (${strengthES})
• Sostenibilidad: A corto plazo, ${info.trend === '盘整' ? 'el valor podría seguir en rango; se necesita una ruptura clara' : 'observe los niveles de soporte clave'}.

【🎯 II. Niveles de Precio Clave】
• Soporte Clave: ${supportText}
• Resistencia Clave: ${resistanceText}
• Señales de Ruptura: ${breakoutText}

【🔧 III. Análisis de Patrones Técnicos】
• Patrón de Velas: ${info.trend === '盘整' ? 'Las velas recientes tienen cuerpos pequeños, indicando indecisión' : 'La tendencia es clara'}.
• Patrón del Gráfico: ${info.trend === '盘整' ? 'Sin patrón claro; el precio consolida en rango' : 'Patrón de continuación de tendencia'}.
• Análisis de Gaps: No hay gaps significativos en este momento.

【🧮 IV. Interpretación de Indicadores】
• Medias Móviles: ${info.trend === '盘整' ? 'MA5 y MA10 se cruzan frecuentemente, reflejando volatilidad' : 'Las MAs apoyan la tendencia'}.
• Bandas de Bollinger: El precio está ${info.trend === '盘整' ? 'cerca de la banda media, sugiriendo baja volatilidad' : 'cerca del borde de la banda'}.
• MACD: El histograma ${info.trend === '盘整' ? 'se reduce cerca de cero, mostrando momentum débil' : 'está alineado con la tendencia'}.
• Volumen: El volumen ${info.trend === '上涨' ? 'ha aumentado; observe si los precios al alza están respaldados por volumen' : 'se ha mantenido estable'}.

【💰 V. Señales de Trading】
• Fuerza de Señal de Compra: ${info.buySignal}/10 (${info.buySignal >= 6 ? 'moderada' : 'débil'})
• Fuerza de Señal de Venta: ${info.sellSignal}/10 (${info.sellSignal >= 6 ? 'moderada' : 'débil'})
• Sugerencia de Posición: ${info.trend === '盘整' ? 'Sea paciente y espere una ruptura clara antes de comprometerse' : 'Monitoree la continuación de la tendencia'}.

【⚠️ VI. Evaluación de Riesgo】
• Nivel de Riesgo Técnico: ${info.riskLevel === '低' ? '2' : info.riskLevel === '高' ? '4' : '3'} (riesgo ${info.riskLevel === '低' ? 'bajo' : info.riskLevel === '高' ? 'alto' : 'medio'})
• Volatilidad Esperada: El precio podría continuar oscilando ${rangeText}.
• Stop-Loss Sugerido: ${stopLossText}.

Ajuste su estrategia según la evolución del mercado.`;
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

  // 🛡️ 人话版兜底文案
  const resistanceHuman = info.resistance !== null 
    ? `$${info.resistance.toFixed(2)}` 
    : '上方的压力位';
  
  const supportHuman = info.support !== null 
    ? `$${info.support.toFixed(2)}` 
    : '下方的支撑位';
  
  const rangeHuman = info.priceRange 
    ? `价格在 $${info.priceRange.low.toFixed(2)}–$${info.priceRange.high.toFixed(2)} 来回晃。` 
    : '';

  return `🧩 解票速览（${symbol}）

1）现在这票的感觉
整体${trendFeel}。${rangeHuman}这个位置${actionSuggestion}。

2）我会盯的价位
上面先看 ${resistanceHuman} 一带，${info.trend === '上涨' ? '有放量突破再说"新一段行情"' : '能不能突破要看量配合'}；下面 ${supportHuman} 是比较关键的防守位，${info.trend === '下跌' ? '跌穿了可能还要再看低一点' : '哪天跌穿了，就当这段震荡区间告一段落'}。

3）操作思路
${info.trend === '上涨' ? '已经拿着的人，可以按照自己成本稍微锁一下止损，别被一根阴线吓出去' : 
  info.trend === '下跌' ? '暂时先观望为主，这种走势不着急抄底' : 
  '已经在车上的，可以考虑按节奏减一点高位仓'}；空仓想上车的，${info.trend === '盘整' ? '等突破后的回踩，或者跌近支撑再考虑' : '等明确的信号出来再说'}，会比现在追着买舒服不少。

4）需要留意的风险
最近${info.trend === '上涨' ? '量有一点放出来，如果配合消息或者大盘情绪，一两天的波动会放大' : '整体波动不算特别大，但也别掉以轻心'}，仓位别打太死，留一点机动空间。

—— 市场节奏随时会变，这只是基于当前盘面的一个参考想法。`;
}

// 🆕 v7.1: 语言格式化器注册表（可扩展）
const FORMATTERS = {
  'zh': formatTicketStandardCN,
  'cn': formatTicketStandardCN,
  '中文': formatTicketStandardCN,
  'en': formatTicketStandardEN,
  '英文': formatTicketStandardEN,
  'es': formatTicketStandardES,
  '西语': formatTicketStandardES,
  '西班牙语': formatTicketStandardES,
  'human': formatTicketHumanCN,
  '聊天版': formatTicketHumanCN,
  '人话版': formatTicketHumanCN
};

// 🆕 v7.1: 模式预设（快捷方式）
const MODE_PRESETS = {
  '标准版': ['zh'],
  '双语': ['zh', 'en'],
  '三语': ['zh', 'en', 'es'],
  '完整版': ['zh', 'en', 'human'],
  '聊天版': ['human'],
  '人话版': ['human'],
  '中文': ['zh'],
  '英文': ['en'],
  '西语': ['es'],
  '西班牙语': ['es']
};

/**
 * 🆕 v7.1: 解析语言模式（支持自然语言输入）
 * @param {string} modeInput - 用户输入的模式（如 "双语", "中文和西语", "英语和中文"）
 * @returns {Array<string>} 语言代码数组
 */
function parseLanguageMode(modeInput) {
  if (!modeInput) return ['zh']; // 默认中文
  
  const input = modeInput.toLowerCase().trim();
  
  // 检查预设模式
  if (MODE_PRESETS[modeInput]) {
    return MODE_PRESETS[modeInput];
  }
  
  // 解析组合模式（如 "中文和西语", "英语和中文"）
  const languages = [];
  
  // 语言关键词映射
  const langKeywords = {
    '中文': 'zh', '中': 'zh', 'zh': 'zh', 'cn': 'zh', 'chinese': 'zh',
    '英文': 'en', '英语': 'en', '英': 'en', 'en': 'en', 'english': 'en',
    '西语': 'es', '西班牙语': 'es', '西': 'es', 'es': 'es', 'spanish': 'es',
    '人话': 'human', '聊天': 'human', 'human': 'human'
  };
  
  // 检查每个语言关键词
  for (const [keyword, code] of Object.entries(langKeywords)) {
    if (input.includes(keyword) && !languages.includes(code)) {
      languages.push(code);
    }
  }
  
  // 如果没有匹配到任何语言，返回默认中文
  return languages.length > 0 ? languages : ['zh'];
}

/**
 * 🆕 v7.1: 根据语言列表生成消息
 * @param {Object} ticketData - 票据数据
 * @param {Array<string>} languages - 语言代码数组
 * @returns {Array<string>} 格式化后的消息数组
 */
function formatByLanguages(ticketData, languages) {
  const messages = [];
  
  for (const lang of languages) {
    const formatter = FORMATTERS[lang];
    if (formatter) {
      messages.push(formatter(ticketData));
    } else {
      console.warn(`[LightweightFormatter] 未知语言代码: ${lang}`);
    }
  }
  
  return messages.length > 0 ? messages : [formatTicketStandardCN(ticketData)];
}

module.exports = {
  formatTicketStandardCN,
  formatTicketStandardEN,
  formatTicketStandardES,
  formatTicketHumanCN,
  parseLanguageMode,
  formatByLanguages,
  FORMATTERS,
  MODE_PRESETS
};
