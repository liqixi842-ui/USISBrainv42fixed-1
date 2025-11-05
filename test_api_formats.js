const fetch = require('node-fetch');

const token = process.env.SCREENSHOT_API_KEY;
console.log('🔑 API Token长度:', token.length);

const targetUrl = 'https://www.tradingview.com/heatmap/stock/?color=change&dataset=SPX500&group=sector';

// 测试方案1: GET with token in query
console.log('\n=== 方案1: GET with token in query ===');
const params1 = new URLSearchParams({
  url: targetUrl,
  token: token,
  output: 'image',
  width: 1200,
  height: 800
});
const url1 = `https://shot.screenshotapi.net/screenshot?${params1.toString()}`;
console.log('URL:', url1.substring(0, 100) + '...');

fetch(url1, { method: 'GET', timeout: 15000 })
  .then(res => {
    console.log('状态:', res.status, res.statusText);
    return res.text();
  })
  .then(data => {
    if (data.length < 200) console.log('响应:', data);
    console.log('数据长度:', data.length);
  })
  .catch(err => console.error('错误:', err.message))
  .then(() => {
    // 测试方案2: 不同的endpoint
    console.log('\n=== 方案2: Different endpoint ===');
    const url2 = `https://api.screenshotapi.net/screenshot?${params1.toString()}`;
    console.log('URL:', url2.substring(0, 100) + '...');
    
    return fetch(url2, { method: 'GET', timeout: 15000 });
  })
  .then(res => {
    if (res) {
      console.log('状态:', res.status, res.statusText);
      return res.text();
    }
  })
  .then(data => {
    if (data) {
      if (data.length < 200) console.log('响应:', data);
      console.log('数据长度:', data.length);
    }
  })
  .catch(err => console.error('错误:', err.message));
