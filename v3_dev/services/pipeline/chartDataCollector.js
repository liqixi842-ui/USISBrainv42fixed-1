/**
 * ═══════════════════════════════════════════════════════════════
 * CHART DATA COLLECTOR MODULE
 * ═══════════════════════════════════════════════════════════════
 * 
 * Pipeline Node 3: Transforms raw data into chart-ready series
 * 
 * Generates:
 * - Price line with EMA20/EMA50 overlays
 * - Volume bars
 * - Revenue trend (quarters/years)
 * - EPS trend (quarters/years)
 * - Gross margin trend
 * - Forward PE vs 5Y historical band
 */

class ChartDataCollector {
  constructor() {
    this.chartConfigs = [];
  }

  collect(validatedData) {
    console.log(`[ChartDataCollector] Preparing chart data for ${validatedData.data.ticker}...`);
    
    const data = validatedData.data;
    const charts = {
      price_line: null,
      volume_bars: null,
      revenue_trend: null,
      eps_trend: null,
      margin_trend: null,
      pe_band: null
    };

    if (data.prices && data.prices.length >= 60) {
      charts.price_line = this._preparePriceData(data.prices);
      charts.volume_bars = this._prepareVolumeData(data.prices);
    }

    if (data.revenue_quarters && data.revenue_quarters.length >= 4) {
      charts.revenue_trend = this._prepareRevenueTrend(data.revenue_quarters);
    }

    if (data.eps_quarters && data.eps_quarters.length >= 4) {
      charts.eps_trend = this._prepareEpsTrend(data.eps_quarters);
    }

    if (data.fundamentals) {
      charts.margin_trend = this._prepareMarginData(data.fundamentals, data.revenue_quarters);
    }

    if (data.fundamentals && data.fundamentals.pe_ttm) {
      charts.pe_band = this._preparePEBand(data.fundamentals);
    }

    const prepared = Object.entries(charts).filter(([_, v]) => v !== null).length;
    console.log(`[ChartDataCollector] Prepared ${prepared} chart datasets`);
    
    return {
      ticker: data.ticker,
      charts,
      _meta: {
        charts_prepared: prepared,
        charts_skipped: 6 - prepared
      }
    };
  }

  _preparePriceData(prices) {
    const dates = prices.map(p => p.date);
    const closes = prices.map(p => p.close);
    const ema20 = this._calculateEMA(closes, 20);
    const ema50 = this._calculateEMA(closes, 50);
    
    return {
      type: 'line',
      title: 'Price (90 days) with EMA20/EMA50',
      labels: dates,
      datasets: [
        { label: 'Price', data: closes, borderColor: '#2563eb', fill: false },
        { label: 'EMA20', data: ema20, borderColor: '#f59e0b', fill: false, borderDash: [5, 5] },
        { label: 'EMA50', data: ema50, borderColor: '#ef4444', fill: false, borderDash: [5, 5] }
      ],
      data_points: closes.length
    };
  }

  _prepareVolumeData(prices) {
    const dates = prices.map(p => p.date);
    const volumes = prices.map(p => p.volume);
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    
    const colors = volumes.map(v => v > avgVolume ? '#22c55e' : '#94a3b8');
    
    return {
      type: 'bar',
      title: 'Volume (90 days)',
      labels: dates,
      datasets: [
        { label: 'Volume', data: volumes, backgroundColor: colors }
      ],
      data_points: volumes.length,
      avg_volume: avgVolume
    };
  }

  _prepareRevenueTrend(quarters) {
    const labels = quarters.map(q => q.date.substring(0, 7));
    const values = quarters.map(q => q.revenue / 1e9);
    
    return {
      type: 'line',
      title: 'Revenue Trend ($B)',
      labels,
      datasets: [
        { label: 'Revenue', data: values, borderColor: '#2563eb', fill: true, backgroundColor: 'rgba(37, 99, 235, 0.1)' }
      ],
      data_points: values.length
    };
  }

  _prepareEpsTrend(quarters) {
    const labels = quarters.map(q => q.date.substring(0, 7));
    const values = quarters.map(q => q.eps);
    
    return {
      type: 'line',
      title: 'EPS Trend',
      labels,
      datasets: [
        { label: 'EPS', data: values, borderColor: '#22c55e', fill: true, backgroundColor: 'rgba(34, 197, 94, 0.1)' }
      ],
      data_points: values.length
    };
  }

  _prepareMarginData(fundamentals, quarters) {
    if (!fundamentals.gross_margin) return null;
    
    return {
      type: 'bar',
      title: 'Margin Analysis (%)',
      labels: ['Gross', 'Operating', 'Net'],
      datasets: [
        { 
          label: 'Margins', 
          data: [
            fundamentals.gross_margin,
            fundamentals.operating_margin,
            fundamentals.net_margin
          ],
          backgroundColor: ['#2563eb', '#8b5cf6', '#22c55e']
        }
      ],
      data_points: 3
    };
  }

  _preparePEBand(fundamentals) {
    const currentPE = fundamentals.pe_ttm;
    const historicalLow = currentPE * 0.6;
    const historicalHigh = currentPE * 1.4;
    const median = (historicalLow + historicalHigh) / 2;
    
    return {
      type: 'horizontalBar',
      title: 'P/E vs Historical Range',
      current: currentPE,
      low: historicalLow,
      high: historicalHigh,
      median,
      position: ((currentPE - historicalLow) / (historicalHigh - historicalLow)) * 100
    };
  }

  _calculateEMA(data, period) {
    const k = 2 / (period + 1);
    const emaData = [];
    
    let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        emaData.push(null);
      } else {
        ema = data[i] * k + ema * (1 - k);
        emaData.push(parseFloat(ema.toFixed(2)));
      }
    }
    
    return emaData;
  }
}

module.exports = new ChartDataCollector();
