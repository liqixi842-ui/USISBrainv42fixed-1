const { callOpenAI } = require('../aiService');
const styleEngine = require('./styleEngine');
const sentenceEngine = require('./sentenceEngine');

async function generateIndustryReport(sector, params = {}) {
  const prompt = `You are a Morgan Stanley sector analyst writing an industry deep dive on ${sector}.

Scope: ${params.scope || 'Full sector analysis'}
Time Horizon: ${params.horizon || '12 months'}

Write a 1200 word industry report:

**Structure:**

1. Executive Summary (150 words)
   - TAM and growth outlook
   - Key investment themes
   - Top sector picks

2. Market Structure (300 words)
   - Total addressable market
   - Market segmentation
   - Growth drivers by segment
   - Technology adoption curves

3. Competitive Framework (350 words)
   - Market share analysis
   - Competitive dynamics
   - Barriers to entry
   - Emerging challengers
   - Pricing power

4. Key Catalysts (200 words)
   - Near-term catalysts (0-6 months)
   - Medium-term catalysts (6-12 months)
   - Long-term structural shifts

5. Valuation Framework (200 words)
   - Sector valuation anchors
   - Historical multiple ranges
   - Relative value opportunities
   - Top picks and rationale

**Requirements:**
- Institutional sell-side tone
- Quantify all market sizes
- Cite specific company examples
- "We expect", "Our sector view"
- Include specific numbers and forecasts

Industry Report:`;

  try {
    const response = await callOpenAI([
      { role: 'system', content: 'You are a senior sell-side sector analyst at Morgan Stanley. Write institutional-grade industry reports.' },
      { role: 'user', content: prompt }
    ], {
      model: 'gpt-4o',
      max_tokens: 2000,
      temperature: 0.4
    });
    
    let report = response.trim();
    report = styleEngine.applyStyle(report);
    report = sentenceEngine.normalize(report);
    
    console.log(`[WriterIndustryV3] Industry report generated: ${report.length} chars`);
    return report;
    
  } catch (error) {
    console.error('[WriterIndustryV3] Generation failed:', error.message);
    return `Industry analysis for ${sector} is being prepared. Please check back later.`;
  }
}

module.exports = {
  generateIndustryReport
};
