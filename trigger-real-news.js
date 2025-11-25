const fetch = require('node-fetch');

async function triggerRealNewsCollection() {
  const baseUrl = process.env.N8N_BASE_URL;
  const apiKey = process.env.N8N_API_KEY;
  const workflowId = 'ddvIQQUO4YfR1rAx';
  
  try {
    console.log('🚀 手动触发N8N workflow采集真实新闻...\n');
    
    const triggerResponse = await fetch(`${baseUrl}/api/v1/workflows/${workflowId}/execute`, {
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    
    if (!triggerResponse.ok) {
      const error = await triggerResponse.text();
      console.log('❌ 触发失败:', error);
      process.exit(1);
    }
    
    const execution = await triggerResponse.json();
    console.log('✅ Workflow已触发');
    console.log(`   Execution ID: ${execution.id || 'N/A'}`);
    
    console.log('\n⏳ 等待执行完成（约30-45秒）...');
    console.log('   - 采集18个RSS源');
    console.log('   - 翻译成中文');
    console.log('   - GPT-4o生成AI点评');
    console.log('   - 评分并推送');
    
    let attempts = 0;
    let executionId = execution.id;
    
    while (attempts < 15) {
      await new Promise(r => setTimeout(r, 3000));
      attempts++;
      
      const statusResponse = await fetch(`${baseUrl}/api/v1/executions/${executionId}`, {
        headers: { 'X-N8N-API-KEY': apiKey }
      });
      
      const status = await statusResponse.json();
      
      console.log(`   [${attempts * 3}s] 状态: ${status.status}`);
      
      if (status.status === 'success') {
        console.log('\n✅ 真实新闻采集成功！');
        console.log('\n📊 现在推送Top 10到Telegram...');
        process.exit(0);
      } else if (status.status === 'error') {
        console.log('\n❌ 执行失败');
        if (status.data && status.data.resultData && status.data.resultData.error) {
          console.log('错误:', status.data.resultData.error.message);
        }
        process.exit(1);
      }
    }
    
    console.log('\n⏳ 执行时间较长，请稍后检查结果');
    
  } catch (error) {
    console.log('❌ 错误:', error.message);
    process.exit(1);
  }
}

triggerRealNewsCollection();
