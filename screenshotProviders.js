/**
 * Screenshot Provider System - n8n Webhook
 * Replit只负责调用n8n webhook，n8n处理截图逻辑
 */

const fetch = require('node-fetch');

async function captureHeatmapSmart({ tradingViewUrl }) {
  const webhookUrl = process.env.N8N_HEATMAP_WEBHOOK || 'https://qian.app.n8n.cloud/webhook/capture_heatmap';
  const start = Date.now();
  
  console.log(`\n📸 [n8n] 调用webhook: ${webhookUrl}`);
  console.log(`   URL: ${tradingViewUrl}`);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 40000);
    
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: tradingViewUrl }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    
    const buf = Buffer.from(await res.arrayBuffer());
    const elapsed = Date.now() - start;
    
    console.log(`✅ [n8n] 成功 (${elapsed}ms, ${(buf.length / 1024).toFixed(2)} KB)`);
    
    return {
      provider: 'n8n',
      validation: 'webhook',
      buffer: buf,
      elapsed_ms: elapsed
    };
    
  } catch (error) {
    console.error(`❌ [n8n] 错误:`, error.message);
    throw new Error(`n8n调用失败: ${error.message}`);
  }
}

module.exports = {
  captureHeatmapSmart
};
