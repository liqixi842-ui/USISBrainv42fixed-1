const https = require('https');
const token = process.env.TELEGRAM_BOT_TOKEN;

const apiCall = (method) => {
  return new Promise((resolve) => {
    const url = `https://api.telegram.org/bot${token}/${method}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          resolve({error: data});
        }
      });
    }).on('error', (err) => {
      resolve({error: err.message});
    });
  });
};

(async () => {
  console.log('=== 检查Telegram Bot状态 ===\n');
  
  const me = await apiCall('getMe');
  console.log('1. Bot信息:');
  console.log(JSON.stringify(me, null, 2));
  
  const webhookInfo = await apiCall('getWebhookInfo');
  console.log('\n2. Webhook状态:');
  console.log(JSON.stringify(webhookInfo, null, 2));
  
  const updates = await apiCall('getUpdates?limit=1');
  console.log('\n3. 测试getUpdates (这应该触发409如果有冲突):');
  console.log(JSON.stringify(updates, null, 2));
})();
