const axios = require('axios');

async function getWorkflow() {
  const apiKey = process.env.N8N_API_KEY;
  const baseUrl = process.env.N8N_BASE_URL;
  
  console.log('🔍 获取当前工作流配置...\n');
  
  try {
    const res = await axios.get(`${baseUrl}/api/v1/workflows/ddvIQQUO4YfR1rAx`, {
      headers: { 'X-N8N-API-KEY': apiKey },
      timeout: 15000
    });
    
    const workflow = res.data;
    
    // 找到 POST to USIS Brain 节点
    const postNode = workflow.nodes?.find(n => n.name === 'POST to USIS Brain');
    if (postNode) {
      console.log('当前 POST 节点配置:');
      console.log(`   URL: ${postNode.parameters?.url}`);
    }
    
    // 检查是否有其他服务器URL引用
    console.log('\n📋 所有 HTTP 节点:');
    for (const node of workflow.nodes || []) {
      if (node.type?.includes('httpRequest') || node.parameters?.url) {
        console.log(`   - ${node.name}: ${node.parameters?.url || '无URL'}`);
      }
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
  }
}

getWorkflow();
