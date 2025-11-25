const { callOpenAI } = require('../aiService');
const styleEngine = require('./styleEngine');
const sentenceEngine = require('./sentenceEngine');

async function generateMacroReport(type, params = {}) {
  let prompt = '';
  
  if (type === 'monthly_strategy') {
    prompt = `You are a J.P. Morgan global strategist writing the monthly market strategy report.

Month: ${params.month || 'Current month'}
Market Context: ${params.context || 'Mixed macro signals'}

Write a 1000 word monthly strategy report:

**Structure:**

1. Executive Summary (150 words)
   - Market outlook
   - Top trades
   - Risk assessment

2. Macro Assessment (300 words)
   - Fed policy trajectory
   - Inflation dynamics
   - Growth outlook
   - Employment trends

3. Asset Allocation (250 words)
   - Equity positioning
   - Fixed income view
   - FX strategy
   - Commodities

4. Sector Views (200 words)
   - Overweight sectors
   - Underweight sectors
   - Tactical opportunities

5. Risks and Hedges (100 words)
   - Key tail risks
   - Hedge recommendations

**Requirements:**
- Institutional strategist tone
- Specific allocation recommendations
- Quantified views (OW/UW/N with conviction)
- "We recommend", "Our base case"

Strategy Report:`;
    
  } else if (type === 'etf_analysis') {
    const ticker = params.ticker || 'SPY';
    prompt = `You are a Goldman Sachs ETF strategist analyzing ${ticker}.

ETF: ${ticker}
AUM: ${params.aum || 'N/A'}
Expense Ratio: ${params.expense || 'N/A'}%

Write a 800 word ETF analysis:

**Structure:**

1. Fund Overview (200 words)
   - Strategy and mandate
   - AUM and flows
   - Expense structure

2. Holdings Analysis (250 words)
   - Top 10 holdings
   - Sector exposure
   - Factor tilts

3. Performance Attribution (200 words)
   - Historical returns
   - Tracking error
   - Risk-adjusted metrics

4. Investment Case (150 words)
   - When to use this ETF
   - Alternatives
   - Portfolio fit

**Requirements:**
- Institutional tone
- Quantified metrics
- Relative comparisons
- "We view", "Our analysis"

ETF Analysis:`;
  } else {
    prompt = `Write a brief macro market update in institutional sell-side style.`;
  }

  try {
    const response = await callOpenAI([
      { role: 'system', content: 'You are a senior sell-side strategist. Write institutional-grade macro reports.' },
      { role: 'user', content: prompt }
    ], {
      model: 'gpt-4o',
      max_tokens: 1500,
      temperature: 0.4
    });
    
    let report = response.trim();
    report = styleEngine.applyStyle(report);
    report = sentenceEngine.normalize(report);
    
    console.log(`[WriterMacroV3] Macro report generated (${type}): ${report.length} chars`);
    return report;
    
  } catch (error) {
    console.error('[WriterMacroV3] Generation failed:', error.message);
    return `Macro analysis (${type}) is being prepared. Please check back later.`;
  }
}

module.exports = {
  generateMacroReport
};
