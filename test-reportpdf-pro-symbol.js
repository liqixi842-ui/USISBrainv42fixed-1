/**
 * test-reportpdf-pro-symbol.js
 * 自测脚本：验证 /reportpdf pro NVDA 命令解析的 symbol 始终是 "NVDA"，从不变成 "pro"
 */

const { parseCommand } = require('./bots/manager-bot.js');

// 测试用例
const testCases = [
  {
    name: 'Test 1: /reportpdf pro NVDA',
    text: '/reportpdf pro NVDA',
    expectedSymbol: 'NVDA',
    expectedLanguage: 'en',
    expectedPremium: true
  },
  {
    name: 'Test 2: /reportpdf NVDA pro',
    text: '/reportpdf NVDA pro',
    expectedSymbol: 'NVDA',
    expectedLanguage: 'en',
    expectedPremium: true
  },
  {
    name: 'Test 3: /reportpdf NVDA pro zh',
    text: '/reportpdf NVDA pro zh',
    expectedSymbol: 'NVDA',
    expectedLanguage: 'zh',
    expectedPremium: true
  },
  {
    name: 'Test 4: /reportpdf pro NVDA zh',
    text: '/reportpdf pro NVDA zh',
    expectedSymbol: 'NVDA',
    expectedLanguage: 'zh',
    expectedPremium: true
  },
  {
    name: 'Test 5: /reportpdf TSLA (basic)',
    text: '/reportpdf TSLA',
    expectedSymbol: 'TSLA',
    expectedLanguage: 'en',
    expectedPremium: false
  },
  {
    name: 'Test 6: /reportpdf AAPL zh (basic)',
    text: '/reportpdf AAPL zh',
    expectedSymbol: 'AAPL',
    expectedLanguage: 'zh',
    expectedPremium: false
  },
  {
    name: 'Test 7: /reportpdf premium MSFT es',
    text: '/reportpdf premium MSFT es',
    expectedSymbol: 'MSFT',
    expectedLanguage: 'es',
    expectedPremium: true
  }
];

function runTests() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  USIS Brain v7.0 - Premium Symbol Parsing Test Suite       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  let passed = 0;
  let failed = 0;
  const failedTests = [];
  
  testCases.forEach((testCase, index) => {
    console.log(`\n${'-'.repeat(70)}`);
    console.log(`📋 ${testCase.name}`);
    console.log(`   Input: "${testCase.text}"`);
    
    // 创建模拟消息对象
    const mockMessage = {
      text: testCase.text,
      from: { id: 12345, username: 'testuser' }
    };
    
    // 调用 parseCommand
    const result = parseCommand(mockMessage);
    
    console.log(`\n   📊 Parse Result:`);
    console.log(`      - cmd: ${result.cmd}`);
    console.log(`      - args: ${JSON.stringify(result.args)}`);
    console.log(`      - flags: ${JSON.stringify(result.flags)}`);
    
    // 验证结果
    const actualSymbol = result.flags.symbol;
    const actualLanguage = result.flags.language;
    const actualPremium = result.flags.premium;
    
    const symbolMatch = actualSymbol === testCase.expectedSymbol;
    const languageMatch = actualLanguage === testCase.expectedLanguage;
    const premiumMatch = actualPremium === testCase.expectedPremium;
    
    const testPassed = symbolMatch && languageMatch && premiumMatch;
    
    console.log(`\n   ✅ Expected:`);
    console.log(`      - symbol: ${testCase.expectedSymbol}`);
    console.log(`      - language: ${testCase.expectedLanguage}`);
    console.log(`      - premium: ${testCase.expectedPremium}`);
    
    console.log(`\n   ${testPassed ? '✅' : '❌'} Actual:`);
    console.log(`      - symbol: ${actualSymbol} ${symbolMatch ? '✅' : '❌'}`);
    console.log(`      - language: ${actualLanguage} ${languageMatch ? '✅' : '❌'}`);
    console.log(`      - premium: ${actualPremium} ${premiumMatch ? '✅' : '❌'}`);
    
    if (testPassed) {
      console.log(`\n   ✅ PASS`);
      passed++;
    } else {
      console.log(`\n   ❌ FAIL`);
      failed++;
      failedTests.push({
        name: testCase.name,
        expected: {
          symbol: testCase.expectedSymbol,
          language: testCase.expectedLanguage,
          premium: testCase.expectedPremium
        },
        actual: {
          symbol: actualSymbol,
          language: actualLanguage,
          premium: actualPremium
        }
      });
    }
  });
  
  // 打印总结
  console.log(`\n${'='.repeat(70)}`);
  console.log(`\n📊 Test Summary:`);
  console.log(`   ✅ Passed: ${passed}/${testCases.length}`);
  console.log(`   ❌ Failed: ${failed}/${testCases.length}`);
  console.log(`   📈 Success Rate: ${((passed / testCases.length) * 100).toFixed(1)}%`);
  
  if (failed > 0) {
    console.log(`\n❌ Failed Tests Details:`);
    failedTests.forEach((test, index) => {
      console.log(`\n   ${index + 1}. ${test.name}`);
      console.log(`      Expected: symbol=${test.expected.symbol}, language=${test.expected.language}, premium=${test.expected.premium}`);
      console.log(`      Actual:   symbol=${test.actual.symbol}, language=${test.actual.language}, premium=${test.actual.premium}`);
    });
  }
  
  console.log(`\n${'='.repeat(70)}\n`);
  
  // 关键检查：symbol 是否从不等于 "PRO"
  console.log(`\n🔍 Critical Check: Symbol Never Equals "PRO"`);
  const proSymbolFound = testCases.some((tc, idx) => {
    const mockMessage = { text: tc.text, from: { id: 12345, username: 'testuser' } };
    const result = parseCommand(mockMessage);
    return result.flags.symbol === 'PRO';
  });
  
  if (proSymbolFound) {
    console.log(`   ❌ CRITICAL BUG: Symbol was parsed as "PRO" in at least one test!`);
  } else {
    console.log(`   ✅ PASS: Symbol never equals "PRO" - bug is fixed!`);
  }
  
  console.log(`\n${'='.repeat(70)}\n`);
  
  if (failed === 0 && !proSymbolFound) {
    console.log(`🎉 All tests passed! Symbol parsing is working correctly.\n`);
    process.exit(0);
  } else {
    console.log(`❌ Some tests failed. Please review the failed tests above.\n`);
    process.exit(1);
  }
}

// 运行测试
runTests();
