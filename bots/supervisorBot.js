// Supervisor Bot - 主管机器人（多Token架构）
// Central message router - ONLY receives messages and routes to worker bots
// Uses SUPERVISOR_BOT_TOKEN exclusively

const { sendWithToken, createTelegramAPI } = require('./telegramUtils');
const { parseUserIntent } = require('../semanticIntentAgent');
const { handleConversation, isGreeting, isHelpRequest } = require('../conversationAgent');

class SupervisorBot {
  constructor(supervisorBotToken, workerBots = {}) {
    this.supervisorBotToken = supervisorBotToken || process.env.SUPERVISOR_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    this.telegramAPI = createTelegramAPI(this.supervisorBotToken);
    this.workerBots = workerBots;
    
    console.log(`👔 [SupervisorBot] Initialized`);
    console.log(`   ├─ Supervisor Bot Token: ${this.supervisorBotToken.slice(0, 10)}...`);
    console.log(`   └─ Worker bots configured:`, Object.keys(workerBots));
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
    console.log(`   └─ Using: SUPERVISOR_BOT_TOKEN`);
    
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
      
      // Send error message to user using SUPERVISOR_BOT_TOKEN
      try {
        await sendWithToken(
          this.supervisorBotToken,
          chatId,
          `❌ 主管机器人：处理您的请求时出错\n\n错误信息: ${error.message}\n\n请稍后重试，或使用 /help 查看帮助。`
        );
      } catch (sendError) {
        console.error(`❌ [SupervisorBot] Failed to send error message:`, sendError.message);
      }
    }
  }

  /**
   * Route intent to appropriate worker bot or handle directly
   * All messages from Supervisor use SUPERVISOR_BOT_TOKEN
   * Worker bots use their own tokens to reply
   */
  async routeIntent(intent, chatId, userId, originalText) {
    const { intentType, entities, reportParams } = intent;
    
    // Case 1: Ticket Analysis / Stock Query → 解票机器人
    if (intentType === 'STOCK_QUERY' || /解票|分析|ticket/i.test(originalText)) {
      console.log(`👔 [SupervisorBot] → Routing to Analysis Bot (Ticket Mode)`);
      
      // Extract symbol from intent or text
      const symbolEntity = entities.find(e => e.type === 'symbol');
      const symbol = symbolEntity?.value || this.extractSymbolFromText(originalText);
      
      if (!symbol) {
        await sendWithToken(
          this.supervisorBotToken,
          chatId,
          '❌ 无法识别股票代码\n\n请使用格式：解票 股票代码 [模式]\n\n示例：\n• 解票 NVDA\n• 解票 NVDA 双语\n• 解票 NVDA 聊天版'
        );
        return;
      }
      
      // Detect mode from text
      const mode = this.detectTicketMode(originalText);
      
      // ✅ Supervisor acknowledgment using SUPERVISOR_BOT_TOKEN
      await sendWithToken(
        this.supervisorBotToken,
        chatId,
        `✅ 收到，我已经安排【解票机器人】帮你分析 ${symbol}\n\n模式：${mode}\n\n稍后解票机器人会直接给你发送分析结果...`
      );
      
      // Delegate to Analysis Bot (will use TICKET_BOT_TOKEN to reply)
      if (this.workerBots.analysisBot) {
        await this.workerBots.analysisBot.runTicketJob({ chatId, symbol, mode });
      } else {
        throw new Error('Analysis Bot not configured');
      }
      return;
    }
    
    // Case 2: Research Report → 研报机器人
    if (intentType === 'RESEARCH_REPORT_V5' || /研报|report/i.test(originalText)) {
      console.log(`👔 [SupervisorBot] → Routing to Analysis Bot (Report Mode)`);
      
      // 🆕 v7.0.1: Relaxed validation - Let generateReport handle parsing
      // If reportParams are available from intent, use them; otherwise pass originalText
      let symbol, firm, analyst, language;
      
      if (reportParams && reportParams.symbol) {
        // Use parsed params from intent
        symbol = reportParams.symbol;
        firm = reportParams.firm || 'USIS Research';
        analyst = reportParams.analyst || 'USIS Brain';
        language = reportParams.lang || 'zh';
      } else {
        // Fall back to parsing from originalText inside Analysis Bot
        // This allows natural language commands to be handled by the legacy parser
        console.log(`   ℹ️  No reportParams from intent - Analysis Bot will parse from text`);
        
        // ✅ Supervisor acknowledgment (generic)
        await sendWithToken(
          this.supervisorBotToken,
          chatId,
          `✅ 收到研报请求，我已经安排【研报机器人】为你处理\n\n稍后研报机器人会直接给你发送PDF报告...`
        );
        
        // Delegate to Analysis Bot with originalText
        if (this.workerBots.analysisBot) {
          await this.workerBots.analysisBot.runReportJobFromText({
            chatId,
            originalText
          });
        } else {
          throw new Error('Analysis Bot not configured');
        }
        return;
      }
      
      // ✅ Supervisor acknowledgment using SUPERVISOR_BOT_TOKEN (with parsed params)
      await sendWithToken(
        this.supervisorBotToken,
        chatId,
        `✅ 收到，我已经安排【研报机器人】帮你生成 ${symbol} 的研究报告\n\n机构：${firm}\n分析师：${analyst}\n语言：${language === 'en' ? '英文' : '中文'}\n\n稍后研报机器人会直接给你发送PDF报告...`
      );
      
      // Delegate to Analysis Bot (will use REPORT_BOT_TOKEN to reply)
      if (this.workerBots.analysisBot) {
        await this.workerBots.analysisBot.runReportJob({
          chatId,
          symbol,
          firm,
          analyst,
          language
        });
      } else {
        throw new Error('Analysis Bot not configured');
      }
      return;
    }
    
    // Case 3: News Request → 新闻机器人
    if (intentType === 'NEWS' || /新闻|news|头条/i.test(originalText)) {
      console.log(`👔 [SupervisorBot] → Routing to News Bot`);
      
      // ✅ Supervisor acknowledgment using SUPERVISOR_BOT_TOKEN
      await sendWithToken(
        this.supervisorBotToken,
        chatId,
        `✅ 收到，我已经安排【新闻机器人】帮你获取今日要闻\n\n稍后新闻机器人会直接给你发送新闻列表...`
      );
      
      // Delegate to News Bot (will use NEWS_BOT_TOKEN to reply)
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
      
      await sendWithToken(
        this.supervisorBotToken,
        chatId,
        '📊 热力图功能开发中...\n\n目前支持的功能：\n• 解票分析\n• 研报生成\n• 新闻推送'
      );
      return;
    }
    
    // Case 5: Casual conversation - Supervisor handles directly using SUPERVISOR_BOT_TOKEN
    console.log(`👔 [SupervisorBot] → Handling casual conversation`);
    
    const conversationResponse = await handleConversation(originalText, userId);
    
    await sendWithToken(
      this.supervisorBotToken,
      chatId,
      conversationResponse || '我是USIS Brain主管机器人。\n\n请使用 /help 查看我能帮你做什么。'
    );
  }

  /**
   * Handle greeting messages - Supervisor replies directly
   */
  async handleGreeting(chatId, userId) {
    const greetings = [
      '你好！我是USIS Brain主管机器人 👔',
      '您好！我是USIS Brain的智能助手',
      'Hi! I\'m the USIS Brain supervisor bot'
    ];
    
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    
    await sendWithToken(
      this.supervisorBotToken,
      chatId,
      `${greeting}\n\n我能帮你：\n• 📊 股票分析（解票 + 研报）\n• 📰 新闻推送（今日重要财经资讯）\n\n输入 /help 查看详细帮助`
    );
  }

  /**
   * Handle help requests - Supervisor replies directly
   */
  async handleHelp(chatId) {
    const helpText = `
🤖 USIS Brain 主管机器人

我是您的智能投资助手，负责协调专业机器人为您服务。

━━━━━━━━━━━━━━━━━━
📊 **股票分析**

我们有专门的【解票机器人】和【研报机器人】为您服务：

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
📰 **新闻推送**

我们有专门的【新闻机器人】为您服务：

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
由主管机器人为您提供`;

    await sendWithToken(this.supervisorBotToken, chatId, helpText);
  }

  /**
   * Handle system info requests - Supervisor replies directly
   */
  async handleSystemInfo(chatId) {
    const systemText = `
🤖 USIS Brain v7.0 系统架构

━━━━━━━━━━━━━━━━━━
**多机器人协作架构**

本系统采用"单进程，多机器人账号"设计：
• 1个 Node.js 进程
• 4个 Telegram 机器人账号

━━━━━━━━━━━━━━━━━━
👔 **主管机器人**（我）
• 接收所有用户消息
• 识别您的意图
• 分配任务给专业机器人

📊 **解票机器人**
• 负责股票技术分析
• 6大维度快速解读
• 支持4种输出模式

📝 **研报机器人**
• 负责生成投资研报
• 专业PDF格式
• 支持中英文

📰 **新闻机器人**
• 负责推送财经新闻
• 智能评分排序
• AI影响解读

━━━━━━━━━━━━━━━━━━
**工作流程**

1️⃣ 您发送消息给我（主管机器人）
2️⃣ 我识别您的需求
3️⃣ 我通知对应的专业机器人
4️⃣ 专业机器人直接给您回复

所有机器人都在同一个群里，但各自以自己的身份说话。

━━━━━━━━━━━━━━━━━━
由主管机器人为您提供`;

    await sendWithToken(this.supervisorBotToken, chatId, systemText);
  }

  /**
   * Extract stock symbol from text
   */
  extractSymbolFromText(text) {
    // Match common stock symbol patterns
    const match = text.match(/\b([A-Z]{1,5})\b/);
    return match ? match[1] : null;
  }

  /**
   * Detect ticket analysis mode from text
   */
  detectTicketMode(text) {
    if (/双语|bilingual/i.test(text)) return '双语';
    if (/聊天|chat|人话/i.test(text)) return '聊天版';
    if (/完整|complete|full/i.test(text)) return '完整版';
    return '标准版';
  }
}

module.exports = SupervisorBot;
