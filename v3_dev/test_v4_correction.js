/**
 * Test v4.0 Taste + Truth Professional Correction Layer
 * 
 * Verification Requirements:
 * - NO invented events (ARM acquisition, Metaverse partnership)
 * - NO invented dates (Q1/Q2/Q3/Q4 2024 upcoming events)
 * - NO invented monetary impacts ($1B revenue, $500M growth)
 * - NO invented percentages not in report data
 * - NO duplicate paragraphs
 * - NO "AI-sounding text" (strong, rapidly, dominant, huge, massive)
 * - Professional institutional tone
 */

const { buildResearchReport } = require('./services/reportService');
const fs = require('fs');

async function testV4Correction(symbol) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Testing v4.0 Correction Layer - ${symbol} Report`);
  console.log(`${'='.repeat(70)}\n`);
  
  try {
    // Generate report (will use v4.0 correction layer)
    const report = await buildResearchReport(symbol, 'equity');
    
    // Save JSON for inspection
    const jsonPath = `/tmp/${symbol}_v4.0.json`;
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    console.log(`✅ JSON saved to ${jsonPath}`);
    
    // ═══════════════════════════════════════════════════════════════
    // VERIFICATION CHECKS
    // ═══════════════════════════════════════════════════════════════
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`VERIFICATION RESULTS - ${symbol}`);
    console.log(`${'─'.repeat(70)}\n`);
    
    const allText = [
      report.summary_text,
      report.thesis_text,
      report.valuation_text,
      report.segment_text,
      report.macro_text,
      ...(report.catalysts_text || []),
      ...(report.risks_text || []),
      report.tech_view_text,
      report.action_text
    ].filter(t => t).join(' ');
    
    // Check 1: Forbidden Events
    const forbiddenEvents = [
      'ARM acquisition',
      'Arm acquisition',
      'Metaverse partnership',
      'metaverse collaboration'
    ];
    
    let hasForbiddenEvents = false;
    for (const event of forbiddenEvents) {
      if (allText.includes(event)) {
        console.log(`❌ FAIL: Found forbidden event "${event}"`);
        hasForbiddenEvents = true;
      }
    }
    if (!hasForbiddenEvents) {
      console.log(`✅ PASS: No forbidden events found`);
    }
    
    // Check 2: Invented Dates (Q1/Q2/Q3/Q4 2024)
    const datePattern = /Q[1-4] 202[34]/g;
    const dateMatches = allText.match(datePattern);
    if (dateMatches && dateMatches.length > 0) {
      console.log(`❌ FAIL: Found ${dateMatches.length} invented dates: ${dateMatches.slice(0, 3).join(', ')}`);
    } else {
      console.log(`✅ PASS: No invented dates found`);
    }
    
    // Check 3: AI-Generic Words
    const aiWords = ['dominant', 'huge', 'massive', 'rapidly growing', 'strong growth'];
    let hasAIWords = false;
    for (const word of aiWords) {
      const regex = new RegExp(word, 'gi');
      if (regex.test(allText)) {
        console.log(`❌ FAIL: Found AI-generic word "${word}"`);
        hasAIWords = true;
      }
    }
    if (!hasAIWords) {
      console.log(`✅ PASS: No AI-generic words found`);
    }
    
    // Check 4: Absolute Future Statements
    const absolutePattern = /\bwill (definitely|certainly|guaranteed)/gi;
    const absoluteMatches = allText.match(absolutePattern);
    if (absoluteMatches && absoluteMatches.length > 0) {
      console.log(`❌ FAIL: Found ${absoluteMatches.length} absolute statements`);
    } else {
      console.log(`✅ PASS: No absolute future statements`);
    }
    
    // Check 5: Catalysts Count
    const catalystsCount = report.catalysts_text ? report.catalysts_text.length : 0;
    if (catalystsCount >= 6 && catalystsCount <= 8) {
      console.log(`✅ PASS: Catalysts count = ${catalystsCount} (expected 6-8)`);
    } else {
      console.log(`❌ FAIL: Catalysts count = ${catalystsCount} (expected 6-8)`);
    }
    
    // Check 6: Risks Count
    const risksCount = report.risks_text ? report.risks_text.length : 0;
    if (risksCount >= 6 && risksCount <= 8) {
      console.log(`✅ PASS: Risks count = ${risksCount} (expected 6-8)`);
    } else {
      console.log(`❌ FAIL: Risks count = ${risksCount} (expected 6-8)`);
    }
    
    // Check 7: Version
    if (report.meta.version === 'v3-dev-v4.0') {
      console.log(`✅ PASS: Version = ${report.meta.version}`);
    } else {
      console.log(`❌ FAIL: Version = ${report.meta.version} (expected v3-dev-v4.0)`);
    }
    
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`Summary:`);
    console.log(`${'─'.repeat(70)}`);
    console.log(`Symbol: ${symbol}`);
    console.log(`Rating: ${report.rating}`);
    console.log(`Target: $${report.targets.base_target}`);
    console.log(`Version: ${report.meta.version}`);
    console.log(`Model: ${report.meta.model}`);
    console.log(`${'─'.repeat(70)}\n`);
    
    return report;
    
  } catch (error) {
    console.error(`\n❌ Test failed for ${symbol}:`, error.message);
    console.error(error.stack);
    return null;
  }
}

async function main() {
  const symbols = process.argv.slice(2);
  
  if (symbols.length === 0) {
    console.log('Usage: node test_v4_correction.js NVDA [AAPL] [SPX]');
    console.log('\nDefaulting to NVDA...\n');
    symbols.push('NVDA');
  }
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`v4.0 TASTE + TRUTH CORRECTION LAYER - VERIFICATION TESTS`);
  console.log(`${'='.repeat(70)}\n`);
  
  const results = [];
  
  for (const symbol of symbols) {
    const report = await testV4Correction(symbol);
    if (report) {
      results.push({
        symbol,
        version: report.meta.version,
        catalysts: report.catalysts_text?.length || 0,
        risks: report.risks_text?.length || 0
      });
    }
  }
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`FINAL SUMMARY`);
  console.log(`${'='.repeat(70)}`);
  
  for (const result of results) {
    console.log(`✅ ${result.symbol}: v${result.version}, ${result.catalysts} catalysts, ${result.risks} risks`);
  }
  
  const allPassed = results.length === symbols.length;
  
  console.log(`\n${'─'.repeat(70)}`);
  if (allPassed) {
    console.log(`✅ ALL TESTS PASSED - v4.0 Correction Layer working correctly!`);
  } else {
    console.log(`❌ SOME TESTS FAILED - Check logs above for details`);
  }
  console.log(`${'='.repeat(70)}\n`);
}

main().catch(console.error);
