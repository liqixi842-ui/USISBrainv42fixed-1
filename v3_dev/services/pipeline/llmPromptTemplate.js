/**
 * ═══════════════════════════════════════════════════════════════
 * LLM PROMPT TEMPLATE
 * ═══════════════════════════════════════════════════════════════
 * 
 * Standardized prompt template for institutional report generation
 * 
 * Style Reference: Morgan Stanley equity research
 * 
 * Output Format:
 * - Executive Summary: 1 line rating + rationale + 3 bullet drivers + 3 bullet risks
 * - Investment Thesis: 3 short paragraphs (Moat / Growth / Margins)
 * - Catalysts: max 3, each with timeframe and conservative $ impact
 * - Risks: table with Probability / Impact / $ effect / horizon
 */

class LLMPromptTemplate {
  constructor() {
    this.systemPrompt = `You are a sell-side equity research analyst at a top-tier investment bank. Your analysis must be:
- Data-driven with specific metrics and citations
- Neutral and professional in tone
- Concise with no filler phrases
- Structured in clear sections with bullet points
- Conservative in financial projections

STYLE RULES:
- No fluff or vague statements
- No "in our view", "given this backdrop", "considering these factors"
- No duplicated words or phrases
- Numbers properly formatted (ROE to 1 decimal, $ with thousand separators)
- Each catalyst/risk must include timeframe and quantified impact

REFERENCE STYLE: Morgan Stanley equity research reports`;
  }

  generate(data) {
    const ticker = data.ticker || 'UNKNOWN';
    const f = data.fundamentals || {};
    const peers = data.peers || [];
    const charts = data.charts || [];

    const prompt = `${this.systemPrompt}

═══════════════════════════════════════════════════════════════
STRUCTURED INPUT DATA FOR ${ticker}
═══════════════════════════════════════════════════════════════

CURRENT METRICS:
- Price: $${f.price || 'N/A'}
- Market Cap: $${this._formatLargeNumber(f.market_cap)}
- P/E TTM: ${f.pe_ttm?.toFixed(1) || 'N/A'}x
- P/E Forward: ${f.pe_forward?.toFixed(1) || 'N/A'}x
- P/S: ${f.ps_ttm?.toFixed(1) || 'N/A'}x
- P/B: ${f.pb?.toFixed(1) || 'N/A'}x
- Dividend Yield: ${f.div_yield?.toFixed(2) || 0}%
- Beta: ${f.beta?.toFixed(2) || 'N/A'}

PROFITABILITY:
- Gross Margin: ${f.gross_margin?.toFixed(1) || 'N/A'}%
- Operating Margin: ${f.operating_margin?.toFixed(1) || 'N/A'}%
- Net Margin: ${f.net_margin?.toFixed(1) || 'N/A'}%
- ROE: ${f.roe?.toFixed(1) || 'N/A'}%
- ROA: ${f.roa?.toFixed(1) || 'N/A'}%

PEER COMPARISON:
${this._formatPeers(peers)}

CHARTS AVAILABLE:
${this._formatChartReferences(charts)}

═══════════════════════════════════════════════════════════════
REQUIRED OUTPUT FORMAT
═══════════════════════════════════════════════════════════════

Generate an institutional-quality equity research report with these sections:

1. EXECUTIVE SUMMARY (one paragraph)
- Open with rating (BUY/HOLD/SELL) and 12-month price target
- One sentence rationale
- 3 bullet points: key investment drivers
- 3 bullet points: primary risks with probability and $ impact

2. INVESTMENT THESIS (3 paragraphs, 2-4 sentences each)
- Paragraph 1 (MOAT): Competitive advantages and barriers to entry
- Paragraph 2 (GROWTH): Revenue/earnings drivers and catalysts
- Paragraph 3 (MARGINS): Profitability sustainability and operating leverage

3. CATALYSTS (exactly 3 items)
Each must include:
- Event description (one sentence)
- Timeframe (specific: "Q1 2026" or "H2 2026")
- Conservative financial impact (e.g., "potential 50-100bps margin improvement")

4. RISKS (exactly 3 items, table format)
| Risk | Probability | Impact | Horizon | Financial Effect |
Each row must be complete with all 5 columns filled.

5. VALUATION SUMMARY (2-3 sentences)
- Current multiples vs historical range
- Comparison to peers
- Implied upside/downside

CRITICAL RULES:
- If a chart URL exists, reference it inline: "See Price Chart (Figure 1)"
- If chart is missing, note: "[Chart unavailable - data insufficient]"
- All numbers must cite their source (e.g., "ROE of 25.3% per latest filings")
- No vague language or filler phrases
- Maximum 3 mentions of "we believe" or similar analyst statements`;

    return prompt;
  }

  _formatLargeNumber(value) {
    if (!value) return 'N/A';
    if (value >= 1e12) return (value / 1e12).toFixed(2) + 'T';
    if (value >= 1e9) return (value / 1e9).toFixed(2) + 'B';
    if (value >= 1e6) return (value / 1e6).toFixed(2) + 'M';
    return value.toLocaleString();
  }

  _formatPeers(peers) {
    if (!peers || peers.length === 0) {
      return '- No peer data available';
    }
    
    return peers.slice(0, 5).map(p => 
      `- ${p.ticker}: P/E Fwd ${p.pe_forward?.toFixed(1) || 'N/A'}x, P/S ${p.ps_ttm?.toFixed(1) || 'N/A'}x, ROE ${p.roe?.toFixed(1) || 'N/A'}%`
    ).join('\n');
  }

  _formatChartReferences(charts) {
    if (!charts || charts.length === 0) {
      return '- No charts generated';
    }
    
    const available = charts.filter(c => c.url);
    const unavailable = charts.filter(c => !c.url);
    
    const lines = [];
    
    if (available.length > 0) {
      lines.push('Available:');
      available.forEach((c, i) => {
        lines.push(`  - Figure ${i + 1}: ${c.name} (${c.data_points} data points)`);
      });
    }
    
    if (unavailable.length > 0) {
      lines.push('Unavailable:');
      unavailable.forEach(c => {
        lines.push(`  - ${c.name}: ${c.error || 'data insufficient'}`);
      });
    }
    
    return lines.join('\n');
  }

  generateCatalystPrompt(data) {
    return `Generate exactly 3 near-term catalysts for ${data.ticker}. Each catalyst must include:
1. Specific event (earnings, product launch, regulatory decision, etc.)
2. Concrete timeframe (e.g., "Q1 2026", "H2 2026", "within 6 months")
3. Conservative financial impact with ranges (e.g., "could add 50-100bps to margins", "potential $500M-1B revenue contribution")

Format as numbered list. No vague statements like "could benefit" - be specific.`;
  }

  generateRiskPrompt(data) {
    return `Generate exactly 3 key risks for ${data.ticker}. Format as a table with columns:
| Risk | Probability (High/Medium/Low) | Impact (High/Medium/Low) | Horizon | Financial Effect |

Each risk must:
- Be specific to the company/industry
- Include quantified financial impact where possible
- Have a defined time horizon

Example row:
| Competitive price pressure | Medium | High | 12 months | 100-200bps margin compression |`;
  }

  generateThesisPrompt(data) {
    return `Write a 3-paragraph investment thesis for ${data.ticker}:

Paragraph 1 - MOAT (2-4 sentences):
Focus on competitive advantages. Use data: gross margin ${data.fundamentals?.gross_margin?.toFixed(1)}%, ROE ${data.fundamentals?.roe?.toFixed(1)}%.

Paragraph 2 - GROWTH (2-4 sentences):
Revenue and earnings drivers. Be specific about market opportunities.

Paragraph 3 - MARGINS (2-4 sentences):
Operating leverage and profitability sustainability. Reference: operating margin ${data.fundamentals?.operating_margin?.toFixed(1)}%.

RULES:
- No "we believe", "in our view" more than once total
- Every claim must cite a metric
- Sell-side professional tone (Morgan Stanley style)`;
  }
}

module.exports = new LLMPromptTemplate();
