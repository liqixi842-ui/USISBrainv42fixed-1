/**
 * ═══════════════════════════════════════════════════════════════
 * PIPELINE ORCHESTRATOR
 * ═══════════════════════════════════════════════════════════════
 * 
 * Main orchestration layer for the institutional report generation pipeline
 * 
 * Pipeline Flow:
 * 1. DataFetcher → Raw data from APIs
 * 2. DataValidator → Validation + quality assessment
 * 3. ChartDataCollector → Transform to chart-ready series
 * 4. ChartEngine → Generate QuickChart URLs
 * 5. LanguageNormalizer → Sell-side text processing
 * 6. ReportRenderer → Build structured report object
 * 7. QA/Check → Final quality validation
 * 
 * Output JSON Format:
 * {
 *   ticker: "NVDA",
 *   status: "ok" | "degraded" | "error",
 *   data_validation: { prices: true, revenue: false, ... },
 *   charts: [{ name, url, points, error? }],
 *   qa: { placeholders_found, duplicate_words, ... },
 *   report: { ... structured report object ... },
 *   report_url: "https://...",
 *   _meta: { timing, sources, errors }
 * }
 */

const dataFetcher = require('./dataFetcher');
const dataValidator = require('./dataValidator');
const chartDataCollector = require('./chartDataCollector');
const chartEngine = require('./chartEngine');
const languageNormalizer = require('./languageNormalizer');
const qaChecker = require('./qaChecker');
const llmPromptTemplate = require('./llmPromptTemplate');
const institutionalEnhancements = require('./institutionalEnhancements');

class PipelineOrchestrator {
  constructor() {
    this.stages = [
      'fetch', 'validate', 'collect_charts', 'generate_charts', 
      'render', 'enhance', 'normalize', 'qa_check'
    ];
  }

  async execute(symbol, options = {}) {
    const startTime = Date.now();
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`[Pipeline] Starting report generation for ${symbol}`);
    console.log(`${'═'.repeat(60)}\n`);
    
    const result = {
      ticker: symbol.toUpperCase(),
      status: 'ok',
      data_validation: {},
      charts: [],
      qa: {},
      report: null,
      report_url: null,
      errors: [],
      _meta: {
        timestamp: new Date().toISOString(),
        pipeline_version: '1.0',
        stages_completed: [],
        timing: {}
      }
    };

    try {
      console.log(`\n[Stage 1/8] DataFetcher`);
      const fetchStart = Date.now();
      const rawData = await dataFetcher.fetch(symbol);
      result._meta.timing.fetch = Date.now() - fetchStart;
      result._meta.stages_completed.push('fetch');
      
      console.log(`\n[Stage 2/8] DataValidator`);
      const validateStart = Date.now();
      const validatedData = dataValidator.validate(rawData);
      result._meta.timing.validate = Date.now() - validateStart;
      result._meta.stages_completed.push('validate');
      
      result.data_validation = validatedData.validations;
      
      if (!validatedData.valid) {
        result.status = 'error';
        result.errors.push(...validatedData.errors);
        console.log(`[Pipeline] ❌ Validation failed - cannot continue`);
        return this._finalize(result, startTime);
      }
      
      if (validatedData.degraded) {
        result.status = 'degraded';
        result.errors.push(...validatedData.warnings);
      }

      console.log(`\n[Stage 3/8] ChartDataCollector`);
      const collectStart = Date.now();
      const chartData = chartDataCollector.collect(validatedData);
      result._meta.timing.collect_charts = Date.now() - collectStart;
      result._meta.stages_completed.push('collect_charts');

      console.log(`\n[Stage 4/8] ChartEngine`);
      const chartStart = Date.now();
      const chartsResult = await chartEngine.generate(chartData);
      result._meta.timing.generate_charts = Date.now() - chartStart;
      result._meta.stages_completed.push('generate_charts');
      
      result.charts = chartsResult.charts;

      console.log(`\n[Stage 5/8] ReportRenderer`);
      const renderStart = Date.now();
      const rawReport = this._buildReportObject(validatedData.data, chartsResult, options);
      result._meta.timing.render = Date.now() - renderStart;
      result._meta.stages_completed.push('render');

      console.log(`\n[Stage 6/8] InstitutionalEnhancements`);
      const enhanceStart = Date.now();
      const enhancedReport = institutionalEnhancements.enhance(rawReport, {
        priceData: rawData.prices || [],
        macroData: options.macroData || {}
      });
      result._meta.timing.enhance = Date.now() - enhanceStart;
      result._meta.stages_completed.push('enhance');

      console.log(`\n[Stage 7/8] LanguageNormalizer`);
      const normalizeStart = Date.now();
      result.report = this._normalizeReportText(enhancedReport);
      result._meta.timing.normalize = Date.now() - normalizeStart;
      result._meta.stages_completed.push('normalize');

      console.log(`\n[Stage 8/8] QA/Check`);
      const qaStart = Date.now();
      
      const companyName = result.report.company_name || 
                          validatedData.data?.profile?.name ||
                          rawData?.profile?.name ||
                          options.companyName || 
                          symbol.toUpperCase();
      
      const finalQAResult = qaChecker.runFinalQA(result.report, {
        companyName: companyName,
        symbol: symbol.toUpperCase()
      });
      
      result._meta.timing.qa_check = Date.now() - qaStart;
      result._meta.stages_completed.push('qa_check');
      
      result.report = finalQAResult.report;
      result.charts = finalQAResult.report.charts || result.charts;
      
      result.qa = {
        placeholders_found: finalQAResult.qa_result.placeholders_found,
        duplicate_words: finalQAResult.qa_result.duplicate_words,
        nan_values: finalQAResult.qa_result.nan_values,
        chart_errors: finalQAResult.qa_result.chart_errors,
        formatting_issues: finalQAResult.qa_result.formatting_issues,
        passed: finalQAResult.qa_result.passed,
        ready_for_pdf: finalQAResult.ready_for_pdf,
        chart_debug: result.report._chart_debug || null
      };

      console.log(`\n${'═'.repeat(60)}`);
      console.log(`[Pipeline] ✅ Completed in ${Date.now() - startTime}ms`);
      console.log(`[Pipeline] Status: ${result.status}, QA Passed: ${finalQAResult.qa_result.passed}`);
      console.log(`[Pipeline] Ready for PDF: ${finalQAResult.ready_for_pdf}`);
      console.log(`${'═'.repeat(60)}\n`);

    } catch (error) {
      result.status = 'error';
      result.errors.push(error.message);
      console.error(`[Pipeline] ❌ Fatal error: ${error.message}`);
    }

    return this._finalize(result, startTime);
  }

  _buildReportObject(data, chartsResult, options) {
    const fmt = (val, decimals = 2) => {
      if (val == null || isNaN(val)) return 'N/A';
      return parseFloat(val).toFixed(decimals);
    };

    const fmtPct = (val) => {
      if (val == null || isNaN(val)) return 'N/A';
      return parseFloat(val).toFixed(1) + '%';
    };

    const fmtCurrency = (val) => {
      if (val == null || isNaN(val)) return 'N/A';
      if (val >= 1e12) return '$' + (val / 1e12).toFixed(2) + 'T';
      if (val >= 1e9) return '$' + (val / 1e9).toFixed(2) + 'B';
      if (val >= 1e6) return '$' + (val / 1e6).toFixed(2) + 'M';
      return '$' + val.toLocaleString();
    };

    const report = {
      executive_summary: {
        ticker: data.ticker,
        rating: data.fundamentals?.roe > 20 ? 'BUY' : data.fundamentals?.roe > 10 ? 'HOLD' : 'NEUTRAL',
        price_target: data.fundamentals?.price ? fmt(data.fundamentals.price * 1.15) : 'N/A',
        current_price: fmt(data.fundamentals?.price),
        rationale: this._generateRationale(data),
        buy_reasons: this._generateBuyReasons(data),
        risk_factors: this._generateRiskFactors(data),
        data_warnings: []
      },

      key_metrics: {
        market_cap: fmtCurrency(data.fundamentals?.market_cap),
        pe_ttm: fmt(data.fundamentals?.pe_ttm, 1) + 'x',
        pe_forward: fmt(data.fundamentals?.pe_forward, 1) + 'x',
        ps_ttm: fmt(data.fundamentals?.ps_ttm, 1) + 'x',
        pb: fmt(data.fundamentals?.pb, 1) + 'x',
        div_yield: fmtPct(data.fundamentals?.div_yield),
        gross_margin: fmtPct(data.fundamentals?.gross_margin),
        operating_margin: fmtPct(data.fundamentals?.operating_margin),
        net_margin: fmtPct(data.fundamentals?.net_margin),
        roe: fmtPct(data.fundamentals?.roe),
        roa: fmtPct(data.fundamentals?.roa),
        beta: fmt(data.fundamentals?.beta, 2)
      },

      investment_thesis: {
        moat: this._generateMoatAnalysis(data),
        growth_drivers: this._generateGrowthDrivers(data),
        margin_analysis: this._generateMarginAnalysis(data)
      },

      segment_overview: this._generateSegmentOverview(data),

      industry_macro: {
        tam: data.industry?.tam ? fmtCurrency(data.industry.tam) : 'N/A',
        cagr: data.industry?.cagr ? fmtPct(data.industry.cagr * 100) : 'N/A',
        cycle_position: data.industry?.cycle_position || 'N/A',
        key_trends: this._generateIndustryTrends(data)
      },

      valuation: {
        current_pe: fmt(data.fundamentals?.pe_ttm, 1),
        historical_pe_median: 'N/A',
        percentile_5y: 'N/A',
        peer_comparison: this._generatePeerComparison(data),
        scenario_analysis: this._generateScenarioAnalysis(data)
      },

      financial_trends: {
        revenue_chart: chartsResult.charts.find(c => c.name === 'revenue_trend')?.url || null,
        eps_chart: chartsResult.charts.find(c => c.name === 'eps_trend')?.url || null,
        revenue_growth: this._calculateRevenueGrowth(data),
        eps_growth: this._calculateEpsGrowth(data)
      },

      catalysts: this._generateCatalysts(data),

      risks: this._generateRisks(data),

      technicals: {
        price_chart: chartsResult.charts.find(c => c.name === 'price_90')?.url || null,
        volume_chart: chartsResult.charts.find(c => c.name === 'volume_90')?.url || null,
        trend: data.prices?.length > 20 ? this._calculateTrend(data.prices) : 'N/A',
        support: 'N/A',
        resistance: 'N/A',
        rsi: 'N/A'
      },

      final_recommendation: {
        rating: data.fundamentals?.roe > 20 ? 'BUY' : data.fundamentals?.roe > 10 ? 'HOLD' : 'NEUTRAL',
        conviction: data.fundamentals?.roe > 25 ? 'High' : 'Medium',
        time_horizon: '12-18 months',
        scenario_weights: {
          bull: 25,
          base: 55,
          bear: 20
        }
      },

      charts: chartsResult.charts,

      _meta: {
        generated_at: new Date().toISOString(),
        data_sources: data._meta?.sources_used || [],
        pipeline_version: '1.0'
      }
    };

    return report;
  }

  _generateRationale(data) {
    const f = data.fundamentals || {};
    if (f.roe > 25 && f.gross_margin > 50) {
      return `${data.ticker} demonstrates robust profitability with ROE of ${f.roe?.toFixed(1)}% and gross margins of ${f.gross_margin?.toFixed(1)}%, indicating strong competitive positioning.`;
    }
    if (f.roe > 15) {
      return `${data.ticker} shows solid fundamentals with above-average returns on equity and stable margin profile.`;
    }
    return `${data.ticker} presents a mixed fundamental picture requiring careful position sizing.`;
  }

  _generateBuyReasons(data) {
    const reasons = [];
    const f = data.fundamentals || {};
    
    if (f.roe > 20) reasons.push(`Strong ROE of ${f.roe?.toFixed(1)}% indicates efficient capital allocation`);
    if (f.gross_margin > 50) reasons.push(`Gross margin of ${f.gross_margin?.toFixed(1)}% demonstrates pricing power`);
    if (f.pe_forward && f.pe_forward < 25) reasons.push(`Forward P/E of ${f.pe_forward?.toFixed(1)}x suggests reasonable valuation`);
    
    while (reasons.length < 3) {
      reasons.push('Additional catalysts under evaluation');
    }
    
    return reasons.slice(0, 3);
  }

  _generateRiskFactors(data) {
    const risks = [];
    const f = data.fundamentals || {};
    
    if (f.pe_ttm > 40) risks.push({ factor: 'Elevated valuation', probability: 'Medium', impact: 'High' });
    if (f.beta > 1.3) risks.push({ factor: 'Above-average volatility', probability: 'High', impact: 'Medium' });
    if (!f.div_yield) risks.push({ factor: 'No dividend income buffer', probability: 'Low', impact: 'Low' });
    
    while (risks.length < 3) {
      risks.push({ factor: 'Macro/sector headwinds', probability: 'Medium', impact: 'Medium' });
    }
    
    return risks.slice(0, 3);
  }

  _generateMoatAnalysis(data) {
    const f = data.fundamentals || {};
    if (f.gross_margin > 60) {
      return `Exceptional gross margins of ${f.gross_margin?.toFixed(1)}% indicate substantial competitive advantages, likely driven by proprietary technology, brand strength, or network effects.`;
    }
    if (f.gross_margin > 40) {
      return `Above-average gross margins of ${f.gross_margin?.toFixed(1)}% suggest moderate competitive advantages in the company's core markets.`;
    }
    return 'Competitive positioning requires further analysis to identify sustainable advantages.';
  }

  _generateGrowthDrivers(data) {
    const growth = this._calculateRevenueGrowth(data);
    if (growth !== 'N/A' && parseFloat(growth) > 20) {
      return `Revenue growth of ${growth} demonstrates strong demand momentum. Key drivers include market share gains and product expansion.`;
    }
    return 'Growth drivers include market expansion, product innovation, and operational efficiency improvements.';
  }

  _generateMarginAnalysis(data) {
    const f = data.fundamentals || {};
    return `Operating margin of ${f.operating_margin?.toFixed(1) || 'N/A'}% and net margin of ${f.net_margin?.toFixed(1) || 'N/A'}% reflect the company's ability to convert revenue to profit efficiently.`;
  }

  _generateSegmentOverview(data) {
    return [{
      name: 'Primary Business',
      revenue_share: '100%',
      yoy_growth: this._calculateRevenueGrowth(data),
      margin: data.fundamentals?.operating_margin?.toFixed(1) + '%' || 'N/A'
    }];
  }

  _generateIndustryTrends(data) {
    return [
      'Digital transformation driving demand',
      'Competitive dynamics evolving',
      'Regulatory environment stable'
    ];
  }

  _generatePeerComparison(data) {
    if (!data.peers || data.peers.length === 0) {
      return [{ note: 'Peer data unavailable' }];
    }
    
    return data.peers.slice(0, 5).map(p => ({
      ticker: p.ticker,
      pe_forward: p.pe_forward?.toFixed(1) + 'x' || 'N/A',
      ps_ttm: p.ps_ttm?.toFixed(1) + 'x' || 'N/A',
      roe: p.roe?.toFixed(1) + '%' || 'N/A'
    }));
  }

  _generateScenarioAnalysis(data) {
    const price = data.fundamentals?.price || 100;
    return {
      bull: { target: (price * 1.30).toFixed(2), probability: 25, rationale: 'Multiple expansion + beat estimates' },
      base: { target: (price * 1.10).toFixed(2), probability: 55, rationale: 'In-line execution' },
      bear: { target: (price * 0.85).toFixed(2), probability: 20, rationale: 'Miss estimates + multiple compression' }
    };
  }

  _generateCatalysts(data) {
    return [
      { event: 'Earnings release', timeframe: 'Q1 2026', impact: 'Beat expectations could drive re-rating' },
      { event: 'Product launch', timeframe: 'H1 2026', impact: 'New revenue stream potential' },
      { event: 'Market expansion', timeframe: '12-18 months', impact: 'TAM expansion opportunity' }
    ].slice(0, 3);
  }

  _generateRisks(data) {
    return [
      { risk: 'Competitive pressure', probability: 'Medium', impact: 'Medium', horizon: '12 months', financial_impact: 'Margin compression 100-200bps' },
      { risk: 'Macro slowdown', probability: 'Medium', impact: 'High', horizon: '6-12 months', financial_impact: 'Revenue growth deceleration' },
      { risk: 'Execution risk', probability: 'Low', impact: 'Medium', horizon: '12-24 months', financial_impact: 'Product delays' }
    ].slice(0, 3);
  }

  _calculateRevenueGrowth(data) {
    if (!data.revenue_quarters || data.revenue_quarters.length < 5) return 'N/A';
    
    const recent = data.revenue_quarters.slice(-4);
    const prior = data.revenue_quarters.slice(-8, -4);
    
    if (recent.length < 4 || prior.length < 4) return 'N/A';
    
    const recentSum = recent.reduce((s, q) => s + (q.revenue || 0), 0);
    const priorSum = prior.reduce((s, q) => s + (q.revenue || 0), 0);
    
    if (priorSum === 0) return 'N/A';
    
    const growth = ((recentSum / priorSum) - 1) * 100;
    return growth.toFixed(1) + '%';
  }

  _calculateEpsGrowth(data) {
    if (!data.eps_quarters || data.eps_quarters.length < 5) return 'N/A';
    
    const recent = data.eps_quarters.slice(-4);
    const prior = data.eps_quarters.slice(-8, -4);
    
    if (recent.length < 4 || prior.length < 4) return 'N/A';
    
    const recentSum = recent.reduce((s, q) => s + (q.eps || 0), 0);
    const priorSum = prior.reduce((s, q) => s + (q.eps || 0), 0);
    
    if (priorSum === 0) return 'N/A';
    
    const growth = ((recentSum / priorSum) - 1) * 100;
    return growth.toFixed(1) + '%';
  }

  _calculateTrend(prices) {
    if (prices.length < 20) return 'N/A';
    
    const recent = prices.slice(-5).reduce((s, p) => s + p.close, 0) / 5;
    const prior = prices.slice(-20, -15).reduce((s, p) => s + p.close, 0) / 5;
    
    if (recent > prior * 1.05) return 'Uptrend';
    if (recent < prior * 0.95) return 'Downtrend';
    return 'Sideways';
  }

  _finalize(result, startTime) {
    result._meta.total_time_ms = Date.now() - startTime;
    result._meta.stages_count = result._meta.stages_completed.length;
    return result;
  }

  getLLMPrompt(data) {
    return llmPromptTemplate.generate(data);
  }

  _normalizeReportText(report) {
    const normalizedReport = JSON.parse(JSON.stringify(report));
    
    if (normalizedReport.executive_summary?.rationale) {
      const result = languageNormalizer.normalize(normalizedReport.executive_summary.rationale, 'general');
      normalizedReport.executive_summary.rationale = result.text;
    }

    if (normalizedReport.investment_thesis) {
      if (normalizedReport.investment_thesis.moat) {
        const result = languageNormalizer.normalize(normalizedReport.investment_thesis.moat, 'thesis');
        normalizedReport.investment_thesis.moat = result.text;
      }
      if (normalizedReport.investment_thesis.growth_drivers) {
        const result = languageNormalizer.normalize(normalizedReport.investment_thesis.growth_drivers, 'thesis');
        normalizedReport.investment_thesis.growth_drivers = result.text;
      }
      if (normalizedReport.investment_thesis.margin_analysis) {
        const result = languageNormalizer.normalize(normalizedReport.investment_thesis.margin_analysis, 'thesis');
        normalizedReport.investment_thesis.margin_analysis = result.text;
      }
    }

    if (normalizedReport.thesis_enhanced) {
      if (normalizedReport.thesis_enhanced.moat) {
        normalizedReport.thesis_enhanced.moat = languageNormalizer.cleanTextLight(normalizedReport.thesis_enhanced.moat);
      }
      if (normalizedReport.thesis_enhanced.growth_drivers) {
        normalizedReport.thesis_enhanced.growth_drivers = languageNormalizer.cleanTextLight(normalizedReport.thesis_enhanced.growth_drivers);
      }
      if (normalizedReport.thesis_enhanced.margin_strength) {
        normalizedReport.thesis_enhanced.margin_strength = languageNormalizer.cleanTextLight(normalizedReport.thesis_enhanced.margin_strength);
      }
    }

    if (normalizedReport.industry_macro?.key_trends) {
      normalizedReport.industry_macro.key_trends = normalizedReport.industry_macro.key_trends.map(trend => 
        languageNormalizer.cleanTextLight(trend)
      );
    }

    if (normalizedReport.industry_macro_enhanced?.key_trends) {
      normalizedReport.industry_macro_enhanced.key_trends = normalizedReport.industry_macro_enhanced.key_trends.map(trend => 
        languageNormalizer.cleanTextLight(trend)
      );
    }

    if (normalizedReport.catalysts_enhanced) {
      normalizedReport.catalysts_enhanced = normalizedReport.catalysts_enhanced.map(cat => ({
        ...cat,
        description: languageNormalizer.cleanTextLight(cat.description || '')
      }));
    }

    if (normalizedReport.risks_enhanced) {
      normalizedReport.risks_enhanced = normalizedReport.risks_enhanced.map(risk => ({
        ...risk,
        description: languageNormalizer.cleanTextLight(risk.description || '')
      }));
    }

    if (normalizedReport.technicals_enhanced?.narrative) {
      normalizedReport.technicals_enhanced.narrative = languageNormalizer.cleanTextLight(normalizedReport.technicals_enhanced.narrative);
    }

    if (normalizedReport.action_recommendations_enhanced?.justification) {
      normalizedReport.action_recommendations_enhanced.justification = languageNormalizer.cleanTextLight(normalizedReport.action_recommendations_enhanced.justification);
    }

    if (normalizedReport.final_recommendation_enhanced?.summary) {
      normalizedReport.final_recommendation_enhanced.summary = languageNormalizer.cleanTextLight(normalizedReport.final_recommendation_enhanced.summary);
    }

    console.log(`[LanguageNormalizer] Applied normalization to report sections`);
    return normalizedReport;
  }
}

module.exports = new PipelineOrchestrator();
