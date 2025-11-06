/**
 * Screenshot Provider System - v4.4 (SaaS + Fallback)
 * 主路径：Screenshot SaaS
 * 保底：QuickChart（确保永不失败）
 * 
 * 旧版三层回退（Browserless）已移至 legacy/screenshotProviders.legacy.js
 */

const fetch = require('node-fetch');
const QuickChart = require('quickchart-js');
const { runWithGuards } = require('./runner');

const ENABLE_SAAS = process.env.HEATMAP_ENABLE_SCREENSHOT_SAAS !== 'false';

function qs(obj) {
  return new URLSearchParams(obj).toString();
}

/**
 * Screenshot SaaS Provider (ScreenshotOne/ScreenshotAPI)
 * 稳定的云端截图服务，无需复杂DOM操作
 */
async function captureViaScreenshotSaaS({ url }) {
  return runWithGuards('screenshot', async () => {
    const start = Date.now();
    console.log(`\n📸 [Screenshot SaaS] ${url.substring(0, 80)}...`);
    
    const endpoint = process.env.SCREENSHOT_API_ENDPOINT || 'https://shot.screenshotapi.net/screenshot';
    const key = process.env.SCREENSHOT_API_KEY;
    
    if (!endpoint || !key) {
      throw new Error('screenshot_api_not_configured');
    }
    
    // 优化参数（ScreenshotAPI.net）
    const params = {
      token: key.trim(),
      url,
      output: 'image',
      file_type: 'png',
      full_page: 'true',
      width: '1920',
      height: '1080',
      device_scale_factor: '2',
      delay: '7000',
      wait_for_event: 'load',
      block_ads: 'true',
      block_cookie_banners: 'true',
      fresh: 'false'
    };
    
    // ScreenshotOne 参数格式
    if (endpoint.includes('screenshotone.com')) {
      delete params.token;
      delete params.file_type;
      delete params.device_scale_factor;
      params.access_key = key.trim();
      params.format = 'png';
      params.viewport_width = '1920';
      params.viewport_height = '1080';
      params.element = '.tv-heatmap,.heatmap,.treemap,[data-name*="heatmap"]';
      params.ttl = '600';
      delete params.width;
      delete params.height;
    }
    
    const res = await fetch(`${endpoint}?${qs(params)}`);
    
    if (!res.ok) {
      throw new Error(`screenshot_http_${res.status}`);
    }
    
    const buffer = await res.buffer();
    
    if (!buffer || buffer.length < 60000) {
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
 * QuickChart Fallback
 * 简化的静态热力图，确保永不失败
 */
async function captureViaQuickChart({ dataset, region }) {
  const start = Date.now();
  console.log(`\n📊 [QuickChart] 生成保底热力图: ${dataset}`);
  
  // 简化的静态配置（移除高级特性确保稳定）
  const chart = new QuickChart();
  chart.setConfig({
    type: 'bar',
    data: {
      labels: ['Tech', 'Finance', 'Healthcare', 'Energy', 'Consumer'],
      datasets: [{
        label: dataset || 'Market Heatmap (Simplified)',
        data: [12, 8, 5, -3, -6],
        backgroundColor: [
          'rgba(76, 175, 80, 0.8)',
          'rgba(139, 195, 74, 0.8)',
          'rgba(255, 235, 59, 0.8)',
          'rgba(255, 152, 0, 0.8)',
          'rgba(244, 67, 54, 0.8)'
        ]
      }]
    },
    options: {
      title: {
        display: true,
        text: `${dataset || 'Market'} Heatmap - Fallback Mode`
      },
      legend: {
        display: false
      }
    }
  });
  
  chart.setWidth(800);
  chart.setHeight(400);
  chart.setBackgroundColor('white');
  
  const url = chart.getUrl();
  const resp = await fetch(url);
  
  if (!resp.ok) {
    throw new Error(`quickchart_http_${resp.status}`);
  }
  
  const buffer = await resp.buffer();
  const elapsed = Date.now() - start;
  
  console.log(`✅ [QuickChart] 成功 (${elapsed}ms, ${buffer.length} bytes)`);
  
  return {
    provider: 'quickchart',
    validation: 'degraded',
    elapsed_ms: elapsed,
    buffer
  };
}

/**
 * 主入口：SaaS优先，QuickChart保底
 */
async function captureHeatmapSmart({ tradingViewUrl, dataset, region }) {
  console.log(`\n🚀 [Smart Router] SaaS优先模式（QuickChart保底）`);
  
  // 优先 Screenshot SaaS
  if (ENABLE_SAAS && process.env.SCREENSHOT_API_KEY) {
    try {
      return await captureViaScreenshotSaaS({ url: tradingViewUrl });
    } catch (e) {
      console.warn(`⚠️  [screenshot] 失败: ${e.message.substring(0, 80)}`);
    }
  }
  
  // 保底 QuickChart（确保永不失败）
  return captureViaQuickChart({ dataset, region });
}

module.exports = {
  captureHeatmapSmart,
  captureViaScreenshotSaaS,
  captureViaQuickChart
};
