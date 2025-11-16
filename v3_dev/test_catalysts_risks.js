const reportService = require('./services/reportService.js');

async function testCatalystsRisks() {
  console.log('Testing catalysts and risks correction...\n');
  const report = await reportService.buildResearchReport('NVDA', 'equity');
  
  console.log('═══ Catalysts Text (refined):');
  report.catalysts_text.forEach((c, i) => {
    console.log(`${i+1}. ${c.substring(0, 150)}...`);
  });
  
  console.log('\n═══ Risks Text (refined):');
  report.risks_text.forEach((r, i) => {
    console.log(`${i+1}. ${r.substring(0, 150)}...`);
  });
  
  // Check for forbidden content in catalysts and risks
  const catalystsStr = report.catalysts_text.join(' ');
  const risksStr = report.risks_text.join(' ');
  
  console.log('\n═══ Forbidden Content Check:');
  const forbidden = [];
  if (/ARM acquisition/i.test(catalystsStr + risksStr)) forbidden.push('ARM acquisition');
  if (/Q[1-4] 202[2-5]/i.test(catalystsStr + risksStr)) forbidden.push('Q[1-4] 202X dates');
  if (/\$\d+\.?\d*\s*[BM]\s+(revenue|impact|increase)/i.test(catalystsStr + risksStr)) {
    // Check if amounts are verified
    const matches = (catalystsStr + risksStr).match(/\$(\d+\.?\d*)\s*([BM])\s+(revenue|impact|increase)/gi);
    if (matches) forbidden.push(`Unverified amounts: ${matches.join(', ')}`);
  }
  
  if (forbidden.length > 0) {
    console.log('❌ Found:', forbidden.join('; '));
  } else {
    console.log('✅ No forbidden content in catalysts/risks');
  }
}

testCatalystsRisks().catch(e => console.error('Error:', e.message));
