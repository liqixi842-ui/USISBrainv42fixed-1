// Report Bot - 研报机器人
// Wraps existing research report generation logic with dedicated bot token

const { createTelegramAPI } = require('./telegramUtils');
const { generateReport } = require('../v3_dev/services/devBotHandler');

class ReportBot {
  constructor(botToken) {
    this.botToken = botToken || process.env.TELEGRAM_BOT_TOKEN;
    this.telegramAPI = createTelegramAPI(this.botToken);
    
    console.log(`📊 [ReportBot] Initialized with token: ${this.botToken ? this.botToken.slice(0, 10) + '...' : 'MISSING'}`);
  }

  /**
   * Generate and send research report
   * @param {object} params - Report parameters
   * @param {number} params.chatId - Telegram chat ID
   * @param {string} params.symbol - Stock symbol (e.g., "NVDA")
   * @param {string} params.firm - Institution name
   * @param {string} params.analyst - Analyst name
   * @param {string} params.language - Language code ('en' or 'zh')
   * @returns {Promise<void>}
   */
  async runReportJob({ chatId, symbol, firm = 'USIS Research', analyst = 'USIS Brain', language = 'zh' }) {
    console.log(`\n📊 [ReportBot] Starting report generation`);
    console.log(`   ├─ Symbol: ${symbol}`);
    console.log(`   ├─ Firm: ${firm}`);
    console.log(`   ├─ Analyst: ${analyst}`);
    console.log(`   ├─ Language: ${language}`);
    console.log(`   └─ ChatId: ${chatId}`);
    
    try {
      // Call existing generateReport function from devBotHandler
      // This function handles the complete flow including status messages and PDF sending
      await generateReport({
        symbol,
        firm,
        analyst,
        lang: language,
        chatId,
        telegramAPI: this.telegramAPI,
        botToken: this.botToken,
        commandType: 'supervisor_routed'
      });
      
      console.log(`✅ [ReportBot] Report sent for ${symbol}`);
    } catch (error) {
      console.error(`❌ [ReportBot] Report generation failed:`, error.message);
      
      // Error message already sent by generateReport, just rethrow
      throw error;
    }
  }
}

module.exports = ReportBot;
