/**
 * Screenshot Provider System - v4.5 (Pure SaaS Only)
 * 单一路径：Screenshot SaaS
 * 
 * 无 Browserless、无 QuickChart、无任何回退
 * 旧版多层回退已移至 legacy/screenshotProviders.legacy.js
 */

const fetch = require('node-fetch');
const { runWithGuards } = require('./runner');

const ENABLE_SAAS = process.env.HEATMAP_ENABLE_SCREENSHOT_SAAS !== 'false';

function qs(obj) {
  return new URLSearchParams(obj).toString();
}

/**
 * Screenshot SaaS Provider (ScreenshotOne/ScreenshotAPI)
 * 纯云端截图，无本地依赖
 */
async function captureViaScreenshotSaaS({ url }) {
  return runWithGuards('screenshot', async () => {
    const start = Date.now();
    console.log(`\n📸 [Screenshot SaaS] ${url.substring(0, 80)}...`);
    
    const endpoint = process.env.SCREENSHOT_API_ENDPOINT || 'https://shot.screenshotapi.net/screenshot';
    const key = process.env.SCREENSHOT_API_KEY;
    
    if (!key) {
      throw new Error('screenshot_api_not_configured');
    }
    
    // 根据服务商选择参数格式
    const isScreenshotAPI = endpoint.includes('screenshotapi.net');
  
  const params = isScreenshotAPI ? {
    // ScreenshotAPI.net 参数格式
    token: key.trim(),
    url,
    output: 'image',
    file_type: 'png',
    full_page: 'true',
    width: '1920',
    height: '1080',
    delay: '3000',                // 3秒延迟（最小有效延迟）
    wait_for_event: 'load',
    block_ads: 'true',
    block_cookie_banners: 'true',
    fresh: 'true'                 // 强制刷新确保最新数据
  } : {
    // ScreenshotOne 参数格式
    access_key: key,
    url,
    full_page: 'true',
    viewport_width: '1920',
    viewport_height: '1080',
    device_scale_factor: '2',
    block_ads: 'true',
    block_cookie_banners: 'true',
    delay: '3000',
    ttl: '600'
  };
  
    const res = await fetch(`${endpoint}?${qs(params)}`, { timeout: 50000 });  // 50秒超时（留10秒给runWithGuards）
    
    if (!res.ok) {
      throw new Error(`screenshot_http_${res.status}`);
    }
    
    const buffer = await res.buffer();
    
    // 轻量验证：避免空图
    if (!buffer || buffer.length < 20000) {
      throw new Error('screenshot_too_small');
    }
    
    const elapsed = Date.now() - start;
    console.log(`✅ [Screenshot SaaS] 成功 (${elapsed}ms, ${buffer.length} bytes)`);
    
    return {
      provider: 'screenshot',
      validation: 'saas',
      elapsed_ms: elapsed,
      buffer
    };
  });
}

/**
 * 主入口：纯 SaaS，无回退
 */
async function captureHeatmapSmart({ tradingViewUrl }) {
  if (!ENABLE_SAAS) {
    throw new Error('screenshot_saas_disabled');
  }
  
  console.log(`\n🚀 [Smart Router] 纯 SaaS 模式（无回退）`);
  return captureViaScreenshotSaaS({ url: tradingViewUrl });
}

module.exports = {
  captureHeatmapSmart
};
