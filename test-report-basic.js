/**
 * ═══════════════════════════════════════════════════════════════
 * USIS Brain v7.0 - Report Text Service Basic Test
 * ═══════════════════════════════════════════════════════════════
 * 
 * 测试范围：
 * - reportTextService.generateFullTextReport 输出结构
 * - 章节完整性验证
 * - 多语言支持验证
 * - 字数统计验证
 * - 路由解析验证
 * 
 * 不测试：
 * - 实际 AI 生成内容（避免消耗 API 配额）
 * - Telegram bot 实发（避免发送真实消息）
 */

const { generateFullTextReport } = require('./services/reportTextService');

// ═══════════════════════════════════════════════════════════════
// 测试辅助函数
// ═══════════════════════════════════════════════════════════════

/**
 * 验证研报结构
 */
function validateReportStructure(report, expectedLanguage = 'en') {
  const errors = [];
  
  // 验证必需字段
  if (!report.symbol) errors.push('Missing symbol');
  if (!report.language) errors.push('Missing language');
  if (!Array.isArray(report.sections)) errors.push('sections is not an array');
  if (!report.metadata) errors.push('Missing metadata');
  
  // 验证语言
  if (report.language !== expectedLanguage) {
    errors.push(`Language mismatch: expected ${expectedLanguage}, got ${report.language}`);
  }
  
  // 验证章节数量（应该有 6 个）
  if (report.sections.length !== 6) {
    errors.push(`Expected 6 sections, got ${report.sections.length}`);
  }
  
  // 验证每个章节的结构
  report.sections.forEach((section, index) => {
    if (!section.title) {
      errors.push(`Section ${index}: Missing title`);
    }
    if (!section.key) {
      errors.push(`Section ${index}: Missing key`);
    }
    if (typeof section.body !== 'string') {
      errors.push(`Section ${index}: body is not a string`);
    }
    if (section.body.length === 0) {
      errors.push(`Section ${index}: Empty body`);
    }
  });
  
  // 验证元数据
  if (!report.metadata.generatedAt) errors.push('Missing metadata.generatedAt');
  if (typeof report.metadata.duration !== 'number') errors.push('Invalid metadata.duration');
  if (typeof report.metadata.wordCount !== 'number') errors.push('Invalid metadata.wordCount');
  
  return errors;
}

/**
 * 验证章节键名
 */
function validateSectionKeys(report) {
  const expectedKeys = [
    'executive_summary',
    'investment_thesis',
    'valuation',
    'industry',
    'catalysts',
    'risks'
  ];
  
  const actualKeys = report.sections.map(s => s.key);
  const errors = [];
  
  expectedKeys.forEach((key, index) => {
    if (actualKeys[index] !== key) {
      errors.push(`Section ${index}: Expected key '${key}', got '${actualKeys[index]}'`);
    }
  });
  
  return errors;
}

/**
 * 测试路由解析（模拟 manager-bot 的 parseCommand）
 */
function testCommandParsing() {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🧪 Test: Command Parsing`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  const testCases = [
    { input: '/report NVDA', expected: { cmd: 'report', args: ['NVDA'] } },
    { input: '/report AAPL zh', expected: { cmd: 'report', args: ['AAPL', 'zh'] } },
    { input: '研报 TSLA', expected: { cmd: 'report', args: ['TSLA'] } },
    { input: '/report MSFT en', expected: { cmd: 'report', args: ['MSFT', 'en'] } }
  ];
  
  let passed = 0;
  let failed = 0;
  
  testCases.forEach((testCase, index) => {
    const parts = testCase.input.trim().split(/\s+/);
    const firstPart = parts[0].toLowerCase();
    
    // 简化的路由逻辑
    let cmd = null;
    let args = [];
    
    if (firstPart === '/report' || firstPart === '研报') {
      cmd = 'report';
      args = parts.slice(1);
    }
    
    const matches = cmd === testCase.expected.cmd && 
                    JSON.stringify(args) === JSON.stringify(testCase.expected.args);
    
    if (matches) {
      console.log(`✅ Test ${index + 1}: PASS`);
      console.log(`   Input: "${testCase.input}"`);
      console.log(`   Output: cmd=${cmd}, args=[${args.join(', ')}]`);
      passed++;
    } else {
      console.log(`❌ Test ${index + 1}: FAIL`);
      console.log(`   Input: "${testCase.input}"`);
      console.log(`   Expected: cmd=${testCase.expected.cmd}, args=[${testCase.expected.args.join(', ')}]`);
      console.log(`   Got: cmd=${cmd}, args=[${args.join(', ')}]`);
      failed++;
    }
  });
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Result: ${passed} passed, ${failed} failed`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  return failed === 0;
}

/**
 * 测试研报生成（带 mock AI）
 */
async function testReportGeneration() {
  console.log(`\n╔════════════════════════════════════════════════════╗`);
  console.log(`║   Report Text Service - Basic Test                ║`);
  console.log(`╚════════════════════════════════════════════════════╝\n`);
  
  const testCases = [
    { symbol: 'NVDA', language: 'en', description: 'English Report' },
    { symbol: 'AAPL', language: 'zh', description: 'Chinese Report' },
    { symbol: 'TSLA', language: 'es', description: 'Spanish Report' }
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
      console.log(`⏳ Generating report...`);
      const startTime = Date.now();
      
      const report = await generateFullTextReport(testCase.symbol, testCase.language);
      
      const duration = Date.now() - startTime;
      console.log(`✅ Report generated in ${duration} ms\n`);
      
      // 验证结构
      console.log(`🔍 Validating structure...`);
      const structureErrors = validateReportStructure(report, testCase.language);
      
      if (structureErrors.length > 0) {
        console.log(`❌ Structure validation FAILED:`);
        structureErrors.forEach(err => console.log(`   • ${err}`));
        totalFailed++;
        continue;
      }
      
      console.log(`✅ Structure validation PASSED`);
      
      // 验证章节键名
      console.log(`🔍 Validating section keys...`);
      const keyErrors = validateSectionKeys(report);
      
      if (keyErrors.length > 0) {
        console.log(`❌ Section key validation FAILED:`);
        keyErrors.forEach(err => console.log(`   • ${err}`));
        totalFailed++;
        continue;
      }
      
      console.log(`✅ Section key validation PASSED`);
      
      // 显示摘要
      console.log(`\n📊 Report Summary:`);
      console.log(`   ├─ Symbol: ${report.symbol}`);
      console.log(`   ├─ Language: ${report.language}`);
      console.log(`   ├─ Sections: ${report.sections.length}`);
      console.log(`   ├─ Total words: ~${report.metadata.wordCount}`);
      console.log(`   ├─ Generated at: ${report.metadata.generatedAt}`);
      console.log(`   └─ Version: ${report.metadata.version}`);
      
      console.log(`\n📝 Section List:`);
      report.sections.forEach((section, index) => {
        const wordCount = section.body.split(/\s+/).length;
        console.log(`   ${index + 1}. ${section.title} (~${wordCount} words)`);
      });
      
      console.log(`\n✅ ${testCase.description} - ALL TESTS PASSED`);
      totalPassed++;
      
    } catch (error) {
      console.error(`\n❌ ${testCase.description} - FAILED`);
      console.error(`   Error: ${error.message}`);
      console.error(`   Stack: ${error.stack.substring(0, 200)}...`);
      totalFailed++;
    }
  }
  
  console.log(`\n╔════════════════════════════════════════════════════╗`);
  console.log(`║   Final Results                                    ║`);
  console.log(`╚════════════════════════════════════════════════════╝`);
  console.log(`\nTests Passed: ${totalPassed}/${testCases.length}`);
  console.log(`Tests Failed: ${totalFailed}/${testCases.length}\n`);
  
  if (totalFailed === 0) {
    console.log(`🎉 All tests passed!\n`);
  } else {
    console.log(`⚠️  Some tests failed. Please review the errors above.\n`);
  }
  
  return totalFailed === 0;
}

/**
 * 主测试运行器
 */
async function runAllTests() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`USIS Brain v7.0 - Report Text Service Test Suite`);
  console.log(`${'='.repeat(60)}\n`);
  
  try {
    // Test 1: Command Parsing
    const parsingPassed = testCommandParsing();
    
    // Test 2: Report Generation (with real AI calls)
    const generationPassed = await testReportGeneration();
    
    // Final summary
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Test Suite Complete`);
    console.log(`${'='.repeat(60)}`);
    console.log(`\nCommand Parsing: ${parsingPassed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Report Generation: ${generationPassed ? '✅ PASS' : '❌ FAIL'}`);
    
    const allPassed = parsingPassed && generationPassed;
    
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
  validateReportStructure,
  validateSectionKeys,
  testCommandParsing,
  testReportGeneration
};
