/**
 * Screenshot Provider System - v5.0 n8n Webhook Mode
 * 
 * 架构：Replit调用n8n webhook → n8n调用ScreenshotAPI → 返回PNG
 * n8n端点：https://qian.app.n8n.cloud/webhook/capture_heatmap
 */

const fetch = require('node-fetch');

/**
 * 通过 n8n webhook 调用截图服务
 * n8n内部已配置ScreenshotAPI (shot.screenshotapi.net)
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
    
    // 使用AbortController实现超时（node-fetch v2兼容）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 40000);
    
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ [n8n] HTTP ${res.status}: ${errorText.substring(0, 200)}`);
      throw new Error(`n8n_http_${res.status}`);
    }

    const contentType = res.headers.get('content-type');
    let buf;
    
    // 兼容两种返回格式：PNG binary 或 JSON (含screenshot URL)
    if (contentType && contentType.includes('application/json')) {
      console.log(`📋 [n8n] 返回JSON格式，提取screenshot URL...`);
      const jsonData = await res.json();
      
      if (!jsonData.screenshot) {
        console.error(`❌ [n8n] JSON中无screenshot字段:`, jsonData);
        throw new Error('n8n_no_screenshot_url');
      }
      
      // 下载实际图片
      console.log(`📥 [n8n] 下载图片: ${jsonData.screenshot}`);
      const imgController = new AbortController();
      const imgTimeoutId = setTimeout(() => imgController.abort(), 15000);
      
      const imgRes = await fetch(jsonData.screenshot, {
        signal: imgController.signal
      });
      
      clearTimeout(imgTimeoutId);
      
      if (!imgRes.ok) {
        throw new Error(`图片下载失败: ${imgRes.status}`);
      }
      
      buf = Buffer.from(await imgRes.arrayBuffer());
      
    } else if (contentType && contentType.includes('image/png')) {
      console.log(`🖼️  [n8n] 直接返回PNG`);
      buf = Buffer.from(await res.arrayBuffer());
      
    } else {
      console.error(`❌ [n8n] 不支持的Content-Type: ${contentType}`);
      throw new Error('n8n_invalid_content_type');
    }
    
    if (!buf || buf.length < 20000) {
      throw new Error('n8n_small_image');
    }

    const elapsed = Date.now() - start;
    console.log(`✅ [n8n Webhook] 成功 (${elapsed}ms, ${(buf.length / 1024).toFixed(2)} KB)`);

    return {
      provider: 'n8n-screenshotapi',
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
 * v5.0: 通过n8n webhook模式（n8n内部使用ScreenshotAPI）
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
