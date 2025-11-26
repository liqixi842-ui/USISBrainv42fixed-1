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
  // 🆕 v7.1: 支持字符串或消息对象
  const rawText = typeof message === 'string' 
    ? message 
    : (message?.text || message?.caption || '');
  const text = rawText.trim();
  
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
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🆕 v7.1 重构：结构化命令优先，AI 语义理解后备
  // 
  // 设计原则：
  // 1. 明确的结构化命令（如 "解票 AAPL 双语"）直接解析，保留所有参数
  // 2. 模糊的自然语言（如 "帮我看看苹果"）交给 AI 语义理解
  // 3. 中文公司名需要 AI 翻译（苹果→AAPL），统一走 AI 路径
  // ═══════════════════════════════════════════════════════════════════════════
  
  // 🔧 已知的模式关键词（用于区分模式 vs 公司名）
  // 🆕 v7.1: 扩展支持西语等多语言组合
  const MODE_KEYWORDS = ['双语', '三语', '聊天版', '人话版', '完整版', '标准版', 
                          '英文', '中文', '西语', '西班牙语',
                          '中文和西语', '中文和英文', '英文和西语', '中文和英文和西语'];
  
  // 🔧 交易所提示关键词
  const EXCHANGE_HINTS = [
    '西班牙', '香港', '中国', '日本', '英国', '德国', '法国', '加拿大', '澳大利亚', '巴西',
    'Spain', 'HK', 'China', 'Japan', 'UK', 'Germany', 'France', 'Canada', 'Australia', 'Brazil',
    'BME', 'TSX', 'LSE', 'HKEX', '港股', '美股', 'A股', '欧股'
  ];
  
  // ═══ STEP 0: 预处理 - 分离连写的命令和参数 ═══
  // 处理 "解票西班牙col" → "解票 西班牙col" 这种连写情况
  let normalizedText = cleanText;
  const TICKET_PREFIXES = ['解票', '解析', '解读', '分析'];
  for (const prefix of TICKET_PREFIXES) {
    if (cleanText.startsWith(prefix) && cleanText.length > prefix.length && cleanText[prefix.length] !== ' ') {
      // 命令和参数连写，插入空格
      normalizedText = prefix + ' ' + cleanText.slice(prefix.length);
      console.log(`[PARSER][NORMALIZE] 修正连写: "${cleanText}" → "${normalizedText}"`);
      break;
    }
  }
  
  // ═══ STEP 1: 检测是否为明确的结构化命令 ═══
  // 格式：命令 + 参数（如 "解票 AAPL 双语"）
  const TICKET_COMMANDS = ['解票', '/ticket', '/解票', '解析', '解读', '分析'];
  const parts = normalizedText.split(/\s+/);
  const firstWord = parts[0];
  
  // 检查是否以票据命令开头
  const isTicketCommand = TICKET_COMMANDS.some(cmd => 
    firstWord === cmd || firstWord.toLowerCase() === cmd.toLowerCase()
  );
  
  if (isTicketCommand && parts.length >= 2) {
    const symbolCandidate = parts[1].toUpperCase();
    const modeCandidate = parts[2] || '标准版';
    
    // 检查 symbol 是否为有效的股票代码格式（英文+数字，或带交易所前缀）
    const isValidTicker = /^[A-Z0-9.:]{1,15}$/i.test(symbolCandidate);
    
    // 检查 symbol 是否为中文公司名（需要 AI 翻译）
    const isChineseCompanyName = /^[\u4e00-\u9fa5]{2,}$/.test(symbolCandidate) && 
                                  !MODE_KEYWORDS.includes(symbolCandidate);
    
    if (isValidTicker) {
      // ✅ 明确的结构化命令，直接解析
      console.log(`[PARSER][STRUCTURED] 结构化命令: ${firstWord} ${symbolCandidate} ${modeCandidate}`);
      return { 
        cmd: 'ticket', 
        args: [symbolCandidate, modeCandidate],  // 🔧 关键：保留完整参数
        flags: {} 
      };
    } else if (isChineseCompanyName) {
      // 🧠 中文公司名，需要 AI 翻译
      console.log(`[PARSER][AI-ROUTE] 中文公司名 "${symbolCandidate}"，转交 AI 语义理解`);
      return { cmd: 'public', args: [cleanText], flags: {} };
    }
    
    // 🆕 v7.1 STEP 1.5: 检测交易所前缀 + 股票代码的组合
    // 例如 "西班牙col" → 提取 "col" 并标记交易所提示
    const EXCHANGE_PREFIX_MAP = {
      '西班牙': 'BME', '香港': 'HKEX', '中国': 'SSE', '日本': 'TSE',
      '英国': 'LSE', '德国': 'XETRA', '法国': 'EPA', '加拿大': 'TSX',
      '澳大利亚': 'ASX', '巴西': 'BVMF', '港股': 'HKEX', 'A股': 'SSE'
    };
    
    for (const [prefix, exchange] of Object.entries(EXCHANGE_PREFIX_MAP)) {
      if (symbolCandidate.startsWith(prefix.toUpperCase()) || parts[1].startsWith(prefix)) {
        // 提取交易所后的股票代码
        const tickerPart = parts[1].slice(prefix.length).toUpperCase();
        if (tickerPart && /^[A-Z0-9]{1,10}$/.test(tickerPart)) {
          // 格式化为 交易所:代码
          const formattedSymbol = `${exchange}:${tickerPart}`;
          console.log(`[PARSER][EXCHANGE-PREFIX] 交易所前缀解析: "${parts[1]}" → ${formattedSymbol}`);
          return {
            cmd: 'ticket',
            args: [formattedSymbol, modeCandidate],  // 🔧 保留模式
            flags: { exchangeHint: exchange }
          };
        }
      }
    }
  }
  
  // ═══ STEP 2: 检测交易所提示（未匹配 STEP 1）→ AI 处理 ═══
  // 注意：如果已在 STEP 1.5 处理，不会到达这里
  const hasExchangeHint = EXCHANGE_HINTS.some(kw => 
    cleanText.toLowerCase().includes(kw.toLowerCase())
  );
  
  if (hasExchangeHint) {
    // 🆕 v7.1: 尝试提取模式参数，即使走 AI 路径也保留
    const modeForAI = parts.length > 2 ? parts.slice(2).join(' ') : null;
    console.log(`[PARSER][AI-ROUTE] 检测到交易所提示，转交 AI 处理: "${cleanText}"${modeForAI ? `, 模式: ${modeForAI}` : ''}`);
    return { cmd: 'public', args: [cleanText], flags: { outputMode: modeForAI } };
  }
  
  // ═══ STEP 3: 自然语言模式（AI 后备） ═══
  // 仅用于非结构化的自然语言，如 "看看苹果"、"帮我分析英伟达"
  const nlPatterns = [
    /^看[看一下]*\s*([\u4e00-\u9fa5]{2,6}|[A-Z]{1,5})$/i,           // 看看 苹果/NVDA
    /^帮我[解分][析读票]?\s*([\u4e00-\u9fa5]{2,6}|[A-Z]{1,5})$/i,   // 帮我解析 苹果
    /^([\u4e00-\u9fa5]{2,6}|[A-Z]{2,5})\s*怎么样/i,                  // 苹果/NVDA 怎么样
    /^([\u4e00-\u9fa5]{2,6}|[A-Z]{2,5})\s*走势/i,                    // 苹果/TSLA 走势
  ];
  
  for (const pattern of nlPatterns) {
    const match = cleanText.match(pattern);
    if (match && match[1]) {
      const target = match[1].trim();
      
      // 跳过模式关键词
      if (MODE_KEYWORDS.includes(target)) continue;
      
      // 中文 → AI 翻译
      if (/^[\u4e00-\u9fa5]+$/.test(target)) {
        console.log(`[PARSER][NL-AI] 自然语言中文 "${target}"，转交 AI`);
        return { cmd: 'public', args: [cleanText], flags: {} };
      }
      
      // 英文股票代码 → 直接 ticket
      console.log(`[PARSER][NL-DIRECT] 自然语言匹配: "${cleanText}" → ticket ${target}`);
      return { cmd: 'ticket', args: [target.toUpperCase()], flags: {} };
    }
  }

  // ═══ STEP 4: 标准命令解析 ═══
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
  const firstPart = parts[0].toLowerCase();
  let args = parts.slice(1);
  let flags = {};
  
  // Map commands (both English and Chinese)
  let cmd = null;
  
  // Ticket commands (扩展别名) - 这里不再需要额外检查，因为 STEP 1 已处理
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
