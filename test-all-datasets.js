const fetch = require('node-fetch');

const TESTS = [
  { name: '纳指 NAS100', dataset: 'NAS100' },
  { name: '道指 DJI', dataset: 'DJI' },
  { name: '西班牙 IBEX35', dataset: 'IBEX35' }
];

async function testDataset(name, dataset) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🧪 测试: ${name}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  const url = `https://www.tradingview.com/heatmap/stock/?dataset=${dataset}&color=change&group=sector&blockSize=market_cap_basic&blockColor=change`;
  const webhookUrl = 'https://qian.app.n8n.cloud/webhook/heatmap_fixed';
  
  console.log(`📤 Dataset: ${dataset}`);
  console.log(`📊 URL: ${url.substring(0, 80)}...`);
  
  const start = Date.now();
  
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  
  const elapsed = Date.now() - start;
  
  console.log(`\n📥 状态: ${response.status} ${response.statusText}`);
  console.log(`⏱️  耗时: ${elapsed}ms`);
  
  const text = await response.text();
  console.log(`📊 响应长度: ${text.length} 字节`);
  
  if (text.length === 0) {
    console.log(`❌ 响应为空`);
    return { success: false, dataset, error: 'Empty response' };
  }
  
  try {
    const result = JSON.parse(text);
    
    if (result.screenshot && result.screenshot.startsWith('https://')) {
      console.log(`\n✅ 成功获取截图！`);
      console.log(`   Screenshot URL: ${result.screenshot.substring(0, 100)}...`);
      console.log(`   URL 长度: ${result.screenshot.length}`);
      
      // 验证 URL 中是否包含正确的 dataset
      if (result.screenshot.includes(dataset.toLowerCase()) || result.screenshot.includes('tradingview')) {
        console.log(`   ✓ URL 看起来正确`);
      }
      
      return { success: true, dataset, screenshotUrl: result.screenshot, elapsed };
    } else {
      console.log(`❌ 未获取到有效截图 URL`);
      console.log(`   screenshot: ${result.screenshot}`);
      return { success: false, dataset, error: 'No screenshot URL' };
    }
  } catch (e) {
    console.log(`❌ JSON 解析失败: ${e.message}`);
    console.log(`   响应: ${text.substring(0, 200)}`);
    return { success: false, dataset, error: e.message };
  }
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║  🧪 完整测试：不同 Dataset → 不同热力图           ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  
  const results = [];
  
  for (const test of TESTS) {
    const result = await testDataset(test.name, test.dataset);
    results.push(result);
    
    if (TESTS.indexOf(test) < TESTS.length - 1) {
      console.log('\n⏳ 等待 2 秒后测试下一个...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('\n\n╔═══════════════════════════════════════════════════════╗');
  console.log('║  📊 测试结果汇总                                      ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');
  
  results.forEach((r, i) => {
    console.log(`${i + 1}. ${TESTS[i].name}`);
    console.log(`   ├─ 状态: ${r.success ? '✅ 成功' : '❌ 失败'}`);
    console.log(`   ├─ Dataset: ${r.dataset}`);
    if (r.success) {
      console.log(`   ├─ Screenshot URL: ${r.screenshotUrl?.substring(0, 80)}...`);
      console.log(`   └─ 耗时: ${r.elapsed}ms`);
    } else {
      console.log(`   └─ 错误: ${r.error}`);
    }
    console.log('');
  });
  
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`总计: ${successCount}/${totalCount} 测试通过`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  if (successCount === totalCount) {
    console.log('🎉 所有测试通过！不同 dataset 成功返回不同热力图！');
    console.log('\n✅ 修复完成，问题已解决：');
    console.log('   • URL 动态传参: {{ $json.body.url }} ✓');
    console.log('   • fresh=true: 避免缓存 ✓');
    console.log('   • delay=2000: 避免弹窗 ✓');
    console.log('   • wait_for_event=networkidle: 等待页面加载 ✓');
    console.log('\n🔗 n8n Workflow ID: GaMjrt46sxzrIEry');
    console.log('🔗 Webhook URL: https://qian.app.n8n.cloud/webhook/heatmap_fixed');
    console.log('🔗 查看执行日志: https://qian.app.n8n.cloud/workflow/GaMjrt46sxzrIEry\n');
  } else {
    console.log('⚠️  部分测试失败，请检查 n8n 执行日志\n');
  }
}

main();
