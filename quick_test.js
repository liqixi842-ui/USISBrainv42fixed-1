const http = require('http');

const payload = JSON.stringify({
  text: 'AAPL最近有啥新闻？给个操作建议',
  user_id: 'quick_test',
  chat_type: 'group'
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/brain/orchestrate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

console.log('📤 发送测试请求...');
const req = http.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log(`📥 状态码: ${res.statusCode}`);
    try {
      const response = JSON.parse(body);
      console.log('\n✅ v3.1 MVP核心字段检查:');
      console.log(`   parse: ${response.parse ? '✅ 存在' : '❌ 缺失'}`);
      console.log(`   news: ${response.news !== undefined ? `✅ 存在 (${Array.isArray(response.news) ? response.news.length : '非数组'})` : '❌ 缺失'}`);
      console.log(`   analysis: ${response.analysis !== undefined ? '✅ 存在' : '❌ 缺失'}`);
      console.log(`   advice: ${response.advice !== undefined ? '✅ 存在' : '❌ 缺失'}`);
      console.log(`   summary: ${response.summary ? '✅ 存在' : '❌ 缺失'}`);
      
      if (response.parse) {
        console.log(`\n📋 Parse结果:`);
        console.log(`   symbols: ${JSON.stringify(response.parse.symbols)}`);
      }
      
      if (response.news && response.news.length > 0) {
        console.log(`\n📰 新闻摘要:`);
        console.log(`   数量: ${response.news.length}`);
        console.log(`   首条标题: ${response.news[0].title?.substring(0, 60)}...`);
        console.log(`   ImpactRank: ${response.news[0].impact_score}`);
        console.log(`   原因: ${response.news[0].reason}`);
      }
      
      if (response.summary) {
        console.log(`\n📝 响应摘要 (前200字符):`);
        console.log(`   ${response.summary.substring(0, 200)}...`);
      }
      
      console.log('\n✅ 测试完成！');
    } catch (e) {
      console.error('❌ JSON解析失败:', e.message);
      console.log('原始响应:', body.substring(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error(`❌ 请求失败: ${e.message}`);
  process.exit(1);
});

req.write(payload);
req.end();
