// 🎯 Screenshot Provider System - v4.3
// 可插拔的截图服务架构：Browserless（脚本自动化） → ScreenshotAPI → QuickChart

const fetch = require('node-fetch');

// ========================================
// 指数标签映射（用于Browserless脚本自动选择）
// ========================================
const INDEX_LABELS = {
  'SPX500': 'S&P 500',
  'NASDAQ100': 'Nasdaq 100',
  'DJI': 'Dow Jones Industrial Average',
  'RUSSELL2000': 'Russell 2000',
  'NIKKEI225': 'Nikkei 225',
  'TOPIX': 'TOPIX',
  'FTSE': 'FTSE 100',
  'DAX': 'DAX',
  'CAC40': 'CAC 40',
  'IBEX35': 'IBEX 35',
  'EUROSTOXX50': 'EURO STOXX 50',
  'SSEC': 'Shanghai Composite',
  'CSI300': 'CSI 300',
  'HSI': 'Hang Seng',
  'ASX200': 'S&P/ASX 200',
  'TSX': 'S&P/TSX Composite',
  'KOSPI': 'KOSPI Composite',
  'SENSEX': 'S&P BSE SENSEX',
  'NIFTY50': 'Nifty 50',
  'BOVESPA': 'IBOVESPA',
  'MERVAL': 'S&P MERVAL'
};

// 语言映射
const LOCALE_MAP = {
  'US': 'en-US',
  'JP': 'ja-JP',
  'ES': 'es-ES',
  'FR': 'fr-FR',
  'DE': 'de-DE',
  'CN': 'zh-CN',
  'HK': 'zh-HK',
  'GB': 'en-GB',
  'AU': 'en-AU',
  'CA': 'en-CA',
  'KR': 'ko-KR',
  'IN': 'en-IN',
  'BR': 'pt-BR',
  'AR': 'es-AR'
};

// ========================================
// Provider 1: Browserless (脚本自动化)
// ========================================
async function captureBrowserless({ tradingViewUrl, dataset, region, sector, apiKey }) {
  const startTime = Date.now();
  console.log(`\n📸 [Browserless] 启动脚本截图: dataset=${dataset}, region=${region}`);
  
  if (!apiKey) {
    throw new Error('BROWSERLESS_API_KEY未配置');
  }
  
  const label = INDEX_LABELS[dataset];
  if (!label) {
    throw new Error(`未找到指数标签: ${dataset}`);
  }
  
  const locale = LOCALE_MAP[region] || 'en-US';
  
  // 生成Puppeteer脚本（点击选择器→搜索→选择指数）
  const script = `
export default async function ({ page, context }) {
  await page.setExtraHTTPHeaders({
    'Accept-Language': '${locale},${locale.split('-')[0]};q=0.9'
  });
  
  await page.goto('${tradingViewUrl}', { 
    waitUntil: 'networkidle2',
    timeout: 20000 
  });
  
  // 等待页面加载
  await page.waitForTimeout(2000);
  
  // 尝试查找并点击指数选择按钮（使用textContent匹配）
  const targetTexts = ['Index', 'Índice', '指数', 'インデックス', 'Indice'];
  
  let clicked = false;
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent || '', btn);
    if (targetTexts.some(t => text.includes(t))) {
      await btn.click();
      console.log('[Browserless] 点击了指数选择器，文本:', text);
      clicked = true;
      break;
    }
  }
  
  if (clicked) {
    await page.waitForTimeout(500);
    
    // 查找搜索框（Puppeteer兼容）
    const searchBox = await page.$('input[type="search"]');
    if (searchBox) {
      await page.type('input[type="search"]', '${label}');
      console.log('[Browserless] 输入搜索词:', '${label}');
      await page.waitForTimeout(300);
      
      // 点击第一个搜索结果
      const results = await page.$$('ul li, [role="listbox"] [role="option"]');
      if (results.length > 0) {
        await results[0].click();
        console.log('[Browserless] 选择了第一个结果');
      }
    }
    
    // 等待内容加载
    await page.waitForTimeout(1500);
  }
  
  // 验证：检查页面中是否包含目标指数名称
  const pageText = await page.evaluate(() => document.body.textContent || '');
  const foundLabel = pageText.includes('${label}');
  console.log('[Browserless] 验证指数名称:', foundLabel ? '通过' : '失败');
  
  if (!foundLabel) {
    throw new Error('截图验证失败：页面未包含目标指数 ${label}');
  }
  
  // 截图
  const screenshot = await page.screenshot({
    type: 'jpeg',
    quality: 85,
    fullPage: false
  });
  
  return {
    data: screenshot,
    type: 'image/jpeg'
  };
}`;

  const endpoint = `https://production-sfo.browserless.io/function?token=${apiKey}`;
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'no-cache'
      },
      body: script
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Browserless失败 (${response.status}): ${errorText.substring(0, 200)}`);
    }
    
    const imageBuffer = await response.buffer();
    const elapsed = Date.now() - startTime;
    
    console.log(`✅ [Browserless] 成功 (${elapsed}ms, ${imageBuffer.length} bytes)`);
    
    return {
      success: true,
      buffer: imageBuffer,
      provider: 'browserless',
      elapsed_ms: elapsed,
      meta: {
        dataset,
        region,
        sector,
        locale,
        expected_label: label
      }
    };
  } catch (error) {
    console.error(`❌ [Browserless] 失败:`, error.message);
    throw error;
  }
}

// ========================================
// Provider 2: ScreenshotAPI (回退方案)
// ========================================
async function captureScreenshotAPI({ tradingViewUrl, dataset, region, sector, apiKey }) {
  const startTime = Date.now();
  console.log(`\n📸 [ScreenshotAPI] 截图: ${tradingViewUrl}`);
  
  if (!apiKey) {
    throw new Error('SCREENSHOT_API_KEY未配置');
  }
  
  const params = new URLSearchParams({
    url: tradingViewUrl,
    token: apiKey,
    output: 'image',
    file_type: 'png',
    wait_for_event: 'load',
    delay: 5000,
    full_page: 'false',
    width: 1200,
    height: 800,
    device_scale_factor: 2
  });
  
  const apiUrl = `https://shot.screenshotapi.net/screenshot?${params.toString()}`;
  
  try {
    const response = await fetch(apiUrl, { method: 'GET' });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ScreenshotAPI失败 (${response.status}): ${errorText.substring(0, 200)}`);
    }
    
    const imageBuffer = await response.buffer();
    const elapsed = Date.now() - startTime;
    
    console.log(`✅ [ScreenshotAPI] 成功 (${elapsed}ms, ${imageBuffer.length} bytes)`);
    
    return {
      success: true,
      buffer: imageBuffer,
      provider: 'screenshot_api',
      elapsed_ms: elapsed,
      meta: {
        dataset,
        region,
        sector,
        note: 'Browserless不可用，已降级到ScreenshotAPI'
      }
    };
  } catch (error) {
    console.error(`❌ [ScreenshotAPI] 失败:`, error.message);
    throw error;
  }
}

// ========================================
// Provider 3: QuickChart (最终回退)
// ========================================
async function captureQuickChart({ dataset, region }) {
  const startTime = Date.now();
  console.log(`\n📸 [QuickChart] 生成简化热力图`);
  
  const QuickChart = require('quickchart-js');
  const chart = new QuickChart();
  
  chart.setConfig({
    type: 'treemap',
    data: {
      datasets: [{
        label: `${dataset} 市场热力图（简化版）`,
        tree: [
          { symbol: 'AAPL', value: 2800000, change: 1.5 },
          { symbol: 'MSFT', value: 2600000, change: 0.8 },
          { symbol: 'GOOGL', value: 1800000, change: -0.3 },
          { symbol: 'AMZN', value: 1500000, change: 2.1 }
        ],
        key: 'value',
        groups: ['symbol'],
        backgroundColor: (ctx) => {
          const change = ctx.raw._data.change;
          if (change > 1) return 'rgba(34, 197, 94, 0.8)';
          if (change > 0) return 'rgba(74, 222, 128, 0.6)';
          if (change > -1) return 'rgba(248, 113, 113, 0.6)';
          return 'rgba(239, 68, 68, 0.8)';
        },
        labels: {
          display: true,
          formatter: (ctx) => {
            return `${ctx.raw._data.symbol}\n${ctx.raw._data.change > 0 ? '+' : ''}${ctx.raw._data.change}%`;
          }
        }
      }]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: `${dataset} 热力图（降级模式）`,
          font: { size: 18 }
        },
        legend: { display: false }
      }
    }
  });
  
  chart.setWidth(1200);
  chart.setHeight(800);
  chart.setBackgroundColor('#ffffff');
  
  const chartUrl = chart.getUrl();
  
  try {
    const response = await fetch(chartUrl);
    if (!response.ok) {
      throw new Error(`QuickChart失败: ${response.status}`);
    }
    
    const imageBuffer = await response.buffer();
    const elapsed = Date.now() - startTime;
    
    console.log(`✅ [QuickChart] 成功 (${elapsed}ms, ${imageBuffer.length} bytes)`);
    
    return {
      success: true,
      buffer: imageBuffer,
      provider: 'quickchart',
      elapsed_ms: elapsed,
      meta: {
        dataset,
        region,
        note: '所有外部服务失败，使用QuickChart生成简化热力图'
      }
    };
  } catch (error) {
    console.error(`❌ [QuickChart] 失败:`, error.message);
    throw error;
  }
}

// ========================================
// 主入口：智能路由（自动回退）
// ========================================
async function captureHeatmapSmart({ tradingViewUrl, dataset, region, sector }) {
  const browserlessKey = process.env.BROWSERLESS_API_KEY;
  const screenshotApiKey = process.env.SCREENSHOT_API_KEY;
  
  console.log(`\n🚀 [Smart Router] 开始智能截图流程`);
  console.log(`   - Browserless可用: ${!!browserlessKey}`);
  console.log(`   - ScreenshotAPI可用: ${!!screenshotApiKey}`);
  
  const errors = [];
  
  // 1️⃣ 优先尝试Browserless（脚本自动化）
  if (browserlessKey) {
    try {
      const result = await captureBrowserless({
        tradingViewUrl,
        dataset,
        region,
        sector,
        apiKey: browserlessKey
      });
      return result;
    } catch (error) {
      console.warn(`⚠️  [Smart Router] Browserless失败，尝试回退...`);
      errors.push({ provider: 'browserless', error: error.message });
    }
  }
  
  // 2️⃣ 回退到ScreenshotAPI
  if (screenshotApiKey) {
    try {
      const result = await captureScreenshotAPI({
        tradingViewUrl,
        dataset,
        region,
        sector,
        apiKey: screenshotApiKey
      });
      return result;
    } catch (error) {
      console.warn(`⚠️  [Smart Router] ScreenshotAPI失败，尝试最终回退...`);
      errors.push({ provider: 'screenshot_api', error: error.message });
    }
  }
  
  // 3️⃣ 最终回退到QuickChart
  try {
    const result = await captureQuickChart({ dataset, region });
    return result;
  } catch (error) {
    errors.push({ provider: 'quickchart', error: error.message });
    throw new Error(`所有截图服务失败: ${JSON.stringify(errors)}`);
  }
}

module.exports = {
  captureBrowserless,
  captureScreenshotAPI,
  captureQuickChart,
  captureHeatmapSmart,
  INDEX_LABELS,
  LOCALE_MAP
};
