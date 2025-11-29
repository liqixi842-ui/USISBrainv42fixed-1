/**
 * Test Puppeteer PDF Generation
 * Tests the new V6 HTML-to-PDF pipeline with Puppeteer
 */

const { generateV6PdfWithPuppeteer } = require('./services/puppeteerPdfRenderer');
const fs = require('fs');
const path = require('path');

async function testPuppeteerPdf() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  PUPPETEER PDF TEST - V6 HTML Template Rendering');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const symbol = 'AAPL';
  const language = 'en';
  const firmName = 'Test Research';
  const analystName = 'Test Analyst';
  
  console.log(`📊 Testing PDF generation for ${symbol}...`);
  console.log(`   Firm: ${firmName}`);
  console.log(`   Analyst: ${analystName}\n`);
  
  const startTime = Date.now();
  
  try {
    const pdfBuffer = await generateV6PdfWithPuppeteer(symbol, language, {
      firmName,
      analystName,
      assetType: 'equity'
    });
    
    const duration = Date.now() - startTime;
    const outputPath = path.join(__dirname, `test_${symbol}_puppeteer.pdf`);
    
    fs.writeFileSync(outputPath, pdfBuffer);
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  TEST RESULTS');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`✅ PDF Generated Successfully!`);
    console.log(`   ├─ Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`   ├─ Duration: ${duration}ms`);
    console.log(`   └─ Saved to: ${outputPath}`);
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    return true;
    
  } catch (error) {
    console.error('\n═══════════════════════════════════════════════════════════════');
    console.error('  TEST FAILED');
    console.error('═══════════════════════════════════════════════════════════════');
    console.error(`❌ Error: ${error.message}`);
    console.error(`   Stack: ${error.stack?.substring(0, 500)}`);
    console.error('═══════════════════════════════════════════════════════════════\n');
    
    return false;
  }
}

testPuppeteerPdf()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });
