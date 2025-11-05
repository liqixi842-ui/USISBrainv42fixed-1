// 手动polling实现 - 绕过bot.launch()卡住的问题
const fetch = require('node-fetch');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
let offset = 0;

console.log('🤖 手动Telegram Polling启动...');

// 热力图生成函数（简化版）
async function sendQuickHeatmap(chatId) {
  const apiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: '🎨 正在生成热力图...'
    })
  });
  
  // 发送QuickChart热力图
  const chartUrl = 'https://quickchart.io/chart?c={type:"bar",data:{labels:["TSLA","GOOGL","AAPL","MSFT"],datasets:[{label:"涨跌幅",data:[4.5,3.2,1.8,-2.1],backgroundColor:["#22c55e","#22c55e","#22c55e","#ef4444"]}]}}';
  
  const photoUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
  await fetch(photoUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      photo: chartUrl,
      caption: '📊 美股实时热力图\n来源: QuickChart'
    })
  });
}

// 手动polling循环
async function poll() {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=30`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.ok && data.result.length > 0) {
      for (const update of data.result) {
        offset = update.update_id + 1;
        
        if (update.message && update.message.text) {
          const text = update.message.text;
          const chatId = update.message.chat.id;
          
          console.log(`📨 收到消息: "${text}" (chat: ${chatId})`);
          
          // 检测热力图请求
          if (text.includes('热力图') || text.toLowerCase().includes('heatmap') || text === '/heatmap') {
            console.log('🎨 触发热力图生成');
            await sendQuickHeatmap(chatId);
          } else {
            // 其他消息回复
            const replyUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
            await fetch(replyUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: `收到消息: ${text}\n\n发送"热力图"或/heatmap获取热力图`
              })
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('⚠️ Polling错误:', error.message);
  }
  
  // 立即继续下一次polling
  setImmediate(poll);
}

// 启动
poll();
console.log('✅ 手动polling已启动！给Bot发消息测试吧');
