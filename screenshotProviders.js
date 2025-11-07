/**
 * N8n Webhook截图服务
 * n8n → ScreenshotAPI → 返回screenshot URL → Replit下载
 */

const fetch = require('node-fetch');

async function captureHeatmapSmart({ tradingViewUrl, timeoutMs = 45000, maxRetries = 2 }) {
  const start = Date.now();
  console.log(`\n📸 [N8n] 调用截图服务 (超时: ${timeoutMs}ms, 最大重试: ${maxRetries}次)`);
  
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 截图尝试 ${attempt}/${maxRetries}`);
      
      const n8nWebhook = process.env.N8N_HEATMAP_WEBHOOK || 'https://qian.app.n8n.cloud/webhook/capture_heatmap';
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
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
      
      console.log(`📥 下载截图: ${jsonData.screenshot.substring(0, 80)}...`);
      
      const imgController = new AbortController();
      const imgTimeoutId = setTimeout(() => imgController.abort(), 20000);
      
      const imgRes = await fetch(jsonData.screenshot, {
        signal: imgController.signal
      });
      
      clearTimeout(imgTimeoutId);
      
      if (!imgRes.ok) {
        throw new Error(`下载失败 ${imgRes.status}`);
      }
      
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      const elapsed = Date.now() - start;
      
      console.log(`✅ 截图成功 (尝试 ${attempt}/${maxRetries}, 耗时 ${elapsed}ms, ${(buffer.length / 1024).toFixed(2)} KB)`);
      
      return {
        success: true,
        provider: 'n8n-screenshotapi',
        validation: 'webhook',
        buffer: buffer,
        elapsed_ms: elapsed,
        attempt: attempt
      };
      
    } catch (error) {
      lastError = error;
      const isTimeout = error.name === 'AbortError';
      console.error(`❌ 截图尝试 ${attempt}/${maxRetries} ${isTimeout ? '超时' : '失败'}:`, error.message);
      
      if (attempt < maxRetries) {
        const waitTime = 3000;
        console.log(`⏳ 等待 ${waitTime}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  const isTimeout = lastError.name === 'AbortError';
  throw new Error(`所有 ${maxRetries} 次截图尝试均失败: ${isTimeout ? '超时' : lastError.message}`);
}

module.exports = {
  captureHeatmapSmart
};
