/**
 * ═══════════════════════════════════════════════════════════════
 * USIS Brain v7.0 - Report PDF Service Basic Test
 * ═══════════════════════════════════════════════════════════════
 * 
 * 测试范围：
 * - PDF Buffer 生成功能
 * - Buffer 大小验证 (>10KB)
 * - 无异常抛出
 * - 无需真实 Telegram 发送
 * 
 * 不测试：
 * - Telegram 实际发送（避免消耗 bot quota）
 * - AI 生成内容质量（已在 test-report-basic.js 测试）
 */

const { generateReportPdfBuffer } = require('./services/reportPdfService');
const fs = require('fs');
const path = require('path');

/**
 * 测试 PDF 生成基本功能
 */
async function testPdfGeneration() {
  console.log(`\n╔════════════════════════════════════════════════════╗`);
  console.log(`║   Report PDF Service - Basic Test                 ║`);
  console.log(`╚════════════════════════════════════════════════════╝\n`);
  
  const testCases = [
    { symbol: 'NVDA', language: 'en', description: 'English PDF' },
    { symbol: 'AAPL', language: 'zh', description: 'Chinese PDF' }
  ];
  
  let totalPassed = 0;
  let totalFailed = 0;
  
  for (const testCase of testCases) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🧪 Testing: ${testCase.description}`);
    console.log(`   Symbol: ${testCase.symbol}`);
    console.log(`   Language: ${testCase.language}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    try {
      console.log(`⏳ Generating PDF buffer...`);
      const startTime = Date.now();
      
      const pdfBuffer = await generateReportPdfBuffer(testCase.symbol, testCase.language);
      
      const duration = Date.now() - startTime;
      console.log(`✅ PDF buffer generated in ${duration} ms\n`);
      
      // 验证 1: Buffer 类型
      if (!Buffer.isBuffer(pdfBuffer)) {
        console.log(`❌ FAILED: Not a Buffer`);
        totalFailed++;
        continue;
      }
      console.log(`✅ Validation 1: Is Buffer`);
      
      // 验证 2: Buffer 非空
      if (pdfBuffer.length === 0) {
        console.log(`❌ FAILED: Empty Buffer`);
        totalFailed++;
        continue;
      }
      console.log(`✅ Validation 2: Non-empty Buffer`);
      
      // 验证 3: Buffer 大小 > 10KB
      const sizeKB = (pdfBuffer.length / 1024).toFixed(2);
      if (pdfBuffer.length < 10 * 1024) {
        console.log(`❌ FAILED: Buffer too small (${sizeKB} KB < 10 KB)`);
        totalFailed++;
        continue;
      }
      console.log(`✅ Validation 3: Buffer size sufficient (${sizeKB} KB > 10 KB)`);
      
      // 验证 4: PDF 文件头
      const header = pdfBuffer.toString('ascii', 0, 5);
      if (header !== '%PDF-') {
        console.log(`❌ FAILED: Invalid PDF header (got: ${header})`);
        totalFailed++;
        continue;
      }
      console.log(`✅ Validation 4: Valid PDF header (%PDF-)`);
      
      // 可选：保存到临时文件用于手动检查
      const tempDir = path.join(__dirname, 'tmp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const filename = `test_${testCase.symbol}_${testCase.language}_${Date.now()}.pdf`;
      const filepath = path.join(tempDir, filename);
      fs.writeFileSync(filepath, pdfBuffer);
      console.log(`💾 PDF saved to: ${filepath}`);
      
      console.log(`\n📊 Summary:`);
      console.log(`   ├─ Symbol: ${testCase.symbol}`);
      console.log(`   ├─ Language: ${testCase.language}`);
      console.log(`   ├─ Size: ${sizeKB} KB`);
      console.log(`   ├─ Duration: ${duration} ms`);
      console.log(`   └─ File: ${filepath}`);
      
      console.log(`\n✅ ${testCase.description} - ALL VALIDATIONS PASSED`);
      totalPassed++;
      
    } catch (error) {
      console.error(`\n❌ ${testCase.description} - FAILED`);
      console.error(`   Error: ${error.message}`);
      console.error(`   Stack: ${error.stack.substring(0, 300)}...`);
      totalFailed++;
    }
  }
  
  console.log(`\n╔════════════════════════════════════════════════════╗`);
  console.log(`║   Final Results                                    ║`);
  console.log(`╚════════════════════════════════════════════════════╝`);
  console.log(`\nTests Passed: ${totalPassed}/${testCases.length}`);
  console.log(`Tests Failed: ${totalFailed}/${testCases.length}\n`);
  
  if (totalFailed === 0) {
    console.log(`🎉 All PDF generation tests passed!\n`);
  } else {
    console.log(`⚠️  Some tests failed. Please review the errors above.\n`);
  }
  
  return totalFailed === 0;
}

/**
 * 测试 PDF 文件名生成
 */
function testFilenameGeneration() {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🧪 Test: Filename Generation`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  const { generatePdfFilename } = require('./utils/telegramPdf');
  
  const testCases = [
    { symbol: 'NVDA', language: 'en', expected: /^NVDA_Equity_Research_USISv7_\d{4}-\d{2}-\d{2}\.pdf$/ },
    { symbol: 'aapl', language: 'zh', expected: /^AAPL_Equity_Research_USISv7_ZH_\d{4}-\d{2}-\d{2}\.pdf$/ },
    { symbol: 'TSLA', language: 'es', expected: /^TSLA_Equity_Research_USISv7_ES_\d{4}-\d{2}-\d{2}\.pdf$/ }
  ];
  
  let passed = 0;
  let failed = 0;
  
  testCases.forEach((testCase, index) => {
    const filename = generatePdfFilename(testCase.symbol, testCase.language);
    const matches = testCase.expected.test(filename);
    
    if (matches) {
      console.log(`✅ Test ${index + 1}: PASS`);
      console.log(`   Input: symbol=${testCase.symbol}, language=${testCase.language}`);
      console.log(`   Output: ${filename}`);
      passed++;
    } else {
      console.log(`❌ Test ${index + 1}: FAIL`);
      console.log(`   Input: symbol=${testCase.symbol}, language=${testCase.language}`);
      console.log(`   Expected pattern: ${testCase.expected}`);
      console.log(`   Got: ${filename}`);
      failed++;
    }
  });
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Result: ${passed} passed, ${failed} failed`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  return failed === 0;
}

/**
 * 主测试运行器
 */
async function runAllTests() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`USIS Brain v7.0 - Report PDF Service Test Suite`);
  console.log(`${'='.repeat(60)}\n`);
  
  try {
    // Test 1: Filename Generation (fast, no AI)
    const filenamesPassed = testFilenameGeneration();
    
    // Test 2: PDF Generation (slow, includes AI calls)
    const generationPassed = await testPdfGeneration();
    
    // Final summary
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Test Suite Complete`);
    console.log(`${'='.repeat(60)}`);
    console.log(`\nFilename Generation: ${filenamesPassed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`PDF Generation: ${generationPassed ? '✅ PASS' : '❌ FAIL'}`);
    
    const allPassed = filenamesPassed && generationPassed;
    
    if (allPassed) {
      console.log(`\n🎉 All test suites passed!`);
      process.exit(0);
    } else {
      console.log(`\n⚠️  Some test suites failed.`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error(`\n❌ Test suite crashed:`);
    console.error(error);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  testPdfGeneration,
  testFilenameGeneration
};
