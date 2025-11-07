/**
 * 🔍 N8N工作流监控与自动修复
 * 功能：健康检查、自动部署、故障恢复
 */

const { getN8NClient } = require('./n8nClient');

class N8NMonitor {
  constructor() {
    this.client = getN8NClient();
    this.healthStats = {
      lastCheck: null,
      status: 'unknown',
      consecutiveFailures: 0
    };
  }

  /**
   * 🆕 初始化：确保关键工作流存在
   */
  async initialize() {
    console.log('🔧 [N8N Monitor] 初始化N8N工作流...');
    
    const health = await this.client.healthCheck();
    if (!health.ok) {
      console.warn(`⚠️  N8N API不可用: ${health.error}`);
      return { ok: false, error: health.error };
    }

    console.log(`✅ N8N API已连接 (工作流数量: ${health.workflowCount})`);

    // 确保股票截图工作流存在
    try {
      const result = await this.client.ensureStockScreenshotWorkflow();
      
      if (!result.ok) {
        console.error(`❌ 工作流${result.created ? '创建' : '检查'}失败: ${result.error}`);
        return { ok: false, error: result.error };
      }

      if (result.created) {
        console.log('✅ 股票截图工作流已自动创建');
      } else {
        console.log('✅ 股票截图工作流已存在');
      }
      
      return { ok: true, workflow: result.workflow };
    } catch (error) {
      console.error('❌ 初始化工作流失败:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * 🔍 监控截图服务健康状态
   */
  async checkScreenshotHealth() {
    try {
      const health = await this.client.monitorScreenshotHealth();
      
      if (!health.ok) {
        this.healthStats.consecutiveFailures++;
        this.healthStats.status = 'error';
        this.healthStats.lastCheck = new Date();
        return health;
      }

      // 🆕 修复：只有真正的问题（critical/degraded）才累计失败，unknown/healthy重置
      if (health.status === 'critical' || health.status === 'degraded') {
        this.healthStats.consecutiveFailures++;
        console.warn(`⚠️  截图服务${health.status}: 成功率${health.successRate}%`);
      } else if (health.status === 'unknown') {
        // unknown状态（执行记录不足）不累计失败，但也不重置
        console.log(`ℹ️  截图服务状态未知: ${health.message || '等待执行数据'}`);
      } else {
        // healthy状态重置失败计数
        this.healthStats.consecutiveFailures = 0;
      }

      this.healthStats.status = health.status;
      this.healthStats.lastCheck = new Date();

      return health;
    } catch (error) {
      this.healthStats.consecutiveFailures++;
      this.healthStats.status = 'error';
      return { ok: false, error: error.message };
    }
  }

  /**
   * 🔄 自动修复：重启失败的工作流
   */
  async autoRecover() {
    if (this.healthStats.consecutiveFailures < 3) {
      return { ok: true, action: 'no_action_needed' };
    }

    console.log('🔄 [N8N Monitor] 尝试自动修复...');

    try {
      // 查找股票截图工作流
      const workflow = await this.client.findWorkflowByName('Stock Analysis Screenshot');
      
      if (!workflow) {
        console.log('🆕 重新创建工作流...');
        const result = await this.client.ensureStockScreenshotWorkflow();
        
        if (result.ok) {
          // 🆕 修复：重置失败计数，避免循环重建
          this.healthStats.consecutiveFailures = 0;
          this.healthStats.status = 'unknown';
          this.healthStats.lastCheck = new Date();
        }
        
        return { ok: result.ok, action: 'recreated', error: result.error };
      }

      // 重启工作流（停用再激活）
      console.log('🔄 重启工作流...');
      await this.client.toggleWorkflow(workflow.id, false);
      await new Promise(resolve => setTimeout(resolve, 2000));
      const toggleResult = await this.client.toggleWorkflow(workflow.id, true);

      if (toggleResult.ok) {
        // 🆕 修复：重置失败计数
        this.healthStats.consecutiveFailures = 0;
        this.healthStats.status = 'unknown';
        this.healthStats.lastCheck = new Date();
      }

      return { ok: toggleResult.ok, action: 'restarted' };
    } catch (error) {
      console.error('❌ 自动修复失败:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * 📊 获取监控报告
   */
  getMonitorReport() {
    return {
      ...this.healthStats,
      uptime: process.uptime(),
      needsRecovery: this.healthStats.consecutiveFailures >= 3
    };
  }
}

// 单例
let instance = null;

function getN8NMonitor() {
  if (!instance) {
    instance = new N8NMonitor();
  }
  return instance;
}

module.exports = {
  N8NMonitor,
  getN8NMonitor
};
