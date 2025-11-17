/**
 * ════════════════════════════════════════════════════════════════
 * SELL-SIDE WRITER v2.0 (Phase 3.3)
 * ════════════════════════════════════════════════════════════════
 * 
 * Morgan Stanley / Goldman Sachs-grade institutional research writing
 * Transforms structured financial data into sell-side narratives
 * 
 * v2.0 Enhancements (Phase 3.3):
 * - Enhanced 5-section structure (Thesis, Overview, Valuation, Industry, Macro)
 * - Each section > 600 words with data-driven insights
 * - Structured GPT-4o-mini prompting with financial context
 * - Variation in transitional phrases (avoiding "driven by" overuse)
 * - Strict anti-repetition between summary and full text
 * - Institutional tone enforcement
 * 
 * Integration: Called from reportService.js assemble stage
 */

const fetch = require('node-fetch');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

class SellSideWriter {
  
  /**
   * Enhance report with sell-side professional writing
   * @param {object} report - Complete ResearchReport v3.2 object
   * @returns {object} Enhanced report with professional sell-side narratives
   */
  async enhanceReportWithSellSideTone(report) {
    console.log(`\n📝 [SellSideWriter] Generating institutional-grade narratives...`);
    
    const startTime = Date.now();
    
    // Extract key data points for referencing
    const context = this._extractReportContext(report);
    
    // Generate each section with sell-side tone
    const sections = await Promise.all([
      this._writeInvestmentThesis(context, report),
      this._writeCompanyOverview(context, report),
      this._writeValuationCommentary(context, report),
      this._writeFinancialHealthSummary(context, report),
      this._writePeerComparisonCommentary(context, report)
    ]);
    
    // Update report with new sections
    report.investment_thesis = sections[0];
    report.company_overview = sections[1];
    report.valuation_commentary = sections[2];
    report.financial_health_summary = sections[3];
    report.peer_comparison_commentary = sections[4];
    
    const latency = Date.now() - startTime;
    console.log(`✅ [SellSideWriter] Professional narratives complete (${latency}ms)`);
    console.log(`   └─ Sections rewritten: InvestmentThesis, CompanyOverview, Valuation, FinancialHealth, PeerComparison`);
    
    return report;
  }
  
  /**
   * Extract structured context for narrative generation
   */
  _extractReportContext(report) {
    const fmt = (val, decimals = 2) => {
      if (val === null || val === undefined || isNaN(val)) return null;
      return Number(val).toFixed(decimals);
    };
    
    const fmtLarge = (val) => {
      if (val === null || val === undefined || isNaN(val)) return null;
      if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
      if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
      if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
      return `$${val.toFixed(2)}`;
    };
    
    return {
      symbol: report.symbol,
      name: report.name,
      price: fmt(report.price?.last, 2),
      change_pct: fmt(report.price?.change_pct, 2),
      market_cap: fmtLarge(report.valuation?.market_cap),
      pe: fmt(report.valuation?.pe_ttm, 1),
      ps: fmt(report.valuation?.ps_ttm, 1),
      pb: fmt(report.valuation?.pb, 1),
      roe: fmt(report.fundamentals?.roe, 1),
      roa: fmt(report.fundamentals?.roa, 1),
      gross_margin: fmt(report.fundamentals?.gross_margin, 1),
      op_margin: fmt(report.fundamentals?.operating_margin, 1),
      net_margin: fmt(report.fundamentals?.net_margin, 1),
      revenue_cagr_3y: fmt(report.growth?.revenue_cagr_3y, 1),
      eps_cagr_3y: fmt(report.growth?.eps_cagr_3y, 1),
      target_price: fmt(report.targets?.base, 2),
      upside: fmt(report.targets?.upside_pct, 1),
      rating: report.rating || 'HOLD',
      peers: report.peers || [],
      revenue_5y_count: report.fundamentals?.revenue_5y?.length || 0,
      eps_5y_count: report.fundamentals?.eps_5y?.length || 0
    };
  }
  
  /**
   * Write Investment Thesis (sell-side style)
   */
  async _writeInvestmentThesis(context, report) {
    const bullets = [];
    
    // Data-driven thesis points
    if (context.revenue_cagr_3y && parseFloat(context.revenue_cagr_3y) > 15) {
      bullets.push(`We see ${context.symbol} as a compelling growth story, with ${context.revenue_cagr_3y}% revenue CAGR over the past 3 years demonstrating solid execution.`);
    }
    
    if (context.roe && parseFloat(context.roe) > 15) {
      bullets.push(`The company's ROE of ${context.roe}% reflects efficient capital allocation and operational strength.`);
    }
    
    if (context.upside && parseFloat(context.upside) > 10) {
      bullets.push(`Our ${context.target_price} price target implies ${context.upside}% upside from current levels.`);
    } else if (context.upside) {
      bullets.push(`Our base case target of ${context.target_price} suggests ${context.upside}% ${parseFloat(context.upside) > 0 ? 'upside' : 'downside'} potential.`);
    }
    
    if (context.pe) {
      bullets.push(`Trading at ${context.pe}x P/E, we believe the valuation reflects the company's growth profile.`);
    }
    
    // Ensure we have at least 3 thesis points
    while (bullets.length < 3) {
      bullets.push(`We maintain our ${context.rating} rating based on fundamental analysis and risk-reward assessment.`);
    }
    
    return bullets.slice(0, 5).join(' ');
  }
  
  /**
   * Write Company Overview (sell-side style)
   */
  async _writeCompanyOverview(context, report) {
    const parts = [];
    
    parts.push(`${context.name} (${context.symbol}) is currently trading at ${context.price} with a market capitalization of ${context.market_cap}.`);
    
    if (context.revenue_cagr_3y) {
      parts.push(`The company has demonstrated ${context.revenue_cagr_3y}% revenue growth over the past 3 years.`);
    }
    
    if (context.op_margin) {
      parts.push(`Operating margins stand at ${context.op_margin}%, reflecting operational efficiency.`);
    }
    
    if (report.segments && report.segments.length > 0) {
      const topSegment = report.segments[0];
      if (topSegment.revenue_contribution) {
        parts.push(`The company's largest segment contributes approximately ${topSegment.revenue_contribution}% of total revenue.`);
      }
    }
    
    return parts.join(' ');
  }
  
  /**
   * Write Valuation Commentary (sell-side style)
   */
  async _writeValuationCommentary(context, report) {
    const parts = [];
    
    if (context.pe && context.ps) {
      parts.push(`${context.symbol} trades at ${context.pe}x P/E and ${context.ps}x P/S on a TTM basis.`);
    } else if (context.pe) {
      parts.push(`The stock trades at ${context.pe}x P/E on a trailing basis.`);
    }
    
    // Peer comparison insight
    if (context.peers.length > 0) {
      const avgPeerPE = context.peers.reduce((sum, p) => {
        const pe = p.valuation?.pe_ttm || 0;
        return sum + (pe > 0 && pe < 200 ? pe : 0);
      }, 0) / context.peers.filter(p => p.valuation?.pe_ttm > 0 && p.valuation?.pe_ttm < 200).length;
      
      if (avgPeerPE && !isNaN(avgPeerPE) && context.pe) {
        const premium = ((parseFloat(context.pe) / avgPeerPE - 1) * 100).toFixed(0);
        if (Math.abs(premium) > 5) {
          parts.push(`This represents a ${Math.abs(premium)}% ${premium > 0 ? 'premium' : 'discount'} to peer average P/E of ${avgPeerPE.toFixed(1)}x.`);
        }
      }
    }
    
    if (context.target_price && context.upside) {
      parts.push(`We see ${context.upside}% ${parseFloat(context.upside) > 0 ? 'upside' : 'downside'} to our ${context.target_price} price target.`);
    }
    
    if (parts.length === 0) {
      parts.push(`Our valuation analysis considers multiple metrics and peer comparisons to arrive at our price target.`);
    }
    
    return parts.join(' ');
  }
  
  /**
   * Write Financial Health Summary (sell-side style)
   */
  async _writeFinancialHealthSummary(context, report) {
    const parts = [];
    
    if (context.roe && context.roa) {
      parts.push(`The company demonstrates solid profitability metrics with ROE of ${context.roe}% and ROA of ${context.roa}%.`);
    }
    
    if (context.gross_margin && context.net_margin) {
      parts.push(`Margin profile shows gross margin of ${context.gross_margin}% and net margin of ${context.net_margin}%.`);
    }
    
    if (context.revenue_cagr_3y && context.eps_cagr_3y) {
      parts.push(`Historical growth metrics show ${context.revenue_cagr_3y}% revenue CAGR and ${context.eps_cagr_3y}% EPS CAGR over 3 years.`);
    } else if (context.revenue_cagr_3y) {
      parts.push(`Revenue has grown at ${context.revenue_cagr_3y}% CAGR over the past 3 years.`);
    }
    
    if (parts.length === 0) {
      parts.push(`We continue to monitor the company's financial health metrics and operational performance.`);
    }
    
    return parts.join(' ');
  }
  
  /**
   * Write Peer Comparison Commentary (sell-side style)
   */
  async _writePeerComparisonCommentary(context, report) {
    if (!context.peers || context.peers.length === 0) {
      return `Peer comparison data is currently limited. We recommend monitoring competitive positioning relative to industry benchmarks.`;
    }
    
    const parts = [];
    parts.push(`We compare ${context.symbol} against ${context.peers.length} peer companies.`);
    
    // Find best peer on PE basis
    const validPeers = context.peers.filter(p => p.valuation?.pe_ttm > 0 && p.valuation?.pe_ttm < 200);
    if (validPeers.length > 0 && context.pe) {
      const avgPE = validPeers.reduce((sum, p) => sum + p.valuation.pe_ttm, 0) / validPeers.length;
      parts.push(`Average peer P/E stands at ${avgPE.toFixed(1)}x compared to ${context.symbol}'s ${context.pe}x.`);
    }
    
    // Market cap comparison
    if (context.market_cap && validPeers.length > 0) {
      const largerPeers = validPeers.filter(p => {
        if (!p.valuation?.market_cap) return false;
        const peerMcap = p.valuation.market_cap;
        const ourMcap = report.valuation?.market_cap;
        return peerMcap > ourMcap;
      }).length;
      
      parts.push(`${context.symbol} ranks among the ${largerPeers === 0 ? 'largest' : largerPeers < validPeers.length / 2 ? 'larger' : 'smaller'} companies in our peer set by market capitalization.`);
    }
    
    return parts.join(' ');
  }

  /**
   * ═══════════════════════════════════════════════════════════════
   * PHASE 3.3: SELL-SIDE WRITER V2 - ENHANCED INSTITUTIONAL NARRATIVES
   * ═══════════════════════════════════════════════════════════════
   * 
   * Generate Morgan Stanley/Goldman Sachs-grade extended narratives
   * Each section: 600+ words, data-driven, variation in language
   */

  /**
   * Enhanced institutional-grade content generation (Phase 3.3)
   * @param {object} report - Complete ResearchReport v3.2 object
   * @returns {object} Enhanced report with 5 long-form sections
   */
  async enhance(report) {
    console.log(`\n📝 [SellSideWriter v2.0] Generating institutional-grade extended narratives...`);
    
    const startTime = Date.now();
    
    // Extract structured data for GPT-4o-mini
    const structuredInput = this._buildStructuredInput(report);
    
    // Generate 5 enhanced sections in parallel
    const [thesis, overview, valuation, industry, macro] = await Promise.all([
      this._generateEnhancedThesis(structuredInput, report),
      this._generateEnhancedOverview(structuredInput, report),
      this._generateEnhancedValuation(structuredInput, report),
      this._generateEnhancedIndustry(structuredInput, report),
      this._generateEnhancedMacro(structuredInput, report)
    ]);
    
    const latency = Date.now() - startTime;
    
    console.log(`✅ [SellSideWriter v2.0] Enhanced narratives complete (${latency}ms)`);
    console.log(`   ├─ Thesis: ${thesis.length} chars`);
    console.log(`   ├─ Overview: ${overview.length} chars`);
    console.log(`   ├─ Valuation: ${valuation.length} chars`);
    console.log(`   ├─ Industry: ${industry.length} chars`);
    console.log(`   └─ Macro: ${macro.length} chars`);
    
    // Update report with enhanced sections
    return {
      thesis_enhanced: thesis,
      overview_enhanced: overview,
      valuation_enhanced: valuation,
      industry_enhanced: industry,
      macro_enhanced: macro,
      sellside_v2_latency_ms: latency
    };
  }

  /**
   * Build structured input for GPT-4o-mini prompting
   */
  _buildStructuredInput(report) {
    return {
      symbol: report.symbol,
      name: report.name,
      metrics: {
        price: report.price?.last,
        market_cap: report.valuation?.market_cap,
        pe_ttm: report.valuation?.pe_ttm,
        ps_ttm: report.valuation?.ps_ttm,
        pb: report.valuation?.pb,
        roe: report.fundamentals?.roe,
        roa: report.fundamentals?.roa,
        gross_margin: report.fundamentals?.gross_margin,
        operating_margin: report.fundamentals?.operating_margin,
        net_margin: report.fundamentals?.net_margin,
        revenue_cagr_3y: report.growth?.revenue_cagr_3y,
        eps_cagr_3y: report.growth?.eps_cagr_3y
      },
      financials: {
        revenue_5y: report.fundamentals?.revenue_5y || [],
        eps_5y: report.fundamentals?.eps_5y || [],
        fcf_5y: report.fundamentals?.fcf_5y || []
      },
      history: {
        price_52w_high: report.price?.high_52w,
        price_52w_low: report.price?.low_52w,
        ytd_return: report.price?.ytd_return
      },
      valuation: {
        target_price: report.targets?.base?.price,
        upside_pct: report.targets?.upside_pct,
        rating: report.rating
      },
      industry: report.industry_text || '',
      macro: report.macro_text || '',
      segments: report.segments || [],
      peers: report.peers || []
    };
  }

  /**
   * Generate enhanced Investment Thesis (600+ words)
   */
  async _generateEnhancedThesis(input, report) {
    if (!OPENAI_API_KEY) {
      return this._fallbackThesis(input);
    }

    const systemPrompt = `You are a Morgan Stanley senior equity research analyst writing the Investment Thesis section for ${input.name} (${input.symbol}). Write a comprehensive 600-800 word institutional-grade investment thesis with:

1. THREE CORE DRIVERS (not "catalysts"):
   - Each driver should be 150-200 words
   - Cite specific financial metrics (PE: ${input.metrics.pe_ttm}x, ROE: ${input.metrics.roe}%, Revenue CAGR: ${input.metrics.revenue_cagr_3y}%)
   - Use variation: "underpinned by", "reinforced by", "complemented by", "anchored in" (NOT always "driven by")

2. FINANCIAL PROFILE SUMMARY (100-150 words):
   - Margins, profitability, balance sheet strength
   - Historical growth trajectory
   - Capital allocation framework

3. RATING JUSTIFICATION (100-150 words):
   - ${input.valuation.upside_pct}% upside to $${input.valuation.target_price} target
   - Risk-reward assessment
   - Why ${input.valuation.rating} vs. HOLD/SELL

STYLE REQUIREMENTS:
- Professional sell-side tone ("we believe", "our view", "we see")
- NO generic AI phrases (huge, massive, rapidly, extremely)
- Specific numbers and percentages throughout
- NO repetition of summary_text from report
- Institutional vocabulary only`;

    const userPrompt = `Context:\n${JSON.stringify(input.metrics, null, 2)}\n\nWrite the Investment Thesis section (600-800 words). Return ONLY the thesis text, no title or headers.`;

    try {
      const response = await this._callGPT4oMini(systemPrompt, userPrompt);
      return response.length > 400 ? response : this._fallbackThesis(input);
    } catch (error) {
      console.error(`⚠️ [SellSideWriter v2] Thesis generation failed: ${error.message}`);
      return this._fallbackThesis(input);
    }
  }

  /**
   * Generate enhanced Company Overview (600+ words)
   */
  async _generateEnhancedOverview(input, report) {
    if (!OPENAI_API_KEY) {
      return this._fallbackOverview(input);
    }

    const systemPrompt = `You are a Goldman Sachs equity research analyst writing the Company Overview section for ${input.name} (${input.symbol}). Write 600-800 words covering:

1. BUSINESS STRUCTURE (200-250 words):
   - Revenue breakdown by segment (if available: ${JSON.stringify(input.segments.slice(0, 3))})
   - Geographic exposure
   - Key products/services

2. FINANCIAL SUMMARY (200-250 words):
   - 5-year revenue/EPS trend (${input.financials.revenue_5y.length} years of data)
   - Margin profile (Gross: ${input.metrics.gross_margin}%, Operating: ${input.metrics.operating_margin}%, Net: ${input.metrics.net_margin}%)
   - Capital structure and liquidity

3. COMPETITIVE POSITIONING (200-250 words):
   - Market share and competitive advantages
   - Peer comparison (${input.peers.length} peers tracked)
   - Differentiation factors

STYLE:
- Institutional sell-side tone
- Cite specific financial figures
- Avoid repetition of Investment Thesis content
- Use varied transitions (not repetitive "driven by")`;

    const userPrompt = `Context:\n${JSON.stringify(input, null, 2)}\n\nWrite the Company Overview section (600-800 words). Return ONLY the overview text.`;

    try {
      const response = await this._callGPT4oMini(systemPrompt, userPrompt);
      return response.length > 400 ? response : this._fallbackOverview(input);
    } catch (error) {
      console.error(`⚠️ [SellSideWriter v2] Overview generation failed: ${error.message}`);
      return this._fallbackOverview(input);
    }
  }

  /**
   * Generate enhanced Valuation Analysis (600+ words)
   */
  async _generateEnhancedValuation(input, report) {
    if (!OPENAI_API_KEY) {
      return this._fallbackValuation(input);
    }

    const systemPrompt = `You are a Barclays equity research analyst writing the Valuation section for ${input.name} (${input.symbol}). Write 600-800 words with:

1. CURRENT VALUATION METRICS (200 words):
   - PE TTM: ${input.metrics.pe_ttm}x, PS TTM: ${input.metrics.ps_ttm}x, PB: ${input.metrics.pb}x
   - Comparison to historical averages
   - Absolute vs. relative valuation

2. PE × EPS JUSTIFIED VALUATION BAND (250 words):
   - Bear/Base/Bull EPS estimates
   - Justified PE range based on growth (${input.metrics.revenue_cagr_3y}% CAGR) and profitability (${input.metrics.roe}% ROE)
   - Implied price targets for each scenario

3. PEER COMPARISON (200 words):
   - ${input.peers.length} peer companies
   - Valuation premium/discount analysis
   - Why multiples are justified or not

CRITICAL:
- MUST reference PE, PS, PB multiples explicitly
- Show math: Target Price = Justified PE × Forward EPS
- NO vague "fair value" - show calculation
- Institutional precision`;

    const userPrompt = `Context:\n${JSON.stringify(input.valuation, null, 2)}\n${JSON.stringify(input.metrics, null, 2)}\n\nWrite the Valuation section (600-800 words).`;

    try {
      const response = await this._callGPT4oMini(systemPrompt, userPrompt);
      return response.length > 400 ? response : this._fallbackValuation(input);
    } catch (error) {
      console.error(`⚠️ [SellSideWriter v2] Valuation generation failed: ${error.message}`);
      return this._fallbackValuation(input);
    }
  }

  /**
   * Generate enhanced Industry Analysis (600+ words)
   */
  async _generateEnhancedIndustry(input, report) {
    if (!OPENAI_API_KEY) {
      return this._fallbackIndustry(input);
    }

    const systemPrompt = `You are a J.P. Morgan sector analyst writing the Industry Analysis for ${input.name}. Write 600-800 words covering:

1. INDUSTRY TRENDS (250 words):
   - 2-3 key secular trends (AI adoption, cloud migration, regulatory changes, etc.)
   - Market growth rates (TAM, SAM, SOM if available)
   - Technology disruption dynamics

2. TAM & MARKET SIZING (200 words):
   - Total addressable market estimates
   - ${input.name}'s current penetration
   - Runway for growth

3. COMPETITIVE LANDSCAPE (200 words):
   - Key competitors from peer set: ${input.peers.slice(0, 3).map(p => p.symbol).join(', ')}
   - Market structure (oligopoly, fragmented, winner-take-all)
   - Barriers to entry

STYLE:
- Data-driven (cite market research, TAM figures)
- Forward-looking (next 3-5 years)
- Institutional sophistication`;

    const userPrompt = `Industry context:\n${input.industry}\n\nPeers: ${JSON.stringify(input.peers.slice(0, 5))}\n\nWrite Industry Analysis (600-800 words).`;

    try {
      const response = await this._callGPT4oMini(systemPrompt, userPrompt);
      return response.length > 400 ? response : this._fallbackIndustry(input);
    } catch (error) {
      console.error(`⚠️ [SellSideWriter v2] Industry generation failed: ${error.message}`);
      return this._fallbackIndustry(input);
    }
  }

  /**
   * Generate enhanced Macro Analysis (600+ words)
   */
  async _generateEnhancedMacro(input, report) {
    if (!OPENAI_API_KEY) {
      return input.macro || 'Macroeconomic analysis data is currently limited for this security.';
    }

    const systemPrompt = `You are a UBS macro strategist analyzing how macroeconomic factors impact ${input.name} (${input.symbol}). Write 600-800 words on:

1. MACRO SENSITIVITY (300 words):
   - Interest rate exposure (debt levels, refinancing needs)
   - FX exposure (revenue by geography)
   - Commodity/input cost sensitivity
   - GDP growth correlation

2. CURRENT MACRO BACKDROP (200 words):
   - Fed policy, inflation trends, yield curve
   - Consumer/business sentiment
   - Sector-specific macro drivers

3. SCENARIO ANALYSIS (200 words):
   - Bull case: favorable macro (rate cuts, strong demand)
   - Bear case: adverse macro (recession, rate hikes)
   - Impact on ${input.symbol}'s valuation

STYLE:
- Professional, data-driven
- Link macro to company fundamentals
- Institutional depth`;

    const userPrompt = `Macro context:\n${input.macro}\n\nMetrics: ${JSON.stringify(input.metrics)}\n\nWrite Macro Analysis (600-800 words).`;

    try {
      const response = await this._callGPT4oMini(systemPrompt, userPrompt);
      return response.length > 400 ? response : input.macro || 'Macroeconomic analysis pending.';
    } catch (error) {
      console.error(`⚠️ [SellSideWriter v2] Macro generation failed: ${error.message}`);
      return input.macro || 'Macroeconomic analysis pending.';
    }
  }

  /**
   * Call GPT-4o-mini API
   */
  async _callGPT4oMini(systemPrompt, userPrompt) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.6,
        max_tokens: 1200
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content?.trim() || '';
  }

  /**
   * Fallback methods when GPT-4o-mini is unavailable
   */
  _fallbackThesis(input) {
    return `We maintain our ${input.valuation.rating} rating on ${input.name} (${input.symbol}) with a price target of $${input.valuation.target_price}, implying ${input.valuation.upside_pct}% upside from current levels. Our constructive view is underpinned by solid revenue growth of ${input.metrics.revenue_cagr_3y}% CAGR over the past 3 years, reinforced by disciplined operating leverage reflected in ${input.metrics.operating_margin}% operating margins. The company's profitability profile, with ROE of ${input.metrics.roe}%, demonstrates efficient capital allocation. We see ${input.symbol} as well-positioned to benefit from secular industry trends, complemented by a reasonable valuation at ${input.metrics.pe_ttm}x P/E relative to growth.`;
  }

  _fallbackOverview(input) {
    return `${input.name} (${input.symbol}) operates with a market capitalization of approximately ${this._formatLarge(input.metrics.market_cap)}. The company has demonstrated ${input.metrics.revenue_cagr_3y}% revenue CAGR over the past 3 years. Operating margins stand at ${input.metrics.operating_margin}%, with gross margins of ${input.metrics.gross_margin}%. We track ${input.peers.length} peer companies for comparative analysis. The current valuation of ${input.metrics.pe_ttm}x P/E reflects the company's growth profile and market positioning.`;
  }

  _fallbackValuation(input) {
    return `${input.name} currently trades at ${input.metrics.pe_ttm}x P/E on a trailing basis and ${input.metrics.ps_ttm}x P/S. Our base case price target of $${input.valuation.target_price} implies ${input.valuation.upside_pct}% ${input.valuation.upside_pct > 0 ? 'upside' : 'downside'} potential. We believe the current valuation reflects the company's growth trajectory (${input.metrics.revenue_cagr_3y}% revenue CAGR) and profitability metrics (${input.metrics.roe}% ROE). Relative to peers, we see the valuation as justified given the fundamental positioning.`;
  }

  _fallbackIndustry(input) {
    return input.industry || `Industry analysis for ${input.name} considers competitive dynamics, market structure, and secular trends shaping the sector. With ${input.peers.length} tracked peers, we monitor market share shifts and competitive positioning. The industry backdrop presents both opportunities and challenges that factor into our investment outlook.`;
  }

  _formatLarge(val) {
    if (!val) return 'N/A';
    if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    return `$${val.toFixed(2)}`;
  }
}

// Export singleton instance
module.exports = new SellSideWriter();
