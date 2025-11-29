/**
 * ═══════════════════════════════════════════════════════════════
 * CHART ENGINE MODULE
 * ═══════════════════════════════════════════════════════════════
 * 
 * Pipeline Node 4: Generates chart images using QuickChart API
 * 
 * Supported Charts:
 * - Price Line (90 days with EMA20/EMA50 overlay)
 * - Volume Bars (90 days)
 * - Revenue 5-year line (or 20 quarters)
 * - EPS 5-year line
 * - Gross margin trend
 * - Forward PE vs 5Y historical band
 * 
 * Output:
 * {
 *   charts: [
 *     { name: "price_90", url: "https://...", data_points: 90, chart_id: "abc123" },
 *     { name: "revenue_5y", url: null, error: "not enough data" }
 *   ]
 * }
 */

const QuickChart = require('quickchart-js');

class ChartEngine {
  constructor() {
    this.chartWidth = 700;
    this.chartHeight = 400;
    this.backgroundColor = '#ffffff';
  }

  async generate(chartData) {
    console.log(`[ChartEngine] Generating charts for ${chartData.ticker}...`);
    
    const results = [];
    const chartTypes = [
      { key: 'price_line', name: 'price_90', generator: this._generatePriceChart.bind(this) },
      { key: 'volume_bars', name: 'volume_90', generator: this._generateVolumeChart.bind(this) },
      { key: 'revenue_trend', name: 'revenue_trend', generator: this._generateRevenueChart.bind(this) },
      { key: 'eps_trend', name: 'eps_trend', generator: this._generateEpsChart.bind(this) },
      { key: 'margin_trend', name: 'margin_analysis', generator: this._generateMarginChart.bind(this) },
      { key: 'pe_band', name: 'pe_valuation', generator: this._generatePEBandChart.bind(this) },
      { key: 'rsi', name: 'rsi_indicator', generator: this._generateRSIChart.bind(this) },
      { key: 'macd', name: 'macd_indicator', generator: this._generateMACDChart.bind(this) }
    ];

    for (const { key, name, generator } of chartTypes) {
      const data = chartData.charts[key];
      
      if (!data) {
        results.push({
          name,
          url: null,
          data_points: 0,
          chart_id: null,
          error: 'insufficient data'
        });
        continue;
      }

      try {
        const url = await generator(data);
        results.push({
          name,
          url,
          data_points: data.data_points || 0,
          chart_id: this._generateChartId(name, chartData.ticker)
        });
        console.log(`[ChartEngine] ✅ Generated ${name}`);
      } catch (error) {
        results.push({
          name,
          url: null,
          data_points: data.data_points || 0,
          chart_id: null,
          error: error.message
        });
        console.log(`[ChartEngine] ❌ Failed ${name}: ${error.message}`);
      }
    }

    const successful = results.filter(r => r.url !== null).length;
    console.log(`[ChartEngine] Generated ${successful}/${results.length} charts`);
    
    return {
      ticker: chartData.ticker,
      charts: results,
      _meta: {
        charts_generated: successful,
        charts_failed: results.length - successful
      }
    };
  }

  async _generatePriceChart(data) {
    const chart = new QuickChart();
    chart.setWidth(this.chartWidth);
    chart.setHeight(this.chartHeight);
    chart.setBackgroundColor(this.backgroundColor);
    
    chart.setConfig({
      type: 'line',
      data: {
        labels: this._sampleLabels(data.labels, 30),
        datasets: data.datasets.map(ds => ({
          ...ds,
          data: this._sampleData(ds.data, 30),
          borderWidth: ds.label === 'Price' ? 2 : 1,
          pointRadius: 0
        }))
      },
      options: {
        title: { display: true, text: data.title, fontSize: 14 },
        legend: { position: 'bottom' },
        scales: {
          yAxes: [{ ticks: { beginAtZero: false } }],
          xAxes: [{ ticks: { maxTicksLimit: 10 } }]
        }
      }
    });

    return chart.getUrl();
  }

  async _generateVolumeChart(data) {
    const chart = new QuickChart();
    chart.setWidth(this.chartWidth);
    chart.setHeight(300);
    chart.setBackgroundColor(this.backgroundColor);
    
    chart.setConfig({
      type: 'bar',
      data: {
        labels: this._sampleLabels(data.labels, 30),
        datasets: [{
          label: 'Volume',
          data: this._sampleData(data.datasets[0].data, 30),
          backgroundColor: '#64748b'
        }]
      },
      options: {
        title: { display: true, text: data.title, fontSize: 14 },
        legend: { display: false },
        scales: {
          yAxes: [{ 
            ticks: { 
              callback: (value) => {
                if (value >= 1e9) return (value / 1e9).toFixed(1) + 'B';
                if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M';
                if (value >= 1e3) return (value / 1e3).toFixed(1) + 'K';
                return value;
              }
            } 
          }],
          xAxes: [{ ticks: { maxTicksLimit: 10 } }]
        }
      }
    });

    return chart.getUrl();
  }

  async _generateRevenueChart(data) {
    const chart = new QuickChart();
    chart.setWidth(this.chartWidth);
    chart.setHeight(this.chartHeight);
    chart.setBackgroundColor(this.backgroundColor);
    
    chart.setConfig({
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'Revenue ($B)',
          data: data.datasets[0].data,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          fill: true,
          borderWidth: 2,
          pointRadius: 3
        }]
      },
      options: {
        title: { display: true, text: data.title, fontSize: 14 },
        legend: { display: false },
        scales: {
          yAxes: [{ ticks: { beginAtZero: false } }]
        }
      }
    });

    return chart.getUrl();
  }

  async _generateEpsChart(data) {
    const chart = new QuickChart();
    chart.setWidth(this.chartWidth);
    chart.setHeight(this.chartHeight);
    chart.setBackgroundColor(this.backgroundColor);
    
    chart.setConfig({
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'EPS',
          data: data.datasets[0].data,
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          fill: true,
          borderWidth: 2,
          pointRadius: 3
        }]
      },
      options: {
        title: { display: true, text: data.title, fontSize: 14 },
        legend: { display: false },
        scales: {
          yAxes: [{ ticks: { beginAtZero: false } }]
        }
      }
    });

    return chart.getUrl();
  }

  async _generateMarginChart(data) {
    const chart = new QuickChart();
    chart.setWidth(this.chartWidth);
    chart.setHeight(350);
    chart.setBackgroundColor(this.backgroundColor);
    
    chart.setConfig({
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'Margin %',
          data: data.datasets[0].data,
          backgroundColor: data.datasets[0].backgroundColor
        }]
      },
      options: {
        title: { display: true, text: data.title, fontSize: 14 },
        legend: { display: false },
        scales: {
          yAxes: [{ 
            ticks: { 
              beginAtZero: true,
              callback: (value) => value + '%'
            } 
          }]
        }
      }
    });

    return chart.getUrl();
  }

  async _generatePEBandChart(data) {
    const chart = new QuickChart();
    chart.setWidth(this.chartWidth);
    chart.setHeight(250);
    chart.setBackgroundColor(this.backgroundColor);
    
    chart.setConfig({
      type: 'horizontalBar',
      data: {
        labels: ['P/E Range'],
        datasets: [
          {
            label: 'Historical Range',
            data: [data.high - data.low],
            backgroundColor: 'rgba(148, 163, 184, 0.3)'
          },
          {
            label: 'Current P/E',
            data: [data.current],
            backgroundColor: data.current > data.median ? '#ef4444' : '#22c55e'
          }
        ]
      },
      options: {
        title: { display: true, text: `P/E: ${data.current.toFixed(1)}x (Range: ${data.low.toFixed(1)}x - ${data.high.toFixed(1)}x)`, fontSize: 14 },
        legend: { display: false }
      }
    });

    return chart.getUrl();
  }

  async _generateRSIChart(data) {
    const chart = new QuickChart();
    chart.setWidth(this.chartWidth);
    chart.setHeight(280);
    chart.setBackgroundColor(this.backgroundColor);
    
    const labels = this._sampleLabels(data.labels, 30);
    const rsiData = this._sampleData(data.values, 30);
    
    chart.setConfig({
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'RSI',
            data: rsiData,
            borderColor: '#8b5cf6',
            borderWidth: 2,
            pointRadius: 0,
            fill: false
          },
          {
            label: 'Overbought (70)',
            data: Array(labels.length).fill(70),
            borderColor: '#ef4444',
            borderWidth: 1,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
          },
          {
            label: 'Oversold (30)',
            data: Array(labels.length).fill(30),
            borderColor: '#22c55e',
            borderWidth: 1,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        title: { display: true, text: 'RSI (14-period)', fontSize: 14 },
        legend: { position: 'bottom' },
        scales: {
          yAxes: [{ 
            ticks: { 
              min: 0, 
              max: 100,
              stepSize: 20
            } 
          }],
          xAxes: [{ ticks: { maxTicksLimit: 10 } }]
        }
      }
    });

    return chart.getUrl();
  }

  async _generateMACDChart(data) {
    const chart = new QuickChart();
    chart.setWidth(this.chartWidth);
    chart.setHeight(280);
    chart.setBackgroundColor(this.backgroundColor);
    
    const labels = this._sampleLabels(data.labels, 30);
    const macdLine = this._sampleData(data.macd_line, 30);
    const signalLine = this._sampleData(data.signal_line, 30);
    const histogram = this._sampleData(data.histogram, 30);
    
    const histColors = histogram.map(v => v >= 0 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)');
    
    chart.setConfig({
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            type: 'line',
            label: 'MACD',
            data: macdLine,
            borderColor: '#2563eb',
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            yAxisID: 'y-axis-1'
          },
          {
            type: 'line',
            label: 'Signal',
            data: signalLine,
            borderColor: '#f97316',
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            yAxisID: 'y-axis-1'
          },
          {
            type: 'bar',
            label: 'Histogram',
            data: histogram,
            backgroundColor: histColors,
            yAxisID: 'y-axis-1'
          }
        ]
      },
      options: {
        title: { display: true, text: 'MACD (12, 26, 9)', fontSize: 14 },
        legend: { position: 'bottom' },
        scales: {
          yAxes: [{ 
            id: 'y-axis-1',
            position: 'left',
            ticks: { beginAtZero: true }
          }],
          xAxes: [{ ticks: { maxTicksLimit: 10 } }]
        }
      }
    });

    return chart.getUrl();
  }

  _sampleLabels(labels, maxPoints) {
    if (!labels || labels.length <= maxPoints) return labels || [];
    const step = Math.ceil(labels.length / maxPoints);
    return labels.filter((_, i) => i % step === 0);
  }

  _sampleData(data, maxPoints) {
    if (!data || data.length <= maxPoints) return data || [];
    const step = Math.ceil(data.length / maxPoints);
    return data.filter((_, i) => i % step === 0);
  }

  _generateChartId(name, ticker) {
    return `${ticker}_${name}_${Date.now().toString(36)}`;
  }
}

module.exports = new ChartEngine();
