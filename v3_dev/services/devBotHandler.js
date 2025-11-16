// v3-dev Development Bot Message Handler
// This handles all messages for the development bot (TELEGRAM_BOT_TOKEN_DEV)

const fetch = require('node-fetch');
const { buildSimpleReport, generateMarkdownReport, generateHTMLReport, generatePdfWithDocRaptor } = require('./reportService');

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
        text: '✅ v3-dev Bot is working!\n\nVersion: v3-dev\nEnvironment: Development\nIsolation: Active'
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
        text: status
      });
      return;
    }
    
    // /v3 command
    if (text === '/v3') {
      await telegramAPI('sendMessage', {
        chat_id: chatId,
        text: '🔬 v3-dev Development Environment\n\nThis bot is for testing new features before production.\n\nCurrent focus: Research report system'
      });
      return;
    }
    
    // /help command
    if (text === '/help') {
      await telegramAPI('sendMessage', {
        chat_id: chatId,
        text: '📚 v3-dev Bot Help\n\n/test - Test connectivity\n/status - Bot status\n/v3 - v3-dev info\n/report [SYMBOL] - Generate research report (v1 test)\n/help - This message'
      });
      return;
    }
    
    // /report command - 生成并发送研报（优先 PDF，降级文本）
    if (text.startsWith('/report')) {
      const parts = text.split(' ');
      
      // Check if symbol is provided
      if (parts.length < 2 || !parts[1].trim()) {
        await telegramAPI('sendMessage', {
          chat_id: chatId,
          text: '📊 请提供股票代码\n\n格式：/report AAPL\n\n示例：\n/report AAPL\n/report TSLA\n/report NVDA\n\n将生成完整研报发送给您（优先 PDF 格式）。'
        });
        return;
      }
      
      const symbol = parts[1].trim().toUpperCase();
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📊 [DEV_BOT] /report ${symbol} - Starting 3-stage pipeline`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      
      let statusMsg = null;
      
      try {
        // Send initial status message
        statusMsg = await telegramAPI('sendMessage', {
          chat_id: chatId,
          text: `🔬 正在生成 ${symbol} 研报（v3-dev）\n\n⏳ 阶段 1/3：生成研报内容...`
        });
        
        // ═══════════════════════════════════════════════════════════════
        // 【阶段 1】生成研报内容（CRITICAL - 不可降级）
        // ═══════════════════════════════════════════════════════════════
        console.log(`📡 [DEV_BOT] /report: Stage 1 - Fetching report content for ${symbol}...`);
        
        const reportJsonUrl = `http://localhost:3000/v3/report/${symbol}?format=json`;
        const jsonResponse = await fetch(reportJsonUrl, { timeout: 20000 });
        
        if (!jsonResponse.ok) {
          throw new Error(`Report API error: HTTP ${jsonResponse.status}`);
        }
        
        const reportData = await jsonResponse.json();
        
        if (!reportData.ok || !reportData.report) {
          throw new Error('Invalid report structure from API');
        }
        
        const report = reportData.report;
        
        // 生成 Markdown 文本版（无论是否发 PDF，都先生成文本版作为保底）
        const mdReport = generateMarkdownReport(symbol, report);
        
        console.log(`✅ [DEV_BOT] /report: Stage 1 COMPLETE - Content generated for ${symbol}`);
        console.log(`   ├─ Report rating: ${report.rating}`);
        console.log(`   ├─ Model used: ${report.model_used}`);
        console.log(`   ├─ Latency: ${report.latency_ms}ms`);
        console.log(`   └─ Markdown length: ${mdReport.length} chars\n`);
        
        // Update status
        await telegramAPI('editMessageText', {
          chat_id: chatId,
          message_id: statusMsg.result.message_id,
          text: `🔬 正在生成 ${symbol} 研报（v3-dev）\n\n✅ 阶段 1/3：研报内容生成完成\n⏳ 阶段 2/3：尝试生成 PDF...`
        });
        
        // ═══════════════════════════════════════════════════════════════
        // 【阶段 2】尝试生成 PDF（OPTIONAL - 尽力而为）
        // ═══════════════════════════════════════════════════════════════
        let pdfBuffer = null;
        let pdfOk = false;
        
        console.log(`📄 [DEV_BOT] /report: Stage 2 - Attempting PDF generation for ${symbol}...`);
        console.log(`   └─ Calling DocRaptor API...`);
        
        try {
          const html = generateHTMLReport(symbol, report);
          pdfBuffer = await generatePdfWithDocRaptor(symbol, html);
          
          // 严格验证 PDF Buffer
          if (pdfBuffer && Buffer.isBuffer(pdfBuffer) && pdfBuffer.length > 0) {
            pdfOk = true;
            console.log(`✅ [DEV_BOT] /report: DocRaptor PDF OK for ${symbol}, size: ${pdfBuffer.length} bytes (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);
            console.log(`   └─ PDF validation: Buffer=${Buffer.isBuffer(pdfBuffer)}, Length=${pdfBuffer.length}\n`);
          } else {
            throw new Error(`PDF buffer invalid: isBuffer=${Buffer.isBuffer(pdfBuffer)}, length=${pdfBuffer?.length || 0}`);
          }
          
        } catch (pdfError) {
          pdfOk = false;
          console.error(`⚠️ [DEV_BOT] /report: DocRaptor PDF FAILED for ${symbol}, reason: ${pdfError.message}`);
          console.error(`   └─ Will fallback to Markdown delivery\n`);
          pdfBuffer = null; // Ensure fallback
        }
        
        // ═══════════════════════════════════════════════════════════════
        // 【阶段 3】发送给用户（优先 PDF，降级 Markdown）
        // ═══════════════════════════════════════════════════════════════
        console.log(`📤 [DEV_BOT] /report: Stage 3 - Delivering report to user...`);
        console.log(`   └─ pdfOk=${pdfOk}, pdfBuffer exists=${!!pdfBuffer}, length=${pdfBuffer?.length || 0}`);
        
        let pdfSent = false;
        
        if (pdfOk && pdfBuffer && pdfBuffer.length > 0) {
          // ─────────────────────────────────────────────────────────────
          // Path A: 尝试发送 PDF 文件（DocRaptor 成功生成）
          // ─────────────────────────────────────────────────────────────
          console.log(`   └─ Path: PDF delivery (DocRaptor generated ${(pdfBuffer.length / 1024).toFixed(1)} KB)`);
          
          try {
            await telegramAPI('editMessageText', {
              chat_id: chatId,
              message_id: statusMsg.result.message_id,
              text: `🔬 正在生成 ${symbol} 研报（v3-dev）\n\n✅ 阶段 1/3：研报内容生成完成\n✅ 阶段 2/3：PDF 生成完成 (${(pdfBuffer.length / 1024).toFixed(1)} KB - DocRaptor 测试模式)\n⏳ 阶段 3/3：正在发送 PDF...`
            });
            
            // 生成安全的文件名和 caption（不含特殊字符）
            const safeFilename = `${symbol}.pdf`;
            const safeCaption = `USIS Research Report ${symbol} v3-dev\n\nRating: ${report.rating}\nModel: ${report.model_used}\nLatency: ${report.latency_ms}ms\n\nDocRaptor PDF Test Mode`;
            
            console.log(`   └─ Calling Telegram sendDocument API...`);
            console.log(`   └─ [DEV_BOT] Sending PDF with filename: ${safeFilename}`);
            console.log(`   └─ [DEV_BOT] Caption length: ${safeCaption.length} chars`);
            
            await telegramAPI('sendDocument', {
              chat_id: chatId,
              document: pdfBuffer,
              filename: safeFilename,
              caption: safeCaption
            });
            
            await telegramAPI('deleteMessage', {
              chat_id: chatId,
              message_id: statusMsg.result.message_id
            });
            
            pdfSent = true;
            console.log(`✅ [DEV_BOT] /report: PDF sent for ${symbol}`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            
          } catch (sendPdfError) {
            // PDF 发送失败，降级到 Markdown（不影响整体流程）
            console.error(`⚠️ [DEV_BOT] /report: Stage 3 PDF delivery FAILED for ${symbol}`);
            console.error(`   ├─ Error: ${sendPdfError.message}`);
            console.error(`   └─ Falling back to Markdown delivery\n`);
            pdfOk = false; // 标记 PDF 发送失败
          }
        } else {
          console.log(`   └─ Skipping PDF delivery: pdfOk=${pdfOk}`);
        }
        
        // ─────────────────────────────────────────────────────────────
        // Path B: 发送 Markdown 文本版（PDF 不可用或发送失败时的保底方案）
        // ─────────────────────────────────────────────────────────────
        if (!pdfSent) {
          const reason = pdfOk ? 'Telegram delivery failed' : 'DocRaptor generation failed';
          console.log(`   └─ Path: Markdown fallback (${reason})`);
          
          await telegramAPI('editMessageText', {
            chat_id: chatId,
            message_id: statusMsg.result.message_id,
            text: `⚠️ PDF ${pdfOk ? '发送失败（Telegram限制）' : '生成失败'}\n\n正在为您发送完整文本版研报...`
          });
          
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          await telegramAPI('deleteMessage', {
            chat_id: chatId,
            message_id: statusMsg.result.message_id
          });
          
          // 添加降级说明前缀
          const fallbackPrefix = `⚠️ PDF ${pdfOk ? '发送异常（Telegram限制）' : '服务异常'}，以下是完整文本版研报：\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
          const fullReport = fallbackPrefix + mdReport;
          
          // Split into chunks (Telegram max: 4096 chars)
          const chunks = [];
          const maxLen = 4000;
          let remaining = fullReport;
          
          while (remaining.length > maxLen) {
            let splitPos = remaining.lastIndexOf('\n', maxLen);
            if (splitPos === -1) splitPos = maxLen;
            chunks.push(remaining.substring(0, splitPos));
            remaining = remaining.substring(splitPos).trim();
          }
          if (remaining.length > 0) chunks.push(remaining);
          
          // Send all chunks
          for (let i = 0; i < chunks.length; i++) {
            await telegramAPI('sendMessage', {
              chat_id: chatId,
              text: chunks[i]
            });
            if (i < chunks.length - 1) {
              await new Promise(r => setTimeout(r, 500));
            }
          }
          
          console.log(`✅ [DEV_BOT] /report: Markdown fallback sent for ${symbol} (${chunks.length} parts, reason: ${reason})`);
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        }
        
      } catch (error) {
        // ═══════════════════════════════════════════════════════════════
        // 【致命错误】只有在阶段 1（内容生成）失败时才会到这里
        // ═══════════════════════════════════════════════════════════════
        console.error(`❌ [DEV_BOT] /report: FATAL ERROR - Content generation failed for ${symbol}`);
        console.error(`   ├─ Error: ${error.message}`);
        console.error(`   └─ Stack: ${error.stack}\n`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        
        // 删除状态消息（如果存在）
        if (statusMsg?.result?.message_id) {
          try {
            await telegramAPI('deleteMessage', {
              chat_id: chatId,
              message_id: statusMsg.result.message_id
            });
          } catch (delErr) {
            // Ignore delete errors
          }
        }
        
        // 只在内容生成阶段失败时，才发送"研报生成失败"
        await telegramAPI('sendMessage', {
          chat_id: chatId,
          text: `❌ 研报生成失败\n\n标的: ${symbol}\n\n原因: 无法从数据源获取研报内容。这可能是由于：\n• 股票代码不存在\n• AI 服务暂时不可用\n• 网络连接问题\n\n请稍后重试，或尝试其他股票代码。\n\n(v3-dev 测试版本)`
        });
      }
      return;
    }
    
    // Default response for other messages
    await telegramAPI('sendMessage', {
      chat_id: chatId,
      text: '🔧 v3-dev Bot\n\nI\'m in development mode. Try /help for available commands.'
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
