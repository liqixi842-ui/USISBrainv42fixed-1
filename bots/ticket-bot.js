/**
 * ═══════════════════════════════════════════════════════════════
 * USIS Brain v7.0 - Ticket Bot (解票机器人)
 * ═══════════════════════════════════════════════════════════════
 * 
 * 职责：专门处理"解票分析"功能
 * - 快速技术分析（30-60秒响应）
 * - TradingView K线图截图
 * - AI技术面分析
 * - 支持多语言输出（中文/英文/人话版）
 * 
 * 核心流程：
 * 1. 规范化股票代码
 * 2. 生成K线图 + AI分析（generateStockChart）
 * 3. 格式化输出（lightweightFormatter）
 * 4. 发送图片 + 文字到Telegram
 */

const { generateStockChart } = require('../stockChartService');
const lightweightFormatter = require('../v3_dev/services/lightweightTicketFormatter');
const dataBroker = require('../dataBroker');
const { STATIC_SYMBOL_MAP, lookupSymbol, lookupSymbolFromTwelveData, selectBestMatch } = require('../symbolResolver');

/**
 * 🆕 智能符号解析 - 支持中文公司名、英文名、股票代码 + 交易所提示
 * 优先级：静态映射 → API查询（带交易所提示）→ 原样返回
 * @param {string} input - 用户输入（如 "英伟达", "nvidia", "NVDA"）
 * @param {string|null} exchangeHint - 交易所提示（如 "Spain", "HK", "US"）
 * @returns {Promise<{symbol: string, resolved: boolean, source: string, exchange?: string}>}
 */
async function resolveTicketSymbol(input, exchangeHint = null) {
  const normalized = input.toLowerCase().trim();
  const upper = input.toUpperCase().trim();
  
  console.log(`🔍 [TICKET Symbol Resolver] 解析输入: "${input}" (交易所提示: ${exchangeHint || '无'})`);
  
  // 🆕 如果有交易所提示，跳过静态映射，直接用 API 查询以获取正确的交易所符号
  if (exchangeHint) {
    console.log(`   🌍 [优先API] 检测到交易所提示 "${exchangeHint}"，跳过静态映射`);
    
    try {
      // 🔥 使用 Twelve Data（全球覆盖最广，推荐用于非美股）
      const TWELVE_DATA_KEY = process.env.TWELVE_DATA_API_KEY;
      if (TWELVE_DATA_KEY) {
        const results = await lookupSymbolFromTwelveData(input, exchangeHint);
        if (results && results.length > 0) {
          const best = selectBestMatch(results, exchangeHint, input);
          // 保留交易所后缀（如 COL.MC 表示西班牙）
          const finalSymbol = best.symbol;
          console.log(`   ✅ [Twelve Data + 交易所] ${input} → ${finalSymbol} (${best.exchange || best.description})`);
          return { symbol: finalSymbol, resolved: true, source: 'twelvedata_exchange', exchange: best.exchange };
        }
      }
      
      // 备用：Finnhub（美股和部分国际股票）
      const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
      if (FINNHUB_KEY) {
        const results = await lookupSymbol(input, exchangeHint);
        if (results && results.length > 0) {
          const best = selectBestMatch(results, exchangeHint, input);
          const finalSymbol = best.symbol;
          console.log(`   ✅ [Finnhub + 交易所] ${input} → ${finalSymbol}`);
          return { symbol: finalSymbol, resolved: true, source: 'finnhub_exchange', exchange: best.exchange };
        }
      }
    } catch (apiError) {
      console.warn(`   ⚠️  [API查询失败] ${apiError.message}`);
    }
  }
  
  // Layer 1: 静态映射精确匹配（最快）- 仅当无交易所提示时
  if (STATIC_SYMBOL_MAP[normalized]) {
    const resolved = STATIC_SYMBOL_MAP[normalized];
    console.log(`   ✅ [静态映射] ${input} → ${resolved}`);
    return { symbol: resolved, resolved: true, source: 'static_exact' };
  }
  
  // Layer 2: 静态映射部分匹配（支持 "苹果公司" → "苹果" → AAPL）
  for (const [key, symbol] of Object.entries(STATIC_SYMBOL_MAP)) {
    if ((key.includes(normalized) || normalized.includes(key)) && key.length >= 2 && normalized.length >= 2) {
      console.log(`   ✅ [静态映射-模糊] ${input} → ${symbol} (via ${key})`);
      return { symbol, resolved: true, source: 'static_fuzzy' };
    }
  }
  
  // Layer 3: 检查是否已经是有效的股票代码格式（纯英文+数字，1-10字符）
  const isLikelyTicker = /^[A-Z0-9.:]{1,10}$/i.test(input.trim());
  if (isLikelyTicker && !exchangeHint) {
    console.log(`   📈 [直接使用] ${upper} (看起来像股票代码)`);
    return { symbol: upper, resolved: false, source: 'passthrough' };
  }
  
  // Layer 4: API 查询（对于未知的公司名）
  try {
    console.log(`   🌐 [API查询] 尝试查找: ${input}`);
    
    // 尝试 Finnhub（优先，对英文名支持较好）
    const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
    if (FINNHUB_KEY) {
      const results = await lookupSymbol(input, exchangeHint);
      if (results && results.length > 0) {
        const best = selectBestMatch(results, exchangeHint, input);
        // 清理前缀（如 COMMON STOCK:AAPL → AAPL）
        const cleanSymbol = best.symbol.includes(':') ? best.symbol.split(':').pop() : best.symbol;
        console.log(`   ✅ [Finnhub] ${input} → ${cleanSymbol}`);
        return { symbol: cleanSymbol, resolved: true, source: 'finnhub' };
      }
    }
    
    // 尝试 Twelve Data（备用，全球覆盖更广）
    const TWELVE_DATA_KEY = process.env.TWELVE_DATA_API_KEY;
    if (TWELVE_DATA_KEY) {
      const results = await lookupSymbolFromTwelveData(input, exchangeHint);
      if (results && results.length > 0) {
        const best = selectBestMatch(results, exchangeHint, input);
        // 清理前缀（如 NASDAQ:AAPL → AAPL）
        const cleanSymbol = best.symbol.includes(':') ? best.symbol.split(':').pop() : best.symbol;
        console.log(`   ✅ [Twelve Data] ${input} → ${cleanSymbol}`);
        return { symbol: cleanSymbol, resolved: true, source: 'twelvedata' };
      }
    }
  } catch (apiError) {
    console.warn(`   ⚠️  [API查询失败] ${apiError.message}`);
  }
  
  // Layer 5: 最终回退 - 使用原始输入（大写）
  console.log(`   ⚠️  [回退] 无法解析，使用原始输入: ${upper}`);
  return { symbol: upper, resolved: false, source: 'fallback' };
}

/**
 * 解票主处理函数
 * @param {Array} args - 用户输入参数 [symbol, mode]
 * @param {number} chatId - Telegram 聊天室 ID
 * @param {Object} bot - Telegram Bot 实例
 * @param {Object} message - 原始 Telegram 消息对象
 * @param {Object} options - 可选参数 { exchangeHint: string }
 * @returns {Promise<Object>} 解票结果对象
 */
async function handleTicket(args, chatId, bot, message, options = {}) {
  const startTime = Date.now();
  let statusMsg = null;
  const exchangeHint = options.exchangeHint || null;
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🎯 [TICKET] Ticket analysis request`);
  console.log(`   ├─ Args: [${args.join(', ')}]`);
  console.log(`   ├─ Chat ID: ${chatId}`);
  console.log(`   ├─ User: ${message.from?.username || 'unknown'}`);
  console.log(`   └─ 🌍 Exchange Hint: ${exchangeHint || '(none - default to US)'}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  try {
    // ═══ STEP 1: 参数解析 ═══
    const parseResult = parseTicketArgs(args);
    
    if (!parseResult.valid) {
      console.log(`❌ [TICKET] Invalid arguments: ${parseResult.error}`);
      await sendErrorMessage(bot, chatId, parseResult.error);
      return {
        type: 'ticket_error',
        error: parseResult.error
      };
    }
    
    const { symbol: rawSymbol, mode } = parseResult;
    
    console.log(`✅ [TICKET] Parsed arguments:`);
    console.log(`   ├─ Raw Symbol: ${rawSymbol}`);
    console.log(`   ├─ Mode: ${mode}`);
    console.log(`   └─ Exchange: ${exchangeHint || 'auto-detect'}\n`);
    
    // ═══ STEP 1.5: 🆕 智能符号解析（中文公司名 → 股票代码 + 交易所）═══
    const resolveResult = await resolveTicketSymbol(rawSymbol, exchangeHint);
    const symbol = resolveResult.symbol;
    
    if (resolveResult.resolved) {
      console.log(`🎯 [TICKET] Symbol resolved: ${rawSymbol} → ${symbol} (via ${resolveResult.source})`);
    } else {
      console.log(`📈 [TICKET] Using symbol as-is: ${symbol}`);
    }
    
    // ═══ STEP 2: 发送初始状态消息 ═══
    const displayName = resolveResult.resolved ? `${rawSymbol} (${symbol})` : symbol;
    try {
      statusMsg = await bot.sendMessage(chatId, 
        `🎯 正在解票 ${displayName}\n\n` +
        `⏳ 正在生成图表和技术分析...\n\n` +
        `(预计 30-60 秒)`
      );
    } catch (sendError) {
      console.error(`⚠️  [TICKET] Failed to send status message: ${sendError.message}`);
    }
    
    // ═══ STEP 3: 生成股票图表 + AI分析 ═══
    console.log(`📊 [TICKET] Calling generateStockChart for ${symbol}...`);
    const chartStartTime = Date.now();
    
    let chartResult;
    try {
      chartResult = await generateStockChart(symbol, {
        includeVisionAnalysis: true,
        chartStyle: '1'  // Candlestick chart
      });
    } catch (chartError) {
      console.error(`❌ [TICKET] Chart generation failed: ${chartError.message}`);
      // Fallback: 使用基础数据分析
      chartResult = await generateFallbackAnalysis(symbol);
    }
    
    const chartDuration = Date.now() - chartStartTime;
    
    console.log(`✅ [TICKET] Chart generation completed in ${chartDuration} ms`);
    console.log(`   ├─ Has chart URL: ${!!chartResult.chartUrl}`);
    console.log(`   ├─ Has analysis: ${!!chartResult.analysis}`);
    console.log(`   └─ Fallback mode: ${chartResult.fallback || false}\n`);
    
    // ═══ STEP 4: 更新状态消息 ═══
    if (statusMsg) {
      try {
        await bot.editMessageText(
          `🎯 正在解票 ${symbol}\n\n` +
          `✅ 图表生成完成\n` +
          `⏳ 正在格式化输出...`,
          {
            chat_id: chatId,
            message_id: statusMsg.message_id
          }
        );
      } catch (editError) {
        console.error(`⚠️  [TICKET] Failed to update status: ${editError.message}`);
      }
    }
    
    // ═══ STEP 5: 删除状态消息 ═══
    if (statusMsg) {
      try {
        await bot.deleteMessage(chatId, statusMsg.message_id);
      } catch (deleteError) {
        console.error(`⚠️  [TICKET] Failed to delete status: ${deleteError.message}`);
      }
    }
    
    // ═══ STEP 6: 发送图表截图 ═══
    let chartSent = false;
    const chartCaption = chartResult.caption || `📈 ${symbol} 技术图表`;
    
    if (chartResult.buffer) {
      console.log(`📊 [TICKET] Sending chart screenshot (Buffer mode)...`);
      try {
        await bot.sendPhoto(chatId, chartResult.buffer, {
          caption: chartCaption
        });
        console.log(`✅ [TICKET] Chart sent successfully (Buffer)`);
        chartSent = true;
      } catch (photoError) {
        console.error(`⚠️  [TICKET] Chart send failed (Buffer): ${photoError.message}`);
      }
    } else if (chartResult.imageBase64) {
      console.log(`📊 [TICKET] Sending chart screenshot (Base64 mode)...`);
      try {
        const photoBuffer = Buffer.from(chartResult.imageBase64, 'base64');
        await bot.sendPhoto(chatId, photoBuffer, {
          caption: chartCaption
        });
        console.log(`✅ [TICKET] Chart sent successfully (Base64)`);
        chartSent = true;
      } catch (photoError) {
        console.error(`⚠️  [TICKET] Chart send failed (Base64): ${photoError.message}`);
      }
    } else if (chartResult.chartUrl) {
      console.log(`📊 [TICKET] Sending chart screenshot (URL mode)...`);
      try {
        await bot.sendPhoto(chatId, chartResult.chartUrl, {
          caption: chartCaption
        });
        console.log(`✅ [TICKET] Chart sent successfully (URL)`);
        chartSent = true;
      } catch (photoError) {
        console.error(`⚠️  [TICKET] Chart send failed (URL): ${photoError.message}`);
      }
    } else {
      console.log(`⚠️  [TICKET] No chart data available (no buffer/base64/url), skipping chart send`);
    }
    
    if (!chartSent) {
      console.log(`⚠️  [TICKET] Chart was not sent to user`);
    }
    
    // ═══ STEP 7: 格式化文字分析 ═══
    const ticketData = {
      symbol: chartResult.symbol || symbol,
      analysis: chartResult.analysis || '',
      price: chartResult.price,
      change: chartResult.change,
      changePercent: chartResult.changePercent
    };
    
    const messages = formatTicketMessages(ticketData, mode);
    
    console.log(`✅ [TICKET] Generated ${messages.length} message(s)`);
    
    // ═══ STEP 8: 发送文字分析 ═══
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      console.log(`📤 [TICKET] Sending message ${i + 1}/${messages.length} (${msg.length} chars)`);
      
      try {
        await bot.sendMessage(chatId, msg);
        
        // Rate limit protection
        if (i < messages.length - 1) {
          await sleep(800);
        }
      } catch (sendError) {
        console.error(`❌ [TICKET] Failed to send message ${i + 1}: ${sendError.message}`);
      }
    }
    
    // ═══ STEP 9: 记录完成 ═══
    const totalDuration = Date.now() - startTime;
    
    console.log(`\n✅ [TICKET] Ticket analysis completed in ${totalDuration} ms`);
    console.log(`   ├─ Symbol: ${symbol}`);
    console.log(`   ├─ Mode: ${mode}`);
    console.log(`   ├─ Chart generation: ${chartDuration} ms`);
    console.log(`   ├─ Messages sent: ${messages.length}`);
    console.log(`   └─ Total time: ${totalDuration} ms`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    return {
      type: 'ticket_result',
      symbol: symbol,
      chartUrl: chartResult.chartUrl,
      aiText: chartResult.analysis,
      sentiment: chartResult.sentiment || null,
      quote: {
        price: chartResult.price,
        change: chartResult.change,
        changePercent: chartResult.changePercent
      },
      duration: totalDuration,
      success: true
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error(`\n❌ [TICKET] ERROR after ${duration} ms`);
    console.error(`   ├─ Error type: ${error.name || 'Error'}`);
    console.error(`   ├─ Error message: ${error.message}`);
    console.error(`   └─ Stack trace:`);
    console.error(error.stack);
    console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    // Delete status message if exists
    if (statusMsg) {
      try {
        await bot.deleteMessage(chatId, statusMsg.message_id);
      } catch (deleteError) {
        // Ignore
      }
    }
    
    // Send fallback error message
    try {
      await sendFallbackMessage(bot, chatId, args[0] || 'unknown', error.message);
    } catch (fallbackError) {
      console.error(`❌ [TICKET] Fallback message failed: ${fallbackError.message}`);
    }
    
    // Return error result (不抛出异常，避免 ManagerBot 崩溃)
    return {
      type: 'ticket_error',
      symbol: args[0] || 'unknown',
      error: error.message,
      duration: duration,
      success: false
    };
  }
}

/**
 * 解析解票命令参数
 * @param {Array} args - 用户输入参数
 * @returns {Object} { valid: boolean, symbol: string, mode: string, error: string }
 */
function parseTicketArgs(args) {
  if (!args || args.length === 0) {
    return {
      valid: false,
      error: '❌ 解票命令格式错误\n\n' +
             '**正确格式：**\n' +
             '解票 股票代码 [模式]\n\n' +
             '**示例：**\n' +
             '• 解票 NVDA（标准中文版）\n' +
             '• 解票 NVDA 双语（中文+英文）\n' +
             '• 解票 NVDA 聊天版（人话版）\n' +
             '• 解票 NVDA 完整版（所有格式）'
    };
  }
  
  const symbol = args[0].toUpperCase().trim();
  const mode = args[1] ? args[1].trim() : '标准版';
  
  // Validate symbol
  if (!symbol || symbol.length === 0) {
    return {
      valid: false,
      error: '❌ 股票代码不能为空'
    };
  }
  
  // Normalize mode
  let normalizedMode = mode;
  if (mode === '聊天版' || mode === '人话版') {
    normalizedMode = '聊天版';
  } else if (mode === '双语') {
    normalizedMode = '双语';
  } else if (mode === '完整版') {
    normalizedMode = '完整版';
  } else {
    normalizedMode = '标准版';
  }
  
  return {
    valid: true,
    symbol: symbol,
    mode: normalizedMode
  };
}

/**
 * 格式化解票消息（根据模式）
 * @param {Object} ticketData - 解票数据
 * @param {string} mode - 输出模式
 * @returns {Array<string>} 消息数组
 */
function formatTicketMessages(ticketData, mode) {
  const messages = [];
  
  if (mode === '双语') {
    // Bilingual: CN + EN
    messages.push(lightweightFormatter.formatTicketStandardCN(ticketData));
    messages.push(lightweightFormatter.formatTicketStandardEN(ticketData));
  } else if (mode === '聊天版') {
    // Human voice (CN)
    messages.push(lightweightFormatter.formatTicketHumanCN(ticketData));
  } else if (mode === '完整版') {
    // Complete: CN + EN + Human
    messages.push(lightweightFormatter.formatTicketStandardCN(ticketData));
    messages.push(lightweightFormatter.formatTicketStandardEN(ticketData));
    messages.push(lightweightFormatter.formatTicketHumanCN(ticketData));
  } else {
    // Default: Standard CN only
    messages.push(lightweightFormatter.formatTicketStandardCN(ticketData));
  }
  
  return messages;
}

/**
 * 生成降级分析（当图表生成失败时）
 * @param {string} symbol - 股票代码
 * @returns {Promise<Object>} 降级分析结果
 */
async function generateFallbackAnalysis(symbol) {
  console.log(`🔄 [TICKET] Generating fallback analysis for ${symbol}...`);
  
  try {
    // 尝试获取基础行情数据
    const marketData = await dataBroker.fetchMarketData([symbol]);
    const quote = marketData.quotes ? marketData.quotes[symbol] : null;
    
    return {
      symbol: symbol,
      chartUrl: null,
      analysis: `系统繁忙，已切换至保底分析模式。\n\n` +
                `当前价格: ${quote?.currentPrice ? '$' + quote.currentPrice.toFixed(2) : 'N/A'}\n` +
                `涨跌幅: ${quote?.changePercent ? quote.changePercent.toFixed(2) + '%' : 'N/A'}\n\n` +
                `技术分析暂时不可用，请稍后重试完整分析。`,
      price: quote?.currentPrice,
      change: quote?.change,
      changePercent: quote?.changePercent,
      fallback: true,
      sentiment: null
    };
  } catch (fallbackError) {
    console.error(`❌ [TICKET] Fallback analysis failed: ${fallbackError.message}`);
    
    return {
      symbol: symbol,
      chartUrl: null,
      analysis: `系统繁忙，无法获取 ${symbol} 的数据。\n\n` +
                `请稍后重试或检查股票代码是否正确。`,
      price: null,
      change: null,
      changePercent: null,
      fallback: true,
      sentiment: null
    };
  }
}

/**
 * 发送错误消息
 * @param {Object} bot - Telegram Bot 实例
 * @param {number} chatId - 聊天室 ID
 * @param {string} errorText - 错误文本
 */
async function sendErrorMessage(bot, chatId, errorText) {
  try {
    await bot.sendMessage(chatId, errorText);
  } catch (error) {
    console.error(`❌ [TICKET] Failed to send error message: ${error.message}`);
  }
}

/**
 * 发送降级消息（当所有步骤都失败时）
 * @param {Object} bot - Telegram Bot 实例
 * @param {number} chatId - 聊天室 ID
 * @param {string} symbol - 股票代码
 * @param {string} errorMsg - 错误信息
 */
async function sendFallbackMessage(bot, chatId, symbol, errorMsg) {
  const fallbackText = 
    `❌ 解票失败\n\n` +
    `标的: ${symbol}\n\n` +
    `原因: ${errorMsg}\n\n` +
    `建议：\n` +
    `• 检查股票代码是否正确\n` +
    `• 稍后重试\n` +
    `• 如问题持续，请联系管理员\n\n` +
    `(v7-dev 解票功能 - 轻量级模式)`;
  
  try {
    await bot.sendMessage(chatId, fallbackText);
  } catch (error) {
    console.error(`❌ [TICKET] Failed to send fallback message: ${error.message}`);
  }
}

/**
 * 睡眠函数（用于速率限制）
 * @param {number} ms - 毫秒数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 默认导出
 */
module.exports = {
  handleTicket
};
