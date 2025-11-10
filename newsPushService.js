/**
 * USIS News v2.0 - Telegram Push Service
 * 
 * Handles news delivery via Telegram:
 * - Fastlane: Instant push for breaking news (≥7/10)
 * - 2h Digest: Curated batch every 2 hours (5-6.9/10)
 * - 4h Digest: Regular batch every 4 hours (3-4.9/10)
 */

const fetch = require('node-fetch');
const { safeQuery } = require('./dbUtils');

class NewsPushService {
  constructor(telegramToken, targetChannelId) {
    this.token = telegramToken;
    this.channelId = targetChannelId; // Telegram channel/group ID for news
    this.apiBase = `https://api.telegram.org/bot${telegramToken}`;
    this.maxRetries = 3;
  }

  /**
   * Push single news item immediately (Fastlane)
   */
  async pushFastlane(newsItem) {
    try {
      const message = this.formatFastlaneMessage(newsItem);
      const result = await this.sendMessage(message);

      // Record push history
      await this.recordPush(newsItem.id, 'fastlane', result);

      console.log(`📤 [Push/Fastlane] Sent: ${newsItem.title.substring(0, 50)}...`);
      return result;

    } catch (error) {
      console.error(`❌ [Push/Fastlane] Failed:`, error.message);
      await this.recordPush(newsItem.id, 'fastlane', null, error.message);
      throw error;
    }
  }

  /**
   * Push digest of multiple news items
   */
  async pushDigest(newsItems, channel) {
    try {
      if (newsItems.length === 0) {
        console.log(`ℹ️  [Push/${channel}] No items to send`);
        return null;
      }

      const message = this.formatDigestMessage(newsItems, channel);
      const result = await this.sendMessage(message);

      // Record push history for all items
      for (const item of newsItems) {
        await this.recordPush(item.id, channel, result);
      }

      console.log(`📤 [Push/${channel}] Sent digest with ${newsItems.length} items`);
      return result;

    } catch (error) {
      console.error(`❌ [Push/${channel}] Failed:`, error.message);
      
      // Record failures
      for (const item of newsItems) {
        await this.recordPush(item.id, channel, null, error.message);
      }
      
      throw error;
    }
  }

  /**
   * Format Fastlane message (single breaking news)
   */
  formatFastlaneMessage(newsItem) {
    const score = newsItem.composite_score || 0;
    const symbols = newsItem.symbols?.join(', ') || 'General';
    const time = new Date(newsItem.published_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

    return `🚨 *BREAKING NEWS* (ImpactRank: ${score}/10)

📰 *${this.escapeMarkdown(newsItem.title)}*

🏷️ ${symbols}
⏰ ${time}

${this.escapeMarkdown(newsItem.summary || '')}

🔗 [阅读原文](${newsItem.url})

---
_USIS Brain News v2.0 | Fastlane_`;
  }

  /**
   * Format digest message (multiple items)
   */
  formatDigestMessage(newsItems, channel) {
    const channelNames = {
      'digest_2h': '📊 2小时重要新闻摘要',
      'digest_4h': '📋 4小时常规新闻摘要'
    };

    const header = channelNames[channel] || '📰 新闻摘要';
    const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

    let message = `${header}\n⏰ ${timestamp}\n\n`;

    // Sort by score (highest first)
    const sorted = newsItems.sort((a, b) => (b.composite_score || 0) - (a.composite_score || 0));

    sorted.slice(0, 10).forEach((item, index) => {
      const score = item.composite_score || 0;
      const symbols = item.symbols?.slice(0, 3).join(', ') || '';
      
      message += `${index + 1}. *${this.escapeMarkdown(item.title)}*\n`;
      message += `   📊 ${score}/10`;
      if (symbols) message += ` | 🏷️ ${symbols}`;
      message += `\n   🔗 ${item.url}\n\n`;
    });

    if (newsItems.length > 10) {
      message += `_...还有 ${newsItems.length - 10} 条新闻_\n\n`;
    }

    message += `---\n_USIS Brain News v2.0_`;

    return message;
  }

  /**
   * Send message to Telegram
   */
  async sendMessage(text, retryCount = 0) {
    try {
      const response = await fetch(`${this.apiBase}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.channelId,
          text: text,
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        })
      });

      const data = await response.json();

      if (!data.ok) {
        throw new Error(`Telegram API error: ${data.description}`);
      }

      return {
        success: true,
        message_id: data.result.message_id
      };

    } catch (error) {
      if (retryCount < this.maxRetries) {
        console.warn(`⚠️  [Push] Retry ${retryCount + 1}/${this.maxRetries}:`, error.message);
        await this.delay(1000 * (retryCount + 1)); // Exponential backoff
        return this.sendMessage(text, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * Record push to database
   */
  async recordPush(newsItemId, channel, result, errorMessage = null) {
    try {
      const outcome = errorMessage ? 'failed' : 'success';
      const messageId = result?.message_id || null;

      await safeQuery(
        `INSERT INTO news_push_history 
         (news_item_id, channel, message_id, outcome, error_message)
         VALUES ($1, $2, $3, $4, $5)`,
        [newsItemId, channel, messageId, outcome, errorMessage]
      );

    } catch (error) {
      console.error('❌ [Push] Failed to record push history:', error.message);
    }
  }

  /**
   * Get push statistics
   */
  async getStats() {
    try {
      const result = await safeQuery(`
        SELECT 
          channel,
          outcome,
          COUNT(*) as count,
          MAX(sent_at) as last_sent
        FROM news_push_history
        WHERE sent_at > NOW() - INTERVAL '24 hours'
        GROUP BY channel, outcome
        ORDER BY channel, outcome
      `);

      return result.rows;

    } catch (error) {
      console.error('❌ [Push] Failed to get stats:', error.message);
      return [];
    }
  }

  /**
   * Escape Markdown special characters
   */
  escapeMarkdown(text) {
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = NewsPushService;
