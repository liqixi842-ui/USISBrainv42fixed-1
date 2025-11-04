// 测试N8N调用Brain API的实际情况
const fetch = require('node-fetch');

async function testN8NCall() {
  console.log('=== 测试N8N调用Brain API ===\n');
  
  // 模拟N8N当前的调用方式
  console.log('【测试1】N8N当前的调用方式（缺少mode和budget参数）');
  try {
    const response1 = await fetch('http://localhost:5000/brain/orchestrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'CPI最近怎么样？',
        chat_type: 'group',
        user_id: 'test_user'
        // ❌ 缺少 mode 和 budget 参数
      })
    });
    
    const data1 = await response1.json();
    console.log('状态:', response1.status);
    console.log('响应:', JSON.stringify(data1, null, 2).slice(0, 500));
  } catch (error) {
    console.error('错误:', error.message);
  }
  
  console.log('\n\n【测试2】正确的调用方式（包含所有必需参数）');
  try {
    const response2 = await fetch('http://localhost:5000/brain/orchestrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'CPI最近怎么样？',
        mode: 'premarket',
        user_id: 'test_user',
        budget: 'low',
        chat_type: 'private'
      })
    });
    
    const data2 = await response2.json();
    console.log('状态:', response2.status);
    console.log('是否有actions:', !!data2.actions);
    console.log('actions数量:', data2.actions?.length || 0);
    if (data2.actions && data2.actions.length > 0) {
      console.log('第一个action:', JSON.stringify(data2.actions[0], null, 2));
    }
    console.log('visualIntent:', data2.levels?.l2?.visualIntent);
  } catch (error) {
    console.error('错误:', error.message);
  }
}

setTimeout(() => testN8NCall(), 3000);
