const { N8NClient } = require('./n8nClient');

async function main() {
  const client = new N8NClient();
  
  console.log('🔍 查询最近的 workflow 执行记录...\n');
  
  const workflowId = 'mXF5LoFSPFXzmHft';
  
  try {
    const response = await require('node-fetch')(`${client.baseURL}/api/v1/executions?workflowId=${workflowId}&limit=5`, {
      headers: client.headers
    });
    
    if (!response.ok) {
      console.error('❌ API 调用失败:', response.status, response.statusText);
      return;
    }
    
    const result = await response.json();
    const executions = result.data || [];
    
    console.log(`📊 找到 ${executions.length} 条执行记录:\n`);
    
    executions.forEach((exec, i) => {
      console.log(`${i + 1}. 执行 ID: ${exec.id}`);
      console.log(`   ├─ 状态: ${exec.finished ? '✅ 完成' : '❌ 失败'}`);
      console.log(`   ├─ 模式: ${exec.mode}`);
      console.log(`   ├─ 开始时间: ${exec.startedAt}`);
      console.log(`   ├─ 停止时间: ${exec.stoppedAt || 'N/A'}`);
      
      if (exec.data) {
        console.log(`   └─ 节点执行:`);
        Object.keys(exec.data.resultData || {}).forEach(nodeName => {
          const nodeData = exec.data.resultData[nodeName];
          console.log(`       • ${nodeName}: ${nodeData ? nodeData.length + ' 项' : '无数据'}`);
        });
      }
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ 查询失败:', error.message);
  }
}

main();
