const { N8NClient } = require('./n8nClient');
const fetch = require('node-fetch');

async function main() {
  const client = new N8NClient();
  const workflowId = 'mXF5LoFSPFXzmHft';
  
  console.log('🔍 获取 workflow 配置...\n');
  
  // 获取 workflow 详情
  const wfResponse = await fetch(`${client.baseURL}/api/v1/workflows/${workflowId}`, {
    headers: client.headers
  });
  
  const workflow = await wfResponse.json();
  
  console.log('📊 Workflow 节点配置:');
  workflow.nodes.forEach((node, i) => {
    console.log(`\n${i + 1}. ${node.name} (${node.type})`);
    if (node.type === 'n8n-nodes-base.code') {
      const codePreview = node.parameters.jsCode.substring(0, 100);
      console.log(`   代码预览: ${codePreview}...`);
    } else if (node.type === 'n8n-nodes-base.httpRequest') {
      console.log(`   URL: ${node.parameters.url}`);
      if (node.parameters.queryParameters) {
        const urlParam = node.parameters.queryParameters.parameters.find(p => p.name === 'url');
        console.log(`   URL参数: ${urlParam?.value}`);
      }
    }
  });
  
  // 获取最新执行的完整数据
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 获取最新执行的详细信息...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const execsResponse = await fetch(`${client.baseURL}/api/v1/executions?workflowId=${workflowId}&limit=1&includeData=true`, {
    headers: client.headers
  });
  
  const execsData = await execsResponse.json();
  const latestExec = execsData.data[0];
  
  if (!latestExec) {
    console.log('⚠️  没有找到执行记录');
    return;
  }
  
  console.log(`执行 ID: ${latestExec.id}`);
  console.log(`状态: ${latestExec.finished ? '完成' : '失败'}`);
  console.log(`开始: ${latestExec.startedAt}`);
  console.log(`停止: ${latestExec.stoppedAt}`);
  
  // 检查是否有完整的执行数据
  if (!latestExec.data) {
    console.log('\n⚠️  执行数据为空，尝试获取详细执行记录...');
    
    const detailResponse = await fetch(`${client.baseURL}/api/v1/executions/${latestExec.id}?includeData=true`, {
      headers: client.headers
    });
    
    const detailData = await detailResponse.json();
    
    if (detailData.data && detailData.data.resultData) {
      console.log('\n📊 执行结果数据:');
      console.log(JSON.stringify(detailData.data.resultData, null, 2));
    } else {
      console.log('\n❌ 无法获取详细执行数据');
      console.log('完整响应:', JSON.stringify(detailData, null, 2).substring(0, 1000));
    }
  } else {
    console.log('\n📊 执行数据:');
    console.log(JSON.stringify(latestExec.data, null, 2).substring(0, 2000));
  }
}

main().catch(e => console.error('错误:', e.message));
