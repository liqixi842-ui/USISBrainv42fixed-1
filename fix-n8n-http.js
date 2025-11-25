const axios = require('axios');

(async () => {
  const baseURL = process.env.N8N_BASE_URL;
  const apiKey = process.env.N8N_API_KEY;
  const workflowId = 'ddvIQQUO4YfR1rAx';
  
  console.log('Fixing HTTP node configuration...');
  console.log('');
  
  const wfRes = await axios.get(`${baseURL}/api/v1/workflows/${workflowId}`, {
    headers: { 'X-N8N-API-KEY': apiKey }
  });
  
  const workflow = wfRes.data;
  const httpNode = workflow.nodes.find(n => n.name === 'POST to USIS Brain');
  
  const correctJsonBody = `{
  "title": "{{ $json.title }}",
  "url": "{{ $json.link }}",
  "source": "{{ $json.source }}",
  "published_at": "{{ $json.isoDate }}",
  "summary": "{{ $json.contentSnippet || $json.description || '' }}",
  "tier": {{ $json.tier }},
  "symbols": [],
  "dryRun": false
}`;
  
  httpNode.parameters.jsonBody = correctJsonBody;
  
  console.log('New JSON Body:');
  console.log(correctJsonBody);
  console.log('');
  
  await axios.put(`${baseURL}/api/v1/workflows/${workflowId}`, {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings || {}
  }, {
    headers: { 'X-N8N-API-KEY': apiKey, 'Content-Type': 'application/json' }
  });
  
  console.log('SUCCESS: HTTP node fixed!');
  console.log('');
  console.log('Test in N8N UI now by clicking Execute Workflow');
})();
