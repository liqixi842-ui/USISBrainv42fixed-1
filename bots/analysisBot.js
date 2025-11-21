// Analysis Bot - 股票分析机器人
// Handles both ticket analysis (解票) and research reports (研报)
// Unified bot for all stock analysis features

const { createTelegramAPI } = require('./telegramUtils');
const { handleTicketAnalysis, generateReport } = require('../v3_dev/services/devBotHandler');

class AnalysisBot {
  constructor(botToken) {
    this.botToken = botToken || process.env.TELEGRAM_BOT_TOKEN;
    this.telegramAPI = createTelegramAPI(this.botToken);
    
    console.log(`📊 [AnalysisBot] Initialized with token: ${this.botToken ? this.botToken.slice(0, 10) + '...' : 'MISSING'}`);
  }

  /**
   * Run ticket analysis (解票)
   * @param {object} params - Analysis parameters
   * @param {number} params.chatId - Telegram chat ID
   * @param {string} params.symbol - Stock symbol (e.g., "NVDA")
   * @param {string} params.mode - Analysis mode (标准版, 双语, 聊天版, 完整版)
   * @returns {Promise<void>}
   */
  async runTicketJob({ chatId, symbol, mode = '标准版' }) {
    console.log(`\n📊 [AnalysisBot] Starting ticket analysis`);
    console.log(`   ├─ Symbol: ${symbol}`);
    console.log(`   ├─ Mode: ${mode}`);
    console.log(`   └─ ChatId: ${chatId}`);
    
    try {
      // Call existing ticket analysis handler
      await handleTicketAnalysis({
        symbol,
        mode,
        chatId,
        telegramAPI: this.telegramAPI
      });
      
      console.log(`✅ [AnalysisBot] Ticket analysis completed for ${symbol}`);
    } catch (error) {
      console.error(`❌ [AnalysisBot] Ticket analysis failed:`, error.message);
      
      // Send error message
      try {
        await this.telegramAPI('sendMessage', {
          chat_id: chatId,
          text: `❌ 股票分析机器人：解票 ${symbol} 时出错\n\n原因: ${error.message}`
        });
      } catch (sendError) {
        console.error(`❌ [AnalysisBot] Failed to send error message:`, sendError.message);
      }
      
      throw error;
    }
  }

  /**
   * Generate and send research report (研报)
   * @param {object} params - Report parameters
   * @param {number} params.chatId - Telegram chat ID
   * @param {string} params.symbol - Stock symbol (e.g., "NVDA")
   * @param {string} params.firm - Institution name
   * @param {string} params.analyst - Analyst name
   * @param {string} params.language - Language code ('en' or 'zh')
   * @returns {Promise<void>}
   */
  async runReportJob({ chatId, symbol, firm = 'USIS Research', analyst = 'USIS Brain', language = 'zh' }) {
    console.log(`\n📊 [AnalysisBot] Starting research report generation`);
    console.log(`   ├─ Symbol: ${symbol}`);
    console.log(`   ├─ Firm: ${firm}`);
    console.log(`   ├─ Analyst: ${analyst}`);
    console.log(`   ├─ Language: ${language}`);
    console.log(`   └─ ChatId: ${chatId}`);
    
    try {
      // Call existing generateReport function from devBotHandler
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
      
      console.log(`✅ [AnalysisBot] Research report sent for ${symbol}`);
    } catch (error) {
      console.error(`❌ [AnalysisBot] Research report generation failed:`, error.message);
      
      // Error message already sent by generateReport, just rethrow
      throw error;
    }
  }
}

module.exports = AnalysisBot;
