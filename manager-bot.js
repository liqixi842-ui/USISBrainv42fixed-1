/**
 * 主管机器人 - Manager Bot
 * @qixizhuguan_bot
 * 
 * 功能：
 * - 机器人通讯录管理
 * - 权限控制（OWNER私聊 + 授权群聊）
 * - 机器人状态监控
 * 
 * 命令：
 * - /bots - 显示所有登记的机器人
 * - /botinfo <id> - 显示单个机器人详情
 */

const { Telegraf } = require('telegraf');
const botsRegistry = require('./bots_registry.json');

class ManagerBot {
  constructor(config = {}) {
    this.token = config.token || process.env.MANAGER_BOT_TOKEN;
    this.ownerId = parseInt(config.ownerId || process.env.OWNER_TELEGRAM_ID);
    this.allowedGroupIds = config.allowedGroupIds || [];
    
    if (!this.token) {
      throw new Error('❌ MANAGER_BOT_TOKEN not configured');
    }
    
    if (!this.ownerId) {
      throw new Error('❌ OWNER_TELEGRAM_ID not configured');
    }
    
    this.bot = new Telegraf(this.token);
    this.setupHandlers();
    
    console.log('🤖 [ManagerBot] Initialized');
    console.log(`👤 [ManagerBot] Owner ID: ${this.ownerId}`);
    console.log(`📋 [ManagerBot] Registered bots: ${Object.keys(botsRegistry).length}`);
  }

  /**
   * 权限检查：是否为OWNER
   */
  isOwner(userId) {
    return userId === this.ownerId;
  }

  /**
   * 权限检查：是否在授权的群组中
   */
  isAuthorizedGroup(chatId) {
    return this.allowedGroupIds.includes(chatId);
  }

  /**
   * 权限检查：是否可以使用命令
   */
  canUseCommand(ctx) {
    const userId = ctx.from?.id;
    const chatType = ctx.chat?.type;
    const chatId = ctx.chat?.id;
    
    // 1. 私聊：只有OWNER可以使用
    if (chatType === 'private') {
      return this.isOwner(userId);
    }
    
    // 2. 群聊：必须是授权的群组
    if (chatType === 'group' || chatType === 'supergroup') {
      return this.isAuthorizedGroup(chatId) && this.isOwner(userId);
    }
    
    return false;
  }

  /**
   * 设置外部处理器（由 index.js 注入）
   */
  setExternalHandlers(handlers) {
    this.externalHandlers = handlers || {};
    console.log('📌 [ManagerBot] External handlers registered:', Object.keys(this.externalHandlers));
  }

  /**
   * 安全提取股票代码（防止误识别关键词）
   */
  extractStockSymbol(text) {
    // 保留关键词黑名单（不能被识别为股票代码）
    const RESERVED_KEYWORDS = new Set([
      'START', 'HELP', 'STATUS', 'TEST', 'STOP', 'INFO', 'ABOUT',
      '解票', '分析', '研报', '双语', '聊天版', '人话版', '完整版', '标准版'
    ]);
    
    // 移除常见命令词和修饰词
    const cleaned = text
      .replace(/@\w+\s*/g, '') // 移除 @mention
      .replace(/^(解票|分析|\/解票|\/分析|\/start|start)\s*/i, '') // 移除命令前缀
      .replace(/(双语|聊天版|人话版|完整版|标准版)/g, '') // 移除模式词
      .trim();
    
    // 提取所有可能的股票代码（1-10个字符，字母开头）
    const matches = cleaned.match(/\b([A-Z][A-Z0-9.:-]{0,9})\b/g);
    
    if (!matches || matches.length === 0) {
      return null;
    }
    
    // 过滤掉保留关键词
    const validSymbols = matches.filter(sym => !RESERVED_KEYWORDS.has(sym.toUpperCase()));
    
    // 返回第一个有效的股票代码
    return validSymbols.length > 0 ? validSymbols[0] : null;
  }

  /**
   * 设置命令处理器 + 消息路由
   */
  setupHandlers() {
    // 🆕 消息路由：监听所有文本消息
    this.bot.on('text', async (ctx) => {
      const text = ctx.message.text;
      const chatId = ctx.chat.id;
      const userId = ctx.from.id;
      
      console.log(`\n📨 [ManagerBot] Received: "${text}" from user ${userId}`);
      
      // 1️⃣ 检测解票/分析命令
      if (/解票|\/解票|分析/i.test(text) && !/研报/.test(text)) {
        console.log('🎯 [ManagerBot] Routing to Research Bot (解票功能)');
        
        const symbol = this.extractStockSymbol(text);
        console.log(`[DEBUG ticket] Original: "${text}" → Extracted: "${symbol}"`);
        
        if (!symbol || !/^[A-Z][A-Z0-9.:-]{0,9}$/.test(symbol)) {
          await ctx.reply('❌ 无法识别股票代码，请使用格式：解票 NVDA 或 分析 TSLA 双语');
          return;
        }
        
        // 提取模式（handleTicketAnalysis 只识别4种精确格式）
        let mode = '标准版';
        if (/完整版/.test(text)) {
          mode = '完整版';  // 完整版 = 中文 + 英文 + 人话版
        } else if (/双语/.test(text) && /聊天版|人话版/.test(text)) {
          mode = '完整版';  // 双语+聊天版 = 完整版
        } else if (/双语/.test(text)) {
          mode = '双语';    // 双语 = 中文 + 英文标准版
        } else if (/聊天版|人话版/.test(text)) {
          mode = '聊天版';  // 聊天版/人话版 = 人话版
        }
        
        // 发送确认消息
        await ctx.reply(`✅ 收到！正在分析 ${symbol}...`);
        
        // 调用解票处理器（如果已注册）
        if (this.externalHandlers?.handleTicketAnalysis) {
          await this.externalHandlers.handleTicketAnalysis({ symbol, mode, chatId });
        } else {
          await ctx.reply('❌ 解票功能暂不可用');
        }
        return;
      }
      
      // 2️⃣ 检测研报命令
      if (/^(研报|\/研报)/i.test(text)) {
        console.log('📊 [ManagerBot] Routing to Research Bot (研报功能)');
        
        // 发送确认消息
        await ctx.reply('✅ 收到！正在生成研报...');
        
        if (this.externalHandlers?.handleResearchReport) {
          await this.externalHandlers.handleResearchReport({ text, chatId });
        } else {
          await ctx.reply('❌ 研报功能暂不可用');
        }
        return;
      }
      
      // 3️⃣ 其他消息：交给默认命令处理
      // 命令会被 bot.command() 自动处理，这里不需要额外逻辑
    });

    // /start 命令
    this.bot.command('start', async (ctx) => {
      await ctx.reply(
        '👋 欢迎使用USIS Brain智能投研系统！\n\n' +
        '我是主管机器人，负责协调各专职机器人为您服务：\n\n' +
        '🔬 **解票研报机器人** @qixijiepiao_bot\n' +
        '   • 解票 NVDA - 快速技术分析\n' +
        '   • 研报, TSLA, 机构, 分析师, 语言\n\n' +
        '📰 **新闻资讯机器人** @chaojilaos_bot\n' +
        '   • 定时推送金融新闻摘要\n\n' +
        '📋 **管理命令**：\n' +
        '   /bots - 查看所有机器人\n' +
        '   /help - 显示帮助信息',
        { data_testid: 'message-start-response' }
      );
    });

    // /bots 命令 - 显示所有机器人
    this.bot.command('bots', async (ctx) => {
      if (!this.canUseCommand(ctx)) {
        return;
      }
      
      const botsList = this.formatBotsList();
      await ctx.reply(botsList, { 
        data_testid: 'message-bots-list' 
      });
    });

    // /botinfo 命令 - 显示单个机器人详情
    this.bot.command('botinfo', async (ctx) => {
      if (!this.canUseCommand(ctx)) {
        return;
      }
      
      const args = ctx.message.text.split(' ');
      if (args.length < 2) {
        await ctx.reply(
          '❌ 请提供机器人ID\n\n' +
          '用法：/botinfo <id>\n' +
          '示例：/botinfo news',
          { data_testid: 'message-botinfo-error' }
        );
        return;
      }
      
      const botId = args[1].toLowerCase();
      const botInfo = this.formatBotInfo(botId);
      
      if (botInfo) {
        await ctx.reply(botInfo, { 
          data_testid: `message-botinfo-${botId}` 
        });
      } else {
        await ctx.reply(
          `❌ 未找到机器人：${botId}\n\n` +
          `使用 /bots 查看所有可用的机器人`,
          { data_testid: 'message-botinfo-notfound' }
        );
      }
    });

    // /help 命令
    this.bot.command('help', async (ctx) => {
      if (!this.canUseCommand(ctx)) {
        return;
      }
      
      await ctx.reply(
        '🤖 主管机器人 - 帮助文档\n\n' +
        '命令列表：\n' +
        '/bots - 显示所有登记的机器人\n' +
        '/botinfo ID - 显示指定机器人的详细信息\n' +
        '/help - 显示此帮助信息\n\n' +
        '权限说明：\n' +
        '• 私聊：仅OWNER可使用\n' +
        '• 群聊：仅授权群组中的OWNER可使用\n\n' +
        `当前登记机器人：${Object.keys(botsRegistry).length}个`,
        { 
          data_testid: 'message-help-response'
        }
      );
    });

    // 错误处理
    this.bot.catch((err, ctx) => {
      console.error('[ManagerBot] Error:', err);
    });
  }

  /**
   * 格式化机器人列表
   */
  formatBotsList() {
    let message = '🤖 当前登记的机器人：\n\n';
    
    let index = 1;
    for (const [id, bot] of Object.entries(botsRegistry)) {
      const statusIcon = bot.status === 'active' ? '✅' : '⏸️';
      
      message += `${index}) ${id} — @${bot.username}\n`;
      message += `   角色：${bot.role}\n`;
      message += `   状态：${statusIcon} ${bot.status}\n\n`;
      
      index++;
    }
    
    message += `\n💡 使用 /botinfo 命令查看详情`;
    
    return message;
  }

  /**
   * 格式化单个机器人信息
   */
  formatBotInfo(botId) {
    const bot = botsRegistry[botId];
    
    if (!bot) {
      return null;
    }
    
    const statusIcon = bot.status === 'active' ? '✅' : '⏸️';
    
    let message = `🤖 机器人详情\n\n`;
    message += `ID: ${bot.id}\n`;
    message += `用户名: @${bot.username}\n`;
    message += `名称: ${bot.name}\n`;
    message += `角色: ${bot.role}\n`;
    message += `状态: ${statusIcon} ${bot.status}\n\n`;
    message += `描述:\n${bot.description}\n\n`;
    
    if (bot.notes) {
      message += `备注:\n${bot.notes}`;
    }
    
    return message;
  }

  /**
   * 添加授权群组
   */
  addAuthorizedGroup(groupId) {
    if (!this.allowedGroupIds.includes(groupId)) {
      this.allowedGroupIds.push(groupId);
      console.log(`✅ [ManagerBot] Added authorized group: ${groupId}`);
      return true;
    }
    return false;
  }

  /**
   * 移除授权群组
   */
  removeAuthorizedGroup(groupId) {
    const index = this.allowedGroupIds.indexOf(groupId);
    if (index > -1) {
      this.allowedGroupIds.splice(index, 1);
      console.log(`✅ [ManagerBot] Removed authorized group: ${groupId}`);
      return true;
    }
    return false;
  }

  /**
   * 启动机器人
   */
  async start() {
    try {
      await this.bot.launch();
      console.log('✅ [ManagerBot] Bot is running');
    } catch (error) {
      console.error('❌ [ManagerBot] Failed to start:', error.message);
      throw error;
    }
  }

  /**
   * 停止机器人
   */
  stop() {
    this.bot.stop();
    console.log('🛑 [ManagerBot] Bot stopped');
  }
}

// 导出
module.exports = ManagerBot;

// 如果直接运行此文件
if (require.main === module) {
  const bot = new ManagerBot();
  bot.start();
  
  // 优雅退出
  process.once('SIGINT', () => {
    console.log('\n🛑 [ManagerBot] Received SIGINT, stopping...');
    bot.stop();
  });
  
  process.once('SIGTERM', () => {
    console.log('\n🛑 [ManagerBot] Received SIGTERM, stopping...');
    bot.stop();
  });
}
