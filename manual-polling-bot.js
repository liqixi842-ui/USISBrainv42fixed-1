// 手动轮询 Bot - 绕过 Telegraf 的 launch()
const https = require('https');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
let offset = 0;

console.log('Starting manual polling bot...');

function apiCall(method, params = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(params);
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${TOKEN}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function poll() {
  try {
    console.log(`Polling (offset=${offset})...`);
    const result = await apiCall('getUpdates', { offset, timeout: 30 });
    
    if (!result.ok) {
      console.error('API error:', result);
      return;
    }

    console.log(`Got ${result.result.length} updates`);

    for (const update of result.result) {
      offset = update.update_id + 1;
      
      if (update.message && update.message.text) {
        const chatId = update.message.chat.id;
        const text = update.message.text;
        console.log(`Message from ${chatId}: ${text}`);

        // Echo back
        await apiCall('sendMessage', {
          chat_id: chatId,
          text: `Echo: ${text}`
        });
        console.log('Reply sent');
      }
    }
  } catch (e) {
    console.error('Poll error:', e.message);
  }
  
  // Continue polling
  setTimeout(poll, 1000);
}

poll();
console.log('Bot is running, waiting for messages...');
