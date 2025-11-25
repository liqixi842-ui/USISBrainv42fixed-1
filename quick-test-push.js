const { Bot } = require('telegraf');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL = process.env.NEWS_CHANNEL_ID;

if (!TOKEN || !CHANNEL) {
  console.log('❌ 缺少环境变量');
  process.exit(1);
}

const bot = new Bot(TOKEN);

const testMessage = `🧪 **USIS Brain测试推送**

⏰ 北京时间：${new Date().toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}

这是一条测试消息，用于验证：
✅ Telegram Bot配置正确
✅ 频道ID正确
✅ Bot有发送权限

如果您收到这条消息，说明推送功能正常。
真实新闻推送需要修复HTTP 404问题，让N8N能推送新数据。`;

bot.telegram.sendMessage(CHANNEL, testMessage, { parse_mode: 'Markdown' })
  .then(() => {
    console.log('✅ 测试消息已发送到Telegram！');
    console.log('   请检查您的频道是否收到');
    process.exit(0);
  })
  .catch(err => {
    console.log('❌ 发送失败:', err.message);
    process.exit(1);
  });

setTimeout(() => {
  console.log('❌ 超时');
  process.exit(1);
}, 10000);
