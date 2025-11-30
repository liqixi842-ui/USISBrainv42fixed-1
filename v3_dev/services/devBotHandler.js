// v3-dev Development Bot Message Handler
// This handles all messages for the development bot (TELEGRAM_BOT_TOKEN_DEV)

const fetch = require('node-fetch');
const FormData = require('form-data');
const https = require('https');
const axios = require('axios');

// 🆕 v5.1: Import natural language parser (align with production bot)
const { parseResearchReportCommand, parseSymbolDescription } = require('../../semanticIntentAgent');

// 🆕 v6.0: Import ticket formatter for 解票 feature
const ticketFormatter = require('./v5/ticketFormatter');

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

const VALID_COMMANDS = ['/test', '/status', '/v3', '/help', '/report', '研报', '/研报', '解票', '/解票'];

/**
 * 🆕 v5.1: Universal Report Generator (used by both natural language and structured commands)
 * @param {object} params - Report parameters
 * @param {string} params.symbol - Stock symbol
 * @param {string} params.firm - Institution name
 * @param {string} params.analyst - Analyst name
 * @param {string} params.brand - Brand name (optional, for structured commands)
 * @param {string} params.modelName - Custom model name (e.g., "北极光量化")
 * @param {string} params.versionNumber - Custom version number (e.g., "v7")
 * @param {string} params.lang - Language code (optional)
 * @param {number} params.chatId - Telegram chat ID
 * @param {Function} params.telegramAPI - Telegram API function
 * @param {string} params.botToken - Bot token
 * @param {string} params.commandType - Command type: 'natural' or 'structured'
 */
async function generateReport({ symbol, firm, analyst, brand, modelName, versionNumber, lang, chatId, telegramAPI, botToken, commandType = 'structured' }) {
  let statusMsg = null;
  let t0 = null;
  
  const REPLIT_API_URL = 'http://localhost:3000';
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 [DEV_BOT] Research Report Request (${commandType} mode)`);
  console.log(`   ├─ Symbol: ${symbol}`);
  console.log(`   ├─ Firm: ${firm}`);
  console.log(`   ├─ Analyst: ${analyst}`);
  if (brand) console.log(`   ├─ Brand: ${brand}`);
  if (modelName) console.log(`   ├─ Model Name: ${modelName}`);
  if (versionNumber) console.log(`   ├─ Version: ${versionNumber}`);
  if (lang) console.log(`   ├─ Language: ${lang}`);
  console.log(`   └─ API URL: ${REPLIT_API_URL}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  try {
    // Send initial status message
    statusMsg = await telegramAPI('sendMessage', {
      chat_id: chatId,
      text: `🔬 正在生成 ${symbol} 研报\n\n⏳ 正在调用 Replit v3_dev PDF API...\n\n(这可能需要 60-120 秒)`
    });
    
    // Build URL parameters
    // Note: asset_type is NOT passed - let the API auto-detect (equity/index/etf/crypto)
    const params = new URLSearchParams({
      format: 'pdf',
      firm: firm,
      analyst: analyst
    });
    
    // Add brand parameter if provided (for structured commands)
    if (brand) {
      params.append('brand', brand);
    }
    
    // 🆕 v7.7: Add modelName and versionNumber for custom naming
    if (modelName) {
      params.append('modelName', modelName);
    }
    if (versionNumber) {
      params.append('versionNumber', versionNumber);
    }
    
    // Add language parameter if provided (for natural language commands)
    if (lang) {
      params.append('lang', lang);
    }
    
    const url = `${REPLIT_API_URL}/v3/report/${symbol}?${params.toString()}`;
    
    // Start timer
    t0 = Date.now();
    console.log(`📡 [DEV_BOT] Calling PDF API: ${url}`);
    
    // Call v3_dev PDF API
    const response = await axios.get(url, { 
      responseType: 'arraybuffer',
      timeout: 240000  // 4 minutes timeout
    });
    
    const dt = Date.now() - t0;
    const pdfBuffer = Buffer.from(response.data);
    
    console.log(`✅ [DEV_BOT] PDF API completed in ${dt} ms`);
    console.log(`   ├─ Size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`);
    console.log(`   ├─ Status: ${response.status}`);
    console.log(`   └─ Content-Type: ${response.headers['content-type']}\n`);
    
    // Update status
    await telegramAPI('editMessageText', {
      chat_id: chatId,
      message_id: statusMsg.result.message_id,
      text: `🔬 正在生成 ${symbol} 研报\n\n✅ PDF 生成完成 (${(pdfBuffer.length / 1024).toFixed(1)} KB)\n⏳ 正在发送 PDF...`
    });
    
    // Send PDF
    const safeFilename = `${symbol}-Research-Report.pdf`;
    const safeCaption = `📊 Research Report - ${symbol}\n\nFirm: ${firm}\nAnalyst: ${analyst}\n\nGenerated via v3_dev API`;
    
    console.log(`📤 [DEV_BOT] Sending PDF to Telegram...`);
    await sendPDFDocument(chatId, pdfBuffer, safeFilename, safeCaption, botToken);
    
    // Delete status message
    await telegramAPI('deleteMessage', {
      chat_id: chatId,
      message_id: statusMsg.result.message_id
    });
    
    console.log(`✅ [DEV_BOT] Report sent successfully for ${symbol}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
  } catch (error) {
    const dt = t0 ? Date.now() - t0 : 0;
    console.error(`❌ [DEV_BOT] Report generation ERROR after ${dt} ms`);
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
    
    errorMsg += `\n\n(v3-dev 测试版本 - 命令类型: ${commandType})`;
    
    await telegramAPI('sendMessage', {
      chat_id: chatId,
      text: errorMsg
    });
  }
}

/**
 * D Mode Parameter Parser - Robust parsing for brand/firm/analyst parameters
 * Supports 3 writing styles:
 * 1. brand=VADA firm=Aberdeen_Investments analyst=Anthony_Venn_Dutton
 * 2. brand="VADA" firm="Aberdeen Investments" analyst="Anthony Venn Dutton"
 * 3. brand=VADA firm=Aberdeen Investments analyst=Anthony Venn Dutton
 * 
 * @param {string} paramString - Raw parameter string after symbol
 * @returns {object} Parsed parameters { brand, firm, analyst }
 */
function parseParams(paramString) {
  const params = {};
  let currentKey = null;
  let currentValue = [];
  
  // Split by whitespace
  const tokens = paramString.trim().split(/\s+/);
  
  for (const token of tokens) {
    if (token.includes('=')) {
      // New key=value pair found
      // First, save previous key if exists
      if (currentKey) {
        params[currentKey] = currentValue.join(' ').trim();
      }
      
      const [rawKey, rawValue] = token.split('=');
      currentKey = rawKey.trim().toLowerCase();
      currentValue = rawValue ? [rawValue] : [];
      
    } else if (currentKey) {
      // No '=', so it's a continuation of the previous key's value
      currentValue.push(token);
    }
  }
  
  // Save the last key
  if (currentKey) {
    params[currentKey] = currentValue.join(' ').trim();
  }
  
  // Post-processing: Remove quotes and convert underscores to spaces
  for (const key of Object.keys(params)) {
    let v = params[key];
    
    // Remove surrounding quotes (both double and single)
    v = v.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
    
    // Convert underscores to spaces
    v = v.replace(/_/g, ' ');
    
    params[key] = v.trim();
  }
  
  return params;
}

/**
 * 🆕 v6.0: 解票功能 - Lightweight Ticket Analysis with Chart Screenshot
 * Uses generateStockChart for fast technical analysis (30-60s)
 * Supports 3 modes:
 * 1. 解票 SYMBOL - Standard CN only  
 * 2. 解票 SYMBOL 双语 - Standard CN + EN
 * 3. 解票 SYMBOL 聊天版 / 人话版 - Human voice (CN)
 * 4. 解票 SYMBOL 完整版 - CN + EN + Human
 */
async function handleTicketAnalysis({ symbol, mode, chatId, telegramAPI }) {
  let statusMsg = null;
  let t0 = null;
  
  // Import stockChartService for lightweight ticket analysis
  const { generateStockChart } = require('../../stockChartService');
  const lightweightFormatter = require('./lightweightTicketFormatter');
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🎯 [DEV_BOT] Lightweight Ticket Analysis`);
  console.log(`   ├─ Symbol: ${symbol}`);
  console.log(`   ├─ Mode: ${mode}`);
  console.log(`   └─ Method: generateStockChart (fast)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  try {
    // Send initial status message
    statusMsg = await telegramAPI('sendMessage', {
      chat_id: chatId,
      text: `🎯 正在解票 ${symbol}\n\n⏳ 正在生成图表和技术分析...\n\n(预计 30-60 秒)`
    });
    
    t0 = Date.now();
    console.log(`📊 [DEV_BOT] Calling generateStockChart for ${symbol}...`);
    
    // Call generateStockChart for lightweight ticket analysis
    const chartResult = await generateStockChart(symbol, {
      includeVisionAnalysis: true,
      chartStyle: '1'  // Candlestick chart
    });
    
    const dt = Date.now() - t0;
    
    console.log(`✅ [DEV_BOT] Chart generation completed in ${dt} ms`);
    console.log(`   ├─ Has chart URL: ${!!chartResult.chartUrl}`);
    console.log(`   ├─ Has analysis: ${!!chartResult.analysis}`);
    console.log(`   └─ Fallback mode: ${chartResult.fallback || false}\n`);
    
    // Update status
    await telegramAPI('editMessageText', {
      chat_id: chatId,
      message_id: statusMsg.result.message_id,
      text: `🎯 正在解票 ${symbol}\n\n✅ 图表生成完成\n⏳ 正在格式化输出...`
    });
    
    // Delete status message before sending results
    await telegramAPI('deleteMessage', {
      chat_id: chatId,
      message_id: statusMsg.result.message_id
    });
    
    // 1. Send chart screenshot if available
    if (chartResult.chartUrl) {
      console.log(`📊 [DEV_BOT] Sending chart screenshot...`);
      try {
        await telegramAPI('sendPhoto', {
          chat_id: chatId,
          photo: chartResult.chartUrl,
          caption: `📈 ${symbol} 技术图表`
        });
        console.log(`✅ [DEV_BOT] Chart sent successfully`);
      } catch (photoError) {
        console.error(`⚠️  [DEV_BOT] Chart send failed: ${photoError.message}`);
      }
    }
    
    // 2. Format and send text analysis based on mode
    const ticketData = {
      symbol: chartResult.symbol || symbol,
      analysis: chartResult.analysis || '',
      price: chartResult.price,
      change: chartResult.change,
      changePercent: chartResult.changePercent
    };
    
    let messages = [];
    
    if (mode === '双语') {
      // Bilingual: CN + EN
      messages.push(lightweightFormatter.formatTicketStandardCN(ticketData));
      messages.push(lightweightFormatter.formatTicketStandardEN(ticketData));
    } else if (mode === '聊天版' || mode === '人话版') {
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
    
    console.log(`✅ [DEV_BOT] Generated ${messages.length} message(s)`);
    
    // Send all formatted messages sequentially
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      console.log(`📤 [DEV_BOT] Sending message ${i + 1}/${messages.length} (${msg.length} chars)`);
      
      await telegramAPI('sendMessage', {
        chat_id: chatId,
        text: msg
      });
      
      // Small delay between messages to avoid rate limits
      if (i < messages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }
    
    console.log(`✅ [DEV_BOT] Ticket analysis completed for ${symbol} in ${dt} ms`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
  } catch (error) {
    const dt = t0 ? Date.now() - t0 : 0;
    console.error(`❌ [DEV_BOT] Ticket analysis ERROR after ${dt} ms`);
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
    let errorMsg = `❌ 解票失败\n\n标的: ${symbol}\n\n`;
    
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      errorMsg += `原因: 请求超时（可能是股票代码不存在或服务繁忙）\n\n建议：\n• 检查股票代码是否正确\n• 稍后重试`;
    } else if (error.message.includes('not found') || error.message.includes('Invalid symbol')) {
      errorMsg += `原因: 股票代码不存在或未找到\n\n建议: 检查股票代码拼写`;
    } else {
      errorMsg += `原因: ${error.message}`;
    }
    
    errorMsg += `\n\n(v3-dev 解票功能 - 轻量级模式 - ${mode})`;
    
    await telegramAPI('sendMessage', {
      chat_id: chatId,
      text: errorMsg
    });
  }
}

async function handleDevBotMessage(message, telegramAPI, botToken) {
  const chatId = message.chat.id;
  const text = (message.text || '').trim();
  const userId = message.from.id;
  
  console.log(`\n🔧 [DEV_BOT] Message from ${userId}: "${text}"`);
  
  try {
    // 🆕 v6.0: Priority 0 - 解票 (Ticket Analysis) Command
    // Supports: 解票 SYMBOL [双语|聊天版|人话版|完整版]
    if (text.startsWith('解票') || text.startsWith('/解票')) {
      console.log(`🎯 [DEV_BOT] Detected ticket analysis command`);
      
      // Parse command: 解票 NVDA [双语|聊天版|人话版|完整版]
      const parts = text.replace(/^(解票|\/解票)\s*/i, '').trim().split(/\s+/);
      
      if (parts.length === 0 || !parts[0]) {
        await telegramAPI('sendMessage', {
          chat_id: chatId,
          text: `❌ 解票命令格式错误\n\n**正确格式：**\n解票 股票代码 [模式]\n\n**示例：**\n• 解票 NVDA（标准中文版）\n• 解票 NVDA 双语（中文+英文）\n• 解票 NVDA 聊天版（人话版）\n• 解票 NVDA 人话版（同上）\n• 解票 NVDA 完整版（中文+英文+人话版）\n\n**支持的模式：**\n• 默认：标准中文版\n• 双语：中英文标准版\n• 聊天版/人话版：自然口吻解析\n• 完整版：所有格式`
        });
        return;
      }
      
      const symbol = parts[0].toUpperCase();
      const mode = parts[1] || '标准版';
      
      // Call ticket analysis handler
      await handleTicketAnalysis({
        symbol,
        mode,
        chatId,
        telegramAPI
      });
      
      return;
    }
    
    // 🆕 v5.1: Priority 1 - Natural Language Report Command (aligned with production bot)
    // Supports: 研报, NVDA, Aberdeen Investments, Anthony Venn Dutton, 英文
    if (text.startsWith('研报') || text.startsWith('/研报')) {
      console.log(`📊 [DEV_BOT] Detected natural language report command`);
      
      const reportParams = parseResearchReportCommand(text);
      
      if (!reportParams) {
        await telegramAPI('sendMessage', {
          chat_id: chatId,
          text: '❌ 研报命令格式错误\n\n正确格式：\n研报, 股票代码, 机构名字, 分析师名字, 语言, 模型名称, 版本号\n\n示例：\n研报, NVDA, Aberdeen Investments, Anthony Venn Dutton, 英文\n研报, NVDA, 北极光资本, 张明, 中文, 北极光量化, v7\n\n或使用结构化命令：\n/report NVDA brand=VADA firm=Aberdeen Investments analyst=Anthony Venn Dutton'
        });
        return;
      }
      
      // Call universal report generator
      await generateReport({
        symbol: reportParams.symbol,
        firm: reportParams.firm,
        analyst: reportParams.analyst,
        lang: reportParams.lang,
        modelName: reportParams.modelName,       // 🆕 v7.7: 自定义模型名称
        versionNumber: reportParams.versionNumber, // 🆕 v7.7: 自定义版本号
        chatId,
        telegramAPI,
        botToken,
        commandType: 'natural'
      });
      
      return;
    }
    
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
      const helpText = `📚 v3-dev Bot Help

**基础命令:**
/test - 测试连接
/status - Bot状态
/v3 - v3-dev信息
/help - 帮助信息

**🆕 解票功能（v6.0）:**

格式：解票 股票代码 [模式]

**模式选项：**
• 解票 NVDA（标准中文版）
• 解票 NVDA 双语（中文+英文）
• 解票 NVDA 聊天版（人话版）
• 解票 NVDA 完整版（所有格式）

**输出说明：**
• 标准版：6大板块技术分析（趋势/价位/形态/指标/信号/风险）
• 双语：中英文标准版（分两条消息发送）
• 聊天版：老交易员口吻，自然对话风格
• 完整版：标准双语 + 人话版（共3条消息）

**研报生成（双入口）:**

🔹 **自然语言入口**（推荐）
格式：研报, 股票代码, 机构名字, 分析师名字, 语言
示例：研报, NVDA, Aberdeen Investments, Anthony Venn Dutton, 英文

🔹 **结构化入口**（精确参数）
格式：/report SYMBOL [brand=...] [firm=...] [analyst=...]
示例：/report NVDA brand=VADA firm=Aberdeen Investments analyst=Anthony Venn Dutton

**注意:**
• 解票功能：30-60秒，快速技术分析
• 研报功能：60-120秒，完整机构级研报
• 两种方式均支持全球市场（股票/指数/ETF/加密货币）`;
      
      await telegramAPI('sendMessage', {
        chat_id: chatId,
        text: helpText
      });
      return;
    }
    
    // Priority 2: Structured /report command (for advanced users and brand parameter testing)
    if (text.startsWith('/report')) {
      const match = text.match(/^\/report\s+(\S+)\s*(.*)$/);
      
      if (!match || !match[1].trim()) {
        await telegramAPI('sendMessage', {
          chat_id: chatId,
          text: '📊 请提供股票代码\n\n**格式：**\n/report SYMBOL [brand=...] [firm=...] [analyst=...]\n\n**示例（3种写法均支持）：**\n1) /report NVDA brand=VADA firm=Aberdeen_Investments analyst=Anthony_Venn_Dutton\n2) /report NVDA brand="VADA" firm="Aberdeen Investments" analyst="Anthony Venn Dutton"\n3) /report NVDA brand=VADA firm=Aberdeen Investments analyst=Anthony Venn Dutton\n\n**或使用自然语言：**\n研报, NVDA, Aberdeen Investments, Anthony Venn Dutton, 英文'
        });
        return;
      }
      
      const symbol = match[1].trim().toUpperCase();
      const paramString = match[2].trim();
      
      // Parse structured parameters
      const parsedParams = parseParams(paramString);
      
      // Apply defaults
      const brand = parsedParams.brand || 'USIS Research';
      const firm = parsedParams.firm || 'USIS Research Division';
      const analyst = parsedParams.analyst || 'System (USIS Brain)';
      
      // Debug logging
      console.log(`\n[STRUCT_CMD] Structured Command Parsing Results:`);
      console.log(`[STRUCT_CMD]   Raw input: "${paramString}"`);
      console.log(`[STRUCT_CMD]   Parsed params:`, parsedParams);
      console.log(`[STRUCT_CMD]   Final values:`);
      console.log(`[STRUCT_CMD]     brand="${brand}"`);
      console.log(`[STRUCT_CMD]     firm="${firm}"`);
      console.log(`[STRUCT_CMD]     analyst="${analyst}"`);
      
      // Call universal report generator
      await generateReport({
        symbol,
        firm,
        analyst,
        brand,
        chatId,
        telegramAPI,
        botToken,
        commandType: 'structured'
      });
      
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
