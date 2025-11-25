/**
 * 🚀 N8N API 客户端 - 完全API自动化控制
 * 功能：工作流管理、执行监控、自动修复
 * 版本：v1.0
 */

const fetch = require('node-fetch');

class N8NClient {
  constructor() {
    this.baseURL = (process.env.N8N_BASE_URL || '').trim();
    this.apiKey = (process.env.N8N_API_KEY || '').trim();
    this.screenshotToken = (process.env.SCREENSHOT_API_KEY || '').trim();
    
    if (!this.baseURL || !this.apiKey) {
      console.warn('⚠️  N8N_BASE_URL 或 N8N_API_KEY 未配置，API模式不可用');
    }
    
    this.headers = {
      'X-N8N-API-KEY': this.apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  /**
   * 检查N8N API是否可用（带缓存，避免阻塞）
   */
  async healthCheck(useCache = true) {
    if (!this.baseURL || !this.apiKey) {
      return { ok: false, error: 'Missing credentials' };
    }

    // 缓存机制：避免频繁API调用
    if (useCache && this._healthCache && Date.now() - this._healthCache.timestamp < 30000) {
      return this._healthCache.data;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.baseURL}/api/v1/workflows`, {
        method: 'GET',
        headers: this.headers,
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const result = { ok: false, error: `HTTP ${response.status}` };
        this._healthCache = { data: result, timestamp: Date.now() };
        return result;
      }

      const data = await response.json();
      const result = { 
        ok: true, 
        workflowCount: data.data?.length || 0,
        message: 'N8N API connected'
      };
      
      this._healthCache = { data: result, timestamp: Date.now() };
      return result;
    } catch (error) {
      const result = { ok: false, error: error.message };
      this._healthCache = { data: result, timestamp: Date.now() };
      return result;
    }
  }

  /**
   * 获取所有工作流
   */
  async getWorkflows() {
    try {
      const response = await fetch(`${this.baseURL}/api/v1/workflows`, {
        method: 'GET',
        headers: this.headers
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return { ok: true, workflows: result.data || [] };
    } catch (error) {
      console.error('❌ 获取工作流失败:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * 根据名称查找工作流
   */
  async findWorkflowByName(name) {
    const result = await this.getWorkflows();
    if (!result.ok) return null;

    return result.workflows.find(w => w.name === name);
  }

  /**
   * 创建新工作流
   */
  async createWorkflow(workflowData) {
    try {
      const response = await fetch(`${this.baseURL}/api/v1/workflows`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(workflowData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      
      // 兼容不同的N8N API响应格式
      const workflow = result.data || result;
      if (!workflow || !workflow.id) {
        throw new Error('API返回了无效的工作流数据');
      }
      
      console.log(`✅ 工作流创建成功: ${workflow.name} (ID: ${workflow.id})`);
      return { ok: true, workflow };
    } catch (error) {
      console.error('❌ 创建工作流失败:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * 更新工作流
   */
  async updateWorkflow(workflowId, workflowData) {
    try {
      const response = await fetch(`${this.baseURL}/api/v1/workflows/${workflowId}`, {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify(workflowData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`✅ 工作流更新成功: ${workflowId}`);
      return { ok: true, workflow: result.data };
    } catch (error) {
      console.error('❌ 更新工作流失败:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * 激活/停用工作流
   */
  async toggleWorkflow(workflowId, active) {
    try {
      const response = await fetch(`${this.baseURL}/api/v1/workflows/${workflowId}/activate`, {
        method: active ? 'POST' : 'DELETE',
        headers: this.headers
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(`✅ 工作流${active ? '激活' : '停用'}成功: ${workflowId}`);
      return { ok: true };
    } catch (error) {
      console.error(`❌ ${active ? '激活' : '停用'}工作流失败:`, error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * 删除工作流
   */
  async deleteWorkflow(workflowId) {
    try {
      const response = await fetch(`${this.baseURL}/api/v1/workflows/${workflowId}`, {
        method: 'DELETE',
        headers: this.headers
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(`✅ 工作流删除成功: ${workflowId}`);
      return { ok: true };
    } catch (error) {
      console.error('❌ 删除工作流失败:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * 执行工作流
   */
  async executeWorkflow(workflowId, data = {}) {
    try {
      const response = await fetch(`${this.baseURL}/api/v1/workflows/${workflowId}/execute`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ data })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`✅ 工作流执行成功: ${workflowId}`);
      return { ok: true, execution: result.data };
    } catch (error) {
      console.error('❌ 执行工作流失败:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * 获取工作流执行历史
   */
  async getExecutions(workflowId, limit = 10) {
    try {
      const url = workflowId 
        ? `${this.baseURL}/api/v1/executions?workflowId=${workflowId}&limit=${limit}`
        : `${this.baseURL}/api/v1/executions?limit=${limit}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return { ok: true, executions: result.data || [] };
    } catch (error) {
      console.error('❌ 获取执行历史失败:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * 🆕 创建股票截图工作流（自动化部署）
   */
  async ensureStockScreenshotWorkflow() {
    // 检查Screenshot API token
    if (!this.screenshotToken) {
      const error = 'SCREENSHOT_API_KEY未配置，无法创建工作流';
      console.error(`❌ ${error}`);
      return { ok: false, error };
    }

    // 检查是否已存在
    const existing = await this.findWorkflowByName('Stock Analysis Screenshot');
    if (existing) {
      console.log(`✅ 工作流已存在: ${existing.name} (ID: ${existing.id})`);
      return { ok: true, workflow: existing, created: false };
    }

    // 创建新工作流
    const workflowDefinition = {
      name: 'Stock Analysis Screenshot',
      nodes: [
        {
          parameters: {
            path: 'stock_analysis_full',
            responseMode: 'responseNode',
            options: {}
          },
          name: 'Webhook',
          type: 'n8n-nodes-base.webhook',
          typeVersion: 1,
          position: [250, 300],
          webhookId: this.generateWebhookId()
        },
        {
          parameters: {
            url: 'https://api.screenshotapi.net/screenshot',
            authentication: 'genericCredentialType',
            genericAuthType: 'queryAuth',
            sendQuery: true,
            queryParameters: {
              parameters: [
                { name: 'token', value: this.screenshotToken },
                { name: 'url', value: '={{ $json.url }}' },
                { name: 'output', value: 'json' },
                { name: 'file_type', value: 'png' },
                { name: 'wait_for_event', value: 'load' },
                { name: 'delay', value: '3000' }
              ]
            },
            options: {
              timeout: 30000
            }
          },
          name: 'ScreenshotAPI',
          type: 'n8n-nodes-base.httpRequest',
          typeVersion: 3,
          position: [450, 300]
        },
        {
          parameters: {
            respondWith: 'json',
            responseBody: '={{ { "chart_binary": $json.screenshot } }}'
          },
          name: 'Respond to Webhook',
          type: 'n8n-nodes-base.respondToWebhook',
          typeVersion: 1,
          position: [650, 300]
        }
      ],
      connections: {
        'Webhook': {
          main: [[{ node: 'ScreenshotAPI', type: 'main', index: 0 }]]
        },
        'ScreenshotAPI': {
          main: [[{ node: 'Respond to Webhook', type: 'main', index: 0 }]]
        }
      },
      settings: {
        executionOrder: 'v1'
      }
    };

    const result = await this.createWorkflow(workflowDefinition);
    if (!result.ok) {
      return { ok: false, error: result.error, created: false };
    }

    // 激活工作流
    const toggleResult = await this.toggleWorkflow(result.workflow.id, true);
    if (!toggleResult.ok) {
      return { ok: false, error: `创建成功但激活失败: ${toggleResult.error}`, created: true };
    }

    return { ok: true, workflow: result.workflow, created: true };
  }

  /**
   * 生成Webhook ID
   */
  generateWebhookId() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * 🆕 监控截图服务健康状态
   */
  async monitorScreenshotHealth() {
    const executions = await this.getExecutions(null, 50);
    if (!executions.ok) {
      return { ok: false, error: executions.error };
    }

    const screenshots = executions.executions.filter(e => 
      e.workflowData?.name?.includes('Screenshot') || 
      e.workflowData?.name?.includes('stock_analysis')
    );

    const recent = screenshots.slice(0, 20);
    
    // 🆕 修复：如果最近执行数太少，返回unknown状态而非critical
    if (recent.length < 5) {
      return {
        ok: true,
        totalExecutions: screenshots.length,
        recentExecutions: recent.length,
        failedCount: 0,
        successRate: 'N/A',
        status: 'unknown',
        message: '执行记录不足，无法判断健康状态'
      };
    }

    const failedCount = recent.filter(e => e.finished === false || e.stoppedAt).length;
    const successRate = ((recent.length - failedCount) / recent.length * 100);

    return {
      ok: true,
      totalExecutions: screenshots.length,
      recentExecutions: recent.length,
      failedCount,
      successRate: successRate.toFixed(1),
      status: successRate >= 80 ? 'healthy' : successRate >= 50 ? 'degraded' : 'critical'
    };
  }
}

// 单例模式
let instance = null;

function getN8NClient() {
  if (!instance) {
    instance = new N8NClient();
  }
  return instance;
}

module.exports = {
  N8NClient,
  getN8NClient
};
