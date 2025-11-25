const { N8NClient } = require('./n8nClient');

async function main() {
  const client = new N8NClient();
  const workflowId = 'SAInVpfHpMpWE3Fd'; // 简化版本的 ID
  
  const result = await client.getExecutions(workflowId, 3);
  
  if (!result.ok) {
    console.error('获取执行记录失败:', result.error);
    return;
  }
  
  console.log(`最近 ${result.executions.length} 次执行:\n`);
  
  result.executions.forEach((exec, i) => {
    console.log(`${i + 1}. 执行 ID: ${exec.id}`);
    console.log(`   ├─ 状态: ${exec.finished ? '✅ 完成' : '❌ 失败'}`);
    console.log(`   ├─ 开始: ${exec.startedAt}`);
    console.log(`   ├─ 停止: ${exec.stoppedAt}`);
    console.log(`   └─ 耗时: ${exec.stoppedAt ? (new Date(exec.stoppedAt) - new Date(exec.startedAt)) : 'N/A'}ms\n`);
  });
  
  // 获取最新一次执行的详情
  if (result.executions.length > 0) {
    const latestId = result.executions[0].id;
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`获取最新执行 (${latestId}) 的详细错误信息...`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    const execResponse = await require('node-fetch')(`${client.baseURL}/api/v1/executions/${latestId}`, {
      headers: client.headers
    });
    
    const execData = await execResponse.json();
    
    if (execData.data && execData.data.resultData && execData.data.resultData.error) {
      console.log('❌ 执行错误:', execData.data.resultData.error);
    } else {
      console.log('📊 执行数据:', JSON.stringify(execData, null, 2).substring(0, 2000));
    }
  }
}

main();
