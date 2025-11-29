/**
 * ═══════════════════════════════════════════════════════════════
 * DATA FETCHER MODULE
 * ═══════════════════════════════════════════════════════════════
 * 
 * Pipeline Node 1: Responsible for fetching raw data from external sources
 * 
 * Data Sources (Priority Order):
 * 1. Finnhub (primary for US stocks)
 * 2. Twelve Data (global coverage)
 * 3. Alpha Vantage (backup)
 * 
 * Output Format (Standardized JSON):
 * {
 *   ticker: "NVDA",
 *   prices: [{date, close, volume}, ...],
 *   revenue_quarters: [{date, revenue}, ...],
 *   eps_quarters: [{date, eps}, ...],
 *   fundamentals: {gross_margin, roa, roe, ...},
 *   peers: [{ticker, fwd_pe, ps}, ...],
 *   industry: {tam, cagr},
 *   _meta: { sources_used, fetch_time, errors }
 * }
 */

const fetch = require('node-fetch');

class DataFetcher {
  constructor() {
    this.FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
    this.TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY;
    this.ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
    
    this.sourcesUsed = [];
    this.errors = [];
  }

  async fetch(symbol) {
    console.log(`[DataFetcher] Starting data fetch for ${symbol}...`);
    const startTime = Date.now();
    
    this.sourcesUsed = [];
    this.errors = [];
    
    const result = {
      ticker: symbol.toUpperCase(),
      prices: [],
      revenue_quarters: [],
      eps_quarters: [],
      fundamentals: {},
      peers: [],
      industry: {},
      _meta: {
        sources_used: [],
        fetch_time_ms: 0,
        errors: [],
        timestamp: new Date().toISOString()
      }
    };

    try {
      const [prices, financials, fundamentals, peers] = await Promise.all([
        this._fetchPrices(symbol),
        this._fetchFinancials(symbol),
        this._fetchFundamentals(symbol),
        this._fetchPeers(symbol)
      ]);

      result.prices = prices;
      result.revenue_quarters = financials.revenue;
      result.eps_quarters = financials.eps;
      result.fundamentals = fundamentals;
      result.peers = peers;
      result.industry = await this._fetchIndustryData(symbol);

    } catch (error) {
      this.errors.push({ stage: 'main', error: error.message });
    }

    result._meta.sources_used = [...new Set(this.sourcesUsed)];
    result._meta.errors = this.errors;
    result._meta.fetch_time_ms = Date.now() - startTime;

    console.log(`[DataFetcher] Completed in ${result._meta.fetch_time_ms}ms. Sources: ${result._meta.sources_used.join(', ')}`);
    
    return result;
  }

  async _fetchPrices(symbol) {
    const prices = [];
    
    if (this.ALPHA_VANTAGE_API_KEY) {
      try {
        const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${symbol}&apikey=${this.ALPHA_VANTAGE_API_KEY}&outputsize=compact`;
        const res = await fetch(url, { timeout: 10000 });
        const data = await res.json();
        
        if (data['Time Series (Daily)']) {
          const timeSeries = data['Time Series (Daily)'];
          const dates = Object.keys(timeSeries).sort().slice(-90);
          
          for (const date of dates) {
            const day = timeSeries[date];
            prices.push({
              date,
              close: parseFloat(day['4. close']),
              open: parseFloat(day['1. open']),
              high: parseFloat(day['2. high']),
              low: parseFloat(day['3. low']),
              volume: parseInt(day['6. volume'] || day['5. volume'])
            });
          }
          
          this.sourcesUsed.push('alpha_vantage_prices');
          console.log(`[DataFetcher] Alpha Vantage: ${prices.length} daily prices`);
          return prices;
        }
      } catch (error) {
        this.errors.push({ stage: 'prices_alpha', error: error.message });
      }
    }

    if (this.TWELVE_DATA_API_KEY && prices.length === 0) {
      try {
        const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=90&apikey=${this.TWELVE_DATA_API_KEY}`;
        const res = await fetch(url, { timeout: 10000 });
        const data = await res.json();
        
        if (data.values && Array.isArray(data.values)) {
          for (const day of data.values.reverse()) {
            prices.push({
              date: day.datetime,
              close: parseFloat(day.close),
              open: parseFloat(day.open),
              high: parseFloat(day.high),
              low: parseFloat(day.low),
              volume: parseInt(day.volume)
            });
          }
          
          this.sourcesUsed.push('twelve_data_prices');
          console.log(`[DataFetcher] Twelve Data: ${prices.length} daily prices`);
        }
      } catch (error) {
        this.errors.push({ stage: 'prices_twelve', error: error.message });
      }
    }

    if (this.FINNHUB_API_KEY && prices.length === 0) {
      try {
        const to = Math.floor(Date.now() / 1000);
        const from = to - (90 * 24 * 60 * 60);
        const url = `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}&token=${this.FINNHUB_API_KEY}`;
        const res = await fetch(url, { timeout: 10000 });
        const data = await res.json();
        
        if (data.s === 'ok' && data.c) {
          for (let i = 0; i < data.c.length; i++) {
            prices.push({
              date: new Date(data.t[i] * 1000).toISOString().split('T')[0],
              close: data.c[i],
              open: data.o[i],
              high: data.h[i],
              low: data.l[i],
              volume: data.v[i]
            });
          }
          
          this.sourcesUsed.push('finnhub_prices');
          console.log(`[DataFetcher] Finnhub: ${prices.length} daily prices`);
        }
      } catch (error) {
        this.errors.push({ stage: 'prices_finnhub', error: error.message });
      }
    }

    return prices;
  }

  async _fetchFinancials(symbol) {
    const result = { revenue: [], eps: [] };

    if (this.ALPHA_VANTAGE_API_KEY) {
      try {
        const [incomeRes, earningsRes] = await Promise.all([
          fetch(`https://www.alphavantage.co/query?function=INCOME_STATEMENT&symbol=${symbol}&apikey=${this.ALPHA_VANTAGE_API_KEY}`, { timeout: 10000 }),
          fetch(`https://www.alphavantage.co/query?function=EARNINGS&symbol=${symbol}&apikey=${this.ALPHA_VANTAGE_API_KEY}`, { timeout: 10000 })
        ]);
        
        const incomeData = await incomeRes.json();
        const earningsData = await earningsRes.json();
        
        if (incomeData.quarterlyReports && incomeData.quarterlyReports.length > 0) {
          const quarters = incomeData.quarterlyReports.slice(0, 20).reverse();
          result.revenue = quarters.map(q => ({
            date: q.fiscalDateEnding,
            revenue: parseFloat(q.totalRevenue) || null
          })).filter(q => q.revenue !== null);
          
          this.sourcesUsed.push('alpha_vantage_income');
        }

        if (earningsData.quarterlyEarnings && earningsData.quarterlyEarnings.length > 0) {
          const quarters = earningsData.quarterlyEarnings.slice(0, 20).reverse();
          result.eps = quarters.map(q => ({
            date: q.fiscalDateEnding,
            eps: parseFloat(q.reportedEPS) || null
          })).filter(q => q.eps !== null);
          
          this.sourcesUsed.push('alpha_vantage_earnings');
        }
        
        if (result.revenue.length > 0 || result.eps.length > 0) {
          console.log(`[DataFetcher] Alpha Vantage: ${result.revenue.length} revenue quarters, ${result.eps.length} eps quarters`);
          return result;
        }
      } catch (error) {
        this.errors.push({ stage: 'financials_alpha', error: error.message });
      }
    }

    if (this.TWELVE_DATA_API_KEY && result.revenue.length === 0) {
      try {
        const url = `https://api.twelvedata.com/income_statement?symbol=${symbol}&apikey=${this.TWELVE_DATA_API_KEY}`;
        const res = await fetch(url, { timeout: 10000 });
        const data = await res.json();
        
        if (data.income_statement && Array.isArray(data.income_statement)) {
          const quarters = data.income_statement.slice(0, 20).reverse();
          result.revenue = quarters.map(q => ({
            date: q.fiscal_date,
            revenue: parseFloat(q.sales) || null
          })).filter(q => q.revenue !== null);
          
          result.eps = quarters.map(q => ({
            date: q.fiscal_date,
            eps: parseFloat(q.eps_diluted) || parseFloat(q.eps_basic) || null
          })).filter(q => q.eps !== null);
          
          this.sourcesUsed.push('twelve_data_income');
          console.log(`[DataFetcher] Twelve Data: ${result.revenue.length} revenue quarters, ${result.eps.length} eps quarters`);
        }
      } catch (error) {
        this.errors.push({ stage: 'financials_twelve', error: error.message });
      }
    }

    return result;
  }

  async _fetchFundamentals(symbol) {
    const fundamentals = {
      gross_margin: null,
      operating_margin: null,
      net_margin: null,
      roa: null,
      roe: null,
      pe_ttm: null,
      pe_forward: null,
      ps_ttm: null,
      pb: null,
      div_yield: null,
      beta: null,
      market_cap: null
    };

    if (this.FINNHUB_API_KEY) {
      try {
        const [metricRes, profileRes, quoteRes] = await Promise.all([
          fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${this.FINNHUB_API_KEY}`, { timeout: 10000 }),
          fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${this.FINNHUB_API_KEY}`, { timeout: 10000 }),
          fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${this.FINNHUB_API_KEY}`, { timeout: 10000 })
        ]);
        
        const metricData = await metricRes.json();
        const profileData = await profileRes.json();
        const quoteData = await quoteRes.json();
        
        const m = metricData.metric || {};
        
        Object.assign(fundamentals, {
          gross_margin: m.grossMarginTTM || null,
          operating_margin: m.operatingMarginTTM || null,
          net_margin: m.netProfitMarginTTM || null,
          roa: m.roaRfy || m.roaTTM || null,
          roe: m.roeTTM || null,
          pe_ttm: m.peBasicExclExtraTTM || m.peTTM || null,
          pe_forward: m.peNormalizedAnnual || null,
          ps_ttm: m.psTTM || null,
          pb: m.pbAnnual || null,
          div_yield: m.dividendYieldIndicatedAnnual || null,
          beta: profileData.beta || null,
          market_cap: profileData.marketCapitalization ? profileData.marketCapitalization * 1000000 : null,
          price: quoteData.c || null,
          change_pct: quoteData.dp || null,
          high_52w: m['52WeekHigh'] || null,
          low_52w: m['52WeekLow'] || null
        });
        
        this.sourcesUsed.push('finnhub_fundamentals');
        console.log(`[DataFetcher] Finnhub: fundamentals fetched`);
        
        if (fundamentals.gross_margin !== null) {
          return fundamentals;
        }
      } catch (error) {
        this.errors.push({ stage: 'fundamentals_finnhub', error: error.message });
      }
    }

    if (this.ALPHA_VANTAGE_API_KEY && fundamentals.gross_margin === null) {
      try {
        const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${this.ALPHA_VANTAGE_API_KEY}`;
        const res = await fetch(url, { timeout: 10000 });
        const data = await res.json();
        
        if (data.Symbol) {
          Object.assign(fundamentals, {
            gross_margin: parseFloat(data.GrossProfitTTM) / parseFloat(data.RevenueTTM) * 100 || null,
            operating_margin: parseFloat(data.OperatingMarginTTM) * 100 || null,
            net_margin: parseFloat(data.ProfitMargin) * 100 || null,
            roa: parseFloat(data.ReturnOnAssetsTTM) * 100 || null,
            roe: parseFloat(data.ReturnOnEquityTTM) * 100 || null,
            pe_ttm: parseFloat(data.TrailingPE) || null,
            pe_forward: parseFloat(data.ForwardPE) || null,
            ps_ttm: parseFloat(data.PriceToSalesRatioTTM) || null,
            pb: parseFloat(data.PriceToBookRatio) || null,
            div_yield: parseFloat(data.DividendYield) * 100 || null,
            beta: parseFloat(data.Beta) || null,
            market_cap: parseFloat(data.MarketCapitalization) || null
          });
          
          this.sourcesUsed.push('alpha_vantage_overview');
          console.log(`[DataFetcher] Alpha Vantage: fundamentals fetched`);
        }
      } catch (error) {
        this.errors.push({ stage: 'fundamentals_alpha', error: error.message });
      }
    }

    return fundamentals;
  }

  async _fetchPeers(symbol) {
    const peers = [];

    if (this.FINNHUB_API_KEY) {
      try {
        const peersRes = await fetch(`https://finnhub.io/api/v1/stock/peers?symbol=${symbol}&token=${this.FINNHUB_API_KEY}`, { timeout: 10000 });
        const peersData = await peersRes.json();
        
        if (Array.isArray(peersData) && peersData.length > 1) {
          const peerSymbols = peersData.filter(p => p !== symbol).slice(0, 5);
          
          for (const peerSymbol of peerSymbols) {
            try {
              const metricRes = await fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${peerSymbol}&metric=all&token=${this.FINNHUB_API_KEY}`, { timeout: 5000 });
              const metricData = await metricRes.json();
              const m = metricData.metric || {};
              
              peers.push({
                ticker: peerSymbol,
                pe_forward: m.peNormalizedAnnual || null,
                ps_ttm: m.psTTM || null,
                pb: m.pbAnnual || null,
                roe: m.roeTTM || null
              });
            } catch (e) {
              peers.push({ ticker: peerSymbol, pe_forward: null, ps_ttm: null, pb: null, roe: null });
            }
          }
          
          this.sourcesUsed.push('finnhub_peers');
          console.log(`[DataFetcher] Finnhub: ${peers.length} peers fetched`);
        }
      } catch (error) {
        this.errors.push({ stage: 'peers_finnhub', error: error.message });
      }
    }

    return peers;
  }

  async _fetchIndustryData(symbol) {
    return {
      tam: null,
      cagr: null,
      cycle_position: 'mid-cycle'
    };
  }
}

module.exports = new DataFetcher();
