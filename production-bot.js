// USIS Brain v5.0 - Production Telegram Bot
// HTTP Server + Manual Polling (Replit-compatible)

const http = require('http');
const https = require('https');
const fs = require('fs');
const fetch = require('node-fetch');

// 导入业务逻辑模块
const { generateSmartHeatmap } = require('./heatmapService');

const PORT = process.env.PORT || 5000;
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN not configured');
  process.exit(1);
}

console.log('🚀 USIS Brain v5.0 - Production Bot');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// ===== HTTP Server (Satisfies Replit watchdog) =====
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  } else if (req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'running',
      bot: 'active',
      uptime: process.uptime(),
      last_poll: lastPollTime,
      messages_processed: messagesProcessed
    }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>USIS Brain v5.0</title>
        <style>
          body { font-family: monospace; background: #1a1a1a; color: #0f0; padding: 40px; }
          h1 { color: #0f0; }
          .status { background: #2a2a2a; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .ok { color: #0f0; }
        </style>
      </head>
      <body>
        <h1>🧠 USIS Brain v5.0</h1>
        <div class="status">
          <p>✅ Status: <span class="ok">RUNNING</span></p>
          <p>🤖 Telegram Bot: <span class="ok">ACTIVE</span></p>
          <p>⏱️  Uptime: ${Math.floor(process.uptime())}s</p>
          <p>📊 Messages Processed: ${messagesProcessed}</p>
          <p>🔗 <a href="/health" style="color: #0f0;">Health Check</a></p>
          <p>🔗 <a href="/status" style="color: #0f0;">JSON Status</a></p>
        </div>
      </body>
      </html>
    `);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ HTTP server listening on 0.0.0.0:${PORT}`);
});

// ===== Telegram API =====
function apiCall(method, params = {}, timeout = 35000) {
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
      timeout
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (!result.ok) {
            console.error(`❌ API ${method} failed:`, result.description || result);
            reject(new Error(result.description || 'API call failed'));
          } else {
            resolve(result);
          }
        } catch (e) {
          console.error(`❌ Parse error for ${method}:`, e.message);
          reject(e);
        }
      });
    });

    req.on('error', (e) => {
      console.error(`❌ Request error for ${method}:`, e.message);
      reject(e);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout for ${method}`));
    });

    req.write(data);
    req.end();
  });
}

// ===== Message Handler =====
let messagesProcessed = 0;
let lastPollTime = new Date().toISOString();

async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = message.text || '';
  const userId = message.from.id;
  
  console.log(`\n📨 [${new Date().toISOString()}] Message from ${userId}: "${text}"`);
  messagesProcessed++;
  
  try {
    // 检测热力图请求
    const isHeatmap = text.includes('热力图') || text.toLowerCase().includes('heatmap');
    
    if (isHeatmap) {
      console.log('🎨 热力图请求检测到');
      
      // 发送处理中提示
      await apiCall('sendMessage', {
        chat_id: chatId,
        text: '🎨 正在生成热力图...'
      });
      
      // 生成热力图
      const result = await generateSmartHeatmap(text);
      
      if (result.buffer) {
        // 准备 multipart/form-data
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36);
        const parts = [];
        
        // document field
        parts.push(
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="document"; filename="heatmap.png"\r\n` +
          `Content-Type: image/png\r\n\r\n`
        );
        parts.push(result.buffer);
        parts.push('\r\n');
        
        // chat_id field
        parts.push(
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="chat_id"\r\n\r\n` +
          `${chatId}\r\n`
        );
        
        // caption field
        const caption = result.caption.slice(0, 1000);
        parts.push(
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="caption"\r\n\r\n` +
          `${caption}\r\n`
        );
        
        parts.push(`--${boundary}--\r\n`);
        
        // Calculate content length
        const bufferParts = parts.map(p => Buffer.isBuffer(p) ? p : Buffer.from(p, 'utf-8'));
        const totalLength = bufferParts.reduce((sum, buf) => sum + buf.length, 0);
        const bodyBuffer = Buffer.concat(bufferParts, totalLength);
        
        // Send document
        await new Promise((resolve, reject) => {
          const options = {
            hostname: 'api.telegram.org',
            port: 443,
            path: `/bot${TOKEN}/sendDocument`,
            method: 'POST',
            headers: {
              'Content-Type': `multipart/form-data; boundary=${boundary}`,
              'Content-Length': bodyBuffer.length
            },
            timeout: 60000
          };
          
          const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
              try {
                const result = JSON.parse(body);
                if (result.ok) {
                  resolve(result);
                } else {
                  reject(new Error(result.description || 'sendDocument failed'));
                }
              } catch (e) {
                reject(e);
              }
            });
          });
          
          req.on('error', reject);
          req.on('timeout', () => {
            req.destroy();
            reject(new Error('sendDocument timeout'));
          });
          
          req.write(bodyBuffer);
          req.end();
        });
        
        console.log('✅ 热力图已发送');
        
        // 发送摘要
        if (result.summary) {
          await apiCall('sendMessage', {
            chat_id: chatId,
            text: result.summary
          });
          console.log('✅ 摘要已发送');
        }
      }
    } else {
      // 常规分析（调用本地API）
      console.log('🧠 常规分析请求');
      
      await apiCall('sendMessage', {
        chat_id: chatId,
        text: '🧠 正在分析...'
      });
      
      const analysisResp = await fetch(`http://localhost:${PORT}/brain/orchestrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          user_id: `tg_${userId}`,
          chat_type: message.chat.type,
          mode: 'auto',
          budget: 'low'
        })
      });
      
      const data = await analysisResp.json();
      const replyText = data.final_text || data.final_analysis || '分析完成';
      
      await apiCall('sendMessage', {
        chat_id: chatId,
        text: replyText
      });
      
      console.log('✅ 分析结果已发送');
    }
  } catch (error) {
    console.error(`❌ 处理消息失败:`, error.message);
    console.error(error.stack);
    
    try {
      await apiCall('sendMessage', {
        chat_id: chatId,
        text: '⚠️ 处理失败，请重试'
      });
    } catch (e) {
      console.error('❌ 无法发送错误消息:', e.message);
    }
  }
}

// ===== Polling Loop =====
let offset = 0;
let polling = false;

async function poll() {
  if (polling) return;
  polling = true;
  
  try {
    lastPollTime = new Date().toISOString();
    const result = await apiCall('getUpdates', { offset, timeout: 25 }, 35000);
    
    if (result.result && result.result.length > 0) {
      console.log(`📬 Got ${result.result.length} updates`);
      
      for (const update of result.result) {
        offset = update.update_id + 1;
        
        if (update.message && update.message.text) {
          await handleMessage(update.message);
        }
      }
    }
  } catch (e) {
    console.error('❌ Poll error:', e.message);
  } finally {
    polling = false;
    setTimeout(poll, 1000);
  }
}

// ===== Startup =====
setTimeout(() => {
  console.log('🤖 Starting Telegram polling...');
  poll();
}, 2000);

console.log('✅ USIS Brain v5.0 is ready!');
console.log('💬 Send messages to the bot on Telegram');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
