/**
 * 测试 Telegram 推送功能
 * 直接发送测试消息到群组，验证Bot权限
 */

const fetch = require('node-fetch');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.NEWS_CHANNEL_ID;

async function testTelegramPush() {
  console.log('🧪 测试 Telegram 推送功能...\n');
  console.log(`📍 Bot Token: ${BOT_TOKEN ? BOT_TOKEN.substring(0, 10) + '...' : '未设置'}`);
  console.log(`📍 Channel ID: ${CHANNEL_ID}\n`);

  if (!BOT_TOKEN || !CHANNEL_ID) {
    console.error('❌ 缺少环境变量！');
    console.error('   需要: TELEGRAM_BOT_TOKEN, NEWS_CHANNEL_ID');
    process.exit(1);
  }

  try {
    // 发送测试消息
    const testMessage = `🧪 *测试消息*

这是来自 USIS News v2.0 的测试推送。

如果您看到这条消息，说明：
✅ Bot 已成功连接
✅ 群组 ID 配置正确
✅ Bot 有发送消息权限

📊 时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;

    console.log('📤 正在发送测试消息...');
    
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHANNEL_ID,
        text: testMessage,
        parse_mode: 'Markdown'
      })
    });

    const result = await response.json();

    if (result.ok) {
      console.log('✅ 消息发送成功！');
      console.log(`   Message ID: ${result.result.message_id}`);
      console.log(`   Chat ID: ${result.result.chat.id}`);
      console.log(`   Chat Title: ${result.result.chat.title || '(private)'}`);
      console.log('\n🎯 请检查您的 Telegram 群组，应该能看到这条测试消息！');
    } else {
      console.log('❌ 消息发送失败！');
      console.log(`   错误代码: ${result.error_code}`);
      console.log(`   错误描述: ${result.description}`);
      
      if (result.error_code === 403) {
        console.log('\n💡 常见原因：');
        console.log('   1. Bot 不在群组中');
        console.log('   2. Bot 被移除了');
        console.log('   3. Bot 没有发送消息权限');
        console.log('\n🔧 解决方法：');
        console.log('   1. 在 Telegram 打开"全球金融新闻群"');
        console.log('   2. 点击群组名称 → 添加成员');
        console.log('   3. 搜索您的 Bot 并添加');
        console.log('   4. 确保 Bot 有"发送消息"权限');
      } else if (result.error_code === 400) {
        console.log('\n💡 可能原因：');
        console.log('   1. 群组 ID 不正确');
        console.log('   2. Bot 从未与此群组交互过');
      }
    }

  } catch (error) {
    console.error('❌ 网络错误:', error.message);
  }
}

testTelegramPush();
