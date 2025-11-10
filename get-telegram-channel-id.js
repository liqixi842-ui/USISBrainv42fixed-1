/**
 * Helper script to get Telegram Channel ID
 * 
 * Usage:
 * 1. Add your bot to a channel as admin
 * 2. Send a message to the channel
 * 3. Run: node get-telegram-channel-id.js
 */

const axios = require('axios');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function getChannelId() {
  if (!BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN not found in environment variables');
    console.log('   Please set TELEGRAM_BOT_TOKEN in Replit Secrets');
    process.exit(1);
  }

  console.log('🔍 Fetching recent updates from Telegram Bot API...\n');

  try {
    const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`);
    
    if (!response.data.ok) {
      console.error('❌ API Error:', response.data.description);
      return;
    }

    const updates = response.data.result;

    if (updates.length === 0) {
      console.log('⚠️  No recent messages found. Please:');
      console.log('   1. Open your Telegram bot');
      console.log('   2. Send a message (any message)');
      console.log('   3. Run this script again');
      return;
    }

    console.log(`✅ Found ${updates.length} recent message(s)\n`);
    console.log('─'.repeat(60));

    const channelIds = new Set();

    updates.forEach((update, idx) => {
      const message = update.message || update.channel_post;
      if (message && message.chat) {
        const chatId = message.chat.id;
        const chatType = message.chat.type;
        const chatTitle = message.chat.title || message.chat.first_name || 'Unknown';

        console.log(`Message ${idx + 1}:`);
        console.log(`  Type: ${chatType}`);
        console.log(`  Title: ${chatTitle}`);
        console.log(`  Chat ID: ${chatId}`);
        console.log(`  Text: ${message.text || message.caption || '(media)'}`);
        console.log('─'.repeat(60));

        if (chatType === 'channel' || chatType === 'supergroup') {
          channelIds.add(chatId);
        }
      }
    });

    if (channelIds.size > 0) {
      console.log('\n🎯 Found Channel/Supergroup IDs:');
      channelIds.forEach(id => {
        console.log(`   ${id}`);
      });
      console.log('\n💡 Copy one of these IDs and add to Replit Secrets as NEWS_CHANNEL_ID');
    } else {
      console.log('\n⚠️  No channels found. If you want to get a channel ID:');
      console.log('   1. Create a new Telegram channel');
      console.log('   2. Add your bot as an administrator');
      console.log('   3. Send a message to the channel');
      console.log('   4. Run this script again');
    }

  } catch (error) {
    console.error('❌ Error fetching updates:', error.message);
    
    if (error.response?.status === 404) {
      console.log('\n💡 Troubleshooting 404 Error:');
      console.log('   - Check that TELEGRAM_BOT_TOKEN is correct');
      console.log('   - Token should look like: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz');
      console.log('   - Get your token from @BotFather on Telegram');
    }
  }
}

getChannelId();
