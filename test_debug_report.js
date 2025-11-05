// 测试诊断报告生成
const { extractHeatmapQueryRulesOnly, generateDebugReport, buildTradingViewURL } = require('./heatmapIntentParser');

console.log('🔍 ========== 诊断报告测试 ==========\n');

// 测试用例
const testCases = [
  "西班牙热力图 带分析 #dbg",
  "Spain IBEX heatmap #dbg",
  "日本大盘热力图 #dbg",
  "美股的科技股的热力图 #dbg"
];

testCases.forEach((testCase, index) => {
  console.log(`\n📝 测试 ${index + 1}: "${testCase}"`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const result = extractHeatmapQueryRulesOnly(testCase);
  const debugReport = generateDebugReport(testCase, result);
  
  console.log('\n📊 解析结果:');
  console.log(`   地区: ${result.region}`);
  console.log(`   指数: ${result.index}`);
  console.log(`   板块: ${result.sector}`);
  console.log(`   置信度: ${result.confidence}`);
  
  console.log('\n🎯 触发规则:');
  result.rules_fired.forEach(rule => console.log(`   ✓ ${rule}`));
  
  console.log('\n🌐 动作预览:');
  console.log(`   数据集: ${debugReport.action_preview.dataset}`);
  console.log(`   期望地区: ${debugReport.action_preview.expected_region}`);
  console.log(`   URL: ${debugReport.action_preview.url}`);
  
  console.log('\n');
});

console.log('\n🧪 ========== 自检样例汇总 ==========\n');
const masterSample = extractHeatmapQueryRulesOnly("西班牙热力图 #dbg");
const masterReport = generateDebugReport("西班牙热力图 #dbg", masterSample);

masterReport.selftest.forEach((test, i) => {
  console.log(`${i + 1}. 输入: "${test.text.replace(/#dbg/i, '')}"`);
  console.log(`   → 指数: ${test.index} (${test.region})`);
  console.log(`   → 规则: ${test.rules_fired.join(', ')}`);
  console.log('');
});

console.log('\n✅ ========== 完整 JSON 报告 ==========\n');
console.log(JSON.stringify(masterReport, null, 2));
