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

const { parseCommand, handleManagerBot } = managerBot;

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
        
      case 'public':
      default:
        // 🆕 AI 语义理解 - 在放弃之前用 AI 尝试理解用户意图
        console.log(`🧠 [ROUTER] 尝试 AI 语义理解...`);
        try {
          const intent = await parseUserIntent(text);
          
          if (intent && intent.intentType && intent.confidence >= 0.7) {
            console.log(`🎯 [AI] 识别意图: ${intent.intentType} (置信度: ${intent.confidence})`);
            
            // 根据 AI 理解的意图路由
            if (intent.intentType === 'STOCK_QUERY' || intent.intentType === 'stock_query') {
              const symbol = intent.entities?.find(e => e.type === 'symbol' || e.type === 'company')?.value;
              if (symbol) {
                targetModule = 'Ticket Bot (via AI)';
                console.log(`🎯 [ROUTER] AI 路由 → ${targetModule} (${symbol})`);
                result = await handleTicket([symbol], chatId, bot, message);
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
        
        // AI 也无法理解，使用 Public Bot
        targetModule = 'Public Bot (Default)';
        console.log(`🎯 [ROUTER] → ${targetModule}`);
        result = await handlePublic(message, chatId, bot);
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
