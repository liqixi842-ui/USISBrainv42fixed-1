const axios = require('axios');

async function updateWorkflow() {
  const apiKey = process.env.N8N_API_KEY;
  const baseUrl = process.env.N8N_BASE_URL;
  const workflowId = 'ddvIQQUO4YfR1rAx';
  const newUrl = 'http://myusis.net/api/news/ingest';
  
  console.log('🔧 更新 N8N 工作流...\n');
  
  try {
    // 1. 获取当前工作流
    console.log('1️⃣ 获取当前工作流配置...');
    const getRes = await axios.get(`${baseUrl}/api/v1/workflows/${workflowId}`, {
      headers: { 'X-N8N-API-KEY': apiKey },
      timeout: 15000
    });
    
    const workflow = getRes.data;
    console.log(`   工作流: ${workflow.name}`);
    
    // 2. 找到并更新 POST to USIS Brain 节点
    let updated = false;
    for (const node of workflow.nodes) {
      if (node.name === 'POST to USIS Brain') {
        console.log(`\n2️⃣ 找到目标节点: ${node.name}`);
        console.log(`   旧 URL: ${node.parameters.url}`);
        node.parameters.url = newUrl;
        console.log(`   新 URL: ${node.parameters.url}`);
        updated = true;
        break;
      }
    }
    
    if (!updated) {
      console.log('❌ 未找到 POST to USIS Brain 节点');
      return;
    }
    
    // 3. 保存更新后的工作流
    console.log('\n3️⃣ 保存更新后的工作流...');
    const updateRes = await axios.put(
      `${baseUrl}/api/v1/workflows/${workflowId}`,
      workflow,
      {
        headers: { 
          'X-N8N-API-KEY': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );
    
    console.log('✅ 工作流更新成功！');
    
    // 4. 重新激活工作流
    console.log('\n4️⃣ 重新激活工作流...');
    await axios.post(
      `${baseUrl}/api/v1/workflows/${workflowId}/activate`,
      {},
      {
        headers: { 'X-N8N-API-KEY': apiKey },
        timeout: 15000
      }
    );
    
    console.log('✅ 工作流已激活！');
    console.log('\n🎉 完成！新闻将发送到: ' + newUrl);
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    if (error.response) {
      console.error('   响应:', JSON.stringify(error.response.data).substring(0, 500));
    }
  }
}

updateWorkflow();
