const reportService = require('./services/reportService.js');

async function testSPX() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Testing v3.2 Multi-Model Pipeline: ^GSPC (S&P 500)       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const symbol = '^GSPC';
  const startTime = Date.now();

  try {
    const report = await reportService.buildResearchReport(symbol, 'v3.2');
    const endTime = Date.now();
    const totalLatency = ((endTime - startTime) / 1000).toFixed(1);
    
    console.log('\n─────────────────────────────────────────────────────────────');
    console.log('Summary Preview:');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(report.summary_text.substring(0, 300) + '...\n');
    
    console.log('─────────────────────────────────────────────────────────────');
    console.log('Thesis Excerpt:');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(report.thesis_text.substring(0, 400) + '...\n');
    
    console.log('─────────────────────────────────────────────────────────────');
    console.log('Macro Text Excerpt:');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(report.macro_text.substring(0, 300) + '...\n');
    
    console.log('─────────────────────────────────────────────────────────────');
    console.log('Catalysts Count:', report.catalysts_text.length);
    console.log('Risks Count:', report.risks_text.length);
    console.log('Total Latency:', totalLatency + 's');
    console.log('─────────────────────────────────────────────────────────────\n');
    
    // Check for forbidden phrases
    const allText = JSON.stringify(report).toLowerCase();
    const forbidden = ['unavailable', 'without claude', 'without gemini', 'missing', 'absence of'];
    let foundForbidden = false;
    
    console.log('Checking for forbidden phrases in user-facing text...');
    forbidden.forEach(phrase => {
      if (allText.includes(phrase) && !allText.includes('"analysis"')) {
        console.log(`❌ FOUND: "${phrase}"`);
        foundForbidden = true;
      }
    });
    
    if (!foundForbidden) {
      console.log('✅ No forbidden phrases found in narrative text!\n');
    }
    
    // Save JSON
    const fs = require('fs');
    fs.writeFileSync('/tmp/SPX_v3.2_report.json', JSON.stringify(report, null, 2));
    console.log('✅ v3.2 Multi-Model Pipeline test complete!');
    console.log('📁 Full JSON saved to: /tmp/SPX_v3.2_report.json\n');
    
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    console.error(err.stack);
  }
}

testSPX();
