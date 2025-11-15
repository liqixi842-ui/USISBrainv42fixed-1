// v3-dev Development Bot Message Handler
// This handles all messages for the development bot (TELEGRAM_BOT_TOKEN_DEV)

const VALID_COMMANDS = ['/test', '/status', '/v3', '/help'];

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
        text: '📚 v3-dev Bot Help\n\n/test - Test connectivity\n/status - Bot status\n/v3 - v3-dev info\n/help - This message',
        parse_mode: 'Markdown'
      });
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
