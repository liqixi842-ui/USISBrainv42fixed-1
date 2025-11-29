/**
 * ═══════════════════════════════════════════════════════════════
 * HEALTH MONITOR MODULE
 * ═══════════════════════════════════════════════════════════════
 * 
 * Pipeline monitoring and alerting system
 * 
 * Features:
 * - API connection health checks
 * - Pipeline execution metrics
 * - Alert on repeated failures
 * - Daily health report generation
 */

const fetch = require('node-fetch');

class HealthMonitor {
  constructor() {
    this.metrics = {
      pipeline_runs: 0,
      successful_runs: 0,
      failed_runs: 0,
      degraded_runs: 0,
      avg_execution_time_ms: 0,
      last_run: null,
      api_status: {
        finnhub: 'unknown',
        alpha_vantage: 'unknown',
        twelve_data: 'unknown',
        quickchart: 'unknown'
      },
      last_health_check: null,
      errors_24h: []
    };
    
    this.alertThresholds = {
      consecutive_failures: 3,
      degraded_rate: 0.5,
      avg_execution_time_warning_ms: 30000
    };
    
    this.consecutiveFailures = 0;
  }

  recordRun(result) {
    this.metrics.pipeline_runs++;
    this.metrics.last_run = new Date().toISOString();
    
    if (result.status === 'ok') {
      this.metrics.successful_runs++;
      this.consecutiveFailures = 0;
    } else if (result.status === 'degraded') {
      this.metrics.degraded_runs++;
      this.consecutiveFailures = 0;
    } else {
      this.metrics.failed_runs++;
      this.consecutiveFailures++;
      
      this.metrics.errors_24h.push({
        timestamp: new Date().toISOString(),
        ticker: result.ticker,
        errors: result.errors
      });
      
      this._cleanOldErrors();
      
      if (this.consecutiveFailures >= this.alertThresholds.consecutive_failures) {
        this._sendAlert('consecutive_failures', {
          count: this.consecutiveFailures,
          last_error: result.errors[0]
        });
      }
    }
    
    const totalTime = result._meta?.total_time_ms || 0;
    this.metrics.avg_execution_time_ms = Math.round(
      (this.metrics.avg_execution_time_ms * (this.metrics.pipeline_runs - 1) + totalTime) 
      / this.metrics.pipeline_runs
    );
  }

  async checkAPIs() {
    console.log(`[HealthMonitor] Running API health checks...`);
    
    const checks = [
      { name: 'finnhub', check: this._checkFinnhub.bind(this) },
      { name: 'alpha_vantage', check: this._checkAlphaVantage.bind(this) },
      { name: 'twelve_data', check: this._checkTwelveData.bind(this) },
      { name: 'quickchart', check: this._checkQuickChart.bind(this) }
    ];

    for (const { name, check } of checks) {
      try {
        const result = await check();
        this.metrics.api_status[name] = result ? 'healthy' : 'unhealthy';
      } catch (error) {
        this.metrics.api_status[name] = 'error';
        console.error(`[HealthMonitor] ${name} check failed: ${error.message}`);
      }
    }

    this.metrics.last_health_check = new Date().toISOString();
    
    return this.metrics.api_status;
  }

  async _checkFinnhub() {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) return false;
    
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=AAPL&token=${apiKey}`, { timeout: 5000 });
    const data = await res.json();
    return data.c !== undefined;
  }

  async _checkAlphaVantage() {
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    if (!apiKey) return false;
    
    const res = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=${apiKey}`, { timeout: 10000 });
    const data = await res.json();
    return data['Global Quote'] !== undefined;
  }

  async _checkTwelveData() {
    const apiKey = process.env.TWELVE_DATA_API_KEY;
    if (!apiKey) return false;
    
    const res = await fetch(`https://api.twelvedata.com/quote?symbol=AAPL&apikey=${apiKey}`, { timeout: 10000 });
    const data = await res.json();
    return data.symbol !== undefined;
  }

  async _checkQuickChart() {
    try {
      const testConfig = {
        type: 'line',
        data: { labels: ['a', 'b'], datasets: [{ data: [1, 2] }] }
      };
      const url = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(testConfig))}`;
      const res = await fetch(url, { method: 'HEAD', timeout: 5000 });
      return res.ok;
    } catch {
      return false;
    }
  }

  _cleanOldErrors() {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000);
    this.metrics.errors_24h = this.metrics.errors_24h.filter(
      e => new Date(e.timestamp).getTime() > cutoff
    );
  }

  _sendAlert(type, data) {
    console.warn(`[HealthMonitor] ⚠️ ALERT: ${type}`, data);
    
  }

  getStatus() {
    const successRate = this.metrics.pipeline_runs > 0 
      ? (this.metrics.successful_runs / this.metrics.pipeline_runs * 100).toFixed(1)
      : 0;
    
    const degradedRate = this.metrics.pipeline_runs > 0
      ? (this.metrics.degraded_runs / this.metrics.pipeline_runs * 100).toFixed(1)
      : 0;

    return {
      status: this._determineOverallStatus(),
      metrics: {
        total_runs: this.metrics.pipeline_runs,
        success_rate: `${successRate}%`,
        degraded_rate: `${degradedRate}%`,
        avg_execution_time: `${this.metrics.avg_execution_time_ms}ms`,
        errors_last_24h: this.metrics.errors_24h.length
      },
      api_status: this.metrics.api_status,
      last_run: this.metrics.last_run,
      last_health_check: this.metrics.last_health_check
    };
  }

  _determineOverallStatus() {
    if (this.consecutiveFailures >= 3) return 'critical';
    if (this.metrics.failed_runs > this.metrics.successful_runs) return 'degraded';
    
    const unhealthyAPIs = Object.values(this.metrics.api_status)
      .filter(s => s === 'unhealthy' || s === 'error').length;
    if (unhealthyAPIs > 2) return 'degraded';
    
    return 'healthy';
  }

  generateDailyReport() {
    const status = this.getStatus();
    
    return `
═══════════════════════════════════════════════════════════════
PIPELINE HEALTH REPORT - ${new Date().toISOString().split('T')[0]}
═══════════════════════════════════════════════════════════════

OVERALL STATUS: ${status.status.toUpperCase()}

EXECUTION METRICS:
  • Total Runs: ${status.metrics.total_runs}
  • Success Rate: ${status.metrics.success_rate}
  • Degraded Rate: ${status.metrics.degraded_rate}
  • Avg Execution Time: ${status.metrics.avg_execution_time}
  • Errors (24h): ${status.metrics.errors_last_24h}

API STATUS:
  • Finnhub: ${status.api_status.finnhub}
  • Alpha Vantage: ${status.api_status.alpha_vantage}
  • Twelve Data: ${status.api_status.twelve_data}
  • QuickChart: ${status.api_status.quickchart}

Last Run: ${status.last_run || 'Never'}
Last Health Check: ${status.last_health_check || 'Never'}
═══════════════════════════════════════════════════════════════
`;
  }
}

module.exports = new HealthMonitor();
