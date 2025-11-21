// Supervisor Bot - 主管机器人
// Central message router for all user interactions

const { createTelegramAPI } = require('./telegramUtils');
const { parseUserIntent } = require('../semanticIntentAgent');
const { handleConversation, isGreeting, isHelpRequest } = require('../conversationAgent');

class SupervisorBot {
  constructor(botToken, workerBots = {}) {
    this.botToken = botToken || process.env.TELEGRAM_BOT_TOKEN;
    this.telegramAPI = createTelegramAPI(this.botToken);
    this.workerBots = workerBots;
    
    console.log(`👔 [SupervisorBot] Initialized with token: ${this.botToken ? this.botToken.slice(0, 10) + '...' : 'MISSING'}`);
    console.log(`👔 [SupervisorBot] Worker bots configured:`, Object.keys(workerBots));
  }

  /**
   * Handle incoming Telegram message (main entry point)
   * @param {object} ctx - Telegram context object from Telegraf
   * @returns {Promise<void>}
   */
  async handleUpdate(ctx) {
    const chatId = ctx.chat.id;
    const userId = ctx.from.id;
    const text = (ctx.message?.text || '').trim();
    
    if (!text) {
      return; // Ignore empty messages
    }
    
    console.log(`\n👔 [SupervisorBot] Received message from user ${userId}: "${text}"`);
    
    try {
      // Quick detection: greetings and help requests
      if (isGreeting(text)) {
        await this.handleGreeting(chatId, userId);
        return;
      }
      
      if (isHelpRequest(text) || text === '/start' || text === '/help') {
        await this.handleHelp(chatId);
        return;
      }
      
      // System info commands
      if (text === '/bots' || text === '/系统' || text === '/机器人') {
        await this.handleSystemInfo(chatId);
        return;
      }
      
      // Parse user intent using AI
      const intent = await parseUserIntent(text, []);
      
      console.log(`👔 [SupervisorBot] Detected intent: ${intent.intentType} (confidence: ${intent.confidence})`);
      
      // Route based on intent type
      await this.routeIntent(intent, chatId, userId, text);
      
    } catch (error) {
      console.error(`❌ [SupervisorBot] Error handling message:`, error.message);
      
      // Send error message to user
      try {
        await this.telegramAPI('sendMessage', {
          chat_id: chatId,
          text: `❌ 主管机器人：处理您的请求时出错\n\n错误信息: ${error.message}\n\n请稍后重试，或使用 /help 查看帮助。`
        });
      } catch (sendError) {
        console.error(`❌ [SupervisorBot] Failed to send error message:`, sendError.message);
      }
    }
  }

  /**
   * Route intent to appropriate worker bot or handle directly
   * @param {object} intent - Parsed intent object
   * @param {number} chatId - Telegram chat ID
   * @param {number} userId - Telegram user ID
   * @param {string} originalText - Original user text
   */
  async routeIntent(intent, chatId, userId, originalText) {
    const { intentType, entities, reportParams } = intent;
    
    // Case 1: Ticket Analysis / Stock Query
    if (intentType === 'STOCK_QUERY' || /解票|分析|ticket/i.test(originalText)) {
      console.log(`👔 [SupervisorBot] → Routing to Analysis Bot (Ticket Mode)`);
      
      // Extract symbol from intent or text
      const symbolEntity = entities.find(e => e.type === 'symbol');
      const symbol = symbolEntity?.value || this.extractSymbolFromText(originalText);
      
      if (!symbol) {
        await this.telegramAPI('sendMessage', {
          chat_id: chatId,
          text: '❌ 无法识别股票代码\n\n请使用格式：解票 股票代码 [模式]\n\n示例：\n• 解票 NVDA\n• 解票 NVDA 双语\n• 解票 NVDA 聊天版'
        });
        return;
      }
      
      // Detect mode from text
      const mode = this.detectTicketMode(originalText);
      
      // Supervisor acknowledgment
      await this.telegramAPI('sendMessage', {
        chat_id: chatId,
        text: `✅ 收到！我已经让【股票分析机器人】帮你解票 ${symbol}\n\n模式：${mode}\n\n稍后它会直接给你发送分析结果...`
      });
      
      // Delegate to Analysis Bot
      if (this.workerBots.analysisBot) {
        await this.workerBots.analysisBot.runTicketJob({ chatId, symbol, mode });
      } else {
        throw new Error('Analysis Bot not configured');
      }
      return;
    }
    
    // Case 2: Research Report
    if (intentType === 'RESEARCH_REPORT_V5' || /研报|report/i.test(originalText)) {
      console.log(`👔 [SupervisorBot] → Routing to Analysis Bot (Report Mode)`);
      
      if (!reportParams || !reportParams.symbol) {
        await this.telegramAPI('sendMessage', {
          chat_id: chatId,
          text: '❌ 研报命令格式错误\n\n正确格式：\n研报, 股票代码, 机构名字, 分析师名字, 语言\n\n示例：\n研报, NVDA, Aberdeen Investments, Anthony Venn Dutton, 英文'
        });
        return;
      }
      
      // Supervisor acknowledgment
      await this.telegramAPI('sendMessage', {
        chat_id: chatId,
        text: `✅ 收到！我已经让【股票分析机器人】帮你生成 ${reportParams.symbol} 的研究报告\n\n机构：${reportParams.firm}\n分析师：${reportParams.analyst}\n语言：${reportParams.lang === 'en' ? '英文' : '中文'}\n\n稍后它会直接给你发送PDF报告...`
      });
      
      // Delegate to Analysis Bot
      if (this.workerBots.analysisBot) {
        await this.workerBots.analysisBot.runReportJob({
          chatId,
          symbol: reportParams.symbol,
          firm: reportParams.firm,
          analyst: reportParams.analyst,
          language: reportParams.lang
        });
      } else {
        throw new Error('Analysis Bot not configured');
      }
      return;
    }
    
    // Case 3: News Request
    if (intentType === 'NEWS' || /新闻|news|头条/i.test(originalText)) {
      console.log(`👔 [SupervisorBot] → Routing to News Bot`);
      
      // Supervisor acknowledgment
      await this.telegramAPI('sendMessage', {
        chat_id: chatId,
        text: `✅ 收到！我已经让【新闻机器人】帮你获取今日要闻\n\n稍后它会直接给你发送新闻列表...`
      });
      
      // Delegate to News Bot
      if (this.workerBots.newsBot) {
        await this.workerBots.newsBot.runNewsJob({ chatId, limit: 5 });
      } else {
        throw new Error('News Bot not configured');
      }
      return;
    }
    
    // Case 4: Heatmap / Sector Analysis
    if (intentType === 'SECTOR_HEATMAP') {
      console.log(`👔 [SupervisorBot] → Handling heatmap request directly`);
      
      await this.telegramAPI('sendMessage', {
        chat_id: chatId,
        text: '📊 热力图功能开发中...\n\n目前支持的功能：\n• 解票分析\n• 研报生成\n• 新闻推送'
      });
      return;
    }
    
    // Case 5: Casual conversation - Supervisor handles directly
    console.log(`👔 [SupervisorBot] → Handling casual conversation`);
    
    const conversationResponse = await handleConversation(originalText, userId);
    
    await this.telegramAPI('sendMessage', {
      chat_id: chatId,
      text: conversationResponse || '我是USIS Brain主管机器人。\n\n请使用 /help 查看我能帮你做什么。'
    });
  }

  /**
   * Handle greeting messages
   */
  async handleGreeting(chatId, userId) {
    const greetings = [
      '你好！我是USIS Brain主管机器人 👔',
      '您好！我是USIS Brain的智能助手',
      'Hi! I\'m the USIS Brain supervisor bot'
    ];
    
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    
    await this.telegramAPI('sendMessage', {
      chat_id: chatId,
      text: `${greeting}\n\n我能帮你：\n• 📊 股票分析（解票 + 研报）\n• 📰 新闻推送（今日重要财经资讯）\n\n输入 /help 查看详细帮助`
    });
  }

  /**
   * Handle help requests
   */
  async handleHelp(chatId) {
    const helpText = `
🤖 USIS Brain 主管机器人

我是您的智能投资助手，负责协调专业机器人为您服务。

━━━━━━━━━━━━━━━━━━
📊 **股票分析**（由股票分析机器人提供）

包含两种模式：

**1. 解票分析** - 快速技术分析，6大维度解读：
• 趋势判断
• 关键价位
• 形态识别
• 指标信号
• 交易建议
• 风险提示

**使用方法：**
解票 股票代码 [模式]

**示例：**
• 解票 NVDA（标准中文版）
• 解票 TSLA 双语（中英文）
• 解票 AAPL 聊天版（人话解读）
• 解票 MSFT 完整版（所有格式）

**2. 研报生成** - 专业投资研究报告，PDF格式：
• 投资论点
• 估值分析
• 行业趋势
• 宏观环境
• 风险提示

**使用方法：**
研报, 股票代码, 机构名字, 分析师名字, 语言

**示例：**
研报, NVDA, Aberdeen Investments, Anthony Venn Dutton, 英文

━━━━━━━━━━━━━━━━━━
📰 **新闻推送**（由新闻机器人提供）

今日重要财经资讯，智能评分：
• 自动翻译（中英文）
• AI投资影响解读
• ImpactRank评分

**使用方法：**
新闻 或 news

━━━━━━━━━━━━━━━━━━
🔧 **系统命令**

/start - 开始使用
/help - 显示帮助
/bots - 查看系统架构
/系统 - 系统信息

━━━━━━━━━━━━━━━━━━
💡 **技术架构**

USIS Brain采用"一个进程，多机器人"架构：
• 主管机器人（我）：接收您的指令，智能路由
• 股票分析机器人：解票 + 研报双模式
• 新闻机器人：财经资讯推送

每个机器人使用独立的Telegram账号，分工明确。

━━━━━━━━━━━━━━━━━━
有任何问题，随时找我！`;

    await this.telegramAPI('sendMessage', {
      chat_id: chatId,
      text: helpText
    });
  }

  /**
   * Handle system info requests
   */
  async handleSystemInfo(chatId) {
    const workerStatus = Object.entries(this.workerBots).map(([name, bot]) => {
      const token = bot.botToken;
      return `• ${name}: ${token ? '✅ 已配置' : '❌ 未配置'}`;
    }).join('\n');
    
    const systemInfo = `
🏗️ USIS Brain 系统架构

**架构模式：** 单进程多机器人

**主管机器人（Supervisor）：**
• 负责接收所有用户消息
• 智能意图识别和路由
• Token: ${this.botToken ? this.botToken.slice(0, 10) + '...' : '未配置'}

**子机器人（Workers）：**
${workerStatus}

━━━━━━━━━━━━━━━━━━
**使用的付费API服务：**

🤖 AI模型（6个）：
• OpenAI GPT-4o/GPT-4o-mini
• Anthropic Claude 3.5 Sonnet
• Google Gemini 2.5 Flash
• DeepSeek V3
• Mistral Large
• Perplexity Sonar Pro

📊 金融数据（4个）：
• Finnhub（美股实时行情）
• Twelve Data（全球市场）
• Alpha Vantage（备用数据）
• FRED（美联储经济数据）

📸 其他服务：
• ScreenshotAPI（图表截图）
• Google Translate（翻译）
• PostgreSQL（数据库）
• N8N（工作流自动化）

━━━━━━━━━━━━━━━━━━
**运行环境：**
• Platform: Replit Reserved VM
• Process ID: ${process.pid}
• Uptime: ${Math.floor(process.uptime())}s
• Node.js: ${process.version}

━━━━━━━━━━━━━━━━━━
输入 /help 查看使用帮助`;

    await this.telegramAPI('sendMessage', {
      chat_id: chatId,
      text: systemInfo
    });
  }

  /**
   * Extract stock symbol from text (simple regex)
   */
  extractSymbolFromText(text) {
    const match = text.match(/\b([A-Z]{1,5})\b/);
    return match ? match[1] : null;
  }

  /**
   * Detect ticket analysis mode from text
   */
  detectTicketMode(text) {
    if (/完整版/.test(text)) {
      return '完整版';
    } else if (/双语/.test(text) && /聊天版|人话版/.test(text)) {
      return '完整版';
    } else if (/双语/.test(text)) {
      return '双语';
    } else if (/聊天版|人话版/.test(text)) {
      return '聊天版';
    }
    return '标准版';
  }
}

module.exports = SupervisorBot;
