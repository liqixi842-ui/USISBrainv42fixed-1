/**
 * Manual News Push Trigger
 * Run: node manual-push.js
 */

const { getScheduler } = require('./scheduler/newsScheduler');

async function triggerPush() {
  console.log('🚀 Starting manual news push...\n');
  
  try {
    const scheduler = getScheduler({
      enabled: true,
      telegramToken: process.env.TELEGRAM_BOT_TOKEN,
      newsChannelId: process.env.NEWS_CHANNEL_ID
    });
    
    // Initialize router (required for queries)
    const { getRouter } = require('./newsRouter');
    const router = getRouter();
    await router.initialize();
    console.log('✅ Router initialized\n');
    
    // Manually trigger digest push
    const NewsPushService = require('./newsPushService');
    const pushService = new NewsPushService(
      process.env.TELEGRAM_BOT_TOKEN,
      process.env.NEWS_CHANNEL_ID
    );
    
    scheduler.pushService = pushService;
    
    console.log('📤 Triggering digest push...\n');
    await scheduler.sendDigest('digest_2h');
    
    console.log('\n✅ Manual push completed!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Manual push failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

triggerPush();
