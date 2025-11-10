const fetch = require('node-fetch');
const cheerio = require('cheerio');

async function sendRealNews() {
  const sources = [
    { url: 'https://www.marketwatch.com/rss/topstories', name: 'MarketWatch', tier: 3 },
  ];
  
  try {
    console.log('📡 从MarketWatch采集真实新闻...\n');
    
    const response = await fetch(sources[0].url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });
    
    const xml = await response.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    
    const items = $('item').slice(0, 8);
    const articles = [];
    
    items.each((i, item) => {
      const title = $(item).find('title').text().trim();
      const link = $(item).find('link').text().trim();
      const description = $(item).find('description').text().trim();
      const pubDate = $(item).find('pubDate').text().trim();
      
      if (title && link) {
        articles.push({
          title,
          summary: description.substring(0, 500) || title,
          url: link,
          source: sources[0].name,
          tier: sources[0].tier,
          published_at: pubDate || new Date().toISOString()
        });
      }
    });
    
    console.log(`✅ 采集到 ${articles.length} 条真实新闻\n`);
    
    console.log('真实新闻列表:');
    articles.forEach((article, i) => {
      console.log(`${i+1}. ${article.title.substring(0, 80)}`);
    });
    
    console.log('\n🚀 推送到USIS Brain...\n');
    console.log('发送数据格式:', JSON.stringify(articles[0], null, 2));
    
    const apiResponse = await fetch('http://localhost:5000/api/news/ingest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-News-Secret': process.env.NEWS_INGESTION_SECRET
      },
      body: JSON.stringify(articles)
    });
    
    const responseText = await apiResponse.text();
    console.log('\nAPI响应:', responseText);
    
    if (apiResponse.ok) {
      const result = JSON.parse(responseText);
      console.log('\n✅ 处理成功！');
      console.log(`   接收: ${result.received}`);
      console.log(`   处理: ${result.processed}`);
    } else {
      console.log('\n❌ API返回错误');
    }
    
  } catch (error) {
    console.log('❌ 错误:', error.message);
    console.log(error.stack);
  }
}

sendRealNews();
