/**
 * ═══════════════════════════════════════════════════════════════
 * FINANCIAL DATA BROKER
 * ═══════════════════════════════════════════════════════════════
 * 
 * Unified financial data layer for research reports
 * Fetches real-time quotes, fundamentals, historical data from multiple sources
 * 
 * Data Source Priority:
 * 1. Finnhub (if FINNHUB_API_KEY exists)
 * 2. Twelve Data (if TWELVE_DATA_API_KEY exists)
 * 3. Alpha Vantage (if ALPHA_VANTAGE_API_KEY exists)
 * 
 * Core Functions:
 * - getQuote(symbol): Current price, 52W high/low, beta, market cap
 * - getKeyMetrics(symbol): ROE, ROA, margins, PE, PS, PB ratios
 * - getFinancialStatements(symbol): Revenue, EPS, 3Y/5Y trends
 * - getHistorySeries(symbol): 5-year Revenue & EPS series
 * - getAll(symbol): Complete financial dataset
 */

const fetch = require('node-fetch');

class FinancialDataBroker {
  constructor() {
    this.FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
    this.TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY;
    this.ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
    
    // Determine primary provider
    this.provider = this._detectProvider();
    
    console.log(`[FinancialDataBroker] Initialized with provider: ${this.provider}`);
  }

  /**
   * Detect available data provider
   * @returns {string} Provider name
   */
  _detectProvider() {
    if (this.FINNHUB_API_KEY) return 'finnhub';
    if (this.TWELVE_DATA_API_KEY) return 'twelve_data';
    if (this.ALPHA_VANTAGE_API_KEY) return 'alpha_vantage';
    return 'unavailable';
  }

  /**
   * Get real-time quote data
   * @param {string} symbol - Stock symbol
   * @returns {Promise<object>} Quote data
   */
  async getQuote(symbol) {
    console.log(`[FinancialDataBroker] Fetching quote for ${symbol}...`);
    
    if (this.provider === 'unavailable') {
      console.log(`[FinancialDataBroker] ⚠️  No API keys available - returning placeholder data`);
      return {
        price: null,
        change_abs: null,
        change_pct: null,
        high_1d: null,
        low_1d: null,
        high_52w: null,
        low_52w: null,
        open: null,
        previous_close: null,
        volume: null,
        market_cap: null,
        beta: null
      };
    }

    try {
      if (this.provider === 'finnhub') {
        return await this._getQuoteFinnhub(symbol);
      } else if (this.provider === 'twelve_data') {
        return await this._getQuoteTwelveData(symbol);
      } else if (this.provider === 'alpha_vantage') {
        return await this._getQuoteAlphaVantage(symbol);
      }
    } catch (error) {
      console.log(`[FinancialDataBroker] Quote fetch error: ${error.message}`);
      return {
        price: null,
        change_abs: null,
        change_pct: null,
        high_1d: null,
        low_1d: null,
        high_52w: null,
        low_52w: null,
        open: null,
        previous_close: null,
        volume: null,
        market_cap: null,
        beta: null
      };
    }
  }

  /**
   * Get key financial metrics (valuation & profitability)
   * @param {string} symbol - Stock symbol
   * @returns {Promise<object>} Key metrics
   */
  async getKeyMetrics(symbol) {
    console.log(`[FinancialDataBroker] Fetching key metrics for ${symbol}...`);
    
    if (this.provider === 'unavailable') {
      console.log(`[FinancialDataBroker] ⚠️  No API keys available - returning placeholder metrics`);
      return this._emptyMetrics();
    }

    try {
      if (this.provider === 'finnhub') {
        return await this._getMetricsFinnhub(symbol);
      } else if (this.provider === 'twelve_data') {
        return await this._getMetricsTwelveData(symbol);
      } else if (this.provider === 'alpha_vantage') {
        return await this._getMetricsAlphaVantage(symbol);
      }
    } catch (error) {
      console.log(`[FinancialDataBroker] Metrics fetch error: ${error.message}`);
      return this._emptyMetrics();
    }
  }

  /**
   * Get financial statements summary
   * @param {string} symbol - Stock symbol
   * @returns {Promise<object>} Financial statement data
   */
  async getFinancialStatements(symbol) {
    console.log(`[FinancialDataBroker] Fetching financial statements for ${symbol}...`);
    
    if (this.provider === 'unavailable') {
      console.log(`[FinancialDataBroker] ⚠️  No API keys available - returning placeholder financials`);
      return {
        revenue_ttm: null,
        revenue_3y_cagr: null,
        revenue_yoy_latest: null,
        eps_ttm: null,
        eps_3y_cagr: null,
        eps_yoy_latest: null
      };
    }

    try {
      if (this.provider === 'finnhub') {
        return await this._getFinancialsFinnhub(symbol);
      } else if (this.provider === 'twelve_data') {
        return await this._getFinancialsTwelveData(symbol);
      } else if (this.provider === 'alpha_vantage') {
        return await this._getFinancialsAlphaVantage(symbol);
      }
    } catch (error) {
      console.log(`[FinancialDataBroker] Financials fetch error: ${error.message}`);
      return {
        revenue_ttm: null,
        revenue_3y_cagr: null,
        revenue_yoy_latest: null,
        eps_ttm: null,
        eps_3y_cagr: null,
        eps_yoy_latest: null
      };
    }
  }

  /**
   * Get 5-year historical series (revenue & EPS)
   * @param {string} symbol - Stock symbol
   * @returns {Promise<object>} Historical series data
   */
  async getHistorySeries(symbol) {
    console.log(`[FinancialDataBroker] Fetching 5-year history for ${symbol}...`);
    
    if (this.provider === 'unavailable') {
      console.log(`[FinancialDataBroker] ⚠️  No API keys available - returning empty history`);
      return {
        revenue_5y: [],
        eps_5y: []
      };
    }

    try {
      if (this.provider === 'finnhub') {
        return await this._getHistoryFinnhub(symbol);
      } else if (this.provider === 'twelve_data') {
        return await this._getHistoryTwelveData(symbol);
      } else if (this.provider === 'alpha_vantage') {
        return await this._getHistoryAlphaVantage(symbol);
      }
    } catch (error) {
      console.log(`[FinancialDataBroker] History fetch error: ${error.message}`);
      return {
        revenue_5y: [],
        eps_5y: []
      };
    }
  }

  /**
   * Get complete financial dataset (all-in-one)
   * @param {string} symbol - Stock symbol
   * @returns {Promise<object>} Complete financial data
   */
  async getAll(symbol) {
    console.log(`\n[FinancialDataBroker] provider=${this.provider} status=${this.provider !== 'unavailable' ? 'ok' : 'no_api_key'}`);
    
    // Fetch all data in parallel
    const [quote, metrics, financials, history] = await Promise.all([
      this.getQuote(symbol),
      this.getKeyMetrics(symbol),
      this.getFinancialStatements(symbol),
      this.getHistorySeries(symbol)
    ]);
    
    // Calculate CAGR if we have history
    if (history.revenue_5y.length >= 3) {
      financials.revenue_3y_cagr = this._calculateCAGR(history.revenue_5y, 3);
    }
    if (history.eps_5y.length >= 3) {
      financials.eps_3y_cagr = this._calculateCAGR(history.eps_5y, 3);
    }
    
    // Calculate YoY growth if we have at least 2 years
    if (history.revenue_5y.length >= 2) {
      const latest = history.revenue_5y[history.revenue_5y.length - 1];
      const previous = history.revenue_5y[history.revenue_5y.length - 2];
      financials.revenue_yoy_latest = ((latest.value - previous.value) / previous.value) * 100;
    }
    if (history.eps_5y.length >= 2) {
      const latest = history.eps_5y[history.eps_5y.length - 1];
      const previous = history.eps_5y[history.eps_5y.length - 2];
      financials.eps_yoy_latest = ((latest.value - previous.value) / previous.value) * 100;
    }
    
    console.log(`[FinancialDataBroker] symbol=${symbol} revenue_ttm=${financials.revenue_ttm ? (financials.revenue_ttm / 1e9).toFixed(2) + 'B' : 'N/A'} eps_ttm=${financials.eps_ttm || 'N/A'}`);
    console.log(`[FinancialDataBroker] revenue_3y_cagr=${financials.revenue_3y_cagr ? financials.revenue_3y_cagr.toFixed(2) + '%' : 'N/A'} eps_3y_cagr=${financials.eps_3y_cagr ? financials.eps_3y_cagr.toFixed(2) + '%' : 'N/A'}`);
    
    return {
      quote,
      keyMetrics: metrics,
      financials,
      history
    };
  }

  // ══════════════════════════════════════════════════════════════
  // FINNHUB IMPLEMENTATION
  // ══════════════════════════════════════════════════════════════

  async _getQuoteFinnhub(symbol) {
    const [quoteRes, profileRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${this.FINNHUB_API_KEY}`, { timeout: 5000 }),
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${this.FINNHUB_API_KEY}`, { timeout: 5000 })
    ]);

    const quote = quoteRes.ok ? await quoteRes.json() : {};
    const profile = profileRes.ok ? await profileRes.json() : {};

    return {
      price: quote.c || null,
      change_abs: quote.d || null,
      change_pct: quote.dp || null,
      high_1d: quote.h || null,
      low_1d: quote.l || null,
      high_52w: quote['52WeekHigh'] || null,
      low_52w: quote['52WeekLow'] || null,
      open: quote.o || null,
      previous_close: quote.pc || null,
      volume: null,
      market_cap: profile.marketCapitalization ? profile.marketCapitalization * 1000000 : null,
      beta: profile.beta || null
    };
  }

  async _getMetricsFinnhub(symbol) {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${this.FINNHUB_API_KEY}`,
      { timeout: 5000 }
    );

    if (!res.ok) return this._emptyMetrics();

    const data = await res.json();
    const m = data.metric || {};

    return {
      pe_ttm: m.peBasicExclExtraTTM || m.peTTM || null,
      pe_forward: m.peNormalizedAnnual || null,
      ps_ttm: m.psTTM || null,
      pb: m.pbAnnual || null,
      div_yield: m.dividendYieldIndicatedAnnual || null,
      gross_margin: m.grossMarginTTM || null,
      op_margin: m.operatingMarginTTM || null,
      net_margin: m.netProfitMarginTTM || null,
      roe: m.roeTTM || null,
      roa: m.roaRfy || null
    };
  }

  async _getFinancialsFinnhub(symbol) {
    // Not fetching TTM from Finnhub in this function - will be calculated from history
    return {
      revenue_ttm: null,
      revenue_3y_cagr: null,
      revenue_yoy_latest: null,
      eps_ttm: null,
      eps_3y_cagr: null,
      eps_yoy_latest: null
    };
  }

  async _getHistoryFinnhub(symbol) {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/financials?symbol=${symbol}&statement=ic&freq=annual&token=${this.FINNHUB_API_KEY}`,
      { timeout: 10000 }
    );

    if (!res.ok) return { revenue_5y: [], eps_5y: [] };

    const data = await res.json();
    const financials = data.financials || [];

    const revenue_5y = [];
    const eps_5y = [];

    // Get last 5 years (reverse to oldest → newest)
    const last5 = financials.slice(0, 5).reverse();

    for (const period of last5) {
      const year = period.year || period.period;
      const revenue = period.revenue || null;
      const eps = period.eps || period.epsBasic || null;

      if (year && revenue) {
        revenue_5y.push({ year, value: revenue });
      }
      if (year && eps) {
        eps_5y.push({ year, value: eps });
      }
    }

    // Get TTM from most recent period
    if (financials.length > 0) {
      const latest = financials[0];
      this._cachedFinancials = {
        revenue_ttm: latest.revenue || null,
        eps_ttm: latest.eps || latest.epsBasic || null
      };
    }

    return { revenue_5y, eps_5y };
  }

  // ══════════════════════════════════════════════════════════════
  // TWELVE DATA IMPLEMENTATION (Placeholder)
  // ══════════════════════════════════════════════════════════════

  async _getQuoteTwelveData(symbol) {
    // TODO: Implement Twelve Data quote fetching
    console.log(`[FinancialDataBroker] Twelve Data implementation pending`);
    return {
      price: null,
      change_abs: null,
      change_pct: null,
      high_1d: null,
      low_1d: null,
      high_52w: null,
      low_52w: null,
      open: null,
      previous_close: null,
      volume: null,
      market_cap: null,
      beta: null
    };
  }

  async _getMetricsTwelveData(symbol) {
    // TODO: Implement Twelve Data metrics
    return this._emptyMetrics();
  }

  async _getFinancialsTwelveData(symbol) {
    return {
      revenue_ttm: null,
      revenue_3y_cagr: null,
      revenue_yoy_latest: null,
      eps_ttm: null,
      eps_3y_cagr: null,
      eps_yoy_latest: null
    };
  }

  async _getHistoryTwelveData(symbol) {
    return { revenue_5y: [], eps_5y: [] };
  }

  // ══════════════════════════════════════════════════════════════
  // ALPHA VANTAGE IMPLEMENTATION (Placeholder)
  // ══════════════════════════════════════════════════════════════

  async _getQuoteAlphaVantage(symbol) {
    // TODO: Implement Alpha Vantage quote fetching
    console.log(`[FinancialDataBroker] Alpha Vantage implementation pending`);
    return {
      price: null,
      change_abs: null,
      change_pct: null,
      high_1d: null,
      low_1d: null,
      high_52w: null,
      low_52w: null,
      open: null,
      previous_close: null,
      volume: null,
      market_cap: null,
      beta: null
    };
  }

  async _getMetricsAlphaVantage(symbol) {
    return this._emptyMetrics();
  }

  async _getFinancialsAlphaVantage(symbol) {
    return {
      revenue_ttm: null,
      revenue_3y_cagr: null,
      revenue_yoy_latest: null,
      eps_ttm: null,
      eps_3y_cagr: null,
      eps_yoy_latest: null
    };
  }

  async _getHistoryAlphaVantage(symbol) {
    return { revenue_5y: [], eps_5y: [] };
  }

  // ══════════════════════════════════════════════════════════════
  // HELPER FUNCTIONS
  // ══════════════════════════════════════════════════════════════

  _emptyMetrics() {
    return {
      pe_ttm: null,
      pe_forward: null,
      ps_ttm: null,
      pb: null,
      div_yield: null,
      gross_margin: null,
      op_margin: null,
      net_margin: null,
      roe: null,
      roa: null
    };
  }

  /**
   * Calculate CAGR from time series
   * @param {Array} series - Array of {year, value} objects
   * @param {number} years - Number of years to calculate over
   * @returns {number|null} CAGR percentage
   */
  _calculateCAGR(series, years) {
    if (series.length < years + 1) return null;

    const endIdx = series.length - 1;
    const startIdx = endIdx - years;

    const startValue = series[startIdx].value;
    const endValue = series[endIdx].value;

    if (!startValue || !endValue || startValue <= 0) return null;

    return (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
  }
}

// Export singleton instance
module.exports = new FinancialDataBroker();
