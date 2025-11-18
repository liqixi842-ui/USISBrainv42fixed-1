const { callOpenAI } = require('../aiService');
const styleEngine = require('./styleEngine');
const sentenceEngine = require('./sentenceEngine');
const { cleanText } = require('./textCleanerEngine');

async function generateThesis(report) {
  // 🆕 v5.1: Use industry-specific guidance
  const industryContext = report._industryContext || { industry: 'unknown', focus: [], metrics: [], tone: 'balanced' };
  const industryNote = industryContext.industry !== 'unknown'
    ? `\n**Industry Context:** ${industryContext.industry}\n**Focus Areas:** ${industryContext.focus.join(', ')}\n**Key Metrics:** ${industryContext.metrics.join(', ')}\n`
    : '';
  
  const prompt = `You are a Morgan Stanley equity analyst writing an investment thesis for ${report.symbol}.

Company: ${report.company_name || report.symbol}
Sector: ${report.sector || 'N/A'}
Price: $${report.price?.last || 'N/A'}
Target: $${report.targets?.base?.price || 'N/A'} (${report.targets?.base?.upside_pct || 'N/A'}% upside)
Rating: ${report.rating || 'N/A'}${industryNote}

Financial Data:
- Revenue: ${report.fundamentals?.revenue ? `$${(report.fundamentals.revenue / 1e9).toFixed(1)}B` : 'N/A'}
- EPS: $${report.fundamentals?.eps || 'N/A'}
- ROE: ${report.fundamentals?.roe || 'N/A'}%
- PE: ${report.valuation?.pe_ttm || 'N/A'}x
- Margin: ${report.fundamentals?.profit_margin || 'N/A'}%

Write a 800-900 word institutional investment thesis with:

**Structure:**
1. Core Investment Rationale (200 words)
   - Lead with strongest bull case
   - Quantify opportunity size
   - State conviction level

2. Competitive Position (300 words)
   - Market leadership metrics
   - Structural advantages
   - Barriers to entry

3. Financial Framework (300 words)
   - Margin trajectory
   - Capital efficiency
   - Cash generation

**Requirements:**
- Use sell-side language: "We believe", "Our analysis suggests", "We project"
- Include specific numbers and timeframes
- **PROHIBITED WORDS**: exciting, amazing, poised to, well-positioned, compelling, attractive, robust
- **REQUIRED**: Every claim must cite a specific metric, percentage, or dollar figure
- 3 subheaders minimum
- Tone: ${industryContext.tone} (Morgan Stanley style)${industryContext.focus.length > 0 ? `\n- MUST address these industry-specific factors: ${industryContext.focus.join(', ')}` : ''}${industryContext.metrics.length > 0 ? `\n- Prioritize these metrics: ${industryContext.metrics.slice(0,4).join(', ')}` : ''}

Thesis:`;

  try {
    const response = await callOpenAI([
      { role: 'system', content: 'You are a senior sell-side equity analyst at Morgan Stanley. Write institutional-grade investment theses.' },
      { role: 'user', content: prompt }
    ], {
      model: 'gpt-4o',
      max_tokens: 1500,
      temperature: 0.4
    });
    
    let thesis = response.trim();
    
    // Apply style and sentence normalization
    thesis = styleEngine.applyStyle(thesis);
    thesis = sentenceEngine.normalize(thesis);
    
    // Apply text cleaning (remove duplicate words, AI clichés)
    thesis = cleanText(thesis);
    
    console.log(`[WriterStockV3] Thesis generated: ${thesis.length} chars`);
    return thesis;
    
  } catch (error) {
    console.error('[WriterStockV3] Thesis generation failed:', error.message);
    return report.investment_thesis || report.summary_text || '';
  }
}

async function generateOverview(report) {
  // 🔧 Critical Fix: 使用统一的 segment 数据源（避免文本和表格矛盾）
  const segments = report.segments && report.segments.length > 0
    ? report.segments.map(s => `${s.name}: ${s.revenue_pct}% revenue`).join(', ')
    : 'Segment data pending';
  
  // 🆕 v5.1: Use industry-specific guidance
  const industryContext = report._industryContext || { industry: 'unknown', focus: [], metrics: [], tone: 'balanced' };
  const industryNote = industryContext.industry !== 'unknown'
    ? `\nIndustry: ${industryContext.industry} (Focus: ${industryContext.focus.slice(0,3).join(', ')})`
    : '';

  const prompt = `You are a Goldman Sachs equity analyst writing a company overview for ${report.symbol}.

Company: ${report.company_name || report.symbol}
Business Model: ${report.business_model || 'Multi-segment technology company'}
Segments: ${segments}${industryNote}

Financial Profile:
- Market Cap: $${report.valuation?.market_cap ? (report.valuation.market_cap / 1e9).toFixed(1) + 'B' : 'N/A'}
- Revenue: $${report.fundamentals?.revenue ? (report.fundamentals.revenue / 1e9).toFixed(1) + 'B' : 'N/A'}
- EBITDA Margin: ${report.fundamentals?.ebitda_margin || 'N/A'}%
- ROE: ${report.fundamentals?.roe || 'N/A'}%

Write a 900 word company overview with segment breakdown:

**CRITICAL**: When discussing business segments, you MUST use the EXACT percentages provided in the "Segments" data above. Do NOT make up different percentages. This ensures consistency with the data table.

**Structure:**
1. Business Overview (250 words)
   - Core operations
   - Revenue model
   - Geographic footprint

2. Segment Analysis (400 words)
   - For each segment, state the EXACT percentage from the data above
   - Margin and growth drivers
   - DO NOT use phrases like "approximately" or "roughly" - use the exact numbers provided

3. Operational Excellence (250 words)
   - Execution track record
   - Management quality
   - Capital allocation discipline

**Requirements:**
- Sell-side institutional tone: "We note", "Our analysis shows", "Management reports"
- Quantify each segment's contribution with exact percentages
- **PROHIBITED**: exciting, innovative, leading, cutting-edge, state-of-the-art
- **REQUIRED**: Cite revenue mix, margin data, growth rates for each segment
- No marketing language or superlatives

Overview:`;

  try {
    const response = await callOpenAI([
      { role: 'system', content: 'You are a senior sell-side equity analyst at Goldman Sachs. Write institutional-grade company overviews.' },
      { role: 'user', content: prompt }
    ], {
      model: 'gpt-4o',
      max_tokens: 1500,
      temperature: 0.4
    });
    
    let overview = response.trim();
    overview = styleEngine.applyStyle(overview);
    overview = sentenceEngine.normalize(overview);
    overview = cleanText(overview);
    
    console.log(`[WriterStockV3] Overview generated: ${overview.length} chars`);
    return overview;
    
  } catch (error) {
    console.error('[WriterStockV3] Overview generation failed:', error.message);
    return report.company_overview || report.segment_text || '';
  }
}

async function generateValuation(report) {
  // 🆕 v5.1: Use industry-specific metrics
  const industryContext = report._industryContext || { industry: 'unknown', focus: [], metrics: [], tone: 'balanced' };
  const metricsNote = industryContext.metrics.length > 0
    ? `\n**Industry-Specific Metrics:** ${industryContext.metrics.join(', ')}`
    : '';
  
  const prompt = `You are a J.P. Morgan equity analyst writing valuation analysis for ${report.symbol}.

Current Valuation:
- Price: $${report.price?.last || 'N/A'}
- Target: $${report.targets?.base?.price || 'N/A'}
- PE (TTM): ${report.valuation?.pe_ttm || 'N/A'}x
- PE (Fwd): ${report.valuation?.pe_forward || 'N/A'}x
- EV/EBITDA: ${report.valuation?.ev_ebitda || 'N/A'}x
- P/S: ${report.valuation?.ps_ttm || 'N/A'}x${metricsNote}

Peers:
${report.peers && report.peers.length > 0 ? report.peers.slice(0, 3).map(p => `${p.symbol}: PE ${p.pe_forward}x, P/S ${p.ps_ttm}x`).join(', ') : 'Peer data pending'}

Write 700 word valuation analysis:

**Structure:**
1. Valuation Framework (250 words)
   - Multiple-based approach (PE, EV/EBITDA, P/S)
   - DCF summary
   - Relative to peers

2. Target Price Derivation (250 words)
   - Base case assumptions
   - Key value drivers
   - Sensitivities

3. Scenario Analysis (200 words)
   - Bull case (assumptions + target)
   - Bear case (assumptions + target)
   - Probability weighting

**Requirements:**
- Institutional sell-side language: "We value the stock at", "Our target implies", "We derive"
- Cite specific numbers, multiples, and percentile ranks
- Compare to peer median/quartiles with exact figures
- **PROHIBITED PHRASES** (use alternatives):
  * ❌ "constructive" → ✅ "fair value $X represents Y% upside"
  * ❌ "supportive" → ✅ "trades at Z% discount to peers"
  * ❌ "attractive" → ✅ "valuation at Xth percentile"
  * ❌ "compelling" → ✅ "implies X% IRR vs. Y% WACC"
  * ❌ "well-positioned" → ✅ "commands premium given [specific reason]"
- Every valuation claim must cite a specific multiple or calculation

Valuation:`;

  try {
    const response = await callOpenAI([
      { role: 'system', content: 'You are a senior sell-side equity analyst at J.P. Morgan. Write institutional-grade valuation analysis.' },
      { role: 'user', content: prompt }
    ], {
      model: 'gpt-4o',
      max_tokens: 1200,
      temperature: 0.4
    });
    
    let valuation = response.trim();
    valuation = styleEngine.applyStyle(valuation);
    valuation = sentenceEngine.normalize(valuation);
    valuation = cleanText(valuation);
    
    console.log(`[WriterStockV3] Valuation generated: ${valuation.length} chars`);
    return valuation;
    
  } catch (error) {
    console.error('[WriterStockV3] Valuation generation failed:', error.message);
    return report.valuation_text || '';
  }
}

async function generateIndustry(report) {
  const prompt = `You are a Barclays equity analyst writing industry analysis for ${report.symbol} in ${report.sector || 'Technology'} sector.

Industry Context:
- Sector: ${report.sector || 'Technology'}
- Industry Growth: ${report.industry?.growth_rate || 'N/A'}%
- TAM: ${report.industry?.tam ? `$${(report.industry.tam / 1e9).toFixed(0)}B` : 'Multi-billion dollar opportunity'}

Write 600 word industry analysis:

**Structure:**
1. Industry Dynamics (200 words)
   - TAM and growth trajectory
   - Key secular trends
   - Technology disruption

2. Competitive Landscape (250 words)
   - Market structure
   - Leading players
   - Share shifts

3. Industry Outlook (150 words)
   - 12-24 month catalysts
   - Regulatory developments
   - Technology inflections

**Requirements:**
- Institutional tone
- Quantify market sizes
- "We see", "Industry checks indicate"
- No generic statements

Industry Analysis:`;

  try {
    const response = await callOpenAI([
      { role: 'system', content: 'You are a senior sell-side equity analyst at Barclays. Write institutional-grade industry analysis.' },
      { role: 'user', content: prompt }
    ], {
      model: 'gpt-4o',
      max_tokens: 1000,
      temperature: 0.4
    });
    
    let industry = response.trim();
    industry = styleEngine.applyStyle(industry);
    industry = sentenceEngine.normalize(industry);
    industry = cleanText(industry);
    
    console.log(`[WriterStockV3] Industry generated: ${industry.length} chars`);
    return industry;
    
  } catch (error) {
    console.error('[WriterStockV3] Industry generation failed:', error.message);
    return report.industry_text || '';
  }
}

async function generateMacro(report) {
  const prompt = `You are a Citi equity analyst writing macro analysis for ${report.symbol}.

Macro Context:
- Fed Policy: Current interest rate environment
- USD Strength: Impact on international revenue
- Economic Growth: GDP trajectory
- Liquidity: Market flows and positioning

Write 600 word macro analysis:

**Structure:**
1. Macro Backdrop (200 words)
   - Interest rate sensitivity
   - FX exposure
   - Economic cycle positioning

2. Policy Implications (200 words)
   - Fed policy impact
   - Fiscal considerations
   - Trade policy

3. Market Technical (200 words)
   - Positioning and flows
   - Volatility regime
   - Liquidity conditions

**Requirements:**
- Sell-side institutional language
- Link macro to stock-specific impact
- "We believe macro provides", "Rate trajectory suggests"
- Quantify sensitivities

Macro Analysis:`;

  try {
    const response = await callOpenAI([
      { role: 'system', content: 'You are a senior sell-side equity analyst at Citi. Write institutional-grade macro analysis.' },
      { role: 'user', content: prompt }
    ], {
      model: 'gpt-4o',
      max_tokens: 1000,
      temperature: 0.4
    });
    
    let macro = response.trim();
    macro = styleEngine.applyStyle(macro);
    macro = sentenceEngine.normalize(macro);
    macro = cleanText(macro);
    
    console.log(`[WriterStockV3] Macro generated: ${macro.length} chars`);
    return macro;
    
  } catch (error) {
    console.error('[WriterStockV3] Macro generation failed:', error.message);
    return report.macro_text || '';
  }
}

/**
 * Enhance report with v5.1 industry-aware prompts
 * @param {Object} report - Base report
 * @param {Object} v5Options - { industry, language, symbolMetadata }
 */
async function enhanceReport(report, v5Options = {}) {
  const { industry = 'unknown', language = 'en', symbolMetadata = {} } = v5Options;
  
  // 🆕 v5.1: Get industry-specific prompt guidance
  const { getIndustryPromptGuidance } = require('../industryClassifier');
  const industryGuidance = getIndustryPromptGuidance(industry);
  
  console.log(`\n════════════════════════════════════════════════════════════════`);
  console.log(`[WriterStockV3] Enhancing ${report.symbol} with 5-Engine Framework`);
  console.log(`  Industry: ${industry} | Language: ${language}`);
  console.log(`════════════════════════════════════════════════════════════════\n`);
  
  const startTime = Date.now();
  
  // 🆕 v5.1: Augment report with industry context
  report._industryContext = {
    industry,
    focus: industryGuidance.focus,
    metrics: industryGuidance.metrics,
    tone: industryGuidance.tone
  };
  
  // Generate all 5 sections in parallel
  const [thesis, overview, valuation, industry_text, macro] = await Promise.all([
    generateThesis(report),
    generateOverview(report),
    generateValuation(report),
    generateIndustry(report),
    generateMacro(report)
  ]);
  
  const elapsed = Date.now() - startTime;
  
  // Update report with enhanced content
  report.thesis_enhanced = thesis;
  report.overview_enhanced = overview;
  report.valuation_enhanced = valuation;
  report.industry_enhanced = industry_text;
  report.macro_enhanced = macro;
  
  console.log(`\n[WriterStockV3] Enhancement complete in ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`  ├─ Thesis: ${thesis.length} chars`);
  console.log(`  ├─ Overview: ${overview.length} chars`);
  console.log(`  ├─ Valuation: ${valuation.length} chars`);
  console.log(`  ├─ Industry: ${industry.length} chars`);
  console.log(`  └─ Macro: ${macro.length} chars\n`);
  
  return report;
}

module.exports = {
  enhanceReport,
  generateThesis,
  generateOverview,
  generateValuation,
  generateIndustry,
  generateMacro
};
