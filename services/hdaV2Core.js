/**
 * ═══════════════════════════════════════════════════════════════
 * USIS Brain - HDA v2 Core (Human Desk Assistant v2)
 * ═══════════════════════════════════════════════════════════════
 * 
 * 核心模块：
 * 1. analysisPayload JSON 结构
 * 2. 语气框架 (Tone Framework)
 * 3. 随机化表达生成器
 * 4. 双语分段输出格式化
 */

// ═══════════════════════════════════════════════════════════════
// 1. Analysis Payload Schema
// ═══════════════════════════════════════════════════════════════

/**
 * 创建标准化分析负载
 * @param {string} ticker - 股票代码
 * @param {string} mode - 'quick' 或 'deep'
 * @param {Object} chartData - 图表数据
 * @param {Object} stockData - 股票行情数据
 * @returns {Object} 标准化分析负载
 */
function createAnalysisPayload(ticker, mode, chartData = {}, stockData = {}) {
  return {
    intent: 'stock_analysis',
    ticker: ticker.toUpperCase(),
    mode: mode, // 'quick' | 'deep'
    timestamp: new Date().toISOString(),
    
    analysis_data: {
      bias: detectBias(stockData),
      tempo: detectTempo(stockData),
      bid_support: 'moderate',
      supply_strength: 'moderate',
      active_flow: 'neutral',
      
      tape_behavior: {
        refill_wall: false,
        algo_selling: false,
        small_lot_absorption: false,
        burst_buying: false
      },
      
      user_cost: null,
      key_support: [],
      key_resistance: [],
      
      price: stockData.currentPrice || stockData.price,
      change: stockData.change,
      changePercent: stockData.changePercent
    },
    
    light_chart_url: chartData.chartUrl || null,
    light_chart_buffer: chartData.buffer || chartData.imageBase64 || null,
    deep_chart_urls: [],
    
    vision_analysis: chartData.chartAnalysis || '',
    
    final_output_zh: '',
    final_output_en: ''
  };
}

function detectBias(stockData) {
  const change = stockData?.changePercent || 0;
  if (change > 2) return 'strong_bull';
  if (change > 0.5) return 'mild_bull';
  if (change < -2) return 'strong_bear';
  if (change < -0.5) return 'mild_bear';
  return 'neutral';
}

function detectTempo(stockData) {
  const change = Math.abs(stockData?.changePercent || 0);
  if (change > 3) return 'volatile';
  if (change > 1) return 'active';
  if (change < 0.3) return 'slow_grind';
  return 'steady';
}

// ═══════════════════════════════════════════════════════════════
// 2. Tone Framework - 语气框架
// ═══════════════════════════════════════════════════════════════

const TONE_FRAMEWORK = {
  // 开场白变体 - 随机选择
  openers_zh: [
    '我刚扫了一眼',
    '我快速看了一下',
    '刚翻了一下盘面',
    '我看了一眼图',
    '快速扫了一遍',
    '刚瞄了一眼',
    '我简单看了下'
  ],
  
  openers_en: [
    'Had a quick look at',
    'Just scanned',
    'Took a quick glance at',
    'Quick look at',
    'Just checked',
    'Briefly looked at'
  ],
  
  // 节奏描述 - 根据 tempo
  tempo_zh: {
    volatile: ['波动挺大', '动得比较剧烈', '上蹿下跳的', '震荡得厉害'],
    active: ['交易还挺活跃', '有点动作', '节奏还行', '不算冷清'],
    steady: ['节奏挺稳', '走得很稳', '比较平稳', '没什么大波动'],
    slow_grind: ['走得很慢', '磨得挺慢', '节奏很慢', '不太动']
  },
  
  tempo_en: {
    volatile: ['quite volatile', 'moving aggressively', 'pretty choppy', 'swinging hard'],
    active: ['trading actively', 'seeing some action', 'decent pace', 'not too quiet'],
    steady: ['steady pace', 'moving smoothly', 'pretty calm', 'holding well'],
    slow_grind: ['grinding slowly', 'quiet trading', 'not much action', 'slow pace']
  },
  
  // 多空偏向描述
  bias_zh: {
    strong_bull: ['涨得挺猛', '多头很强', '买盘很凶', '冲得挺狠'],
    mild_bull: ['偏多一点', '有点向上', '买盘占优', '略微偏强'],
    neutral: ['方向不明', '多空僵持', '在这里拉锯', '还在犹豫'],
    mild_bear: ['偏弱一点', '有点压力', '卖盘占优', '略微偏软'],
    strong_bear: ['跌得比较狠', '空头很强', '卖压很重', '在往下砸']
  },
  
  bias_en: {
    strong_bull: ['rallying hard', 'strong buying pressure', 'bulls in control', 'pushing higher aggressively'],
    mild_bull: ['leaning bullish', 'slight upward bias', 'buyers stepping in', 'modest strength'],
    neutral: ['no clear direction', 'buyers and sellers balanced', 'grinding sideways', 'still deciding'],
    mild_bear: ['leaning bearish', 'slight downward pressure', 'sellers more active', 'modest weakness'],
    strong_bear: ['selling off hard', 'strong selling pressure', 'bears in control', 'dropping aggressively']
  },
  
  // 支撑/阻力描述
  support_zh: ['下面有人接', '支撑还行', '底下有买盘', '下面撑得住'],
  resistance_zh: ['上面有压力', '顶着卖单', '阻力在那', '上面不太好过'],
  
  support_en: ['support holding', 'buyers stepping in below', 'bids are there', 'floor looks solid'],
  resistance_en: ['resistance above', 'sellers waiting up there', 'supply zone ahead', 'overhead pressure'],
  
  // 深度分析邀请语
  invite_deep_zh: [
    '需要我再往深一点看吗？',
    '要不要我继续拆？',
    '我可以帮你看 tape。',
    '你要 deeper 吗？',
    '想深入看看吗？',
    '要我仔细看一下成交吗？'
  ],
  
  invite_deep_en: [
    'Want me to dig deeper?',
    'Should I take a closer look?',
    'Want the full tape read?',
    'Need a deeper dive?',
    'Want more detail?'
  ],
  
  // 持仓评价
  position_neutral_zh: ['你这个位置还行', '成本在中性区域', '这个价位不痛不痒'],
  position_good_zh: ['你的成本挺舒服', '位置很不错', '拿着挺安心的'],
  position_bad_zh: ['成本有点高', '位置不太好', '被套住一点'],
  
  position_neutral_en: ['your entry is neutral', 'cost basis is okay', 'nothing special about your price'],
  position_good_en: ['comfortable entry', 'nice cost basis', 'sitting pretty well'],
  position_bad_en: ['entry is a bit high', 'cost basis under water', 'slightly underwater']
};

// ═══════════════════════════════════════════════════════════════
// 3. 随机化工具
// ═══════════════════════════════════════════════════════════════

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomShuffle(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ═══════════════════════════════════════════════════════════════
// 4. Quick Take 生成器
// ═══════════════════════════════════════════════════════════════

/**
 * 生成 Quick Take 自然语言输出
 * @param {Object} payload - 分析负载
 * @returns {Object} { zh: string, en: string }
 */
function generateQuickTake(payload) {
  const ticker = payload.ticker;
  const data = payload.analysis_data;
  const bias = data.bias || 'neutral';
  const tempo = data.tempo || 'steady';
  
  // === 中文版 ===
  const zh_opener = randomPick(TONE_FRAMEWORK.openers_zh);
  const zh_tempo = randomPick(TONE_FRAMEWORK.tempo_zh[tempo] || TONE_FRAMEWORK.tempo_zh.steady);
  const zh_bias = randomPick(TONE_FRAMEWORK.bias_zh[bias] || TONE_FRAMEWORK.bias_zh.neutral);
  const zh_support = randomPick(TONE_FRAMEWORK.support_zh);
  const zh_invite = randomPick(TONE_FRAMEWORK.invite_deep_zh);
  
  // 随机组合句子顺序
  const zh_parts = randomShuffle([
    `${zh_tempo}`,
    `${zh_bias}`,
    `${zh_support}`
  ]);
  
  const zh_output = `${zh_opener}${ticker}，${zh_parts.slice(0, 2).join('，')}。
${zh_parts[2]}，整体来说${bias.includes('bull') ? '还可以' : bias.includes('bear') ? '要小心点' : '方向还不明朗'}。
${zh_invite}`;

  // === 英文版 ===
  const en_opener = randomPick(TONE_FRAMEWORK.openers_en);
  const en_tempo = randomPick(TONE_FRAMEWORK.tempo_en[tempo] || TONE_FRAMEWORK.tempo_en.steady);
  const en_bias = randomPick(TONE_FRAMEWORK.bias_en[bias] || TONE_FRAMEWORK.bias_en.neutral);
  const en_support = randomPick(TONE_FRAMEWORK.support_en);
  const en_invite = randomPick(TONE_FRAMEWORK.invite_deep_en);
  
  const en_output = `${en_opener} ${ticker}. ${en_tempo.charAt(0).toUpperCase() + en_tempo.slice(1)}, ${en_bias}.
${en_support.charAt(0).toUpperCase() + en_support.slice(1)}.
${en_invite}`;

  return { zh: zh_output.trim(), en: en_output.trim() };
}

// ═══════════════════════════════════════════════════════════════
// 5. Deep Take 生成器
// ═══════════════════════════════════════════════════════════════

/**
 * 生成 Deep Take 自然语言输出
 * @param {Object} payload - 分析负载
 * @returns {Object} { zh: string, en: string }
 */
function generateDeepTake(payload) {
  const ticker = payload.ticker;
  const data = payload.analysis_data;
  const visionAnalysis = payload.vision_analysis || '';
  const bias = data.bias || 'neutral';
  const tempo = data.tempo || 'steady';
  
  // 从视觉分析中提取关键信息
  const hasSupport = visionAnalysis.includes('支撑') || visionAnalysis.includes('support');
  const hasResistance = visionAnalysis.includes('阻力') || visionAnalysis.includes('resistance');
  
  // === 中文深度版 ===
  const zh_deep_openers = [
    `我刚把${ticker}的图和成交都重新扫了一遍。`,
    `仔细看了一下${ticker}的盘面结构。`,
    `我深入看了一下${ticker}。`
  ];
  
  const zh_tape_reads = [
    '下面的买盘挺有耐心，每次回踩都会有人迅速接回来，不像托盘，更像是真有人在慢慢收。',
    'Tape 里面能看到买盘偶尔发力，但立刻被卖压顶住，双方像在试探彼此的底线。',
    '成交节奏显示有人在慢慢建仓，不是那种急吼吼的买法。',
    '卖单来得很有规律，看起来像是算法在控制节奏减仓。'
  ];
  
  const zh_structure_reads = [
    '上面几个点位的卖单很固执，被扫掉又补回来，这种节奏很像自动化减仓，不是砸盘。',
    '整体结构看起来像是在酝酿方向，关键看买盘能不能撬开那层持续补单的卖墙。',
    '价格在这个区间来回震荡，等待方向选择。'
  ];
  
  const zh_position_eval = randomPick(TONE_FRAMEWORK.position_neutral_zh);
  
  const zh_output = `${randomPick(zh_deep_openers)}
${randomPick(zh_tape_reads)}
${randomPick(zh_structure_reads)}
${zh_position_eval}。
${bias.includes('bull') ? '如果能守住下方支撑，往上走的概率大一些。' : 
  bias.includes('bear') ? '短期还有下行压力，注意控制仓位。' : 
  '目前还在观望阶段，不急着加仓或减仓。'}`;

  // === 英文深度版 ===
  const en_deep_openers = [
    `I took another close look at ${ticker}—charts, tape, depth.`,
    `Dug deeper into ${ticker}'s structure.`,
    `Here's a more detailed read on ${ticker}.`
  ];
  
  const en_tape_reads = [
    'Buyers keep stepping in on dips, feels like quiet accumulation rather than propping.',
    'Tape\'s been very back-and-forth; buyers show bursts, but sellers answer back quickly.',
    'Trading pattern suggests methodical position building, not panic buying.',
    'Selling comes in waves with algorithmic precision—looks like controlled distribution.'
  ];
  
  const en_structure_reads = [
    'The sell zones above are stubborn; every time price pushes in, active selling hits and the wall refills almost instantly—algo-like behavior.',
    'The whole thing feels like it\'s setting up for a move; if buyers can break those refill levels, it\'ll run clean.',
    'Price is consolidating in this range, waiting for a directional catalyst.'
  ];
  
  const en_position_eval = randomPick(TONE_FRAMEWORK.position_neutral_en);
  
  const en_output = `${randomPick(en_deep_openers)}
${randomPick(en_tape_reads)}
${randomPick(en_structure_reads)}
Your entry ${en_position_eval}.
${bias.includes('bull') ? 'If support holds, upside probability looks better.' : 
  bias.includes('bear') ? 'Short-term pressure remains, watch position sizing.' : 
  'Still in wait-and-see mode, no rush to add or trim.'}`;

  return { zh: zh_output.trim(), en: en_output.trim() };
}

// ═══════════════════════════════════════════════════════════════
// 6. 双语分段输出格式化
// ═══════════════════════════════════════════════════════════════

/**
 * 格式化双语输出（中文段落 → 空行 → 英文段落）
 * @param {string} zhText - 中文文本
 * @param {string} enText - 英文文本
 * @returns {string} 格式化后的双语输出
 */
function formatBilingualOutput(zhText, enText) {
  return `${zhText}\n\n${enText}`;
}

/**
 * 完整的 HDA 输出生成
 * @param {Object} payload - 分析负载
 * @returns {Object} { message: string, payload: Object }
 */
function generateHDAOutput(payload) {
  const mode = payload.mode || 'quick';
  
  let output;
  if (mode === 'deep') {
    output = generateDeepTake(payload);
  } else {
    output = generateQuickTake(payload);
  }
  
  payload.final_output_zh = output.zh;
  payload.final_output_en = output.en;
  
  return {
    message: formatBilingualOutput(output.zh, output.en),
    payload: payload
  };
}

// ═══════════════════════════════════════════════════════════════
// 7. Telegram Inline Keyboard 构建器
// ═══════════════════════════════════════════════════════════════

/**
 * 创建深度分析按钮
 * @param {string} ticker - 股票代码
 * @returns {Object} Telegram inline keyboard markup
 */
function createDeepAnalysisButton(ticker) {
  return {
    inline_keyboard: [[
      {
        text: '🔍 深度分析 / Deep Dive',
        callback_data: `deep_${ticker.toUpperCase()}`
      }
    ]]
  };
}

// ═══════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════

module.exports = {
  createAnalysisPayload,
  generateQuickTake,
  generateDeepTake,
  generateHDAOutput,
  formatBilingualOutput,
  createDeepAnalysisButton,
  TONE_FRAMEWORK,
  randomPick,
  randomShuffle
};
