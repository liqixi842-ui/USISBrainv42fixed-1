// Ticket Bot - 解票机器人
// Wraps existing ticket analysis logic with dedicated bot token

const { createTelegramAPI } = require('./telegramUtils');
const { handleTicketAnalysis } = require('../v3_dev/services/devBotHandler');

class TicketBot {
  constructor(botToken) {
    this.botToken = botToken || process.env.TELEGRAM_BOT_TOKEN;
    this.telegramAPI = createTelegramAPI(this.botToken);
    
    console.log(`🎫 [TicketBot] Initialized with token: ${this.botToken ? this.botToken.slice(0, 10) + '...' : 'MISSING'}`);
  }

  /**
   * Run ticket analysis job
   * @param {object} params - Analysis parameters
   * @param {number} params.chatId - Telegram chat ID
   * @param {string} params.symbol - Stock symbol (e.g., "NVDA")
   * @param {string} params.mode - Analysis mode (标准版, 双语, 聊天版, 完整版)
   * @returns {Promise<void>}
   */
  async runTicketJob({ chatId, symbol, mode = '标准版' }) {
    console.log(`\n🎫 [TicketBot] Starting ticket analysis`);
    console.log(`   ├─ Symbol: ${symbol}`);
    console.log(`   ├─ Mode: ${mode}`);
    console.log(`   └─ ChatId: ${chatId}`);
    
    try {
      // Call existing ticket analysis handler with TicketBot's API
      await handleTicketAnalysis({
        symbol,
        mode,
        chatId,
        telegramAPI: this.telegramAPI
      });
      
      console.log(`✅ [TicketBot] Ticket analysis completed for ${symbol}`);
    } catch (error) {
      console.error(`❌ [TicketBot] Ticket analysis failed:`, error.message);
      
      // Send error message using TicketBot's token
      try {
        await this.telegramAPI('sendMessage', {
          chat_id: chatId,
          text: `❌ 解票机器人：分析 ${symbol} 时出错\n\n原因: ${error.message}`
        });
      } catch (sendError) {
        console.error(`❌ [TicketBot] Failed to send error message:`, sendError.message);
      }
      
      throw error;
    }
  }
}

module.exports = TicketBot;
