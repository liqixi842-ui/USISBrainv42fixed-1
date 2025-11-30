/**
 * ═══════════════════════════════════════════════════════════════
 * USIS Brain v7.0 - Public Bot (公共机器人)
 * ═══════════════════════════════════════════════════════════════
 * 
 * 职责：处理通用消息和帮助信息
 * - 帮助菜单（/help）
 * - 问候响应（hi, hello, 你好）
 * - 未识别命令的友好提示
 * - 系统使用说明
 * 
 * 特点：
 * - 轻量级（只发文字，无重型计算）
 * - 快速响应（<100ms）
 * - 永不崩溃（完整错误处理）
 */

/**
 * Public Bot 主处理函数
 * @param {Object} message - Telegram 消息对象
 * @param {number} chatId - Telegram 聊天室 ID
 * @param {Object} bot - Telegram Bot 实例
 * @param {Object} context - 上下文信息 { isHelp: boolean }
 * @returns {Promise<Object>} 处理结果
 */
async function handlePublic(message, chatId, bot, context = {}) {
  const startTime = Date.now();
  const text = (message.text || '').trim().toLowerCase();
  const userId = message.from?.id || 'unknown';
  const username = message.from?.username || 'unknown';
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`💬 [PUBLIC] Incoming message`);
  console.log(`   ├─ User: ${username} (${userId})`);
  console.log(`   ├─ Chat ID: ${chatId}`);
  console.log(`   ├─ Message: "${message.text || ''}"`);
  console.log(`   └─ Context: isHelp=${context.isHelp || false}`);
  
  try {
    // Determine message type
    const messageType = classifyMessage(text, context);
    
    console.log(`   ├─ Classified as: ${messageType}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    let responseText;
    
    switch (messageType) {
      case 'help':
        console.log(`❓ [PUBLIC] → Sending help menu`);
        responseText = getHelpMessage();
        break;
        
      case 'greet':
        console.log(`👋 [PUBLIC] → Sending greeting`);
        responseText = getGreetingMessage(username);
        break;
        
      case 'fallback':
      default:
        console.log(`🤔 [PUBLIC] → Sending fallback message`);
        responseText = getFallbackMessage(message.text);
        break;
    }
    
    // Send response
    await bot.sendMessage(chatId, responseText, {
      parse_mode: 'Markdown'
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ [PUBLIC] Response sent in ${duration} ms`);
    console.log(`   ├─ Type: ${messageType}`);
    console.log(`   ├─ Length: ${responseText.length} chars`);
    console.log(`   └─ User: ${username}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    return {
      type: 'public_response',
      messageType: messageType,
      success: true,
      duration: duration
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error(`\n❌ [PUBLIC] ERROR after ${duration} ms`);
    console.error(`   ├─ User: ${username} (${userId})`);
    console.error(`   ├─ Chat ID: ${chatId}`);
    console.error(`   ├─ Error type: ${error.name || 'Error'}`);
    console.error(`   ├─ Error message: ${error.message}`);
    console.error(`   └─ Stack trace:`);
    console.error(error.stack);
    console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    // Send error message (不抛异常)
    try {
      await bot.sendMessage(chatId,
        `⚠️ 系统繁忙，请稍后重试。\n\n` +
        `如需帮助，请发送 /help 查看使用说明。`
      );
    } catch (sendError) {
      console.error(`❌ [PUBLIC] Failed to send error message: ${sendError.message}`);
    }
    
    return {
      type: 'public_error',
      error: error.message,
      duration: duration,
      success: false
    };
  }
}

/**
 * 分类消息类型
 * @param {string} text - 消息文本（小写）
 * @param {Object} context - 上下文
 * @returns {string} 消息类型：help / greet / fallback
 */
function classifyMessage(text, context) {
  // Priority 1: Explicit help context
  if (context.isHelp === true) {
    return 'help';
  }
  
  // Priority 2: Help keywords
  const helpKeywords = [
    '/help', 'help', '帮助', '菜单', 'menu', '说明', 
    '/start', 'start', '开始', '命令', 'commands',
    '怎么用', '如何使用', 'how to use', 'usage'
  ];
  
  if (helpKeywords.some(keyword => text.includes(keyword))) {
    return 'help';
  }
  
  // Priority 3: Greeting keywords
  const greetKeywords = [
    'hi', 'hello', 'hey', 'hola', 'bonjour',
    '你好', '您好', '嗨', '在吗', '在不在',
    'good morning', 'good afternoon', 'good evening'
  ];
  
  if (greetKeywords.some(keyword => text.includes(keyword))) {
    return 'greet';
  }
  
  // Default: Fallback
  return 'fallback';
}

/**
 * 生成帮助菜单文本
 * @returns {string} 帮助文本（Markdown格式）
 */
function getHelpMessage() {
  return `📚 **USIS Brain v7.0 使用指南**

🎯 **核心功能：**

**1️⃣ 解票分析（快速技术分析）**
• \`解票 NVDA\` - 标准中文版
• \`解票 NVDA 双语\` - 中文+英文版
• \`解票 NVDA 聊天版\` - 人话版（老交易员口吻）
• \`解票 NVDA 完整版\` - 所有格式（3条消息）

英文命令：\`/ticket NVDA\`

**2️⃣ 研报生成（机构级深度分析）**
• \`研报 NVDA\` - 机构级完整研报
• \`研报PDF NVDA\` - PDF版研报

**3️⃣ 新闻查询**
• \`新闻 NVDA\` - 最新新闻摘要
• \`重大新闻\` - 今日重要财经消息

**4️⃣ 市场热力图**
• \`热力图\` - 美股市场热力图
• \`港股热力图\` - 港股市场热力图

━━━━━━━━━━━━━━━━━━━━━━

📌 **快速示例：**
\`\`\`
解票 TSLA          → K线图+技术分析
解票 AAPL 双语     → 中英文分析
解票 MSFT 聊天版   → 交易员口吻
\`\`\`

💡 **支持的股票代码：**
• 美股：AAPL, TSLA, NVDA, MSFT...
• 港股：0700.HK, 9988.HK...
• A股：600519.SS, 000001.SZ...
• 其他主要交易所代码

━━━━━━━━━━━━━━━━━━━━━━

⚡ **响应时间：**
• 解票分析：30-60秒
• 研报生成：2-3分钟
• 新闻简报：10-20秒
• 热力图：5-10秒

━━━━━━━━━━━━━━━━━━━━━━

🔧 **管理员命令：**
• \`/status\` - 系统状态
• \`/admin\` - 管理面板

━━━━━━━━━━━━━━━━━━━━━━

📞 **需要帮助？**
如有问题或建议，请联系开发团队。

_USIS Brain - 机构级AI金融分析系统_`;
}

/**
 * 生成问候消息
 * @param {string} username - 用户名
 * @returns {string} 问候文本
 */
function getGreetingMessage(username) {
  const greetings = [
    `👋 你好，${username}！`,
    `🌟 欢迎使用 USIS Brain！`,
    `💼 Hi ${username}, 准备好分析股票了吗？`,
    `📊 Hello！我是你的AI金融分析助手。`
  ];
  
  // Random greeting
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];
  
  return `${greeting}

我可以帮你快速分析股票技术面。

**快速开始：**
• 发送 \`解票 NVDA\` - 获取NVDA技术分析
• 发送 \`/help\` - 查看完整功能列表

**支持功能：**
✅ 解票分析（K线图+AI分析）
✅ 研报生成（机构级研究报告）
✅ 新闻查询（实时财经新闻）
✅ 市场热力图（涨跌可视化）

有问题随时问我！ 😊`;
}

/**
 * 生成降级/未识别消息提示
 * @param {string} originalText - 用户原始输入
 * @returns {string} 提示文本
 */
function getFallbackMessage(originalText) {
  const snippet = originalText ? originalText.substring(0, 50) : '(空消息)';
  
  return `🤔 抱歉，我没太理解你的意思：

"${snippet}${originalText && originalText.length > 50 ? '...' : ''}"

**我能做的事情：**

📊 **解票分析** - 快速技术分析
格式：\`解票 股票代码 [模式]\`
示例：
• \`解票 NVDA\` - 标准版
• \`解票 TSLA 双语\` - 中英文
• \`解票 AAPL 聊天版\` - 人话版

━━━━━━━━━━━━━━━━━━━━━━

📚 **查看完整功能**
发送 \`/help\` 查看所有可用命令

💡 **提示：**
确保股票代码正确（如 NVDA, TSLA, AAPL）

有问题随时问！ 😊`;
}

/**
 * 默认导出
 */
module.exports = {
  handlePublic
};
