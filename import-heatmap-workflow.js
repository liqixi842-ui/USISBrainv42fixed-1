/**
 * 🚀 导入并激活热力图 ScreenshotAPI Workflow
 * 修复热力图截图总是返回 S&P500 的问题
 */

const fs = require('fs');
const path = require('path');
const { N8NClient } = require('./n8nClient');

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 开始导入热力图 ScreenshotAPI Workflow');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const client = new N8NClient();

  // ═══ STEP 1: Health Check ═══
  console.log('📡 Step 1: 检查 N8N API 连接...');
  const health = await client.healthCheck(false);
  
  if (!health.ok) {
    console.error('❌ N8N API 不可用:', health.error);
    console.error('   请检查环境变量 N8N_BASE_URL 和 N8N_API_KEY');
    process.exit(1);
  }
  
  console.log(`✅ N8N API 连接成功 (当前有 ${health.workflowCount} 个 workflows)\n`);

  // ═══ STEP 2: 读取 Workflow JSON ═══
  console.log('📄 Step 2: 读取 workflow JSON 文件...');
  const workflowPath = path.join(__dirname, 'n8n-workflows', 'heatmap-screenshotapi.json');
  
  if (!fs.existsSync(workflowPath)) {
    console.error(`❌ 文件不存在: ${workflowPath}`);
    process.exit(1);
  }
  
  let workflowJson = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
  console.log(`✅ 成功读取: ${workflowJson.name}`);
  console.log(`   节点数量: ${workflowJson.nodes.length}`);
  console.log(`   Webhook ID: ${workflowJson.nodes[0].webhookId}`);
  
  // 清理 n8n API 不接受的额外字段
  console.log('   清理元数据字段...');
  delete workflowJson.pinData;
  delete workflowJson.staticData;
  delete workflowJson.triggerCount;
  delete workflowJson.updatedAt;
  delete workflowJson.versionId;
  delete workflowJson.meta;
  delete workflowJson.tags;
  console.log('   ✅ 元数据已清理\n');

  // ═══ STEP 3: 检查是否已存在同名 Workflow ═══
  console.log('🔍 Step 3: 检查是否已存在同名 workflow...');
  const existing = await client.findWorkflowByName(workflowJson.name);
  
  let workflowId;
  
  if (existing) {
    console.log(`⚠️  发现已存在的 workflow: ${existing.name} (ID: ${existing.id})`);
    console.log('   选择操作: 更新现有 workflow\n');
    
    // 更新现有 workflow
    const updateResult = await client.updateWorkflow(existing.id, workflowJson);
    if (!updateResult.ok) {
      console.error('❌ 更新 workflow 失败:', updateResult.error);
      process.exit(1);
    }
    workflowId = existing.id;
    console.log(`✅ Workflow 更新成功 (ID: ${workflowId})\n`);
  } else {
    console.log('   未发现同名 workflow，将创建新的\n');
    
    // 创建新 workflow
    const createResult = await client.createWorkflow(workflowJson);
    if (!createResult.ok) {
      console.error('❌ 创建 workflow 失败:', createResult.error);
      process.exit(1);
    }
    workflowId = createResult.workflow.id;
    console.log(`✅ Workflow 创建成功 (ID: ${workflowId})\n`);
  }

  // ═══ STEP 4: 激活 Workflow ═══
  console.log('🔌 Step 4: 激活 workflow...');
  const activateResult = await client.toggleWorkflow(workflowId, true);
  
  if (!activateResult.ok) {
    console.error('❌ 激活 workflow 失败:', activateResult.error);
    process.exit(1);
  }
  
  console.log(`✅ Workflow 已激活\n`);

  // ═══ STEP 5: 验证关键参数 ═══
  console.log('🔍 Step 5: 验证关键参数配置...');
  
  const screenshotNode = workflowJson.nodes.find(n => n.name === '📸 ScreenshotAPI 截图');
  if (!screenshotNode) {
    console.error('❌ 未找到 ScreenshotAPI 截图节点');
    process.exit(1);
  }
  
  const params = screenshotNode.parameters.queryParameters.parameters;
  const urlParam = params.find(p => p.name === 'url');
  const freshParam = params.find(p => p.name === 'fresh');
  const delayParam = params.find(p => p.name === 'delay');
  const waitParam = params.find(p => p.name === 'wait_for_event');
  
  console.log('   关键参数检查:');
  console.log(`   ✅ url: ${urlParam?.value} ${urlParam?.value.includes('$json') ? '(动态传参 ✓)' : '(硬编码 ✗)'}`);
  console.log(`   ✅ fresh: ${freshParam?.value}`);
  console.log(`   ✅ delay: ${delayParam?.value}ms`);
  console.log(`   ✅ wait_for_event: ${waitParam?.value}\n`);
  
  if (!urlParam?.value.includes('$json')) {
    console.warn('⚠️  警告: URL 参数不是动态传参！');
  }

  // ═══ STEP 6: 显示 Webhook URL ═══
  console.log('🔗 Step 6: Webhook URL 信息...');
  const webhookId = workflowJson.nodes[0].webhookId;
  const baseURL = process.env.N8N_BASE_URL || 'https://qian.app.n8n.cloud';
  const webhookUrl = `${baseURL}/webhook/${webhookId}`;
  
  console.log(`   Webhook URL: ${webhookUrl}`);
  console.log(`   请在 Replit 中设置环境变量:`);
  console.log(`   N8N_HEATMAP_WEBHOOK=${webhookUrl}\n`);

  // ═══ STEP 7: 测试建议 ═══
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ 导入完成！下一步测试建议：');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('1️⃣  在 Replit 环境变量中设置:');
  console.log(`   N8N_HEATMAP_WEBHOOK=${webhookUrl}\n`);
  
  console.log('2️⃣  重启 Replit 应用使环境变量生效\n');
  
  console.log('3️⃣  在 Telegram 中测试以下命令:');
  console.log('   • 纳指科技股热力图');
  console.log('   • 西班牙IBEX金融板块热力图');
  console.log('   • 道指热力图\n');
  
  console.log('4️⃣  观察 n8n 执行日志（在 n8n UI 中）:');
  console.log(`   https://qian.app.n8n.cloud/workflow/${workflowId}\n`);
  
  console.log('5️⃣  预期结果:');
  console.log('   • 不同 dataset → 不同热力图图片');
  console.log('   • n8n 日志显示正确的 tradingview_url');
  console.log('   • 无 Black Friday 弹窗遮挡\n');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(error => {
  console.error('\n❌ 导入失败:', error.message);
  console.error(error.stack);
  process.exit(1);
});
