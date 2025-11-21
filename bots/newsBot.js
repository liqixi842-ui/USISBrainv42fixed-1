// News Bot - 新闻机器人（多Token架构）
// Uses dedicated NEWS_BOT_TOKEN to send news updates

const { sendWithToken, createTelegramAPI } = require('./telegramUtils');
const { fetchAndRankNews } = require('../newsBroker');

class NewsBot {
  constructor(newsBotToken) {
    this.newsBotToken = newsBotToken || process.env.NEWS_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    this.telegramAPI = createTelegramAPI(this.newsBotToken);  // For convenience methods
    
    console.log(`📰 [NewsBot] Initialized`);
    console.log(`   └─ News Bot Token: ${this.newsBotToken.slice(0, 10)}...`);
  }

  /**
   * Fetch and send top market news to user - Uses NEWS_BOT_TOKEN
   * 
   * @param {object} params - News parameters
   * @param {number} params.chatId - Telegram chat ID
   * @param {Array<string>} params.symbols - Optional stock symbols to filter news
   * @param {number} params.limit - Number of news items to send (default: 5)
   * @param {number} params.timeWindowMinutes - Time window in minutes (default: 120)
   * @returns {Promise<void>}
   */
  async runNewsJob({ chatId, symbols = [], limit = 5, timeWindowMinutes = 120 }) {
    console.log(`\n📰 [NewsBot] Starting news delivery`);
    console.log(`   ├─ ChatId: ${chatId}`);
    console.log(`   ├─ Symbols: ${symbols.join(', ') || 'None (market news)'}`);
    console.log(`   ├─ Limit: ${limit}`);
    console.log(`   ├─ Time Window: ${timeWindowMinutes} minutes`);
    console.log(`   └─ Using: NEWS_BOT_TOKEN`);
    
    let statusMsg = null;
    
    try {
      // Send status message using NEWS_BOT_TOKEN
      statusMsg = await this.telegramAPI('sendMessage', {
        chat_id: chatId,
        text: `📰 新闻机器人正在获取${timeWindowMinutes}分钟内的重要新闻...\n\n⏳ 请稍候...`
      });
      
      // Use existing newsBroker to fetch and rank news
      const rankedNews = await fetchAndRankNews({
        symbols: symbols,
        region: 'US',
        timeWindowMinutes: timeWindowMinutes,
        topN: limit,
        sectors: []
      });
      
      // Delete status message
      if (statusMsg?.result?.message_id) {
        try {
          await this.telegramAPI('deleteMessage', {
            chat_id: chatId,
            message_id: statusMsg.result.message_id
          });
        } catch (delErr) {
          // Ignore delete errors
        }
      }
      
      // Check if news found
      if (!rankedNews || rankedNews.length === 0) {
        await sendWithToken(
          this.newsBotToken,
          chatId,
          `📰 新闻机器人：最近${timeWindowMinutes}分钟内暂无重要新闻\n\n提示：可能是市场休市时段，或者没有重大事件发生。`
        );
        return;
      }
      
      // Send header message using NEWS_BOT_TOKEN
      await sendWithToken(
        this.newsBotToken,
        chatId,
        `📰 Top ${rankedNews.length} 重要新闻（最近${timeWindowMinutes}分钟）\n⏰ ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n\n由新闻机器人为您推送`
      );
      
      // Send each news item using NEWS_BOT_TOKEN
      for (let i = 0; i < rankedNews.length; i++) {
        const item = rankedNews[i];
        const score = item.impact_score || 0;
        
        const title = item.title || 'No Title';
        const summary = item.summary || '';
        const source = item.source || '未知';
        const url = item.url || '';
        
        const publishedTime = new Date(item.datetime).toLocaleString('zh-CN', { 
          timeZone: 'Asia/Shanghai',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        let message = `${i + 1}. ${title}\n\n`;
        message += `📊 影响力评分: ${score.toFixed(2)}/10\n`;
        message += `📌 来源: ${source}\n`;
        message += `⏰ 发布时间: ${publishedTime}\n\n`;
        
        if (summary) {
          message += `📋 ${summary}\n\n`;
        }
        
        message += `🔗 ${url}`;
        
        // Telegram message length limit protection
        if (message.length > 4000) {
          message = message.substring(0, 3900) + '...\n\n🔗 ' + url;
        }
        
        await sendWithToken(this.newsBotToken, chatId, message);
        
        // Rate limiting
        if (i < rankedNews.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      console.log(`✅ [NewsBot] Sent ${rankedNews.length} news items to ${chatId}`);
    } catch (error) {
      console.error(`❌ [NewsBot] News delivery failed:`, error.message);
      
      // Delete status message if exists
      try {
        if (statusMsg?.result?.message_id) {
          await this.telegramAPI('deleteMessage', {
            chat_id: chatId,
            message_id: statusMsg.result.message_id
          });
        }
      } catch (delErr) {
        // Ignore
      }
      
      // Send error message using NEWS_BOT_TOKEN
      try {
        await sendWithToken(
          this.newsBotToken,
          chatId,
          `❌ 新闻机器人：获取新闻时出错\n\n原因: ${error.message}\n\n请稍后重试。`
        );
      } catch (sendError) {
        console.error(`❌ [NewsBot] Failed to send error message:`, sendError.message);
      }
      
      throw error;
    }
  }
}

module.exports = NewsBot;
