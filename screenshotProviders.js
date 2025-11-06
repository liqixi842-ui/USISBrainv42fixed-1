/**
 * Screenshot Provider System - v5.1 ScreenshotAPI Direct
 * 
 * 架构决策#018: 完全替换为ScreenshotAPI
 * 理由: 已验证可用、响应快（~3s）、更简单可靠
 */

const fetch = require('node-fetch');

/**
 * 主入口：智能热力图截图
 * v5.1: 直接使用ScreenshotAPI（无中间层）
 * @param {Object} params
 * @param {string} params.tradingViewUrl - TradingView 热力图 URL
 * @returns {Promise<{provider: string, validation: string, elapsed_ms: number, buffer: Buffer}>}
 */
async function captureHeatmapSmart({ tradingViewUrl }) {
  console.log(`\n🎯 [ScreenshotAPI] 生成热力图: ${tradingViewUrl}`);
  
  try {
    const start = Date.now();
    
    // 构建ScreenshotAPI URL (GET请求)
    const token = process.env.SCREENSHOTAPI_TOKEN || process.env.SCREENSHOT_API_KEY || 'HHBYB5H-4CT4970-MVZEKM2-EMEWEXX';
    const apiUrl = new URL('https://shot.screenshotapi.net/screenshot');
    apiUrl.searchParams.set('token', token);
    apiUrl.searchParams.set('url', tradingViewUrl);
    apiUrl.searchParams.set('fresh', 'true');
    apiUrl.searchParams.set('output', 'json');
    apiUrl.searchParams.set('width', '1920');
    apiUrl.searchParams.set('height', '1080');
    apiUrl.searchParams.set('delay', '5000');
    
    const maskedUrl = apiUrl.toString().replace(token, '***');
    console.log(`📤 调用ScreenshotAPI: ${maskedUrl}`);
    
    // 使用AbortController实现超时（node-fetch v2兼容）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(apiUrl.toString(), {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ScreenshotAPI_${response.status}: ${errorText.substring(0, 100)}`);
    }
    
    const result = await response.json();
    
    if (!result.screenshot) {
      throw new Error('ScreenshotAPI返回无截图URL');
    }
    
    // 下载截图
    console.log(`📥 下载截图: ${result.screenshot}`);
    
    const imgController = new AbortController();
    const imgTimeoutId = setTimeout(() => imgController.abort(), 15000);
    
    const imageResponse = await fetch(result.screenshot, {
      signal: imgController.signal
    });
    
    clearTimeout(imgTimeoutId);
    
    if (!imageResponse.ok) {
      throw new Error(`下载截图失败: ${imageResponse.status}`);
    }
    
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    
    const elapsed = Date.now() - start;
    console.log(`✅ [ScreenshotAPI] 成功 (${elapsed}ms, ${(buffer.length / 1024).toFixed(2)} KB)`);
    
    return {
      provider: 'screenshotapi',
      validation: 'direct-call',
      buffer: buffer,
      elapsed_ms: elapsed
    };
    
  } catch (error) {
    console.error(`❌ [ScreenshotAPI错误]`, error.message);
    throw new Error(`截图服务失败: ${error.message}`);
  }
}

module.exports = {
  captureHeatmapSmart
};
