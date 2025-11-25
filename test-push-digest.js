/**
 * Manual digest push test script
 * Tests the new 3-tier hashtag format
 */

const NewsPushService = require('./newsPushService');
const { safeQuery } = require('./dbUtils');

async function testDigestPush() {
  console.log('📊 Testing new digest format with 3-tier hashtags...\n');

  try {
    // Get pending news items
    const result = await safeQuery(`
      SELECT 
        ni.id,
        ni.title,
        ni.summary,
        ni.url,
        ni.symbols,
        ni.region,
        nsrc.name as source,
        nsrc.tier,
        ns.composite_score
      FROM news_items ni
      JOIN news_scores ns ON ni.id = ns.news_item_id
      JOIN news_routing_state nrs ON ni.id = nrs.news_item_id
      LEFT JOIN news_sources nsrc ON ni.source_id = nsrc.id
      WHERE nrs.channel = 'digest_4h'
        AND nrs.status = 'pending'
      ORDER BY ns.composite_score DESC
      LIMIT 8
    `);

    const newsItems = result.rows;

    if (newsItems.length === 0) {
      console.log('❌ No pending news items found');
      process.exit(1);
    }

    console.log(`✅ Found ${newsItems.length} news items\n`);

    // Initialize push service
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const channelId = process.env.NEWS_CHANNEL_ID;

    if (!token || !channelId) {
      console.error('❌ Missing TELEGRAM_BOT_TOKEN or NEWS_CHANNEL_ID');
      process.exit(1);
    }

    const pushService = new NewsPushService(token, channelId);

    // Format and display digest message
    console.log('📝 Formatted digest message:\n');
    console.log('='.repeat(60));
    const message = pushService.formatDigestMessage(newsItems, 'digest_4h');
    console.log(message);
    console.log('='.repeat(60));
    console.log('\n');

    // Ask for confirmation
    console.log('🚀 Sending to Telegram...');
    
    // Send the digest
    const result2 = await pushService.pushDigest(newsItems, 'test_manual');

    if (result2.success) {
      console.log('✅ Digest sent successfully!');
      console.log(`📱 Message ID: ${result2.message_id}`);
    } else {
      console.log('❌ Failed to send digest');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  process.exit(0);
}

testDigestPush();
