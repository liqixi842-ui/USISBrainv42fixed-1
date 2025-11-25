/**
 * ═══════════════════════════════════════════════════════════════
 * USIS Brain v7.2 - News Bot (新闻机器人) - Phase 2 Integration
 * ═══════════════════════════════════════════════════════════════
 * 
 * 职责：股票新闻分析和摘要（Phase 2 统一输出格式）
 * - 获取最新新闻（Finnhub → Alpha Vantage cascade with adapters）
 * - ImpactRank 2.0 智能评分
 * - Phase 2 统一输出（headline, summaryShort, summaryLong, impact, publishedAt）
 * - 多语言支持（EN/CN/ES）通过 newsOutputFormatter
 * 
 * 核心流程：
 * 1. 股票代码规范化和解析
 * 2. 调用 newsQueryService 获取和评分新闻（已包含 adapter 规范化）
 * 3. 调用 newsOutputFormatter 格式化为 Phase 2 schema
 * 4. 格式化并发送 Telegram 消息
 */

const { fetchAndScoreNews } = require('../services/newsQueryService');
const { formatBatchArticles } = require('../services/newsOutputFormatter');
const { logError } = require('./supervisor-bot.js');

/**
 * News Bot 主处理函数
 * @param {Array} args - 命令参数 [symbol]
 * @param {number} chatId - Telegram 聊天室 ID
 * @param {Object} bot - Telegram Bot 实例
 * @param {Object} message - 原始 Telegram 消息对象
 * @returns {Promise<Object>} 处理结果
 */
async function handleNews(args, chatId, bot, message) {
  const startTime = Date.now();
  let statusMsg = null;
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📰 [v7-news] News request received`);
  console.log(`   ├─ Args: [${args.join(', ')}]`);
  console.log(`   ├─ Chat ID: ${chatId}`);
  console.log(`   └─ User: ${message.from?.username || 'unknown'}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  try {
    // ═══ STEP 1: 参数验证 ═══
    if (!args || args.length === 0) {
      console.log(`❌ [NEWS] No symbol provided`);
      await bot.sendMessage(chatId,
        `❌ *新闻命令格式错误*\n\n` +
        `**正确格式：**\n` +
        `\`新闻 股票代码\`\n\n` +
        `**示例：**\n` +
        `• \`新闻 NVDA\`\n` +
        `• \`/news AAPL\`\n` +
        `• \`news TSLA\``,
        { parse_mode: 'Markdown' }
      );
      return {
        type: 'news_error',
        error: 'No symbol provided'
      };
    }
    
    // ═══ STEP 2: 解析参数（股票代码 + limit） ═══
    const symbol = normalizeSymbol(args[0]);
    const limit = args[1] ? parseInt(args[1], 10) : 5; // Default: 5 articles
    
    console.log(`✅ [v7-news] Normalized symbol: ${symbol}`);
    console.log(`   └─ Limit: ${limit} articles\n`);
    
    // ═══ STEP 3: 发送初始状态消息 ═══
    try {
      statusMsg = await bot.sendMessage(chatId,
        `📰 *正在获取 ${symbol} 新闻*\n\n` +
        `⏳ 正在从多个数据源抓取最新消息...\n\n` +
        `(预计 15-30 秒)`,
        { parse_mode: 'Markdown' }
      );
    } catch (sendError) {
      console.error(`⚠️  [NEWS] Failed to send status message: ${sendError.message}`);
    }
    
    // ═══ STEP 4: 获取和评分新闻 (ImpactRank 2.0 + Phase 2 Normalization) ═══
    console.log(`📊 [v7.2-news] Fetching and scoring news with Phase 2 adapters...`);
    const fetchStartTime = Date.now();
    
    const scoredNews = await fetchAndScoreNews(symbol, {
      limit: limit,
      days: 7,
      generateSummaries: false // Phase 2 uses provider summaries + padding
    });
    
    const fetchDuration = Date.now() - fetchStartTime;
    
    console.log(`✅ [NEWS] News fetched and scored in ${fetchDuration} ms`);
    console.log(`   ├─ Total articles: ${scoredNews.length}`);
    console.log(`   └─ Provider adapters applied (Finnhub/Alpha Vantage)\n`);
    
    if (scoredNews.length === 0) {
      console.log(`⚠️  [NEWS] No news found for ${symbol}`);
      
      if (statusMsg) {
        try {
          await bot.deleteMessage(chatId, statusMsg.message_id);
        } catch (deleteError) {
          // Ignore
        }
      }
      
      await bot.sendMessage(chatId,
        `📰 *${symbol} 新闻*\n\n` +
        `暂无最新新闻。\n\n` +
        `可能原因：\n` +
        `• 股票代码不正确\n` +
        `• 近期无重大新闻\n` +
        `• API 数据延迟\n\n` +
        `请稍后重试或检查股票代码。`,
        { parse_mode: 'Markdown' }
      );
      
      return {
        type: 'news_result',
        symbol: symbol,
        news: [],
        success: true
      };
    }
    
    // ═══ STEP 5: 更新状态消息 ═══
    if (statusMsg) {
      try {
        await bot.editMessageText(
          `📰 *正在获取 ${symbol} 新闻*\n\n` +
          `✅ 找到 ${scoredNews.length} 条新闻\n` +
          `⏳ 正在格式化输出 (Phase 2)...`,
          {
            chat_id: chatId,
            message_id: statusMsg.message_id,
            parse_mode: 'Markdown'
          }
        );
      } catch (editError) {
        console.error(`⚠️  [NEWS] Failed to update status: ${editError.message}`);
      }
    }
    
    // ═══ STEP 6: 格式化为 Phase 2 统一输出 ═══
    console.log(`📦 [NEWS] Formatting articles with Phase 2 schema...`);
    const formatStartTime = Date.now();
    
    // Use newsOutputFormatter to get Phase 2 unified schema
    const formattedNews = formatBatchArticles(scoredNews, 'en');
    
    const formatDuration = Date.now() - formatStartTime;
    console.log(`✅ [NEWS] Phase 2 formatting completed in ${formatDuration} ms`);
    console.log(`   └─ Output: headline, summaryShort (100-150w), summaryLong (300-500w), impact{}, publishedAt\n`);
    
    // ═══ STEP 7: 删除状态消息 ═══
    if (statusMsg) {
      try {
        await bot.deleteMessage(chatId, statusMsg.message_id);
      } catch (deleteError) {
        console.error(`⚠️  [NEWS] Failed to delete status: ${deleteError.message}`);
      }
    }
    
    // ═══ STEP 8: 格式化并发送新闻 ═══
    const messages = formatNewsMessages(symbol, formattedNews);
    
    console.log(`📤 [NEWS] Sending ${messages.length} message(s)...`);
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      
      try {
        await bot.sendMessage(chatId, msg, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        });
        
        // Add delay between messages to avoid rate limiting
        if (i < messages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (sendError) {
        console.error(`❌ [NEWS] Failed to send message ${i + 1}: ${sendError.message}`);
        
        // Try without markdown if it fails
        try {
          await bot.sendMessage(chatId, msg.replace(/[*_`\[]/g, ''));
        } catch (fallbackError) {
          console.error(`❌ [NEWS] Fallback send also failed: ${fallbackError.message}`);
        }
      }
    }
    
    // ═══ STEP 9: 记录完成 ═══
    const totalDuration = Date.now() - startTime;
    
    console.log(`\n✅ [NEWS] Phase 2 news request completed in ${totalDuration} ms`);
    console.log(`   ├─ Symbol: ${symbol}`);
    console.log(`   ├─ Articles sent: ${formattedNews.length}`);
    console.log(`   ├─ Fetch duration: ${fetchDuration} ms`);
    console.log(`   ├─ Format duration: ${formatDuration} ms`);
    console.log(`   └─ Total duration: ${totalDuration} ms`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    return {
      type: 'news_result',
      symbol: symbol,
      news: formattedNews,
      success: true,
      duration: totalDuration,
      phase: 'Phase 2'
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error(`\n❌ [NEWS] ERROR after ${duration} ms`);
    console.error(`   ├─ Error type: ${error.name || 'Error'}`);
    console.error(`   ├─ Error message: ${error.message}`);
    console.error(`   └─ Stack trace:`);
    console.error(error.stack);
    console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    // 记录错误到 Supervisor
    logError({
      timestamp: new Date().toISOString(),
      type: error.name,
      message: `[NEWS] ${error.message}`,
      stack: error.stack
    });
    
    // 删除状态消息
    if (statusMsg) {
      try {
        await bot.deleteMessage(chatId, statusMsg.message_id);
      } catch (deleteError) {
        // Ignore
      }
    }
    
    // 发送错误消息
    try {
      await bot.sendMessage(chatId,
        `❌ *新闻获取失败*\n\n` +
        `标的: ${args[0] || 'unknown'}\n\n` +
        `原因: ${error.message}\n\n` +
        `建议：\n` +
        `• 检查股票代码是否正确\n` +
        `• 稍后重试\n` +
        `• 如问题持续，请联系管理员`,
        { parse_mode: 'Markdown' }
      );
    } catch (sendError) {
      console.error(`❌ [NEWS] Failed to send error message: ${sendError.message}`);
    }
    
    return {
      type: 'news_error',
      symbol: args[0] || 'unknown',
      error: error.message,
      duration: duration,
      success: false
    };
  }
}

/**
 * 规范化股票代码
 * @param {string} rawSymbol - 原始股票代码
 * @returns {string} 规范化的股票代码
 */
function normalizeSymbol(rawSymbol) {
  let symbol = rawSymbol.toUpperCase().trim();
  
  // 处理特殊格式
  // 港股：0700.HK → 0700.HK
  // A股：600519.SS → 600519.SS
  // 日股：9984.T → 9984.T
  // 美股：NVDA → NVDA
  
  // 移除多余空格
  symbol = symbol.replace(/\s+/g, '');
  
  return symbol;
}

/**
 * 格式化新闻消息（多条消息，避免超长） - Phase 2 Format
 * @param {string} symbol - 股票代码
 * @param {Array} news - Phase 2 格式化的新闻数组
 * @returns {Array<string>} 消息数组
 */
function formatNewsMessages(symbol, news) {
  const messages = [];
  
  // Header message - Phase 2 format
  let header = `📰 *${symbol} 最新新闻简报*\n\n`;
  header += `🔍 共 ${news.length} 条新闻 | Phase 2 统一输出\n`;
  header += `⚡ ImpactRank 2.0 评分 + 智能摘要\n`;
  header += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  
  messages.push(header);
  
  // Each article as separate message
  news.forEach((article, index) => {
    const msg = formatSingleArticle(article, index + 1);
    messages.push(msg);
  });
  
  return messages;
}

/**
 * 格式化单条新闻 - Phase 2 Format
 * @param {Object} article - Phase 2 格式化的新闻文章
 * @param {number} index - 序号
 * @returns {string} 格式化的消息文本
 * 
 * Phase 2 Schema:
 * {
 *   headline: string,
 *   summaryShort: string (100-150 words),
 *   summaryLong: string (300-500 words),
 *   impact: { score, label, emoji, reason },
 *   source: string,
 *   publishedAt: string (ISO8601),
 *   publishedAgo: string,
 *   url: string,
 *   language: string
 * }
 */
function formatSingleArticle(article, index) {
  // Phase 2: impact object with emoji, score, label, reason
  const { impact } = article;
  const impactEmoji = impact.emoji || '⚪';
  const impactScore = impact.score || 0;
  const impactLabel = impact.label || 'Unknown';
  const impactReason = impact.reason || 'No reason provided';
  
  // Phase 2 format: emoji + score + headline
  let text = `${impactEmoji} *${impactScore.toFixed(1)}/10* ${escapeMarkdown(article.headline)}\n\n`;
  
  // Impact assessment
  text += `📊 *Impact:* ${impactLabel} ${impactEmoji}\n`;
  text += `💡 *Reason:* ${escapeMarkdown(impactReason)}\n\n`;
  
  // Short summary (100-150 words)
  text += `📰 *Quick Summary:*\n`;
  text += `${escapeMarkdown(article.summaryShort)}\n\n`;
  
  // Source and time
  text += `🔗 *Source:* ${escapeMarkdown(article.source)}\n`;
  text += `⏰ *Published:* ${article.publishedAgo}\n`;
  
  // Link to original article
  if (article.url) {
    text += `\n[📄 Read Full Article](${article.url})`;
  }
  
  return text;
}

/**
 * Escape markdown special characters
 * @param {string} text - Input text
 * @returns {string} Escaped text
 */
function escapeMarkdown(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  // Escape Telegram MarkdownV2 special characters
  // Keep basic markdown (* _ `) but escape problematic ones
  return text
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\~/g, '\\~')
    .replace(/\>/g, '\\>')
    .replace(/\#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/\-/g, '\\-')
    .replace(/\=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\./g, '\\.')
    .replace(/\!/g, '\\!');
}

/**
 * 默认导出
 */
module.exports = {
  handleNews
};
