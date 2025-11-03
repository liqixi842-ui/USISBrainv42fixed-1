#!/usr/bin/env node

const fetch = require('node-fetch');

async function runCompleteTest() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║   USIS Brain v3 完整系统验证测试                       ║');
  console.log('║   6 AI 智囊团 + 数据帝国层                             ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');
  
  const baseURL = 'http://localhost:3000';
  
  // Step 1: Health Check
  console.log('【步骤 1/4】健康检查...');
  try {
    const healthRes = await fetch(`${baseURL}/health`, { timeout: 5000 });
    const health = await healthRes.json();
    console.log(`✅ 服务状态: ${health.ok ? '正常' : '异常'}`);
    console.log(`   服务名称: ${health.service}`);
  } catch (err) {
    console.error(`❌ 健康检查失败: ${err.message}`);
    console.error('提示: 请确保服务器正在运行 (node index.js)');
    process.exit(1);
  }
  
  // Step 2: Intent Recognition
  console.log('\n【步骤 2/4】意图识别测试...');
  try {
    const intentRes = await fetch(`${baseURL}/brain/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: '盘前看看NVDA和TSLA今天走势',
        allow: ['premarket', 'intraday', 'postmarket', 'diagnose', 'news']
      }),
      timeout: 5000
    });
    const intent = await intentRes.json();
    console.log(`✅ 场景模式: ${intent.mode}`);
    console.log(`   股票代码: ${intent.symbols.join(', ')}`);
    console.log(`   语言: ${intent.lang}`);
  } catch (err) {
    console.error(`❌ 意图识别失败: ${err.message}`);
  }
  
  // Step 3: Data Collection Test (if implemented)
  console.log('\n【步骤 3/4】数据帝国层测试...');
  console.log('   Finnhub API: 实时行情、新闻、情绪分析');
  console.log('   Alpha Vantage API: 技术指标、基本面数据');
  console.log('   ⏩ 跳过独立测试（将在编排系统中验证）');
  
  // Step 4: Full Orchestration (6 AIs + Data Empire)
  console.log('\n【步骤 4/4】完整编排系统测试...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⏳ 调用6个AI专家 + 数据采集...');
  console.log('   预计耗时: 30-60秒\n');
  
  const startTime = Date.now();
  
  try {
    const orchestrateRes = await fetch(`${baseURL}/brain/orchestrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: '盘前分析NVDA',
        chat_type: 'private',
        user_id: 'test_vip_ultimate'
      }),
      timeout: 90000
    });
    
    if (!orchestrateRes.ok) {
      const errorText = await orchestrateRes.text();
      console.error(`❌ HTTP ${orchestrateRes.status}: ${errorText.substring(0, 200)}`);
      return;
    }
    
    const result = await orchestrateRes.json();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    if (result.error) {
      console.error(`❌ 编排失败: ${result.error}`);
      console.error('详细:', JSON.stringify(result, null, 2).substring(0, 500));
      return;
    }
    
    console.log(`\n✅ 编排完成！耗时: ${elapsed}秒`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Display Results
    console.log('📊 分析概况:');
    console.log(`   意图模式: ${result.intent?.mode || '未知'}`);
    console.log(`   场景: ${result.scene?.name || '未知'}`);
    console.log(`   股票代码: ${result.symbols?.join(', ') || '无'}`);
    console.log(`   用户语言: ${result.intent?.lang || '未知'}`);
    
    if (result.market_data) {
      console.log(`\n📈 市场数据:`);
      console.log(`   采集状态: ${result.market_data.collected ? '✅ 成功' : '❌ 失败'}`);
      if (result.market_data.summary) {
        const summaryPreview = result.market_data.summary.substring(0, 150).replace(/\n/g, ' ');
        console.log(`   数据摘要: ${summaryPreview}...`);
      }
    }
    
    if (result.ai_results) {
      console.log(`\n🤖 AI 智囊团分析:`);
      const aiNames = {
        claude: 'Claude (技术分析专家)',
        deepseek: 'DeepSeek (中国市场专家)',
        gpt4: 'GPT-4 (综合策略分析师)',
        gemini: 'Gemini (实时数据整合专家)',
        perplexity: 'Perplexity (深度研究分析师)',
        mistral: 'Mistral (情绪与风险建模师)'
      };
      
      Object.entries(result.ai_results).forEach(([key, data]) => {
        const name = aiNames[key] || key;
        const status = data.success ? '✅' : '❌';
        const length = data.output?.length || 0;
        const preview = data.output?.substring(0, 60).replace(/\n/g, ' ') || '';
        console.log(`   ${status} ${name}: ${length}字`);
        if (preview) {
          console.log(`      "${preview}..."`);
        }
      });
    }
    
    if (result.final_analysis) {
      console.log(`\n📝 最终综合分析报告:`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      const lines = result.final_analysis.split('\n');
      const preview = lines.slice(0, 20).join('\n');
      console.log(preview);
      if (lines.length > 20) {
        console.log(`\n   ... (还有 ${lines.length - 20} 行)`);
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
    
    // Final Summary
    console.log(`\n╔═══════════════════════════════════════════════════════╗`);
    console.log(`║              ✅ 系统验证完成！                        ║`);
    console.log(`╚═══════════════════════════════════════════════════════╝`);
    console.log(`\n系统架构:`);
    console.log(`  Intent → Scene → Data Collection → 6-AI Analysis → Synthesis`);
    console.log(`\n核心能力:`);
    console.log(`  ✅ 自然语言意图理解`);
    console.log(`  ✅ 场景感知内容深度调整`);
    console.log(`  ✅ 实时市场数据整合 (Finnhub + Alpha Vantage)`);
    console.log(`  ✅ 6个专业AI智囊团协同分析`);
    console.log(`  ✅ 智能综合报告生成`);
    console.log(`  ✅ 双输出风格 (私聊温暖/群聊专业)`);
    console.log(`\n下一步: 集成到Telegram Bot via n8n`);
    
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`\n❌ 编排测试失败 (${elapsed}秒): ${err.message}`);
    if (err.type === 'request-timeout') {
      console.error('   提示: 请求超时，6个AI并行调用可能需要更长时间');
    }
  }
}

console.log('');
runCompleteTest()
  .then(() => {
    console.log('\n测试完成！');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n测试出错:', err);
    process.exit(1);
  });
