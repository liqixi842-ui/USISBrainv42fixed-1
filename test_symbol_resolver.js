const {parseUserIntent} = require('./semanticIntentAgent');
const {resolveSymbols} = require('./symbolResolver');

// 设置环境变量
process.env.ENABLE_SYMBOL_DEBUG = 'true';

async function testSymbolResolver() {
  const tickers = ['NVDA', 'AAPL', 'TSLA', 'COL'];
  const results = [];
  
  console.log('=== Symbol Resolver Test ===\n');
  
  for (const ticker of tickers) {
    const t0 = Date.now();
    
    try {
      console.log(`\n========== Testing: ${ticker} ==========`);
      const intent = await parseUserIntent(`分析${ticker}`);
      const resolved = await resolveSymbols(intent);
      const duration = Date.now() - t0;
      
      results.push({
        input: ticker,
        resolved: resolved,
        duration_ms: duration,
        status: 'success'
      });
      
      console.log(`✅ Result: ${JSON.stringify(resolved)}`);
      console.log(`⏱️  Duration: ${duration}ms\n`);
    } catch (error) {
      const duration = Date.now() - t0;
      results.push({
        input: ticker,
        error: error.message,
        duration_ms: duration,
        status: 'error'
      });
      console.error(`❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n\n=== Final Results ===');
  console.log(JSON.stringify(results, null, 2));
}

testSymbolResolver().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
