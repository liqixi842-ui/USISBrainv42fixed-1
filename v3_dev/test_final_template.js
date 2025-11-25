/**
 * Final Template v1.0 Test Script
 * Generates PDF reports using the new fixed 20-page template
 */

const { buildResearchReport, buildHtmlFromReport, generatePdfWithDocRaptor } = require('./services/reportService.js');
const fs = require('fs');

async function testSymbol(symbol) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Testing Final Template v1.0 - ${symbol} Report`);
  console.log('='.repeat(70));
  
  try {
    // Generate research report
    console.log(`\n📊 Generating research report for ${symbol}...`);
    const report = await buildResearchReport(symbol, 'equity');
    
    // Save JSON
    const jsonPath = `/tmp/${symbol}_final_template.json`;
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`✅ JSON saved to ${jsonPath}`);
    
    // Generate HTML using new template
    console.log(`\n📄 Generating HTML using Final Template v1.0...`);
    const html = buildHtmlFromReport(report);
    
    // Save HTML for inspection
    const htmlPath = `/tmp/${symbol}_final_template.html`;
    fs.writeFileSync(htmlPath, html, 'utf-8');
    console.log(`✅ HTML saved to ${htmlPath}`);
    
    // Count pages in HTML (each page has class="page")
    const pageCount = (html.match(/class="page"/g) || []).length;
    console.log(`📄 Template generated ${pageCount} pages`);
    
    // Generate PDF
    console.log(`\n📊 Generating PDF via DocRaptor...`);
    const pdfBuffer = await generatePdfWithDocRaptor(symbol, html);
    
    // Save PDF
    const pdfPath = `/tmp/${symbol}_final_template.pdf`;
    fs.writeFileSync(pdfPath, pdfBuffer);
    const pdfSizeKB = (pdfBuffer.length / 1024).toFixed(1);
    console.log(`✅ PDF saved to ${pdfPath} (${pdfSizeKB} KB)`);
    
    // Summary
    console.log(`\n${'─'.repeat(70)}`);
    console.log('Summary:');
    console.log('─'.repeat(70));
    console.log(`Symbol: ${symbol}`);
    console.log(`Rating: ${report.rating}`);
    console.log(`Target: $${report.targets.base.price} (${report.targets.base.upside_pct}% upside)`);
    console.log(`HTML Pages: ${pageCount}`);
    console.log(`PDF Size: ${pdfSizeKB} KB`);
    console.log(`Version: ${report.meta.version}`);
    console.log(`Model: ${report.meta.model}`);
    console.log('─'.repeat(70));
    
    return { symbol, pageCount, pdfSizeKB, success: true };
    
  } catch (err) {
    console.error(`\n❌ Error testing ${symbol}: ${err.message}`);
    console.error(err.stack);
    return { symbol, success: false, error: err.message };
  }
}

(async () => {
  const symbols = process.argv.slice(2);
  if (symbols.length === 0) {
    symbols.push('NVDA', 'AAPL', 'SPX');
  }
  
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║  Final Institutional Template v1.0 - PDF Generation Test      ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`\nTesting ${symbols.length} symbols: ${symbols.join(', ')}\n`);
  
  const results = [];
  for (const symbol of symbols) {
    const result = await testSymbol(symbol);
    results.push(result);
  }
  
  // Final summary
  console.log('\n\n' + '='.repeat(70));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(70));
  
  results.forEach(r => {
    if (r.success) {
      console.log(`✅ ${r.symbol}: ${r.pageCount} pages, ${r.pdfSizeKB} KB`);
    } else {
      console.log(`❌ ${r.symbol}: FAILED - ${r.error}`);
    }
  });
  
  const allSuccess = results.every(r => r.success);
  const allSamePageCount = results.length > 1 && results.every(r => r.pageCount === results[0].pageCount);
  
  console.log('\n' + '─'.repeat(70));
  if (allSuccess && allSamePageCount) {
    console.log('✅ ALL TESTS PASSED - All reports have consistent page count!');
  } else if (allSuccess && !allSamePageCount) {
    console.log('⚠️  TESTS PASSED but page counts differ (should be fixed at 20 pages)');
  } else {
    console.log('❌ SOME TESTS FAILED');
  }
  console.log('='.repeat(70) + '\n');
  
})();
