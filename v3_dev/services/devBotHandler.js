// v3-dev Development Bot Message Handler
// This handles all messages for the development bot (TELEGRAM_BOT_TOKEN_DEV)

const fetch = require('node-fetch');
const { buildSimpleReport } = require('./reportService');

const VALID_COMMANDS = ['/test', '/status', '/v3', '/help', '/report'];

async function handleDevBotMessage(message, telegramAPI) {
  const chatId = message.chat.id;
  const text = (message.text || '').trim();
  const userId = message.from.id;
  
  console.log(`\n🔧 [DEV_BOT] Message from ${userId}: "${text}"`);
  
  try {
    // /test command
    if (text === '/test') {
      await telegramAPI('sendMessage', {
        chat_id: chatId,
        text: '✅ v3-dev Bot is working!\n\nVersion: v3-dev\nEnvironment: Development\nIsolation: Active',
        parse_mode: 'Markdown'
      });
      return;
    }
    
    // /status command
    if (text === '/status') {
      const status = `🚧 **v3-dev Development Bot Status**

📍 Version: v3-dev
🏷️ Tag: dev_bot
🔗 Token: TELEGRAM_BOT_TOKEN_DEV
⏱ Uptime: ${Math.floor(process.uptime())}s

**Features:**
• Research report system (in development)
• Isolated from v2-stable production
• Independent message handling

**Available Commands:**
/test - Test bot connectivity
/status - Show this status
/v3 - v3-dev information
/help - Show help`;
      
      await telegramAPI('sendMessage', {
        chat_id: chatId,
        text: status,
        parse_mode: 'Markdown'
      });
      return;
    }
    
    // /v3 command
    if (text === '/v3') {
      await telegramAPI('sendMessage', {
        chat_id: chatId,
        text: '🔬 v3-dev Development Environment\n\nThis bot is for testing new features before production.\n\nCurrent focus: Research report system',
        parse_mode: 'Markdown'
      });
      return;
    }
    
    // /help command
    if (text === '/help') {
      await telegramAPI('sendMessage', {
        chat_id: chatId,
        text: '📚 v3-dev Bot Help\n\n/test - Test connectivity\n/status - Bot status\n/v3 - v3-dev info\n/report [SYMBOL] - Generate research report (v1 test)\n/help - This message',
        parse_mode: 'Markdown'
      });
      return;
    }
    
    // /report command - 生成并发送 PDF 研报
    if (text.startsWith('/report')) {
      const parts = text.split(' ');
      
      // Check if symbol is provided
      if (parts.length < 2 || !parts[1].trim()) {
        await telegramAPI('sendMessage', {
          chat_id: chatId,
          text: '📊 请提供股票代码\n\n格式：/report AAPL\n\n示例：\n/report AAPL\n/report TSLA\n/report NVDA\n\n将生成完整 PDF 研报发送给您。',
          parse_mode: 'Markdown'
        });
        return;
      }
      
      const symbol = parts[1].trim().toUpperCase();
      
      try {
        // Send "generating" message
        const statusMsg = await telegramAPI('sendMessage', {
          chat_id: chatId,
          text: `🔬 正在生成 ${symbol} 研报 PDF（v3-dev）...\n\n⏳ 步骤 1/3：获取市场数据...`,
          parse_mode: 'Markdown'
        });
        
        // Step 1: Get report data (JSON)
        const reportJsonUrl = `http://localhost:3000/v3/report/${symbol}?format=json`;
        console.log(`📡 [DEV_BOT] Fetching report data: ${reportJsonUrl}`);
        
        const jsonResponse = await fetch(reportJsonUrl, { timeout: 20000 });
        
        if (!jsonResponse.ok) {
          throw new Error(`Report API responded with ${jsonResponse.status}`);
        }
        
        const reportData = await jsonResponse.json();
        
        if (!reportData.ok || !reportData.report) {
          throw new Error('Invalid report data');
        }
        
        const report = reportData.report;
        
        // Update status
        await telegramAPI('editMessageText', {
          chat_id: chatId,
          message_id: statusMsg.result.message_id,
          text: `🔬 正在生成 ${symbol} 研报 PDF（v3-dev）...\n\n✅ 步骤 1/3：市场数据获取完成\n⏳ 步骤 2/3：调用外部 PDF 生成服务...`,
          parse_mode: 'Markdown'
        });
        
        // Step 2: Try PDF first, fallback to Markdown if unavailable
        let reportSent = false;
        
        try {
          const pdfUrl = `http://localhost:3000/v3/report/${symbol}?format=pdf`;
          console.log(`📄 [DEV_BOT] Attempting PDF generation: ${pdfUrl}`);
          
          const pdfResponse = await fetch(pdfUrl, { timeout: 45000 });
          
          // ========== 诊断日志 1: 响应状态 ==========
          console.log(`🌐 [DEV_BOT] External PDF service response status: ${pdfResponse.status}`);
          console.log(`🌐 [DEV_BOT] External PDF service headers:`, JSON.stringify({
            'content-type': pdfResponse.headers.get('content-type'),
            'content-length': pdfResponse.headers.get('content-length'),
            'content-disposition': pdfResponse.headers.get('content-disposition')
          }));
          
          if (pdfResponse.ok) {
            const pdfBuffer = await pdfResponse.buffer();
            
            // ========== 诊断日志 2: PDF Buffer 信息 ==========
            console.log(`📦 [DEV_BOT] PDF Buffer Size: ${pdfBuffer?.length || 'undefined'} bytes`);
            console.log(`📦 [DEV_BOT] PDF Buffer type: ${typeof pdfBuffer}`);
            console.log(`📦 [DEV_BOT] PDF Buffer is Buffer: ${Buffer.isBuffer(pdfBuffer)}`);
            
            if (!pdfBuffer || pdfBuffer.length === 0) {
              throw new Error('PDF buffer is empty or undefined');
            }
            
            await telegramAPI('editMessageText', {
              chat_id: chatId,
              message_id: statusMsg.result.message_id,
              text: `🔬 正在生成 ${symbol} 研报 PDF（v3-dev）...\n\n✅ 步骤 1/3：市场数据获取完成\n✅ 步骤 2/3：PDF 生成完成 (${(pdfBuffer.length / 1024).toFixed(1)} KB)\n⏳ 步骤 3/3：正在发送...`,
              parse_mode: 'Markdown'
            });
            
            const ratingEmoji = {
              'STRONG_BUY': '🟢🟢',
              'BUY': '🟢',
              'HOLD': '🟡',
              'SELL': '🔴',
              'STRONG_SELL': '🔴🔴'
            }[report.rating] || '⚪';
            
            const caption = `📊 **${symbol} 研究报告**（v3-dev）\n\n${ratingEmoji} 评级：**${report.rating}**\n⏱ 生成时间：${report.latency_ms}ms\n🤖 AI：${report.model_used}\n\n详细内容请查看附件 PDF。`;
            
            // ========== 诊断日志 3: 发送前确认 ==========
            console.log(`📤 [DEV_BOT] Preparing to send PDF document...`);
            console.log(`📤 [DEV_BOT] Chat ID: ${chatId}`);
            console.log(`📤 [DEV_BOT] Filename: ${symbol}_Report_USIS_v3dev.pdf`);
            console.log(`📤 [DEV_BOT] Caption length: ${caption.length}`);
            
            try {
              await telegramAPI('sendDocument', {
                chat_id: chatId,
                document: pdfBuffer,
                filename: `${symbol}_Report_USIS_v3dev.pdf`,
                caption: caption,
                parse_mode: 'Markdown'
              });
              
              console.log(`✅ [DEV_BOT] sendDocument API call completed successfully`);
              
              await telegramAPI('deleteMessage', {
                chat_id: chatId,
                message_id: statusMsg.result.message_id
              });
              
              reportSent = true;
              console.log(`✅ [DEV_BOT] PDF report sent for ${symbol}`);
              
            } catch (sendError) {
              // ========== 诊断日志 4: 发送失败详细信息 ==========
              console.error(`❌ [DEV_BOT] PDF 发送失败 - Error Name: ${sendError.name}`);
              console.error(`❌ [DEV_BOT] PDF 发送失败 - Error Message: ${sendError.message}`);
              console.error(`❌ [DEV_BOT] PDF 发送失败 - Error Stack:`, sendError.stack);
              
              // 向用户报告错误
              await telegramAPI('sendMessage', {
                chat_id: chatId,
                text: `❌ PDF 发送失败\n\n错误详情：${sendError.message}\n\n将切换到文本格式...`
              });
              
              throw sendError; // 重新抛出，进入 fallback
            }
            
          } else {
            // 响应不是 200 OK
            const errorBody = await pdfResponse.text();
            console.log(`⚠️ [DEV_BOT] PDF service unavailable (${pdfResponse.status})`);
            console.log(`⚠️ [DEV_BOT] PDF service error body:`, errorBody.substring(0, 500));
            console.log(`⚠️ [DEV_BOT] Falling back to Markdown`);
          }
        } catch (pdfError) {
          console.error(`❌ [DEV_BOT] PDF generation/sending failed - Error Name: ${pdfError.name}`);
          console.error(`❌ [DEV_BOT] PDF generation/sending failed - Error Message: ${pdfError.message}`);
          console.log(`⚠️ [DEV_BOT] Falling back to Markdown`);
        }
        
        // Step 2B: Fallback to Markdown format
        if (!reportSent) {
          await telegramAPI('editMessageText', {
            chat_id: chatId,
            message_id: statusMsg.result.message_id,
            text: `🔬 正在生成 ${symbol} 研报（v3-dev）...\n\n✅ 步骤 1/2：市场数据获取完成\n⏳ 步骤 2/2：格式化报告文本...`,
            parse_mode: 'Markdown'
          });
          
          // Use buildSimpleReport to generate Markdown
          const mdReport = buildSimpleReport(report);
          
          await telegramAPI('deleteMessage', {
            chat_id: chatId,
            message_id: statusMsg.result.message_id
          });
          
          // Split long report into chunks (Telegram max: 4096 chars)
          const chunks = [];
          const maxLen = 4000;
          let currentChunk = mdReport;
          
          while (currentChunk.length > maxLen) {
            let splitPos = currentChunk.lastIndexOf('\n', maxLen);
            if (splitPos === -1) splitPos = maxLen;
            chunks.push(currentChunk.substring(0, splitPos));
            currentChunk = currentChunk.substring(splitPos).trim();
          }
          if (currentChunk.length > 0) chunks.push(currentChunk);
          
          // Send chunks
          for (let i = 0; i < chunks.length; i++) {
            await telegramAPI('sendMessage', {
              chat_id: chatId,
              text: chunks[i],
              parse_mode: 'Markdown'
            });
            if (i < chunks.length - 1) {
              await new Promise(r => setTimeout(r, 500)); // Avoid rate limit
            }
          }
          
          console.log(`✅ [DEV_BOT] Markdown report sent for ${symbol} (${chunks.length} parts)`);
        }
        
      } catch (error) {
        console.error(`❌ [DEV_BOT] Report generation failed:`, error.message);
        
        await telegramAPI('sendMessage', {
          chat_id: chatId,
          text: `❌ 研报生成失败\n\n标的：${symbol}\n错误：${error.message}\n\n💡 提示：如果是 PDF 服务问题，请联系管理员检查外部服务配置。\n\n这是 v3-dev 测试版本，功能仍在完善中。`,
          parse_mode: 'Markdown'
        });
      }
      return;
    }
    
    // Default response for other messages
    await telegramAPI('sendMessage', {
      chat_id: chatId,
      text: '🔧 v3-dev Bot\n\nI\'m in development mode. Try /help for available commands.',
      parse_mode: 'Markdown'
    });
    
  } catch (error) {
    console.error('[DEV_BOT] Error handling message:', error);
    try {
      await telegramAPI('sendMessage', {
        chat_id: chatId,
        text: '❌ Error in dev bot handler'
      });
    } catch (sendError) {
      console.error('[DEV_BOT] Failed to send error message:', sendError);
    }
  }
}

module.exports = { handleDevBotMessage };
