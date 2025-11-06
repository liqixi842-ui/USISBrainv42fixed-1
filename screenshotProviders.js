/**
 * Screenshot Provider System - v5.0 Pure n8n
 * 
 * 全部截图交给 n8n 完成
 * Replit 不再运行 Browserless、ScreenshotAPI 或 QuickChart
 * 
 * 流程：Replit → n8n → ScreenshotOne → 返回图片
 */

const fetch = require('node-fetch');

/**
 * 调用 n8n Webhook 获取截图
 * @param {string} url - TradingView URL
 * @returns {Promise<{provider: string, validation: string, elapsed_ms: number, buffer: Buffer}>}
 */
async function captureViaN8N(url) {
  const hook = process.env.N8N_HEATMAP_WEBHOOK;
  if (!hook) {
    throw new Error('n8n_webhook_not_configured');
  }

  const start = Date.now();
  console.log(`\n📸 [n8n] 调用 Webhook: ${url.substring(0, 80)}...`);
  
  const res = await fetch(hook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
    timeout: 60000  // 60秒超时
  });

  if (!res.ok) {
    throw new Error(`n8n_http_${res.status}`);
  }

  const buf = await res.buffer();
  
  // 验证图片不为空
  if (!buf || buf.length < 20000) {
    throw new Error('n8n_small_image');
  }

  const elapsed = Date.now() - start;
  console.log(`✅ [n8n] 成功 (${elapsed}ms, ${(buf.length / 1024).toFixed(2)} KB)`);

  return {
    provider: 'n8n',
    validation: 'ok',
    elapsed_ms: elapsed,
    buffer: buf
  };
}

/**
 * 主入口：智能热力图截图（v5.0 纯 n8n）
 * @param {Object} params
 * @param {string} params.tradingViewUrl - TradingView 热力图 URL
 * @returns {Promise<{provider: string, validation: string, elapsed_ms: number, buffer: Buffer}>}
 */
async function captureHeatmapSmart({ tradingViewUrl }) {
  return captureViaN8N(tradingViewUrl);
}

module.exports = {
  captureHeatmapSmart
};
