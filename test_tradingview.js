const fetch = require('node-fetch');

const token = (process.env.SCREENSHOT_API_KEY || '').trim();
const targetUrl = 'https://www.tradingview.com/heatmap/stock/?color=change&dataset=SPX500&group=sector';

const params = new URLSearchParams({
  url: targetUrl,
  token: token,
  output: 'image',
  file_type: 'png',
  delay: 5000,
  width: 1200,
  height: 800
});

const apiUrl = `https://shot.screenshotapi.net/screenshot?${params.toString()}`;

console.log('🧪 测试真实TradingView URL...');
console.log('⏱️  开始时间:', new Date().toLocaleTimeString());

const startTime = Date.now();

fetch(apiUrl, { method: 'GET' })
  .then(res => {
    const elapsed = Date.now() - startTime;
    console.log(`⏱️  响应时间: ${(elapsed/1000).toFixed(1)}秒`);
    console.log('📡 HTTP状态:', res.status, res.statusText);
    
    if (res.ok) {
      return res.buffer();
    } else {
      return res.text().then(txt => {
        console.error('错误响应:', txt);
        throw new Error(txt);
      });
    }
  })
  .then(buffer => {
    if (buffer) {
      const totalElapsed = Date.now() - startTime;
      console.log(`✅ 成功！总耗时: ${(totalElapsed/1000).toFixed(1)}秒`);
      console.log(`📊 图片大小: ${(buffer.length/1024).toFixed(2)} KB`);
    }
  })
  .catch(err => {
    const totalElapsed = Date.now() - startTime;
    console.error(`❌ 失败 (${(totalElapsed/1000).toFixed(1)}秒):`, err.message);
  });

// 60秒后超时
setTimeout(() => {
  console.log('⏰ 手动60秒超时');
  process.exit(0);
}, 60000);
