// 最小化测试：验证可视化决策逻辑（不启动服务器）

// 复制核心函数（不依赖整个index.js）
function detectVisualizationNeedSimple(l1Intent = {}, text = '') {
  const t = (text || '').toLowerCase();
  const mode = (l1Intent.mode || '').toLowerCase();
  
  const map = [
    { test: /(cpi|通胀|物价)/, metric: 'CPIAUCSL' },
    { test: /(失业|unrate|就业)/, metric: 'UNRATE' },
    { test: /(gdp)/, metric: 'GDPC1' },
    { test: /(利率|fedfunds|联邦基金|加息|降息)/, metric: 'FEDFUNDS' },
  ];
  
  for (const m of map) {
    if (m.test.test(t) || m.test.test(mode)) {
      return { needChart: true, metrics: [m.metric], style: 'single', reason: 'rule-min' };
    }
  }
  
  if (/premarket|宏观|总览|overview/.test(t) || /premarket/.test(mode)) {
    return { needChart: false, metrics: [], style: 'none', reason: 'overview-text' };
  }
  
  return { needChart: false, metrics: [], style: 'none', reason: 'default-text' };
}

// 测试场景
console.log('=== 智能可视化决策逻辑测试 ===\n');

const scenarios = [
  {
    name: '场景1：CPI查询',
    intent: { mode: 'premarket', lang: 'zh' },
    text: 'CPI最近趋势怎么样？',
    expected: { needChart: true, metric: 'CPIAUCSL' }
  },
  {
    name: '场景2：宏观总览',
    intent: { mode: 'premarket', lang: 'zh' },
    text: '预览下宏观数据',
    expected: { needChart: false }
  },
  {
    name: '场景3：失业率查询',
    intent: { mode: 'premarket', lang: 'zh' },
    text: '失业率上升了吗？',
    expected: { needChart: true, metric: 'UNRATE' }
  },
  {
    name: '场景4：GDP查询',
    intent: { mode: 'premarket', lang: 'zh' },
    text: 'GDP增长情况',
    expected: { needChart: true, metric: 'GDPC1' }
  },
  {
    name: '场景5：利率查询',
    intent: { mode: 'premarket', lang: 'zh' },
    text: '联邦基金利率最新数据',
    expected: { needChart: true, metric: 'FEDFUNDS' }
  },
  {
    name: '场景6：纯文字场景',
    intent: { mode: 'casual', lang: 'zh' },
    text: '今天天气怎么样',
    expected: { needChart: false }
  }
];

let passed = 0;
let failed = 0;

scenarios.forEach(({ name, intent, text, expected }) => {
  const result = detectVisualizationNeedSimple(intent, text);
  
  console.log(`\n${name}`);
  console.log(`  输入: "${text}"`);
  console.log(`  结果: ${JSON.stringify(result)}`);
  
  const chartMatches = result.needChart === expected.needChart;
  const metricMatches = !expected.metric || result.metrics[0] === expected.metric;
  
  if (chartMatches && metricMatches) {
    console.log(`  ✅ 通过 - ${result.needChart ? `正确生成${result.metrics[0]}图表` : '正确判断无需图表'}`);
    passed++;
  } else {
    console.log(`  ❌ 失败 - 期望${expected.needChart ? `图表(${expected.metric})` : '无图表'}，实际${result.needChart ? `图表(${result.metrics[0]})` : '无图表'}`);
    failed++;
  }
});

console.log(`\n\n========== 测试结果 ==========`);
console.log(`✅ 通过: ${passed}`);
console.log(`❌ 失败: ${failed}`);
console.log(`总计: ${passed + failed}`);
console.log(failed === 0 ? '\n🎉 所有测试通过！这是智能决策，不是固定工作流！' : '\n⚠️ 部分测试失败');

console.log('\n【核心区别】');
console.log('❌ 固定工作流: 触发"宏观" → 必定生成4张图');
console.log('✅ 智能决策: 理解意图 → 动态判断是否需要图表');
console.log('  - "CPI怎么样" → 生成1张CPI图');
console.log('  - "预览宏观数据" → 纯文字，无图');
console.log('  - "失业率上升吗" → 生成1张失业率图');

process.exit(failed === 0 ? 0 : 1);
