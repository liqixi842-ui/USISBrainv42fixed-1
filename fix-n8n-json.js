const axios = require('axios');
const { Pool } = require('pg');

(async () => {
  const baseURL = process.env.N8N_BASE_URL;
  const apiKey = process.env.N8N_API_KEY;
  const workflowId = 'ddvIQQUO4YfR1rAx';
  
  console.log('添加Code节点来处理JSON构建...');
  console.log('');
  
  const wfRes = await axios.get(`${baseURL}/api/v1/workflows/${workflowId}`, {
    headers: { 'X-N8N-API-KEY': apiKey }
  });
  
  const workflow = wfRes.data;
  
  // 添加Code节点
  const codeNode = {
    id: 'prepare-json',
    name: 'Prepare JSON Payload',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [960, 512],
    parameters: {
      jsCode: `return items.map(item => ({
  json: {
    title: item.json.title || '',
    url: item.json.link || '',
    source: item.json.source || 'Unknown',
    published_at: item.json.isoDate || new Date().toISOString(),
    summary: (item.json.contentSnippet || item.json.description || '').substring(0, 500),
    tier: item.json.tier || 4,
    symbols: [],
    dryRun: false
  }
}));`
    }
  };
  
  const existingCodeNode = workflow.nodes.find(n => n.name === 'Prepare JSON Payload');
  if (!existingCodeNode) {
    workflow.nodes.push(codeNode);
    console.log('添加了Code节点');
  } else {
    console.log('更新已存在的Code节点');
    existingCodeNode.parameters = codeNode.parameters;
  }
  
  // 修改连接
  workflow.connections['Merge All Feeds'] = {
    main: [[{ node: 'Prepare JSON Payload', type: 'main', index: 0 }]]
  };
  workflow.connections['Prepare JSON Payload'] = {
    main: [[{ node: 'POST to USIS Brain', type: 'main', index: 0 }]]
  };
  
  // 简化HTTP节点
  const httpNode = workflow.nodes.find(n => n.name === 'POST to USIS Brain');
  httpNode.parameters.specifyBody = 'json';
  delete httpNode.parameters.bodyParameters;
  httpNode.parameters.jsonBody = '={{ $json }}';
  
  console.log('修改了连接: Merge -> Code -> HTTP');
  console.log('HTTP节点使用简单的{{ $json }}');
  console.log('');
  
  await axios.put(`${baseURL}/api/v1/workflows/${workflowId}`, {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings || {}
  }, {
    headers: { 'X-N8N-API-KEY': apiKey, 'Content-Type': 'application/json' }
  });
  
  console.log('SUCCESS: 已保存');
  console.log('');
  console.log('等待70秒测试...');
  
  await new Promise(r => setTimeout(r, 70000));
  
  const listRes = await axios.get(`${baseURL}/api/v1/executions?workflowId=${workflowId}&limit=2`, {
    headers: { 'X-N8N-API-KEY': apiKey }
  });
  
  console.log('');
  const latest = listRes.data.data[0];
  const status = latest.status === 'success' ? 'SUCCESS' : 'FAILED';
  const time = new Date(latest.startedAt).toLocaleString('zh-CN');
  console.log(`最新执行: ${status} - ${time}`);
  
  if (latest.status === 'success') {
    console.log('');
    console.log('N8N工作流修复成功！');
    
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const result = await pool.query(
      "SELECT COUNT(*) FROM news_items WHERE fetched_at > NOW() - INTERVAL '2 minutes'"
    );
    console.log(`数据库新增: ${result.rows[0].count} 条新闻`);
    await pool.end();
  } else {
    const detailRes = await axios.get(`${baseURL}/api/v1/executions/${latest.id}?includeData=true`, {
      headers: { 'X-N8N-API-KEY': apiKey }
    });
    if (detailRes.data.data?.resultData?.error) {
      console.log('');
      console.log('错误:', detailRes.data.data.resultData.error.message);
    }
  }
})();
