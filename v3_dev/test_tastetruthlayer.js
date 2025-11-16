/**
 * Test TasteTruthLayer Integration
 * 
 * Verifies that TasteTruthLayer is properly integrated into v3-dev report pipeline
 */

const { buildResearchReport } = require('./services/reportService.js');

async function testTasteTruthLayer() {
  console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║  TasteTruthLayer Integration Test - NVDA                      ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝\n`);
  
  try {
    const symbol = 'NVDA';
    const assetType = 'equity';
    
    console.log(`🧪 [Test] Generating research report for ${symbol}...`);
    console.log(`   └─ TasteTruthLayer should automatically process content\n`);
    
    const startTime = Date.now();
    const report = await buildResearchReport(symbol, assetType);
    const totalTime = Date.now() - startTime;
    
    console.log(`\n✅ [Test] Report generated successfully in ${totalTime}ms`);
    console.log(`\n📋 [Test Results]`);
    console.log(`   ├─ Symbol: ${report.symbol}`);
    console.log(`   ├─ Name: ${report.name}`);
    console.log(`   ├─ Rating: ${report.rating}`);
    console.log(`   ├─ Version: ${report.meta.version}`);
    console.log(`   ├─ Model: ${report.meta.model}`);
    console.log(`   └─ Total Latency: ${report.meta.latency_ms}ms`);
    
    console.log(`\n📝 [Narrative Text Verification]`);
    console.log(`   ├─ Summary: ${report.summary_text ? report.summary_text.substring(0, 100) + '...' : 'MISSING'}`);
    console.log(`   ├─ Thesis: ${report.thesis_text ? report.thesis_text.substring(0, 100) + '...' : 'MISSING'}`);
    console.log(`   ├─ Valuation: ${report.valuation_text ? report.valuation_text.substring(0, 100) + '...' : 'MISSING'}`);
    console.log(`   ├─ Catalysts: ${Array.isArray(report.catalysts_text) ? report.catalysts_text.length + ' items' : 'INVALID'}`);
    console.log(`   ├─ Risks: ${Array.isArray(report.risks_text) ? report.risks_text.length + ' items' : 'INVALID'}`);
    console.log(`   ├─ Technical: ${report.tech_view_text ? report.tech_view_text.substring(0, 100) + '...' : 'MISSING'}`);
    console.log(`   └─ Action: ${report.action_text ? report.action_text.substring(0, 100) + '...' : 'MISSING'}`);
    
    // Check for hallucination removal
    console.log(`\n🔍 [Content Quality Checks]`);
    
    const allText = JSON.stringify(report);
    
    // Check 1: No ARM acquisition mentions
    const hasARM = /ARM acquisition|Arm acquisition/i.test(allText);
    console.log(`   ├─ ARM acquisition mentions: ${hasARM ? '❌ FOUND (should be removed)' : '✅ NONE'}`);
    
    // Check 2: No specific Q/year dates (2022-2025)
    const hasSpecificDates = /Q[1-4] 202[2-5]|FY 202[2-5]/i.test(allText);
    console.log(`   ├─ Specific quarter/year dates: ${hasSpecificDates ? '❌ FOUND (should be removed)' : '✅ NONE'}`);
    
    // Check 3: No metaverse mentions
    const hasMetaverse = /metaverse/i.test(allText);
    console.log(`   ├─ Metaverse mentions: ${hasMetaverse ? '❌ FOUND (should be removed)' : '✅ NONE'}`);
    
    // Check 4: Institutional tone (no "huge", "massive", "rapidly")
    const narrativeText = report.summary_text + report.thesis_text + report.action_text;
    const hasGenericWords = /\b(huge|massive)\b/i.test(narrativeText);
    console.log(`   ├─ AI-generic words (huge/massive): ${hasGenericWords ? '❌ FOUND (should be replaced)' : '✅ NONE'}`);
    
    // Check 5: Professional qualifiers instead of absolutes
    const hasAbsolutes = /\bwill definitely\b|\bguaranteed to\b/i.test(narrativeText);
    console.log(`   ├─ Absolute phrases: ${hasAbsolutes ? '❌ FOUND (should be replaced)' : '✅ NONE'}`);
    
    // Check 6: Catalysts count (should be 6-8)
    const catalystsCount = Array.isArray(report.catalysts_text) ? report.catalysts_text.length : 0;
    const catalystsOK = catalystsCount >= 6 && catalystsCount <= 8;
    console.log(`   ├─ Catalysts count: ${catalystsCount} ${catalystsOK ? '✅' : '❌ (should be 6-8)'}`);
    
    // Check 7: Risks count (should be 6-8)
    const risksCount = Array.isArray(report.risks_text) ? report.risks_text.length : 0;
    const risksOK = risksCount >= 6 && risksCount <= 8;
    console.log(`   ├─ Risks count: ${risksCount} ${risksOK ? '✅' : '❌ (should be 6-8)'}`);
    
    // Check 8: No placeholder content
    const hasPlaceholders = /\b(N\/A|TBD|Placeholder|Coming soon)\b/i.test(allText);
    console.log(`   └─ Placeholder content: ${hasPlaceholders ? '❌ FOUND (should be removed)' : '✅ NONE'}`);
    
    console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
    console.log(`║  ✅ TasteTruthLayer Integration Test Complete                  ║`);
    console.log(`╚════════════════════════════════════════════════════════════════╝\n`);
    
    // Summary
    const allChecks = [
      !hasARM,
      !hasSpecificDates,
      !hasMetaverse,
      !hasGenericWords,
      !hasAbsolutes,
      catalystsOK,
      risksOK,
      !hasPlaceholders
    ];
    
    const passedChecks = allChecks.filter(check => check).length;
    const totalChecks = allChecks.length;
    
    console.log(`\n📊 Final Score: ${passedChecks}/${totalChecks} checks passed`);
    
    if (passedChecks === totalChecks) {
      console.log(`\n✅ ALL CHECKS PASSED - TasteTruthLayer is working correctly!\n`);
    } else {
      console.log(`\n⚠️  ${totalChecks - passedChecks} check(s) failed - Review TasteTruthLayer configuration\n`);
    }
    
  } catch (error) {
    console.error(`\n❌ [Test] Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run test
testTasteTruthLayer();
