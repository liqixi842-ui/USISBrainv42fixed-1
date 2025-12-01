const axios = require('axios');

async function checkN8N() {
  const apiKey = process.env.N8N_API_KEY;
  const baseUrl = process.env.N8N_BASE_URL;
  
  if (!apiKey || !baseUrl) {
    console.log('❌ N8N_API_KEY 或 N8N_BASE_URL 未设置');
    console.log('   N8N_API_KEY:', apiKey ? '已设置' : '未设置');
    console.log('   N8N_BASE_URL:', baseUrl || '未设置');
    return;
  }
  
  console.log('🔍 检查 N8N 工作流...');
  console.log(`   Base URL: ${baseUrl}`);
  
  try {
    const res = await axios.get(`${baseUrl}/api/v1/workflows`, {
      headers: {
        'X-N8N-API-KEY': apiKey,
        'Accept': 'application/json'
      },
      timeout: 15000
    });
    
    const workflows = res.data.data || [];
    console.log(`\n✅ 找到 ${workflows.length} 个工作流:\n`);
    
    for (const wf of workflows) {
      const status = wf.active ? '🟢 激活' : '🔴 停用';
      console.log(`${status} | ${wf.name} (ID: ${wf.id})`);
    }
    
    // 找新闻相关工作流
    const newsWorkflows = workflows.filter(wf => 
      wf.name.toLowerCase().includes('news') || 
      wf.name.toLowerCase().includes('rss')
    );
    
    if (newsWorkflows.length > 0) {
      console.log('\n📰 新闻相关工作流:');
      for (const wf of newsWorkflows) {
        console.log(`   ${wf.active ? '🟢' : '🔴'} ${wf.name} - ${wf.active ? '运行中' : '已停止'}`);
        if (!wf.active) {
          console.log(`      ⚠️ 需要激活此工作流！`);
        }
      }
    } else {
      console.log('\n⚠️ 未找到新闻相关工作流');
    }
    
  } catch (error) {
    console.error('❌ API 错误:', error.message);
    if (error.response) {
      console.error('   状态码:', error.response.status);
      console.error('   响应:', JSON.stringify(error.response.data).substring(0, 200));
    }
  }
}

checkN8N();
