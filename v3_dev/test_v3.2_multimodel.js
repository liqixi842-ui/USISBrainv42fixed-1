/**
 * v3.2 Multi-Model Pipeline Test Script
 * Generates NVDA report using the new multi-model research pipeline
 */

const { buildResearchReport } = require('./services/reportService.js');
const fs = require('fs');

(async () => {
  console.log('\n═════════════════════════════════════════════════════════════');
  console.log('v3.2 Multi-Model Pipeline Test - NVDA Report');
  console.log('═════════════════════════════════════════════════════════════\n');
  
  try {
    // Generate NVDA report using v3.2 multi-model pipeline
    const report = await buildResearchReport('NVDA', 'equity');
    
    // Save JSON output for inspection
    const jsonPath = '/tmp/NVDA_v3.2_report.json';
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`\n✅ NVDA v3.2 report saved to ${jsonPath}`);
    
    // Display multi-model insights
    console.log('\n─────────────────────────────────────────────────────────────');
    console.log('v3.2 Multi-Model Results:');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`Rating: ${report.rating}`);
    console.log(`Target: $${report.targets.base.price} (${report.targets.base.upside_pct}% upside)`);
    console.log(`Models Used: ${report.meta.models_used}`);
    console.log(`AI Latency: ${report.meta.ai_latency_ms}ms`);
    console.log(`Total Latency: ${report.meta.latency_ms}ms`);
    
    console.log('\n─────────────────────────────────────────────────────────────');
    console.log('Specialist Model Outputs:');
    console.log('─────────────────────────────────────────────────────────────');
    
    if (report.multi_model.claude_thesis.error) {
      console.log(`❌ Claude (Industry): ${report.multi_model.claude_thesis.error}`);
    } else {
      console.log(`✅ Claude (Industry): SUCCESS`);
    }
    
    if (report.multi_model.gemini_macro.error) {
      console.log(`❌ Gemini (Macro): ${report.multi_model.gemini_macro.error}`);
    } else {
      console.log(`✅ Gemini (Macro): SUCCESS`);
    }
    
    if (report.multi_model.deepseek_valuation.error) {
      console.log(`❌ DeepSeek (Valuation): ${report.multi_model.deepseek_valuation.error}`);
    } else {
      console.log(`✅ DeepSeek (Valuation): SUCCESS`);
    }
    
    if (report.multi_model.peer_insights.error) {
      console.log(`❌ Mistral (Peers): ${report.multi_model.peer_insights.error}`);
    } else {
      console.log(`✅ Mistral (Peers): SUCCESS`);
    }
    
    console.log(`✅ GPT-4o-mini (Risks): ${report.multi_model.risk_catalyst.catalysts?.length || 0} catalysts, ${report.multi_model.risk_catalyst.risks?.length || 0} risks`);
    
    console.log('\n─────────────────────────────────────────────────────────────');
    console.log('Summary Preview:');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(report.summary_text);
    
    console.log('\n─────────────────────────────────────────────────────────────');
    console.log('Catalysts (First 3):');
    console.log('─────────────────────────────────────────────────────────────');
    report.catalysts_text.slice(0, 3).forEach((cat, i) => {
      console.log(`${i+1}. ${cat}`);
    });
    
    console.log('\n✅ v3.2 Multi-Model Pipeline test complete!');
    console.log(`📁 Full JSON saved to: ${jsonPath}\n`);
    
  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  }
})();
