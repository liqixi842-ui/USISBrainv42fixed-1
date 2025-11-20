/**
 * 主管机器人测试脚本
 * 
 * 使用方法：
 * 1. 设置环境变量：
 *    export MANAGER_BOT_TOKEN="your_bot_token"
 *    export OWNER_TELEGRAM_ID="your_telegram_id"
 * 
 * 2. 运行测试：
 *    node test-manager-bot.js
 */

require('dotenv').config();
const ManagerBot = require('./manager-bot');

// 配置
const config = {
  token: process.env.MANAGER_BOT_TOKEN,
  ownerId: process.env.OWNER_TELEGRAM_ID,
  allowedGroupIds: [] // 可以在这里添加授权的群组ID
};

// 验证配置
if (!config.token) {
  console.error('❌ 缺少 MANAGER_BOT_TOKEN 环境变量');
  console.log('请在 .env 文件中添加：');
  console.log('MANAGER_BOT_TOKEN=your_bot_token_here');
  process.exit(1);
}

if (!config.ownerId) {
  console.error('❌ 缺少 OWNER_TELEGRAM_ID 环境变量');
  console.log('请在 .env 文件中添加：');
  console.log('OWNER_TELEGRAM_ID=your_telegram_id_here');
  process.exit(1);
}

console.log('🚀 启动主管机器人测试...\n');

// 创建机器人实例
const managerBot = new ManagerBot(config);

// 启动机器人
managerBot.start()
  .then(() => {
    console.log('\n✅ 主管机器人已成功启动！');
    console.log('\n📋 测试命令：');
    console.log('1. 在Telegram中向机器人发送: /start');
    console.log('2. 发送 /bots 查看所有机器人');
    console.log('3. 发送 /botinfo news 查看新闻机器人详情');
    console.log('4. 发送 /botinfo research 查看解票机器人详情');
    console.log('5. 发送 /help 查看帮助信息');
    console.log('\n💡 按 Ctrl+C 停止机器人');
  })
  .catch((error) => {
    console.error('\n❌ 启动失败:', error.message);
    process.exit(1);
  });

// 优雅退出
process.once('SIGINT', () => {
  console.log('\n\n🛑 正在停止机器人...');
  managerBot.stop();
  process.exit(0);
});

process.once('SIGTERM', () => {
  console.log('\n\n🛑 正在停止机器人...');
  managerBot.stop();
  process.exit(0);
});
