/**
 * ═══════════════════════════════════════════════════════════════
 * HISTORY CHART ENGINE
 * ═══════════════════════════════════════════════════════════════
 * 
 * Historical financial chart generation for research reports
 * Uses QuickChart API to generate institutional-grade line charts
 * 
 * Core Functions:
 * - buildRevenueChart(symbol, revenueHistory): 5-year revenue trend chart
 * - buildEPSChart(symbol, epsHistory): 5-year EPS trend chart
 * - buildCombinedChart(symbol, revenueHistory, epsHistory): Combined view
 */

const QuickChart = require('quickchart-js');

class HistoryChartEngine {
  constructor() {
    this.chartWidth = 800;
    this.chartHeight = 400;
    this.backgroundColor = 'white';
  }

  /**
   * Build 5-year revenue trend chart
   * @param {string} symbol - Stock symbol
   * @param {Array} revenueHistory - Array of {year, value} objects
   * @returns {Promise<string>} Chart URL
   */
  async buildRevenueChart(symbol, revenueHistory) {
    console.log(`[HistoryChartEngine] Building revenue chart for ${symbol}...`);
    
    if (!revenueHistory || revenueHistory.length === 0) {
      console.log(`[HistoryChartEngine] ⚠️  No revenue history available - returning placeholder`);
      return null;
    }

    try {
      const chart = new QuickChart();
      
      // Convert revenue to billions for better readability
      const labels = revenueHistory.map(d => d.year.toString());
      const values = revenueHistory.map(d => (d.value / 1e9).toFixed(2));

      chart.setConfig({
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Revenue ($B)',
            data: values,
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgba(54, 162, 235, 0.1)',
            borderWidth: 3,
            tension: 0.1,
            fill: true,
            pointRadius: 5,
            pointHoverRadius: 7
          }]
        },
        options: {
          title: {
            display: true,
            text: `${symbol} - 5-Year Revenue History`,
            fontSize: 18,
            fontStyle: 'bold'
          },
          scales: {
            yAxes: [{
              scaleLabel: {
                display: true,
                labelString: 'Revenue (Billions USD)',
                fontSize: 14
              },
              ticks: {
                beginAtZero: false,
                fontSize: 12
              }
            }],
            xAxes: [{
              scaleLabel: {
                display: true,
                labelString: 'Year',
                fontSize: 14
              },
              ticks: {
                fontSize: 12
              }
            }]
          },
          legend: {
            display: true,
            position: 'top'
          },
          layout: {
            padding: {
              left: 20,
              right: 20,
              top: 20,
              bottom: 20
            }
          }
        }
      });

      chart.setWidth(this.chartWidth)
           .setHeight(this.chartHeight)
           .setBackgroundColor(this.backgroundColor);

      const chartUrl = chart.getUrl();
      console.log(`[HistoryChartEngine] revenue_5y points=${revenueHistory.length} chart_url=${chartUrl.substring(0, 80)}...`);
      
      return chartUrl;
    } catch (error) {
      console.log(`[HistoryChartEngine] Revenue chart error: ${error.message}`);
      return null;
    }
  }

  /**
   * Build 5-year EPS trend chart
   * @param {string} symbol - Stock symbol
   * @param {Array} epsHistory - Array of {year, value} objects
   * @returns {Promise<string>} Chart URL
   */
  async buildEPSChart(symbol, epsHistory) {
    console.log(`[HistoryChartEngine] Building EPS chart for ${symbol}...`);
    
    if (!epsHistory || epsHistory.length === 0) {
      console.log(`[HistoryChartEngine] ⚠️  No EPS history available - returning placeholder`);
      return null;
    }

    try {
      const chart = new QuickChart();
      
      const labels = epsHistory.map(d => d.year.toString());
      const values = epsHistory.map(d => parseFloat(d.value).toFixed(2));

      chart.setConfig({
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'EPS ($)',
            data: values,
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.1)',
            borderWidth: 3,
            tension: 0.1,
            fill: true,
            pointRadius: 5,
            pointHoverRadius: 7
          }]
        },
        options: {
          title: {
            display: true,
            text: `${symbol} - 5-Year EPS History`,
            fontSize: 18,
            fontStyle: 'bold'
          },
          scales: {
            yAxes: [{
              scaleLabel: {
                display: true,
                labelString: 'Earnings Per Share (USD)',
                fontSize: 14
              },
              ticks: {
                beginAtZero: false,
                fontSize: 12
              }
            }],
            xAxes: [{
              scaleLabel: {
                display: true,
                labelString: 'Year',
                fontSize: 14
              },
              ticks: {
                fontSize: 12
              }
            }]
          },
          legend: {
            display: true,
            position: 'top'
          },
          layout: {
            padding: {
              left: 20,
              right: 20,
              top: 20,
              bottom: 20
            }
          }
        }
      });

      chart.setWidth(this.chartWidth)
           .setHeight(this.chartHeight)
           .setBackgroundColor(this.backgroundColor);

      const chartUrl = chart.getUrl();
      console.log(`[HistoryChartEngine] eps_5y points=${epsHistory.length} chart_url=${chartUrl.substring(0, 80)}...`);
      
      return chartUrl;
    } catch (error) {
      console.log(`[HistoryChartEngine] EPS chart error: ${error.message}`);
      return null;
    }
  }

  /**
   * Build combined revenue & EPS chart (dual-axis)
   * @param {string} symbol - Stock symbol
   * @param {Array} revenueHistory - Array of {year, value} objects
   * @param {Array} epsHistory - Array of {year, value} objects
   * @returns {Promise<string>} Chart URL
   */
  async buildCombinedChart(symbol, revenueHistory, epsHistory) {
    console.log(`[HistoryChartEngine] Building combined chart for ${symbol}...`);
    
    if (!revenueHistory || revenueHistory.length === 0 || !epsHistory || epsHistory.length === 0) {
      console.log(`[HistoryChartEngine] ⚠️  Insufficient data for combined chart`);
      return null;
    }

    try {
      const chart = new QuickChart();
      
      const labels = revenueHistory.map(d => d.year.toString());
      const revenueValues = revenueHistory.map(d => (d.value / 1e9).toFixed(2));
      const epsValues = epsHistory.map(d => parseFloat(d.value).toFixed(2));

      chart.setConfig({
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Revenue ($B)',
              data: revenueValues,
              borderColor: 'rgb(54, 162, 235)',
              backgroundColor: 'rgba(54, 162, 235, 0.1)',
              borderWidth: 3,
              tension: 0.1,
              fill: false,
              yAxisID: 'y-axis-revenue',
              pointRadius: 5
            },
            {
              label: 'EPS ($)',
              data: epsValues,
              borderColor: 'rgb(75, 192, 192)',
              backgroundColor: 'rgba(75, 192, 192, 0.1)',
              borderWidth: 3,
              tension: 0.1,
              fill: false,
              yAxisID: 'y-axis-eps',
              pointRadius: 5
            }
          ]
        },
        options: {
          title: {
            display: true,
            text: `${symbol} - 5-Year Financial Performance`,
            fontSize: 18,
            fontStyle: 'bold'
          },
          scales: {
            yAxes: [
              {
                id: 'y-axis-revenue',
                type: 'linear',
                position: 'left',
                scaleLabel: {
                  display: true,
                  labelString: 'Revenue ($B)',
                  fontSize: 14,
                  fontColor: 'rgb(54, 162, 235)'
                },
                ticks: {
                  beginAtZero: false,
                  fontSize: 12
                }
              },
              {
                id: 'y-axis-eps',
                type: 'linear',
                position: 'right',
                scaleLabel: {
                  display: true,
                  labelString: 'EPS ($)',
                  fontSize: 14,
                  fontColor: 'rgb(75, 192, 192)'
                },
                ticks: {
                  beginAtZero: false,
                  fontSize: 12
                },
                gridLines: {
                  drawOnChartArea: false
                }
              }
            ],
            xAxes: [{
              scaleLabel: {
                display: true,
                labelString: 'Year',
                fontSize: 14
              },
              ticks: {
                fontSize: 12
              }
            }]
          },
          legend: {
            display: true,
            position: 'top'
          }
        }
      });

      chart.setWidth(this.chartWidth)
           .setHeight(this.chartHeight)
           .setBackgroundColor(this.backgroundColor);

      const chartUrl = chart.getUrl();
      console.log(`[HistoryChartEngine] combined chart_url=${chartUrl.substring(0, 80)}...`);
      
      return chartUrl;
    } catch (error) {
      console.log(`[HistoryChartEngine] Combined chart error: ${error.message}`);
      return null;
    }
  }

  /**
   * Generate all charts for a symbol
   * @param {string} symbol - Stock symbol
   * @param {Array} revenueHistory - Revenue history
   * @param {Array} epsHistory - EPS history
   * @returns {Promise<object>} Object with all chart URLs
   */
  async generateAllCharts(symbol, revenueHistory, epsHistory) {
    console.log(`\n[HistoryChartEngine] Generating all charts for ${symbol}...`);
    
    const [revenueChart, epsChart, combinedChart] = await Promise.all([
      this.buildRevenueChart(symbol, revenueHistory),
      this.buildEPSChart(symbol, epsHistory),
      this.buildCombinedChart(symbol, revenueHistory, epsHistory)
    ]);

    return {
      revenue_chart: revenueChart,
      eps_chart: epsChart,
      combined_chart: combinedChart
    };
  }
}

// Export singleton instance
module.exports = new HistoryChartEngine();
