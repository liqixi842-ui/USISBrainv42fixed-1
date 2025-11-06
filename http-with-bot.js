// HTTP 服务器 + 手动 Telegram 轮询（满足 Replit 平台要求）
const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 5000;
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

console.log('Starting HTTP server with Telegram bot...');

// HTTP 服务器（防止 Replit 看门狗杀进程）
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200);
    res.end('OK');
  } else {
    res.writeHead(200);
    res.end('Telegram Bot is running');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ HTTP server listening on ${PORT}`);
});

// Telegram API 调用
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
      },
      timeout: 10000
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
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.write(data);
    req.end();
  });
}

let offset = 0;
let polling = false;

async function poll() {
  if (polling) return;
  polling = true;
  
  try {
    console.log(`[${new Date().toISOString()}] Polling (offset=${offset})...`);
    const result = await apiCall('getUpdates', { offset, timeout: 25 });
    
    if (!result.ok) {
      console.error('API error:', result);
      polling = false;
      setTimeout(poll, 3000);
      return;
    }

    console.log(`Got ${result.result.length} updates`);

    for (const update of result.result) {
      offset = update.update_id + 1;
      
      if (update.message && update.message.text) {
        const chatId = update.message.chat.id;
        const text = update.message.text;
        console.log(`📨 Message from ${chatId}: ${text}`);

        await apiCall('sendMessage', {
          chat_id: chatId,
          text: `Echo: ${text}`
        });
        console.log('✅ Reply sent');
      }
    }
  } catch (e) {
    console.error('❌ Poll error:', e.message);
  }
  
  polling = false;
  setTimeout(poll, 1000);
}

// 启动轮询
setTimeout(() => {
  console.log('Starting Telegram polling...');
  poll();
}, 2000);
