const { N8NClient } = require('./n8nClient');
const fetch = require('node-fetch');

async function main() {
  const client = new N8NClient();
  const workflowId = 'GaMjrt46sxzrIEry';
  
  const execsResponse = await fetch(`${client.baseURL}/api/v1/executions?workflowId=${workflowId}&limit=1&includeData=true`, {
    headers: client.headers
  });
  
  const execsData = await execsResponse.json();
  const latestExec = execsData.data[0];
  
  if (!latestExec) {
    console.log('⚠️  没有找到执行记录');
    return;
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`最新执行 (ID: ${latestExec.id})`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`状态: ${latestExec.finished ? '✅ 完成' : '❌ 失败'}`);
  console.log(`开始: ${latestExec.startedAt}`);
  console.log(`停止: ${latestExec.stoppedAt || 'N/A'}`);
  
  if (latestExec.data && latestExec.data.resultData && latestExec.data.resultData.runData) {
    const runData = latestExec.data.resultData.runData;
    
    console.log('\n📊 节点执行状态:\n');
    
    Object.keys(runData).forEach(nodeName => {
      const runs = runData[nodeName];
      const run = runs[0];
      
      console.log(`🔹 ${nodeName}`);
      console.log(`   ├─ 状态: ${run.executionStatus === 'success' ? '✅' : '❌'} ${run.executionStatus}`);
      
      if (run.error) {
        console.log(`   ├─ ❌ 错误: ${run.error.message}`);
        console.log(`   └─ 详情: ${run.error.description || 'N/A'}`);
      } else if (run.data && run.data.main && run.data.main[0] && run.data.main[0][0]) {
        const outputData = run.data.main[0][0].json;
        
        if (nodeName === 'Webhook') {
          console.log(`   └─ 接收到: url = ${outputData.body?.url || outputData.url || 'N/A'}`);
        } else if (nodeName === 'ScreenshotAPI') {
          console.log(`   └─ 输出: ${JSON.stringify(outputData).substring(0, 100)}...`);
        }
      }
      console.log('');
    });
    
    if (latestExec.data.resultData.error) {
      console.log('\n❌ 整体错误:');
      console.log(JSON.stringify(latestExec.data.resultData.error, null, 2));
    }
  }
}

main();
