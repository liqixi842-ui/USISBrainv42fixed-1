const axios = require('axios');

async function verifyUrl() {
  const apiKey = process.env.N8N_API_KEY;
  const baseUrl = process.env.N8N_BASE_URL;
  
  try {
    const res = await axios.get(`${baseUrl}/api/v1/workflows/ddvIQQUO4YfR1rAx`, {
      headers: { 'X-N8N-API-KEY': apiKey },
      timeout: 15000
    });
    
    const workflow = res.data;
    
    // 找到 POST 节点
    const postNode = workflow.nodes?.find(n => n.name === 'POST to USIS Brain');
    if (postNode) {
      console.log('当前工作流中的 URL:');
      console.log(`   ${postNode.parameters?.url}`);
      
      if (postNode.parameters?.url === 'http://myusis.net/api/news/ingest') {
        console.log('\n✅ URL 已正确更新！');
        console.log('   下一次执行（5分钟后）应该会成功');
      } else {
        console.log('\n⚠️ URL 未更新，需要重新更新');
      }
    }
    
  } catch (error) {
    console.error('❌:', error.message);
  }
}

verifyUrl();
