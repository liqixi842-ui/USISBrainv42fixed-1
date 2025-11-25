// Direct test of v5 report generation
const reportService = require('./v3_dev/services/reportService');

async function testReport() {
  try {
    console.log('🧪 Testing v5 report generation for NVDA...\n');
    
    const result = await reportService.buildResearchReport('NVDA', 'stock', {
      brand: 'DeepReport Research',
      firm: 'Test Firm',
      analyst: 'Test Analyst'
    });
    
    console.log('\n✅ Report generation successful!');
    console.log('Report keys:', Object.keys(result));
    
  } catch (error) {
    console.error('\n❌ ERROR CAUGHT:\n');
    console.error(error);
    console.error('\n=== STACK TRACE ===');
    console.error(error.stack);
    process.exit(1);
  }
}

testReport();
