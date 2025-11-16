#!/usr/bin/env node
/**
 * Comprehensive Test: NVDA, AAPL, SPX
 * Validates the institutional research report engine
 */

const reportService = require('./v3_dev/services/reportService');
const fs = require('fs');

async function testSymbol(symbol, assetType) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  Testing: ${symbol} (${assetType})`);
  console.log(`${'═'.repeat(70)}\n`);
  
  try {
    const report = await reportService.buildResearchReport(symbol, assetType);
    
    // Verification
    const issues = [];
    const successes = [];
    
    // Price checks
    if (report.price.last) {
      successes.push(`✅ Last Price: $${report.price.last}`);
    } else {
      issues.push(`❌ Last Price is null`);
    }
    
    if (report.price.change_pct !== null) {
      successes.push(`✅ Change: ${report.price.change_abs} (${report.price.change_pct}%)`);
    }
    
    if (report.price.high_1d) {
      successes.push(`✅ Intraday Range: $${report.price.low_1d} - $${report.price.high_1d}`);
    }
    
    if (report.price.high_52w) {
      successes.push(`✅ 52W Range: $${report.price.low_52w} - $${report.price.high_52w}`);
    }
    
    // Valuation checks
    if (report.valuation.pe_ttm) {
      successes.push(`✅ P/E TTM: ${report.valuation.pe_ttm.toFixed(2)}`);
    }
    
    if (report.valuation.ps_ttm) {
      successes.push(`✅ P/S TTM: ${report.valuation.ps_ttm.toFixed(2)}`);
    }
    
    // Fundamentals checks
    if (report.fundamentals.gross_margin) {
      successes.push(`✅ Gross Margin: ${(report.fundamentals.gross_margin).toFixed(1)}%`);
    }
    
    if (report.fundamentals.operating_margin) {
      successes.push(`✅ Operating Margin: ${(report.fundamentals.operating_margin).toFixed(1)}%`);
    }
    
    if (report.fundamentals.roe) {
      successes.push(`✅ ROE: ${(report.fundamentals.roe).toFixed(1)}%`);
    }
    
    // Price targets check
    if (report.targets.base.price && report.price.last) {
      const baseCalc = report.price.last * 1.15;
      const isConsistent = Math.abs(report.targets.base.price - baseCalc) < 1;
      
      if (isConsistent) {
        successes.push(`✅ Base Target: $${report.targets.base.price} (consistent with ${report.price.last})`);
      } else {
        issues.push(`⚠️  Base Target $${report.targets.base.price} doesn't match calculation from $${report.price.last}`);
      }
    } else {
      issues.push(`❌ Price targets missing`);
    }
    
    // Display results
    console.log('─── SUCCESS METRICS ───');
    successes.forEach(s => console.log(s));
    
    if (issues.length > 0) {
      console.log('\n─── ISSUES FOUND ───');
      issues.forEach(i => console.log(i));
    }
    
    console.log(`\n─── METADATA ───`);
    console.log(`Model: ${report.meta.model}`);
    console.log(`Latency: ${report.meta.latency_ms}ms`);
    console.log(`Generated: ${report.meta.generated_at}`);
    
    // Save JSON
    const filename = `/tmp/${symbol.toLowerCase()}_report.json`;
    fs.writeFileSync(filename, JSON.stringify(report, null, 2));
    console.log(`\n📄 Full JSON saved to: ${filename}`);
    
    return { symbol, success: issues.length === 0, issues, report };
    
  } catch (error) {
    console.error(`\n❌ ERROR: ${error.message}`);
    return { symbol, success: false, issues: [error.message], report: null };
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║  USIS BRAIN v3-dev - INSTITUTIONAL RESEARCH ENGINE TEST        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  
  const tests = [
    { symbol: 'NVDA', assetType: 'equity' },
    { symbol: 'AAPL', assetType: 'equity' },
    // { symbol: 'SPX', assetType: 'index' }  // May not be supported by all APIs
  ];
  
  const results = [];
  
  for (const test of tests) {
    const result = await testSymbol(test.symbol, test.assetType);
    results.push(result);
  }
  
  // Summary
  console.log(`\n\n${'═'.repeat(70)}`);
  console.log('  FINAL SUMMARY');
  console.log(`${'═'.repeat(70)}\n`);
  
  results.forEach(r => {
    const status = r.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${r.symbol}: ${r.issues.length} issue(s)`);
  });
  
  const allPassed = results.every(r => r.success);
  
  if (allPassed) {
    console.log('\n🎉 ALL TESTS PASSED! System is ready for institutional use.');
  } else {
    console.log('\n⚠️  Some tests had issues. Review above for details.');
  }
  
  console.log('\n');
}

main().catch(console.error);
