// v3-dev Development Bot Message Handler
// This handles all messages for the development bot (TELEGRAM_BOT_TOKEN_DEV)

const fetch = require('node-fetch');
const { buildSimpleReport } = require('./reportService');

const VALID_COMMANDS = ['/test', '/status', '/v3', '/help', '/report'];

async function handleDevBotMessage(message, telegramAPI) {
  const chatId = message.chat.id;
  const text = (message.text || '').trim();
  const userId = message.from.id;
  
  console.log(`\n🔧 [DEV_BOT] Message from ${userId}: "${text}"`);
  
  try {
    // /test command
    if (text === '/test') {
      await telegramAPI('sendMessage', {
        chat_id: chatId,
        text: '✅ v3-dev Bot is working!\n\nVersion: v3-dev\nEnvironment: Development\nIsolation: Active',
        parse_mode: 'Markdown'
      });
      return;
    }
    
    // /status command
    if (text === '/status') {
      const status = `🚧 **v3-dev Development Bot Status**

📍 Version: v3-dev
🏷️ Tag: dev_bot
🔗 Token: TELEGRAM_BOT_TOKEN_DEV
⏱ Uptime: ${Math.floor(process.uptime())}s

**Features:**
• Research report system (in development)
• Isolated from v2-stable production
• Independent message handling

**Available Commands:**
/test - Test bot connectivity
/status - Show this status
/v3 - v3-dev information
/help - Show help`;
      
      await telegramAPI('sendMessage', {
        chat_id: chatId,
        text: status,
        parse_mode: 'Markdown'
      });
      return;
    }
    
    // /v3 command
    if (text === '/v3') {
      await telegramAPI('sendMessage', {
        chat_id: chatId,
        text: '🔬 v3-dev Development Environment\n\nThis bot is for testing new features before production.\n\nCurrent focus: Research report system',
        parse_mode: 'Markdown'
      });
      return;
    }
    
    // /help command
    if (text === '/help') {
      await telegramAPI('sendMessage', {
        chat_id: chatId,
        text: '📚 v3-dev Bot Help\n\n/test - Test connectivity\n/status - Bot status\n/v3 - v3-dev info\n/report [SYMBOL] - Generate research report (v1 test)\n/help - This message',
        parse_mode: 'Markdown'
      });
      return;
    }
    
    // /report command
    if (text.startsWith('/report')) {
      const parts = text.split(' ');
      
      // Check if symbol is provided
      if (parts.length < 2 || !parts[1].trim()) {
        await telegramAPI('sendMessage', {
          chat_id: chatId,
          text: '📊 请提供股票代码\n\n格式：/report AAPL\n\n示例：\n/report AAPL\n/report TSLA\n/report NVDA',
          parse_mode: 'Markdown'
        });
        return;
      }
      
      const symbol = parts[1].trim().toUpperCase();
      
      try {
        // Send "generating" message
        await telegramAPI('sendMessage', {
          chat_id: chatId,
          text: `🔬 正在生成 ${symbol} 研报（v3-dev测试版）...\n\n请稍候...`,
          parse_mode: 'Markdown'
        });
        
        // Call internal report API
        const reportUrl = `http://localhost:3000/v3/report/${symbol}`;
        console.log(`📡 [DEV_BOT] Calling: ${reportUrl}`);
        
        const response = await fetch(reportUrl, { timeout: 20000 });
        
        if (!response.ok) {
          throw new Error(`API responded with ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.ok || !data.report) {
          throw new Error('Invalid report data');
        }
        
        const report = data.report;
        
        // Format report for Telegram
        const ratingEmoji = {
          'STRONG_BUY': '🟢🟢',
          'BUY': '🟢',
          'HOLD': '🟡',
          'SELL': '🔴',
          'STRONG_SELL': '🔴🔴'
        }[report.rating] || '⚪';
        
        const reportText = `📊 **USIS·研报测试版（v3-dev）**

**标的**：${report.symbol}
**评级**：${ratingEmoji} ${report.rating}
**时间范围**：${report.horizon}

**💰 价格信息**
• 当前价：${report.price_info.current}
• 涨跌：${report.price_info.change} (${report.price_info.change_percent}%)
• 最高/最低：${report.price_info.high} / ${report.price_info.low}

**📈 核心观点**
${report.summary}

**🎯 驱动因素**
${report.drivers.map((d, i) => `${i + 1}. ${d}`).join('\n')}

**⚠️ 风险提示**
${report.risks.map((r, i) => `${i + 1}. ${r}`).join('\n')}

**📉 技术面**
${report.technical_view}

---
⏱ 生成时间：${report.latency_ms || 'N/A'}ms
🤖 AI模型：${report.model_used || 'unknown'}
🔬 环境：v3-dev (测试版)

**免责声明**：${report.disclaimer || '本报告为测试版本，仅供参考。'}`;
        
        await telegramAPI('sendMessage', {
          chat_id: chatId,
          text: reportText,
          parse_mode: 'Markdown'
        });
        
        console.log(`✅ [DEV_BOT] Report sent for ${symbol}`);
        
      } catch (error) {
        console.error(`❌ [DEV_BOT] Report generation failed:`, error.message);
        
        await telegramAPI('sendMessage', {
          chat_id: chatId,
          text: `❌ 研报生成失败\n\n标的：${symbol}\n错误：${error.message}\n\n这是v3-dev测试版本，功能仍在完善中。`,
          parse_mode: 'Markdown'
        });
      }
      return;
    }
    
    // Default response for other messages
    await telegramAPI('sendMessage', {
      chat_id: chatId,
      text: '🔧 v3-dev Bot\n\nI\'m in development mode. Try /help for available commands.',
      parse_mode: 'Markdown'
    });
    
  } catch (error) {
    console.error('[DEV_BOT] Error handling message:', error);
    try {
      await telegramAPI('sendMessage', {
        chat_id: chatId,
        text: '❌ Error in dev bot handler'
      });
    } catch (sendError) {
      console.error('[DEV_BOT] Failed to send error message:', sendError);
    }
  }
}

module.exports = { handleDevBotMessage };
