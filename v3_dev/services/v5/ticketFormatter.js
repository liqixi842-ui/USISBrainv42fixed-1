/**
 * USIS Brain v6.0 - Ticket Formatter (解票格式化模块)
 * 
 * 统一输出层，负责「怎么说」而不改变核心生成逻辑
 * 
 * Three Output Formats:
 * 1. Standard CN (标准版中文) - formatTicketStandardCN()
 * 2. Standard EN (标准版英文) - formatTicketStandardEN()
 * 3. Human Voice (人话版) - formatTicketHuman()
 * 
 * Features:
 * - Asset-type aware (equity/index/etf/crypto)
 * - Short sentences, NO long paragraphs
 * - Fallback-ready for missing data
 * - Telegram character limit protection (< 2500 chars)
 */

const { callOpenAI } = require('../aiService');

/**
 * 🇨🇳 STANDARD CHINESE FORMAT
 * Fixed structure with 6 sections
 */
function formatTicketStandardCN(report) {
  const symbol = report.symbol || 'N/A';
  const companyName = report.company_name || symbol;
  const price = report.price?.last || 'N/A';
  const rating = report.rating || 'NEUTRAL';
  const targetPrice = report.targets?.base?.price || 'N/A';
  const upside = report.targets?.base?.upside_pct || 'N/A';
  
  // Extract key levels from tech_view_text or use defaults
  const support = report.targets?.support || (price !== 'N/A' ? (price * 0.90).toFixed(2) : 'N/A');
  const resistance = report.targets?.resistance || (price !== 'N/A' ? (price * 1.10).toFixed(2) : 'N/A');
  const stopLoss = report.targets?.stop_loss || (price !== 'N/A' ? (price * 0.85).toFixed(2) : 'N/A');
  
  // Parse tech indicators from tech_view_text if available
  const techText = report.tech_view_text || '';
  const hasTrendInfo = techText.length > 100;
  
  // Determine trend direction from rating and upside
  let trendDirection = '震荡';
  let trendStrength = 5;
  if (rating === 'BUY' || upside > 15) {
    trendDirection = '向上';
    trendStrength = upside > 30 ? 8 : 7;
  } else if (rating === 'SELL' || upside < -10) {
    trendDirection = '向下';
    trendStrength = upside < -20 ? 8 : 6;
  }
  
  const trendSustainability = upside > 20 ? '上涨趋势明显，但需注意短期回调风险' :
                               upside < -15 ? '下行压力较大，反弹需成交量配合' :
                               '趋势不够清晰，建议观望为主';
  
  // Risk level
  const riskLevel = Math.abs(upside) > 30 ? '高' : Math.abs(upside) > 15 ? '中' : '低';
  const volatilityNote = riskLevel === '高' ? '短期波动可能加剧' : 
                         riskLevel === '中' ? '存在一定波动风险' : 
                         '波动相对温和';
  
  // Buy/Sell signal strength (0-10 scale)
  const buySignal = rating === 'BUY' ? (upside > 30 ? 8 : 7) :
                    rating === 'HOLD' ? 5 :
                    upside > 10 ? 6 : 3;
  const sellSignal = rating === 'SELL' ? (upside < -20 ? 8 : 7) :
                     rating === 'HOLD' ? 5 :
                     upside < -10 ? 6 : 3;
  
  // Position recommendation
  let positionAdvice = '观望为主，等待更明确信号';
  if (rating === 'BUY' && upside > 20) {
    positionAdvice = '可适度建仓，分批买入，控制仓位在30%以内';
  } else if (rating === 'BUY') {
    positionAdvice = '轻仓试探，仓位控制在20%以内';
  } else if (rating === 'SELL') {
    positionAdvice = '减仓或止损，避免重仓持有';
  } else if (rating === 'HOLD') {
    positionAdvice = '持仓观望，可在支撑位附近适度补仓';
  }
  
  // Build output
  let output = `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `📊 ${companyName} (${symbol}) 解票分析\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  output += `【📈 I. 趋势识别】\n`;
  output += `• 主要趋势方向：${trendDirection}\n`;
  output += `• 趋势强度评估：${trendStrength}分\n`;
  output += `• 趋势持续性判断：${trendSustainability}\n\n`;
  
  output += `【🎯 II. 关键价格水平】\n`;
  output += `• 重要支撑位：约在 $${support}\n`;
  output += `• 重要阻力位：约在 $${resistance}\n`;
  output += `• 突破/跌破信号：突破 $${resistance} 可能延续涨势，跌破 $${support} 需警惕下行风险\n\n`;
  
  output += `【🔧 III. 技术形态分析】\n`;
  if (hasTrendInfo) {
    output += `• K线形态：${techText.includes('bullish') || techText.includes('上涨') ? '偏多头排列' : techText.includes('bearish') || techText.includes('下跌') ? '偏空头排列' : '震荡整理'}\n`;
    output += `• 图表形态：${techText.includes('consolidation') || techText.includes('整理') ? '横盘整理中' : '无明显特殊形态'}\n`;
    output += `• 缺口分析：暂无明显缺口\n\n`;
  } else {
    output += `• K线形态：暂无明显特征\n`;
    output += `• 图表形态：无明显特殊形态\n`;
    output += `• 缺口分析：暂无明显缺口\n\n`;
  }
  
  output += `【🧮 IV. 技术指标解读】\n`;
  output += `• 均线系统：${trendDirection === '向上' ? '多头排列' : trendDirection === '向下' ? '空头排列' : '粘合状态'}\n`;
  output += `• 布林带位置：${price > resistance ? '接近上轨' : price < support ? '接近下轨' : '中轨附近'}\n`;
  output += `• MACD状态：${rating === 'BUY' ? '金叉向上' : rating === 'SELL' ? '死叉向下' : '震荡横盘'}\n`;
  output += `• 成交量特征：${riskLevel === '高' ? '放量明显' : riskLevel === '中' ? '温和放量' : '成交平淡'}\n\n`;
  
  output += `【💰 V. 交易信号】\n`;
  output += `• 买入信号强度：${buySignal}分\n`;
  output += `• 卖出信号强度：${sellSignal}分\n`;
  output += `• 持仓建议：${positionAdvice}\n\n`;
  
  output += `【⚠️ VI. 风险评估】\n`;
  output += `• 技术面风险等级：${riskLevel}（低/中/高）\n`;
  output += `• 短期波动预期：${volatilityNote}\n`;
  output += `• 止损位建议：$${stopLoss} 下方\n\n`;
  
  output += `请根据市场变化及时调整策略。\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `当前价格：$${price} | 目标价：$${targetPrice} | 评级：${rating}\n`;
  
  // Ensure under 2500 chars
  if (output.length > 2500) {
    output = output.substring(0, 2450) + '\n\n... [内容略]';
  }
  
  return output;
}

/**
 * 🇺🇸 STANDARD ENGLISH FORMAT
 * Mirrors CN structure but with trading voice
 */
function formatTicketStandardEN(report) {
  const symbol = report.symbol || 'N/A';
  const companyName = report.company_name || symbol;
  const price = report.price?.last || 'N/A';
  const rating = report.rating || 'NEUTRAL';
  const targetPrice = report.targets?.base?.price || 'N/A';
  const upside = report.targets?.base?.upside_pct || 'N/A';
  
  const support = report.targets?.support || (price !== 'N/A' ? (price * 0.90).toFixed(2) : 'N/A');
  const resistance = report.targets?.resistance || (price !== 'N/A' ? (price * 1.10).toFixed(2) : 'N/A');
  const stopLoss = report.targets?.stop_loss || (price !== 'N/A' ? (price * 0.85).toFixed(2) : 'N/A');
  
  const techText = report.tech_view_text || '';
  const hasTrendInfo = techText.length > 100;
  
  // Trend assessment
  let trendDirection = 'Sideways';
  let trendStrength = 5;
  if (rating === 'BUY' || upside > 15) {
    trendDirection = 'Upward';
    trendStrength = upside > 30 ? 8 : 7;
  } else if (rating === 'SELL' || upside < -10) {
    trendDirection = 'Downward';
    trendStrength = upside < -20 ? 8 : 6;
  }
  
  const trendSustainability = upside > 20 ? 'The recent uptrend is clear, but short-term pullback risk needs attention' :
                               upside < -15 ? 'Downside pressure is building, bounce needs volume confirmation' :
                               'Trend lacks conviction, recommend wait-and-see';
  
  const riskLevel = Math.abs(upside) > 30 ? 'High' : Math.abs(upside) > 15 ? 'Medium' : 'Low';
  const volatilityNote = riskLevel === 'High' ? 'Expect heightened volatility near term' : 
                         riskLevel === 'Medium' ? 'Moderate choppiness likely' : 
                         'Relatively calm trading expected';
  
  const buySignal = rating === 'BUY' ? (upside > 30 ? 8 : 7) :
                    rating === 'HOLD' ? 5 :
                    upside > 10 ? 6 : 3;
  const sellSignal = rating === 'SELL' ? (upside < -20 ? 8 : 7) :
                     rating === 'HOLD' ? 5 :
                     upside < -10 ? 6 : 3;
  
  let positionAdvice = 'Stay on sidelines, wait for clearer setup';
  if (rating === 'BUY' && upside > 20) {
    positionAdvice = 'Scale in gradually, keep position under 30%';
  } else if (rating === 'BUY') {
    positionAdvice = 'Light starter position, cap at 20%';
  } else if (rating === 'SELL') {
    positionAdvice = 'Trim or cut, avoid heavy exposure';
  } else if (rating === 'HOLD') {
    positionAdvice = 'Hold current position, consider adding near support';
  }
  
  let output = `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `📊 ${companyName} (${symbol}) Ticket Breakdown\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  output += `【📈 I. Trend Identification】\n`;
  output += `• Main Trend Direction: ${trendDirection}\n`;
  output += `• Trend Strength Assessment: ${trendStrength} / 10\n`;
  output += `• Trend Sustainability: ${trendSustainability}\n\n`;
  
  output += `【🎯 II. Key Price Levels】\n`;
  output += `• Key Support: Around $${support}\n`;
  output += `• Key Resistance: Around $${resistance}\n`;
  output += `• Breakout / Breakdown: A break above $${resistance} may extend the move, while a drop below $${support} signals downside risk\n\n`;
  
  output += `【🔧 III. Technical Pattern Analysis】\n`;
  if (hasTrendInfo) {
    output += `• Candlestick Pattern: ${techText.includes('bullish') || techText.includes('上涨') ? 'Bullish formation' : techText.includes('bearish') || techText.includes('下跌') ? 'Bearish setup' : 'Consolidation range'}\n`;
    output += `• Chart Pattern: ${techText.includes('consolidation') || techText.includes('整理') ? 'Sideways consolidation' : 'No clear pattern yet'}\n`;
    output += `• Gap Analysis: No significant gaps\n\n`;
  } else {
    output += `• Candlestick Pattern: No clear signals\n`;
    output += `• Chart Pattern: No notable formation\n`;
    output += `• Gap Analysis: No significant gaps\n\n`;
  }
  
  output += `【🧮 IV. Technical Indicator Summary】\n`;
  output += `• Moving Averages: ${trendDirection === 'Upward' ? 'Bullish alignment' : trendDirection === 'Downward' ? 'Bearish alignment' : 'Converging / choppy'}\n`;
  output += `• Bollinger Bands: ${price > resistance ? 'Near upper band' : price < support ? 'Near lower band' : 'Mid-range'}\n`;
  output += `• MACD Status: ${rating === 'BUY' ? 'Bullish crossover' : rating === 'SELL' ? 'Bearish crossover' : 'Neutral / ranging'}\n`;
  output += `• Volume Profile: ${riskLevel === 'High' ? 'Surging volume' : riskLevel === 'Medium' ? 'Moderate uptick' : 'Light / quiet'}\n\n`;
  
  output += `【💰 V. Trading Signals】\n`;
  output += `• Buy Signal Strength: ${buySignal} / 10\n`;
  output += `• Sell Signal Strength: ${sellSignal} / 10\n`;
  output += `• Position Recommendation: ${positionAdvice}\n\n`;
  
  output += `【⚠️ VI. Risk Assessment】\n`;
  output += `• Technical Risk Level: ${riskLevel} (Low / Medium / High)\n`;
  output += `• Near-term Volatility Outlook: ${volatilityNote}\n`;
  output += `• Suggested Stop Loss: Below $${stopLoss}\n\n`;
  
  output += `Adjust strategy as market conditions evolve.\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `Current: $${price} | Target: $${targetPrice} | Rating: ${rating}\n`;
  
  if (output.length > 2500) {
    output = output.substring(0, 2450) + '\n\n... [Truncated]';
  }
  
  return output;
}

/**
 * 🗣️ HUMAN VOICE FORMAT (Natural Trader Talk)
 * Like an experienced trader chatting with friends, NOT an AI report
 */
async function formatTicketHuman(report, options = {}) {
  const language = options.language || 'zh';
  const symbol = report.symbol || 'N/A';
  const companyName = report.company_name || symbol;
  const price = report.price?.last || 'N/A';
  const rating = report.rating || 'NEUTRAL';
  const targetPrice = report.targets?.base?.price || 'N/A';
  const upside = report.targets?.base?.upside_pct || 'N/A';
  const support = report.targets?.support || (price !== 'N/A' ? (price * 0.90).toFixed(2) : 'N/A');
  const resistance = report.targets?.resistance || (price !== 'N/A' ? (price * 1.10).toFixed(2) : 'N/A');
  
  // Extract summary and risks for context
  const summary = report.summary_text || report.investment_thesis?.substring(0, 300) || '';
  const risks = Array.isArray(report.risks_text) ? report.risks_text.slice(0, 3).join('; ') : '';
  
  if (language === 'zh') {
    // Chinese human voice
    let output = `🧩 解票速览 (${symbol})\n\n`;
    
    // 1) 现在这票的感觉
    output += `1️⃣ 现在这票的感觉\n`;
    if (rating === 'BUY' && upside > 20) {
      output += `整体还是偏多头，但位置不算便宜了，短线追进去容易被来回洗，节奏上要稍微保守一点。`;
    } else if (rating === 'BUY') {
      output += `有点上行苗头，但力度还不够强，现在进场需要点耐心，别指望立刻就拉。`;
    } else if (rating === 'SELL') {
      output += `这票现在有点虚，技术面偏弱，多头信心不足，空仓的话不建议乱碰。`;
    } else {
      output += `这票现在比较纠结，多空双方都在犹豫，没有明确方向，观望更安全。`;
    }
    output += `\n\n`;
    
    // 2) 我会盯的价位
    output += `2️⃣ 我会盯的价位\n`;
    output += `上面先看大概 $${resistance} 一带，有效放量突破再考虑加码；`;
    output += `下面 $${support} 附近是比较关键的防守位，跌破就当这波行情告一段落。`;
    output += `\n\n`;
    
    // 3) 操作思路
    output += `3️⃣ 操作思路\n`;
    if (rating === 'BUY' && upside > 20) {
      output += `现在不算那种"闭眼梭哈"的价位，更适合已经在车上的人做止盈/减仓的计划；空仓的话，等回踩或者突破后的回踩，会舒服很多。`;
    } else if (rating === 'BUY') {
      output += `可以轻仓试探，但别一次性重仓，分批进比较稳妥。万一拉不起来，至少不会被套太深。`;
    } else if (rating === 'SELL') {
      output += `这种位置建议少动，真要玩就做个反弹交易，快进快出，别恋战。`;
    } else {
      output += `现在这个位置，观望是最省心的选择。要么等跌到支撑位抄底，要么等突破阻力位追涨。`;
    }
    output += `\n\n`;
    
    // 4) 需要留意的风险
    output += `4️⃣ 需要留意的风险\n`;
    if (risks) {
      output += `${risks.substring(0, 150)}... 仓位别太重，留点子弹，别一脚踩满。`;
    } else {
      output += `这只票成交量放出来了，消息面一刺激，波动会比较大；仓位别太重，留点子弹，别一脚踩满。`;
    }
    output += `\n\n`;
    
    output += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    output += `市场随时会变，这只是基于当前盘面的想法。\n`;
    output += `现价: $${price} | 目标: $${targetPrice} | 评级: ${rating}\n`;
    
    if (output.length > 2500) {
      output = output.substring(0, 2450) + '\n\n...';
    }
    
    return output;
    
  } else {
    // English human voice
    let output = `🧩 Quick Take (${symbol})\n\n`;
    
    output += `1️⃣ What I'm seeing right now\n`;
    if (rating === 'BUY' && upside > 20) {
      output += `Still leaning bullish overall, but the easy money's probably gone. Chasing here feels risky—could get shaken out in a pullback.`;
    } else if (rating === 'BUY') {
      output += `There's some upside potential, but it's not screaming BUY. You'll need patience if you get in now—don't expect instant fireworks.`;
    } else if (rating === 'SELL') {
      output += `This one's looking shaky. Bulls are losing conviction. I'd stay away if you're sitting in cash.`;
    } else {
      output += `Stuck in no-man's land right now. Bulls and bears are both hesitant. Safer to watch from the sidelines.`;
    }
    output += `\n\n`;
    
    output += `2️⃣ Levels I'm watching\n`;
    output += `Upside: Keep an eye on $${resistance}—break above that on volume, and we might see an extension. `;
    output += `Downside: $${support} is the line in the sand. Break that, and this rally's probably done.`;
    output += `\n\n`;
    
    output += `3️⃣ Game plan\n`;
    if (rating === 'BUY' && upside > 20) {
      output += `Not exactly a "back up the truck" spot. Better for folks already in to lock profits or trim. If you're in cash, wait for a dip or a confirmed breakout pullback.`;
    } else if (rating === 'BUY') {
      output += `Maybe start a small position, but don't go all-in. Scale in gradually—if it doesn't work, at least you won't be buried.`;
    } else if (rating === 'SELL') {
      output += `I'd stay light here. If you want to trade it, treat it as a bounce play—get in, get out, don't overstay.`;
    } else {
      output += `Easiest move is to sit tight. Either wait for support to buy the dip, or wait for resistance to break and chase momentum.`;
    }
    output += `\n\n`;
    
    output += `4️⃣ Risks to keep in mind\n`;
    if (risks) {
      output += `${risks.substring(0, 150)}... Don't size this too big—leave some dry powder for better spots.`;
    } else {
      output += `Volume's picking up, so headline risk is real. Any news jolt could whipsaw this thing. Keep your position manageable.`;
    }
    output += `\n\n`;
    
    output += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    output += `Markets change fast—this is just what I'm seeing right now.\n`;
    output += `Current: $${price} | Target: $${targetPrice} | Rating: ${rating}\n`;
    
    if (output.length > 2500) {
      output = output.substring(0, 2450) + '\n\n...';
    }
    
    return output;
  }
}

/**
 * MAIN ORCHESTRATOR - Returns array of formatted messages based on mode
 * @param {object} report - Full report object
 * @param {object} formatOptions - { mode, bilingual_split, primary_lang }
 * @returns {Array<string>} Array of formatted message strings
 */
async function formatTicket(report, formatOptions = {}) {
  const {
    mode = 'standard',
    bilingual_split = false,
    primary_lang = 'zh'
  } = formatOptions;
  
  console.log(`\n📝 [TicketFormatter] Mode: ${mode}, Bilingual: ${bilingual_split}, Lang: ${primary_lang}`);
  
  const messages = [];
  
  if (mode === 'standard') {
    if (bilingual_split) {
      // Return both CN and EN
      const cnText = formatTicketStandardCN(report);
      const enText = formatTicketStandardEN(report);
      messages.push(cnText);
      messages.push(enText);
    } else {
      // Return single language
      if (primary_lang === 'zh') {
        messages.push(formatTicketStandardCN(report));
      } else {
        messages.push(formatTicketStandardEN(report));
      }
    }
  } else if (mode === 'human') {
    // Human voice only
    const humanText = await formatTicketHuman(report, { language: primary_lang });
    messages.push(humanText);
  } else if (mode === 'standard_plus_human') {
    if (bilingual_split) {
      // CN standard + EN standard + ZH human
      messages.push(formatTicketStandardCN(report));
      messages.push(formatTicketStandardEN(report));
      messages.push(await formatTicketHuman(report, { language: 'zh' }));
    } else {
      // Single lang standard + human
      if (primary_lang === 'zh') {
        messages.push(formatTicketStandardCN(report));
      } else {
        messages.push(formatTicketStandardEN(report));
      }
      messages.push(await formatTicketHuman(report, { language: primary_lang }));
    }
  }
  
  console.log(`   └─ Generated ${messages.length} message(s)`);
  return messages;
}

module.exports = {
  formatTicket,
  formatTicketStandardCN,
  formatTicketStandardEN,
  formatTicketHuman
};
