// 清除Telegram Bot的pending updates
const https = require('https');

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN not found');
  process.exit(1);
}

const url = `https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`;

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('🧹 清除Webhook和pending updates结果:', data);
    console.log('✅ 完成！现在可以重启应用了');
    process.exit(0);
  });
}).on('error', (err) => {
  console.error('❌ 错误:', err.message);
  process.exit(1);
});
