/**
 * V7.0 Ticket Analysis Integration Test
 * Tests direct buildResearchReport() call without HTTP API
 */

// Set environment variables
process.env.FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || 'test-key';
process.env.TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY || 'test-key';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';

const { buildResearchReport } = require('./v3_dev/services/reportService');
const ticketFormatter = require('./v3_dev/services/v5/ticketFormatter');

async function testV7TicketFlow() {
  console.log('🧪 ═══════════════════════════════════════════════════════');
  console.log('🧪 V7.0 TICKET ANALYSIS INTEGRATION TEST');
  console.log('🧪 ═══════════════════════════════════════════════════════\n');
  
  try {
    // Test symbol
    const symbol = 'AAPL';
    
    // ═══════════════════════════════════════════════════════════════
    // PHASE 1: Test buildResearchReport() direct call
    // ═══════════════════════════════════════════════════════════════
    console.log('📊 Phase 1: Testing buildResearchReport() call...\n');
    
    const t0 = Date.now();
    
    const report = await buildResearchReport(symbol, 'equity', {
      brand: 'USIS Research',
      firm: 'USIS Research Division',
      analyst: 'Test Agent',
      language: 'zh'
    });
    
    const dt = Date.now() - t0;
    
    console.log(`✅ buildResearchReport() completed in ${dt}ms\n`);
    
    // Verify report structure
    console.log('🔍 Verifying report structure...');
    const checks = [
      { field: 'symbol', value: report.symbol, expected: 'AAPL' },
      { field: 'name', exists: !!report.name },
      { field: 'rating', exists: !!report.rating },
      { field: 'asset_type', exists: !!report.asset_type },
      { field: 'price.last', exists: report.price?.last !== undefined },
      { field: 'valuation.market_cap', exists: report.valuation?.market_cap !== undefined },
      { field: 'valuation.pe_ttm', exists: report.valuation?.pe_ttm !== undefined },
      { field: 'fundamentals', exists: !!report.fundamentals },
      { field: 'targets', exists: !!report.targets }
    ];
    
    let passed = 0;
    let failed = 0;
    
    checks.forEach(check => {
      if (check.expected !== undefined) {
        if (check.value === check.expected) {
          console.log(`  ✅ ${check.field}: ${check.value}`);
          passed++;
        } else {
          console.log(`  ❌ ${check.field}: Expected ${check.expected}, got ${check.value}`);
          failed++;
        }
      } else {
        if (check.exists) {
          console.log(`  ✅ ${check.field}: exists`);
          passed++;
        } else {
          console.log(`  ❌ ${check.field}: missing`);
          failed++;
        }
      }
    });
    
    console.log(`\n📊 Structure verification: ${passed}/${checks.length} passed\n`);
    
    // ═══════════════════════════════════════════════════════════════
    // PHASE 2: Test ticketFormatter
    // ═══════════════════════════════════════════════════════════════
    console.log('📝 Phase 2: Testing ticketFormatter...\n');
    
    const formatOptions = {
      mode: 'standard',
      bilingual_split: false,
      primary_lang: 'zh'
    };
    
    const messages = await ticketFormatter.formatTicket(report, formatOptions);
    
    console.log(`✅ ticketFormatter generated ${messages.length} message(s)`);
    
    messages.forEach((msg, i) => {
      console.log(`  Message ${i + 1}: ${msg.length} chars`);
      if (msg.length > 2500) {
        console.log(`    ⚠️  WARNING: Exceeds Telegram limit (2500 chars)`);
      }
    });
    
    // ═══════════════════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════════════════
    console.log('\n🎯 ═══════════════════════════════════════════════════════');
    console.log('🎯 TEST SUMMARY');
    console.log('🎯 ═══════════════════════════════════════════════════════');
    console.log(`✅ buildResearchReport() works: YES`);
    console.log(`✅ Report structure valid: ${passed}/${checks.length} checks passed`);
    console.log(`✅ ticketFormatter works: YES`);
    console.log(`✅ Total messages: ${messages.length}`);
    console.log(`✅ Total time: ${Date.now() - t0}ms`);
    
    if (failed === 0 && messages.length > 0) {
      console.log('\n🎉 V7.0 INTEGRATION TEST PASSED!');
      console.log('🚀 Ready for deployment to production server\n');
      process.exit(0);
    } else {
      console.log('\n❌ TEST FAILED');
      console.log(`   ${failed} structure checks failed`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ TEST FAILED WITH ERROR');
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
    process.exit(1);
  }
}

// Run test
testV7TicketFlow();
