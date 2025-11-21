// Analysis Bot - 股票分析机器人（多Token架构）
// Handles both ticket analysis (解票) and research reports (研报)
// Uses different bot tokens for different job types

const { createTelegramAPI, sendWithToken, sendDocumentWithToken } = require('./telegramUtils');
const { handleTicketAnalysis, generateReport } = require('../v3_dev/services/devBotHandler');

class AnalysisBot {
  constructor(ticketBotToken, reportBotToken) {
    // Ticket analysis token (解票机器人)
    this.ticketBotToken = ticketBotToken || process.env.TICKET_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    
    // Research report token (研报机器人) - 可暂时共用ticketBotToken
    this.reportBotToken = reportBotToken || process.env.REPORT_BOT_TOKEN || this.ticketBotToken;
    
    // Create telegramAPI objects for each token
    this.ticketAPI = createTelegramAPI(this.ticketBotToken);
    this.reportAPI = createTelegramAPI(this.reportBotToken);
    
    console.log(`📊 [AnalysisBot] Initialized`);
    console.log(`   ├─ Ticket Bot Token: ${this.ticketBotToken.slice(0, 10)}...`);
    console.log(`   └─ Report Bot Token: ${this.reportBotToken.slice(0, 10)}...`);
    
    if (this.ticketBotToken === this.reportBotToken) {
      console.log(`   ℹ️  Note: Ticket and Report bots sharing same token`);
    }
  }

  /**
   * Run ticket analysis (解票) - Uses TICKET_BOT_TOKEN
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
    console.log(`   ├─ ChatId: ${chatId}`);
    console.log(`   └─ Using: TICKET_BOT_TOKEN`);
    
    try {
      // Call existing ticket analysis handler with TICKET_BOT telegramAPI
      await handleTicketAnalysis({
        symbol,
        mode,
        chatId,
        telegramAPI: this.ticketAPI  // Pass telegramAPI created from TICKET_BOT_TOKEN
      });
      
      console.log(`✅ [AnalysisBot] Ticket analysis completed for ${symbol}`);
    } catch (error) {
      console.error(`❌ [AnalysisBot] Ticket analysis failed:`, error.message);
      
      // Send error message using TICKET_BOT_TOKEN
      try {
        await sendWithToken(
          this.ticketBotToken,
          chatId,
          `❌ 解票机器人：分析 ${symbol} 时出错\n\n原因: ${error.message}`
        );
      } catch (sendError) {
        console.error(`❌ [AnalysisBot] Failed to send error message:`, sendError.message);
      }
      
      throw error;
    }
  }

  /**
   * Generate and send research report (研报) - Uses REPORT_BOT_TOKEN
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
    console.log(`   ├─ ChatId: ${chatId}`);
    console.log(`   └─ Using: REPORT_BOT_TOKEN`);
    
    try {
      // Call existing generateReport function with REPORT_BOT_TOKEN
      await generateReport({
        symbol,
        firm,
        analyst,
        lang: language,
        chatId,
        botToken: this.reportBotToken,  // Use report bot token
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
