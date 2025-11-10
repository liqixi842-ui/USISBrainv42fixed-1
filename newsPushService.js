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
    const symbols = newsItem.symbols || [];
    const time = new Date(newsItem.published_at).toLocaleString('zh-CN', { 
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Generate hashtags for search
    const hashtags = this.generateHashtags(newsItem, score);

    // Build message
    let message = `🚨 *突发新闻* \\(评分: ${score}/10\\)\n\n`;
    message += `📰 *${this.escapeMarkdown(newsItem.title)}*\n\n`;
    
    // Symbols with hashtags
    if (symbols.length > 0) {
      const symbolTags = symbols.slice(0, 5).map(s => `#${s}`).join(' ');
      message += `🏷️ ${symbolTags}\n`;
    }
    
    message += `⏰ ${time}\n`;
    message += `📊 来源: ${newsItem.source || '未知'}\n\n`;
    
    // Summary
    const summary = newsItem.summary || newsItem.title;
    message += `${this.escapeMarkdown(summary)}\n\n`;
    
    // Link
    message += `🔗 [查看原文](${newsItem.url})\n\n`;
    
    // Hashtags for categorization
    message += `${hashtags}\n\n`;
    message += `_USIS Brain 新闻系统 v2\\.0 | 快讯通道_`;

    return message;
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
    const timestamp = new Date().toLocaleString('zh-CN', { 
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    let message = `${header}\n⏰ ${timestamp}\n\n`;

    // Sort by score (highest first)
    const sorted = newsItems.sort((a, b) => (b.composite_score || 0) - (a.composite_score || 0));

    sorted.slice(0, 10).forEach((item, index) => {
      const score = item.composite_score || 0;
      const symbols = item.symbols?.slice(0, 3) || [];
      const symbolTags = symbols.map(s => `#${s}`).join(' ');
      
      message += `${index + 1}\\. *${this.escapeMarkdown(item.title)}*\n`;
      message += `   📊 ${score}/10`;
      if (symbolTags) message += ` | ${symbolTags}`;
      message += `\n   🔗 [查看原文](${item.url})\n\n`;
    });

    if (newsItems.length > 10) {
      message += `_\\.\\.\\.还有 ${newsItems.length - 10} 条新闻_\n\n`;
    }

    message += `\\-\\-\\-\n_USIS Brain 新闻系统 v2\\.0_`;

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
   * Generate hashtags for news categorization
   */
  generateHashtags(newsItem, score) {
    const tags = [];

    // Exact score tag (for precise search like "7分以上")
    const scoreInt = Math.floor(score);
    tags.push(`#评分${scoreInt}分`);

    // Score range tags
    if (score >= 9) tags.push('#极端重要');
    else if (score >= 7) tags.push('#突发');
    else if (score >= 5) tags.push('#重要');

    // Category tags based on title/summary
    const text = `${newsItem.title} ${newsItem.summary || ''}`.toLowerCase();
    
    if (text.includes('earning') || text.includes('财报') || text.includes('revenue')) tags.push('#财报');
    if (text.includes('merger') || text.includes('acquisition') || text.includes('并购') || text.includes('收购')) tags.push('#并购');
    if (text.includes('fed') || text.includes('美联储') || text.includes('rate') || text.includes('利率')) tags.push('#货币政策');
    if (text.includes('ipo') || text.includes('上市')) tags.push('#IPO');
    if (text.includes('lawsuit') || text.includes('诉讼') || text.includes('fraud')) tags.push('#法律');
    if (text.includes('ceo') || text.includes('cfo') || text.includes('高管')) tags.push('#高管');
    if (text.includes('bankruptcy') || text.includes('破产') || text.includes('default')) tags.push('#危机');
    
    // Source tag
    if (newsItem.source) {
      tags.push(`#${newsItem.source.replace(/\s+/g, '')}`);
    }

    return tags.join(' ');
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
