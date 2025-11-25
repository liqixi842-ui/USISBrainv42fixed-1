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
   * Push single news item immediately (Urgent 10-score news)
   * Renamed from Fastlane in v3.0
   */
  async pushFastlane(newsItem) {
    try {
      const message = this.formatFastlaneMessage(newsItem);
      const result = await this.sendMessage(message, true); // Use Markdown for urgent news

      // Record push history (v3.0: channel = 'urgent_10')
      await this.recordPush(newsItem.id, 'urgent_10', result);

      console.log(`📤 [Push/urgent_10] Sent: ${newsItem.title.substring(0, 50)}...`);
      return result;

    } catch (error) {
      console.error(`❌ [Push/urgent_10] Failed:`, error.message);
      await this.recordPush(newsItem.id, 'urgent_10', null, error.message);
      throw error;
    }
  }

  /**
   * Push digest of multiple news items (v3.1: sends each news as separate message)
   */
  async pushDigest(newsItems, channel) {
    try {
      if (newsItems.length === 0) {
        console.log(`ℹ️  [Push/${channel}] No items to send`);
        return null;
      }

      console.log(`📤 [Push/${channel}] Sending ${newsItems.length} items individually...`);

      // Sort by score (highest first)
      const sorted = newsItems.sort((a, b) => (b.composite_score || 0) - (a.composite_score || 0));
      
      let successCount = 0;
      let failCount = 0;
      
      // Send each news item as separate message
      for (let i = 0; i < sorted.length; i++) {
        const item = sorted[i];
        
        try {
          const message = this.formatSingleDigestItem(item, i + 1, sorted.length, channel);
          const result = await this.sendMessage(message, true); // Use Markdown for clickable links
          
          // Record push history
          await this.recordPush(item.id, channel, result);
          
          successCount++;
          console.log(`  ✅ [${i + 1}/${sorted.length}] ${item.title?.substring(0, 50)}...`);
          
          // Delay between messages to avoid Telegram rate limits (0.5s)
          if (i < sorted.length - 1) {
            await this.delay(500);
          }
          
        } catch (error) {
          failCount++;
          console.error(`  ❌ [${i + 1}/${sorted.length}] Failed:`, error.message);
          await this.recordPush(item.id, channel, null, error.message);
        }
      }

      console.log(`📊 [Push/${channel}] Complete: ${successCount} sent, ${failCount} failed`);
      
      return {
        success: failCount === 0, // true only if all succeeded
        sent: successCount,
        failed: failCount,
        total: sorted.length
      };

    } catch (error) {
      console.error(`❌ [Push/${channel}] Failed:`, error.message);
      throw error;
    }
  }

  /**
   * Format single digest item (v3.3 Fixed: AI commentary already contains headers)
   */
  formatSingleDigestItem(item, index, total, channel) {
    const score = parseFloat(item.composite_score) || 0;
    
    // Use translated content if available (MUST use Chinese title)
    const displayTitle = item.translated_title || item.title;
    const displaySummary = item.translated_summary || item.summary;
    
    // Generate hashtags
    const hashtags = this.generateHashtags(item, score);
    
    // Score emoji
    let scoreEmoji = '📊';
    if (score >= 8.0) scoreEmoji = '⚡';
    else if (score >= 7.0) scoreEmoji = '🔥';
    
    // Build message - Make title prominent with bold and spacing
    let message = `\n${scoreEmoji} *${displayTitle}*\n\n`;
    message += `评分: ${score.toFixed(1)}/10\n\n`;
    
    // AI Commentary already contains formatted headers (📋 详细解读 + 💡 投资影响)
    // Just display it directly without adding extra headers
    if (item.ai_commentary) {
      message += `${item.ai_commentary}\n\n`;
    } else if (displaySummary) {
      // Fallback: if no AI commentary, show summary with header
      message += `📋 详细解读\n`;
      message += `${displaySummary}\n\n`;
    }
    
    // Link - Clickable text using Markdown format
    message += `🔗 [查看原文](${item.url})\n`;
    message += `📌 来源: ${item.source_name || '未知'}\n\n`;
    
    // Hashtags
    message += `${hashtags}\n\n`;
    message += `*USIS Brain 新闻系统 v2\\.0*`;
    
    return message;
  }

  /**
   * Format Fastlane message (single breaking news)
   * NEW: Uses Chinese translation + AI commentary
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

    // Use translated title if available, otherwise original
    const displayTitle = newsItem.translated_title || newsItem.title;
    
    // Use translated summary if available, otherwise original
    const displaySummary = newsItem.translated_summary || newsItem.summary || displayTitle;

    // Generate hashtags for search
    const hashtags = this.generateHashtags(newsItem, score);

    // Build message - NEW FORMAT matching user's preference
    let message = `🚨 ${this.escapeMarkdown(displayTitle)}\n`;
    message += `📊 评分: ${score.toFixed(1)}/10\n\n`;
    
    // 📋 详细解读 section
    if (displaySummary) {
      message += `📋 详细解读\n`;
      message += `${this.escapeMarkdown(displaySummary)}\n\n`;
    }
    
    // 💡 投资影响 section (AI Commentary)
    if (newsItem.ai_commentary) {
      message += `💡 投资影响\n`;
      message += `${this.escapeMarkdown(newsItem.ai_commentary)}\n\n`;
    }
    
    // Link - NEW FORMAT
    message += `🔗 查看原文 (${newsItem.url})\n`;
    message += `📌 来源: ${newsItem.source_name || newsItem.source || '未知'}\n\n`;
    
    // Hashtags
    message += `${hashtags}\n\n`;
    message += `USIS Brain 新闻系统 v2\\.0`;

    return message;
  }

  /**
   * Format digest message (multiple items)
   * NEW v3.0: Uses Chinese translations
   */
  formatDigestMessage(newsItems, channel) {
    const channelNames = {
      'digest_2h': '📊 2小时Top 10新闻',
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
      
      // Use translated content if available (v3.0)
      const displayTitle = item.translated_title || item.title;
      const displaySummary = item.translated_summary || item.summary;
      
      // Stock symbols
      const symbols = item.symbols?.slice(0, 5) || [];
      const symbolTags = symbols.map(s => `#${s}`).join(' ');
      
      // Category hashtags
      const hashtags = this.generateHashtags(item, score);
      
      // Title
      message += `${index + 1}\\. *${this.escapeMarkdown(displayTitle)}*\n`;
      message += `   📊 ${score.toFixed(1)}/10`;
      if (symbolTags) message += ` | ${symbolTags}`;
      message += `\n`;
      
      // Summary (v3.0: show brief excerpt, 60 chars max)
      if (displaySummary) {
        const excerpt = displaySummary.substring(0, 60) + (displaySummary.length > 60 ? '...' : '');
        message += `   📄 ${this.escapeMarkdown(excerpt)}\n`;
      }
      
      // AI Commentary (v3.0)
      if (item.ai_commentary) {
        message += `   💡 ${this.escapeMarkdown(item.ai_commentary)}\n`;
      }
      
      message += `   🔗 [查看原文](${item.url})\n`;
      message += `   ${hashtags}\n\n`;
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
  async sendMessage(text, useMarkdown = false, retryCount = 0) {
    try {
      const payload = {
        chat_id: this.channelId,
        text: text,
        disable_web_page_preview: true
      };
      
      // Only add parse_mode if markdown is needed (for fastlane messages)
      if (useMarkdown) {
        payload.parse_mode = 'Markdown';
      }
      
      const response = await fetch(`${this.apiBase}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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
        return this.sendMessage(text, useMarkdown, retryCount + 1);
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
   * Returns: 至少5个标签 - #评分 #国家 #事件 #板块 #来源
   */
  generateHashtags(newsItem, score) {
    const tags = [];

    // 1. 评分标签 (Score tag) - MUST HAVE
    const scoreInt = Math.floor(score);
    tags.push(`#评分${scoreInt}分`);

    // 2. 国家/地区标签 (Region tag) - MUST HAVE
    const region = this.detectRegion(newsItem);
    tags.push(region || '#全球');

    // 3. 事件分类标签 (Event category tags) - MUST HAVE at least 1
    const eventTags = this.detectEventCategories(newsItem);
    if (eventTags.length > 0) {
      tags.push(eventTags[0]); // 至少取一个事件标签
    } else {
      tags.push('#市场动态'); // 默认事件标签
    }
    
    // 4. 板块标签 (Sector tags) - MUST HAVE at least 1
    const sectorTags = this.detectSectorCategories(newsItem);
    if (sectorTags.length > 0) {
      tags.push(sectorTags[0]); // 至少取一个板块标签
    } else {
      tags.push('#综合'); // 默认板块标签
    }
    
    // 5. 来源标签 (Source tag) - MUST HAVE
    if (newsItem.source_name) {
      tags.push(`#${newsItem.source_name.replace(/\s+/g, '')}`);
    } else if (newsItem.source) {
      tags.push(`#${newsItem.source.replace(/\s+/g, '')}`);
    } else {
      tags.push('#财经新闻');
    }

    // 确保至少有5个标签
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
   * Detect sector categories from title and summary
   * Returns array of sector hashtags (板块标签)
   */
  detectSectorCategories(newsItem) {
    const tags = [];
    const text = `${newsItem.title} ${newsItem.summary || ''}`.toLowerCase();

    // 科技板块 (Technology)
    if (text.match(/apple|microsoft|google|amazon|meta|tesla|nvidia|tech|software|ai|cloud|semiconductor|芯片|科技|软件/)) {
      tags.push('#科技');
    }

    // 金融板块 (Financial)
    if (text.match(/bank|financial|insurance|fintech|payment|credit|loan|银行|金融|保险|支付/)) {
      tags.push('#金融');
    }

    // 能源板块 (Energy)
    if (text.match(/oil|gas|energy|renewable|solar|wind|electric|battery|能源|石油|天然气|电池/)) {
      tags.push('#能源');
    }

    // 医疗健康 (Healthcare)
    if (text.match(/health|pharma|biotech|medical|drug|hospital|healthcare|医疗|制药|生物/)) {
      tags.push('#医疗');
    }

    // 消费板块 (Consumer)
    if (text.match(/retail|consumer|e-commerce|shopping|brand|零售|消费|电商/)) {
      tags.push('#消费');
    }

    // 房地产 (Real Estate)
    if (text.match(/real estate|property|housing|reit|房地产|物业|住房/)) {
      tags.push('#房地产');
    }

    // 工业制造 (Industrial)
    if (text.match(/manufacturing|industrial|machinery|automotive|汽车|制造|工业/)) {
      tags.push('#工业');
    }

    // 通信媒体 (Communication/Media)
    if (text.match(/telecom|media|5g|broadcasting|通信|媒体|电信/)) {
      tags.push('#通信');
    }

    // 航空航天 (Aerospace)
    if (text.match(/airline|aircraft|aviation|aerospace|航空|飞机/)) {
      tags.push('#航空');
    }

    // 加密货币 (Crypto)
    if (text.match(/crypto|bitcoin|blockchain|digital currency|加密|比特币|区块链/)) {
      tags.push('#加密货币');
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
