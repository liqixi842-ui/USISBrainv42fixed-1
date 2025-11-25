const { N8NClient } = require('./n8nClient');

async function main() {
  const client = new N8NClient();
  
  const execId = '3357'; // 最新的一次执行
  
  console.log(`🔍 获取执行 ${execId} 的详细信息...\n`);
  
  try {
    const response = await require('node-fetch')(`${client.baseURL}/api/v1/executions/${execId}`, {
      headers: client.headers
    });
    
    if (!response.ok) {
      console.error('❌ API 调用失败:', response.status, response.statusText);
      return;
    }
    
    const execution = await response.json();
    
    console.log('📊 执行详情:');
    console.log(`   ├─ ID: ${execution.id}`);
    console.log(`   ├─ 状态: ${execution.finished ? '完成' : '失败'}`);
    console.log(`   ├─ 模式: ${execution.mode}`);
    console.log(`   ├─ 开始: ${execution.startedAt}`);
    console.log(`   └─ 停止: ${execution.stoppedAt}\n`);
    
    if (execution.data && execution.data.resultData) {
      console.log('🔍 节点执行结果:');
      Object.keys(execution.data.resultData.runData || {}).forEach(nodeName => {
        const runs = execution.data.resultData.runData[nodeName];
        console.log(`\n   • 节点: ${nodeName}`);
        runs.forEach((run, i) => {
          console.log(`     ├─ 执行 ${i + 1}:`);
          console.log(`     ├─ 开始: ${run.startTime}`);
          console.log(`     ├─ 时长: ${run.executionTime}ms`);
          
          if (run.error) {
            console.log(`     ├─ ❌ 错误: ${run.error.message}`);
            console.log(`     └─ 详情: ${JSON.stringify(run.error, null, 2)}`);
          } else if (run.data && run.data.main && run.data.main[0]) {
            console.log(`     └─ ✅ 输出: ${run.data.main[0].length} 项`);
          }
        });
      });
    }
    
    // 打印完整的 JSON（用于调试）
    console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('完整执行数据 (JSON):');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(JSON.stringify(execution.data, null, 2));
    
  } catch (error) {
    console.error('❌ 查询失败:', error.message);
  }
}

main();
