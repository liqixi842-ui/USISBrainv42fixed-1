const axios = require('axios');

async function verify() {
  const apiKey = process.env.N8N_API_KEY;
  const baseUrl = process.env.N8N_BASE_URL;
  
  console.log('🔍 检查最新执行状态...\n');
  
  try {
    const res = await axios.get(`${baseUrl}/api/v1/executions`, {
      headers: { 'X-N8N-API-KEY': apiKey },
      params: { 
        workflowId: 'ddvIQQUO4YfR1rAx',
        limit: 3
      },
      timeout: 15000
    });
    
    const executions = res.data.data || [];
    
    for (const exec of executions) {
      const status = exec.status === 'success' ? '✅' : (exec.status === 'error' ? '❌' : '⏳');
      const date = new Date(exec.startedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
      console.log(`${status} ${date} - ${exec.status}`);
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
  }
}

verify();
