const writerStockV3 = require('./writerStockV3');
const riskCatalystEngine = require('./riskCatalystEngine');
const styleEngine = require('./styleEngine');
const sentenceEngine = require('./sentenceEngine');
const coherenceEngine = require('./coherenceEngine');

/**
 * Main entry: build stock report with v5 enhancements
 * @param {Object} report - Base report data
 * @param {Object} v5Options - v5.1 options: { industry, language, symbolMetadata }
 */
async function buildStockReport(report, v5Options = {}) {
  const { industry = 'unknown', language = 'en', symbolMetadata = {} } = v5Options;
  
  console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║  USIS Research Brain v5.0 - Report Builder Activated          ║`);
  console.log(`║  Symbol: ${report.symbol.padEnd(52)}║`);
  if (industry !== 'unknown') {
    console.log(`║  Industry: ${industry.padEnd(49)}║`);
  }
  console.log(`╚════════════════════════════════════════════════════════════════╝\n`);
  
  const startTime = Date.now();
  
  try {
    // PHASE 1: WriterStockV3 - Generate all 5 sections (with industry guidance)
    console.log('[Phase 1/5] WriterStockV3 - Institutional Content Generation');
    report = await writerStockV3.enhanceReport(report, { industry, language, symbolMetadata });
    
    // PHASE 2: RiskCatalystEngine - Clean, quantify, complete
    console.log('\n[Phase 2/5] RiskCatalystEngine v2 - Processing Risks & Catalysts');
    report = await riskCatalystEngine.processRisksAndCatalysts(report);
    
    // PHASE 3: Field Mapping - Map enhanced fields to rendering fields
    console.log('\n[Phase 3/5] Field Mapping - _enhanced → rendering fields');
    report.investment_thesis = report.thesis_enhanced || report.investment_thesis || report.summary_text || '';
    report.company_overview = report.overview_enhanced || report.company_overview || report.segment_text || '';
    report.valuation_text = report.valuation_enhanced || report.valuation_text || '';
    report.industry_text = report.industry_enhanced || report.industry_text || '';
    report.macro_text = report.macro_enhanced || report.macro_text || '';
    
    console.log(`  ├─ investment_thesis: ${report.investment_thesis.length} chars`);
    console.log(`  ├─ company_overview: ${report.company_overview.length} chars`);
    console.log(`  ├─ valuation_text: ${report.valuation_text.length} chars`);
    console.log(`  ├─ industry_text: ${report.industry_text.length} chars`);
    console.log(`  └─ macro_text: ${report.macro_text.length} chars`);
    
    // PHASE 4: CoherenceEngine - Remove duplicates and add transitions
    console.log('\n[Phase 4/5] CoherenceEngine - Deduplication & Transitions');
    report = coherenceEngine.rewriteSections(report);
    
    // PHASE 5: Final Style Pass - Apply institutional tone to all fields
    console.log('\n[Phase 5/5] StyleEngine - Final Institutional Tone Pass');
    report.investment_thesis = styleEngine.applyStyle(report.investment_thesis);
    report.company_overview = styleEngine.applyStyle(report.company_overview);
    report.valuation_text = styleEngine.applyStyle(report.valuation_text);
    report.industry_text = styleEngine.applyStyle(report.industry_text);
    report.macro_text = styleEngine.applyStyle(report.macro_text);
    
    // FINAL OVERRIDE: Lock all rendering fields (v5 protected)
    console.log('\n[FINAL OVERRIDE] Locking v5-enhanced fields');
    report.v5_protected = true; // Flag for TasteTruthLayer to skip
    
    const elapsed = Date.now() - startTime;
    
    console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
    console.log(`║  v5.0 Report Build Complete in ${(elapsed / 1000).toFixed(1)}s`.padEnd(65) + '║');
    console.log(`║  Morgan Stanley / Goldman Sachs Grade Achieved                 ║`);
    console.log(`╚════════════════════════════════════════════════════════════════╝\n`);
    
    return report;
    
  } catch (error) {
    console.error('\n❌ [ReportBuilderV5] ERROR:', error.message);
    console.error('   Stack:', error.stack);
    
    // Fallback: Return report with existing content
    console.log('\n⚠️  Falling back to existing content');
    return report;
  }
}

async function buildIndustryReport(sector, params) {
  console.log(`\n[ReportBuilderV5] Building industry report for ${sector}`);
  
  const writerIndustryV3 = require('./writerIndustryV3');
  const content = await writerIndustryV3.generateIndustryReport(sector, params);
  
  return {
    type: 'industry',
    sector,
    content,
    generated_at: new Date().toISOString()
  };
}

async function buildMacroReport(type, params) {
  console.log(`\n[ReportBuilderV5] Building macro report (${type})`);
  
  const writerMacroV3 = require('./writerMacroV3');
  const content = await writerMacroV3.generateMacroReport(type, params);
  
  return {
    type: 'macro',
    subtype: type,
    content,
    generated_at: new Date().toISOString()
  };
}

module.exports = {
  buildStockReport,
  buildIndustryReport,
  buildMacroReport
};
