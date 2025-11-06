// 测试v5.0映射体系
const { extractHeatmapQueryRulesOnly, buildTradingViewURL } = require('./heatmapIntentParser');

const testCases = [
  "西班牙热力图",
  "日本大盘热力图",
  "美股科技股热力图",
  "纳斯达克热力图",
  "德国DAX热力图",
  "香港恒生指数",
  "韩国KOSPI",
  "印度NIFTY",
  "澳洲市场热力图",
  "美股金融板块",
  "日本医疗板块热力图"
];

console.log('🧪 [测试] v5.0完整映射体系\n');
console.log('═'.repeat(80));

testCases.forEach((text, i) => {
  console.log(`\n${i+1}. 输入: "${text}"`);
  const result = extractHeatmapQueryRulesOnly(text);
  const url = buildTradingViewURL(result);
  console.log(`   结果: region=${result.region}, index=${result.index}, sector=${result.sector}`);
  console.log(`   URL: ${url.substring(0, 120)}...`);
  console.log(`   规则: ${result.rules_fired.join(', ')}`);
});

console.log('\n' + '═'.repeat(80));
console.log('✅ 测试完成');
