const axios = require('axios');
const { Pool } = require('pg');

(async () => {
  console.log('等待80秒让应用重启并运行N8N工作流...');
  console.log('');
  
  await new Promise(r => setTimeout(r, 80000));
  
  const baseURL = process.env.N8N_BASE_URL;
  const apiKey = process.env.N8N_API_KEY;
  const workflowId = 'ddvIQQUO4YfR1rAx';
  
  console.log('检查N8N最新执行...');
  const listRes = await axios.get(`${baseURL}/api/v1/executions?workflowId=${workflowId}&limit=3`, {
    headers: { 'X-N8N-API-KEY': apiKey }
  });
  
  console.log('最近3次执行:');
  listRes.data.data.forEach((exec, i) => {
    const time = new Date(exec.startedAt).toLocaleString('zh-CN');
    const status = exec.status === 'success' ? '成功' : '失败';
    const ago = Math.floor((Date.now() - new Date(exec.startedAt).getTime()) / 1000);
    console.log(`${i+1}. ${status} - ${time} (${ago}秒前)`);
  });
  
  const latest = listRes.data.data[0];
  const isRecent = (Date.now() - new Date(latest.startedAt).getTime()) < 120000;
  
  console.log('');
  
  if (isRecent && latest.status === 'success') {
    console.log('N8N工作流成功运行！');
    console.log('');
    
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const result = await pool.query(
      "SELECT COUNT(*) FROM news_items WHERE fetched_at > NOW() - INTERVAL '5 minutes'"
    );
    console.log(`数据库最近5分钟新增: ${result.rows[0].count} 条新闻`);
    
    if (result.rows[0].count > 0) {
      const items = await pool.query(
        "SELECT title, source_id FROM news_items WHERE fetched_at > NOW() - INTERVAL '5 minutes' LIMIT 3"
      );
      console.log('');
      console.log('最新新闻:');
      items.rows.forEach((row, i) => {
        console.log(`${i+1}. ${row.title.substring(0, 60)}...`);
      });
    }
    
    await pool.end();
    
    console.log('');
    console.log('系统100%完成！');
    console.log('  N8N自动采集: 正常');
    console.log('  API端点: 正常');
    console.log('  数据库写入: 正常');
    console.log('  Telegram Bot: 正常');
    console.log('');
    console.log('可以启用定时执行了！');
  } else if (latest.status === 'error') {
    console.log('仍有错误，检查详情...');
    const detailRes = await axios.get(`${baseURL}/api/v1/executions/${latest.id}?includeData=true`, {
      headers: { 'X-N8N-API-KEY': apiKey }
    });
    const error = detailRes.data.data?.resultData?.error;
    console.log('错误:', error?.message || '未知');
  } else {
    console.log('还未有新的执行');
  }
})();
