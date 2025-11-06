/**
 * Screenshot Provider System - v5.1 Direct ScreenshotAPI
 * 
 * 简化架构：Replit直接调用ScreenshotAPI（单跳）
 * 端点：https://shot.screenshotapi.net/screenshot
 */

const fetch = require('node-fetch');

/**
 * 主入口：智能热力图截图
 * v5.1: 直接调用ScreenshotAPI（已验证）
 * @param {Object} params
 * @param {string} params.tradingViewUrl - TradingView 热力图 URL
 * @returns {Promise<{provider: string, validation: string, elapsed_ms: number, buffer: Buffer}>}
 */
async function captureHeatmapSmart({ tradingViewUrl }) {
  const start = Date.now();
  console.log(`\n📸 [ScreenshotAPI] 截图: ${tradingViewUrl}`);
  
  try {
    const token = process.env.SCREENSHOT_API_KEY || 'HHBYB5H-4CT4970-MVZEKM2-EMEWEXX';
    
    const params = new URLSearchParams({
      token: token,
      url: tradingViewUrl,
      fresh: 'true',
      output: 'json',
      width: '1920',
      height: '1080',
      delay: '5000'
    });
    
    const apiUrl = `https://shot.screenshotapi.net/screenshot?${params.toString()}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.screenshot) {
      throw new Error('无截图URL');
    }
    
    console.log(`📥 下载: ${result.screenshot}`);
    
    const imgController = new AbortController();
    const imgTimeoutId = setTimeout(() => imgController.abort(), 15000);
    
    const imageResponse = await fetch(result.screenshot, {
      signal: imgController.signal
    });
    
    clearTimeout(imgTimeoutId);
    
    if (!imageResponse.ok) {
      throw new Error(`下载失败: ${imageResponse.status}`);
    }
    
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    
    const elapsed = Date.now() - start;
    console.log(`✅ 成功 (${elapsed}ms, ${(buffer.length / 1024).toFixed(2)} KB)`);
    
    return {
      provider: 'screenshotapi',
      validation: 'direct',
      buffer: buffer,
      elapsed_ms: elapsed
    };
    
  } catch (error) {
    console.error(`❌ 错误:`, error.message);
    throw new Error(`截图失败: ${error.message}`);
  }
}

module.exports = {
  captureHeatmapSmart
};
