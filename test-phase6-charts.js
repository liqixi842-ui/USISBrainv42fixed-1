/**
 * test-phase6-charts.js
 * 
 * Phase 6 测试：图表生成服务
 * 测试 chartImageService 和 financialChartService
 */

const { getDailyKlineImage, validateChartBuffer } = require('./services/chartImageService');
const { generateAllFinancialCharts } = require('./services/financialChartService');
const fs = require('fs');
const path = require('path');

// 测试符号
const TEST_SYMBOL = 'NVDA';

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`🧪 Phase 6 Chart Generation Test`);
console.log(`   Symbol: ${TEST_SYMBOL}`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

async function testChartImageService() {
  console.log(`\n═══ Test 1: K-line Chart Generation ═══\n`);
  
  try {
    const klineBuffer = await getDailyKlineImage(TEST_SYMBOL, {
      interval: 'D',
      theme: 'light'
    });
    
    if (!klineBuffer) {
      console.error(`❌ K-line chart generation returned null`);
      return false;
    }
    
    // 验证 buffer
    const isValid = validateChartBuffer(klineBuffer);
    
    if (isValid) {
      // 保存到文件（可选）
      const outputPath = path.join(__dirname, `test-kline-${TEST_SYMBOL}.png`);
      fs.writeFileSync(outputPath, klineBuffer);
      console.log(`✅ K-line chart saved to: ${outputPath}`);
      console.log(`   Size: ${(klineBuffer.length / 1024).toFixed(2)} KB\n`);
      return true;
    } else {
      console.error(`❌ K-line chart validation failed`);
      return false;
    }
    
  } catch (error) {
    console.error(`❌ K-line chart test failed: ${error.message}`);
    console.error(error.stack);
    return false;
  }
}

async function testFinancialChartService() {
  console.log(`\n═══ Test 2: Financial Charts Generation ═══\n`);
  
  try {
    const charts = await generateAllFinancialCharts(TEST_SYMBOL, {
      years: 5,
      width: 600,
      height: 350,
      language: 'en'
    });
    
    let successCount = 0;
    let totalCount = 0;
    
    // 测试营收图表
    if (charts.revenue) {
      totalCount++;
      const outputPath = path.join(__dirname, `test-revenue-${TEST_SYMBOL}.png`);
      fs.writeFileSync(outputPath, charts.revenue);
      console.log(`✅ Revenue chart saved: ${outputPath}`);
      console.log(`   Size: ${(charts.revenue.length / 1024).toFixed(2)} KB`);
      successCount++;
    } else {
      console.warn(`⚠️  Revenue chart not generated (may be missing data)`);
    }
    
    // 测试 EPS 图表
    if (charts.eps) {
      totalCount++;
      const outputPath = path.join(__dirname, `test-eps-${TEST_SYMBOL}.png`);
      fs.writeFileSync(outputPath, charts.eps);
      console.log(`✅ EPS chart saved: ${outputPath}`);
      console.log(`   Size: ${(charts.eps.length / 1024).toFixed(2)} KB`);
      successCount++;
    } else {
      console.warn(`⚠️  EPS chart not generated (may be missing data)`);
    }
    
    // 测试毛利率图表
    if (charts.margin) {
      totalCount++;
      const outputPath = path.join(__dirname, `test-margin-${TEST_SYMBOL}.png`);
      fs.writeFileSync(outputPath, charts.margin);
      console.log(`✅ Margin chart saved: ${outputPath}`);
      console.log(`   Size: ${(charts.margin.length / 1024).toFixed(2)} KB`);
      successCount++;
    } else {
      console.warn(`⚠️  Margin chart not generated (may be missing data)`);
    }
    
    console.log(`\n📊 Financial Charts: ${successCount}/${totalCount} generated\n`);
    
    return successCount > 0; // 至少生成一个图表就算成功
    
  } catch (error) {
    console.error(`❌ Financial charts test failed: ${error.message}`);
    console.error(error.stack);
    return false;
  }
}

async function runAllTests() {
  console.log(`\n🚀 Starting Phase 6 Chart Tests...\n`);
  
  const results = {
    kline: false,
    financial: false
  };
  
  // Test 1: K-line chart
  results.kline = await testChartImageService();
  
  // Test 2: Financial charts
  results.financial = await testFinancialChartService();
  
  // 总结
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 Phase 6 Chart Tests Summary`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   K-line Chart:      ${results.kline ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Financial Charts:  ${results.financial ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  const allPassed = Object.values(results).every(r => r === true);
  
  if (allPassed) {
    console.log(`✅ All chart tests PASSED!`);
    process.exit(0);
  } else {
    console.error(`❌ Some chart tests FAILED!`);
    process.exit(1);
  }
}

// 运行测试
runAllTests().catch(error => {
  console.error(`\n❌ Fatal error during testing:`, error);
  process.exit(1);
});
