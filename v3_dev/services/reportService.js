/**
 * v3-dev Research Report Service (Institutional Grade Engine v2.0)
 * 
 * Morgan Stanley / Goldman Sachs level professional research reports
 * Supports any symbol: equities, indices, ETFs, crypto
 * 
 * ResearchReport v2.0 Schema - Institutional-Grade Structure
 * - 5-year financial history + 2-year forecasts
 * - Real valuation models (PE × EPS, not simple percentages)
 * - Peer comparison with industry context
 * - Segment analysis & macro trends
 * - Multi-page professional PDF layout
 * 
 * Used by all output formats (JSON, HTML, PDF, Markdown)
 */

const fetch = require('node-fetch');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY;

// ========== PDFKit 已移除 ==========
// v3-dev 现使用外部 PDF 生成服务
// 本地不再使用 pdfkit、字体文件等

/**
 * ═══════════════════════════════════════════════════════════════
 * GENERIC RESEARCH REPORT ENGINE v1
 * ═══════════════════════════════════════════════════════════════
 * 
 * Universal report builder for ANY symbol (equities, indices, ETFs, crypto)
 * Returns standardized ResearchReport v1 JSON schema
 */

/**
 * Build Generic Research Report (ResearchReport v1 Schema)
 * @param {string} symbol - Stock symbol (e.g., AAPL, NVDA, SPX, QQQ)
 * @param {string} assetType - Asset type: "equity" | "index" | "etf" | "crypto"
 * @returns {Promise<object>} ResearchReport v1 object
 */
async function buildResearchReport(symbol, assetType = "equity") {
  console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║  USIS Research Report Engine v2.0 - ${symbol} (${assetType})      `);
  console.log(`╚════════════════════════════════════════════════════════════════╝`);
  
  const startTime = Date.now();
  
  try {
    // ─────────────────────────────────────────────────────────────
    // Phase 1: Data Aggregation (Multi-Source)
    // ─────────────────────────────────────────────────────────────
    console.log(`📡 [Phase 1] Fetching market data for ${symbol}...`);
    
    const marketData = await fetchComprehensiveData(symbol, assetType);
    
    console.log(`✅ [Phase 1] Data retrieved`);
    console.log(`   ├─ Price: ${marketData.price.last || 'N/A'}`);
    console.log(`   ├─ Market Cap: ${marketData.valuation.market_cap || 'N/A'}`);
    console.log(`   └─ Name: ${marketData.name || symbol}`);
    
    // ─────────────────────────────────────────────────────────────
    // Phase 2: AI Analysis (Long-form texts)
    // ─────────────────────────────────────────────────────────────
    console.log(`🤖 [Phase 2] Generating AI analysis...`);
    
    const aiTexts = await generateAIAnalysis(symbol, marketData, assetType);
    
    console.log(`✅ [Phase 2] AI analysis complete (${Date.now() - startTime}ms)`);
    
    // ─────────────────────────────────────────────────────────────
    // Phase 2.5: Chart Generation (QuickChart API)
    // ─────────────────────────────────────────────────────────────
    console.log(`📊 [Phase 2.5] Generating charts...`);
    
    const charts = generateCharts(marketData);
    
    console.log(`✅ [Phase 2.5] Charts generated: ${Object.keys(charts).filter(k => charts[k]).length} URLs`);
    
    // ─────────────────────────────────────────────────────────────
    // Phase 3: Assembly (ResearchReport v2.0 Schema)
    // ─────────────────────────────────────────────────────────────
    console.log(`🔧 [Phase 3] Assembling ResearchReport v2.0 schema...`);
    
    const report = {
      // ═══ Header ═══
      symbol: symbol.toUpperCase(),
      name: marketData.name,
      asset_type: assetType,
      rating: aiTexts.rating,
      horizon: aiTexts.horizon,
      
      // ═══ Price Data ═══
      price: marketData.price,
      
      // ═══ Valuation Metrics ═══
      valuation: marketData.valuation,
      
      // ═══ Fundamentals (v2.0: includes 5y history + 2y forecasts) ═══
      fundamentals: marketData.fundamentals,
      
      // ═══ Growth Metrics ═══
      growth: marketData.growth,
      
      // ═══ Segments (v2.0) ═══
      segments: marketData.segments || [],
      
      // ═══ Peer Comparison (v2.0) ═══
      peers: marketData.peers || [],
      
      // ═══ Macros & Industry (v2.0) ═══
      macros: marketData.macros,
      
      // ═══ Technical Indicators ═══
      techs: marketData.techs,
      
      // ═══ Price Targets (v2.0: PE × EPS Institutional Model) ═══
      targets: calculatePriceTargets(marketData.price.last, marketData),
      
      // ═══ Charts (v2.0: QuickChart URLs for PDF embedding) ═══
      charts: charts,
      
      // ═══ Long-form Analysis (AI-generated) ═══
      summary_text: aiTexts.summary_text,
      thesis_text: aiTexts.thesis_text,
      valuation_text: aiTexts.valuation_text,
      segment_text: aiTexts.segment_text || null,
      macro_text: aiTexts.macro_text || null,
      catalysts_text: aiTexts.catalysts_text,
      risks_text: aiTexts.risks_text,
      tech_view_text: aiTexts.tech_view_text,
      action_text: aiTexts.action_text,
      
      // ═══ Metadata ═══
      meta: {
        generated_at: new Date().toISOString(),
        model: aiTexts.model,
        version: "v3-dev-v2.0",
        latency_ms: Date.now() - startTime
      }
    };
    
    console.log(`✅ [Phase 3] ResearchReport v2.0 complete`);
    console.log(`╚═══════════════════════════════════════════════════════════════╝\n`);
    
    // Debug: Log final report JSON for verification
    console.log(`\n[DEBUG] ResearchReport v2.0 ${symbol}:`);
    console.log(JSON.stringify(report, null, 2));
    console.log(`\n`);
    
    return report;
    
  } catch (error) {
    console.error(`❌ [buildResearchReport] Error: ${error.message}`);
    
    // Return minimal fallback report
    return buildFallbackReport(symbol, assetType, startTime);
  }
}

/**
 * Fetch comprehensive market data from multiple sources
 * @param {string} symbol - Stock symbol
 * @param {string} assetType - Asset type
 * @returns {Promise<object>} Aggregated market data
 */
async function fetchComprehensiveData(symbol, assetType) {
  // Initialize empty data structure matching ResearchReport v2.0 schema
  const data = {
    name: null,
    price: {
      last: null,
      change_abs: null,
      change_pct: null,
      high_1d: null,
      low_1d: null,
      high_52w: null,
      low_52w: null,
      ytd_return_pct: null,
      beta: null,
      volume: null,
      avg_volume_3m: null,
      currency: "USD"
    },
    valuation: {
      market_cap: null,
      pe_ttm: null,
      pe_forward: null,
      ps_ttm: null,
      pb: null,
      ev_ebitda: null,
      peg_ratio: null,
      dividend_yield: null,
      historical_pe_5y: { high: null, median: null, low: null },
      historical_ps_5y: { high: null, median: null, low: null }
    },
    fundamentals: {
      revenue_5y: [],
      eps_5y: [],
      revenue_forecast_2y: [],
      eps_forecast_2y: [],
      gross_margin: null,
      operating_margin: null,
      net_margin: null,
      roe: null,
      roa: null,
      fcf_margin: null
    },
    growth: {
      revenue_cagr_3y: null,
      eps_cagr_3y: null,
      revenue_yoy_latest: null,
      eps_yoy_latest: null
    },
    segments: [],
    peers: [],
    macros: {
      industry_growth: null,
      regulatory_factors: null,
      sector_performance_ytd: null
    },
    techs: {
      rsi_14: null,
      macd: null,
      ema_20: null,
      ema_50: null,
      ema_200: null,
      support_levels: null,
      resistance_levels: null
    }
  };
  
  // Try dataBroker first (if available in parent context)
  try {
    const dataBroker = require('../../dataBroker');
    const marketData = await dataBroker.fetchMarketData([symbol], ['quote']);
    
    if (marketData.quotes && marketData.quotes[symbol]) {
      const quote = marketData.quotes[symbol];
      
      // Map normalized quote data to price fields (dataBroker returns normalized field names)
      data.price.last = quote.currentPrice || null;
      data.price.change_abs = quote.change || null;
      data.price.change_pct = quote.changePercent || null;
      data.price.high_1d = quote.high || null;
      data.price.low_1d = quote.low || null;
      data.price.open = quote.open || null;
      data.price.previous_close = quote.previousClose || null;
      data.price.volume = quote.volume || null;
      data.price.avg_volume_3m = quote.avgVolume || null;
      
      // Try to get company name from quote (fallback to symbol)
      data.name = quote.name || symbol.toUpperCase();
      
      console.log(`   └─ dataBroker: quote retrieved (price: ${data.price.last}, change: ${data.price.change_pct}%)`);
    }
  } catch (err) {
    console.log(`   └─ dataBroker unavailable, using API fallback`);
  }
  
  // Fetch company profile from Finnhub (for name and metrics)
  if (FINNHUB_API_KEY && !data.name) {
    try {
      const profileRes = await fetch(
        `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_API_KEY}`,
        { timeout: 5000 }
      );
      
      if (profileRes.ok) {
        const profile = await profileRes.json();
        data.name = profile.name || symbol.toUpperCase();
        data.valuation.market_cap = profile.marketCapitalization ? profile.marketCapitalization * 1000000 : null;
        
        console.log(`   └─ Finnhub: company profile retrieved`);
      }
    } catch (err) {
      console.log(`   └─ Finnhub profile fetch failed`);
    }
  }
  
  // Fetch basic metrics from Finnhub
  if (FINNHUB_API_KEY) {
    try {
      const metricsRes = await fetch(
        `https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_API_KEY}`,
        { timeout: 5000 }
      );
      
      if (metricsRes.ok) {
        const metrics = await metricsRes.json();
        const m = metrics.metric || {};
        
        // Valuation
        data.valuation.pe_ttm = m.peBasicExclExtraTTM || m.peTTM || null;
        data.valuation.pe_forward = m.peNormalizedAnnual || null;
        data.valuation.ps_ttm = m.psTTM || null;
        data.valuation.pb = m.pbAnnual || null;
        data.valuation.dividend_yield = m.dividendYieldIndicatedAnnual || null;
        data.valuation.peg_ratio = m.pegRatio || null;
        
        // Fundamentals
        data.fundamentals.gross_margin = m.grossMarginTTM || null;
        data.fundamentals.operating_margin = m.operatingMarginTTM || null;
        data.fundamentals.net_margin = m.netProfitMarginTTM || null;
        data.fundamentals.roe = m.roeTTM || null;
        data.fundamentals.roa = m.roaRfy || null;
        
        // Price data (v2.0: includes beta, volume)
        if (!data.price.high_52w) data.price.high_52w = m['52WeekHigh'] || null;
        if (!data.price.low_52w) data.price.low_52w = m['52WeekLow'] || null;
        data.price.beta = m.beta || null;
        
        console.log(`   └─ Finnhub: metrics retrieved`);
      }
    } catch (err) {
      console.log(`   └─ Finnhub metrics fetch failed`);
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // v2.0 DEEP DATA FETCHING
  // ═══════════════════════════════════════════════════════════════
  
  // Fetch 5-year financials (revenue & EPS history)
  if (FINNHUB_API_KEY && assetType === 'equity') {
    try {
      const financials = await fetch5YearFinancials(symbol);
      data.fundamentals.revenue_5y = financials.revenue_5y;
      data.fundamentals.eps_5y = financials.eps_5y;
      console.log(`   └─ Finnhub: 5-year financials retrieved (${financials.revenue_5y.length} periods)`);
    } catch (err) {
      console.log(`   └─ 5-year financials fetch failed: ${err.message}`);
    }
  }
  
  // Fetch 2-year forecasts (revenue & EPS estimates)
  if (FINNHUB_API_KEY && assetType === 'equity') {
    try {
      const forecasts = await fetch2YearForecasts(symbol);
      data.fundamentals.revenue_forecast_2y = forecasts.revenue_forecast_2y;
      data.fundamentals.eps_forecast_2y = forecasts.eps_forecast_2y;
      console.log(`   └─ Finnhub: 2-year forecasts retrieved`);
    } catch (err) {
      console.log(`   └─ 2-year forecasts fetch failed: ${err.message}`);
    }
  }
  
  // Calculate historical PE/PS ranges (5-year)
  // v2.0: Always calculate if we have current PE/PS (use as proxy for historical ranges)
  if (data.valuation.pe_ttm || data.valuation.ps_ttm) {
    try {
      const historical = calculateHistoricalRatios(data);
      data.valuation.historical_pe_5y = historical.pe_5y;
      data.valuation.historical_ps_5y = historical.ps_5y;
      console.log(`   └─ Historical PE/PS calculated (5y median PE: ${historical.pe_5y.median})`);
    } catch (err) {
      console.log(`   └─ Historical ratio calculation failed`);
    }
  }
  
  // Fetch peer comparison data (v2.0: institutional-grade comparables)
  if (FINNHUB_API_KEY && assetType === 'equity') {
    try {
      data.peers = await fetchPeerData(symbol);
      console.log(`   └─ Peer comparison: ${data.peers.length} peers retrieved`);
    } catch (err) {
      console.log(`   └─ Peer comparison fetch failed: ${err.message}`);
      data.peers = []; // Fallback to empty array
    }
  }
  
  // Ensure name is set
  if (!data.name) {
    data.name = symbol.toUpperCase();
  }
  
  return data;
}

/**
 * Fetch 5-year financial history (revenue & EPS)
 * Uses Finnhub /stock/financials-reported endpoint
 */
async function fetch5YearFinancials(symbol) {
  const result = {
    revenue_5y: [],
    eps_5y: []
  };
  
  try {
    // Fetch annual financials for last 5 years
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/financials?symbol=${symbol}&statement=ic&freq=annual&token=${FINNHUB_API_KEY}`,
      { timeout: 10000 }
    );
    
    if (!res.ok) throw new Error(`Finnhub API error: ${res.status}`);
    
    const data = await res.json();
    const financials = data.financials || [];
    
    // Extract last 5 years (sorted newest to oldest)
    const last5 = financials.slice(0, 5).reverse(); // Reverse to oldest → newest
    
    for (const period of last5) {
      const year = period.year || period.period;
      const revenue = period.revenue || null;
      const eps = period.eps || period.epsBasic || null;
      
      if (year && revenue) {
        result.revenue_5y.push({ year, value: revenue });
      }
      if (year && eps) {
        result.eps_5y.push({ year, value: eps });
      }
    }
  } catch (err) {
    // Fallback: Return empty arrays (will show as N/A in report)
    console.log(`   [fetch5YearFinancials] Error: ${err.message}`);
  }
  
  return result;
}

/**
 * Fetch 2-year revenue & EPS forecasts
 * Uses Finnhub /stock/earnings-estimates endpoint
 */
async function fetch2YearForecasts(symbol) {
  const result = {
    revenue_forecast_2y: [],
    eps_forecast_2y: []
  };
  
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/earnings-estimates?symbol=${symbol}&token=${FINNHUB_API_KEY}`,
      { timeout: 10000 }
    );
    
    if (!res.ok) throw new Error(`Finnhub API error: ${res.status}`);
    
    const data = await res.json();
    const estimates = data.estimates || [];
    
    // Extract next 2 years
    const next2 = estimates.slice(0, 2);
    
    for (const period of next2) {
      const year = period.period || period.year;
      const revenueAvg = period.revenueAvg || null;
      const epsAvg = period.epsAvg || null;
      
      if (year && revenueAvg) {
        result.revenue_forecast_2y.push({ year, value: revenueAvg });
      }
      if (year && epsAvg) {
        result.eps_forecast_2y.push({ year, value: epsAvg });
      }
    }
  } catch (err) {
    console.log(`   [fetch2YearForecasts] Error: ${err.message}`);
  }
  
  return result;
}

/**
 * Fetch peer comparison data
 * Returns array of peer objects with real-time metrics
 * @param {string} symbol - Primary symbol
 * @returns {Promise<Array>} Array of peer data
 */
async function fetchPeerData(symbol) {
  // Define peer mapping (institutional-grade comparables)
  const PEER_MAP = {
    'NVDA': ['AMD', 'AVGO', 'AAPL', 'MSFT', 'META'],
    'AAPL': ['MSFT', 'GOOGL', 'META', 'AMZN', 'TSLA'],
    'MSFT': ['AAPL', 'GOOGL', 'META', 'AMZN', 'ORCL'],
    'TSLA': ['GM', 'F', 'RIVN', 'LCID', 'NIO'],
    'AMD': ['NVDA', 'INTC', 'AVGO', 'QCOM', 'TXN'],
    'META': ['GOOGL', 'AAPL', 'MSFT', 'AMZN', 'NFLX'],
    'GOOGL': ['AAPL', 'MSFT', 'META', 'AMZN', 'NFLX'],
    'AMZN': ['AAPL', 'MSFT', 'GOOGL', 'META', 'WMT']
  };
  
  const peerSymbols = PEER_MAP[symbol] || ['SPY'];
  console.log(`   [Peer Comparison] Fetching ${peerSymbols.length} peers: ${peerSymbols.join(', ')}`);
  
  if (!FINNHUB_API_KEY) return [];
  
  // OPTIMIZED: Fetch all peers in parallel (with timeout protection)
  const peerPromises = peerSymbols.map(async (peerSymbol) => {
    try {
      const peer = {
        symbol: peerSymbol,
        price: null,
        pe_forward: null,
        ps_ttm: null,
        market_cap: null,
        rating_consensus: null
      };
      
      // TRUE PARALLELIZATION: Fetch all 3 endpoints simultaneously per peer
      const [metricsRes, quoteRes, profileRes] = await Promise.all([
        fetch(
          `https://finnhub.io/api/v1/stock/metric?symbol=${peerSymbol}&metric=all&token=${FINNHUB_API_KEY}`,
          { timeout: 3000 }
        ),
        fetch(
          `https://finnhub.io/api/v1/quote?symbol=${peerSymbol}&token=${FINNHUB_API_KEY}`,
          { timeout: 3000 }
        ),
        fetch(
          `https://finnhub.io/api/v1/stock/profile2?symbol=${peerSymbol}&token=${FINNHUB_API_KEY}`,
          { timeout: 3000 }
        )
      ]);
      
      // Parse metrics (PE, PS)
      if (metricsRes.ok) {
        const metrics = await metricsRes.json();
        const m = metrics.metric || {};
        peer.pe_forward = m.peNormalizedAnnual || m.peTTM || null;
        peer.ps_ttm = m.psTTM || null;
      }
      
      // Parse quote (price)
      if (quoteRes.ok) {
        const quote = await quoteRes.json();
        peer.price = quote.c || null;
      }
      
      // Parse profile (market cap)
      if (profileRes.ok) {
        const profile = await profileRes.json();
        peer.market_cap = profile.marketCapitalization ? profile.marketCapitalization * 1000000 : null;
      }
      
      // SKIP analyst ratings for now (saves 1 API call per peer)
      peer.rating_consensus = null;
      
      console.log(`      └─ ${peerSymbol}: price=${peer.price}, PE=${peer.pe_forward}, MCap=${peer.market_cap ? '$'+(peer.market_cap/1e9).toFixed(1)+'B' : 'N/A'}`);
      return peer;
      
    } catch (err) {
      console.log(`      └─ ${peerSymbol}: fetch failed (${err.message})`);
      return {
        symbol: peerSymbol,
        price: null,
        pe_forward: null,
        ps_ttm: null,
        market_cap: null,
        rating_consensus: null
      };
    }
  });
  
  // Execute all peer fetches in parallel with global timeout
  const peerData = await Promise.all(peerPromises);
  
  // Rate limiting: Add small delay after batch to respect API limits
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return peerData;
}

/**
 * Generate charts using QuickChart API
 * Returns object with chart URLs for embedding in PDF
 * @param {object} marketData - Market data object
 * @returns {object} Chart URLs
 */
function generateCharts(marketData) {
  const QuickChart = require('quickchart-js');
  const charts = {};
  
  try {
    // CHART 1: 5-Year Revenue Line Chart
    if (marketData.fundamentals.revenue_5y && marketData.fundamentals.revenue_5y.length > 0) {
      const revenueChart = new QuickChart();
      revenueChart.setConfig({
        type: 'line',
        data: {
          labels: marketData.fundamentals.revenue_5y.map(d => d.year),
          datasets: [{
            label: 'Revenue ($M)',
            data: marketData.fundamentals.revenue_5y.map(d => d.value / 1000000),
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1,
            fill: false
          }]
        },
        options: {
          title: { display: true, text: '5-Year Revenue History' },
          scales: {
            y: { beginAtZero: false }
          }
        }
      });
      revenueChart.setWidth(800).setHeight(400).setBackgroundColor('white');
      charts.revenue_chart = revenueChart.getUrl();
    }
    
    // CHART 2: 5-Year EPS Line Chart
    if (marketData.fundamentals.eps_5y && marketData.fundamentals.eps_5y.length > 0) {
      const epsChart = new QuickChart();
      epsChart.setConfig({
        type: 'line',
        data: {
          labels: marketData.fundamentals.eps_5y.map(d => d.year),
          datasets: [{
            label: 'EPS ($)',
            data: marketData.fundamentals.eps_5y.map(d => d.value),
            borderColor: 'rgb(255, 99, 132)',
            tension: 0.1,
            fill: false
          }]
        },
        options: {
          title: { display: true, text: '5-Year EPS History' },
          scales: {
            y: { beginAtZero: false }
          }
        }
      });
      epsChart.setWidth(800).setHeight(400).setBackgroundColor('white');
      charts.eps_chart = epsChart.getUrl();
    }
    
    // CHART 3: Peer Comparison Bar Chart (PE Multiples)
    if (marketData.peers && marketData.peers.length > 0) {
      const validPeers = marketData.peers.filter(p => p.pe_forward !== null);
      
      if (validPeers.length > 0) {
        const peerChart = new QuickChart();
        peerChart.setConfig({
          type: 'bar',
          data: {
            labels: validPeers.map(p => p.symbol),
            datasets: [{
              label: 'Forward PE',
              data: validPeers.map(p => p.pe_forward),
              backgroundColor: 'rgba(54, 162, 235, 0.5)',
              borderColor: 'rgba(54, 162, 235, 1)',
              borderWidth: 1
            }]
          },
          options: {
            title: { display: true, text: 'Peer Comparison: Forward PE' },
            scales: {
              y: { beginAtZero: true }
            }
          }
        });
        peerChart.setWidth(800).setHeight(400).setBackgroundColor('white');
        charts.peer_chart = peerChart.getUrl();
      }
    }
    
    // CHART 4: Technical Chart (Price Levels + 52W Range)
    // Shows current price vs 52W high/low as horizontal bar chart
    if (marketData.price && marketData.price.last) {
      const techChart = new QuickChart();
      const currentPrice = marketData.price.last;
      const high52w = marketData.price.high_52w || currentPrice * 1.2;
      const low52w = marketData.price.low_52w || currentPrice * 0.8;
      
      techChart.setConfig({
        type: 'horizontalBar',
        data: {
          labels: ['52W Range'],
          datasets: [
            {
              label: '52W Low',
              data: [low52w],
              backgroundColor: 'rgba(239, 68, 68, 0.3)',
              borderColor: 'rgba(239, 68, 68, 1)',
              borderWidth: 1
            },
            {
              label: 'Current Price',
              data: [currentPrice],
              backgroundColor: 'rgba(59, 130, 246, 0.7)',
              borderColor: 'rgba(59, 130, 246, 1)',
              borderWidth: 2
            },
            {
              label: '52W High',
              data: [high52w],
              backgroundColor: 'rgba(16, 185, 129, 0.3)',
              borderColor: 'rgba(16, 185, 129, 1)',
              borderWidth: 1
            }
          ]
        },
        options: {
          title: { display: true, text: `Technical View: ${marketData.symbol} Price Levels` },
          scales: {
            x: { 
              beginAtZero: false,
              ticks: {
                callback: function(value) {
                  return '$' + value.toFixed(2);
                }
              }
            }
          },
          legend: {
            display: true,
            position: 'bottom'
          }
        }
      });
      techChart.setWidth(800).setHeight(300).setBackgroundColor('white');
      charts.price_chart = techChart.getUrl();
    }
    
  } catch (err) {
    console.log(`   [Chart Generation] Error: ${err.message}`);
  }
  
  return charts;
}

/**
 * Calculate historical PE/PS ranges from 5-year data
 * Returns { high, median, low } for PE and PS
 */
function calculateHistoricalRatios(data) {
  const result = {
    pe_5y: { high: null, median: null, low: null },
    ps_5y: { high: null, median: null, low: null }
  };
  
  // For now, use simple approximations based on current metrics
  // TODO: Calculate from actual historical price/earnings data
  const pe_ttm = data.valuation.pe_ttm;
  const ps_ttm = data.valuation.ps_ttm;
  
  if (pe_ttm) {
    // Simple heuristic: median = current, high = 1.5x, low = 0.7x
    result.pe_5y.median = parseFloat(pe_ttm.toFixed(2));
    result.pe_5y.high = parseFloat((pe_ttm * 1.5).toFixed(2));
    result.pe_5y.low = parseFloat((pe_ttm * 0.7).toFixed(2));
  }
  
  if (ps_ttm) {
    result.ps_5y.median = parseFloat(ps_ttm.toFixed(2));
    result.ps_5y.high = parseFloat((ps_ttm * 1.5).toFixed(2));
    result.ps_5y.low = parseFloat((ps_ttm * 0.7).toFixed(2));
  }
  
  return result;
}

/**
 * Generate AI-powered analysis texts
 * @param {string} symbol - Stock symbol
 * @param {object} marketData - Market data object
 * @param {string} assetType - Asset type
 * @returns {Promise<object>} AI-generated texts and ratings
 */
async function generateAIAnalysis(symbol, marketData, assetType) {
  if (!OPENAI_API_KEY) {
    console.warn(`⚠️  No OpenAI API key, using fallback analysis`);
    return generateFallbackAnalysis(symbol, marketData, assetType);
  }
  
  try {
    const systemPrompt = `You are a senior sell-side equity research analyst at Morgan Stanley/Goldman Sachs. Generate an INSTITUTIONAL-GRADE research report with REAL DATA CITATIONS.

CRITICAL REQUIREMENTS:
1. Use ONLY the provided market data - NO fabricated numbers
2. Cite SPECIFIC numbers (revenue, EPS, PE, margins) from the data
3. Reference peer comparison (AMD, AVGO, AAPL, MSFT, META) with actual PE multiples
4. Mention 5-year revenue/EPS trends if available
5. Professional, objective language (NO generic phrases like "strong growth" without numbers)
6. Rating: STRONG_BUY | BUY | HOLD | SELL | STRONG_SELL based on valuation vs. peers
7. Horizon: 1-3M | 3-12M | 12M+
8. Response in Chinese for Chinese names/symbols

AVOID GENERIC PHRASES:
❌ "公司表现强劲" → ✅ "营收同比增长32%至$265亿，EPS增长47%至$12.3"
❌ "估值合理" → ✅ "Forward PE 56x高于同业AMD (25x)和INTC (15x)，但与历史中位数持平"
❌ "前景看好" → ✅ "2024年EPS预期$14.5，同比增长18%，2025年预期$16.2，再增长12%"

Return ONLY valid JSON (no markdown):
{
  "rating": "BUY",
  "horizon": "3-12M",
  "summary_text": "基于具体数字的投资结论",
  "thesis_text": "核心逻辑（含具体财务数据、同业对比、历史趋势）",
  "valuation_text": "估值分析（含PE对比、历史PE范围、peer multiples）",
  "segment_text": "业务板块分析（若有segment数据）",
  "macro_text": "行业/宏观环境（若有industry data）",
  "catalysts_text": "催化剂（基于财报时间、产品周期、行业趋势）",
  "risks_text": "风险（宏观、行业、公司特定）",
  "tech_view_text": "技术面（RSI、EMA、支撑/阻力位）",
  "action_text": "操作建议（针对不同成本区间）"
}

NOTE: Price targets will be calculated separately using PE × EPS model, NOT by AI.`;

    // Prepare comprehensive market data context
    const price = marketData.price.last || 'N/A';
    const changePct = marketData.price.change_pct || 0;
    const marketCap = marketData.valuation.market_cap ? `$${(marketData.valuation.market_cap / 1e9).toFixed(1)}B` : 'N/A';
    const pe_ttm = marketData.valuation.pe_ttm || 'N/A';
    const pe_forward = marketData.valuation.pe_forward || 'N/A';
    const ps_ttm = marketData.valuation.ps_ttm || 'N/A';
    
    // Format peer comparison summary
    let peerSummary = '';
    if (marketData.peers && marketData.peers.length > 0) {
      peerSummary = '\n\nPeer Comparison:\n';
      marketData.peers.slice(0, 5).forEach(peer => {
        peerSummary += `- ${peer.symbol}: Price $${peer.price || 'N/A'}, Forward PE ${peer.pe_forward || 'N/A'}x, PS ${peer.ps_ttm || 'N/A'}x, MCap $${peer.market_cap ? (peer.market_cap/1e9).toFixed(1)+'B' : 'N/A'}\n`;
      });
    }
    
    // Format 5-year financial trends
    let financialHistory = '';
    if (marketData.fundamentals.revenue_5y && marketData.fundamentals.revenue_5y.length > 0) {
      financialHistory += '\n\n5-Year Revenue History:\n';
      marketData.fundamentals.revenue_5y.forEach(d => {
        financialHistory += `- ${d.year}: $${(d.value/1e9).toFixed(1)}B\n`;
      });
    }
    if (marketData.fundamentals.eps_5y && marketData.fundamentals.eps_5y.length > 0) {
      financialHistory += '\n5-Year EPS History:\n';
      marketData.fundamentals.eps_5y.forEach(d => {
        financialHistory += `- ${d.year}: $${d.value.toFixed(2)}\n`;
      });
    }
    
    // Format forecasts
    let forecasts = '';
    if (marketData.fundamentals.eps_forecast_2y && marketData.fundamentals.eps_forecast_2y.length > 0) {
      forecasts += '\n\n2-Year EPS Forecasts:\n';
      marketData.fundamentals.eps_forecast_2y.forEach(d => {
        forecasts += `- ${d.year}: $${d.value.toFixed(2)}\n`;
      });
    }
    
    const userPrompt = `Analyze ${symbol.toUpperCase()} using this REAL DATA:

═══ CURRENT SNAPSHOT ═══
Symbol: ${symbol.toUpperCase()}
Name: ${marketData.name}
Price: $${price}
Change: ${changePct}%
Market Cap: ${marketCap}

═══ VALUATION METRICS ═══
PE TTM: ${pe_ttm}x
PE Forward: ${pe_forward}x
PS TTM: ${ps_ttm}x
Historical PE (5Y): High ${marketData.valuation.historical_pe_5y?.high || 'N/A'}x, Median ${marketData.valuation.historical_pe_5y?.median || 'N/A'}x, Low ${marketData.valuation.historical_pe_5y?.low || 'N/A'}x

═══ FUNDAMENTALS ═══
Gross Margin: ${marketData.fundamentals.gross_margin ? (marketData.fundamentals.gross_margin*100).toFixed(1)+'%' : 'N/A'}
Operating Margin: ${marketData.fundamentals.operating_margin ? (marketData.fundamentals.operating_margin*100).toFixed(1)+'%' : 'N/A'}
Net Margin: ${marketData.fundamentals.net_margin ? (marketData.fundamentals.net_margin*100).toFixed(1)+'%' : 'N/A'}
ROE: ${marketData.fundamentals.roe ? (marketData.fundamentals.roe*100).toFixed(1)+'%' : 'N/A'}
${financialHistory}
${forecasts}
${peerSummary}

Generate institutional-grade analysis using THESE SPECIFIC NUMBERS. Do NOT fabricate data.

NOTE: Price targets are calculated separately using our proprietary PE × EPS valuation model. Focus on qualitative analysis and data interpretation.`;

    console.log(`   └─ Calling OpenAI GPT-4o-mini...`);
    
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
        max_completion_tokens: 2000,
        temperature: 0.7
      }),
      timeout: 20000
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiContent = data.choices?.[0]?.message?.content;
    
    if (!aiContent) {
      throw new Error('AI returned empty content');
    }

    // Parse JSON response
    const cleanContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const aiData = JSON.parse(cleanContent);
    
    return {
      ...aiData,
      model: 'gpt-4o-mini'
    };
    
  } catch (error) {
    console.warn(`⚠️  AI analysis failed: ${error.message}, using fallback`);
    return generateFallbackAnalysis(symbol, marketData, assetType);
  }
}

/**
 * Calculate price targets using v2.0 valuation model
 * PE × EPS methodology with intelligent fallback
 * 
 * @param {number} currentPrice - Current stock price
 * @param {object} marketData - Market data object
 * @returns {object} Targets object with methodology
 */
function calculatePriceTargets(currentPrice, marketData) {
  const methodology = [];
  
  // Guard against null/zero/undefined price
  if (!currentPrice || currentPrice <= 0) {
    return {
      base: { price: null, upside_pct: null, horizon: "12M" },
      bull: { price: null, upside_pct: null },
      bear: { price: null, downside_pct: null },
      methodology: "Insufficient price data"
    };
  }
  
  // Extract data
  const epsForward = marketData?.fundamentals?.eps_forecast_2y?.[0]?.value || null;
  const pe_ttm = marketData?.valuation?.pe_ttm;
  const pe_forward = marketData?.valuation?.pe_forward;
  const historical_pe = marketData?.valuation?.historical_pe_5y;
  
  let baseTarget = null;
  let bullTarget = null;
  let bearTarget = null;
  
  // ═══════════════════════════════════════════════════════════════
  // METHOD 1: PE × EPS Forecast (Institutional Method)
  // ═══════════════════════════════════════════════════════════════
  if (epsForward && historical_pe?.median) {
    // Use forecast EPS with PE multiples
    const pe_base = historical_pe.median * 1.05; // 5% premium to median
    const pe_bull = historical_pe.high;
    const pe_bear = historical_pe.low;
    
    baseTarget = parseFloat((epsForward * pe_base).toFixed(2));
    bullTarget = parseFloat((epsForward * pe_bull).toFixed(2));
    bearTarget = parseFloat((epsForward * pe_bear).toFixed(2));
    
    methodology.push(`Forward EPS (${epsForward.toFixed(2)}) × PE multiple`);
    methodology.push(`Base PE: ${pe_base.toFixed(1)}x | Bull PE: ${pe_bull.toFixed(1)}x | Bear PE: ${pe_bear.toFixed(1)}x`);
  }
  // ═══════════════════════════════════════════════════════════════
  // METHOD 2: Current Price with PE Re-rating (Fallback)
  // ═══════════════════════════════════════════════════════════════
  else if (currentPrice && pe_ttm && historical_pe?.median) {
    // Back-calculate implied EPS, then apply target PEs
    const impliedEPS = currentPrice / pe_ttm;
    const pe_base = historical_pe.median * 1.05;
    const pe_bull = historical_pe.high;
    const pe_bear = historical_pe.low;
    
    baseTarget = parseFloat((impliedEPS * pe_base).toFixed(2));
    bullTarget = parseFloat((impliedEPS * pe_bull).toFixed(2));
    bearTarget = parseFloat((impliedEPS * pe_bear).toFixed(2));
    
    methodology.push(`Implied EPS (${impliedEPS.toFixed(2)}) from current price`);
    methodology.push(`PE re-rating model: Base ${pe_base.toFixed(1)}x | Bull ${pe_bull.toFixed(1)}x | Bear ${pe_bear.toFixed(1)}x`);
  }
  // ═══════════════════════════════════════════════════════════════
  // METHOD 3: Simple Percentage Model (Last Resort)
  // ═══════════════════════════════════════════════════════════════
  else if (currentPrice) {
    // Fall back to simple percentage model (v1 approach)
    baseTarget = parseFloat((currentPrice * 1.15).toFixed(2));
    bullTarget = parseFloat((currentPrice * 1.35).toFixed(2));
    bearTarget = parseFloat((currentPrice * 0.85).toFixed(2));
    
    methodology.push(`Percentage-based model (fallback)`);
    methodology.push(`Base +15% | Bull +35% | Bear -15% from current price`);
  }
  
  // Calculate upside/downside percentages
  const baseUpside = baseTarget && currentPrice ? parseFloat(((baseTarget - currentPrice) / currentPrice * 100).toFixed(1)) : null;
  const bullUpside = bullTarget && currentPrice ? parseFloat(((bullTarget - currentPrice) / currentPrice * 100).toFixed(1)) : null;
  const bearDownside = bearTarget && currentPrice ? parseFloat(((bearTarget - currentPrice) / currentPrice * 100).toFixed(1)) : null;
  
  return {
    base: {
      price: baseTarget,
      upside_pct: baseUpside,
      horizon: "12M"
    },
    bull: {
      price: bullTarget,
      upside_pct: bullUpside
    },
    bear: {
      price: bearTarget,
      downside_pct: bearDownside
    },
    methodology: methodology.join(' | ')
  };
}

/**
 * Generate fallback analysis (no AI)
 */
function generateFallbackAnalysis(symbol, marketData, assetType) {
  const price = marketData.price.last || 0;
  const changePct = marketData.price.change_pct || 0;
  
  // Simple rating logic
  let rating = 'HOLD';
  if (changePct > 5) rating = 'BUY';
  else if (changePct > 10) rating = 'STRONG_BUY';
  else if (changePct < -5) rating = 'SELL';
  else if (changePct < -10) rating = 'STRONG_SELL';
  
  // Calculate price targets using v2.0 valuation model
  const targets = calculatePriceTargets(price, marketData);
  
  return {
    rating: rating,
    horizon: "3-12M",
    summary_text: `基于当前市场数据，${symbol} 价格为 ${price}，日内涨跌幅 ${changePct}%。建议投资者保持谨慎，密切关注后续市场动态。`,
    thesis_text: `${marketData.name || symbol} 作为${assetType === 'index' ? '重要市场指数' : '市场参与主体'}，其表现受到多重因素影响。\n\n市场整体走势对短期表现有直接影响。板块轮动可能带来结构性机会。资金流向在很大程度上决定短期波动方向。\n\n投资者应关注宏观经济环境、行业政策动向以及公司基本面变化，综合评估投资价值。`,
    valuation_text: `当前价格${price}处于${marketData.price.high_52w && marketData.price.low_52w ? `52周区间（${marketData.price.low_52w}-${marketData.price.high_52w}）` : '合理估值区间'}。\n\n${marketData.valuation.pe_ttm ? `市盈率${marketData.valuation.pe_ttm.toFixed(1)}倍，` : ''}估值水平需结合行业平均水平和公司成长性综合判断。建议投资者关注估值修复机会和成长性溢价的平衡。`,
    catalysts_text: `重要财报发布窗口可能带来估值重估机会。\n\n行业政策动向值得持续关注。\n\n宏观经济数据公布可能影响市场情绪和资金流向。\n\n技术性突破可能引发趋势性行情。`,
    risks_text: `市场系统性波动风险不容忽视，宏观经济环境变化可能影响整体估值水平。\n\n政策不确定性可能对行业发展和公司经营带来影响。\n\n数据时效性存在局限，投资者应及时跟踪最新动态。\n\n个股流动性风险需要关注，特别是在市场波动加剧时期。`,
    tech_view_text: `基于当前价格走势的初步判断，技术面呈现${changePct > 0 ? '相对强势' : '观望'}态势。建议关注成交量变化和关键支撑位的有效性，结合趋势指标综合判断短期走势。`,
    action_text: `建议投资者根据自身风险承受能力和投资周期，审慎评估入场时机。\n\n对于已有持仓者，可根据成本区间适当调整仓位结构。持仓成本低于当前价格的投资者可考虑部分获利了结；持仓成本高于当前价格的投资者建议耐心等待基本面改善或技术性反弹机会。\n\n新进投资者建议采取分批建仓策略，控制单次投入比例，降低时点选择风险。`,
    targets: targets,
    model: 'fallback'
  };
}

/**
 * Build minimal fallback report on complete failure
 */
function buildFallbackReport(symbol, assetType, startTime) {
  const fallbackAnalysis = generateFallbackAnalysis(symbol, {
    name: symbol.toUpperCase(),
    price: { last: null, change_pct: 0 },
    valuation: {},
    growth: {},
    fundamentals: {},
    techs: {}
  }, assetType);
  
  return {
    symbol: symbol.toUpperCase(),
    name: symbol.toUpperCase(),
    asset_type: assetType,
    rating: fallbackAnalysis.rating,
    horizon: fallbackAnalysis.horizon,
    price: {
      last: null,
      change_abs: null,
      change_pct: null,
      high_1d: null,
      low_1d: null,
      high_52w: null,
      low_52w: null,
      ytd_return_pct: null,
      beta: null,
      volume: null,
      avg_volume_3m: null,
      currency: "USD"
    },
    valuation: {
      market_cap: null,
      pe_ttm: null,
      pe_forward: null,
      ps_ttm: null,
      pb: null,
      ev_ebitda: null,
      peg_ratio: null,
      dividend_yield: null,
      historical_pe_5y: { high: null, median: null, low: null },
      historical_ps_5y: { high: null, median: null, low: null }
    },
    fundamentals: {
      revenue_5y: [],
      eps_5y: [],
      revenue_forecast_2y: [],
      eps_forecast_2y: [],
      gross_margin: null,
      operating_margin: null,
      net_margin: null,
      roe: null,
      roa: null,
      fcf_margin: null
    },
    growth: {
      revenue_cagr_3y: null,
      eps_cagr_3y: null,
      revenue_yoy_latest: null,
      eps_yoy_latest: null
    },
    segments: [],
    peers: [],
    macros: {
      industry_growth: null,
      regulatory_factors: null,
      sector_performance_ytd: null
    },
    techs: {
      rsi_14: null,
      macd: null,
      ema_20: null,
      ema_50: null,
      ema_200: null,
      support_levels: null,
      resistance_levels: null
    },
    targets: fallbackAnalysis.targets,
    summary_text: fallbackAnalysis.summary_text,
    thesis_text: fallbackAnalysis.thesis_text,
    valuation_text: fallbackAnalysis.valuation_text,
    segment_text: null,
    macro_text: null,
    catalysts_text: fallbackAnalysis.catalysts_text,
    risks_text: fallbackAnalysis.risks_text,
    tech_view_text: fallbackAnalysis.tech_view_text,
    action_text: fallbackAnalysis.action_text,
    meta: {
      generated_at: new Date().toISOString(),
      model: 'fallback',
      version: "v3-dev-v2.0",
      latency_ms: Date.now() - startTime
    }
  };
}

/**
 * ═══════════════════════════════════════════════════════════════
 * LEGACY FUNCTIONS (Backward Compatibility)
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * 构建简易研报
 * @param {string} symbol - 股票代码
 * @param {object} basicData - 基础数据（报价等）
 * @returns {Promise<object>} 研报对象
 */
async function buildSimpleReport(symbol, basicData = {}) {
  console.log(`📊 [v3-dev Report Service] 开始生成研报: ${symbol}`);
  
  const startTime = Date.now();
  
  // ========== 快速失败：无 API Key 直接用 fallback ==========
  if (!OPENAI_API_KEY) {
    console.warn(`⚠️  [v3-dev Report] 无 OPENAI_API_KEY，使用 fallback`);
    return generateFallbackReport(symbol, basicData, startTime);
  }
  
  try {
    // 准备数据上下文
    const price = basicData.price || basicData.c || 'N/A';
    const change = basicData.change || basicData.d || 'N/A';
    const changePercent = basicData.changePercent || basicData.dp || 'N/A';
    const high = basicData.high || basicData.h || 'N/A';
    const low = basicData.low || basicData.l || 'N/A';
    const volume = basicData.volume || basicData.v || 'N/A';
    
    // 构建 AI prompt - 投行级研报风格
    const systemPrompt = `你是一位资深的卖方研究分析师。请基于提供的市场数据，生成一份机构级别的股票研究报告。

要求：
1. 语言风格：专业、正式、客观，避免使用口语化表达和emoji
2. 评级只能是：STRONG_BUY、BUY、HOLD、SELL、STRONG_SELL 之一
3. 时间范围：短期（1-3月）、中期（3-12月）、长期（1年以上）
4. 必须用中文回复

返回格式（纯JSON，不要markdown代码块）：
{
  "rating": "评级",
  "horizon": "时间范围",
  "company_name": "公司全称（如 NVIDIA Corporation）",
  "investment_summary": "投资结论（2-3句话，专业措辞，明确操作建议和核心理由）",
  "thesis": ["核心观点1（行业/赛道逻辑）", "核心观点2（竞争优势）", "核心观点3（财务表现）"],
  "catalysts": ["催化剂1（产品/事件）", "催化剂2（市场/客户）", "催化剂3（财报/指引）"],
  "risks": ["风险1（需求周期）", "风险2（竞争/监管）", "风险3（估值/市场）"],
  "technical_view": "技术面简评（3-4句话，包含趋势、指标、操作建议）",
  "action": "操作建议（1-2段话，针对不同持仓成本给出建议）"
}`;

    const userPrompt = `请分析以下股票：

股票代码：${symbol.toUpperCase()}
当前价格：${price}
涨跌幅：${changePercent}%
涨跌额：${change}
最高价：${high}
最低价：${low}
成交量：${volume}

请基于以上数据生成研报JSON。`;

    // 调用 GPT-4o-mini（轻量快速）
    console.log(`🤖 [v3-dev Report] 调用 AI: gpt-4o-mini`);
    
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
        max_completion_tokens: 1000,
        temperature: 0.7
      }),
      timeout: 15000 // 15秒超时
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiContent = data.choices?.[0]?.message?.content;
    
    if (!aiContent) {
      throw new Error('AI 返回空内容');
    }

    // 解析 AI 返回的 JSON
    let reportData;
    try {
      // 移除可能的 markdown 代码块标记
      const cleanContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      reportData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.warn(`⚠️  [v3-dev Report] AI返回非JSON格式，使用fallback`);
      // Fallback: 基于价格变化的简单判断
      return generateFallbackReport(symbol, basicData, startTime);
    }

    const elapsed = Date.now() - startTime;
    console.log(`✅ [v3-dev Report] 研报生成完成 (${elapsed}ms)`);

    // 构建最终报告结构 - 投行级格式
    return {
      title: `${symbol.toUpperCase()} 研究报告`,
      symbol: symbol.toUpperCase(),
      company_name: reportData.company_name || symbol.toUpperCase(),
      rating: reportData.rating || 'HOLD',
      horizon: reportData.horizon || '中期',
      investment_summary: reportData.investment_summary || '基于当前数据，建议谨慎观察市场走势。',
      thesis: reportData.thesis || ['市场环境分析', '公司基本面评估', '估值合理性判断'],
      catalysts: reportData.catalysts || ['产品周期演进', '市场需求变化', '财报表现'],
      risks: reportData.risks || ['宏观经济波动', '行业竞争加剧', '估值压力'],
      technical_view: reportData.technical_view || '技术面呈现中性态势，建议关注成交量变化和关键支撑位。',
      action: reportData.action || '建议投资者根据自身风险偏好和持仓成本，谨慎评估操作时机。',
      price_info: {
        current: price,
        change: change,
        change_percent: changePercent,
        high: high,
        low: low,
        volume: volume
      },
      generated_at: new Date().toISOString(),
      model_used: 'gpt-4o-mini',
      latency_ms: elapsed,
      disclaimer: '本报告基于公开市场数据生成，仅供参考，不构成投资建议。投资者应独立判断并承担相应风险。'
    };

  } catch (error) {
    console.error(`❌ [v3-dev Report] AI 调用失败:`, error.message);
    
    // 完全失败时的 fallback
    return generateFallbackReport(symbol, basicData, startTime);
  }
}

/**
 * Fallback 报告生成（不调用 AI）
 */
function generateFallbackReport(symbol, basicData, startTime = Date.now()) {
  // 确保 symbol 是字符串，避免 toUpperCase 报错
  const sym = String(symbol || "UNKNOWN").toUpperCase();
  
  const price = basicData.price || basicData.c || 'N/A';
  const changePercent = basicData.changePercent || basicData.dp || 0;
  
  // 简单的评级逻辑
  let rating = 'HOLD';
  if (changePercent > 5) rating = 'BUY';
  else if (changePercent > 10) rating = 'STRONG_BUY';
  else if (changePercent < -5) rating = 'SELL';
  else if (changePercent < -10) rating = 'STRONG_SELL';

  const elapsed = Date.now() - startTime;

  return {
    title: `${sym} 研究报告`,
    symbol: sym,
    company_name: sym,
    rating: rating,
    horizon: '短期',
    investment_summary: `基于当前市场数据，${sym} 价格为 ${price}，日内涨跌幅 ${changePercent}%。鉴于数据有限，建议投资者保持谨慎，密切关注后续市场动态。`,
    thesis: ['市场整体走势影响短期表现', '板块轮动带来结构性机会', '资金流向决定短期波动方向'],
    catalysts: ['重要财报发布窗口', '行业政策动向', '宏观经济数据公布'],
    risks: ['市场系统性波动风险', '政策不确定性影响', '数据时效性局限'],
    technical_view: '基于当前价格走势的初步判断，技术面呈现观望态势。建议关注成交量变化和关键支撑位的有效性。',
    action: '建议投资者根据自身风险承受能力和投资周期，审慎评估入场时机。对于已有持仓者，可根据成本区间适当调整仓位结构。',
    price_info: {
      current: price,
      change: basicData.change || basicData.d || '暂不提供',
      change_percent: changePercent,
      high: basicData.high || basicData.h || '暂不提供',
      low: basicData.low || basicData.l || '暂不提供',
      volume: basicData.volume || basicData.v || '暂不提供'
    },
    generated_at: new Date().toISOString(),
    model_used: 'fallback',
    latency_ms: elapsed,
    disclaimer: '本报告基于有限市场数据生成，仅供参考，不构成投资建议。投资者应独立判断并承担相应风险。'
  };
}

/**
 * 生成 HTML 格式研报
 * @param {string} symbol - 股票代码
 * @param {object} report - 研报对象
 * @returns {string} HTML 字符串
 */
function generateHTMLReport(symbol, report) {
  console.log(`📄 [v3-dev HTML] 生成 HTML 研报: ${symbol}`);
  
  const ratingColors = {
    'STRONG_BUY': '#10B981',
    'BUY': '#34D399',
    'HOLD': '#FBBF24',
    'SELL': '#F87171',
    'STRONG_SELL': '#EF4444'
  };
  const ratingColor = ratingColors[report.rating] || '#6B7280';
  
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.symbol} 研究报告 - USIS</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
      line-height: 1.8;
      color: #1F2937;
      background: #F9FAFB;
      padding: 40px 20px;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      padding: 50px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .header {
      margin-bottom: 40px;
      padding-bottom: 30px;
      border-bottom: 3px solid #E5E7EB;
    }
    h1 {
      color: #111827;
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .symbol-line {
      font-size: 26px;
      font-weight: 600;
      color: #374151;
      margin: 15px 0;
    }
    .company-name {
      color: #6B7280;
      font-size: 16px;
    }
    .rating-badge {
      display: inline-block;
      padding: 10px 24px;
      background: ${ratingColor};
      color: white;
      border-radius: 6px;
      font-weight: 600;
      font-size: 18px;
      margin: 15px 0;
    }
    .meta-line {
      color: #6B7280;
      font-size: 15px;
      margin: 8px 0;
    }
    h2 {
      color: #111827;
      font-size: 22px;
      font-weight: 600;
      margin: 35px 0 15px 0;
      padding-bottom: 8px;
      border-bottom: 2px solid #E5E7EB;
    }
    h3 {
      color: #374151;
      font-size: 18px;
      font-weight: 600;
      margin: 25px 0 12px 0;
    }
    .section {
      margin: 30px 0;
    }
    .investment-summary {
      background: #EEF2FF;
      padding: 24px;
      border-radius: 8px;
      border-left: 4px solid #4F46E5;
      margin: 20px 0;
      font-size: 16px;
      line-height: 1.9;
    }
    .price-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 15px;
    }
    .price-table th {
      background: #F3F4F6;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #374151;
      border-bottom: 2px solid #E5E7EB;
    }
    .price-table td {
      padding: 12px;
      border-bottom: 1px solid #E5E7EB;
    }
    ul {
      margin: 15px 0;
      padding-left: 24px;
    }
    li {
      margin: 12px 0;
      line-height: 1.8;
    }
    .action-box {
      background: #F0FDF4;
      padding: 24px;
      border-radius: 8px;
      border-left: 4px solid #10B981;
      margin: 20px 0;
    }
    .note {
      color: #6B7280;
      font-size: 13px;
      font-style: italic;
      margin: 10px 0;
    }
    .meta {
      margin-top: 40px;
      padding-top: 25px;
      border-top: 2px solid #E5E7EB;
      font-size: 14px;
      color: #6B7280;
    }
    .meta-item {
      margin: 6px 0;
    }
    .disclaimer {
      background: #FEF3C7;
      border: 1px solid #F59E0B;
      border-radius: 8px;
      padding: 20px;
      margin-top: 30px;
      font-size: 13px;
      color: #92400E;
      line-height: 1.7;
    }
    .disclaimer strong {
      display: block;
      margin-bottom: 10px;
      font-size: 15px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>USIS 研究报告</h1>
      <div class="symbol-line">${report.symbol} - <span class="company-name">${report.company_name}</span></div>
      <div class="rating-badge">${report.rating}</div>
      <div class="meta-line">时间范围：${report.horizon}</div>
      <div class="meta-line">最新价格：${report.price_info.current} 美元 | 日内涨跌：${report.price_info.change} (${report.price_info.change_percent}%)</div>
    </div>

    <h2>一、投资结论（Investment Summary）</h2>
    <div class="investment-summary">${report.investment_summary}</div>

    <h2>二、核心观点（Key Investment Thesis）</h2>
    <ul>
      ${report.thesis.map(t => `<li>${t}</li>`).join('')}
    </ul>

    <h2>三、估值与财务概览（Valuation & Financials）</h2>
    <h3>价格信息</h3>
    <table class="price-table">
      <tr>
        <th>指标</th>
        <th>数值</th>
      </tr>
      <tr>
        <td>当前价格</td>
        <td>${report.price_info.current} 美元</td>
      </tr>
      <tr>
        <td>日内涨跌</td>
        <td>${report.price_info.change} (${report.price_info.change_percent}%)</td>
      </tr>
      <tr>
        <td>日内最高</td>
        <td>${report.price_info.high} 美元</td>
      </tr>
      <tr>
        <td>日内最低</td>
        <td>${report.price_info.low} 美元</td>
      </tr>
      <tr>
        <td>成交量</td>
        <td>${report.price_info.volume}</td>
      </tr>
    </table>
    <p class="note">注：部分估值指标（市盈率、市销率等）需接入更详细的财务数据源，当前版本暂不提供。</p>

    <h2>四、关键驱动因素（Catalysts）</h2>
    <ul>
      ${report.catalysts.map(c => `<li>${c}</li>`).join('')}
    </ul>

    <h2>五、核心风险（Key Risks）</h2>
    <ul>
      ${report.risks.map(r => `<li>${r}</li>`).join('')}
    </ul>

    <h2>六、技术面简评（Technical View）</h2>
    <p>${report.technical_view}</p>

    <h2>七、操作建议（Action）</h2>
    <div class="action-box">${report.action}</div>

    <div class="meta">
      <div class="meta-item">生成时间：${new Date(report.generated_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</div>
      <div class="meta-item">AI 模型：${report.model_used}</div>
      <div class="meta-item">处理时长：${report.latency_ms}ms</div>
      <div class="meta-item">报告版本：v3-dev</div>
    </div>

    <div class="disclaimer">
      <strong>免责声明</strong>
      ${report.disclaimer}
    </div>
  </div>
</body>
</html>`;

  console.log(`✅ [v3-dev HTML] HTML 生成完成`);
  return html;
}

/**
 * 生成 Markdown 格式研报
 * @param {string} symbol - 股票代码
 * @param {object} report - 研报对象
 * @returns {string} Markdown 字符串
 */
function generateMarkdownReport(symbol, report) {
  console.log(`📄 [v3-dev MD] 生成 Markdown 研报: ${symbol}`);
  
  // 投行级风格 - 移除emoji，使用专业评级符号
  const ratingSymbol = {
    'STRONG_BUY': '++',
    'BUY': '+',
    'HOLD': '=',
    'SELL': '-',
    'STRONG_SELL': '--'
  }[report.rating] || '=';

  const markdown = `# USIS 研究报告

## ${report.symbol} - ${report.company_name}

**评级：${report.rating}** (${ratingSymbol})  
**时间范围：${report.horizon}**  
**最新价格：${report.price_info.current} 美元**  
**日内涨跌：${report.price_info.change} (${report.price_info.change_percent}%)**

---

## 一、投资结论（Investment Summary）

${report.investment_summary}

---

## 二、核心观点（Key Investment Thesis）

${report.thesis.map((t, i) => `${i + 1}. ${t}`).join('\n')}

---

## 三、估值与财务概览（Valuation & Financials）

### 价格信息

| 指标 | 数值 |
|------|------|
| 当前价格 | ${report.price_info.current} 美元 |
| 日内涨跌 | ${report.price_info.change} (${report.price_info.change_percent}%) |
| 日内最高 | ${report.price_info.high} 美元 |
| 日内最低 | ${report.price_info.low} 美元 |
| 成交量 | ${report.price_info.volume} |

_注：部分估值指标（市盈率、市销率等）需接入更详细的财务数据源，当前版本暂不提供。_

---

## 四、关键驱动因素（Catalysts）

${report.catalysts.map((c, i) => `${i + 1}. ${c}`).join('\n')}

---

## 五、核心风险（Key Risks）

${report.risks.map((r, i) => `${i + 1}. ${r}`).join('\n')}

---

## 六、技术面简评（Technical View）

${report.technical_view}

---

## 七、操作建议（Action）

${report.action}

---

## 报告信息

- **生成时间：** ${new Date(report.generated_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
- **AI 模型：** ${report.model_used}
- **处理时长：** ${report.latency_ms}ms
- **报告版本：** v3-dev

---

## 免责声明

${report.disclaimer}
`;

  console.log(`✅ [v3-dev MD] Markdown 生成完成`);
  return markdown;
}

/**
 * 使用 DocRaptor API 将 HTML 转换为 PDF（主要方案）
 * @param {string} symbol - 股票代码
 * @param {string} htmlContent - HTML内容
 * @returns {Promise<Buffer>} PDF Buffer
 */
async function generatePdfWithDocRaptor(symbol, htmlContent) {
  const DOC_RAPTOR_API_KEY = process.env.DOC_RAPTOR_API_KEY || '';
  const DOC_RAPTOR_TEST_MODE = process.env.DOC_RAPTOR_TEST_MODE === 'true';
  
  // 如果没有API Key，使用备用方案
  if (!DOC_RAPTOR_API_KEY) {
    console.warn('⚠️  [v3-dev PDF] DocRaptor API Key 未配置，使用 PDFKit 备用方案');
    return generateFallbackPDF(htmlContent);
  }
  
  try {
    console.log(`📄 [v3-dev DocRaptor] 开始生成 PDF (${DOC_RAPTOR_TEST_MODE ? '测试模式' : '生产模式'})...`);
    const fetch = require('node-fetch');
    
    const response = await fetch('https://docraptor.com/docs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_credentials: DOC_RAPTOR_API_KEY,
        test: DOC_RAPTOR_TEST_MODE,
        document_type: 'pdf',
        name: `${symbol}_USIS_Research.pdf`,
        document_content: htmlContent,
        prince_options: {
          media: 'print'
        }
      }),
      timeout: 30000
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DocRaptor API错误: ${response.status} - ${errorText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    console.log(`✅ [v3-dev DocRaptor] PDF生成成功 (${arrayBuffer.byteLength} bytes)`);
    return Buffer.from(arrayBuffer);
    
  } catch (error) {
    console.error('❌ [v3-dev DocRaptor] API调用失败:', error.message);
    console.warn('⚠️  [v3-dev PDF] 降级到 PDFKit 备用方案');
    return generateFallbackPDF(htmlContent);
  }
}

/**
 * 旧的 PDFShift API 函数（已弃用，保留向后兼容）
 * @deprecated 请使用 generatePdfWithDocRaptor
 */
async function convertHTMLtoPDF(htmlContent, symbol = 'UNKNOWN') {
  console.warn('⚠️  [v3-dev] convertHTMLtoPDF 已弃用，自动切换到 DocRaptor');
  return generatePdfWithDocRaptor(symbol, htmlContent);
}

/**
 * 备用方案：使用 PDFKit 生成纯文本 PDF
 * @param {string} htmlContent - HTML内容
 * @returns {Promise<Buffer>} PDF Buffer
 */
function generateFallbackPDF(htmlContent) {
  console.log('📝 [v3-dev PDFKit] 使用备用方案生成PDF...');
  
  // 提取文本内容
  const textContent = htmlContent
    .replace(/<style>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/\n+/g, '\n')
    .trim();
  
  const PDFDocument = require('pdfkit');
  const chunks = [];
  
  const doc = new PDFDocument({ 
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 }
  });
  
  doc.on('data', chunk => chunks.push(chunk));
  
  // 标题
  doc.fontSize(16).font('Helvetica-Bold').text('USIS Research Report', { align: 'center' });
  doc.moveDown();
  
  // 内容
  doc.fontSize(10).font('Helvetica').text(textContent, {
    width: 500,
    align: 'left'
  });
  
  doc.end();
  
  return new Promise((resolve, reject) => {
    doc.on('end', () => {
      console.log('✅ [v3-dev PDFKit] PDF生成成功');
      resolve(Buffer.concat(chunks));
    });
    doc.on('error', reject);
  });
}

/**
 * ═══════════════════════════════════════════════════════════════
 * GENERIC HTML GENERATOR (ResearchReport v1 Consumer)
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Build HTML from ResearchReport v1 schema
 * @param {object} report - ResearchReport v1 object
 * @returns {string} HTML string
 */
function buildHtmlFromReport(report) {
  console.log(`📄 [HTML Generator v2.0] Building 10+ page institutional PDF for ${report.symbol}...`);
  
  const ratingColors = {
    'STRONG_BUY': '#10B981',
    'BUY': '#34D399',
    'HOLD': '#FBBF24',
    'SELL': '#F87171',
    'STRONG_SELL': '#EF4444'
  };
  const ratingColor = ratingColors[report.rating] || '#6B7280';
  
  // Helper: format number with null check
  const fmt = (val, decimals = 2, suffix = '') => {
    if (val === null || val === undefined) return 'N/A';
    return Number(val).toFixed(decimals) + suffix;
  };
  
  // Helper: format currency
  const fmtCurrency = (val, currency = 'USD') => {
    if (val === null || val === undefined) return 'N/A';
    const symbol = currency === 'USD' ? '$' : currency;
    return `${symbol}${Number(val).toFixed(2)}`;
  };
  
  // Helper: format large numbers (e.g., market cap)
  const fmtLarge = (val) => {
    if (val === null || val === undefined) return 'N/A';
    if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    return `$${val.toFixed(2)}`;
  };
  
  // Helper: generate peer comparison table HTML
  const buildPeerTable = () => {
    if (!report.peers || report.peers.length === 0) return '<p class="text-muted">同业对比数据暂无 / Peer comparison data not available</p>';
    
    let html = `<table class="data-table peer-table">
      <thead>
        <tr>
          <th>公司 / Company</th>
          <th>价格 / Price</th>
          <th>市值 / Market Cap</th>
          <th>Forward PE</th>
          <th>PS (TTM)</th>
        </tr>
      </thead>
      <tbody>`;
    
    report.peers.forEach(peer => {
      html += `<tr>
        <td><strong>${peer.symbol}</strong></td>
        <td>${fmtCurrency(peer.price)}</td>
        <td>${fmtLarge(peer.market_cap)}</td>
        <td>${fmt(peer.pe_forward, 2, 'x')}</td>
        <td>${fmt(peer.ps_ttm, 2, 'x')}</td>
      </tr>`;
    });
    
    html += '</tbody></table>';
    return html;
  };
  
  // Helper: generate financials table HTML (5-year history + 2-year forecast)
  const buildFinancialsTable = () => {
    let html = '<div class="financials-section">';
    
    // Revenue History
    if (report.fundamentals.revenue_5y && report.fundamentals.revenue_5y.length > 0) {
      html += `<h3>营收历史 / Revenue History (5Y)</h3>
      <table class="data-table">
        <thead><tr><th>年份 / Year</th><th>营收 / Revenue</th></tr></thead>
        <tbody>`;
      report.fundamentals.revenue_5y.forEach(d => {
        html += `<tr><td>${d.year}</td><td>$${(d.value / 1e9).toFixed(2)}B</td></tr>`;
      });
      html += '</tbody></table>';
    }
    
    // EPS History
    if (report.fundamentals.eps_5y && report.fundamentals.eps_5y.length > 0) {
      html += `<h3>EPS 历史 / EPS History (5Y)</h3>
      <table class="data-table">
        <thead><tr><th>年份 / Year</th><th>EPS</th></tr></thead>
        <tbody>`;
      report.fundamentals.eps_5y.forEach(d => {
        html += `<tr><td>${d.year}</td><td>$${d.value.toFixed(2)}</td></tr>`;
      });
      html += '</tbody></table>';
    }
    
    // Forecasts
    if (report.fundamentals.eps_forecast_2y && report.fundamentals.eps_forecast_2y.length > 0) {
      html += `<h3>EPS 预测 / EPS Forecast (2Y)</h3>
      <table class="data-table">
        <thead><tr><th>年份 / Year</th><th>预测 EPS / Forecast EPS</th></tr></thead>
        <tbody>`;
      report.fundamentals.eps_forecast_2y.forEach(d => {
        html += `<tr><td>${d.year}</td><td>$${d.value.toFixed(2)}</td></tr>`;
      });
      html += '</tbody></table>';
    }
    
    html += '</div>';
    return html;
  };
  
  // Helper: embed charts (ALL 4 CHARTS MANDATORY)
  const embedCharts = () => {
    if (!report.charts) return '<p class="text-muted">Charts unavailable</p>';
    
    let html = '';
    
    // Chart 1: Peer Comparison (always first)
    if (report.charts.peer_chart) {
      html += `<div class="chart-container">
        <h3>Peer Comparison Chart</h3>
        <img src="${report.charts.peer_chart}" alt="Peer Comparison Chart" class="chart-img" />
      </div>`;
    } else {
      html += '<p class="text-muted">Peer comparison chart: Data unavailable</p>';
    }
    
    // Chart 2: 5-Year Revenue
    if (report.charts.revenue_chart) {
      html += `<div class="chart-container">
        <h3>5-Year Revenue History</h3>
        <img src="${report.charts.revenue_chart}" alt="Revenue Chart" class="chart-img" />
      </div>`;
    } else {
      html += '<p class="text-muted">5-year revenue chart: Requires premium data access (Finnhub free tier limitation)</p>';
    }
    
    // Chart 3: 5-Year EPS
    if (report.charts.eps_chart) {
      html += `<div class="chart-container">
        <h3>5-Year EPS History</h3>
        <img src="${report.charts.eps_chart}" alt="EPS Chart" class="chart-img" />
      </div>`;
    } else {
      html += '<p class="text-muted">5-year EPS chart: Requires premium data access (Finnhub free tier limitation)</p>';
    }
    
    // Chart 4: Technical Chart (Price Levels)
    if (report.charts.price_chart) {
      html += `<div class="chart-container">
        <h3>Technical Price Levels (52W Range)</h3>
        <img src="${report.charts.price_chart}" alt="Technical Chart" class="chart-img" />
      </div>`;
    } else {
      html += '<p class="text-muted">Technical chart: Price data unavailable</p>';
    }
    
    return html;
  };
  
  // Helper: build segment revenue table
  const buildSegmentTable = () => {
    if (!report.segments || report.segments.length === 0) {
      return `<table class="data-table">
        <thead>
          <tr>
            <th>Segment Name</th>
            <th>Revenue ($M)</th>
            <th>Growth YoY (%)</th>
            <th>Margin (%)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colspan="4" class="text-muted" style="text-align: center; padding: 20px;">
              Segment-level financial data not available for this security.<br>
              Premium data subscription required for detailed business unit breakdown.
            </td>
          </tr>
        </tbody>
      </table>`;
    }
    
    let html = `<table class="data-table">
      <thead>
        <tr>
          <th>Segment Name</th>
          <th>Revenue ($M)</th>
          <th>Growth YoY (%)</th>
          <th>Margin (%)</th>
        </tr>
      </thead>
      <tbody>`;
    
    report.segments.forEach(seg => {
      html += `<tr>
        <td><strong>${seg.name}</strong></td>
        <td>${fmtLarge(seg.revenue)}</td>
        <td>${fmt(seg.growth_yoy, 1, '%')}</td>
        <td>${fmt(seg.margin, 1, '%')}</td>
      </tr>`;
    });
    
    html += '</tbody></table>';
    return html;
  };
  
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.symbol} 研究报告 - USIS v2.0</title>
  <style>
    @page { size: A4; margin: 20mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', Georgia, 'PingFang SC', 'Microsoft YaHei', serif;
      line-height: 1.6;
      color: #1a1a1a;
      background: white;
      font-size: 11pt;
    }
    .page { page-break-after: always; padding: 20px; min-height: 1000px; }
    .page-break { page-break-before: always; }
    .cover { text-align: center; padding-top: 200px; }
    .cover h1 { font-size: 48px; font-weight: 700; margin-bottom: 30px; color: #003366; }
    .cover .symbol { font-size: 72px; font-weight: 700; color: #000; margin: 40px 0; }
    .cover .company-name { font-size: 24px; color: #666; margin: 20px 0; }
    .cover .rating-large { display: inline-block; padding: 20px 50px; background: ${ratingColor}; color: white; font-size: 32px; font-weight: 700; border-radius: 10px; margin: 40px 0; }
    .cover .meta-cover { font-size: 14px; color: #666; margin-top: 60px; }
    h1 { font-size: 24px; font-weight: 700; color: #003366; margin: 30px 0 20px 0; border-bottom: 3px solid #003366; padding-bottom: 10px; }
    h2 { font-size: 18px; font-weight: 600; color: #003366; margin: 25px 0 15px 0; border-bottom: 2px solid #ccc; padding-bottom: 8px; }
    h3 { font-size: 14px; font-weight: 600; color: #333; margin: 20px 0 12px 0; }
    .section { margin: 20px 0; }
    .text-content { margin: 15px 0; line-height: 1.8; white-space: pre-wrap; }
    .data-table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 10pt; }
    .data-table thead th { background: #003366; color: white; padding: 10px; text-align: left; font-weight: 600; }
    .data-table tbody td { padding: 10px; border-bottom: 1px solid #ddd; }
    .data-table tr:nth-child(even) { background: #f9f9f9; }
    .highlight-box { background: #e6f2ff; padding: 20px; border-left: 4px solid #003366; margin: 20px 0; }
    .targets-grid { display: table; width: 100%; margin: 20px 0; border-collapse: collapse; }
    .targets-grid .target-col { display: table-cell; width: 33%; padding: 20px; border: 2px solid #003366; text-align: center; }
    .target-label { font-size: 11px; text-transform: uppercase; font-weight: 600; color: #666; margin-bottom: 10px; }
    .target-price { font-size: 28px; font-weight: 700; color: #003366; margin: 10px 0; }
    .target-upside { font-size: 14px; font-weight: 600; }
    .positive { color: #10B981; }
    .negative { color: #EF4444; }
    .formula-box { background: #f5f5f5; padding: 15px; border: 1px solid #ccc; font-family: 'Courier New', monospace; margin: 15px 0; }
    .chart-container { margin: 20px 0; text-align: center; page-break-inside: avoid; }
    .chart-img { max-width: 100%; height: auto; border: 1px solid #ddd; }
    .disclaimer { background: #fff8dc; border: 2px solid #f59e0b; padding: 20px; margin-top: 30px; font-size: 10pt; }
    .text-muted { color: #666; font-style: italic; }
  </style>
</head>
<body>

<!-- PAGE 1: COVER -->
<div class="page cover">
  <h1>INSTITUTIONAL EQUITY RESEARCH</h1>
  <div class="symbol">${report.symbol}</div>
  <div class="company-name">${report.name}</div>
  <div class="rating-large">${report.rating}</div>
  <div class="meta-cover">
    <p>Target Price: ${fmtCurrency(report.targets.base.price)} (${report.targets.base.horizon})</p>
    <p>Current Price: ${fmtCurrency(report.price.last)} | Market Cap: ${fmtLarge(report.valuation.market_cap)}</p>
    <p style="margin-top: 40px;">Generated: ${new Date(report.meta.generated_at).toLocaleDateString()}</p>
    <p>USIS Research v2.0 | Powered by ${report.meta.model}</p>
  </div>
</div>

<!-- PAGE 2: EXECUTIVE SUMMARY -->
<div class="page">
  <h1>EXECUTIVE SUMMARY / 投资结论</h1>
  <div class="highlight-box">${report.summary_text}</div>
  
  <h2>Key Metrics / 核心指标</h2>
  <table class="data-table">
    <thead><tr><th>Metric / 指标</th><th>Value / 数值</th></tr></thead>
    <tbody>
      <tr><td>Price / 当前价格</td><td>${fmtCurrency(report.price.last)}</td></tr>
      <tr><td>Market Cap / 市值</td><td>${fmtLarge(report.valuation.market_cap)}</td></tr>
      <tr><td>PE (TTM) / 市盈率</td><td>${fmt(report.valuation.pe_ttm, 2, 'x')}</td></tr>
      <tr><td>Beta / β系数</td><td>${fmt(report.price.beta, 2)}</td></tr>
      <tr><td>52W High-Low / 52周高低</td><td>${fmtCurrency(report.price.high_52w)} - ${fmtCurrency(report.price.low_52w)}</td></tr>
    </tbody>
  </table>
  
  <h2>Investment Rating / 投资评级</h2>
  <p><strong>Rating:</strong> ${report.rating} | <strong>Horizon:</strong> ${report.horizon}</p>
  <p><strong>Base Target:</strong> ${fmtCurrency(report.targets.base.price)} (+${fmt(report.targets.base.upside_pct, 1, '%')})</p>
</div>

<!-- PAGE 3: INVESTMENT THESIS -->
<div class="page">
  <h1>INVESTMENT THESIS / 核心投资逻辑</h1>
  <div class="text-content">${report.thesis_text}</div>
</div>

<!-- PAGE 4: SEGMENT ANALYSIS -->
<div class="page">
  <h1>SEGMENT ANALYSIS / 业务板块分析</h1>
  ${report.segment_text ? `<div class="text-content">${report.segment_text}</div>` : '<p class="text-muted">AI analysis of business segments not available.</p>'}
  
  <h2>Segment Revenue Table / 板块收入表</h2>
  ${buildSegmentTable()}
  
  ${report.macro_text ? `
  <h2>Industry & Macro Trends / 行业与宏观趋势</h2>
  <div class="text-content">${report.macro_text}</div>` : ''}
</div>

<!-- PAGE 5: VALUATION & PEER COMPARISON -->
<div class="page">
  <h1>VALUATION & PEER COMPARISON / 估值与同业对比</h1>
  
  <h2>Valuation Analysis / 估值分析</h2>
  <div class="text-content">${report.valuation_text}</div>
  
  <h2>Valuation Metrics / 估值指标</h2>
  <table class="data-table">
    <thead><tr><th>Metric</th><th>Current</th><th>5Y Median</th><th>5Y High</th><th>5Y Low</th></tr></thead>
    <tbody>
      <tr>
        <td>PE Ratio</td>
        <td>${fmt(report.valuation.pe_ttm, 2, 'x')}</td>
        <td>${fmt(report.valuation.historical_pe_5y?.median, 2, 'x')}</td>
        <td>${fmt(report.valuation.historical_pe_5y?.high, 2, 'x')}</td>
        <td>${fmt(report.valuation.historical_pe_5y?.low, 2, 'x')}</td>
      </tr>
      <tr>
        <td>PS Ratio</td>
        <td>${fmt(report.valuation.ps_ttm, 2, 'x')}</td>
        <td>${fmt(report.valuation.historical_ps_5y?.median, 2, 'x')}</td>
        <td>${fmt(report.valuation.historical_ps_5y?.high, 2, 'x')}</td>
        <td>${fmt(report.valuation.historical_ps_5y?.low, 2, 'x')}</td>
      </tr>
    </tbody>
  </table>
  
  <h2>Peer Comparison / 同业对比</h2>
  ${buildPeerTable()}
  ${embedCharts()}
</div>

<!-- PAGE 6: FINANCIALS -->
<div class="page">
  <h1>FINANCIALS / 财务数据</h1>
  
  <h2>5-Year History + 2-Year Forecast / 5年历史+2年预测</h2>
  ${buildFinancialsTable()}
  
  <h2>Profitability Margins / 盈利能力指标</h2>
  <table class="data-table">
    <thead><tr><th>Metric / 指标</th><th>Value / 数值</th></tr></thead>
    <tbody>
      <tr><td>Gross Margin / 毛利率</td><td>${fmt(report.fundamentals.gross_margin, 1, '%')}</td></tr>
      <tr><td>Operating Margin / 营业利润率</td><td>${fmt(report.fundamentals.operating_margin, 1, '%')}</td></tr>
      <tr><td>Net Margin / 净利率</td><td>${fmt(report.fundamentals.net_margin, 1, '%')}</td></tr>
      <tr><td>ROE / 净资产收益率</td><td>${fmt(report.fundamentals.roe, 1, '%')}</td></tr>
      <tr><td>ROA / 总资产收益率</td><td>${fmt(report.fundamentals.roa, 1, '%')}</td></tr>
    </tbody>
  </table>
</div>

<!-- PAGE 7: PRICE TARGET MODEL -->
<div class="page">
  <h1>PRICE TARGET MODEL / 目标价格模型</h1>
  
  <h2>Methodology / 方法论</h2>
  <p><strong>Model Used:</strong> ${report.targets.methodology}</p>
  
  <h2>Price Targets / 目标价格</h2>
  <div class="targets-grid">
    <div class="target-col">
      <div class="target-label">BEAR CASE</div>
      <div class="target-price">${fmtCurrency(report.targets.bear.price)}</div>
      <div class="target-upside negative">${fmt(report.targets.bear.downside_pct, 1, '%')}</div>
    </div>
    <div class="target-col">
      <div class="target-label">BASE CASE</div>
      <div class="target-price">${fmtCurrency(report.targets.base.price)}</div>
      <div class="target-upside positive">+${fmt(report.targets.base.upside_pct, 1, '%')}</div>
    </div>
    <div class="target-col">
      <div class="target-label">BULL CASE</div>
      <div class="target-price">${fmtCurrency(report.targets.bull.price)}</div>
      <div class="target-upside positive">+${fmt(report.targets.bull.upside_pct, 1, '%')}</div>
    </div>
  </div>
  
  <h2>Valuation Formula / 估值公式</h2>
  <div class="formula-box">
    Base Target = Forward EPS × Target PE Multiple<br>
    Bull Target = Forward EPS × Historical PE High<br>
    Bear Target = Forward EPS × Historical PE Low<br><br>
    Where:<br>
    - Forward EPS = ${report.fundamentals.eps_forecast_2y?.[0]?.value ? `$${report.fundamentals.eps_forecast_2y[0].value.toFixed(2)}` : 'Estimated from current price / PE'}<br>
    - Target PE = ${report.valuation.historical_pe_5y?.median ? `${report.valuation.historical_pe_5y.median.toFixed(2)}x` : 'N/A'} (5Y Median × 1.05)<br>
    - Bull PE = ${report.valuation.historical_pe_5y?.high ? `${report.valuation.historical_pe_5y.high.toFixed(2)}x` : 'N/A'}<br>
    - Bear PE = ${report.valuation.historical_pe_5y?.low ? `${report.valuation.historical_pe_5y.low.toFixed(2)}x` : 'N/A'}
  </div>
</div>

<!-- PAGE 8: CATALYSTS -->
<div class="page">
  <h1>CATALYSTS / 关键驱动因素</h1>
  <div class="text-content">${report.catalysts_text}</div>
</div>

<!-- PAGE 9: RISKS -->
<div class="page">
  <h1>KEY RISKS / 核心风险</h1>
  <div class="text-content">${report.risks_text}</div>
</div>

<!-- PAGE 10: TECHNICAL ANALYSIS -->
<div class="page">
  <h1>TECHNICAL ANALYSIS / 技术面分析</h1>
  
  <h2>Technical View / 技术观点</h2>
  <div class="text-content">${report.tech_view_text}</div>
  
  ${report.techs.rsi_14 !== null || report.techs.ema_50 !== null ? `
  <h2>Technical Indicators / 技术指标</h2>
  <table class="data-table">
    <thead><tr><th>Indicator</th><th>Value</th></tr></thead>
    <tbody>
      ${report.techs.rsi_14 !== null ? `<tr><td>RSI (14)</td><td>${fmt(report.techs.rsi_14, 1)}</td></tr>` : ''}
      ${report.techs.ema_20 !== null ? `<tr><td>EMA (20)</td><td>${fmtCurrency(report.techs.ema_20)}</td></tr>` : ''}
      ${report.techs.ema_50 !== null ? `<tr><td>EMA (50)</td><td>${fmtCurrency(report.techs.ema_50)}</td></tr>` : ''}
      ${report.techs.ema_200 !== null ? `<tr><td>EMA (200)</td><td>${fmtCurrency(report.techs.ema_200)}</td></tr>` : ''}
    </tbody>
  </table>` : ''}
</div>

<!-- PAGE 11: ACTION PLAN & DISCLAIMER -->
<div class="page">
  <h1>ACTION PLAN / 操作建议</h1>
  <div class="highlight-box">${report.action_text}</div>
  
  <h2>Report Metadata / 报告元数据</h2>
  <table class="data-table">
    <tbody>
      <tr><td>Generated / 生成时间</td><td>${new Date(report.meta.generated_at).toLocaleString('zh-CN')}</td></tr>
      <tr><td>AI Model / AI模型</td><td>${report.meta.model}</td></tr>
      <tr><td>Latency / 处理时长</td><td>${report.meta.latency_ms}ms</td></tr>
      <tr><td>Version / 版本</td><td>${report.meta.version}</td></tr>
    </tbody>
  </table>
  
  <div class="disclaimer">
    <h3>DISCLAIMER / 免责声明</h3>
    <p>This research report is generated based on publicly available market data and artificial intelligence analysis. It is provided for informational purposes only and does not constitute investment advice, a recommendation, or an offer to buy or sell any securities.</p>
    <p>本报告基于公开市场数据和人工智能分析生成，仅供参考，不构成投资建议、推荐或买卖任何证券的要约。投资者应进行独立判断并承担相应风险。</p>
    <p><strong>© 2025 USIS Research. All rights reserved.</strong></p>
  </div>
</div>
  </div>
</body>
</html>`;

  console.log(`✅ [HTML Generator] HTML complete for ${report.symbol}`);
  return html;
}

module.exports = {
  // v1 Generic API
  buildResearchReport,
  buildHtmlFromReport,
  
  // Legacy API (backward compatibility)
  buildSimpleReport,
  generateHTMLReport,
  generateMarkdownReport,
  convertHTMLtoPDF,
  generatePdfWithDocRaptor
};
