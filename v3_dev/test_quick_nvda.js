const reportService = require('./services/reportService.js');

async function quickTest() {
  console.log('Generating NVDA report to verify v4.0 wiring...');
  const report = await reportService.buildResearchReport('NVDA', 'equity');
  
  // Check critical fields
  console.log('\n═══ Quick Verification ═══');
  console.log('Version:', report.meta.version);
  console.log('Catalysts count:', report.catalysts_text?.length || 0);
  console.log('Risks count:', report.risks_text?.length || 0);
  
  // Check for forbidden patterns
  const text = report.summary_text + report.thesis_text + report.valuation_text;
  const issues = [];
  
  if (/ARM acquisition/i.test(text)) issues.push('ARM acquisition found');
  if (/Q[1-4] 202[2-5]/i.test(text)) issues.push('Specific quarter dates found');
  if (/will definitely|guaranteed/i.test(text)) issues.push('Absolute statements found');
  
  if (issues.length > 0) {
    console.log('❌ Issues:', issues.join(', '));
  } else {
    console.log('✅ No forbidden content in main text');
  }
  
  console.log('\nSample summary (first 200 chars):');
  console.log(report.summary_text.substring(0, 200));
}

quickTest().catch(e => console.error('Error:', e.message));
