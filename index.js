/**
 * ═══════════════════════════════════════════════════════════════
 * USIS Brain v7.0 - Main Entry Point (多机器人主入口)
 * ═══════════════════════════════════════════════════════════════
 * 
 * 架构：Manager-Bot 统一路由模式
 * - 所有消息经过 Manager Bot 解析
 * - 根据命令类型分发到专业化 Bot
 * - 统一错误处理，保证系统不崩溃
 * 
 * 6个专业化 Bot 模块：
 * 1. Ticket Bot - 解票分析（30-60s）
 * 2. News Bot - 新闻简报
 * 3. Heatmap Bot - 热力图生成
 * 4. Report Bot - 研报生成（可选）
 * 5. Public Bot - 帮助/通用消息
 * 6. Supervisor Bot - 系统管理
 */

require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const http = require('http');

// ═══════════════════════════════════════════════════════════════
// HTTP Server for Health Check & Status API
// ═══════════════════════════════════════════════════════════════

const HTTP_PORT = process.env.PORT || 5000;
const startTime = Date.now();

const httpServer = http.createServer((req, res) => {
  const url = req.url;
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // Health check endpoint
  if (url === '/health' || url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'USIS Brain v7.0',
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor((Date.now() - startTime) / 1000)
    }));
    return;
  }
  
  // Status API endpoint
  if (url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'running',
      version: '7.0.0',
      service: 'USIS Brain - Multi-AI Financial Analysis System',
      telegram_bot: 'active',
      modules: {
        ticket_bot: 'ready',
        report_bot: 'ready',
        news_bot: 'ready',
        heatmap_bot: 'ready',
        brief_bot: 'ready',
        deep_report_bot: 'ready',
        supervisor_bot: 'ready',
        public_bot: 'ready'
      },
      supported_markets: ['US', 'Spain', 'HK', 'UK', 'Germany', 'France', 'Japan', 'Canada', 'Australia'],
      supported_languages: ['en', 'zh', 'es'],
      ai_models: ['GPT-5-mini', 'GPT-4o', 'GPT-4o-mini', 'DeepSeek-V3', 'Claude-3.5', 'Perplexity'],
      uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    error: 'Not Found',
    available_endpoints: ['/health', '/api/status']
  }));
});

httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`\n🌐 HTTP Server started on port ${HTTP_PORT}`);
  console.log(`   ├─ Health: http://0.0.0.0:${HTTP_PORT}/health`);
  console.log(`   └─ Status: http://0.0.0.0:${HTTP_PORT}/api/status\n`);
});

// 导入所有 v7 bot 模块（CommonJS 语法）
const managerBot = require('./bots/manager-bot.js');
const { handleTicket } = require('./bots/ticket-bot.js');
const { handleReport, handleReportPdf } = require('./bots/report-bot.js');
const { handlePublic } = require('./bots/public-bot.js');
const { handleSupervisor } = require('./bots/supervisor-bot.js');
const { handleNews } = require('./bots/news-bot.js');
const { handleHeatmap } = require('./bots/heatmap-bot.js');
const { handleBrief } = require('./bots/brief-bot.js');
const { handleDeepReport } = require('./bots/deep-report-bot.js');
const { parseUserIntent } = require('./semanticIntentAgent');
const { getScheduler } = require('./scheduler/newsScheduler');

const { parseCommand, handleManagerBot } = managerBot;
const { getMultiAIProvider } = require('./multiAiProvider');

// ═══════════════════════════════════════════════════════════════
// 🆕 v7.7 AI 智能对话系统 (AI-Powered Conversation)
// ═══════════════════════════════════════════════════════════════

const SYSTEM_CONTEXT = `你是 USIS Brain v7.7，一个机构级多AI金融分析系统。

【你的核心能力】
1. 股票分析：解票分析（技术面+基本面）
2. 研究报告：生成机构级研报（支持PDF）
3. 新闻查询：实时财经新闻聚合
4. 市场热力图：可视化市场涨跌

【技术架构】
- 6个AI模型：GPT-4o、Claude 3.5、Gemini 2.5、DeepSeek V3、Mistral Large、Perplexity Sonar
- 数据源：Finnhub（主）、Twelve Data（全球）、Alpha Vantage（备用）
- 支持交易所：美股、港股、A股、加拿大、欧洲等30+交易所
- 付费API：OpenAI、Anthropic、Google AI、Finnhub、Twelve Data

【使用方式】
- 解票 苹果 / 解票 AAPL → 股票分析
- 研报 NVDA → 研究报告
- 新闻 TSLA → 新闻查询
- 热力图 → 市场热力图

【回答原则】
- 用简洁友好的中文回答
- 如果用户问金融相关问题，可以引导他们使用对应功能
- 对于技术问题，诚实回答系统架构
- 回答控制在200字以内`;

/**
 * AI 智能对话 - 使用 GPT 回答一般性问题
 */
async function handleAIChat(chatId, bot, userMessage, username) {
  console.log(`🤖 [AI-CHAT] 开始智能对话: "${userMessage.substring(0, 50)}..."`);
  
  try {
    const aiProvider = getMultiAIProvider();
    
    const messages = [
      { role: 'system', content: SYSTEM_CONTEXT },
      { role: 'user', content: userMessage }
    ];
    
    const response = await aiProvider.generate('gpt-4o-mini', messages, {
      maxTokens: 500,
      temperature: 0.7
    });
    
    // 注意：generate 返回的是 { success, text, model, ... }
    if (response && response.success && response.text) {
      await bot.sendMessage(chatId, response.text, { parse_mode: 'Markdown' });
      console.log(`✅ [AI-CHAT] 回复成功 (${response.text.length} 字符, 模型: ${response.model})`);
      return { type: 'ai_chat', success: true, model: response.model };
    } else {
      throw new Error(response?.error || 'AI 返回空响应');
    }
  } catch (error) {
    console.error(`❌ [AI-CHAT] 错误: ${error.message}`);
    console.error(error.stack);
    
    // 降级到简单回复
    await bot.sendMessage(chatId, 
      `抱歉，AI 暂时无法回答。\n\n` +
      `你可以试试：\n` +
      `• \`解票 苹果\` - 分析股票\n` +
      `• \`新闻 AAPL\` - 查看新闻\n` +
      `• \`帮助\` - 查看功能菜单`,
      { parse_mode: 'Markdown' }
    );
    return { type: 'ai_chat', success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// 🆕 v7.7 闲聊回复系统 (Casual Conversation Responses)
// ═══════════════════════════════════════════════════════════════

const CASUAL_RESPONSES = {
  greeting: [
    '你好！我是 USIS Brain，你的专业金融分析助手 📈\n\n' +
    '我能做的事情：\n' +
    '📊 **股票分析** - `解票 苹果` 或 `TSLA怎么样`\n' +
    '📰 **新闻查询** - `新闻 AAPL` 或 `重大新闻`\n' +
    '📋 **研究报告** - `研报 NVDA`\n' +
    '🗺️ **热力图** - `热力图` 或 `港股热力图`\n\n' +
    '试试直接说：**看看苹果** 或 **特斯拉怎么样**',
  ],
  identity: [
    '🤖 我是 **USIS Brain v7.7**\n\n' +
    '一个机构级多AI金融分析系统，集成6个顶尖AI模型：\n' +
    '• GPT-4o (通用分析)\n' +
    '• Claude 3.5 (深度研究)\n' +
    '• Gemini 2.5 (快速摘要)\n' +
    '• DeepSeek V3 (中文专家)\n' +
    '• Mistral Large (多语言)\n' +
    '• Perplexity Sonar (实时新闻)\n\n' +
    '支持全球30+交易所：美股、港股、A股、加拿大、欧洲等！\n\n' +
    '想分析哪只股票？直接告诉我公司名或代码即可 🎯',
  ],
  capability: [
    '📋 **USIS Brain 功能菜单**\n\n' +
    '🎫 **股票分析**\n' +
    '• `解票 苹果` - 分析苹果公司\n' +
    '• `TSLA怎么样` - 自然语言查询\n' +
    '• `解票 NVDA 双语` - 中英双语分析\n\n' +
    '📰 **新闻查询**\n' +
    '• `新闻 AAPL` - 获取股票新闻\n' +
    '• `重大新闻` - 今日重要财经消息\n\n' +
    '📊 **研究报告**\n' +
    '• `研报 TSLA` - 生成研究报告\n' +
    '• `研报PDF NVDA` - PDF版报告\n\n' +
    '🗺️ **市场热力图**\n' +
    '• `热力图` - 美股热力图\n' +
    '• `港股热力图` - 港股市场\n\n' +
    '💡 **支持中文公司名**：苹果、特斯拉、英伟达、腾讯、阿里巴巴...\n\n' +
    '直接说 **看看特斯拉** 我就能帮你分析！',
  ],
  smalltalk: [
    '哈哈，闲聊不是我的强项 😅\n\n' +
    '但说到股票和投资，我可是专业的！💪\n\n' +
    '想了解哪只股票？告诉我公司名或代码即可！\n' +
    '例如：`看看苹果` 或 `NVDA怎么样`',
  ],
  thanks: [
    '不客气！随时为您服务 🙌\n\n有任何股票问题，随时问我！',
    '😊 很高兴能帮到你！下次想分析股票时，直接发消息给我~',
  ],
  status: [
    '我很好，系统运行正常！✅\n\n' +
    '24小时在线，随时准备分析股票 📈\n\n' +
    '你想了解哪只股票？',
  ],
};

/**
 * 处理闲聊回复
 */
async function handleCasualResponse(chatId, bot, type, flags) {
  const responses = CASUAL_RESPONSES[type] || CASUAL_RESPONSES.greeting;
  const response = responses[Math.floor(Math.random() * responses.length)];
  
  await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
  console.log(`✅ [CASUAL] 已回复: ${type}`);
  return { type: 'casual', subtype: type };
}

// ═══════════════════════════════════════════════════════════════
// 环境变量和配置
// ═══════════════════════════════════════════════════════════════

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN_DEV;
const OWNER_ID = process.env.OWNER_ID;

if (!TOKEN) {
  console.error('❌ FATAL: TELEGRAM_BOT_TOKEN not configured');
  console.error('   Please set TELEGRAM_BOT_TOKEN or TELEGRAM_BOT_TOKEN_DEV in environment variables');
  process.exit(1);
}

console.log(`\n╔════════════════════════════════════════════════════╗`);
console.log(`║   USIS Brain v7.0 - Multi-Bot System              ║`);
console.log(`║   多机器人架构启动中...                            ║`);
console.log(`╚════════════════════════════════════════════════════╝\n`);

// ═══════════════════════════════════════════════════════════════
// Telegram Bot 初始化（Polling 模式）
// ═══════════════════════════════════════════════════════════════

const bot = new TelegramBot(TOKEN, {
  polling: {
    interval: 300,
    autoStart: true,
    params: {
      timeout: 10
    }
  }
});

console.log(`✅ Telegram Bot initialized (polling mode)`);
console.log(`   ├─ Token: ${TOKEN.substring(0, 10)}...`);
console.log(`   ├─ Owner ID: ${OWNER_ID || 'Not set'}`);
console.log(`   └─ Polling interval: 300ms\n`);

// ═══════════════════════════════════════════════════════════════
// News Scheduler 初始化（自动推送）
// ═══════════════════════════════════════════════════════════════

const NEWS_CHANNEL_ID = process.env.NEWS_CHANNEL_ID;
const ENABLE_NEWS_SYSTEM = process.env.ENABLE_NEWS_SYSTEM === 'true';

if (ENABLE_NEWS_SYSTEM && NEWS_CHANNEL_ID) {
  const newsScheduler = getScheduler({
    enabled: true,
    telegramToken: TOKEN,
    newsChannelId: NEWS_CHANNEL_ID
  });
  
  newsScheduler.start().then(() => {
    console.log(`✅ News Scheduler started`);
    console.log(`   ├─ Channel: ${NEWS_CHANNEL_ID}`);
    console.log(`   └─ Schedule: Every 2 hours (even hours)\n`);
  }).catch(err => {
    console.error(`⚠️  News Scheduler failed to start: ${err.message}`);
  });
} else {
  console.log(`ℹ️  News Scheduler disabled`);
  console.log(`   ├─ ENABLE_NEWS_SYSTEM: ${ENABLE_NEWS_SYSTEM}`);
  console.log(`   └─ NEWS_CHANNEL_ID: ${NEWS_CHANNEL_ID ? 'Set' : 'Not set'}\n`);
}

// ═══════════════════════════════════════════════════════════════
// Bot 模块注册表
// ═══════════════════════════════════════════════════════════════

const BOT_MODULES = {
  ticket: {
    name: 'Ticket Bot',
    handler: handleTicket,
    description: '解票分析（K线+技术面）'
  },
  report: {
    name: 'Report Bot',
    handler: handleReport,
    description: '文本版研报（6节结构）'
  },
  news: {
    name: 'News Bot',
    handler: handleNews,
    description: '新闻简报（评分+去重）'
  },
  brief: {
    name: 'Brief Bot',
    handler: handleBrief,
    description: '极简研报（纯文本）'
  },
  heatmap: {
    name: 'Heatmap Bot',
    handler: handleHeatmap,
    description: '热力图生成（全球市场）'
  },
  supervisor: {
    name: 'Supervisor Bot',
    handler: handleSupervisor,
    description: '系统管理（监控+日志）'
  },
  public: {
    name: 'Public Bot',
    handler: handlePublic,
    description: '帮助+通用消息'
  },
  deepreport: {
    name: 'Deep Report Bot',
    handler: handleDeepReport,
    description: '机构级混合研报（v7 Hybrid）'
  }
};

console.log(`📦 Registered Bot Modules:`);
Object.entries(BOT_MODULES).forEach(([key, module]) => {
  console.log(`   ├─ ${module.name}: ${module.description}`);
});
console.log(`\n`);

// ═══════════════════════════════════════════════════════════════
// 核心消息处理器
// ═══════════════════════════════════════════════════════════════

bot.on('message', async (message) => {
  const chatId = message.chat.id;
  const text = message.text || '';
  const username = message.from?.username || message.from?.first_name || 'unknown';
  
  console.log(`\n┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓`);
  console.log(`┃  📨 NEW MESSAGE RECEIVED                       ┃`);
  console.log(`┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫`);
  console.log(`┃  Chat ID: ${chatId}`);
  console.log(`┃  User: @${username}`);
  console.log(`┃  Text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
  console.log(`┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n`);
  
  try {
    // ═══ STEP 1: 解析命令 ═══
    const { cmd, args, flags } = parseCommand(message);
    
    console.log(`🔍 [PARSER] Command parsed:`);
    console.log(`   ├─ Command: ${cmd || 'null'}`);
    console.log(`   ├─ Args: [${args.join(', ')}]`);
    console.log(`   ├─ Args count: ${args.length}`);
    console.log(`   └─ Flags: ${JSON.stringify(flags)}\n`);
    
    // ═══ STEP 2: 路由到对应 Bot ═══
    let result;
    let targetModule = 'unknown';
    
    switch (cmd) {
      case 'ticket':
        targetModule = 'Ticket Bot';
        console.log(`🎯 [ROUTER] → ${targetModule}`);
        result = await handleTicket(args, chatId, bot, message);
        break;
        
      case 'news':
        targetModule = 'News Bot';
        console.log(`🎯 [ROUTER] → ${targetModule}`);
        result = await handleNews(args, chatId, bot, message);
        break;
        
      case 'brief':
        targetModule = 'Brief Bot';
        console.log(`📄 [ROUTER] → ${targetModule}`);
        result = await handleBrief(args, chatId, bot, message);
        break;
        
      case 'heatmap':
        targetModule = 'Heatmap Bot';
        console.log(`🎯 [ROUTER] → ${targetModule}`);
        result = await handleHeatmap(args, chatId, bot, message);
        break;
        
      case 'supervisor':
        targetModule = 'Supervisor Bot';
        console.log(`🎯 [ROUTER] → ${targetModule}`);
        result = await handleSupervisor(args, chatId, bot, message);
        break;
        
      case 'help':
        targetModule = 'Public Bot (Help)';
        console.log(`🎯 [ROUTER] → ${targetModule}`);
        result = await handlePublic(message, chatId, bot, { isHelp: true });
        break;
        
      case 'report':
        targetModule = 'Report Bot (Text)';
        console.log(`📊 [ROUTER] → ${targetModule}`);
        result = await handleReport(args, chatId, bot, message);
        break;
        
      case 'reportpdf':
        targetModule = flags.premium ? 'Report Bot (PDF Premium)' : 'Report Bot (PDF Basic)';
        console.log(`📄 [ROUTER] → ${targetModule}`);
        result = await handleReportPdf(args, chatId, bot, message, flags);
        break;
        
      case 'deepreport':
        targetModule = 'Deep Report Bot (Institutional)';
        console.log(`🏛️  [ROUTER] → ${targetModule}`);
        result = await handleDeepReport(args, chatId, bot, message);
        break;
      
      case 'casual':
        // 🆕 v7.7 闲聊处理 - 直接回复，不走 AI
        targetModule = `Casual Bot (${args[0] || 'greeting'})`;
        console.log(`💬 [ROUTER] → ${targetModule}`);
        result = await handleCasualResponse(chatId, bot, args[0], flags);
        break;
        
      case 'public':
      default:
        // 🆕 AI 语义理解 - 在放弃之前用 AI 尝试理解用户意图
        console.log(`🧠 [ROUTER] 尝试 AI 语义理解...`);
        try {
          const intent = await parseUserIntent(text);
          
          if (intent && intent.intentType && intent.confidence >= 0.7) {
            console.log(`🎯 [AI] 识别意图: ${intent.intentType} (置信度: ${intent.confidence})`);
            console.log(`🌍 [AI] 交易所提示: ${intent.exchange || '未指定'}`);
            
            // 根据 AI 理解的意图路由
            if (intent.intentType === 'STOCK_QUERY' || intent.intentType === 'stock_query') {
              const symbol = intent.entities?.find(e => e.type === 'symbol' || e.type === 'company')?.value;
              if (symbol) {
                targetModule = intent.exchange 
                  ? `Ticket Bot (via AI + ${intent.exchange})` 
                  : 'Ticket Bot (via AI)';
                console.log(`🎯 [ROUTER] AI 路由 → ${targetModule} (${symbol})`);
                // 🔥 关键修复：传递交易所提示给 ticket-bot
                result = await handleTicket([symbol], chatId, bot, message, { exchangeHint: intent.exchange });
                break;
              }
            } else if (intent.intentType === 'NEWS' || intent.intentType === 'news') {
              targetModule = 'News Bot (via AI)';
              console.log(`🎯 [ROUTER] AI 路由 → ${targetModule}`);
              result = await handleNews([], chatId, bot, message);
              break;
            } else if (intent.intentType === 'HEATMAP' || intent.intentType === 'sector_heatmap') {
              targetModule = 'Heatmap Bot (via AI)';
              console.log(`🎯 [ROUTER] AI 路由 → ${targetModule}`);
              result = await handleHeatmap([], chatId, bot, message);
              break;
            } else if (intent.intentType === 'RESEARCH_REPORT_V5') {
              const symbol = intent.entities?.find(e => e.type === 'symbol')?.value;
              if (symbol) {
                targetModule = 'Report Bot (via AI)';
                console.log(`🎯 [ROUTER] AI 路由 → ${targetModule}`);
                result = await handleReport([symbol], chatId, bot, message);
                break;
              }
            } else if (intent.intentType === 'INSTITUTIONAL_DEEP_REPORT') {
              const symbol = intent.entities?.find(e => e.type === 'symbol')?.value;
              targetModule = 'Deep Report Bot (via AI)';
              console.log(`🎯 [ROUTER] AI 路由 → ${targetModule}`);
              result = await handleDeepReport(symbol ? [symbol] : [], chatId, bot, message);
              break;
            }
          }
        } catch (aiError) {
          console.warn(`⚠️  [AI] 语义理解失败: ${aiError.message}`);
        }
        
        // 🆕 v7.7: 使用 AI 智能对话回答一般性问题
        targetModule = 'AI Chat (Smart Response)';
        console.log(`🤖 [ROUTER] → ${targetModule}`);
        result = await handleAIChat(chatId, bot, text, username);
        break;
    }
    
    // ═══ STEP 3: 记录处理结果 ═══
    console.log(`\n✅ [RESULT] Message processed successfully`);
    console.log(`   ├─ Target: ${targetModule}`);
    console.log(`   ├─ Result type: ${result?.type || 'unknown'}`);
    console.log(`   ├─ Success: ${result?.success !== false ? 'yes' : 'no'}`);
    console.log(`   └─ Duration: ${result?.duration || 'N/A'} ms\n`);
    
  } catch (error) {
    // ═══ 全局错误处理 ═══
    console.error(`\n❌ [ENTRY ERROR] Unhandled error in message processing`);
    console.error(`   ├─ Error type: ${error.name || 'Error'}`);
    console.error(`   ├─ Error message: ${error.message}`);
    console.error(`   └─ Stack trace:`);
    console.error(error.stack);
    console.error(`\n`);
    
    // 发送友好的错误消息给用户
    try {
      await bot.sendMessage(chatId,
        `❌ 系统繁忙，请稍后再试\n\n` +
        `抱歉，处理您的请求时发生错误。\n\n` +
        `建议：\n` +
        `• 稍等片刻后重试\n` +
        `• 检查命令格式是否正确\n` +
        `• 如问题持续，请联系管理员\n\n` +
        `_USIS Brain v7 多机器人系统_`
      );
    } catch (sendError) {
      console.error(`❌ [ENTRY ERROR] Failed to send error message to user:`, sendError.message);
    }
  }
});

// ═══════════════════════════════════════════════════════════════
// Bot 事件监听
// ═══════════════════════════════════════════════════════════════

bot.on('polling_error', (error) => {
  console.error(`\n⚠️  [POLLING ERROR] ${error.code || 'UNKNOWN'}`);
  console.error(`   Message: ${error.message}`);
  
  // 不要因为 polling error 而退出程序
  if (error.code === 'EFATAL') {
    console.error(`   🔴 Fatal polling error detected, but continuing...`);
  }
});

bot.on('error', (error) => {
  console.error(`\n⚠️  [BOT ERROR] ${error.code || 'UNKNOWN'}`);
  console.error(`   Message: ${error.message}`);
});

// ═══════════════════════════════════════════════════════════════
// 启动完成
// ═══════════════════════════════════════════════════════════════

console.log(`╔════════════════════════════════════════════════════╗`);
console.log(`║   ✅ USIS Brain v7.0 启动成功！                    ║`);
console.log(`║                                                    ║`);
console.log(`║   多机器人系统已就绪，等待用户消息...             ║`);
console.log(`║                                                    ║`);
console.log(`║   可用命令：                                       ║`);
console.log(`║   • 解票 NVDA - 技术分析                          ║`);
console.log(`║   • 新闻 AAPL - 新闻简报                          ║`);
console.log(`║   • 热力图 - 市场热力图                           ║`);
console.log(`║   • /help - 帮助信息                              ║`);
console.log(`║                                                    ║`);
console.log(`╚════════════════════════════════════════════════════╝\n`);

// ═══════════════════════════════════════════════════════════════
// 优雅退出处理
// ═══════════════════════════════════════════════════════════════

process.on('SIGINT', async () => {
  console.log(`\n\n🛑 Received SIGINT, shutting down gracefully...`);
  
  try {
    await bot.stopPolling();
    console.log(`✅ Bot polling stopped`);
  } catch (error) {
    console.error(`⚠️  Error stopping bot:`, error.message);
  }
  
  console.log(`👋 USIS Brain v7 shutdown complete\n`);
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log(`\n\n🛑 Received SIGTERM, shutting down gracefully...`);
  
  try {
    await bot.stopPolling();
    console.log(`✅ Bot polling stopped`);
  } catch (error) {
    console.error(`⚠️  Error stopping bot:`, error.message);
  }
  
  console.log(`👋 USIS Brain v7 shutdown complete\n`);
  process.exit(0);
});

// ═══════════════════════════════════════════════════════════════
// 防止未捕获异常导致程序崩溃
// ═══════════════════════════════════════════════════════════════

process.on('uncaughtException', (error) => {
  console.error(`\n💥 [UNCAUGHT EXCEPTION]`);
  console.error(`   Type: ${error.name}`);
  console.error(`   Message: ${error.message}`);
  console.error(`   Stack:`);
  console.error(error.stack);
  console.error(`\n   ⚠️  Bot continues running...\n`);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`\n💥 [UNHANDLED REJECTION]`);
  console.error(`   Reason:`, reason);
  console.error(`   Promise:`, promise);
  console.error(`\n   ⚠️  Bot continues running...\n`);
});
