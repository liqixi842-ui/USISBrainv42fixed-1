/**
 * Screenshot Provider System - v5.0 Pure n8n Webhook
 * 
 * 纯n8n webhook模式：n8n处理所有截图逻辑（包括Browserless调用）
 * Replit专注于：Telegram Bot接口 + 自然语言解析 + 意图路由
 */

const fetch = require('node-fetch');

/**
 * 通过 n8n webhook 调用 Browserless 截图
 * @param {string} url - TradingView URL
 * @returns {Promise<{provider: string, validation: string, elapsed_ms: number, buffer: Buffer}>}
 */
async function captureViaN8N(url, webhookUrl) {
  try {
    if (!webhookUrl) {
      throw new Error('n8n_webhook_url_missing');
    }

    const start = Date.now();
    console.log(`\n📸 [n8n Webhook] 调用截图服务...`);
    console.log(`   URL: ${url}`);
    
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      timeout: 40000
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ [n8n] HTTP ${res.status}: ${errorText.substring(0, 200)}`);
      throw new Error(`n8n_http_${res.status}`);
    }

    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('image/png')) {
      console.error(`❌ [n8n] 错误的Content-Type: ${contentType}`);
      throw new Error('n8n_invalid_content_type');
    }

    const buf = Buffer.from(await res.arrayBuffer());
    
    if (!buf || buf.length < 20000) {
      throw new Error('n8n_small_image');
    }

    const elapsed = Date.now() - start;
    console.log(`✅ [n8n Webhook] 成功 (${elapsed}ms, ${(buf.length / 1024).toFixed(2)} KB)`);

    return {
      provider: 'n8n-browserless',
      validation: 'saas-waited',
      elapsed_ms: elapsed,
      buffer: buf
    };
  } catch (error) {
    console.error(`❌ [n8n Webhook 错误]`, error.message);
    throw new Error(`截图服务暂时不可用: ${error.message}`);
  }
}

/**
 * 主入口：智能热力图截图
 * v5.0: 纯n8n webhook模式（无本地备用方案）
 * @param {Object} params
 * @param {string} params.tradingViewUrl - TradingView 热力图 URL
 * @returns {Promise<{provider: string, validation: string, elapsed_ms: number, buffer: Buffer}>}
 */
async function captureHeatmapSmart({ tradingViewUrl }) {
  const n8nWebhook = process.env.N8N_HEATMAP_WEBHOOK || 'https://qian.app.n8n.cloud/webhook/capture_heatmap';
  return await captureViaN8N(tradingViewUrl, n8nWebhook);
}

module.exports = {
  captureHeatmapSmart
};
