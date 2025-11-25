const { N8NClient } = require('./n8nClient');
const fetch = require('node-fetch');
const fs = require('fs');

async function main() {
  const client = new N8NClient();
  const execId = '3357';
  
  const response = await fetch(`${client.baseURL}/api/v1/executions/${execId}?includeData=true`, {
    headers: client.headers
  });
  
  const data = await response.json();
  
  // 保存完整数据到文件
  fs.writeFileSync('/tmp/n8n-execution-full.json', JSON.stringify(data, null, 2));
  console.log('✅ 完整执行数据已保存到: /tmp/n8n-execution-full.json\n');
  
  // 分析每个节点的执行状态
  if (data.data && data.data.resultData && data.data.resultData.runData) {
    const runData = data.data.resultData.runData;
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 节点执行状态分析');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    Object.keys(runData).forEach(nodeName => {
      const runs = runData[nodeName];
      console.log(`\n🔹 节点: ${nodeName}`);
      
      runs.forEach((run, i) => {
        console.log(`   执行 #${i + 1}:`);
        console.log(`   ├─ 状态: ${run.executionStatus || 'unknown'}`);
        console.log(`   ├─ 耗时: ${run.executionTime}ms`);
        
        if (run.error) {
          console.log(`   ├─ ❌ 错误类型: ${run.error.name}`);
          console.log(`   ├─ ❌ 错误消息: ${run.error.message}`);
          if (run.error.description) {
            console.log(`   ├─ 详情: ${run.error.description}`);
          }
          if (run.error.context) {
            console.log(`   └─ 上下文: ${JSON.stringify(run.error.context)}`);
          }
        } else {
          console.log(`   ├─ ✅ 无错误`);
          if (run.data && run.data.main && run.data.main[0]) {
            console.log(`   └─ 输出: ${run.data.main[0].length} 项`);
            // 打印第一项的 json 数据
            if (run.data.main[0][0] && run.data.main[0][0].json) {
              console.log(`       数据预览: ${JSON.stringify(run.data.main[0][0].json).substring(0, 150)}...`);
            }
          }
        }
      });
    });
    
    // 检查是否有整体错误
    if (data.data.resultData.error) {
      console.log('\n\n❌ 整体执行错误:');
      console.log(JSON.stringify(data.data.resultData.error, null, 2));
    }
    
  } else {
    console.log('⚠️  没有找到 runData');
  }
  
  // 检查执行是否完成
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`执行状态: ${data.finished ? '✅ 完成' : '❌ 未完成'}`);
  console.log(`模式: ${data.mode}`);
  console.log(`状态码: ${data.status || 'N/A'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main();
