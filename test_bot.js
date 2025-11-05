const { Telegraf } = require('telegraf');

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN not found');
  process.exit(1);
}

console.log('🔑 Token长度:', token.length);
console.log('🔑 Token前缀:', token.substring(0, 10) + '...');

const bot = new Telegraf(token);

bot.start((ctx) => {
  console.log('📨 收到/start命令');
  ctx.reply('✅ Bot is working!');
});

bot.on('text', (ctx) => {
  console.log('📨 收到消息:', ctx.message.text);
  ctx.reply('Echo: ' + ctx.message.text);
});

console.log('🤖 启动Bot polling...');

bot.launch({
  dropPendingUpdates: true
})
.then(() => {
  console.log('✅ ✅ ✅ Bot polling启动成功！');
  console.log('📱 现在可以给Bot发消息了');
})
.catch(err => {
  console.error('❌ ❌ ❌ Bot启动失败:', err);
  console.error('错误详情:', err.message);
  console.error('错误代码:', err.code);
  process.exit(1);
});

process.once('SIGINT', () => {
  console.log('🛑 收到SIGINT，停止Bot');
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  console.log('🛑 收到SIGTERM，停止Bot');
  bot.stop('SIGTERM');
});
