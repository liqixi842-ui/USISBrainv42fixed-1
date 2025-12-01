const axios = require('axios');

async function getErrorDetails() {
  const apiKey = process.env.N8N_API_KEY;
  const baseUrl = process.env.N8N_BASE_URL;
  
  console.log('🔍 获取最近一次执行的详细错误...\n');
  
  try {
    // 直接获取执行详情
    const res = await axios.get(`${baseUrl}/api/v1/executions/5245`, {
      headers: { 'X-N8N-API-KEY': apiKey },
      timeout: 15000
    });
    
    console.log('原始响应:');
    console.log(JSON.stringify(res.data, null, 2).substring(0, 3000));
    
  } catch (error) {
    console.error('❌ API 错误:', error.message);
    if (error.response) {
      console.log('响应数据:', JSON.stringify(error.response.data, null, 2).substring(0, 1000));
    }
  }
}

getErrorDetails();
