#!/usr/bin/env node

/**
 * USIS Brain v4.0 三日监控脚本
 * 
 * 功能：
 * 1. 实时监控响应时间、错误率、成本
 * 2. 每小时汇总并输出报表
 * 3. 异常指标自动告警
 * 4. 生成对比报告（v3.1 vs v4.0）
 */

const fs = require('fs');
const path = require('path');

class V4Monitor {
  constructor() {
    this.metrics = {
      total_requests: 0,
      successful_requests: 0,
      failed_requests: 0,
      total_cost_usd: 0,
      total_response_time_ms: 0,
      response_times: [],
      costs: [],
      errors: [],
      start_time: Date.now()
    };
    
    this.hourly_snapshots = [];
    this.log_file = path.join(__dirname, 'v4_monitor.log');
    this.report_file = path.join(__dirname, 'v4_daily_report.json');
    
    // v3.1基准指标
    this.baseline = {
      avg_response_time_ms: 16000,
      avg_cost_usd: 0.06,
      error_rate: 0.02
    };
    
    // 告警阈值
    this.thresholds = {
      max_response_time_ms: 20000,  // 超过20s告警
      max_error_rate: 0.05,          // 错误率超过5%告警
      max_cost_usd: 0.05             // 单次成本超过$0.05告警
    };
  }
  
  /**
   * 记录单次请求
   */
  recordRequest(data) {
    this.metrics.total_requests++;
    
    if (data.success) {
      this.metrics.successful_requests++;
      this.metrics.total_response_time_ms += data.response_time_ms;
      this.metrics.total_cost_usd += data.cost_usd;
      
      this.metrics.response_times.push(data.response_time_ms);
      this.metrics.costs.push(data.cost_usd);
      
      // 实时告警检查
      this.checkAlerts(data);
      
    } else {
      this.metrics.failed_requests++;
      this.metrics.errors.push({
        timestamp: new Date().toISOString(),
        error: data.error,
        request_id: data.request_id
      });
    }
    
    // 记录到日志
    this.log(`[${data.success ? '✅' : '❌'}] Req ${this.metrics.total_requests}: ${data.response_time_ms}ms, $${data.cost_usd.toFixed(4)}`);
  }
  
  /**
   * 异常告警
   */
  checkAlerts(data) {
    const alerts = [];
    
    if (data.response_time_ms > this.thresholds.max_response_time_ms) {
      alerts.push(`⚠️ 响应时间过长: ${data.response_time_ms}ms (阈值: ${this.thresholds.max_response_time_ms}ms)`);
    }
    
    if (data.cost_usd > this.thresholds.max_cost_usd) {
      alerts.push(`⚠️ 单次成本过高: $${data.cost_usd.toFixed(4)} (阈值: $${this.thresholds.max_cost_usd})`);
    }
    
    const current_error_rate = this.metrics.failed_requests / this.metrics.total_requests;
    if (current_error_rate > this.thresholds.max_error_rate) {
      alerts.push(`⚠️ 错误率过高: ${(current_error_rate * 100).toFixed(2)}% (阈值: ${this.thresholds.max_error_rate * 100}%)`);
    }
    
    if (alerts.length > 0) {
      console.error('\n🚨 告警:\n' + alerts.join('\n'));
      this.log('🚨 ' + alerts.join(' | '));
    }
  }
  
  /**
   * 生成小时快照
   */
  hourlySnapshot() {
    const snapshot = {
      timestamp: new Date().toISOString(),
      total_requests: this.metrics.total_requests,
      successful_requests: this.metrics.successful_requests,
      failed_requests: this.metrics.failed_requests,
      error_rate: (this.metrics.failed_requests / this.metrics.total_requests || 0).toFixed(4),
      avg_response_time_ms: Math.round(this.metrics.total_response_time_ms / this.metrics.successful_requests || 0),
      p50_response_time_ms: this.percentile(this.metrics.response_times, 50),
      p95_response_time_ms: this.percentile(this.metrics.response_times, 95),
      avg_cost_usd: (this.metrics.total_cost_usd / this.metrics.successful_requests || 0).toFixed(4),
      total_cost_usd: this.metrics.total_cost_usd.toFixed(4)
    };
    
    this.hourly_snapshots.push(snapshot);
    
    // 输出到控制台
    console.log('\n📊 小时报表:');
    console.log(`   请求数: ${snapshot.total_requests} (成功: ${snapshot.successful_requests}, 失败: ${snapshot.failed_requests})`);
    console.log(`   错误率: ${(snapshot.error_rate * 100).toFixed(2)}%`);
    console.log(`   响应时间: 平均 ${snapshot.avg_response_time_ms}ms, P50 ${snapshot.p50_response_time_ms}ms, P95 ${snapshot.p95_response_time_ms}ms`);
    console.log(`   成本: 平均 $${snapshot.avg_cost_usd}, 总计 $${snapshot.total_cost_usd}`);
    
    // 对比v3.1
    const improvement = {
      response_time: ((this.baseline.avg_response_time_ms - snapshot.avg_response_time_ms) / this.baseline.avg_response_time_ms * 100).toFixed(1),
      cost: ((this.baseline.avg_cost_usd - snapshot.avg_cost_usd) / this.baseline.avg_cost_usd * 100).toFixed(1)
    };
    console.log(`   vs v3.1: 响应时间 ↓${improvement.response_time}%, 成本 ↓${improvement.cost}%\n`);
    
    return snapshot;
  }
  
  /**
   * 生成每日报告
   */
  dailyReport() {
    const report = {
      date: new Date().toISOString().split('T')[0],
      duration_hours: ((Date.now() - this.metrics.start_time) / 3600000).toFixed(2),
      summary: {
        total_requests: this.metrics.total_requests,
        successful_requests: this.metrics.successful_requests,
        failed_requests: this.metrics.failed_requests,
        error_rate: (this.metrics.failed_requests / this.metrics.total_requests || 0).toFixed(4),
        total_cost_usd: this.metrics.total_cost_usd.toFixed(2)
      },
      performance: {
        avg_response_time_ms: Math.round(this.metrics.total_response_time_ms / this.metrics.successful_requests || 0),
        p50_response_time_ms: this.percentile(this.metrics.response_times, 50),
        p95_response_time_ms: this.percentile(this.metrics.response_times, 95),
        p99_response_time_ms: this.percentile(this.metrics.response_times, 99),
        min_response_time_ms: Math.min(...this.metrics.response_times),
        max_response_time_ms: Math.max(...this.metrics.response_times)
      },
      cost: {
        avg_cost_usd: (this.metrics.total_cost_usd / this.metrics.successful_requests || 0).toFixed(4),
        min_cost_usd: Math.min(...this.metrics.costs).toFixed(4),
        max_cost_usd: Math.max(...this.metrics.costs).toFixed(4),
        total_cost_usd: this.metrics.total_cost_usd.toFixed(2)
      },
      comparison_vs_v31: {
        response_time_improvement: `${((this.baseline.avg_response_time_ms - report.performance.avg_response_time_ms) / this.baseline.avg_response_time_ms * 100).toFixed(1)}%`,
        cost_reduction: `${((this.baseline.avg_cost_usd - report.cost.avg_cost_usd) / this.baseline.avg_cost_usd * 100).toFixed(1)}%`,
        monthly_savings_usd: ((this.baseline.avg_cost_usd - report.cost.avg_cost_usd) * 300000).toFixed(0)  // 假设30万次/月
      },
      errors: this.metrics.errors.slice(-10),  // 最近10个错误
      hourly_snapshots: this.hourly_snapshots
    };
    
    // 保存到文件
    fs.writeFileSync(this.report_file, JSON.stringify(report, null, 2));
    
    console.log('\n📋 每日报告已生成: ' + this.report_file);
    console.log(JSON.stringify(report, null, 2));
    
    return report;
  }
  
  /**
   * 计算百分位数
   */
  percentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return Math.round(sorted[index]);
  }
  
  /**
   * 日志记录
   */
  log(message) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(this.log_file, logLine);
  }
  
  /**
   * 启动监控（监听日志文件）
   */
  start() {
    console.log('🔍 v4.0 监控启动...');
    console.log(`   日志文件: ${this.log_file}`);
    console.log(`   报告文件: ${this.report_file}`);
    console.log('   告警阈值:');
    console.log(`     - 响应时间: ${this.thresholds.max_response_time_ms}ms`);
    console.log(`     - 错误率: ${this.thresholds.max_error_rate * 100}%`);
    console.log(`     - 单次成本: $${this.thresholds.max_cost_usd}\n`);
    
    // 每小时生成快照
    setInterval(() => {
      if (this.metrics.total_requests > 0) {
        this.hourlySnapshot();
      }
    }, 3600000);  // 1小时
    
    // 每天生成报告（测试期间改为每4小时）
    setInterval(() => {
      if (this.metrics.total_requests > 0) {
        this.dailyReport();
      }
    }, 14400000);  // 4小时
  }
}

// 单例导出
const monitor = new V4Monitor();

// 如果直接运行，启动监控
if (require.main === module) {
  monitor.start();
  
  // 测试数据（演示）
  console.log('📊 开始监控（Ctrl+C退出）...\n');
  
  // 保持进程运行
  setInterval(() => {
    // 空循环，保持进程
  }, 1000000);
}

module.exports = monitor;
