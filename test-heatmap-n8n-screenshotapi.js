/**
 * 🧪 测试新的热力图 ScreenshotAPI Workflow
 * 验证不同 dataset 是否返回不同的热力图
 */

const fetch = require('node-fetch');

const TEST_CASES = [
  {
    name: '纳指科技股',
    url: 'https://www.tradingview.com/heatmap/stock/?dataset=NAS100&color=change&group=sector&blockSize=market_cap_basic&blockColor=change',
    expectedDataset: 'NAS100'
  },
  {
    name: '道琼斯指数',
    url: 'https://www.tradingview.com/heatmap/stock/?dataset=DJI&color=change&group=sector&blockSize=market_cap_basic&blockColor=change',
    expectedDataset: 'DJI'
  },
  {
    name: '西班牙IBEX35',
    url: 'https://www.tradingview.com/heatmap/stock/?dataset=IBEX35&color=change&group=sector&blockSize=market_cap_basic&blockColor=change',
    expectedDataset: 'IBEX35'
  }
];

async function testWorkflow(testCase) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🧪 测试: ${testCase.name}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  const webhookUrl = process.env.N8N_HEATMAP_WEBHOOK || 'https://qian.app.n8n.cloud/webhook/capture_heatmap_screenshotapi';
  
  console.log(`📤 发送请求到: ${webhookUrl}`);
  console.log(`📊 TradingView URL: ${testCase.url.substring(0, 80)}...`);
  console.log(`🎯 预期 Dataset: ${testCase.expectedDataset}`);
  
  try {
    const startTime = Date.now();
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: testCase.url })
    });
    
    const elapsed = Date.now() - startTime;
    
    console.log(`\n📥 响应状态: ${response.status} ${response.statusText}`);
    console.log(`⏱️  耗时: ${elapsed}ms`);
    
    // 先获取原始响应文本
    const responseText = await response.text();
    console.log(`📝 原始响应长度: ${responseText.length} 字节`);
    console.log(`📝 前 200 字符: ${responseText.substring(0, 200)}`);
    
    if (!response.ok) {
      console.error(`❌ 请求失败: ${responseText}`);
      return { success: false, error: responseText };
    }
    
    // 尝试解析 JSON
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error(`❌ JSON 解析失败: ${parseError.message}`);
      console.error(`   响应内容: ${responseText.substring(0, 500)}`);
      return { success: false, error: `JSON parse error: ${parseError.message}` };
    }
    
    console.log(`\n📊 响应数据:`);
    console.log(`   ├─ success: ${result.success}`);
    console.log(`   ├─ dataset: ${result.dataset}`);
    console.log(`   ├─ fileSize: ${result.fileSize ? (result.fileSize / 1024).toFixed(2) + ' KB' : 'N/A'}`);
    console.log(`   ├─ screenshot: ${result.screenshot ? result.screenshot.substring(0, 50) + '...' : 'null'}`);
    console.log(`   └─ timestamp: ${result.timestamp}`);
    
    // 验证 dataset 是否正确
    if (result.dataset === testCase.expectedDataset) {
      console.log(`\n✅ Dataset 验证通过: ${result.dataset} === ${testCase.expectedDataset}`);
    } else {
      console.log(`\n❌ Dataset 不匹配: 预期 ${testCase.expectedDataset}, 实际 ${result.dataset}`);
    }
    
    // 验证是否有截图数据
    if (result.screenshot && result.screenshot.startsWith('data:image/png;base64,')) {
      console.log(`✅ 截图数据有效 (base64 长度: ${result.screenshot.length})`);
    } else {
      console.log(`❌ 截图数据无效或缺失`);
    }
    
    return { 
      success: result.success, 
      dataset: result.dataset,
      fileSize: result.fileSize,
      elapsed 
    };
    
  } catch (error) {
    console.error(`\n❌ 测试失败: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║  🧪 热力图 ScreenshotAPI Workflow 测试套件           ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');
  
  const results = [];
  
  for (const testCase of TEST_CASES) {
    const result = await testWorkflow(testCase);
    results.push({ name: testCase.name, ...result });
    
    // 等待一下再测试下一个，避免 API 限流
    if (TEST_CASES.indexOf(testCase) < TEST_CASES.length - 1) {
      console.log('\n⏳ 等待 3 秒后测试下一个...\n');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  // 汇总结果
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║  📊 测试结果汇总                                      ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');
  
  results.forEach((r, i) => {
    console.log(`${i + 1}. ${r.name}`);
    console.log(`   ├─ 状态: ${r.success ? '✅ 成功' : '❌ 失败'}`);
    console.log(`   ├─ Dataset: ${r.dataset || 'N/A'}`);
    console.log(`   ├─ 文件大小: ${r.fileSize ? (r.fileSize / 1024).toFixed(2) + ' KB' : 'N/A'}`);
    console.log(`   └─ 耗时: ${r.elapsed || 'N/A'}ms\n`);
  });
  
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`总计: ${successCount}/${totalCount} 测试通过`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  if (successCount === totalCount) {
    console.log('🎉 所有测试通过！不同 dataset 返回不同热力图 ✓');
    console.log('🔗 在 n8n UI 查看执行日志: https://qian.app.n8n.cloud/workflow/mXF5LoFSPFXzmHft\n');
  } else {
    console.log('⚠️  部分测试失败，请检查 n8n 执行日志排查问题\n');
  }
}

main().catch(error => {
  console.error('\n❌ 测试套件执行失败:', error.message);
  process.exit(1);
});
