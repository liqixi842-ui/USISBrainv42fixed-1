const fetch = require('node-fetch');

const token = process.env.SCREENSHOT_API_KEY;
console.log('API Key:', token);

// 按照官方文档的精确格式
const testUrl = 'https://google.com';
const query = `https://shot.screenshotapi.net/screenshot?token=${token}&url=${encodeURIComponent(testUrl)}&output=image&file_type=png`;

console.log('请求URL:', query.substring(0, 120) + '...');

fetch(query)
  .then(res => {
    console.log('状态:', res.status, res.statusText);
    console.log('Content-Type:', res.headers.get('content-type'));
    if (res.ok) {
      return res.buffer().then(buf => {
        console.log('✅ 成功！图片大小:', (buf.length/1024).toFixed(2), 'KB');
      });
    } else {
      return res.text().then(txt => {
        console.log('错误响应:', txt);
      });
    }
  })
  .catch(err => console.error('请求失败:', err.message));
