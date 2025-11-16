#!/usr/bin/env node
/**
 * Test reportService buildResearchReport function
 */

const reportService = require('./v3_dev/services/reportService');

async function testReportService() {
  console.log('🧪 Testing Research Report Service for NVDA...\n');
  
  try {
    const report = await reportService.buildResearchReport('NVDA', 'equity');
    
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║  NVDA RESEARCH REPORT - VERIFICATION                      ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    
    console.log('─── PRICE DATA (Should be REAL values, not N/A) ───');
    console.log(`Last Price:     $${report.price.last || 'N/A'}`);
    console.log(`Change:         ${report.price.change_abs || 'N/A'} (${report.price.change_pct || 'N/A'}%)`);
    console.log(`Intraday High:  $${report.price.high_1d || 'N/A'}`);
    console.log(`Intraday Low:   $${report.price.low_1d || 'N/A'}`);
    console.log(`52W High:       $${report.price.high_52w || 'N/A'}`);
    console.log(`52W Low:        $${report.price.low_52w || 'N/A'}\n`);
    
    console.log('─── VALUATION (Should have some real data from Finnhub) ───');
    console.log(`Market Cap:     $${report.valuation.market_cap ? (report.valuation.market_cap / 1e9).toFixed(1) + 'B' : 'N/A'}`);
    console.log(`P/E TTM:        ${report.valuation.pe_ttm || 'N/A'}`);
    console.log(`P/S TTM:        ${report.valuation.ps_ttm || 'N/A'}`);
    console.log(`P/B:            ${report.valuation.pb || 'N/A'}\n`);
    
    console.log('─── PRICE TARGETS (Should be calculated from current price) ───');
    console.log(`Base Case:  $${report.targets.base.price || 'N/A'} (+${report.targets.base.upside_pct || 'N/A'}%)`);
    console.log(`Bull Case:  $${report.targets.bull.price || 'N/A'} (+${report.targets.bull.upside_pct || 'N/A'}%)`);
    console.log(`Bear Case:  $${report.targets.bear.price || 'N/A'} (${report.targets.bear.downside_pct || 'N/A'}%)\n`);
    
    // Verification
    const issues = [];
    if (!report.price.last) issues.push('❌ Last price is null');
    if (!report.price.change_pct) issues.push('❌ Change % is null');
    if (!report.price.high_1d) issues.push('❌ Intraday high is null');
    if (!report.targets.base.price) issues.push('❌ Base target is null');
    
    if (issues.length > 0) {
      console.log('⚠️  ISSUES FOUND:');
      issues.forEach(i => console.log(i));
    } else {
      console.log('✅ SUCCESS! All critical fields have real data!');
    }
    
    console.log(`\n📊 Model used: ${report.meta.model}`);
    console.log(`⏱️  Latency: ${report.meta.latency_ms}ms\n`);
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
  }
}

testReportService();
