const axios = require('axios');

(async () => {
  const baseURL = process.env.N8N_BASE_URL;
  const apiKey = process.env.N8N_API_KEY;
  const workflowId = 'ddvIQQUO4YfR1rAx';
  
  console.log('重新构建简化的N8N工作流...');
  console.log('');
  
  const wfRes = await axios.get(`${baseURL}/api/v1/workflows/${workflowId}`, {
    headers: { 'X-N8N-API-KEY': apiKey }
  });
  
  const workflow = wfRes.data;
  
  // 只保留需要的节点
  const keepNodes = [
    'Schedule Every 5min',
    'WSJ RSS',
    'Add WSJ Metadata',
    'Bloomberg RSS',
    'Add Bloomberg Metadata',
    'Merge All Feeds',
    'POST to USIS Brain'
  ];
  
  // 过滤节点
  workflow.nodes = workflow.nodes.filter(n => keepNodes.includes(n.name));
  
  console.log(`保留了 ${workflow.nodes.length} 个节点:`);
  workflow.nodes.forEach(n => console.log(`  • ${n.name}`));
  
  // 重新构建连接
  workflow.connections = {
    'Schedule Every 5min': {
      main: [
        [{ node: 'WSJ RSS', type: 'main', index: 0 }],
        [{ node: 'Bloomberg RSS', type: 'main', index: 0 }]
      ]
    },
    'WSJ RSS': {
      main: [[{ node: 'Add WSJ Metadata', type: 'main', index: 0 }]]
    },
    'Add WSJ Metadata': {
      main: [[{ node: 'Merge All Feeds', type: 'main', index: 0 }]]
    },
    'Bloomberg RSS': {
      main: [[{ node: 'Add Bloomberg Metadata', type: 'main', index: 0 }]]
    },
    'Add Bloomberg Metadata': {
      main: [[{ node: 'Merge All Feeds', type: 'main', index: 1 }]]
    },
    'Merge All Feeds': {
      main: [[{ node: 'POST to USIS Brain', type: 'main', index: 0 }]]
    }
  };
  
  console.log('');
  console.log('新的连接流程:');
  console.log('  Trigger -> WSJ RSS -> Add WSJ Metadata');
  console.log('          -> Bloomberg RSS -> Add Bloomberg Metadata');
  console.log('          -> Merge -> HTTP POST');
  console.log('');
  
  // 修复Merge节点参数
  const mergeNode = workflow.nodes.find(n => n.name === 'Merge All Feeds');
  if (mergeNode) {
    mergeNode.parameters.mode = 'append';
  }
  
  console.log('保存简化的工作流...');
  
  await axios.put(`${baseURL}/api/v1/workflows/${workflowId}`, {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings || {}
  }, {
    headers: { 'X-N8N-API-KEY': apiKey, 'Content-Type': 'application/json' }
  });
  
  console.log('');
  console.log('SUCCESS: 工作流已简化为只包含WSJ和Bloomberg!');
  console.log('');
  console.log('下一步: 在N8N UI中手动执行测试');
})();
