// 测试智能可视化决策的3个场景
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:5000';

async function testScenario(name, text, expectedChart) {
  console.log(`\n=== 测试场景：${name} ===`);
  console.log(`输入: "${text}"`);
  console.log(`预期: ${expectedChart ? '生成图表' : '纯文字，无图表'}`);
  
  try {
    const response = await fetch(`${BASE_URL}/brain/orchestrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        mode: 'premarket',
        user_id: 'test_viz',
        budget: 'low',
        chat_type: 'private'
      })
    });
    
    const data = await response.json();
    
    // 检查可视化意图
    const visualIntent = data.levels?.l2?.visualIntent;
    const actions = data.actions || [];
    const chartActions = actions.filter(a => a.type === 'send_chart');
    
    console.log(`\n结果:`);
    console.log(`- 可视化意图: ${JSON.stringify(visualIntent)}`);
    console.log(`- 图表动作数量: ${chartActions.length}`);
    
    if (chartActions.length > 0) {
      chartActions.forEach((action, i) => {
        console.log(`- 图表${i+1}: ${action.metric}`);
        console.log(`  URL: ${action.url.slice(0, 60)}...`);
      });
    }
    
    // 验证结果
    const hasChart = chartActions.length > 0;
    const passed = hasChart === expectedChart;
    console.log(`\n✅ ${passed ? '通过' : '失败'} - ${hasChart ? '生成了图表' : '未生成图表'}（${expectedChart ? '应该' : '不应该'}生成）`);
    
    return passed;
    
  } catch (error) {
    console.error(`❌ 测试失败:`, error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 开始测试智能可视化决策系统\n');
  
  // 等待服务器启动
  console.log('等待服务器启动...');
  await new Promise(resolve => setTimeout(resolve, 15000));
  
  const results = [];
  
  // 场景1：单指标查询 - 应该生成1张图
  results.push(await testScenario(
    '场景1 - 单指标查询',
    'CPI最近趋势怎么样？',
    true  // 期望生成图表
  ));
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 场景2：宏观总览 - 不应该生成图
  results.push(await testScenario(
    '场景2 - 宏观总览',
    '预览下宏观数据',
    false  // 期望不生成图表
  ));
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 场景3：失业率查询 - 应该生成1张图
  results.push(await testScenario(
    '场景3 - 失业率查询',
    '失业率上升了吗？',
    true  // 期望生成图表
  ));
  
  console.log('\n\n========== 测试总结 ==========');
  const passed = results.filter(r => r).length;
  const total = results.length;
  console.log(`通过: ${passed}/${total}`);
  console.log(passed === total ? '✅ 所有测试通过！' : '⚠️ 部分测试失败');
  
  process.exit(passed === total ? 0 : 1);
}

runTests();
