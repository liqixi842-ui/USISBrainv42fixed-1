const fetch = require('node-fetch');

async function testFullSystem() {
  console.log('🧪 测试USIS Brain完整系统...\n');
  
  const baseURL = 'http://localhost:3000';
  
  // 1. Test Health
  console.log('1️⃣  测试健康检查...');
  try {
    const healthRes = await fetch(`${baseURL}/health`);
    const health = await healthRes.json();
    console.log('✅ 健康检查:', health);
  } catch (err) {
    console.log('❌ 健康检查失败:', err.message);
    return;
  }
  
  // 2. Test Intent Recognition
  console.log('\n2️⃣  测试意图识别...');
  try {
    const intentRes = await fetch(`${baseURL}/brain/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: '盘前看看TSLA',
        allow: ['premarket', 'intraday', 'postmarket', 'diagnose', 'news']
      })
    });
    const intent = await intentRes.json();
    console.log('✅ 意图识别:', JSON.stringify(intent, null, 2));
  } catch (err) {
    console.log('❌ 意图识别失败:', err.message);
  }
  
  // 3. Test Full Orchestration (with shorter timeout)
  console.log('\n3️⃣  测试完整编排系统（6 AI + 数据帝国）...');
  console.log('⏳ 预计需要30-60秒...\n');
  
  try {
    const orchestrateRes = await fetch(`${baseURL}/brain/orchestrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: '盘前看NVDA',
        chat_type: 'private',
        user_id: 'test_vip_001'
      }),
      timeout: 90000
    });
    
    const result = await orchestrateRes.json();
    
    if (result.error) {
      console.log('❌ 编排失败:', result.error);
      console.log('详细:', result);
      return;
    }
    
    console.log('✅ 编排成功！');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 意图:', result.intent);
    console.log('🎬 场景:', result.scene);
    console.log('💎 股票:', result.symbols);
    
    if (result.market_data) {
      console.log('\n📈 市场数据已采集:', result.market_data.collected ? '✅' : '❌');
      if (result.market_data.summary) {
        console.log('数据摘要:', result.market_data.summary.substring(0, 200) + '...');
      }
    }
    
    console.log('\n🤖 AI分析团队:');
    if (result.ai_results) {
      Object.entries(result.ai_results).forEach(([name, data]) => {
        console.log(`  ${name}: ${data.success ? '✅' : '❌'} (${data.output?.length || 0}字)`);
      });
    }
    
    console.log('\n📝 最终分析报告:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(result.final_analysis?.substring(0, 500) + '...\n');
    
  } catch (err) {
    console.log('❌ 编排测试失败:', err.message);
  }
}

testFullSystem().catch(console.error);
