const { N8NClient } = require('./n8nClient');

async function main() {
  const client = new N8NClient();
  
  console.log('🔨 创建修复版 workflow（使用硬编码 API key）\n');
  
  const fixedWorkflow = {
    name: "Heatmap Screenshot FIXED",
    nodes: [
      {
        parameters: {
          httpMethod: "POST",
          path: "heatmap_fixed",
          responseMode: "responseNode",
          options: {}
        },
        id: "webhook-node",
        name: "Webhook",
        type: "n8n-nodes-base.webhook",
        typeVersion: 2,
        position: [250, 300],
        webhookId: "heatmap_fixed"
      },
      {
        parameters: {
          method: "GET",
          url: "https://shot.screenshotapi.net/screenshot",
          sendQuery: true,
          queryParameters: {
            parameters: [
              {
                name: "token",
                value: "HHBYB5H-4CT4970-MVZEKM2-EMEWEXX"
              },
              {
                name: "url",
                value: "={{ $json.body.url || $json.url }}"
              },
              {
                name: "fresh",
                value: "true"
              },
              {
                name: "wait_for_event",
                value: "networkidle"
              },
              {
                name: "delay",
                value: "2000"
              },
              {
                name: "output",
                value: "json"
              },
              {
                name: "file_type",
                value: "png"
              },
              {
                name: "width",
                value: "1400"
              },
              {
                name: "height",
                value: "900"
              }
            ]
          },
          options: {
            timeout: 35000
          }
        },
        id: "screenshot-node",
        name: "ScreenshotAPI",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.3,
        position: [470, 300]
      },
      {
        parameters: {
          respondWith: "json",
          responseBody: "={{ $json }}",
          options: {}
        },
        id: "respond-node",
        name: "Respond",
        type: "n8n-nodes-base.respondToWebhook",
        typeVersion: 1.1,
        position: [690, 300]
      }
    ],
    connections: {
      "Webhook": {
        main: [[{ node: "ScreenshotAPI", type: "main", index: 0 }]]
      },
      "ScreenshotAPI": {
        main: [[{ node: "Respond", type: "main", index: 0 }]]
      }
    },
    settings: {
      executionOrder: "v1"
    }
  };
  
  // 检查是否已存在
  const existing = await client.findWorkflowByName(fixedWorkflow.name);
  
  let workflowId;
  
  if (existing) {
    console.log(`删除旧版本: ${existing.id}`);
    await client.deleteWorkflow(existing.id);
  }
  
  console.log('创建新 workflow...');
  const result = await client.createWorkflow(fixedWorkflow);
  
  if (!result.ok) {
    console.error('❌ 创建失败:', result.error);
    return;
  }
  
  workflowId = result.workflow.id;
  console.log(`✅ Workflow 创建成功 (ID: ${workflowId})`);
  
  // 激活
  await client.toggleWorkflow(workflowId, true);
  console.log('✅ Workflow 已激活\n');
  
  const webhookUrl = `https://qian.app.n8n.cloud/webhook/heatmap_fixed`;
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🔗 新的 Webhook URL:`);
  console.log(`   ${webhookUrl}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // 立即测试
  console.log('🧪 测试 1: 纳指 NAS100\n');
  
  const testUrl1 = 'https://www.tradingview.com/heatmap/stock/?dataset=NAS100&color=change&group=sector&blockSize=market_cap_basic&blockColor=change';
  
  const response1 = await require('node-fetch')(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: testUrl1 })
  });
  
  console.log(`响应状态: ${response1.status}`);
  
  const text1 = await response1.text();
  console.log(`响应长度: ${text1.length} 字节`);
  
  if (text1.length > 0) {
    try {
      const result1 = JSON.parse(text1);
      console.log('\n✅ 测试成功！');
      console.log(`   screenshot: ${result1.screenshot ? result1.screenshot.substring(0, 100) + '...' : 'null'}`);
      
      if (result1.screenshot && result1.screenshot.startsWith('https://')) {
        console.log(`\n🎉 成功获取截图 URL！`);
        console.log(`   URL 长度: ${result1.screenshot.length}`);
      }
    } catch (e) {
      console.log('响应内容:', text1.substring(0, 500));
    }
  } else {
    console.log('❌ 响应为空');
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ 修复完成！请更新环境变量:');
  console.log(`   N8N_HEATMAP_WEBHOOK=${webhookUrl}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main();
