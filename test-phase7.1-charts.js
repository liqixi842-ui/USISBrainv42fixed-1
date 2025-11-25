/**
 * test-phase7.1-charts.js
 * 
 * Phase 7.1 全股票兼容性测试
 * 
 * 测试目标：
 * - 10 个不同市场的股票都能正常生成财务图表
 * - 验证 safeGetAnnualReports 的 fallback 链路
 * - 确保 revenue/eps/margin 数据完整性
 * - 检查图表 buffer 大小合理
 */

const { safeGetAnnualReports } = require('./services/financialChartService');
const { generateAllFinancialCharts } = require('./services/financialChartService');

console.log(`
╔════════════════════════════════════════════════════╗
║    Phase 7.1 Chart Compatibility Test             ║
║    Testing 10 Symbols Across Global Markets       ║
╚════════════════════════════════════════════════════╝
`);

// 测试股票列表（覆盖不同市场）
const TEST_SYMBOLS = [
  { symbol: 'NVDA', market: 'NASDAQ', name: 'NVIDIA' },
  { symbol: 'AAPL', market: 'NASDAQ', name: 'Apple' },
  { symbol: 'TSLA', market: 'NASDAQ', name: 'Tesla' },
  { symbol: 'AMZN', market: 'NASDAQ', name: 'Amazon' },
  { symbol: 'META', market: 'NASDAQ', name: 'Meta' },
  { symbol: 'MSFT', market: 'NASDAQ', name: 'Microsoft' },
  { symbol: 'AMD', market: 'NASDAQ', name: 'AMD' },
  { symbol: 'BABA', market: 'NYSE', name: 'Alibaba' },
  { symbol: '0700.HK', market: 'HKEX', name: 'Tencent' },
  { symbol: '000858.SZ', market: 'SZSE', name: 'Wuliangye' }
];

const MIN_DATA_POINTS = 3;
const MIN_CHART_SIZE_KB = 5;

async function testSymbol(testCase) {
  const { symbol, market, name } = testCase;
  const result = {
    symbol,
    market,
    name,
    dataFetch: false,
    chartsGenerated: false,
    source: 'unknown',
    revenue: { points: 0, valid: false },
    eps: { points: 0, valid: false },
    margin: { points: 0, valid: false },
    chartSizes: { revenue: 0, eps: 0, margin: 0 },
    errors: []
  };

  try {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📊 Testing: ${symbol} (${name} - ${market})`);
    console.log(`${'═'.repeat(60)}\n`);

    // ═════════════════════════════════════════════════════
    // TEST 1: 数据获取
    // ═════════════════════════════════════════════════════
    console.log(`[TEST 1] Fetching annual reports...`);
    const financials = await safeGetAnnualReports(symbol);

    if (!financials) {
      result.errors.push('safeGetAnnualReports returned null');
      console.error(`❌ [TEST 1] Failed: No data returned\n`);
      return result;
    }

    result.dataFetch = true;
    result.source = financials.source || 'unknown';

    // 验证数据点数量
    result.revenue.points = financials.revenue?.length || 0;
    result.eps.points = financials.eps?.length || 0;
    result.margin.points = financials.grossProfit?.length || 0; // ✅ Fix: 使用 grossProfit

    result.revenue.valid = result.revenue.points >= MIN_DATA_POINTS;
    result.eps.valid = result.eps.points >= MIN_DATA_POINTS;
    result.margin.valid = result.margin.points >= MIN_DATA_POINTS;

    console.log(`[TEST 1] Data fetched successfully`);
    console.log(`   ├─ Source: ${result.source}`);
    console.log(`   ├─ Revenue points: ${result.revenue.points} ${result.revenue.valid ? '✅' : '❌'}`);
    console.log(`   ├─ EPS points: ${result.eps.points} ${result.eps.valid ? '✅' : '❌'}`);
    console.log(`   └─ Margin points: ${result.margin.points} ${result.margin.valid ? '✅' : '❌'}\n`);

    if (!result.revenue.valid || !result.eps.valid || !result.margin.valid) {
      result.errors.push(`Insufficient data points (need ${MIN_DATA_POINTS}+)`);
    }

    // ═════════════════════════════════════════════════════
    // TEST 2: 图表生成
    // ═════════════════════════════════════════════════════
    console.log(`[TEST 2] Generating charts...`);
    const charts = await generateAllFinancialCharts(symbol, { language: 'en' });

    if (!charts) {
      result.errors.push('generateAllFinancialCharts returned null');
      console.error(`❌ [TEST 2] Failed: No charts generated\n`);
      return result;
    }

    // 验证图表大小
    result.chartSizes.revenue = charts.revenue ? (charts.revenue.length / 1024) : 0;
    result.chartSizes.eps = charts.eps ? (charts.eps.length / 1024) : 0;
    result.chartSizes.margin = charts.margin ? (charts.margin.length / 1024) : 0;

    const revenueOk = result.chartSizes.revenue >= MIN_CHART_SIZE_KB;
    const epsOk = result.chartSizes.eps >= MIN_CHART_SIZE_KB;
    const marginOk = result.chartSizes.margin >= MIN_CHART_SIZE_KB;

    result.chartsGenerated = revenueOk && epsOk && marginOk;

    console.log(`[TEST 2] Charts generated`);
    console.log(`   ├─ Revenue chart: ${result.chartSizes.revenue.toFixed(2)} KB ${revenueOk ? '✅' : '❌'}`);
    console.log(`   ├─ EPS chart: ${result.chartSizes.eps.toFixed(2)} KB ${epsOk ? '✅' : '❌'}`);
    console.log(`   └─ Margin chart: ${result.chartSizes.margin.toFixed(2)} KB ${marginOk ? '✅' : '❌'}\n`);

    if (!result.chartsGenerated) {
      result.errors.push(`Chart size too small (need ${MIN_CHART_SIZE_KB}+ KB)`);
    }

  } catch (error) {
    result.errors.push(error.message);
    console.error(`❌ Error testing ${symbol}: ${error.message}\n`);
  }

  return result;
}

async function runAllTests() {
  const startTime = Date.now();
  const results = [];

  console.log(`Starting compatibility test for ${TEST_SYMBOLS.length} symbols...\n`);

  // 测试所有股票
  for (const testCase of TEST_SYMBOLS) {
    const result = await testSymbol(testCase);
    results.push(result);

    // 添加延迟避免 API rate limit
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const duration = Date.now() - startTime;

  // ═══════════════════════════════════════════════════════════════
  // 生成测试报告
  // ═══════════════════════════════════════════════════════════════
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`${'═'.repeat(80)}`);
  console.log(`                      PHASE 7.1 COMPATIBILITY TEST REPORT`);
  console.log(`${'═'.repeat(80)}`);
  console.log(`${'═'.repeat(80)}\n`);

  // 统计结果
  const dataFetchPassed = results.filter(r => r.dataFetch).length;
  const chartsPassed = results.filter(r => r.chartsGenerated).length;
  const fullPassed = results.filter(r => r.dataFetch && r.chartsGenerated).length;

  console.log(`📊 Overall Statistics:`);
  console.log(`   ├─ Total Symbols: ${TEST_SYMBOLS.length}`);
  console.log(`   ├─ Data Fetch Success: ${dataFetchPassed}/${TEST_SYMBOLS.length} (${(dataFetchPassed / TEST_SYMBOLS.length * 100).toFixed(1)}%)`);
  console.log(`   ├─ Charts Generated: ${chartsPassed}/${TEST_SYMBOLS.length} (${(chartsPassed / TEST_SYMBOLS.length * 100).toFixed(1)}%)`);
  console.log(`   ├─ Full Compatibility: ${fullPassed}/${TEST_SYMBOLS.length} (${(fullPassed / TEST_SYMBOLS.length * 100).toFixed(1)}%)`);
  console.log(`   └─ Duration: ${(duration / 1000).toFixed(1)}s\n`);

  // 数据源统计
  const sourceStats = {};
  results.forEach(r => {
    sourceStats[r.source] = (sourceStats[r.source] || 0) + 1;
  });

  console.log(`📡 Data Sources Used:`);
  Object.entries(sourceStats).forEach(([source, count]) => {
    console.log(`   ├─ ${source}: ${count} symbols`);
  });
  console.log(``);

  // 详细结果表格
  console.log(`${'─'.repeat(80)}`);
  console.log(`Detailed Results:`);
  console.log(`${'─'.repeat(80)}`);
  console.log(`Symbol      Market  Data  Charts  Source                   Status`);
  console.log(`${'─'.repeat(80)}`);

  results.forEach(r => {
    const symbolPad = r.symbol.padEnd(12);
    const marketPad = r.market.padEnd(8);
    const dataIcon = r.dataFetch ? '✅' : '❌';
    const chartIcon = r.chartsGenerated ? '✅' : '❌';
    const sourcePad = r.source.padEnd(25);
    const status = (r.dataFetch && r.chartsGenerated) ? '✅ PASS' : '❌ FAIL';

    console.log(`${symbolPad}${marketPad}${dataIcon}     ${chartIcon}      ${sourcePad}${status}`);
  });
  console.log(`${'─'.repeat(80)}\n`);

  // 失败案例详情
  const failed = results.filter(r => !r.dataFetch || !r.chartsGenerated);
  if (failed.length > 0) {
    console.log(`❌ Failed Symbols (${failed.length}):\n`);
    failed.forEach(r => {
      console.log(`   ${r.symbol} (${r.name}):`);
      r.errors.forEach(err => console.log(`      └─ ${err}`));
      console.log(``);
    });
  }

  // 最终结论
  console.log(`${'═'.repeat(80)}`);
  const passRate = (fullPassed / TEST_SYMBOLS.length * 100).toFixed(1);
  if (fullPassed === TEST_SYMBOLS.length) {
    console.log(`✅ ALL TESTS PASSED - 100% Compatibility Achieved!`);
    console.log(`\nPhase 7.1 is ready for production deployment.`);
  } else if (passRate >= 80) {
    console.log(`⚠️  MOSTLY PASSED - ${passRate}% Compatibility`);
    console.log(`\nPhase 7.1 has strong compatibility but needs minor fixes.`);
  } else {
    console.log(`❌ TESTS FAILED - Only ${passRate}% Compatibility`);
    console.log(`\nPhase 7.1 needs significant fixes before deployment.`);
  }
  console.log(`${'═'.repeat(80)}\n`);

  return {
    total: TEST_SYMBOLS.length,
    passed: fullPassed,
    failed: TEST_SYMBOLS.length - fullPassed,
    passRate: parseFloat(passRate),
    results
  };
}

// Run tests
runAllTests()
  .then(summary => {
    console.log(`\n📝 Test Summary:`);
    console.log(`   └─ Pass Rate: ${summary.passRate}%\n`);
    process.exit(summary.passRate >= 80 ? 0 : 1);
  })
  .catch(error => {
    console.error(`\n💥 Fatal test error: ${error.message}\n`);
    console.error(error.stack);
    process.exit(1);
  });
