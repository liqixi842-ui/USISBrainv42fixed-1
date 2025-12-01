const axios = require('axios');

async function getFullError() {
  const apiKey = process.env.N8N_API_KEY;
  const baseUrl = process.env.N8N_BASE_URL;
  
  try {
    const res = await axios.get(`${baseUrl}/api/v1/executions/5245`, {
      headers: { 'X-N8N-API-KEY': apiKey },
      params: { includeData: true },
      timeout: 15000
    });
    
    const exec = res.data;
    const runData = exec.data?.resultData?.runData;
    
    if (!runData) {
      console.log('无运行数据');
      return;
    }
    
    console.log('📊 节点执行状态:\n');
    
    for (const [nodeName, nodeRuns] of Object.entries(runData)) {
      const lastRun = nodeRuns[nodeRuns.length - 1];
      const status = lastRun.executionStatus;
      const emoji = status === 'success' ? '✅' : '❌';
      
      console.log(`${emoji} ${nodeName} - ${status}`);
      
      if (lastRun.error) {
        console.log(`   错误: ${JSON.stringify(lastRun.error).substring(0, 500)}`);
      }
      
      // 显示输出数量
      if (lastRun.data?.main?.[0]) {
        console.log(`   输出: ${lastRun.data.main[0].length} 项`);
      }
    }
    
    // 检查整体错误
    if (exec.data?.resultData?.error) {
      console.log('\n❌ 工作流错误:');
      console.log(JSON.stringify(exec.data.resultData.error, null, 2));
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
  }
}

getFullError();
