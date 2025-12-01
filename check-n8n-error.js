const axios = require('axios');

async function getErrorDetails() {
  const apiKey = process.env.N8N_API_KEY;
  const baseUrl = process.env.N8N_BASE_URL;
  
  console.log('🔍 获取最近一次执行的详细错误...\n');
  
  try {
    // 获取最近的执行记录
    const listRes = await axios.get(`${baseUrl}/api/v1/executions`, {
      headers: { 'X-N8N-API-KEY': apiKey },
      params: { 
        workflowId: 'ddvIQQUO4YfR1rAx',
        limit: 1
      },
      timeout: 15000
    });
    
    const execId = listRes.data.data?.[0]?.id;
    if (!execId) {
      console.log('❌ 没有找到执行记录');
      return;
    }
    
    console.log(`📋 执行 ID: ${execId}\n`);
    
    // 获取执行详情
    const detailRes = await axios.get(`${baseUrl}/api/v1/executions/${execId}`, {
      headers: { 'X-N8N-API-KEY': apiKey },
      timeout: 15000
    });
    
    const exec = detailRes.data.data;
    console.log(`状态: ${exec.status}`);
    console.log(`开始: ${exec.startedAt}`);
    console.log(`结束: ${exec.stoppedAt}`);
    
    // 检查错误信息
    if (exec.data?.resultData?.error) {
      const error = exec.data.resultData.error;
      console.log('\n❌ 错误详情:');
      console.log(`   消息: ${error.message}`);
      console.log(`   节点: ${error.node || '未知'}`);
      console.log(`   类型: ${error.name || '未知'}`);
      if (error.description) {
        console.log(`   描述: ${error.description}`);
      }
    }
    
    // 检查每个节点的执行结果
    if (exec.data?.resultData?.runData) {
      console.log('\n📊 节点执行情况:');
      for (const [nodeName, nodeData] of Object.entries(exec.data.resultData.runData)) {
        const lastRun = nodeData[nodeData.length - 1];
        if (lastRun?.error) {
          console.log(`   ❌ ${nodeName}: ${lastRun.error.message}`);
        } else if (lastRun?.data?.main?.[0]?.length > 0) {
          console.log(`   ✅ ${nodeName}: 成功 (${lastRun.data.main[0].length} 项)`);
        } else {
          console.log(`   ⚪ ${nodeName}: 无输出`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ API 错误:', error.message);
  }
}

getErrorDetails();
