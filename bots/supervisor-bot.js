/**
 * ═══════════════════════════════════════════════════════════════
 * USIS Brain v7.0 - Supervisor Bot (管理员机器人)
 * ═══════════════════════════════════════════════════════════════
 * 
 * 职责：系统监控和管理功能
 * - 系统状态查询（/status）
 * - 心跳检查（/ping）
 * - Bot列表查询（/bots）
 * - 错误日志查询（/errors）
 * - 重启指令（/restart）
 * 
 * 安全：
 * - 严格权限控制（仅 OWNER_ID 可访问）
 * - 自动检测非法访问
 * - 完整日志记录
 */

const fs = require('fs');
const os = require('os');
const { performance } = require('perf_hooks');
const path = require('path');

// ═══ 权限控制 ═══
const OWNER_ID = process.env.OWNER_ID || process.env.TELEGRAM_OWNER_ID;

// ═══ 全局启动时间 ═══
const startTime = Date.now();

// ═══ 错误日志缓存 ═══
const recentErrors = [];
const MAX_ERROR_CACHE = 50;

/**
 * Supervisor Bot 主处理函数
 * @param {Array} args - 命令参数
 * @param {number} chatId - Telegram 聊天室 ID
 * @param {Object} bot - Telegram Bot 实例
 * @param {Object} message - 原始 Telegram 消息对象
 * @returns {Promise<Object>} 处理结果
 */
async function handleSupervisor(args, chatId, bot, message) {
  const requestTime = Date.now();
  const userId = message.from?.id || 'unknown';
  const username = message.from?.username || 'unknown';
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🔐 [SUPERVISOR] Admin request`);
  console.log(`   ├─ User: ${username} (${userId})`);
  console.log(`   ├─ Chat ID: ${chatId}`);
  console.log(`   ├─ Args: [${args.join(', ')}]`);
  console.log(`   └─ Owner ID: ${OWNER_ID || 'not set'}`);
  
  try {
    // ═══ 权限检查 ═══
    if (!OWNER_ID) {
      console.error(`❌ [SUPERVISOR] OWNER_ID not configured`);
      await bot.sendMessage(chatId, 
        `⚠️ 系统配置错误\n\n` +
        `OWNER_ID 未设置。请联系系统管理员。`
      );
      return { type: 'supervisor_error', error: 'OWNER_ID not configured' };
    }
    
    if (String(chatId) !== String(OWNER_ID)) {
      console.warn(`⚠️  [SUPERVISOR] Unauthorized access attempt`);
      console.warn(`   ├─ User: ${username} (${userId})`);
      console.warn(`   ├─ Chat ID: ${chatId}`);
      console.warn(`   └─ Owner ID: ${OWNER_ID}`);
      
      await bot.sendMessage(chatId,
        `❌ 权限不足\n\n` +
        `此功能仅限系统管理员使用。\n\n` +
        `(Supervisor Only)`
      );
      
      return { 
        type: 'supervisor_unauthorized', 
        userId: userId,
        chatId: chatId 
      };
    }
    
    console.log(`✅ [SUPERVISOR] Authorization passed`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    // ═══ 解析命令 ═══
    const command = args[0] ? args[0].toLowerCase() : 'status';
    
    let responseText;
    let responseTime;
    
    switch (command) {
      case 'status':
        console.log(`📊 [SUPERVISOR] → status`);
        responseText = await getStatusMessage();
        break;
        
      case 'ping':
        console.log(`🏓 [SUPERVISOR] → ping`);
        responseText = getPingMessage(requestTime);
        break;
        
      case 'bots':
        console.log(`🤖 [SUPERVISOR] → bots`);
        responseText = getBotsMessage();
        break;
        
      case 'errors':
        console.log(`⚠️  [SUPERVISOR] → errors`);
        responseText = await getErrorsMessage();
        break;
        
      case 'restart':
        console.log(`🔄 [SUPERVISOR] → restart`);
        responseText = getRestartMessage();
        break;
        
      default:
        console.log(`❓ [SUPERVISOR] → unknown command: ${command}`);
        responseText = getHelpMessage();
        break;
    }
    
    // ═══ 发送响应 ═══
    await bot.sendMessage(chatId, responseText, {
      parse_mode: 'Markdown'
    });
    
    responseTime = Date.now() - requestTime;
    
    console.log(`✅ [SUPERVISOR] Response sent in ${responseTime} ms`);
    console.log(`   ├─ Command: ${command}`);
    console.log(`   ├─ Length: ${responseText.length} chars`);
    console.log(`   └─ User: ${username}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    return {
      type: 'supervisor_response',
      command: command,
      success: true,
      duration: responseTime
    };
    
  } catch (error) {
    const duration = Date.now() - requestTime;
    
    console.error(`\n❌ [SUPERVISOR] ERROR after ${duration} ms`);
    console.error(`   ├─ User: ${username} (${userId})`);
    console.error(`   ├─ Chat ID: ${chatId}`);
    console.error(`   ├─ Error type: ${error.name || 'Error'}`);
    console.error(`   ├─ Error message: ${error.message}`);
    console.error(`   └─ Stack trace:`);
    console.error(error.stack);
    console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    // 记录错误到缓存
    logError({
      timestamp: new Date().toISOString(),
      type: error.name,
      message: error.message,
      stack: error.stack
    });
    
    // 发送错误消息（不抛异常）
    try {
      await bot.sendMessage(chatId,
        `❌ Supervisor internal error\n\n` +
        `错误类型: ${error.name || 'Unknown'}\n` +
        `错误信息: ${error.message}\n\n` +
        `请稍后重试或联系技术支持。`
      );
    } catch (sendError) {
      console.error(`❌ [SUPERVISOR] Failed to send error message: ${sendError.message}`);
    }
    
    return {
      type: 'supervisor_error',
      error: error.message,
      duration: duration,
      success: false
    };
  }
}

/**
 * 生成系统状态消息
 * @returns {Promise<string>} 状态文本
 */
async function getStatusMessage() {
  const uptime = formatUptime(Date.now() - startTime);
  const memUsage = process.memoryUsage();
  const memUsageMB = Math.round(memUsage.rss / 1024 / 1024);
  const cpuUsage = process.cpuUsage();
  const cpuLoad = os.loadavg()[0].toFixed(2);
  
  // 读取版本号
  let version = 'v7.0.0';
  try {
    const packagePath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packagePath)) {
      const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      version = packageData.version || 'v7.0.0';
    }
  } catch (err) {
    console.warn(`[SUPERVISOR] Failed to read version: ${err.message}`);
  }
  
  // Bot列表
  const activeBots = ['manager', 'ticket', 'public', 'supervisor'];
  const pendingBots = ['report', 'news', 'heatmap'];
  
  // 错误统计
  const errorCount = recentErrors.length;
  const recentErrorSummary = recentErrors.slice(-5).map(err => 
    `  • ${err.timestamp.substring(11, 19)} - ${err.type}: ${err.message.substring(0, 50)}`
  ).join('\n') || '  (无错误记录)';
  
  return `🧠 *USIS Brain v7 Supervisor Status*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 *系统信息*
• Version: ${version}
• Uptime: ${uptime}
• Memory: ${memUsageMB} MB
• CPU Load: ${cpuLoad}
• Platform: ${os.platform()} ${os.arch()}
• Node.js: ${process.version}

🤖 *Bot 模块状态*
• Active: ${activeBots.join(', ')}
• Pending: ${pendingBots.join(', ')}
• Total: ${activeBots.length + pendingBots.length}

⚠️  *错误统计*
• Total Errors: ${errorCount}
• Recent (Last 5):
${recentErrorSummary}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_Last updated: ${new Date().toISOString()}_`;
}

/**
 * 生成心跳消息
 * @param {number} requestTime - 请求开始时间
 * @returns {string} 心跳文本
 */
function getPingMessage(requestTime) {
  const responseTime = Date.now() - requestTime;
  return `🏓 *USIS Brain v7 is running*\n\n` +
         `Response time: ${responseTime} ms\n` +
         `Uptime: ${formatUptime(Date.now() - startTime)}`;
}

/**
 * 生成Bot列表消息
 * @returns {string} Bot列表文本
 */
function getBotsMessage() {
  return `🤖 *USIS Brain v7 - Bot Modules*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ *已实现 (Active)*
• \`manager-bot\` - 核心路由器
• \`ticket-bot\` - 解票分析
• \`public-bot\` - 通用消息/帮助
• \`supervisor-bot\` - 系统管理（当前）

⏳ *开发中 (Pending)*
• \`report-bot\` - 研报生成
• \`news-bot\` - 新闻简报
• \`heatmap-bot\` - 市场热力图

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 *架构说明*
所有消息先经过 \`manager-bot\` 路由，
再分发到专业化 bot 模块处理。

_总计: 7 个模块（4 active + 3 pending）_`;
}

/**
 * 生成错误日志消息
 * @returns {Promise<string>} 错误日志文本
 */
async function getErrorsMessage() {
  if (recentErrors.length === 0) {
    return `✅ *系统运行正常*\n\n暂无错误记录。`;
  }
  
  const errorList = recentErrors.slice(-10).reverse().map((err, index) => 
    `${index + 1}. *${err.type}* (${err.timestamp})\n` +
    `   ${err.message.substring(0, 100)}${err.message.length > 100 ? '...' : ''}`
  ).join('\n\n');
  
  return `⚠️  *Recent Errors (Last 10)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${errorList}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_Total errors in cache: ${recentErrors.length}_`;
}

/**
 * 生成重启消息
 * @returns {string} 重启文本
 */
function getRestartMessage() {
  return `🔄 *Restart Command Received*

重启指令已收到。

⚠️  **注意：**
应用需要在服务器端手动重启。

**重启方式：**
1. Replit Console: 点击 "Stop" 后再 "Run"
2. PM2: \`pm2 restart usis-brain\`
3. Shell: 重启 Node.js 进程

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_自动重启功能待实现_`;
}

/**
 * 生成帮助消息
 * @returns {string} 帮助文本
 */
function getHelpMessage() {
  return `🔐 *Supervisor Commands*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**可用命令：**

• \`/status\` - 查看系统状态
  包括：版本、内存、CPU、Bot列表、错误统计

• \`/ping\` - 心跳检查
  测试系统响应时间

• \`/bots\` - 查看已注册的 Bot 模块
  显示活跃和开发中的模块

• \`/errors\` - 查看最近错误日志
  显示最近10条错误记录

• \`/restart\` - 重启指令（预留）
  返回重启说明

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**使用示例：**
\`/admin status\` 或 \`/supervisor status\`

_仅限系统管理员使用_`;
}

/**
 * 格式化运行时间
 * @param {number} ms - 毫秒数
 * @returns {string} 格式化的时间
 */
function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * 记录错误到缓存
 * @param {Object} error - 错误对象
 */
function logError(error) {
  recentErrors.push(error);
  
  // 保持缓存大小
  if (recentErrors.length > MAX_ERROR_CACHE) {
    recentErrors.shift();
  }
  
  console.log(`[SUPERVISOR] Error logged: ${error.type} - ${error.message.substring(0, 50)}`);
}

/**
 * 获取错误缓存（供外部调用）
 * @returns {Array} 错误列表
 */
function getRecentErrors() {
  return [...recentErrors];
}

/**
 * 清空错误缓存
 */
function clearErrors() {
  const count = recentErrors.length;
  recentErrors.length = 0;
  console.log(`[SUPERVISOR] Cleared ${count} errors from cache`);
  return count;
}

/**
 * 默认导出
 */
module.exports = {
  handleSupervisor,
  logError,
  getRecentErrors,
  clearErrors
};
