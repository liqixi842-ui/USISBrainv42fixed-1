/**
 * N8n Webhook截图服务
 * n8n → ScreenshotAPI → 返回screenshot URL → Replit下载
 */

const fetch = require('node-fetch');

async function captureHeatmapSmart({ tradingViewUrl }) {
  const start = Date.now();
  console.log(`\n📸 [N8n] 调用截图服务`);
  
  try {
    const n8nWebhook = process.env.N8N_HEATMAP_WEBHOOK || 'https://qian.app.n8n.cloud/webhook/capture_heatmap';
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(n8nWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: tradingViewUrl }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const jsonData = await response.json();
    
    if (!jsonData.screenshot) {
      console.error('❌ N8n响应:', jsonData);
      throw new Error('无截图URL');
    }
    
    console.log(`📥 下载: ${jsonData.screenshot}`);
    
    const imgController = new AbortController();
    const imgTimeoutId = setTimeout(() => imgController.abort(), 15000);
    
    const imgRes = await fetch(jsonData.screenshot, {
      signal: imgController.signal
    });
    
    clearTimeout(imgTimeoutId);
    
    if (!imgRes.ok) {
      throw new Error(`下载失败 ${imgRes.status}`);
    }
    
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const elapsed = Date.now() - start;
    
    console.log(`✅ 成功 (${elapsed}ms, ${(buffer.length / 1024).toFixed(2)} KB)`);
    
    return {
      success: true,
      provider: 'n8n-screenshotapi',
      validation: 'webhook',
      buffer: buffer,
      elapsed_ms: elapsed
    };
    
  } catch (error) {
    const isTimeout = error.name === 'AbortError';
    console.error(`❌ ${isTimeout ? '超时' : '错误'}:`, error.message);
    throw new Error(`截图服务${isTimeout ? '超时' : '失败'}: ${error.message}`);
  }
}

module.exports = {
  captureHeatmapSmart
};
