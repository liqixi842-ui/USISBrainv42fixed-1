const axios = require('axios');
const { Pool } = require('pg');

(async () => {
  const baseURL = process.env.N8N_BASE_URL;
  const apiKey = process.env.N8N_API_KEY;
  const workflowId = 'ddvIQQUO4YfR1rAx';
  
  console.log('等待1分钟让工作流自动执行...');
  console.log('');
  
  await new Promise(r => setTimeout(r, 70000));
  
  console.log('检查最新执行...');
  console.log('');
  
  const listRes = await axios.get(`${baseURL}/api/v1/executions?workflowId=${workflowId}&limit=5`, {
    headers: { 'X-N8N-API-KEY': apiKey }
  });
  
  console.log('最近5次执行:');
  listRes.data.data.forEach((exec, i) => {
    const time = new Date(exec.startedAt).toLocaleString('zh-CN');
    const status = exec.status === 'success' ? 'SUCCESS' : 'FAILED';
    const ago = Math.floor((Date.now() - new Date(exec.startedAt).getTime()) / 1000);
    console.log(`${i+1}. ${status} - ${time} (${ago}秒前, ID:${exec.id})`);
  });
  
  const latest = listRes.data.data[0];
  const isVeryRecent = (Date.now() - new Date(latest.startedAt).getTime()) < 90000;
  
  console.log('');
  if (isVeryRecent && latest.status === 'success') {
    console.log('SUCCESS! 检查数据库...');
    
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const result = await pool.query(
      "SELECT COUNT(*) as count FROM news_items WHERE fetched_at > NOW() - INTERVAL '3 minutes'"
    );
    console.log(`数据库新增: ${result.rows[0].count} 条`);
    
    if (result.rows[0].count > 0) {
      const items = await pool.query(
        "SELECT title, source_id, fetched_at FROM news_items WHERE fetched_at > NOW() - INTERVAL '3 minutes' ORDER BY fetched_at DESC LIMIT 5"
      );
      console.log('');
      console.log('最新新闻:');
      items.rows.forEach((row, i) => {
        console.log(`${i+1}. ${row.title.substring(0, 60)}...`);
      });
      console.log('');
      console.log('N8N工作流完全正常！');
    }
    
    await pool.end();
  } else if (isVeryRecent) {
    console.log(`最新执行失败 (Status: ${latest.status})`);
    console.log('');
    console.log('建议: 在N8N UI中手动Execute Workflow查看具体错误');
  } else {
    console.log('还未触发新执行，继续等待...');
  }
})();
