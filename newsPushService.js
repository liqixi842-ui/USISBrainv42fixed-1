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
      const score = parseFloat(item.composite_score) || 0;
      
      // Generate full 3-tier hashtags (v4.0 standard)
      const hashtags = this.generateHashtags(item, score);
      
      message += `${index + 1}\\. *${this.escapeMarkdown(item.title)}*\n`;
      message += `   📊 ${score.toFixed(1)}/10 | ${hashtags}\n`;
      message += `   🔗 [查看原文](${item.url})\n\n`;
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
   * Returns: #评分X分 #地区 #事件类型 #来源
   */
  generateHashtags(newsItem, score) {
    const tags = [];

    // 1. 评分标签 (Score tag)
    const scoreInt = Math.floor(score);
    tags.push(`#评分${scoreInt}分`);

    // Score range tags
    if (score >= 9) tags.push('#极端重要');
    else if (score >= 7) tags.push('#突发');
    else if (score >= 5) tags.push('#重要');

    // 2. 地区标签 (Region tag - Chinese)
    const region = this.detectRegion(newsItem);
    if (region) tags.push(region);

    // 3. 事件分类标签 (Event category tags)
    const eventTags = this.detectEventCategories(newsItem);
    tags.push(...eventTags);
    
    // 4. 来源标签 (Source tag)
    if (newsItem.source) {
      tags.push(`#${newsItem.source.replace(/\s+/g, '')}`);
    }

    return tags.join(' ');
  }

  /**
   * Detect news region based on source and content
   * Returns Chinese region hashtag
   */
  detectRegion(newsItem) {
    const source = (newsItem.source || '').toLowerCase();
    const text = `${newsItem.title} ${newsItem.summary || ''}`.toLowerCase();

    // Priority 1: Source-based detection
    const regionMap = {
      // 美国 (US)
      'wsj': '#美国',
      'marketwatch': '#美国',
      'bloomberg': '#全球',  // Bloomberg is global
      'cnbc': '#美国',
      'yahoo finance': '#美国',
      
      // 加拿大 (Canada)
      'globe and mail': '#加拿大',
      'financial post': '#加拿大',
      'bnn bloomberg': '#加拿大',
      'globeandmail': '#加拿大',
      
      // 西班牙 (Spain)
      'el economista': '#西班牙',
      'expansión': '#西班牙',
      'expansion': '#西班牙',
      
      // 欧洲 (Europe)
      'financial times': '#欧洲',
      'ft': '#欧洲',
      'ecb': '#欧洲',
      'börse frankfurt': '#德国',
      'european financial review': '#欧洲',
      
      // 全球 (Global)
      'reuters': '#全球',
      'investing.com': '#全球',
      'techcrunch': '#全球'
    };

    for (const [key, region] of Object.entries(regionMap)) {
      if (source.includes(key)) {
        return region;
      }
    }

    // Priority 2: Content-based detection
    if (text.includes('canada') || text.includes('toronto') || text.includes('ottawa')) return '#加拿大';
    if (text.includes('spain') || text.includes('madrid') || text.includes('ibex')) return '#西班牙';
    if (text.includes('germany') || text.includes('frankfurt') || text.includes('dax')) return '#德国';
    if (text.includes('uk') || text.includes('britain') || text.includes('london') || text.includes('ftse')) return '#英国';
    if (text.includes('europe') || text.includes('eu') || text.includes('euro')) return '#欧洲';
    if (text.includes('usa') || text.includes('america') || text.includes('fed') || text.includes('nasdaq')) return '#美国';
    if (text.includes('china') || text.includes('beijing') || text.includes('shanghai')) return '#中国';
    if (text.includes('japan') || text.includes('tokyo') || text.includes('nikkei')) return '#日本';

    // Default: Global
    return '#全球';
  }

  /**
   * Detect event categories from title and summary
   * Returns array of event hashtags
   */
  detectEventCategories(newsItem) {
    const tags = [];
    const text = `${newsItem.title} ${newsItem.summary || ''}`.toLowerCase();

    // 财报季节 (Earnings)
    if (text.match(/earning|财报|revenue|profit|eps|guidance|beat|miss|quarterly/)) {
      tags.push('#财报');
    }

    // 并购重组 (M&A)
    if (text.match(/merger|acquisition|buyout|takeover|deal|并购|收购|重组/)) {
      tags.push('#并购');
    }

    // 货币政策 (Monetary Policy)
    if (text.match(/fed|central bank|interest rate|monetary|美联储|央行|利率|降息|加息|ecb/)) {
      tags.push('#货币政策');
    }

    // IPO/上市 (IPO)
    if (text.match(/\bipo\b|initial public offering|listing|上市|首次公开/)) {
      tags.push('#IPO');
    }

    // 法律诉讼 (Legal)
    if (text.match(/lawsuit|litigation|settlement|fraud|investigation|诉讼|起诉|调查/)) {
      tags.push('#法律');
    }

    // 高管变动 (Executive Changes)
    if (text.match(/ceo|cfo|cto|chief|executive|resign|appoint|hire|fire|高管|辞职|任命/)) {
      tags.push('#高管');
    }

    // 危机破产 (Crisis/Bankruptcy)
    if (text.match(/bankruptcy|chapter 11|insolvency|default|crisis|collapse|破产|倒闭|危机/)) {
      tags.push('#危机');
    }

    // 股票回购 (Buyback)
    if (text.match(/buyback|share repurchase|stock repurchase|回购/)) {
      tags.push('#回购');
    }

    // 分红派息 (Dividends)
    if (text.match(/dividend|payout|distribution|分红|派息/)) {
      tags.push('#分红');
    }

    // 分析师评级 (Analyst Ratings)
    if (text.match(/upgrade|downgrade|rating|target price|analyst|分析师|评级|目标价/)) {
      tags.push('#分析师');
    }

    // 监管政策 (Regulation)
    if (text.match(/regulation|regulatory|policy|law|sec|监管|政策|法规/)) {
      tags.push('#监管');
    }

    // 产品发布 (Product Launch)
    if (text.match(/launch|release|unveil|introduce|发布|推出|新品/)) {
      tags.push('#产品');
    }

    // 技术创新 (Innovation)
    if (text.match(/ai|artificial intelligence|innovation|technology|patent|技术|创新|专利/)) {
      tags.push('#科技');
    }

    // 市场波动 (Market Movement)
    if (text.match(/surge|plunge|rally|crash|soar|tumble|spike|暴涨|暴跌|飙升/)) {
      tags.push('#市场波动');
    }

    return tags;
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
