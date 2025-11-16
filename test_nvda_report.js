#!/usr/bin/env node
/**
 * Test script to fetch NVDA research report
 */

const fetch = require('node-fetch');

async function testNVDAReport() {
  console.log('🧪 Testing NVDA Research Report...\n');
  
  try {
    const url = 'http://localhost:3000/v3/report/NVDA?format=json';
    console.log(`📡 Fetching: ${url}`);
    console.log(`⏳ Please wait (this may take 20-30 seconds)...\n`);
    
    const response = await fetch(url, {
      method: 'GET',
      timeout: 60000
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const report = await response.json();
    
    console.log('✅ Report generated successfully!\n');
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║  NVDA RESEARCH REPORT - KEY DATA                          ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    
    // Display key metrics
    console.log(`Symbol:       ${report.symbol}`);
    console.log(`Name:         ${report.name}`);
    console.log(`Asset Type:   ${report.asset_type}`);
    console.log(`Rating:       ${report.rating}`);
    console.log(`Horizon:      ${report.horizon}\n`);
    
    console.log('─── PRICE DATA ───');
    console.log(`Last Price:   $${report.price.last || 'N/A'}`);
    console.log(`Change:       ${report.price.change_abs || 'N/A'} (${report.price.change_pct || 'N/A'}%)`);
    console.log(`Intraday:     $${report.price.low_1d || 'N/A'} - $${report.price.high_1d || 'N/A'}`);
    console.log(`52W Range:    $${report.price.low_52w || 'N/A'} - $${report.price.high_52w || 'N/A'}\n`);
    
    console.log('─── VALUATION ───');
    console.log(`Market Cap:   $${report.valuation.market_cap ? (report.valuation.market_cap / 1e9).toFixed(1) + 'B' : 'N/A'}`);
    console.log(`P/E TTM:      ${report.valuation.pe_ttm || 'N/A'}`);
    console.log(`P/E Forward:  ${report.valuation.pe_forward || 'N/A'}`);
    console.log(`P/S TTM:      ${report.valuation.ps_ttm || 'N/A'}`);
    console.log(`P/B:          ${report.valuation.pb || 'N/A'}`);
    console.log(`Div Yield:    ${report.valuation.dividend_yield ? (report.valuation.dividend_yield * 100).toFixed(2) + '%' : 'N/A'}\n`);
    
    console.log('─── FUNDAMENTALS ───');
    console.log(`Gross Margin:     ${report.fundamentals.gross_margin ? (report.fundamentals.gross_margin * 100).toFixed(1) + '%' : 'N/A'}`);
    console.log(`Operating Margin: ${report.fundamentals.operating_margin ? (report.fundamentals.operating_margin * 100).toFixed(1) + '%' : 'N/A'}`);
    console.log(`Net Margin:       ${report.fundamentals.net_margin ? (report.fundamentals.net_margin * 100).toFixed(1) + '%' : 'N/A'}`);
    console.log(`ROE:              ${report.fundamentals.roe ? (report.fundamentals.roe * 100).toFixed(1) + '%' : 'N/A'}`);
    console.log(`ROA:              ${report.fundamentals.roa ? (report.fundamentals.roa * 100).toFixed(1) + '%' : 'N/A'}\n`);
    
    console.log('─── PRICE TARGETS ───');
    console.log(`Base Case:  $${report.targets.base.price || 'N/A'} (+${report.targets.base.upside_pct || 'N/A'}%, ${report.targets.base.horizon || 'N/A'})`);
    console.log(`Bull Case:  $${report.targets.bull.price || 'N/A'} (+${report.targets.bull.upside_pct || 'N/A'}%)`);
    console.log(`Bear Case:  $${report.targets.bear.price || 'N/A'} (${report.targets.bear.downside_pct || 'N/A'}%)\n`);
    
    console.log('─── METADATA ───');
    console.log(`Model:       ${report.meta.model}`);
    console.log(`Generated:   ${report.meta.generated_at}`);
    console.log(`Latency:     ${report.meta.latency_ms}ms\n`);
    
    console.log('✅ All data points retrieved successfully!\n');
    
    // Save full JSON
    const fs = require('fs');
    fs.writeFileSync('/tmp/nvda_report.json', JSON.stringify(report, null, 2));
    console.log('📄 Full JSON saved to: /tmp/nvda_report.json\n');
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

testNVDAReport();
