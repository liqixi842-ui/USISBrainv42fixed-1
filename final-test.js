const { Pool } = require('pg');
const NewsPushService = require('./newsPushService.js');

async function finalTest() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const pushService = new NewsPushService(
    process.env.TELEGRAM_BOT_TOKEN,
    process.env.NEWS_CHANNEL_ID
  );
  
  try {
    console.log('📊 最终测试：推送2条真实新闻...\n');
    
    const top2 = await pool.query(`
      SELECT 
        ni.id,
        ni.title,
        ni.translated_title,
        ni.summary,
        ni.translated_summary,
        ni.ai_commentary,
        ni.url,
        ns.composite_score,
        source.name as source_name,
        source.tier
      FROM news_items ni
      INNER JOIN news_scores ns ON ni.id = ns.news_item_id
      LEFT JOIN news_sources source ON ni.source_id = source.id
      WHERE ni.url NOT LIKE '%test%'
      ORDER BY ns.composite_score DESC
      LIMIT 2
    `);
    
    if (top2.rows.length < 2) {
      console.log('⚠️  真实新闻不足2条');
      await pool.end();
      process.exit(0);
    }
    
    console.log('📰 将推送:');
    top2.rows.forEach((n, i) => {
      console.log(`${i+1}. [${parseFloat(n.composite_score).toFixed(1)}分] ${(n.translated_title || n.title).substring(0, 50)}...`);
    });
    
    console.log('\n🚀 推送中...\n');
    
    const result = await pushService.pushDigest(top2.rows, 'digest_2h');
    
    console.log(`\n✅ 推送结果:`);
    console.log(`   Success: ${result.success}`);
    console.log(`   发送成功: ${result.sent}/${result.total}`);
    console.log(`   发送失败: ${result.failed}/${result.total}`);
    
    if (result.success) {
      console.log(`\n💬 完美！请检查Telegram，应该看到${result.sent}条单独的消息！`);
    }
    
    await pool.end();
    
  } catch (error) {
    console.log('❌ 错误:', error.message);
    await pool.end();
    process.exit(1);
  }
}

finalTest();
