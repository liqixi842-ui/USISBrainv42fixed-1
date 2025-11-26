const { handleTicket } = require('./ticket-bot.js');
const { handleReport, handleReportPdf } = require('./report-bot.js');
const { handleNews } = require('./news-bot.js');
const { handleBrief } = require('./brief-bot.js');
const { handleHeatmap } = require('./heatmap-bot.js');
const { handlePublic } = require('./public-bot.js');
const { handleSupervisor } = require('./supervisor-bot.js');
const { handleDeepReport } = require('./deep-report-bot.js');
const { parseResearchReportCommand, parseUserIntent } = require('../semanticIntentAgent');

/**
 * USIS Brain v7.0 - Manager Bot (核心路由器)
 * 
 * 职责：
 * - 接收所有 Telegram 消息
 * - 解析用户命令和参数
 * - 路由到专业化 bot 模块
 * - 统一错误处理和日志记录
 * 
 * 架构：
 * Manager Bot → [Ticket Bot, Report Bot, News Bot, Heatmap Bot, Public Bot, Supervisor Bot]
 */

/**
 * 解析用户消息，提取命令和参数
 * @param {Object} message - Telegram 消息对象
 * @returns {Object} { cmd: string, args: string[] }
 */
function parseCommand(message) {
  const text = (message.text || '').trim();
  
  // 🆕 机构研报触发器（Institutional Deep Report）
  const deepReportPatterns = ['机构研报', '机构分析', 'deep report', 'deep 报告'];
  const lowerText = text.toLowerCase();
  if (deepReportPatterns.some(p => lowerText.includes(p.toLowerCase())) || 
      (lowerText.startsWith('deep') && !lowerText.includes('报') && !lowerText.includes('report'))) {
    const parts = text.split(/\s+/);
    const symbolArg = parts.find(p => /^[A-Z]{1,5}$/i.test(p) && !['deep', 'report'].includes(p.toLowerCase()));
    return {
      cmd: 'deepreport',
      args: symbolArg ? [symbolArg.toUpperCase()] : [],
      flags: {}
    };
  }
  
  // 🆕 NL-2-FIX: 自然语言热力图触发器
  if (text.includes('热力图')) {
    // 交给 Heatmap Bot 后续解析（NL-2 也在 heatmap-bot 内处理）
    return {
      cmd: 'heatmap',
      args: [],   // 让 heatmap-bot 自己解析自然语言
      flags: {}
    };
  }
  
  // 🆕 Task NL-1-ALT: 特判"研报, ..."逗号协议 → 直接解析为 report 命令
  if (text.includes('研报') && text.includes(',')) {
    try {
      const parsed = parseResearchReportCommand(text);
      if (parsed && parsed.symbol) {
        console.log('[PARSER][NL-1-ALT] Parsed comma-style research command:', parsed);
        return {
          cmd: 'report',
          args: [parsed.symbol, parsed.lang || 'en'],
          flags: {},
        };
      }
    } catch (err) {
      console.error('[PARSER][NL-1-ALT] parseResearchReportCommand failed, fallback to normal parser:', err.message);
      // 失败则继续走后面的原有解析逻辑
    }
  }
  
  // ⬇️ 下面保持原有 parseCommand 逻辑不变
  
  if (!text) {
    return { cmd: null, args: [], flags: {} };
  }
  
  // Remove bot username suffix if present (e.g., /ticket@botname → /ticket)
  const cleanText = text.replace(/@\w+/g, '').trim();
  
  // 🆕 NL-SMART: 智能自然语言解析（在严格命令匹配之前）
  // 支持: "分析一下NVDA", "看看苹果", "帮我解读TSLA"
  // ⚠️ 重要：如果包含国家/交易所提示，跳过简单匹配，让 AI 处理以提取交易所信息
  const exchangeHintKeywords = [
    '西班牙', '香港', '中国', '日本', '英国', '德国', '法国', '加拿大', '澳大利亚', '巴西',
    'Spain', 'HK', 'China', 'Japan', 'UK', 'Germany', 'France', 'Canada', 'Australia', 'Brazil',
    'BME', 'TSX', 'LSE', 'HKEX', '港股', '美股', 'A股', '欧股'
  ];
  const hasExchangeHint = exchangeHintKeywords.some(kw => 
    cleanText.toLowerCase().includes(kw.toLowerCase())
  );
  
  if (hasExchangeHint) {
    console.log(`[PARSER][EXCHANGE-DETECT] 检测到交易所提示，跳过简单解析，转交 AI 处理: "${cleanText}"`);
    return { cmd: 'public', args: [cleanText], flags: {} };
  }
  
  const nlTicketPatterns = [
    /^解[析读票].*?([A-Z]{1,5}|[\u4e00-\u9fa5]{2,6})$/i,           // 解析/解读/解票 ... SYMBOL
    /^分析.*?([A-Z]{1,5}|[\u4e00-\u9fa5]{2,6})$/i,                 // 分析 ... SYMBOL
    /^看[看一下]*\s*([A-Z]{1,5}|[\u4e00-\u9fa5]{2,6})$/i,          // 看看 SYMBOL
    /^帮我[解分][析读票]?\s*([A-Z]{1,5}|[\u4e00-\u9fa5]{2,6})$/i,  // 帮我解析 SYMBOL
    /^([A-Z]{2,5})\s*怎么样/i,                                      // NVDA 怎么样
    /^([A-Z]{2,5})\s*走势/i,                                        // TSLA 走势
  ];
  
  for (const pattern of nlTicketPatterns) {
    const match = cleanText.match(pattern);
    if (match && match[1]) {
      const symbol = match[1].trim();
      console.log(`[PARSER][NL-SMART] 自然语言匹配: "${cleanText}" → ticket ${symbol}`);
      return { cmd: 'ticket', args: [symbol], flags: {} };
    }
  }
  
  // 🆕 NL-SMART-2: 更宽松的模式 - 包含关键词 + 股票代码
  if ((cleanText.includes('解析') || cleanText.includes('解读') || cleanText.includes('分析')) && !cleanText.startsWith('研报')) {
    // 提取最后一个看起来像股票代码的词
    const words = cleanText.split(/\s+/);
    const lastWord = words[words.length - 1];
    if (/^[A-Z]{1,5}$/i.test(lastWord) || /^[\u4e00-\u9fa5]{2,6}$/.test(lastWord)) {
      console.log(`[PARSER][NL-SMART-2] 宽松匹配: "${cleanText}" → ticket ${lastWord}`);
      return { cmd: 'ticket', args: [lastWord.toUpperCase()], flags: {} };
    }
  }

  // Check if message starts with / or is a known Chinese command
  const isCommand = cleanText.startsWith('/') || 
                    cleanText.startsWith('解票') || 
                    cleanText.startsWith('研报') ||
                    cleanText.startsWith('新闻') ||
                    cleanText.startsWith('热力图') ||
                    cleanText.startsWith('简报') ||
                    cleanText.startsWith('机构研报') ||
                    cleanText.startsWith('机构分析') ||
                    cleanText.toLowerCase().startsWith('deep');
  
  if (!isCommand) {
    return { cmd: 'public', args: [cleanText], flags: {} };
  }
  
  // Split command and arguments
  const parts = cleanText.split(/\s+/);
  const firstPart = parts[0].toLowerCase();
  let args = parts.slice(1);
  let flags = {};
  
  // Map commands (both English and Chinese)
  let cmd = null;
  
  // Ticket commands (扩展别名)
  if (firstPart === '/ticket' || firstPart === '解票' || firstPart === '/解票' || 
      firstPart === '解析' || firstPart === '解读' || firstPart === '分析') {
    cmd = 'ticket';
  }
  // Report commands (text version)
  else if (firstPart === '/report' || firstPart === '研报' || firstPart === '/研报') {
    cmd = 'report';
  }
  // Report PDF commands (新命令：PDF 版本) - 专门解析
  else if (firstPart === '/reportpdf' || firstPart === '研报pdf' || firstPart === '/研报pdf' || firstPart === '研报PDF') {
    cmd = 'reportpdf';
    
    // ═══ 特殊处理：reportpdf 命令的 pro 标志解析 ═══
    const parsed = parseReportPdfArgs(args);
    
    // ✅ 将解析后的 symbol 和 language 存入 flags，保证一致性
    flags = {
      ...parsed.flags,
      symbol: parsed.symbol,
      language: parsed.language
    };
    
    // ✅ 为了向后兼容，仍然保留 args 数组格式
    args = parsed.symbol ? [parsed.symbol, parsed.language] : [];
    
    console.log(`[DEBUG parseCommand] After parseReportPdfArgs:`);
    console.log(`   - args = ${JSON.stringify(args)}`);
    console.log(`   - flags = ${JSON.stringify(flags)}`);
  }
  // News commands
  else if (firstPart === '/news' || firstPart === '新闻' || firstPart === '/新闻') {
    cmd = 'news';
  }
  // Brief commands (极简研报)
  else if (firstPart === '/brief' || firstPart === '简报' || firstPart === '/简报') {
    cmd = 'brief';
  }
  // Heatmap commands
  else if (firstPart === '/heatmap' || firstPart === '热力图' || firstPart === '/热力图') {
    cmd = 'heatmap';
  }
  // Supervisor/Admin commands
  else if (firstPart === '/admin' || firstPart === '/supervisor' || firstPart === '/status') {
    cmd = 'supervisor';
  }
  // Help command
  else if (firstPart === '/help' || firstPart === '/start') {
    cmd = 'help';
  }
  // Deep Report commands (机构研报)
  else if (firstPart === '/deep' || firstPart === '/deepreport' || firstPart === '机构研报' || firstPart === '机构分析' || firstPart === 'deep') {
    cmd = 'deepreport';
  }
  // Unknown command - treat as public message
  else {
    cmd = 'public';
    args.unshift(firstPart);
  }
  
  return { cmd, args, flags };
}

/**
 * 解析 /reportpdf 命令的参数（专门处理 pro 标志）
 * 
 * 支持三种用法：
 * - /reportpdf pro NVDA        → symbol=NVDA, language=en, premium=true
 * - /reportpdf NVDA pro        → symbol=NVDA, language=en, premium=true
 * - /reportpdf NVDA pro zh     → symbol=NVDA, language=zh, premium=true
 * 
 * @param {Array} rawArgs - 原始参数数组
 * @returns {Object} { symbol: string, language: string, flags: { premium: boolean } }
 */
function parseReportPdfArgs(rawArgs) {
  const VALID_LANGUAGES = ['en', 'zh', 'es'];
  const PREMIUM_FLAGS = ['pro', 'premium'];
  
  let symbol = null;
  let language = 'en'; // 默认英文
  let premium = false;
  
  console.log(`[DEBUG parseReportPdfArgs] rawArgs =`, rawArgs);
  
  // 遍历所有参数，分类识别
  for (const arg of rawArgs) {
    const argLower = arg.toLowerCase();
    
    // 1. 检查是否为 premium 标志
    if (PREMIUM_FLAGS.includes(argLower)) {
      premium = true;
      console.log(`[DEBUG parseReportPdfArgs] Found premium flag: ${arg}`);
      continue;
    }
    
    // 2. 检查是否为语言代码
    if (VALID_LANGUAGES.includes(argLower)) {
      language = argLower;
      console.log(`[DEBUG parseReportPdfArgs] Found language: ${argLower}`);
      continue;
    }
    
    // 3. 否则视为 symbol（取第一个非标志/非语言的参数）
    if (!symbol) {
      symbol = arg.toUpperCase();
      console.log(`[DEBUG parseReportPdfArgs] Found symbol: ${symbol}`);
    }
  }
  
  // ✅ 新返回结构：明确分离 symbol, language, flags
  const result = {
    symbol: symbol,
    language: language,
    flags: { premium }
  };
  
  console.log(`[DEBUG parseReportPdfArgs] Final result =`, JSON.stringify(result));
  
  return result;
}

/**
 * Manager Bot 主处理函数
 * @param {Object} message - Telegram 消息对象
 * @param {number} chatId - Chat ID
 * @param {Object} bot - Telegram Bot 实例
 */
async function handleManagerBot(message, chatId, bot) {
  console.log("[DEBUG_RAW_TEXT]", JSON.stringify(message.text));
  
  const startTime = Date.now();
  const userId = message.from?.id || 'unknown';
  const username = message.from?.username || 'unknown';
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🎯 [MANAGER_BOT] Incoming message`);
  console.log(`   ├─ User: ${username} (${userId})`);
  console.log(`   ├─ Chat ID: ${chatId}`);
  console.log(`   ├─ Message: "${(message.text || '').substring(0, 50)}${(message.text || '').length > 50 ? '...' : ''}"`);
  console.log(`   └─ Timestamp: ${new Date().toISOString()}`);
  
  try {
    // ═══════════════════════════════════════════════════════════
    // 🆕 Task NL-1: Early detection for comma-style research report
    // ═══════════════════════════════════════════════════════════
    const text = (message.text || '').trim();
    let result;
    
    console.log('[MANAGER_BOT][NL-1] text =', JSON.stringify(text));
    if (text.includes('研报') && text.includes(',')) {
      console.log(`📊 [MANAGER_BOT] Detected comma-style research report command`);
      
      try {
        const parsed = parseResearchReportCommand(text);
        
        if (parsed) {
          console.log(`✅ [MANAGER_BOT] Parsed comma-style command:`);
          console.log(`   ├─ Symbol: ${parsed.symbol}`);
          console.log(`   ├─ Firm: ${parsed.firm}`);
          console.log(`   ├─ Analyst: ${parsed.analyst}`);
          console.log(`   ├─ Language: ${parsed.lang}`);
          console.log(`   └─ Routing to handleReport...`);
          
          // Route to handleReport with parsed parameters
          // Note: handleReport expects args = [symbol, language]
          const args = [parsed.symbol, parsed.lang];
          
          result = await handleReport(args, chatId, bot, message);
          
          const duration = Date.now() - startTime;
          console.log(`\n✅ [MANAGER_BOT] Comma-style report completed in ${duration} ms`);
          console.log(`   ├─ Symbol: ${parsed.symbol}`);
          console.log(`   ├─ Firm: ${parsed.firm}`);
          console.log(`   ├─ Analyst: ${parsed.analyst}`);
          console.log(`   └─ User: ${username}`);
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
          
          return result;
        }
      } catch (parseError) {
        console.error(`⚠️  [MANAGER_BOT] parseResearchReportCommand failed:`, parseError.message);
        console.log(`   └─ Falling back to default "研报 SYMBOL" parsing...`);
        // Continue to normal parsing below
      }
    }
    
    // ═══════════════════════════════════════════════════════════
    // Standard command parsing (existing behavior)
    // ═══════════════════════════════════════════════════════════
    
    // Parse command and arguments
    const { cmd, args, flags } = parseCommand(message);
    
    console.log(`   ├─ Parsed command: ${cmd || 'none'}`);
    console.log(`   ├─ Arguments: [${args.join(', ')}]`);
    console.log(`   └─ Flags: ${JSON.stringify(flags)}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    // Route to appropriate bot handler
    
    switch (cmd) {
      case 'ticket':
        console.log(`🎯 [ROUTER] → ticket-bot.js`);
        result = await handleTicket(args, chatId, bot, message);
        break;
        
      case 'report':
        console.log(`📊 [ROUTER] → report-bot.js (text)`);
        result = await handleReport(args, chatId, bot, message);
        break;
        
      case 'reportpdf':
        console.log(`📄 [ROUTER] → report-bot.js (PDF - ${flags.premium ? 'premium' : 'basic'})`);
        result = await handleReportPdf(args, chatId, bot, message, flags);
        break;
        
      case 'news':
        console.log(`📰 [ROUTER] → news-bot.js`);
        result = await handleNews(args, chatId, bot, message);
        break;
        
      case 'brief':
        console.log(`📄 [ROUTER] → brief-bot.js`);
        result = await handleBrief(args, chatId, bot, message);
        break;
        
      case 'heatmap':
        console.log(`🗺️  [ROUTER] → heatmap-bot.js`);
        result = await handleHeatmap(args, chatId, bot, message);
        break;
        
      case 'supervisor':
        console.log(`🔐 [ROUTER] → supervisor-bot.js (admin)`);
        result = await handleSupervisor(args, chatId, bot, message);
        break;
        
      case 'help':
        console.log(`❓ [ROUTER] → public-bot.js (help)`);
        result = await handlePublic(message, chatId, bot, { isHelp: true });
        break;
        
      case 'deepreport':
        console.log(`🏛️  [ROUTER] → deep-report-bot.js (institutional)`);
        result = await handleDeepReport(args, chatId, bot, message);
        break;
        
      case 'public':
      default:
        console.log(`💬 [ROUTER] → public-bot.js (general)`);
        result = await handlePublic(message, chatId, bot, { isHelp: false });
        break;
    }
    
    // Log completion
    const duration = Date.now() - startTime;
    console.log(`\n✅ [MANAGER_BOT] Request completed in ${duration} ms`);
    console.log(`   ├─ Command: ${cmd}`);
    console.log(`   ├─ User: ${username}`);
    console.log(`   └─ Result: ${result ? 'success' : 'completed'}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    return result;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error(`\n❌ [MANAGER_BOT] ERROR after ${duration} ms`);
    console.error(`   ├─ User: ${username} (${userId})`);
    console.error(`   ├─ Chat ID: ${chatId}`);
    console.error(`   ├─ Error type: ${error.name || 'Error'}`);
    console.error(`   ├─ Error message: ${error.message}`);
    console.error(`   └─ Stack trace:`);
    console.error(error.stack);
    console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    // Send error message to user
    try {
      await bot.sendMessage(chatId, 
        `❌ 系统错误\n\n` +
        `抱歉，处理您的请求时发生错误。\n\n` +
        `错误类型: ${error.name || 'Unknown'}\n` +
        `错误信息: ${error.message}\n\n` +
        `请稍后重试或联系管理员。`
      );
    } catch (sendError) {
      console.error(`❌ [MANAGER_BOT] Failed to send error message:`, sendError.message);
    }
    
    // Re-throw error for upstream handling
    throw error;
  }
}

/**
 * Helper function: Validate bot instance
 * @param {Object} bot - Telegram Bot instance
 * @returns {boolean}
 */
function validateBot(bot) {
  if (!bot || typeof bot.sendMessage !== 'function') {
    console.error(`❌ [MANAGER_BOT] Invalid bot instance provided`);
    return false;
  }
  return true;
}

/**
 * Helper function: Log routing decision
 * @param {string} cmd - Command name
 * @param {string} target - Target bot module
 */
function logRouting(cmd, target) {
  console.log(`🔀 [MANAGER_BOT] Routing decision:`);
  console.log(`   ├─ Command: ${cmd}`);
  console.log(`   └─ Target: ${target}`);
}

module.exports = { handleManagerBot, parseCommand };
