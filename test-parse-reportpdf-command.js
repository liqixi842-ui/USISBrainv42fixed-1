/**
 * ═══════════════════════════════════════════════════════════════
 * USIS Brain v7.0 - ReportPDF Command Parser Test
 * ═══════════════════════════════════════════════════════════════
 * 
 * 测试 manager-bot.js 的 parseCommand 函数是否正确解析：
 * - /reportpdf pro NVDA
 * - /reportpdf NVDA pro
 * - /reportpdf NVDA pro zh
 * 
 * 预期所有情况：symbol = 'NVDA', language = 正确, premium = true
 */

// 直接引入 parseReportPdfArgs 逻辑（复制）
function parseReportPdfArgs(rawArgs) {
  const VALID_LANGUAGES = ['en', 'zh', 'es'];
  const PREMIUM_FLAGS = ['pro', 'premium'];
  
  let symbol = null;
  let language = 'en'; // 默认英文
  let premium = false;
  
  // 遍历所有参数，分类识别
  for (const arg of rawArgs) {
    const argLower = arg.toLowerCase();
    
    // 1. 检查是否为 premium 标志
    if (PREMIUM_FLAGS.includes(argLower)) {
      premium = true;
      continue;
    }
    
    // 2. 检查是否为语言代码
    if (VALID_LANGUAGES.includes(argLower)) {
      language = argLower;
      continue;
    }
    
    // 3. 否则视为 symbol（取第一个非标志/非语言的参数）
    if (!symbol) {
      symbol = arg.toUpperCase();
    }
  }
  
  // 返回标准化的 args 和 flags
  return {
    args: symbol ? [symbol, language] : [],
    flags: { premium }
  };
}

/**
 * 测试函数
 */
function runTests() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`USIS Brain v7.0 - ReportPDF Command Parser Test`);
  console.log(`${'='.repeat(60)}\n`);
  
  const testCases = [
    {
      name: 'Test 1: /reportpdf pro NVDA',
      input: ['pro', 'NVDA'],
      expected: {
        symbol: 'NVDA',
        language: 'en',
        premium: true
      }
    },
    {
      name: 'Test 2: /reportpdf NVDA pro',
      input: ['NVDA', 'pro'],
      expected: {
        symbol: 'NVDA',
        language: 'en',
        premium: true
      }
    },
    {
      name: 'Test 3: /reportpdf NVDA pro zh',
      input: ['NVDA', 'pro', 'zh'],
      expected: {
        symbol: 'NVDA',
        language: 'zh',
        premium: true
      }
    },
    {
      name: 'Test 4: /reportpdf pro NVDA zh',
      input: ['pro', 'NVDA', 'zh'],
      expected: {
        symbol: 'NVDA',
        language: 'zh',
        premium: true
      }
    },
    {
      name: 'Test 5: /reportpdf NVDA (basic mode, en)',
      input: ['NVDA'],
      expected: {
        symbol: 'NVDA',
        language: 'en',
        premium: false
      }
    },
    {
      name: 'Test 6: /reportpdf AAPL zh (basic mode, zh)',
      input: ['AAPL', 'zh'],
      expected: {
        symbol: 'AAPL',
        language: 'zh',
        premium: false
      }
    },
    {
      name: 'Test 7: /reportpdf premium TSLA es',
      input: ['premium', 'TSLA', 'es'],
      expected: {
        symbol: 'TSLA',
        language: 'es',
        premium: true
      }
    },
    {
      name: 'Test 8: Empty args',
      input: [],
      expected: {
        symbol: null,
        language: 'en',
        premium: false
      }
    }
  ];
  
  let passCount = 0;
  let failCount = 0;
  
  testCases.forEach((testCase, index) => {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`${testCase.name}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Input: ${JSON.stringify(testCase.input)}`);
    
    const result = parseReportPdfArgs(testCase.input);
    const symbol = result.args[0] || null;
    const language = result.args[1] || 'en';
    const premium = result.flags.premium;
    
    console.log(`\nOutput:`);
    console.log(`   ├─ args: ${JSON.stringify(result.args)}`);
    console.log(`   └─ flags: ${JSON.stringify(result.flags)}`);
    
    console.log(`\nParsed Values:`);
    console.log(`   ├─ symbol: ${symbol || 'null'}`);
    console.log(`   ├─ language: ${language}`);
    console.log(`   └─ premium: ${premium}`);
    
    console.log(`\nExpected Values:`);
    console.log(`   ├─ symbol: ${testCase.expected.symbol || 'null'}`);
    console.log(`   ├─ language: ${testCase.expected.language}`);
    console.log(`   └─ premium: ${testCase.expected.premium}`);
    
    // 验证
    const symbolMatch = symbol === testCase.expected.symbol;
    const languageMatch = language === testCase.expected.language;
    const premiumMatch = premium === testCase.expected.premium;
    
    const passed = symbolMatch && languageMatch && premiumMatch;
    
    console.log(`\nValidation:`);
    console.log(`   ├─ Symbol: ${symbolMatch ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   ├─ Language: ${languageMatch ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   └─ Premium: ${premiumMatch ? '✅ PASS' : '❌ FAIL'}`);
    
    if (passed) {
      console.log(`\n✅ Test ${index + 1}: PASSED\n`);
      passCount++;
    } else {
      console.log(`\n❌ Test ${index + 1}: FAILED\n`);
      failCount++;
    }
  });
  
  // 总结
  console.log(`${'='.repeat(60)}`);
  console.log(`Test Summary`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total Tests: ${testCases.length}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Success Rate: ${((passCount / testCases.length) * 100).toFixed(1)}%`);
  
  if (failCount === 0) {
    console.log(`\n🎉 All tests passed! Command parsing works correctly.\n`);
    process.exit(0);
  } else {
    console.log(`\n⚠️  Some tests failed. Please review the logic.\n`);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  runTests();
}

module.exports = { parseReportPdfArgs, runTests };
