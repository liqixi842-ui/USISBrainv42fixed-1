/**
 * ═══════════════════════════════════════════════════════════════
 * USIS Brain v7.0 - Heatmap Bot (热力图机器人)
 * ═══════════════════════════════════════════════════════════════
 * 
 * 职责：市场热力图生成和可视化
 * - 支持全球主要市场（美股/欧洲/亚洲）
 * - TradingView 实时热力图截图
 * - 智能市场解析（SP500/NASDAQ/IBEX35等）
 * - AI驱动的视觉分析
 * 
 * 核心流程：
 * 1. 参数解析（默认SP500）
 * 2. 调用热力图服务生成截图
 * 3. 发送图片到Telegram
 * 4. 附带市场分析文本
 */

const { logError } = require('./supervisor-bot.js');

// 使用 CommonJS require 导入（兼容现有模块）
const { generateSmartHeatmap } = require('../heatmapService.js');
const { parseHeatmapQuery } = require('../heatmapIntentParser');

// 🆕 Debug output for parseHeatmapQuery
console.log('[HEATMAP][DEBUG] parseHeatmapQuery type:', typeof parseHeatmapQuery);
console.log('[HEATMAP][DEBUG] parseHeatmapQuery value:', !!parseHeatmapQuery);

/**
 * 映射高级解析结果到 args 参数
 * @param {Object} parsed - parseHeatmapQuery 的返回值
 * @returns {Object|null} { args: [market], options: {...} } 或 null
 */
function mapParsedHeatmapQueryToArgs(parsed) {
  if (!parsed) return null;

  let market = null;

  if (parsed.index) {
    switch (parsed.index.toUpperCase()) {
      case 'SPX500':
      case 'SP500':
        market = 'sp500'; break;
      case 'NAS100':
        market = 'nasdaq'; break;
      case 'DJI30':
        market = 'dow'; break;
      case 'HSI':
        market = 'hk'; break;
      case 'SHCOMP':
      case 'SSE':
        market = 'china'; break;
      case 'IBEX35':
        market = 'spain'; break;
      default:
        break;
    }
  }

  if (!market && parsed.region) {
    switch (parsed.region.toUpperCase()) {
      case 'US': market = 'us'; break;
      case 'HK': market = 'hk'; break;
      case 'CN': market = 'china'; break;
      case 'ES': market = 'spain'; break;
      case 'DE': market = 'germany'; break;
      case 'UK': market = 'uk'; break;
      case 'CA': market = 'canada'; break;
      case 'JP': market = 'japan'; break;
      case 'FR': market = 'france'; break;
      case 'AU': market = 'australia'; break;
      case 'KR': market = 'korea'; break;
      case 'CRYPTO': market = 'crypto'; break;
      default: break;
    }
  }

  if (!market) return null;

  return {
    args: [market],
    options: {
      sector: parsed.sector || null,
      dataset: parsed.dataset || null,
      label: parsed.label || null,
    }
  };
}

/**
 * Heatmap Bot 主处理函数
 * @param {Array} args - 命令参数 [market]
 * @param {number} chatId - Telegram 聊天室 ID
 * @param {Object} bot - Telegram Bot 实例
 * @param {Object} message - 原始 Telegram 消息对象
 * @returns {Promise<Object>} 处理结果
 */
async function handleHeatmap(args, chatId, bot, message) {
  const startTime = Date.now();
  let statusMsg = null;
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🗺️  [HEATMAP] Heatmap request received`);
  console.log(`   ├─ Args: [${args.join(', ')}]`);
  console.log(`   ├─ Chat ID: ${chatId}`);
  console.log(`   └─ User: ${message.from?.username || 'unknown'}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  try {
    const text = message.text || '';
    
    // 🆕 NL-2 关键词短路（Pre-router Shortcircuit）- 最高优先级
    if (!args || args.length === 0) {
      const lowerText = text.toLowerCase();
      let shortcircuitMatch = null;
      
      // 纳指/纳斯达克 关键词
      if (/纳指|纳斯达克|nasdaq|nas100|qqq/i.test(text)) {
        shortcircuitMatch = { index: 'NAS100', region: 'US', keyword: '纳指' };
        args = ['nasdaq'];
      }
      // 标普 关键词
      else if (/标普|sp500|spx|s&p/i.test(text)) {
        shortcircuitMatch = { index: 'SPX500', region: 'US', keyword: '标普' };
        args = ['sp500'];
      }
      // 西班牙/IBEX 关键词
      else if (/西班牙|spain|ibex/i.test(text)) {
        shortcircuitMatch = { index: 'IBEX35', region: 'ES', keyword: '西班牙/IBEX' };
        args = ['spain'];
      }
      // 道琼斯 关键词
      else if (/道指|道琼斯|dow|djia/i.test(text)) {
        shortcircuitMatch = { index: 'DJ30', region: 'US', keyword: '道指' };
        args = ['dow'];
      }
      // 香港/恒生 关键词
      else if (/香港|港股|恒生|hk|hsi/i.test(text)) {
        shortcircuitMatch = { index: 'HSI', region: 'HK', keyword: '香港' };
        args = ['hk'];
      }
      // 🆕 加密货币 关键词
      else if (/币圈|虚拟货币|加密货币|数字货币|crypto|btc|eth|比特币|以太坊/i.test(text)) {
        shortcircuitMatch = { index: 'CRYPTO', region: 'CRYPTO', keyword: '加密货币' };
        args = ['crypto'];
      }
      // 🆕 加拿大/TSX 关键词
      else if (/加拿大|canada|tsx|多伦多/i.test(text)) {
        shortcircuitMatch = { index: 'TSX', region: 'CA', keyword: '加拿大' };
        args = ['canada'];
      }
      // 🆕 德国/DAX 关键词
      else if (/德国|germany|dax|法兰克福/i.test(text)) {
        shortcircuitMatch = { index: 'DAX', region: 'DE', keyword: '德国' };
        args = ['germany'];
      }
      // 🆕 英国/FTSE 关键词
      else if (/英国|uk|ftse|伦敦|富时/i.test(text)) {
        shortcircuitMatch = { index: 'FTSE', region: 'UK', keyword: '英国' };
        args = ['uk'];
      }
      // 🆕 日本/日经 关键词
      else if (/日本|japan|nikkei|东京|日经/i.test(text)) {
        shortcircuitMatch = { index: 'NIKKEI225', region: 'JP', keyword: '日本' };
        args = ['japan'];
      }
      // 🆕 中国/A股 关键词
      else if (/中国|a股|沪深|上证|深证|大陆/i.test(text)) {
        shortcircuitMatch = { index: 'CSI300', region: 'CN', keyword: '中国A股' };
        args = ['china'];
      }
      // 🆕 法国/CAC 关键词
      else if (/法国|france|cac|巴黎/i.test(text)) {
        shortcircuitMatch = { index: 'CAC40', region: 'FR', keyword: '法国' };
        args = ['france'];
      }
      // 🆕 澳大利亚 关键词
      else if (/澳大利亚|澳洲|australia|asx|悉尼/i.test(text)) {
        shortcircuitMatch = { index: 'AS200', region: 'AU', keyword: '澳大利亚' };
        args = ['australia'];
      }
      // 🆕 韩国/KOSPI 关键词
      else if (/韩国|korea|kospi|首尔/i.test(text)) {
        shortcircuitMatch = { index: 'KOSPI', region: 'KR', keyword: '韩国' };
        args = ['korea'];
      }
      
      if (shortcircuitMatch) {
        console.log('[HEATMAP][NL-2] KEYWORD SHORTCIRCUIT matched:', shortcircuitMatch);
        console.log(`   └─ Text: "${text}" → args: ${args}`);
      }
    }
    
    // 🆕 Task NL-2: 高级热力图自然语言解析（仅在无短路匹配时执行）
    if (!args || args.length === 0) {
      try {
        const parsed = await parseHeatmapQuery(text);
        const mapped = mapParsedHeatmapQueryToArgs(parsed);

        if (mapped && mapped.args) {
          console.log('[HEATMAP][NL-2] Advanced parser matched:', parsed);
          args = mapped.args;
        }
      } catch (err) {
        console.error('[HEATMAP][NL-2] parseHeatmapQuery failed, fallback to simple rules:', err);
      }
    }
    
    // ═══ STEP 1: 参数解析 ═══
    const marketInput = args.length > 0 ? args.join(' ') : 'sp500';
    const normalizedQuery = normalizeMarketQuery(marketInput);
    
    console.log(`✅ [HEATMAP] Normalized query: "${normalizedQuery}"`);
    console.log(`   └─ Original input: "${marketInput}"\n`);
    
    // ═══ STEP 2: 发送初始状态消息 ═══
    try {
      statusMsg = await bot.sendMessage(chatId,
        `🗺️  正在生成热力图\n\n` +
        `📊 市场: ${getMarketDisplayName(normalizedQuery)}\n` +
        `⏳ 正在抓取实时数据...\n\n` +
        `(预计 5-15 秒)`
      );
    } catch (sendError) {
      console.error(`⚠️  [HEATMAP] Failed to send status message: ${sendError.message}`);
    }
    
    // ═══ STEP 3: 生成热力图 ═══
    console.log(`📊 [HEATMAP] Calling generateSmartHeatmap...`);
    const generateStartTime = Date.now();
    
    const heatmapResult = await generateSmartHeatmap(normalizedQuery);
    
    const generateDuration = Date.now() - generateStartTime;
    
    console.log(`✅ [HEATMAP] Heatmap generated in ${generateDuration} ms`);
    console.log(`   ├─ Provider: ${heatmapResult.provider || 'unknown'}`);
    console.log(`   ├─ Buffer size: ${heatmapResult.buffer?.length || 0} bytes`);
    console.log(`   ├─ Has AI analysis: ${!!heatmapResult.marketAnalysis}`);
    console.log(`   └─ Has summary: ${!!heatmapResult.summary}\n`);
    
    // ═══ STEP 4: 更新状态消息 ═══
    if (statusMsg) {
      try {
        await bot.editMessageText(
          `🗺️  正在生成热力图\n\n` +
          `✅ 数据获取完成\n` +
          `⏳ 正在发送图片...`,
          {
            chat_id: chatId,
            message_id: statusMsg.message_id
          }
        );
      } catch (editError) {
        console.error(`⚠️  [HEATMAP] Failed to update status: ${editError.message}`);
      }
    }
    
    // ═══ STEP 5: 删除状态消息 ═══
    if (statusMsg) {
      try {
        await bot.deleteMessage(chatId, statusMsg.message_id);
      } catch (deleteError) {
        console.error(`⚠️  [HEATMAP] Failed to delete status: ${deleteError.message}`);
      }
    }
    
    // ═══ STEP 6: 发送热力图截图 ═══
    console.log(`📤 [HEATMAP] Sending heatmap image...`);
    
    // 生成图片说明
    const caption = formatHeatmapCaption(heatmapResult, normalizedQuery);
    
    try {
      await bot.sendPhoto(chatId, heatmapResult.buffer, {
        caption: caption,
        parse_mode: 'Markdown'
      });
      console.log(`✅ [HEATMAP] Image sent successfully`);
    } catch (photoError) {
      console.error(`❌ [HEATMAP] Failed to send photo: ${photoError.message}`);
      throw new Error(`Failed to send heatmap image: ${photoError.message}`);
    }
    
    // ═══ STEP 7: 发送市场分析文本（如果有）═══
    if (heatmapResult.marketAnalysis || heatmapResult.summary) {
      const analysisText = formatMarketAnalysis(heatmapResult);
      
      if (analysisText) {
        console.log(`📤 [HEATMAP] Sending market analysis...`);
        
        try {
          await bot.sendMessage(chatId, analysisText, {
            parse_mode: 'Markdown'
          });
          console.log(`✅ [HEATMAP] Analysis sent successfully`);
        } catch (analysisError) {
          console.error(`⚠️  [HEATMAP] Failed to send analysis: ${analysisError.message}`);
        }
      }
    }
    
    // ═══ STEP 8: 记录完成 ═══
    const totalDuration = Date.now() - startTime;
    
    console.log(`\n✅ [HEATMAP] Request completed in ${totalDuration} ms`);
    console.log(`   ├─ Market: ${normalizedQuery}`);
    console.log(`   ├─ Provider: ${heatmapResult.provider || 'unknown'}`);
    console.log(`   ├─ Generation time: ${generateDuration} ms`);
    console.log(`   └─ Total time: ${totalDuration} ms`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    return {
      type: 'heatmap_result',
      market: normalizedQuery,
      imageUrl: heatmapResult.imageUrl || null,
      provider: heatmapResult.provider,
      success: true,
      duration: totalDuration
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error(`\n❌ [HEATMAP] ERROR after ${duration} ms`);
    console.error(`   ├─ Error type: ${error.name || 'Error'}`);
    console.error(`   ├─ Error message: ${error.message}`);
    console.error(`   └─ Stack trace:`);
    console.error(error.stack);
    console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    // 记录错误到 Supervisor
    logError({
      timestamp: new Date().toISOString(),
      type: error.name,
      message: `[HEATMAP] ${error.message}`,
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
    
    // 发送错误消息（不抛异常）
    try {
      await bot.sendMessage(chatId,
        `❌ 热力图生成失败\n\n` +
        `市场: ${args.join(' ') || 'sp500'}\n\n` +
        `原因: ${getErrorFriendlyMessage(error.message)}\n\n` +
        `建议：\n` +
        `• 检查市场名称是否正确\n` +
        `• 稍后重试\n` +
        `• 如问题持续，请联系管理员\n\n` +
        `💡 *提示：热力图模块暂时开小差了，请稍后再试～*`
      );
    } catch (sendError) {
      console.error(`❌ [HEATMAP] Failed to send error message: ${sendError.message}`);
    }
    
    return {
      type: 'heatmap_error',
      market: args.join(' ') || 'sp500',
      error: error.message,
      duration: duration,
      success: false
    };
  }
}

/**
 * 规范化市场查询
 * @param {string} input - 用户输入
 * @returns {string} 规范化的查询文本
 */
function normalizeMarketQuery(input) {
  const lowerInput = input.toLowerCase().trim();
  
  // 市场别名映射
  const marketAliases = {
    // 美股
    'sp500': 'sp500 热力图',
    's&p500': 'sp500 热力图',
    's&p': 'sp500 热力图',
    'spx': 'sp500 热力图',
    '标普': 'sp500 热力图',
    '美股': 'sp500 热力图',
    'us': 'sp500 热力图',
    
    // 纳斯达克
    'nasdaq': 'nasdaq 热力图',
    'qqq': 'nasdaq 热力图',
    'nas100': 'nasdaq 热力图',
    '纳斯达克': 'nasdaq 热力图',
    '纳指': 'nasdaq 热力图',
    
    // 道琼斯
    'dow': 'dow jones 热力图',
    'dji': 'dow jones 热力图',
    'djia': 'dow jones 热力图',
    '道琼斯': 'dow jones 热力图',
    '道指': 'dow jones 热力图',
    
    // 加密货币
    'crypto': 'crypto 热力图',
    'btc': 'crypto 热力图',
    '加密': 'crypto 热力图',
    '币圈': 'crypto 热力图',
    
    // 其他市场
    'china': 'china 热力图',
    'cn': 'china 热力图',
    '中国': 'china 热力图',
    'a股': 'china 热力图',
    
    'japan': 'japan 热力图',
    'jp': 'japan 热力图',
    '日本': 'japan 热力图',
    
    'spain': 'spain 热力图',
    'es': 'spain 热力图',
    'ibex': 'spain 热力图',
    '西班牙': 'spain 热力图',
    
    'germany': 'germany 热力图',
    'de': 'germany 热力图',
    'dax': 'germany 热力图',
    '德国': 'germany 热力图',
    
    'canada': 'canada 热力图',
    'ca': 'canada 热力图',
    'tsx': 'canada 热力图',
    '加拿大': 'canada 热力图',
    '多伦多': 'canada 热力图',
    
    'uk': 'uk 热力图',
    'ftse': 'uk 热力图',
    '英国': 'uk 热力图',
    '伦敦': 'uk 热力图',
    
    'france': 'france 热力图',
    'fr': 'france 热力图',
    'cac': 'france 热力图',
    '法国': 'france 热力图',
    
    'australia': 'australia 热力图',
    'au': 'australia 热力图',
    'asx': 'australia 热力图',
    '澳大利亚': 'australia 热力图',
    '澳洲': 'australia 热力图',
    
    'korea': 'korea 热力图',
    'kr': 'korea 热力图',
    'kospi': 'korea 热力图',
    '韩国': 'korea 热力图',
    
    'hk': 'hk 热力图',
    'hsi': 'hk 热力图',
    '香港': 'hk 热力图',
    '港股': 'hk 热力图'
  };
  
  // 检查是否有匹配的别名
  if (marketAliases[lowerInput]) {
    return marketAliases[lowerInput];
  }
  
  // 如果包含"热力图"，直接返回
  if (lowerInput.includes('热力图') || lowerInput.includes('heatmap')) {
    return input;
  }
  
  // 默认添加"热力图"后缀
  return `${input} 热力图`;
}

/**
 * 获取市场显示名称
 * @param {string} query - 查询文本
 * @returns {string} 显示名称
 */
function getMarketDisplayName(query) {
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('sp500') || lowerQuery.includes('s&p')) return 'S&P 500';
  if (lowerQuery.includes('nasdaq')) return 'NASDAQ 100';
  if (lowerQuery.includes('dow')) return 'Dow Jones';
  if (lowerQuery.includes('crypto')) return 'Cryptocurrency';
  if (lowerQuery.includes('china')) return 'China A-Shares';
  if (lowerQuery.includes('japan')) return 'Japan Nikkei';
  if (lowerQuery.includes('spain')) return 'Spain IBEX 35';
  if (lowerQuery.includes('germany')) return 'Germany DAX';
  if (lowerQuery.includes('uk')) return 'UK FTSE 100';
  if (lowerQuery.includes('hk') || lowerQuery.includes('hong kong')) return 'Hong Kong HSI';
  if (lowerQuery.includes('canada') || lowerQuery.includes('tsx')) return 'Canada TSX';
  if (lowerQuery.includes('france') || lowerQuery.includes('cac')) return 'France CAC 40';
  if (lowerQuery.includes('australia') || lowerQuery.includes('asx')) return 'Australia ASX';
  if (lowerQuery.includes('korea') || lowerQuery.includes('kospi')) return 'Korea KOSPI';
  
  return query.replace('热力图', '').trim() || 'Market';
}

/**
 * 格式化热力图图片说明
 * @param {Object} heatmapResult - 热力图结果
 * @param {string} query - 查询文本
 * @returns {string} 格式化的说明文本
 */
function formatHeatmapCaption(heatmapResult, query) {
  const marketName = getMarketDisplayName(query);
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
  let caption = `🧊 *USIS Brain v7 热力图*\n`;
  caption += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  caption += `• 市场: ${marketName}\n`;
  caption += `• 生成时间: ${timestamp} (UTC)\n`;
  caption += `• 提供商: ${heatmapResult.provider || 'TradingView'}\n`;
  caption += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  caption += `💡 *说明:*\n`;
  caption += `• 绿色 = 上涨，红色 = 下跌\n`;
  caption += `• 色块大小 = 市值权重\n`;
  caption += `• 颜色深度 = 波动幅度\n`;
  
  return caption;
}

/**
 * 格式化市场分析文本
 * @param {Object} heatmapResult - 热力图结果
 * @returns {string} 格式化的分析文本
 */
function formatMarketAnalysis(heatmapResult) {
  if (!heatmapResult.marketAnalysis && !heatmapResult.summary) {
    return null;
  }
  
  let text = `📊 *市场分析*\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  if (heatmapResult.marketAnalysis) {
    text += heatmapResult.marketAnalysis;
  } else if (heatmapResult.summary) {
    text += heatmapResult.summary;
  }
  
  text += `\n\n━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `_USIS Brain v7 热力图模块_`;
  
  return text;
}

/**
 * 获取用户友好的错误消息
 * @param {string} errorMessage - 原始错误消息
 * @returns {string} 友好的错误消息
 */
function getErrorFriendlyMessage(errorMessage) {
  if (errorMessage.includes('timeout') || errorMessage.includes('超时')) {
    return '请求超时，服务器响应较慢';
  }
  if (errorMessage.includes('API') || errorMessage.includes('api')) {
    return 'API服务暂时不可用';
  }
  if (errorMessage.includes('network') || errorMessage.includes('网络')) {
    return '网络连接错误';
  }
  if (errorMessage.includes('not found') || errorMessage.includes('找不到')) {
    return '市场数据未找到';
  }
  
  return errorMessage.substring(0, 100);
}

/**
 * 默认导出
 */
module.exports = {
  handleHeatmap
};
