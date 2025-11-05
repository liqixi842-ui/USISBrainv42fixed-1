const https = require('https');
const token = process.env.TELEGRAM_BOT_TOKEN;

console.log('🧹 强制清除所有Telegram Bot状态...');

// 1. 删除webhook
const deleteWebhook = () => {
  return new Promise((resolve) => {
    const url = `https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('✅ Webhook删除:', JSON.parse(data));
        resolve();
      });
    });
  });
};

// 2. 获取Bot信息确认连接
const getBotInfo = () => {
  return new Promise((resolve) => {
    const url = `https://api.telegram.org/bot${token}/getMe`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const info = JSON.parse(data);
        console.log('✅ Bot信息:', info.result ? `@${info.result.username}` : '获取失败');
        resolve();
      });
    });
  });
};

deleteWebhook()
  .then(() => getBotInfo())
  .then(() => {
    console.log('✅ 清理完成！现在可以启动Bot了');
    process.exit(0);
  });
