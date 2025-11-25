/**
 * 重新推送高分Fastlane新闻
 * Re-push high-score fastlane news items
 */

const NewsPushService = require('./newsPushService');
const { safeQuery } = require('./dbUtils');

async function repushFastlane() {
  console.log('🚀 重新推送Fastlane高分新闻...\n');

  try {
    // Get all high-score news (>=7.0)
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
      WHERE ns.composite_score >= 7.0
      ORDER BY ns.composite_score DESC
    `);

    const newsItems = result.rows;

    if (newsItems.length === 0) {
      console.log('❌ 没有找到高分新闻');
      process.exit(1);
    }

    console.log(`✅ 找到 ${newsItems.length} 条高分新闻（≥7.0分）\n`);

    // Initialize push service
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const channelId = process.env.NEWS_CHANNEL_ID;

    if (!token || !channelId) {
      console.error('❌ 缺少 TELEGRAM_BOT_TOKEN 或 NEWS_CHANNEL_ID');
      process.exit(1);
    }

    const pushService = new NewsPushService(token, channelId);

    // Push each item individually (Fastlane format)
    let successCount = 0;
    let failCount = 0;

    for (const item of newsItems) {
      try {
        console.log(`\n📤 正在推送 [${item.composite_score}/10]: ${item.title.substring(0, 60)}...`);
        
        const result = await pushService.pushFastlane(item);
        
        if (result.success) {
          console.log(`   ✅ 成功 - Message ID: ${result.message_id}`);
          successCount++;
          
          // 每条推送后等待2秒，避免Telegram限流
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`   ❌ 失败:`, error.message);
        failCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📊 推送完成！成功: ${successCount}，失败: ${failCount}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  process.exit(0);
}

repushFastlane();
