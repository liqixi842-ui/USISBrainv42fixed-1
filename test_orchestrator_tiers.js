// 测试三层架构的分级决策
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:5000';

async function testTier(name, text, mode, budget, expectedTier) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`测试: ${name}`);
  console.log(`输入: "${text}"`);
  console.log(`模式: ${mode}, 预算: ${budget}`);
  console.log(`期望层级: ${expectedTier}`);
  console.log(`${'='.repeat(60)}`);
  
  try {
    const response = await fetch(`${BASE_URL}/brain/orchestrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        mode,
        user_id: 'test_orchestrator',
        budget,
        chat_type: 'private'
      })
    });
    
    const data = await response.json();
    
    // 提取关键信息
    const debug = data.debug || {};
    const l1 = debug.l1_complexity || {};
    const l2 = debug.l2_model_selection || {};
    const l3 = debug.l3_deep_reasoning || {};
    
    console.log(`\n✅ 响应接收成功`);
    console.log(`\n【L1 复杂度评分】`);
    console.log(`  分数: ${l1.score}/10`);
    console.log(`  层级: ${l1.tier}`);
    console.log(`  推理: ${l1.reasoning}`);
    
    console.log(`\n【L2 模型选择】`);
    console.log(`  预算: ${l2.budget}`);
    console.log(`  预算上限: $${l2.budget_limit}`);
    console.log(`  选中模型: ${l2.models_chosen?.map(m => m.name).join(', ')}`);
    console.log(`  预估成本: $${l2.estimated_cost?.toFixed(4)}`);
    
    console.log(`\n【L3 深度推理】`);
    console.log(`  启用: ${l3.enabled ? '是' : '否'}`);
    if (l3.enabled) {
      console.log(`  原因: ${l3.reason}`);
      console.log(`  深度模型: ${l3.deep_models?.join(', ') || '无'}`);
    }
    
    // 验证
    const passed = l1.tier === expectedTier;
    console.log(`\n${passed ? '✅ 测试通过' : '⚠️ 测试失败'} - 层级${passed ? '符合' : '不符合'}预期`);
    
    return passed;
    
  } catch (error) {
    console.error(`❌ 测试失败:`, error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 开始测试三层架构智能决策系统\n');
  
  // 等待服务器启动
  await new Promise(resolve => setTimeout(resolve, 8000));
  
  const results = [];
  
  // 测试1: L1层 - 简单查询
  results.push(await testTier(
    '简单查询（L1层）',
    '预览下宏观数据',
    'premarket',
    'low',
    'L1'  // 期望L1
  ));
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // 测试2: L2层 - 标准分析
  results.push(await testTier(
    '标准分析（L2层）',
    'CPI和失业率对比分析',
    'diagnose',
    'medium',
    'L2'  // 期望L2
  ));
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // 测试3: L3层 - 复杂推理
  results.push(await testTier(
    '复杂推理（L3层）',
    '给我一份对CPI、GDP、失业率、利率的前瞻性场景推演，并结合历史衰退区间做风险敞口建议',
    'postmarket',
    'high',
    'L3'  // 期望L3
  ));
  
  console.log(`\n\n${'='.repeat(60)}`);
  console.log(`测试总结`);
  console.log(`${'='.repeat(60)}`);
  const passed = results.filter(r => r).length;
  const total = results.length;
  console.log(`通过: ${passed}/${total}`);
  console.log(passed === total ? '🎉 所有测试通过！' : '⚠️ 部分测试失败');
  
  process.exit(passed === total ? 0 : 1);
}

runTests();
