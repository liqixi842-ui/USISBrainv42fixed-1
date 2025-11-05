// 简单测试Telegram Bot是否能正常工作
const { Telegraf } = require('telegraf');

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN not found');
  process.exit(1);
}

console.log('🤖 测试Telegram Bot...');
console.log('Token前缀:', token.substring(0, 10) + '...');

const bot = new Telegraf(token);

bot.start((ctx) => {
  console.log('✅ 收到/start命令');
  ctx.reply('✅ USIS Brain v4.2_fixed Telegram Bot测试成功！');
});

bot.on('text', (ctx) => {
  const text = ctx.message.text;
  console.log(`📨 收到消息: "${text}"`);
  ctx.reply(`Echo: ${text}`);
});

bot.launch({
  dropPendingUpdates: true
}).then(() => {
  console.log('✅ Telegram Bot启动成功 (polling模式)');
  console.log('💡 现在可以给bot发消息测试了');
  console.log('🔍 Bot信息: @' + (bot.botInfo?.username || '未知'));
}).catch(err => {
  console.error('❌ 启动失败:', err.message);
  process.exit(1);
});

process.once('SIGINT', () => {
  console.log('\n👋 收到SIGINT，正在停止...');
  bot.stop('SIGINT');
});
