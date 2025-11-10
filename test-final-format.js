const { Pool } = require('pg');
const NewsPushService = require('./newsPushService.js');

async function testFinalFormat() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const pushService = new NewsPushService(
    process.env.TELEGRAM_BOT_TOKEN,
    process.env.NEWS_CHANNEL_ID
  );
  
  try {
    console.log('📊 获取Top 1真实新闻（测试最终格式）...\n');
    
    const top1 = await pool.query(`
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
      LIMIT 1
    `);
    
    if (top1.rows.length === 0) {
      console.log('⚠️  没有真实新闻');
      await pool.end();
      process.exit(0);
    }
    
    const news = top1.rows[0];
    console.log('📰 将推送:');
    console.log(`   标题: ${news.translated_title || news.title}`);
    console.log(`   评分: ${parseFloat(news.composite_score).toFixed(1)}/10`);
    console.log(`   摘要长度: ${news.translated_summary?.length || 0} 字`);
    console.log(`   AI分析: ${news.ai_commentary?.substring(0, 40) || '无'}...`);
    
    console.log('\n🚀 推送到Telegram（类似紧急新闻格式+AI分析）...\n');
    
    const result = await pushService.pushDigest([news], 'digest_2h');
    
    if (result.success) {
      console.log('\n✅ 推送成功！');
      console.log('\n💬 新格式包含:');
      console.log('   ✓ Emoji + 加粗标题');
      console.log('   ✓ 评分显示');
      console.log('   ✓ 完整中文摘要（不截断）');
      console.log('   ✓ 💡 投资分析段落（AI生成）');
      console.log('   ✓ 原文链接');
      console.log('   ✓ 来源标注');
      console.log('   ✓ 标签分类');
      console.log('\n💬 请检查Telegram频道！');
    }
    
    await pool.end();
    
  } catch (error) {
    console.log('❌ 错误:', error.message);
    await pool.end();
    process.exit(1);
  }
}

testFinalFormat();
