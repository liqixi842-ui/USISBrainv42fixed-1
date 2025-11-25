/**
 * 简化 workflow：移除 Code 节点，直接测试 ScreenshotAPI
 */

const fs = require('fs');
const { N8NClient } = require('./n8nClient');

async function main() {
  const client = new N8NClient();
  
  // 创建一个更简单的测试 workflow
  const simpleWorkflow = {
    name: "Heatmap Screenshot via ScreenshotAPI (Simple)",
    nodes: [
      {
        parameters: {
          httpMethod: "POST",
          path: "test_heatmap_simple",
          responseMode: "responseNode",
          options: {}
        },
        id: "webhook-node",
        name: "Webhook",
        type: "n8n-nodes-base.webhook",
        typeVersion: 2,
        position: [250, 300],
        webhookId: "test_heatmap_simple"
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
                value: process.env.SCREENSHOT_API_KEY || "HHBYB5H-4CT4970-MVZEKM2-EMEWEXX"
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
                name: "output",
                value: "json"
              },
              {
                name: "file_type",
                value: "png"
              },
              {
                name: "delay",
                value: "2000"
              }
            ]
          },
          options: {
            timeout: 30000
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
  const existing = await client.findWorkflowByName(simpleWorkflow.name);
  
  let workflowId;
  
  if (existing) {
    console.log(`更新现有 workflow: ${existing.id}`);
    const result = await client.updateWorkflow(existing.id, simpleWorkflow);
    if (!result.ok) {
      console.error('更新失败:', result.error);
      return;
    }
    workflowId = existing.id;
  } else {
    console.log('创建新 workflow...');
    const result = await client.createWorkflow(simpleWorkflow);
    if (!result.ok) {
      console.error('创建失败:', result.error);
      return;
    }
    workflowId = result.workflow.id;
  }
  
  // 激活
  await client.toggleWorkflow(workflowId, true);
  
  console.log(`\n✅ 简化 workflow 已就绪`);
  console.log(`   ID: ${workflowId}`);
  console.log(`   Webhook: https://qian.app.n8n.cloud/webhook/test_heatmap_simple`);
  console.log(`\n测试命令:`);
  console.log(`   curl -X POST https://qian.app.n8n.cloud/webhook/test_heatmap_simple \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -d '{"url":"https://www.tradingview.com/heatmap/stock/?dataset=NAS100"}'`);
}

main();
