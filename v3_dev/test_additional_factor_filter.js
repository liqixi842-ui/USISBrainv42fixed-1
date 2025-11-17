/**
 * Test script to verify "Additional factor 1/2/3" filtering
 * Generates a report and checks catalysts/risks for forbidden patterns
 */

const { buildResearchReport } = require('./services/reportService');

async function testAdditionalFactorFilter() {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('TEST: Additional Factor Filter Verification');
  console.log('════════════════════════════════════════════════════════════════\n');
  
  try {
    // Generate report
    console.log('🔍 Generating NVDA research report...\n');
    const report = await buildResearchReport('NVDA', 'equity');
    
    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('[DEBUG_CLEAN_TEST]');
    console.log('════════════════════════════════════════════════════════════════\n');
    
    // Check catalysts_text
    console.log('📊 CATALYSTS_TEXT:');
    console.log(`   Type: ${Array.isArray(report.catalysts_text) ? 'Array' : typeof report.catalysts_text}`);
    console.log(`   Count: ${report.catalysts_text.length} items\n`);
    
    if (Array.isArray(report.catalysts_text)) {
      report.catalysts_text.forEach((item, idx) => {
        const hasAdditionalFactor = /additional factor/i.test(item);
        const hasFactor123 = /\bfactor\s*[123]\b/i.test(item);
        const length = item.length;
        const status = (!hasAdditionalFactor && !hasFactor123 && length >= 30) ? '✅' : '❌';
        
        console.log(`   [${idx + 1}] ${status} (${length} chars)`);
        console.log(`       "${item.substring(0, 100)}${item.length > 100 ? '...' : ''}"`);
        
        if (hasAdditionalFactor) {
          console.log(`       ❌ CONTAINS "Additional factor"`);
        }
        if (hasFactor123) {
          console.log(`       ❌ CONTAINS "factor 1/2/3"`);
        }
        if (length < 30) {
          console.log(`       ❌ TOO SHORT (< 30 chars)`);
        }
        console.log('');
      });
    }
    
    // Check risks_text
    console.log('\n⚠️  RISKS_TEXT:');
    console.log(`   Type: ${Array.isArray(report.risks_text) ? 'Array' : typeof report.risks_text}`);
    console.log(`   Count: ${report.risks_text.length} items\n`);
    
    if (Array.isArray(report.risks_text)) {
      report.risks_text.forEach((item, idx) => {
        const hasAdditionalFactor = /additional factor/i.test(item);
        const hasFactor123 = /\bfactor\s*[123]\b/i.test(item);
        const length = item.length;
        const status = (!hasAdditionalFactor && !hasFactor123 && length >= 30) ? '✅' : '❌';
        
        console.log(`   [${idx + 1}] ${status} (${length} chars)`);
        console.log(`       "${item.substring(0, 100)}${item.length > 100 ? '...' : ''}"`);
        
        if (hasAdditionalFactor) {
          console.log(`       ❌ CONTAINS "Additional factor"`);
        }
        if (hasFactor123) {
          console.log(`       ❌ CONTAINS "factor 1/2/3"`);
        }
        if (length < 30) {
          console.log(`       ❌ TOO SHORT (< 30 chars)`);
        }
        console.log('');
      });
    }
    
    console.log('════════════════════════════════════════════════════════════════');
    console.log('[END_DEBUG_CLEAN_TEST]');
    console.log('════════════════════════════════════════════════════════════════\n');
    
    // Summary
    const catalystsFailed = report.catalysts_text.filter(item => 
      /additional factor/i.test(item) || 
      /\bfactor\s*[123]\b/i.test(item) || 
      item.length < 30
    );
    
    const risksFailed = report.risks_text.filter(item => 
      /additional factor/i.test(item) || 
      /\bfactor\s*[123]\b/i.test(item) || 
      item.length < 30
    );
    
    console.log('\n📋 TEST SUMMARY:');
    console.log(`   Catalysts: ${report.catalysts_text.length} items, ${catalystsFailed.length} failed ❌`);
    console.log(`   Risks: ${report.risks_text.length} items, ${risksFailed.length} failed ❌`);
    
    if (catalystsFailed.length === 0 && risksFailed.length === 0) {
      console.log('\n✅ SUCCESS: All catalysts and risks passed validation!');
      console.log('   - No "Additional factor" patterns found');
      console.log('   - No "factor 1/2/3" patterns found');
      console.log('   - All items >= 30 characters');
    } else {
      console.log('\n❌ FAILURE: Some items failed validation');
      if (catalystsFailed.length > 0) {
        console.log(`   - ${catalystsFailed.length} catalysts failed`);
      }
      if (risksFailed.length > 0) {
        console.log(`   - ${risksFailed.length} risks failed`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error(error.stack);
  }
}

// Run test
testAdditionalFactorFilter().then(() => {
  console.log('\nTest completed.');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
