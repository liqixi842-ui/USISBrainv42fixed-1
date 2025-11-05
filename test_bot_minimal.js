const { Telegraf } = require('telegraf');

const token = process.env.TELEGRAM_BOT_TOKEN;
console.log('Token长度:', token.length);

const bot = new Telegraf(token);

bot.on('text', (ctx) => {
  console.log('收到消息:', ctx.message.text);
  ctx.reply('收到: ' + ctx.message.text);
});

console.log('开始启动bot...');

bot.launch({ dropPendingUpdates: true })
  .then(() => {
    console.log('✅✅✅ Bot成功启动！');
  })
  .catch(err => {
    console.error('❌❌❌ Bot启动失败:', err.message);
    console.error('错误详情:', err);
    process.exit(1);
  });

setTimeout(() => {
  console.log('已运行30秒，检查状态...');
}, 30000);
