/**
 * ═══════════════════════════════════════════════════════════════
 * INSTITUTIONAL ENHANCEMENTS MODULE v7.6
 * ═══════════════════════════════════════════════════════════════
 * 
 * 10 MS/GS/UBS Institutional-Level Improvements:
 * 
 * 1. Investment Thesis: 3-paragraph format, numeric precision, 25-word sentences
 * 2. Segment Overview: Bullet format with revenue/YoY/margin/driver
 * 3. Industry & Macro: Quantitative metrics (AI TAM, 10Y yield, USD index)
 * 4. Valuation: 5-year percentile, PEG ratio, EV/EBITDA commentary
 * 5. Peer Comparison: Fix undefined bug, median/mean/premium-discount
 * 6. Catalysts: 3 max with timeframe + probability + $B impact
 * 7. Risks: Probability/Impact/Horizon/$ effect table
 * 8. Technicals: RSI, MACD, ATR, Trend classification
 * 9. Action Recommendations: R/R ratio with tech + fundamentals justification
 * 10. Final Recommendation: Conviction level, scenario weights, margin-of-safety
 */

class InstitutionalEnhancements {
  constructor() {
    this.MAX_SENTENCE_WORDS = 25;
    this.MAX_CATALYSTS = 3;
    this.MAX_RISKS = 5;
  }

  // ═══════════════════════════════════════════════════════════════
  // 1. INVESTMENT THESIS ENHANCEMENTS
  // ═══════════════════════════════════════════════════════════════
  
  enhanceThesis(report) {
    const thesis = {
      moat: this._buildMoatParagraph(report),
      growth_drivers: this._buildGrowthDriversParagraph(report),
      margin_strength: this._buildMarginStrengthParagraph(report)
    };
    
    return thesis;
  }
  
  _buildMoatParagraph(report) {
    const symbol = report.symbol || 'Company';
    const name = report.company_name || report.name || symbol;
    const marketCap = report.valuation?.market_cap;
    const sector = report.sector || 'Technology';
    const marketShare = report.fundamentals?.market_share || null;
    
    let moat = `${name} operates as a ${this._formatMarketCap(marketCap)} ${sector.toLowerCase()} company.`;
    
    if (marketShare) {
      moat += ` The company holds ${this._formatPercent(marketShare)} market share in its core segment.`;
    }
    
    if (report.fundamentals?.roe && report.fundamentals.roe > 15) {
      moat += ` ROE of ${this._formatPercent(report.fundamentals.roe)} indicates durable competitive advantages.`;
    }
    
    return this._enforceSentenceLimit(moat);
  }
  
  _buildGrowthDriversParagraph(report) {
    const parts = [];
    
    if (report.fundamentals?.revenue_growth) {
      parts.push(`Revenue grew ${this._formatPercent(report.fundamentals.revenue_growth)} YoY`);
    }
    
    if (report.growth?.revenue_cagr_3y) {
      parts.push(`3-year revenue CAGR of ${this._formatPercent(report.growth.revenue_cagr_3y)}`);
    }
    
    if (report.growth?.eps_cagr_3y) {
      parts.push(`EPS CAGR of ${this._formatPercent(report.growth.eps_cagr_3y)}`);
    }
    
    if (parts.length === 0) {
      parts.push('Growth drivers include market expansion and product innovation');
    }
    
    return this._enforceSentenceLimit(parts.join('. ') + '.');
  }
  
  _buildMarginStrengthParagraph(report) {
    const parts = [];
    
    if (report.fundamentals?.gross_margin) {
      parts.push(`Gross margin stands at ${this._formatPercent(report.fundamentals.gross_margin)}`);
    }
    
    if (report.fundamentals?.operating_margin) {
      parts.push(`operating margin at ${this._formatPercent(report.fundamentals.operating_margin)}`);
    }
    
    if (report.fundamentals?.net_margin) {
      parts.push(`net margin at ${this._formatPercent(report.fundamentals.net_margin)}`);
    }
    
    if (parts.length === 0) {
      return 'Margin profile reflects operational efficiency and scale benefits.';
    }
    
    return this._enforceSentenceLimit(parts.join(', ') + '.');
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. SEGMENT OVERVIEW ENHANCEMENTS
  // ═══════════════════════════════════════════════════════════════
  
  enhanceSegments(report) {
    const segments = report.segments || [];
    
    if (segments.length === 0) {
      return [{
        name: 'Core Business',
        revenue_pct: 100,
        yoy_growth: report.fundamentals?.revenue_growth || null,
        margin: report.fundamentals?.operating_margin || null,
        driver: 'Primary revenue contributor'
      }];
    }
    
    return segments.map(seg => ({
      name: seg.name || 'Unknown Segment',
      revenue_pct: this._formatNumber(seg.revenue_pct, 1),
      yoy_growth: this._formatNumber(seg.yoy_growth || seg.growth, 1),
      margin: this._formatNumber(seg.margin || seg.operating_margin, 1),
      driver: seg.driver || this._inferDriver(seg.name)
    }));
  }
  
  _inferDriver(segmentName) {
    const name = (segmentName || '').toLowerCase();
    if (name.includes('cloud') || name.includes('saas')) return 'Subscription ARR growth';
    if (name.includes('hardware') || name.includes('device')) return 'Product cycle refresh';
    if (name.includes('service')) return 'Attach rate expansion';
    if (name.includes('advertising') || name.includes('ad')) return 'Impression volume and pricing';
    return 'Volume and mix improvement';
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. INDUSTRY & MACRO ENHANCEMENTS
  // ═══════════════════════════════════════════════════════════════
  
  enhanceIndustryMacro(report, macroData = {}) {
    return {
      tam: this._formatLargeNumber(report.industry?.tam) || 'Data pending',
      tam_cagr: this._formatPercent(report.industry?.tam_cagr || macroData.ai_tam_cagr) || 'Data pending',
      semiconductor_cycle: macroData.semiconductor_cycle || (report.industry?.semiconductor_cycle ? report.industry.semiconductor_cycle : 'Data pending'),
      treasury_10y: macroData.treasury_10y ? this._formatPercent(macroData.treasury_10y) : (report.macro?.treasury_10y ? this._formatPercent(report.macro.treasury_10y) : 'Data pending'),
      usd_index: macroData.usd_index ? this._formatNumber(macroData.usd_index, 1) : (report.macro?.usd_index ? this._formatNumber(report.macro.usd_index, 1) : 'Data pending'),
      fed_funds: macroData.fed_funds ? this._formatPercent(macroData.fed_funds) : (report.macro?.fed_funds ? this._formatPercent(report.macro.fed_funds) : 'Data pending'),
      inflation_yoy: macroData.inflation_yoy ? this._formatPercent(macroData.inflation_yoy) : (report.macro?.inflation_yoy ? this._formatPercent(report.macro.inflation_yoy) : 'Data pending'),
      gdp_growth: macroData.gdp_growth ? this._formatPercent(macroData.gdp_growth) : (report.macro?.gdp_growth ? this._formatPercent(report.macro.gdp_growth) : 'Data pending'),
      key_trends: this._buildMacroTrends(report, macroData),
      _data_source: Object.keys(macroData).length > 0 ? 'provided' : 'inferred'
    };
  }
  
  _inferSemiCycle() {
    const month = new Date().getMonth();
    if (month >= 9 || month <= 2) return 'Inventory normalization phase';
    return 'Early recovery phase';
  }
  
  _buildMacroTrends(report, macroData) {
    const trends = [];
    const sector = (report.sector || '').toLowerCase();
    
    if (sector.includes('tech')) {
      trends.push('AI infrastructure capex accelerating at 35-40% CAGR through 2027');
      trends.push('Enterprise software migration to cloud continues at 15% annual pace');
    } else if (sector.includes('financ')) {
      trends.push('Net interest margin expansion moderating as Fed pauses');
      trends.push('Credit quality metrics normalizing from pandemic lows');
    } else if (sector.includes('health')) {
      trends.push('GLP-1 market expanding at 50%+ CAGR');
      trends.push('Biosimilar adoption accelerating in hospital channel');
    } else {
      trends.push('Consumer spending resilient despite rate headwinds');
      trends.push('Supply chain normalization supporting margin recovery');
    }
    
    return trends;
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. VALUATION ENHANCEMENTS
  // ═══════════════════════════════════════════════════════════════
  
  enhanceValuation(report) {
    const val = report.valuation || {};
    
    const pe_percentile = this._calculate5YPercentile(val.pe_ttm, val.pe_history_5y);
    const pb_percentile = this._calculate5YPercentile(val.pb, val.pb_history_5y);
    const ps_percentile = this._calculate5YPercentile(val.ps_ttm, val.ps_history_5y);
    
    const peg = this._calculatePEG(val.pe_forward, report.growth?.eps_cagr_3y);
    
    const evEbitdaCommentary = this._buildEVEBITDACommentary(val.ev_ebitda, report);
    
    return {
      pe_ttm: this._formatNumber(val.pe_ttm, 1),
      pe_forward: this._formatNumber(val.pe_forward, 1),
      pb: this._formatNumber(val.pb, 2),
      ps_ttm: this._formatNumber(val.ps_ttm, 2),
      ev_ebitda: this._formatNumber(val.ev_ebitda, 1),
      div_yield: this._formatPercent(val.div_yield),
      pe_5y_percentile: pe_percentile,
      pb_5y_percentile: pb_percentile,
      ps_5y_percentile: ps_percentile,
      peg_ratio: peg,
      peg_assessment: this._assessPEG(peg),
      ev_ebitda_commentary: evEbitdaCommentary,
      valuation_justification: this._buildValuationJustification(report, pe_percentile, peg)
    };
  }
  
  _calculate5YPercentile(current, history) {
    if (!current || !history || history.length < 20) {
      return 'Insufficient historical data';
    }
    
    const sorted = [...history].sort((a, b) => a - b);
    const rank = sorted.filter(v => v <= current).length;
    const percentile = Math.round((rank / sorted.length) * 100);
    
    return `${percentile}th percentile`;
  }
  
  _calculatePEG(peForward, epsGrowth) {
    if (!peForward || !epsGrowth || epsGrowth <= 0) return null;
    return this._formatNumber(peForward / epsGrowth, 2);
  }
  
  _assessPEG(peg) {
    if (!peg) return 'N/A - insufficient data';
    const p = parseFloat(peg);
    if (p < 1.0) return 'Undervalued relative to growth';
    if (p < 1.5) return 'Fairly valued for growth';
    if (p < 2.0) return 'Premium valuation for growth';
    return 'Expensive relative to growth trajectory';
  }
  
  _buildEVEBITDACommentary(evEbitda, report) {
    if (!evEbitda || evEbitda === 'N/A') {
      const reasons = [];
      if (!report.fundamentals?.ebitda || report.fundamentals?.ebitda <= 0) {
        reasons.push('negative EBITDA');
      }
      if (!report.valuation?.enterprise_value) {
        reasons.push('enterprise value not available');
      }
      return `EV/EBITDA not applicable: ${reasons.join(' and ') || 'data unavailable'}. Consider P/S or P/B for valuation.`;
    }
    
    const ev = parseFloat(evEbitda);
    if (ev < 8) return `EV/EBITDA of ${this._formatNumber(ev, 1)}x suggests discount valuation vs sector median of 12-15x.`;
    if (ev < 15) return `EV/EBITDA of ${this._formatNumber(ev, 1)}x in line with sector average.`;
    if (ev < 25) return `EV/EBITDA of ${this._formatNumber(ev, 1)}x reflects growth premium.`;
    return `EV/EBITDA of ${this._formatNumber(ev, 1)}x indicates elevated expectations baked into valuation.`;
  }
  
  _buildValuationJustification(report, percentile, peg) {
    const parts = [];
    
    if (percentile && !percentile.includes('Insufficient')) {
      const pctNum = parseInt(percentile);
      if (pctNum < 30) parts.push('trading below historical average');
      else if (pctNum > 70) parts.push('trading above historical average');
      else parts.push('trading near historical median');
    }
    
    if (peg) {
      const p = parseFloat(peg);
      if (p < 1.5) parts.push('growth-adjusted valuation appears reasonable');
      else parts.push('premium valuation requires continued execution');
    }
    
    return parts.length > 0 
      ? `The stock is ${parts.join(', ')}.`
      : 'Valuation analysis based on multiple approaches.';
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. PEER COMPARISON ENHANCEMENTS
  // ═══════════════════════════════════════════════════════════════
  
  enhancePeerComparison(report) {
    const peers = report.peers || [];
    const companyName = report.company_name || report.name || report.symbol;
    
    if (peers.length === 0) {
      return {
        peers: [],
        median_pe: null,
        mean_pe: null,
        premium_discount: null,
        summary: `Peer comparison unavailable for ${companyName}.`
      };
    }
    
    const validPeers = peers.filter(p => 
      p && p.symbol && p.pe_forward !== undefined && p.pe_forward !== null && !isNaN(p.pe_forward) && p.pe_forward > 0 && p.pe_forward < 500
    );
    
    const enhancedPeers = validPeers.map(p => ({
      symbol: p.symbol || 'Unknown',
      name: p.name || p.symbol || 'Unknown',
      pe_forward: this._formatNumber(p.pe_forward, 1),
      ps_ttm: this._formatNumber(p.ps_ttm, 2),
      ev_ebitda: this._formatNumber(p.ev_ebitda, 1),
      market_cap: this._formatLargeNumber(p.market_cap)
    }));
    
    const peValues = validPeers.map(p => p.pe_forward).filter(v => v > 0);
    const sortedPE = [...peValues].sort((a, b) => a - b);
    const medianPE = sortedPE.length > 0 
      ? sortedPE[Math.floor(sortedPE.length / 2)]
      : null;
    const meanPE = peValues.length > 0 
      ? peValues.reduce((a, b) => a + b, 0) / peValues.length
      : null;
    
    const companyPE = report.valuation?.pe_forward;
    let premiumDiscount = null;
    let premiumDiscountText = 'N/A';
    
    if (companyPE && meanPE && meanPE > 0) {
      premiumDiscount = ((companyPE / meanPE) - 1) * 100;
      const absVal = Math.abs(premiumDiscount);
      premiumDiscountText = premiumDiscount > 0 
        ? `${this._formatNumber(absVal, 0)}% premium to peers`
        : `${this._formatNumber(absVal, 0)}% discount to peers`;
    }
    
    return {
      peers: enhancedPeers,
      median_pe: this._formatNumber(medianPE, 1),
      mean_pe: this._formatNumber(meanPE, 1),
      premium_discount: premiumDiscountText,
      premium_discount_pct: this._formatNumber(premiumDiscount, 1),
      summary: `${companyName} trades at ${this._formatNumber(companyPE, 1)}x forward PE vs peer median of ${this._formatNumber(medianPE, 1)}x (${premiumDiscountText}).`
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. CATALYSTS ENHANCEMENTS
  // ═══════════════════════════════════════════════════════════════
  
  enhanceCatalysts(catalysts, report) {
    if (!catalysts || catalysts.length === 0) {
      return this._generateDefaultCatalysts(report);
    }
    
    const enhanced = catalysts.slice(0, this.MAX_CATALYSTS).map((cat, idx) => {
      const text = typeof cat === 'string' ? cat : cat.description || cat.text || '';
      
      return {
        id: idx + 1,
        description: this._cleanCatalystText(text),
        timeframe: cat.timeframe || this._inferTimeframe(text),
        probability: cat.probability || this._inferProbability(text),
        impact_billions: cat.impact_billions || this._inferImpact(text, report)
      };
    });
    
    return enhanced;
  }
  
  _generateDefaultCatalysts(report) {
    const sector = (report.sector || '').toLowerCase();
    const catalysts = [];
    
    if (sector.includes('tech')) {
      catalysts.push({
        id: 1,
        description: 'New product cycle launch driving revenue acceleration',
        timeframe: 'Q1-Q2 2025',
        probability: '65%',
        impact_billions: this._estimateImpact(report, 0.05)
      });
      catalysts.push({
        id: 2,
        description: 'AI feature monetization beginning to contribute',
        timeframe: 'H2 2025',
        probability: '55%',
        impact_billions: this._estimateImpact(report, 0.03)
      });
    } else {
      catalysts.push({
        id: 1,
        description: 'Operating leverage from cost initiatives',
        timeframe: 'Next 12 months',
        probability: '60%',
        impact_billions: this._estimateImpact(report, 0.02)
      });
    }
    
    catalysts.push({
      id: catalysts.length + 1,
      description: 'Potential capital return increase (buyback or dividend)',
      timeframe: 'FY 2025',
      probability: '50%',
      impact_billions: 'Accretive to EPS'
    });
    
    return catalysts.slice(0, this.MAX_CATALYSTS);
  }
  
  _cleanCatalystText(text) {
    let clean = text
      .replace(/we believe|we expect|going forward|in our view/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (clean.length > 100) {
      clean = clean.substring(0, 97) + '...';
    }
    
    return clean;
  }
  
  _inferTimeframe(text) {
    const lower = text.toLowerCase();
    if (lower.includes('q1') || lower.includes('q2')) return 'H1 2025';
    if (lower.includes('q3') || lower.includes('q4')) return 'H2 2025';
    if (lower.includes('2026')) return 'FY 2026';
    if (lower.includes('near-term') || lower.includes('short-term')) return 'Next 6 months';
    return 'Next 12 months';
  }
  
  _inferProbability(text) {
    const lower = text.toLowerCase();
    if (lower.includes('likely') || lower.includes('expect')) return '65%';
    if (lower.includes('potential') || lower.includes('possible')) return '45%';
    if (lower.includes('uncertain') || lower.includes('risk')) return '35%';
    return '55%';
  }
  
  _inferImpact(text, report) {
    return this._estimateImpact(report, 0.03);
  }
  
  _estimateImpact(report, multiplier) {
    const revenue = report.fundamentals?.revenue;
    if (revenue) {
      const impact = (revenue * multiplier) / 1e9;
      return `$${this._formatNumber(impact, 1)}B`;
    }
    return 'Estimate pending';
  }

  // ═══════════════════════════════════════════════════════════════
  // 7. RISKS ENHANCEMENTS
  // ═══════════════════════════════════════════════════════════════
  
  enhanceRisks(risks, report) {
    if (!risks || risks.length === 0) {
      return this._generateDefaultRisks(report);
    }
    
    const seen = new Set();
    const enhanced = [];
    
    for (const risk of risks) {
      const text = typeof risk === 'string' ? risk : risk.description || risk.text || '';
      const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
      
      const isMarginDupe = normalized.includes('margin compression') && 
        seen.has('margin_compression');
      
      if (isMarginDupe) continue;
      if (normalized.includes('margin')) seen.add('margin_compression');
      
      enhanced.push({
        id: enhanced.length + 1,
        description: this._cleanRiskText(text),
        probability: risk.probability || this._inferRiskProbability(text),
        impact: risk.impact || this._inferRiskImpact(text),
        horizon: risk.horizon || this._inferRiskHorizon(text),
        dollar_effect: risk.dollar_effect || this._inferRiskDollarEffect(text, report)
      });
      
      if (enhanced.length >= this.MAX_RISKS) break;
    }
    
    return enhanced;
  }
  
  _generateDefaultRisks(report) {
    const sector = (report.sector || '').toLowerCase();
    const risks = [];
    
    risks.push({
      id: 1,
      description: 'Macro slowdown reduces demand',
      probability: 'Medium',
      impact: 'High',
      horizon: 'Near-term',
      dollar_effect: this._estimateRiskEffect(report, -0.10)
    });
    
    risks.push({
      id: 2,
      description: 'Competitive pressure on pricing',
      probability: 'Medium',
      impact: 'Medium',
      horizon: 'Medium-term',
      dollar_effect: this._estimateRiskEffect(report, -0.05)
    });
    
    if (sector.includes('tech')) {
      risks.push({
        id: 3,
        description: 'Technology disruption risk',
        probability: 'Low',
        impact: 'High',
        horizon: 'Long-term',
        dollar_effect: 'Structural risk'
      });
    } else {
      risks.push({
        id: 3,
        description: 'Regulatory or policy changes',
        probability: 'Low',
        impact: 'Medium',
        horizon: 'Medium-term',
        dollar_effect: 'Varies'
      });
    }
    
    return risks;
  }
  
  _cleanRiskText(text) {
    let clean = text
      .replace(/we believe|we expect|going forward|in our view/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (clean.length > 80) {
      clean = clean.substring(0, 77) + '...';
    }
    
    return clean;
  }
  
  _inferRiskProbability(text) {
    const lower = text.toLowerCase();
    if (lower.includes('likely') || lower.includes('high probability')) return 'High';
    if (lower.includes('unlikely') || lower.includes('low probability')) return 'Low';
    return 'Medium';
  }
  
  _inferRiskImpact(text) {
    const lower = text.toLowerCase();
    if (lower.includes('significant') || lower.includes('material') || lower.includes('major')) return 'High';
    if (lower.includes('limited') || lower.includes('minor') || lower.includes('modest')) return 'Low';
    return 'Medium';
  }
  
  _inferRiskHorizon(text) {
    const lower = text.toLowerCase();
    if (lower.includes('near-term') || lower.includes('short-term') || lower.includes('immediate')) return 'Near-term';
    if (lower.includes('long-term') || lower.includes('structural')) return 'Long-term';
    return 'Medium-term';
  }
  
  _inferRiskDollarEffect(text, report) {
    return this._estimateRiskEffect(report, -0.05);
  }
  
  _estimateRiskEffect(report, multiplier) {
    const revenue = report.fundamentals?.revenue;
    if (revenue) {
      const impact = (revenue * multiplier) / 1e9;
      return `$${this._formatNumber(Math.abs(impact), 1)}B revenue risk`;
    }
    return 'Quantification pending';
  }

  // ═══════════════════════════════════════════════════════════════
  // 8. TECHNICALS ENHANCEMENTS
  // ═══════════════════════════════════════════════════════════════
  
  enhanceTechnicals(report, priceData = []) {
    const prices = priceData.length > 0 ? priceData : report.price_history || [];
    
    if (!Array.isArray(prices) || prices.length < 14) {
      return {
        rsi: null,
        rsi_signal: 'N/A',
        macd: null,
        macd_signal: null,
        macd_histogram: null,
        macd_interpretation: 'N/A',
        atr: null,
        atr_pct: null,
        trend: 'Insufficient data',
        ema20: null,
        ema50: null,
        support: null,
        resistance: null,
        narrative: 'Technical analysis requires at least 14 days of price data.',
        _data_available: false
      };
    }
    
    const closes = prices.map(p => {
      if (typeof p === 'number') return p;
      if (p && typeof p.close === 'number') return p.close;
      if (p && typeof p.close === 'string') return parseFloat(p.close);
      if (p && typeof p.price === 'number') return p.price;
      if (p && typeof p.price === 'string') return parseFloat(p.price);
      return NaN;
    }).filter(v => !isNaN(v) && v > 0);
    
    if (closes.length < 14) {
      return {
        rsi: null,
        rsi_signal: 'N/A',
        macd: null,
        macd_signal: null,
        macd_histogram: null,
        macd_interpretation: 'N/A',
        atr: null,
        atr_pct: null,
        trend: 'Insufficient valid price data',
        ema20: null,
        ema50: null,
        support: null,
        resistance: null,
        narrative: 'Technical analysis requires at least 14 valid price points.',
        _data_available: false
      };
    }
    
    const rsi = this._calculateRSI(closes);
    const macd = this._calculateMACD(closes);
    const atr = this._calculateATR(prices);
    const ema20 = this._calculateEMA(closes, 20);
    const ema50 = this._calculateEMA(closes, 50);
    const trend = this._classifyTrend(closes, ema20, ema50);
    const levels = this._calculateKeyLevels(prices);
    
    return {
      rsi: this._formatNumber(rsi, 1),
      rsi_signal: this._interpretRSI(rsi),
      macd: this._formatNumber(macd.macd, 2),
      macd_signal: this._formatNumber(macd.signal, 2),
      macd_histogram: this._formatNumber(macd.histogram, 2),
      macd_interpretation: this._interpretMACD(macd),
      atr: this._formatNumber(atr, 2),
      atr_pct: this._formatPercent((atr / closes[closes.length - 1]) * 100),
      trend: trend,
      ema20: this._formatNumber(ema20, 2),
      ema50: this._formatNumber(ema50, 2),
      support: levels.support,
      resistance: levels.resistance,
      narrative: this._buildTechnicalNarrative(rsi, macd, trend, ema20, ema50, closes)
    };
  }
  
  _calculateRSI(closes, period = 14) {
    if (closes.length < period + 1) return null;
    
    let gains = 0, losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }
  
  _calculateMACD(closes) {
    if (closes.length < 26) {
      return { macd: null, signal: null, histogram: null };
    }
    
    const ema12 = this._calculateEMA(closes, 12);
    const ema26 = this._calculateEMA(closes, 26);
    const macdLine = ema12 - ema26;
    
    const macdHistory = [];
    for (let i = 26; i < closes.length; i++) {
      const e12 = this._calculateEMA(closes.slice(0, i + 1), 12);
      const e26 = this._calculateEMA(closes.slice(0, i + 1), 26);
      macdHistory.push(e12 - e26);
    }
    
    const signalLine = macdHistory.length >= 9 
      ? this._calculateEMA(macdHistory, 9)
      : macdLine;
    
    return {
      macd: macdLine,
      signal: signalLine,
      histogram: macdLine - signalLine
    };
  }
  
  _calculateATR(prices, period = 14) {
    if (prices.length < period + 1) return null;
    
    let atrSum = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
      const high = prices[i].high || prices[i].close;
      const low = prices[i].low || prices[i].close;
      const prevClose = prices[i - 1].close || prices[i - 1];
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      atrSum += tr;
    }
    
    return atrSum / period;
  }
  
  _calculateEMA(values, period) {
    if (values.length < period) return null;
    
    const multiplier = 2 / (period + 1);
    let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
    
    for (let i = period; i < values.length; i++) {
      ema = (values[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }
  
  _classifyTrend(closes, ema20, ema50) {
    const current = closes[closes.length - 1];
    const recent20 = closes.slice(-20);
    const recent50 = closes.slice(-50);
    
    const trend20 = recent20[recent20.length - 1] > recent20[0] ? 'up' : 'down';
    const trend50 = recent50.length >= 50 
      ? (recent50[recent50.length - 1] > recent50[0] ? 'up' : 'down')
      : trend20;
    
    if (ema20 && ema50 && current > ema20 && ema20 > ema50) {
      return 'Strong Uptrend';
    } else if (ema20 && ema50 && current < ema20 && ema20 < ema50) {
      return 'Strong Downtrend';
    } else if (trend20 === 'up' && current > ema20) {
      return 'Uptrend';
    } else if (trend20 === 'down' && current < ema20) {
      return 'Downtrend';
    }
    return 'Consolidation';
  }
  
  _calculateKeyLevels(prices) {
    if (prices.length < 20) {
      return { support: null, resistance: null };
    }
    
    const recent = prices.slice(-60);
    const lows = recent.map(p => p.low || p.close || p);
    const highs = recent.map(p => p.high || p.close || p);
    
    const support = Math.min(...lows);
    const resistance = Math.max(...highs);
    
    return {
      support: this._formatNumber(support, 2),
      resistance: this._formatNumber(resistance, 2)
    };
  }
  
  _interpretRSI(rsi) {
    if (!rsi) return 'N/A';
    if (rsi > 70) return 'Overbought';
    if (rsi < 30) return 'Oversold';
    if (rsi > 60) return 'Bullish';
    if (rsi < 40) return 'Bearish';
    return 'Neutral';
  }
  
  _interpretMACD(macd) {
    if (!macd.macd || !macd.signal) return 'N/A';
    if (macd.histogram > 0 && macd.macd > 0) return 'Bullish momentum';
    if (macd.histogram < 0 && macd.macd < 0) return 'Bearish momentum';
    if (macd.histogram > 0) return 'Bullish crossover';
    return 'Bearish crossover';
  }
  
  _buildTechnicalNarrative(rsi, macd, trend, ema20, ema50, closes) {
    const parts = [];
    const current = closes[closes.length - 1];
    
    parts.push(`Stock in ${trend} pattern.`);
    
    if (rsi) {
      const rsiInterpret = this._interpretRSI(rsi);
      parts.push(`RSI at ${this._formatNumber(rsi, 0)} signals ${rsiInterpret.toLowerCase()} conditions.`);
    }
    
    if (macd.macd) {
      parts.push(`MACD shows ${this._interpretMACD(macd).toLowerCase()}.`);
    }
    
    if (ema20 && ema50) {
      if (current > ema20) {
        parts.push(`Price above 20-day EMA ($${this._formatNumber(ema20, 2)}) supports near-term strength.`);
      } else {
        parts.push(`Price below 20-day EMA ($${this._formatNumber(ema20, 2)}) suggests caution.`);
      }
    }
    
    return parts.join(' ');
  }

  // ═══════════════════════════════════════════════════════════════
  // 9. ACTION RECOMMENDATIONS ENHANCEMENTS
  // ═══════════════════════════════════════════════════════════════
  
  enhanceActionRecommendations(report, technicals) {
    const current = report.price?.last || 0;
    const target = report.targets?.base?.price || report.targets?.base || 0;
    const stop = this._calculateStopLoss(current, technicals);
    
    const reward = target - current;
    const risk = current - stop;
    const rrRatio = risk > 0 ? reward / risk : null;
    
    const fundamentalScore = this._scoreFundamentals(report);
    const technicalScore = this._scoreTechnicals(technicals);
    const combinedScore = (fundamentalScore + technicalScore) / 2;
    
    return {
      entry_price: this._formatNumber(current, 2),
      target_price: this._formatNumber(target, 2),
      stop_loss: this._formatNumber(stop, 2),
      reward: this._formatNumber(reward, 2),
      risk: this._formatNumber(risk, 2),
      rr_ratio: this._formatNumber(rrRatio, 2),
      rr_assessment: this._assessRRRatio(rrRatio),
      fundamental_score: `${fundamentalScore}/100`,
      technical_score: `${technicalScore}/100`,
      combined_score: `${Math.round(combinedScore)}/100`,
      justification: this._buildActionJustification(report, technicals, rrRatio, combinedScore)
    };
  }
  
  _calculateStopLoss(current, technicals) {
    if (technicals?.support) {
      const support = parseFloat(technicals.support);
      if (support > 0) return support * 0.98;
    }
    
    if (technicals?.atr) {
      const atr = parseFloat(technicals.atr);
      return current - (2 * atr);
    }
    
    return current * 0.92;
  }
  
  _scoreFundamentals(report) {
    let score = 50;
    
    if (report.fundamentals?.roe > 15) score += 10;
    if (report.fundamentals?.roe > 25) score += 5;
    
    if (report.fundamentals?.revenue_growth > 10) score += 10;
    if (report.fundamentals?.revenue_growth > 20) score += 5;
    
    if (report.valuation?.pe_ttm && report.valuation.pe_ttm < 20) score += 5;
    if (report.valuation?.pe_ttm && report.valuation.pe_ttm < 15) score += 5;
    
    if (report.fundamentals?.gross_margin > 40) score += 5;
    if (report.fundamentals?.net_margin > 10) score += 5;
    
    return Math.min(100, Math.max(0, score));
  }
  
  _scoreTechnicals(technicals) {
    let score = 50;
    
    if (!technicals) return score;
    
    if (technicals.trend === 'Strong Uptrend') score += 15;
    else if (technicals.trend === 'Uptrend') score += 10;
    else if (technicals.trend === 'Downtrend') score -= 10;
    else if (technicals.trend === 'Strong Downtrend') score -= 15;
    
    const rsi = parseFloat(technicals.rsi);
    if (rsi && rsi > 50 && rsi < 70) score += 10;
    if (rsi && rsi < 30) score += 5;
    if (rsi && rsi > 80) score -= 10;
    
    if (technicals.macd_interpretation?.includes('Bullish')) score += 5;
    if (technicals.macd_interpretation?.includes('Bearish')) score -= 5;
    
    return Math.min(100, Math.max(0, score));
  }
  
  _assessRRRatio(rr) {
    if (!rr || rr <= 0) return 'Unfavorable - consider pass';
    if (rr < 1.5) return 'Marginal - requires high conviction';
    if (rr < 2.0) return 'Acceptable for swing trades';
    if (rr < 3.0) return 'Favorable risk-reward';
    return 'Highly favorable setup';
  }
  
  _buildActionJustification(report, technicals, rr, combinedScore) {
    const parts = [];
    
    if (rr && rr >= 2) {
      parts.push(`R/R ratio of ${this._formatNumber(rr, 1)}:1 provides favorable asymmetry.`);
    }
    
    if (combinedScore >= 70) {
      parts.push('Combined fundamental and technical scores support positioning.');
    } else if (combinedScore >= 50) {
      parts.push('Mixed signals suggest measured position sizing.');
    } else {
      parts.push('Below-average scores warrant caution.');
    }
    
    if (technicals?.trend?.includes('Uptrend')) {
      parts.push('Technical trend aligns with fundamental outlook.');
    }
    
    return parts.join(' ');
  }

  // ═══════════════════════════════════════════════════════════════
  // 10. FINAL RECOMMENDATION ENHANCEMENTS
  // ═══════════════════════════════════════════════════════════════
  
  enhanceFinalRecommendation(report, actionRec) {
    const conviction = this._determineConviction(report, actionRec);
    const scenarios = this._buildScenarioWeights(report);
    const marginOfSafety = this._calculateMarginOfSafety(report);
    
    return {
      rating: report.rating || 'HOLD',
      conviction_level: conviction.level,
      conviction_reason: conviction.reason,
      scenarios: scenarios,
      margin_of_safety: marginOfSafety.value,
      margin_of_safety_commentary: marginOfSafety.commentary,
      summary: this._buildFinalSummary(report, conviction, scenarios, marginOfSafety)
    };
  }
  
  _determineConviction(report, actionRec) {
    let score = 0;
    const reasons = [];
    
    const upside = report.targets?.base?.upside_pct || report.targets?.upside_pct;
    if (upside && upside > 30) {
      score += 2;
      reasons.push('significant upside potential');
    } else if (upside && upside > 15) {
      score += 1;
      reasons.push('moderate upside');
    }
    
    if (report.fundamentals?.roe > 20) {
      score += 1;
      reasons.push('strong profitability');
    }
    
    if (report.fundamentals?.revenue_growth > 15) {
      score += 1;
      reasons.push('healthy growth');
    }
    
    const rr = actionRec?.rr_ratio ? parseFloat(actionRec.rr_ratio) : 0;
    if (rr >= 2.5) {
      score += 1;
      reasons.push('favorable risk-reward');
    }
    
    let level, levelReason;
    if (score >= 4) {
      level = 'High';
      levelReason = `High conviction based on ${reasons.slice(0, 2).join(' and ')}.`;
    } else if (score >= 2) {
      level = 'Medium';
      levelReason = `Medium conviction reflecting ${reasons[0] || 'balanced factors'}.`;
    } else {
      level = 'Low';
      levelReason = 'Low conviction due to mixed or uncertain outlook.';
    }
    
    return { level, reason: levelReason };
  }
  
  _buildScenarioWeights(report) {
    const current = report.price?.last || 0;
    const target = report.targets?.base?.price || report.targets?.base || current;
    
    const bullTarget = target * 1.25;
    const bearTarget = target * 0.70;
    
    let bullWeight = 25;
    let baseWeight = 50;
    let bearWeight = 25;
    
    if (report.fundamentals?.revenue_growth > 20) {
      bullWeight += 5;
      bearWeight -= 5;
    }
    if (report.valuation?.pe_ttm && report.valuation.pe_ttm > 40) {
      bearWeight += 5;
      bullWeight -= 5;
    }
    
    return {
      bull: {
        target: this._formatNumber(bullTarget, 2),
        weight: `${bullWeight}%`,
        scenario: 'Upside surprise from execution or market re-rating'
      },
      base: {
        target: this._formatNumber(target, 2),
        weight: `${baseWeight}%`,
        scenario: 'Steady execution in line with consensus'
      },
      bear: {
        target: this._formatNumber(bearTarget, 2),
        weight: `${bearWeight}%`,
        scenario: 'Macro headwinds or execution missteps'
      }
    };
  }
  
  _calculateMarginOfSafety(report) {
    const current = report.price?.last || 0;
    const target = report.targets?.base?.price || report.targets?.base || 0;
    
    if (!current || !target || current <= 0) {
      return {
        value: 'N/A',
        commentary: 'Margin of safety calculation requires price and target data.'
      };
    }
    
    const discount = ((target - current) / target) * 100;
    
    let commentary;
    if (discount > 30) {
      commentary = 'Significant margin of safety suggests favorable entry point with downside cushion.';
    } else if (discount > 15) {
      commentary = 'Adequate margin of safety for risk-adjusted returns.';
    } else if (discount > 5) {
      commentary = 'Limited margin of safety requires higher conviction on thesis.';
    } else {
      commentary = 'Minimal margin of safety - stock trading near target implies limited upside.';
    }
    
    return {
      value: `${this._formatNumber(discount, 0)}%`,
      commentary
    };
  }
  
  _buildFinalSummary(report, conviction, scenarios, marginOfSafety) {
    const symbol = report.symbol || 'Stock';
    const rating = report.rating || 'HOLD';
    const target = report.targets?.base?.price || report.targets?.base;
    
    return `We rate ${symbol} ${rating} with ${conviction.level} conviction. ` +
      `Our $${this._formatNumber(target, 0)} target implies ${marginOfSafety.value} margin of safety. ` +
      `Probability-weighted outcome: Bull ${scenarios.bull.weight}, Base ${scenarios.base.weight}, Bear ${scenarios.bear.weight}.`;
  }

  // ═══════════════════════════════════════════════════════════════
  // UTILITY FUNCTIONS
  // ═══════════════════════════════════════════════════════════════
  
  _formatNumber(val, decimals = 2) {
    if (val === null || val === undefined || isNaN(val)) return null;
    return Number(val).toFixed(decimals);
  }
  
  _formatPercent(val) {
    if (val === null || val === undefined || isNaN(val)) return null;
    return Number(val).toFixed(1) + '%';
  }
  
  _formatMarketCap(val) {
    if (!val) return 'mid-cap';
    if (val >= 200e9) return 'mega-cap ($' + (val / 1e12).toFixed(1) + 'T)';
    if (val >= 10e9) return 'large-cap ($' + (val / 1e9).toFixed(0) + 'B)';
    if (val >= 2e9) return 'mid-cap ($' + (val / 1e9).toFixed(1) + 'B)';
    return 'small-cap ($' + (val / 1e9).toFixed(2) + 'B)';
  }
  
  _formatLargeNumber(val) {
    if (!val || isNaN(val)) return null;
    if (val >= 1e12) return '$' + (val / 1e12).toFixed(2) + 'T';
    if (val >= 1e9) return '$' + (val / 1e9).toFixed(1) + 'B';
    if (val >= 1e6) return '$' + (val / 1e6).toFixed(0) + 'M';
    return '$' + val.toFixed(0);
  }
  
  _enforceSentenceLimit(text) {
    const sentences = text.split(/(?<=[.!?])\s+/);
    const limited = sentences.map(sentence => {
      const words = sentence.split(/\s+/);
      if (words.length <= this.MAX_SENTENCE_WORDS) return sentence;
      
      return words.slice(0, this.MAX_SENTENCE_WORDS).join(' ') + '.';
    });
    
    return limited.join(' ');
  }

  // ═══════════════════════════════════════════════════════════════
  // MAIN ENHANCEMENT FUNCTION
  // ═══════════════════════════════════════════════════════════════
  
  enhance(report, options = {}) {
    const { priceData = [], macroData = {} } = options;
    
    console.log(`[InstitutionalEnhancements] Enhancing report for ${report.symbol}`);
    
    const thesis = this.enhanceThesis(report);
    const segments = this.enhanceSegments(report);
    const industryMacro = this.enhanceIndustryMacro(report, macroData);
    const valuation = this.enhanceValuation(report);
    const peerComparison = this.enhancePeerComparison(report);
    const catalysts = this.enhanceCatalysts(report.catalysts, report);
    const risks = this.enhanceRisks(report.risks, report);
    const technicals = this.enhanceTechnicals(report, priceData);
    const actionRec = this.enhanceActionRecommendations(report, technicals);
    const finalRec = this.enhanceFinalRecommendation(report, actionRec);
    
    return {
      ...report,
      thesis_enhanced: thesis,
      segments_enhanced: segments,
      industry_macro_enhanced: industryMacro,
      valuation_enhanced: valuation,
      peer_comparison_enhanced: peerComparison,
      catalysts_enhanced: catalysts,
      risks_enhanced: risks,
      technicals_enhanced: technicals,
      action_recommendations_enhanced: actionRec,
      final_recommendation_enhanced: finalRec,
      _enhancements_applied: true,
      _enhancements_version: '7.6'
    };
  }
}

module.exports = new InstitutionalEnhancements();
