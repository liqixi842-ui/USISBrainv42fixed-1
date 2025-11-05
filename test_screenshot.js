const fetch = require('node-fetch');

const token = process.env.SCREENSHOT_API_KEY;
console.log('🔑 Token:', token ? `${token.substring(0,10)}... (长度:${token.length})` : '未设置');

if (!token) {
  console.error('❌ SCREENSHOT_API_KEY未设置');
  process.exit(1);
}

const targetUrl = 'https://www.tradingview.com/heatmap/stock/?color=change&dataset=SPX500&group=sector';
const params = new URLSearchParams({
  url: targetUrl,
  token: token,
  output: 'image',
  file_type: 'png',
  wait_for_event: 'load',
  delay: 5000,
  full_page: 'false',
  width: 1200,
  height: 800,
  device_scale_factor: 2
});

const apiUrl = `https://shot.screenshotapi.net/screenshot?${params.toString()}`;
console.log('🌐 测试ScreenshotAPI...');

fetch(apiUrl, { method: 'GET', timeout: 25000 })
  .then(res => {
    console.log('📡 HTTP状态:', res.status, res.statusText);
    return res.text();
  })
  .then(data => {
    console.log('📄 响应长度:', data.length);
    if (data.length < 500) {
      console.log('📄 完整响应:', data);
    } else {
      console.log('📄 响应前500字符:', data.substring(0, 500));
    }
    
    if (data.includes('error') || data.includes('Error') || data.includes('invalid')) {
      console.error('❌ API返回错误');
    } else if (data.length > 10000) {
      console.log('✅ 成功！收到图片数据 (长度:', data.length, ')');
    }
  })
  .catch(err => {
    console.error('❌ 请求失败:', err.message);
  });
