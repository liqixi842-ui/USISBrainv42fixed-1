// 最小化 Telegram Bot 测试 - 不加载任何业务模块
const fs = require('fs');
const { Telegraf } = require('telegraf');

const logf = (msg) => {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.writeFileSync('/tmp/tg-only.log', line, { flag: 'a' }); } catch {}
  console.log(msg);
};

process.on('SIGTERM', () => { logf('SIGTERM received'); process.exit(0); });
process.on('SIGINT', () => { logf('SIGINT received'); process.exit(0); });

logf('===== Telegram-Only Test =====');

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  logf('ERROR: No TELEGRAM_BOT_TOKEN');
  process.exit(1);
}

logf('Creating bot...');
const bot = new Telegraf(token);

bot.catch((err) => {
  logf(`bot.catch: ${err.message}`);
});

bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  logf(`Message: "${text}"`);
  
  try {
    await ctx.reply(`Echo: ${text}`);
    logf('Reply sent');
  } catch (e) {
    logf(`Reply error: ${e.message}`);
  }
});

logf('Launching bot...');
bot.launch({ dropPendingUpdates: true })
  .then(() => {
    logf('✅ Bot launched successfully!');
    logf('Waiting for messages...');
  })
  .catch((err) => {
    logf(`❌ Launch failed: ${err.message}`);
    logf(`Stack: ${err.stack}`);
    process.exit(1);
  });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
