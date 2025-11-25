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

/**
 * 解票主处理函数
 * @param {Array} args - 用户输入参数 [symbol, mode]
 * @param {number} chatId - Telegram 聊天室 ID
 * @param {Object} bot - Telegram Bot 实例
 * @param {Object} message - 原始 Telegram 消息对象
 * @returns {Promise<Object>} 解票结果对象
 */
async function handleTicket(args, chatId, bot, message) {
  const startTime = Date.now();
  let statusMsg = null;
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🎯 [TICKET] Ticket analysis request`);
  console.log(`   ├─ Args: [${args.join(', ')}]`);
  console.log(`   ├─ Chat ID: ${chatId}`);
  console.log(`   └─ User: ${message.from?.username || 'unknown'}`);
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
    
    const { symbol, mode } = parseResult;
    
    console.log(`✅ [TICKET] Parsed arguments:`);
    console.log(`   ├─ Symbol: ${symbol}`);
    console.log(`   └─ Mode: ${mode}\n`);
    
    // ═══ STEP 2: 发送初始状态消息 ═══
    try {
      statusMsg = await bot.sendMessage(chatId, 
        `🎯 正在解票 ${symbol}\n\n` +
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
