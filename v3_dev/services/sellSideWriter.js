/**
 * ════════════════════════════════════════════════════════════════
 * SELL-SIDE WRITER v1.0
 * ════════════════════════════════════════════════════════════════
 * 
 * Professional sell-side research writing layer
 * Transforms structured financial data into institutional-grade narrative
 * 
 * Key Features:
 * - Data-driven content (cites PE, PS, margins, CAGR, targets)
 * - Sell-side tone ("we see", "we believe", "our base case")
 * - No AI-generic water words (huge, massive, extremely)
 * - No internal system references (DeepSeek, our AI engine)
 * 
 * Integration: Sits between multi-model analysis and TasteTruthLayer
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
}

// Export singleton instance
module.exports = new SellSideWriter();
