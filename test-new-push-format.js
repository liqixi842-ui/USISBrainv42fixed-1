const { Pool } = require('pg');
const NewsPushService = require('./newsPushService.js');

async function testNewFormat() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const pushService = new NewsPushService(pool, process.env.TELEGRAM_BOT_TOKEN, process.env.NEWS_CHANNEL_ID);
  
  try {
    console.log('📊 获取真实新闻Top 5（测试新格式）...\n');
    
    const top5 = await pool.query(`
      SELECT 
        ni.id,
        ni.title,
        ni.translated_title,
        ni.summary,
        ni.translated_summary,
        ni.ai_commentary,
        ni.url,
        ni.fetched_at,
        ns.composite_score,
        source.name as source_name,
        source.tier
      FROM news_items ni
      INNER JOIN news_scores ns ON ni.id = ns.news_item_id
      LEFT JOIN news_sources source ON ni.source_id = source.id
      WHERE ni.url NOT LIKE '%test%'
        AND ni.fetched_at > NOW() - INTERVAL '1 hour'
      ORDER BY ns.composite_score DESC
      LIMIT 5
    `);
    
    console.log(`✅ 找到 ${top5.rows.length} 条真实新闻\n`);
    
    if (top5.rows.length === 0) {
      console.log('⚠️  没有真实新闻');
      await pool.end();
      process.exit(0);
    }
    
    console.log('🚀 使用新格式推送（每条新闻单独发送）...\n');
    
    const result = await pushService.pushDigest(top5.rows, 'digest_2h');
    
    if (result.success) {
      console.log(`\n✅ 推送完成！`);
      console.log(`   成功: ${result.sent} 条`);
      console.log(`   失败: ${result.failed} 条`);
      console.log(`   总计: ${result.total} 条`);
      console.log(`\n💬 请检查Telegram频道，您应该会看到${result.sent}条单独的消息！`);
    }
    
    await pool.end();
    
  } catch (error) {
    console.log('❌ 错误:', error.message);
    console.log(error.stack);
    await pool.end();
    process.exit(1);
  }
}

testNewFormat();
