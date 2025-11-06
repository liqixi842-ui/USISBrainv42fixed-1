// 串行测试热力图截图（避免并发限流）
const { captureHeatmapSmart } = require('./screenshotProviders');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  const cases = [
    {
      dataset: 'NIKKEI225',
      url: 'https://www.tradingview.com/heatmap/stock/?color=change&dataset=NIKKEI225&group=sector&blockSize=market_cap'
    },
    {
      dataset: 'IBEX35',
      url: 'https://www.tradingview.com/heatmap/stock/?color=change&dataset=IBEX35&group=sector&blockSize=market_cap'
    },
    {
      dataset: 'SPX500',
      url: 'https://www.tradingview.com/heatmap/stock/?color=change&dataset=SPX500&group=sector&blockSize=market_cap'
    }
  ];

  console.log('🧪 开始串行测试（n8n风格截图策略）\n');
  
  for (const c of cases) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 测试数据集: ${c.dataset}`);
    console.log(`${'='.repeat(60)}`);
    
    try {
      const r = await captureHeatmapSmart({
        tradingViewUrl: c.url,
        dataset: c.dataset,
        region: 'JP'
      });
      
      console.log(`\n✅ ${c.dataset} 成功:`);
      console.log(`   - Provider: ${r.provider}`);
      console.log(`   - Validation: ${r.validation}`);
      console.log(`   - 耗时: ${r.elapsed_ms}ms`);
      console.log(`   - 大小: ${r.buffer.length} bytes`);
      
      // 降级标记检查
      if (r.provider === 'quickchart' || r.validation === 'degraded') {
        console.log(`   ⚠️  降级提示: 本次为降级图（数据源波动或受限），已自动回退`);
      }
    } catch (e) {
      console.error(`\n❌ ${c.dataset} 失败:`, e.message);
    }
    
    // 间隔1.2秒避免限流
    if (cases.indexOf(c) < cases.length - 1) {
      console.log('\n⏱️  等待1.2秒...');
      await sleep(1200);
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('🏁 测试完成');
  console.log(`${'='.repeat(60)}\n`);
}

runTests().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
