const axios = require('axios');

async function checkExecutions() {
  const apiKey = process.env.N8N_API_KEY;
  const baseUrl = process.env.N8N_BASE_URL;
  const workflowId = 'ddvIQQUO4YfR1rAx'; // News RSS Collector v4.0
  
  console.log('🔍 检查 USIS News RSS Collector v4.0 执行历史...\n');
  
  try {
    // 获取最近的执行记录
    const res = await axios.get(`${baseUrl}/api/v1/executions`, {
      headers: { 'X-N8N-API-KEY': apiKey },
      params: { 
        workflowId: workflowId,
        limit: 10
      },
      timeout: 15000
    });
    
    const executions = res.data.data || [];
    console.log(`📊 最近 ${executions.length} 次执行:\n`);
    
    for (const exec of executions) {
      const status = exec.status === 'success' ? '✅' : (exec.status === 'error' ? '❌' : '⏳');
      const date = new Date(exec.startedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
      console.log(`${status} ${date} - ${exec.status}`);
      
      if (exec.status === 'error' && exec.stoppedAt) {
        console.log(`   错误: ${exec.data?.resultData?.error?.message || '未知错误'}`);
      }
    }
    
    // 检查最后一次成功执行的时间
    const lastSuccess = executions.find(e => e.status === 'success');
    if (lastSuccess) {
      const lastDate = new Date(lastSuccess.startedAt);
      const now = new Date();
      const hoursSince = Math.round((now - lastDate) / (1000 * 60 * 60));
      console.log(`\n⏰ 距离上次成功执行: ${hoursSince} 小时`);
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    if (error.response) {
      console.error('   响应:', JSON.stringify(error.response.data).substring(0, 300));
    }
  }
}

checkExecutions();
