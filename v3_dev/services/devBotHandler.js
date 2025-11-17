// v3-dev Development Bot Message Handler
// This handles all messages for the development bot (TELEGRAM_BOT_TOKEN_DEV)

const fetch = require('node-fetch');
const FormData = require('form-data');
const https = require('https');
const axios = require('axios');

/**
 * 发送 PDF 文件到 Telegram（使用 multipart/form-data）
 * @param {string} chatId - Chat ID
 * @param {Buffer} pdfBuffer - PDF Buffer
 * @param {string} filename - 文件名
 * @param {string} caption - Caption 文字
 * @param {string} botToken - Bot Token
 * @returns {Promise<Object>} Telegram API 响应
 */
async function sendPDFDocument(chatId, pdfBuffer, filename, caption, botToken) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('document', pdfBuffer, {
      filename: filename,
      contentType: 'application/pdf'
    });
    formData.append('caption', caption);
    
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/sendDocument`,
      method: 'POST',
      headers: formData.getHeaders()
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (!result.ok) {
            reject(new Error(result.description || 'sendDocument failed'));
          } else {
            resolve(result);
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    formData.pipe(req);
  });
}

const VALID_COMMANDS = ['/test', '/status', '/v3', '/help', '/report'];

async function handleDevBotMessage(message, telegramAPI, botToken) {
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
    
    // /report command - 调用 Replit v3_dev PDF API
    if (text.startsWith('/report')) {
      const parts = text.split(' ');
      
      // Check if symbol is provided
      if (parts.length < 2 || !parts[1].trim()) {
        await telegramAPI('sendMessage', {
          chat_id: chatId,
          text: '📊 请提供股票代码\n\n格式：/report AAPL\n\n示例：\n/report AAPL\n/report TSLA\n/report NVDA\n\n将通过 Replit v3_dev API 生成完整 PDF 研报。'
        });
        return;
      }
      
      const symbol = parts[1].trim().toUpperCase();
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📊 [DEV_BOT] /report ${symbol} - Calling Replit v3_dev PDF API`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      
      let statusMsg = null;
      let t0 = null; // Timer for latency tracking
      const REPLIT_API_URL = 'https://e6d61ff9-a9b9-4be6-8fc3-d739698a5bae-00-3wsh3l1cosvt.pike.replit.dev';
      
      try {
        // Send initial status message
        statusMsg = await telegramAPI('sendMessage', {
          chat_id: chatId,
          text: `🔬 正在生成 ${symbol} 研报\n\n⏳ 正在调用 Replit v3_dev PDF API...\n\n(这可能需要 60-120 秒)`
        });
        
        const url = `${REPLIT_API_URL}/v3/report/${symbol}?format=pdf&asset_type=equity`;
        
        // Start timer for latency tracking
        t0 = Date.now();
        console.log(`📡 [DEV_BOT] /report ${symbol} → calling PDF API: ${url}`);
        
        // Call Replit v3_dev PDF API with 240s timeout
        const response = await axios.get(url, { 
          responseType: 'arraybuffer',
          timeout: 240000  // 240 seconds (4 minutes) timeout
        });
        
        const dt = Date.now() - t0;
        const pdfBuffer = Buffer.from(response.data);
        
        console.log(`✅ [DEV_BOT] /report ${symbol} → PDF API done in ${dt} ms`);
        console.log(`   ├─ Size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`);
        console.log(`   ├─ Status: ${response.status}`);
        console.log(`   └─ Content-Type: ${response.headers['content-type']}\n`);
        
        // Update status
        await telegramAPI('editMessageText', {
          chat_id: chatId,
          message_id: statusMsg.result.message_id,
          text: `🔬 正在生成 ${symbol} 研报\n\n✅ PDF 生成完成 (${(pdfBuffer.length / 1024).toFixed(1)} KB)\n⏳ 正在发送 PDF...`
        });
        
        // Send PDF to user
        const safeFilename = `${symbol}-USIS-Research.pdf`;
        const safeCaption = `📊 USIS Research Report - ${symbol}\n\nGenerated via Replit v3_dev API\nSource: ${REPLIT_API_URL}`;
        
        console.log(`📤 [DEV_BOT] Sending PDF to Telegram...`);
        console.log(`   └─ Filename: ${safeFilename}`);
        
        // Use multipart/form-data to send PDF
        await sendPDFDocument(chatId, pdfBuffer, safeFilename, safeCaption, botToken);
        
        // Delete status message
        await telegramAPI('deleteMessage', {
          chat_id: chatId,
          message_id: statusMsg.result.message_id
        });
        
        console.log(`✅ [DEV_BOT] /report: PDF sent successfully for ${symbol}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        
      } catch (error) {
        const dt = Date.now() - t0;
        console.error(`❌ [DEV_BOT] /report ${symbol} ERROR after ${dt} ms`);
        console.error(`   ├─ Error code: ${error.code || 'N/A'}`);
        console.error(`   ├─ Error message: ${error.message}`);
        console.error(`   └─ Stack: ${error.stack}\n`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        
        // Delete status message if exists
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
        
        // Send error message
        let errorMsg = `❌ 研报生成失败\n\n标的: ${symbol}\n\n`;
        
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          errorMsg += `原因: API 请求超时（可能是股票代码不存在或 AI 服务繁忙）\n\n建议：\n• 检查股票代码是否正确\n• 稍后重试`;
        } else if (error.response) {
          errorMsg += `原因: Replit API 返回错误 (${error.response.status})\n\n错误信息: ${error.response.statusText}`;
        } else if (error.request) {
          errorMsg += `原因: 无法连接到 Replit API\n\n建议：\n• 检查 Replit 服务是否在运行\n• 检查网络连接`;
        } else {
          errorMsg += `原因: ${error.message}`;
        }
        
        errorMsg += `\n\n(v3-dev 测试版本 - Replit API)`;
        
        await telegramAPI('sendMessage', {
          chat_id: chatId,
          text: errorMsg
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
