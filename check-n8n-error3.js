const axios = require('axios');

async function getErrorDetails() {
  const apiKey = process.env.N8N_API_KEY;
  const baseUrl = process.env.N8N_BASE_URL;
  
  console.log('🔍 获取执行详情（包含节点数据）...\n');
  
  try {
    // 获取包含全部数据的执行详情
    const res = await axios.get(`${baseUrl}/api/v1/executions/5245`, {
      headers: { 'X-N8N-API-KEY': apiKey },
      params: { includeData: true },
      timeout: 15000
    });
    
    const exec = res.data;
    console.log(`状态: ${exec.status}`);
    console.log(`时间: ${exec.startedAt} → ${exec.stoppedAt}`);
    
    // 检查是否有 data 字段
    if (exec.data) {
      console.log('\n📊 执行数据:');
      console.log(JSON.stringify(exec.data, null, 2).substring(0, 2500));
    } else {
      console.log('\n⚠️ 无详细数据（可能需要更高权限）');
      
      // 尝试列出最近的成功执行
      console.log('\n🔍 查找最后一次成功执行...');
      const listRes = await axios.get(`${baseUrl}/api/v1/executions`, {
        headers: { 'X-N8N-API-KEY': apiKey },
        params: { 
          workflowId: 'ddvIQQUO4YfR1rAx',
          status: 'success',
          limit: 5
        },
        timeout: 15000
      });
      
      const successExecs = listRes.data.data || [];
      if (successExecs.length > 0) {
        console.log(`找到 ${successExecs.length} 次成功执行:`);
        for (const e of successExecs) {
          console.log(`   ✅ ${e.startedAt}`);
        }
      } else {
        console.log('⚠️ 没有成功的执行记录！');
      }
    }
    
  } catch (error) {
    console.error('❌ API 错误:', error.message);
  }
}

getErrorDetails();
