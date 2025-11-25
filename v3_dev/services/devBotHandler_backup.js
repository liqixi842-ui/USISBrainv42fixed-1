13
}

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
      // Extract symbol and parameters using regex
      const match = text.match(/^\/report\s+(\S+)\s*(.*)$/);
      
      // Check if symbol is provided
      if (!match || !match[1].trim()) {
        await telegramAPI('sendMessage', {
          chat_id: chatId,
          text: '📊 请提供股票代码\n\n格式：/report SYMBOL [brand=...] [firm=...] [analyst=...]\n\n示例（3种写法均支持）：\n1) /report NVDA brand=VADA firm=Aberdeen_Investments analyst=Anthony_Venn_Dutton\n2) /report NVDA brand="VADA" firm="Aberdeen Investments" analyst="Anthony Venn Dutton"\n3) /report NVDA brand=VADA firm=Aberdeen Investments analyst=Anthony Venn Dutton\n\n将通过 Replit v3_dev API 生成完整 PDF 研报（D Mode）。'
        });
        return;
      }
      
      const symbol = match[1].trim().toUpperCase();
      const paramString = match[2].trim();
      
      // D Mode: Use robust parameter parser
      const parsedParams = parseParams(paramString);
      
      // Apply defaults
      const brand = parsedParams.brand || 'USIS Research';
      const firm = parsedParams.firm || 'USIS Research Division';
      const analyst = parsedParams.analyst || 'System (USIS Brain)';
      
      // Debug logging for D Mode parsing
      console.log(`\n[BRAND_DEBUG] D Mode Parameter Parsing Results:`);
      console.log(`[BRAND_DEBUG]   Raw input: "${paramString}"`);
      console.log(`[BRAND_DEBUG]   Parsed params:`, parsedParams);
      console.log(`[BRAND_DEBUG]   Final values after defaults:`);
      console.log(`[BRAND_DEBUG]     brand="${brand}"`);
      console.log(`[BRAND_DEBUG]     firm="${firm}"`);
      console.log(`[BRAND_DEBUG]     analyst="${analyst}"`);
      
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📊 [DEV_BOT] /report ${symbol} - Calling Replit v3_dev PDF API (D Mode)`);
      console.log(`   ├─ Brand: ${brand}`);
      console.log(`   ├─ Firm: ${firm}`);
      console.log(`   └─ Analyst: ${analyst}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      
      let statusMsg = null;
      let t0 = null; // Timer for latency tracking
      
      // 🔧 v5.1 FIX: Use dynamic URL based on environment instead of hardcoded dev URL
      const REPLIT_API_URL = process.env.REPLIT_DEPLOYMENT_URL || 
                             process.env.REPLIT_DEV_DOMAIN || 
                             'https://liqixi888.replit.app';
      
      console.log(`[URL_FIX_v5.1] Using API URL: ${REPLIT_API_URL}`);
      
      try {
        // Send initial status message
        statusMsg = await telegramAPI('sendMessage', {
          chat_id: chatId,
          text: `🔬 正在生成 ${symbol} 研报\n\n⏳ 正在调用 Replit v3_dev PDF API...\n\n(这可能需要 60-120 秒)`
        });
        
        // Build URL with brand/firm/analyst parameters
        const params = new URLSearchParams({
          format: 'pdf',
          asset_type: 'equity',
          brand: brand,
          firm: firm,
          analyst: analyst
        });
        const url = `${REPLIT_API_URL}/v3/report/${symbol}?${params.toString()}`;
        
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
