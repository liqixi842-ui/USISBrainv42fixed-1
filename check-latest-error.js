const axios = require('axios');

async function checkLatest() {
  const apiKey = process.env.N8N_API_KEY;
  const baseUrl = process.env.N8N_BASE_URL;
  
  try {
    // 获取最新执行
    const listRes = await axios.get(`${baseUrl}/api/v1/executions`, {
      headers: { 'X-N8N-API-KEY': apiKey },
      params: { workflowId: 'ddvIQQUO4YfR1rAx', limit: 1 },
      timeout: 15000
    });
    
    const execId = listRes.data.data?.[0]?.id;
    console.log(`最新执行 ID: ${execId}\n`);
    
    // 获取详情
    const detailRes = await axios.get(`${baseUrl}/api/v1/executions/${execId}`, {
      headers: { 'X-N8N-API-KEY': apiKey },
      params: { includeData: true },
      timeout: 15000
    });
    
    const exec = detailRes.data;
    console.log(`状态: ${exec.status}`);
    console.log(`时间: ${exec.startedAt}`);
    
    // 检查错误
    if (exec.data?.resultData?.error) {
      const error = exec.data.resultData.error;
      console.log(`\n❌ 错误信息:`);
      console.log(`   节点: ${error.node?.name || '未知'}`);
      console.log(`   消息: ${error.message}`);
      console.log(`   HTTP: ${error.httpCode || 'N/A'}`);
      
      // 显示请求的 URL
      if (error.context?.request?.uri) {
        console.log(`   请求URL: ${error.context.request.uri}`);
      }
    }
    
  } catch (error) {
    console.error('❌:', error.message);
  }
}

checkLatest();
