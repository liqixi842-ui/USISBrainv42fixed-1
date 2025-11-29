/**
 * Test script for Chart Generation Pipeline
 * Run: node v3_dev/test_chart_generation.js NVDA
 */

require('dotenv').config();

const symbol = process.argv[2] || 'NVDA';

console.log(`\n${'='.repeat(60)}`);
console.log(`Testing Chart Generation for: ${symbol}`);
console.log('='.repeat(60));

async function testChartGeneration() {
  try {
    const FinancialDataBroker = require('./services/financialDataBroker');
    const HistoryChartEngine = require('./services/historyChartEngine');

    console.log('\n📊 Step 1: Fetching history data...');
    const history = await FinancialDataBroker.getHistorySeries(symbol);
    
    console.log(`   revenue_5y: ${history.revenue_5y?.length || 0} points`);
    console.log(`   eps_5y: ${history.eps_5y?.length || 0} points`);
    
    if (history.revenue_5y?.length > 0) {
      console.log(`   Revenue range: ${history.revenue_5y[0]?.year} - ${history.revenue_5y[history.revenue_5y.length - 1]?.year}`);
    }
    if (history.eps_5y?.length > 0) {
      console.log(`   EPS range: ${history.eps_5y[0]?.year} - ${history.eps_5y[history.eps_5y.length - 1]?.year}`);
    }

    console.log('\n📊 Step 2: Generating charts...');
    const charts = await HistoryChartEngine.generateAllCharts(
      symbol,
      history.revenue_5y,
      history.eps_5y
    );

    console.log('\n📊 Chart Generation Results:');
    console.log(`   revenue_chart: ${charts.revenue_chart ? '✅ Generated' : '❌ Failed'}`);
    if (charts.revenue_chart) {
      console.log(`      URL: ${charts.revenue_chart.substring(0, 80)}...`);
    }
    
    console.log(`   eps_chart: ${charts.eps_chart ? '✅ Generated' : '❌ Failed'}`);
    if (charts.eps_chart) {
      console.log(`      URL: ${charts.eps_chart.substring(0, 80)}...`);
    }
    
    console.log(`   combined_chart: ${charts.combined_chart ? '✅ Generated' : '❌ Failed'}`);
    if (charts.combined_chart) {
      console.log(`      URL: ${charts.combined_chart.substring(0, 80)}...`);
    }

    return charts;
  } catch (error) {
    console.log(`\n❌ Error: ${error.message}`);
    console.log(error.stack);
    return null;
  }
}

testChartGeneration().then(() => {
  console.log('\n' + '='.repeat(60));
  console.log('Chart generation test complete');
  console.log('='.repeat(60) + '\n');
});
