const { N8NClient } = require('./n8nClient');
const fetch = require('node-fetch');

async function main() {
  const client = new N8NClient();
  const workflowId = 'mXF5LoFSPFXzmHft';
  
  console.log('🔧 修复 workflow：移除环境变量访问\n');
  
  // 获取当前 workflow
  const wfResponse = await fetch(`${client.baseURL}/api/v1/workflows/${workflowId}`, {
    headers: client.headers
  });
  
  const workflow = await wfResponse.json();
  
  // 找到 ScreenshotAPI 节点并修改
  const screenshotNode = workflow.nodes.find(n => n.name === '📸 ScreenshotAPI 截图');
  
  if (!screenshotNode) {
    console.error('❌ 未找到 ScreenshotAPI 截图节点');
    return;
  }
  
  console.log('✅ 找到 ScreenshotAPI 节点');
  console.log('   当前 token 参数:', screenshotNode.parameters.queryParameters.parameters.find(p => p.name === 'token').value);
  
  // 修改 token 参数：使用硬编码的 API key
  const params = screenshotNode.parameters.queryParameters.parameters;
  const tokenParam = params.find(p => p.name === 'token');
  
  if (tokenParam) {
    console.log('\n🔄 修改 token 参数...');
    tokenParam.value = 'HHBYB5H-4CT4970-MVZEKM2-EMEWEXX'; // 直接使用 API key
    console.log('   新值:', tokenParam.value);
  }
  
  // 更新 workflow
  console.log('\n📤 更新 workflow...');
  const updateResult = await client.updateWorkflow(workflowId, workflow);
  
  if (!updateResult.ok) {
    console.error('❌ 更新失败:', updateResult.error);
    return;
  }
  
  console.log('✅ Workflow 更新成功\n');
  
  // 测试
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 测试修复后的 workflow');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const testUrl = 'https://www.tradingview.com/heatmap/stock/?dataset=NAS100&color=change&group=sector&blockSize=market_cap_basic&blockColor=change';
  const webhookUrl = 'https://qian.app.n8n.cloud/webhook/capture_heatmap_screenshotapi';
  
  console.log(`📤 发送测试请求...`);
  console.log(`   URL: ${testUrl.substring(0, 80)}...`);
  
  const testResponse = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: testUrl })
  });
  
  console.log(`\n📥 响应状态: ${testResponse.status} ${testResponse.statusText}`);
  
  const responseText = await testResponse.text();
  console.log(`📊 响应长度: ${responseText.length} 字节`);
  
  if (responseText.length > 0) {
    try {
      const result = JSON.parse(responseText);
      console.log('\n✅ 测试成功！');
      console.log('   Dataset:', result.dataset);
      console.log('   Success:', result.success);
      console.log('   File Size:', result.fileSize ? (result.fileSize / 1024).toFixed(2) + ' KB' : 'N/A');
      console.log('   Screenshot:', result.screenshot ? result.screenshot.substring(0, 50) + '...' : 'null');
    } catch (e) {
      console.log('📝 响应内容:', responseText.substring(0, 500));
    }
  } else {
    console.log('⚠️  响应为空');
    
    // 检查最新执行
    console.log('\n🔍 检查最新执行记录...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // 等待执行完成
    
    const execsResponse = await fetch(`${client.baseURL}/api/v1/executions?workflowId=${workflowId}&limit=1`, {
      headers: client.headers
    });
    
    const execsData = await execsResponse.json();
    const latestExec = execsData.data[0];
    
    if (latestExec) {
      console.log(`   执行 ID: ${latestExec.id}`);
      console.log(`   状态: ${latestExec.finished ? '✅ 完成' : '❌ 失败'}`);
      console.log(`   状态码: ${latestExec.status}`);
    }
  }
}

main();
