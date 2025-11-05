const fetch = require('node-fetch');

const token = process.env.SCREENSHOT_API_KEY;
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

const apiUrl = `https://shot.screenshotapi.net/v3/screenshot?${params.toString()}`;
console.log('🌐 测试v3 endpoint...');

fetch(apiUrl, { method: 'GET', timeout: 30000 })
  .then(res => {
    console.log('📡 HTTP状态:', res.status, res.statusText);
    console.log('📡 Content-Type:', res.headers.get('content-type'));
    return res.buffer();
  })
  .then(buffer => {
    console.log('✅ 成功！收到图片数据');
    console.log('📊 图片大小:', (buffer.length / 1024).toFixed(2), 'KB');
  })
  .catch(err => {
    console.error('❌ 错误:', err.message);
  });
