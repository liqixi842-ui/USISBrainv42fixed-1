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
  
  // 🔥 生成强化Puppeteer脚本（Incognito + DOM级验证 + 强制切换）
  const script = `
export default async function ({ page, context }) {
  const delay = (ms) => new Promise(r => setTimeout(r, ms));
  
  // 🔧 清除缓存和本地存储（避免TradingView使用lastDataset覆盖URL参数）
  try {
    await page._client().send('Network.clearBrowserCache');
    await page._client().send('Network.clearBrowserCookies');
  } catch (e) {
    console.warn('[Browserless] 清除缓存失败（可能权限限制）:', e.message);
  }
  
  // 先访问空白页清理localStorage/sessionStorage
  await page.goto('about:blank', { timeout: 5000 });
  await page.evaluate(() => {
    try { localStorage.clear(); sessionStorage.clear(); } catch(_) {}
  });
  console.log('[Browserless] ✅ 已清理缓存和存储');
  
  // 🔧 关键修复：始终使用英文界面进行自动化（避免多语言选择器问题）
  // 截图后的最终图片仍然会显示本地化内容（数据由dataset参数控制）
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9'
  });
  console.log('[Browserless] 使用英文界面进行自动化（简化选择器逻辑）');
  
  // 🌐 访问TradingView热力图
  await page.goto('${tradingViewUrl}', { 
    waitUntil: 'networkidle0',
    timeout: 20000 
  });
  console.log('[Browserless] 页面已加载');
  
  // 等待热力图区域出现
  await Promise.any([
    page.waitForSelector('[aria-label*="heatmap"]', { timeout: 8000 }),
    page.waitForSelector('[class*="heatmap"], [class*="treemap"]', { timeout: 8000 }),
    page.waitForSelector('canvas', { timeout: 8000 }),
    page.waitForSelector('svg', { timeout: 8000 }),
  ]).catch(() => { 
    console.warn('[Browserless] 未找到热力图容器（继续）');
  });
  
  // 🎯 强化版强制选择数据集函数（多策略）
  async function forceSelectDataset(expectedLabel) {
    console.log('[Browserless] 开始强制切换到:', expectedLabel);
    
    // 策略1: 找到并点击当前显示的数据集按钮（通常在左上角）
    const openOk = await page.evaluate(() => {
      // 尝试多种选择器
      const selectors = [
        'button[aria-label*="Index"]',
        'button[aria-label*="Dataset"]',
        '[data-name*="dataset"]',
        '[class*="dataset"]',
        'button',
        '[role="button"]'
      ];
      
      let clicked = false;
      for (const selector of selectors) {
        const btns = Array.from(document.querySelectorAll(selector));
        const target = btns.find(b => {
          const t = (b.innerText || b.getAttribute('aria-label') || '').toLowerCase();
          return /s&p|nikkei|ibex|nasdaq|dax|ftse|cac|dow|russell|index|dataset/.test(t);
        });
        
        if (target && !clicked) {
          target.click();
          console.log('[DOM] 点击数据集按钮（选择器:', selector, '文本:', target.innerText || target.getAttribute('aria-label'), ')');
          clicked = true;
          break;
        }
      }
      return clicked;
    });
    
    if (!openOk) {
      console.warn('[Browserless] ⚠️  策略1失败：未找到数据集按钮');
    } else {
      await delay(800);
    }
    
    // 策略2: 在页面中搜索并点击目标文本（更宽泛的搜索）
    const clicked = await page.evaluate((expected) => {
      const tExpected = expected.toLowerCase().trim();
      
      // 扩大搜索范围
      const items = Array.from(document.querySelectorAll('*'));
      
      for (const node of items) {
        const text = (node.innerText || node.textContent || '').toLowerCase().trim();
        // 精确匹配或包含匹配
        if (text === tExpected || text.includes(tExpected)) {
          // 尝试多种点击方式
          try {
            node.click();
            console.log('[DOM] ✅ 点击目标（文本:', node.innerText || node.textContent, ')');
            return true;
          } catch (e1) {
            try {
              node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
              console.log('[DOM] ✅ 通过事件点击目标');
              return true;
            } catch (e2) {
              // 继续尝试下一个
            }
          }
        }
      }
      
      console.warn('[DOM] ⚠️  未找到包含文本的节点:', tExpected);
      return false;
    }, expectedLabel);
    
    if (!clicked) {
      console.warn('[Browserless] ⚠️  策略2失败：未找到目标选项', expectedLabel);
      return false;
    }
    
    // 等待热力图重绘
    console.log('[Browserless] 等待热力图重绘...');
    await delay(2000);
    return true;
  }
  
  // 🔍 验证当前数据集函数（文本 + 块数双重检查）
  async function assertDataset(expectedLabel, minBlocks = 12) {
    const { label, blocks } = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button,[role="button"],[class*="button"]'));
      const labelNode = btns.find(b => {
        const t = (b.innerText || '').toLowerCase();
        return /s&p|nikkei|ibex|nasdaq|dax|ftse|cac|dow|russell/.test(t);
      });
      const label = labelNode ? (labelNode.innerText || '').trim() : '';
      
      const blockCount = document.querySelectorAll('[data-symbol],[data-ticker]').length
        || document.querySelectorAll('canvas,svg').length;
      
      return { label, blocks: blockCount };
    });
    
    const okLabel = (label || '').toLowerCase().includes(expectedLabel.toLowerCase());
    const okBlocks = blocks >= minBlocks;
    
    console.log(\`[Browserless] 验证结果: label="\${label}" (期望"\${expectedLabel}"), blocks=\${blocks} (最小\${minBlocks})\`);
    
    return { ok: okLabel && okBlocks, label, blocks };
  }
  
  // 🔒 执行验证和强制切换逻辑
  const expectedLabel = '${label}';
  
  // 第一次验证
  let v1 = await assertDataset(expectedLabel, 12);
  console.log('[Browserless] 第一次验证:', v1.ok ? '✅ 通过' : '❌ 失败');
  
  if (!v1.ok) {
    // 强制切换
    console.log('[Browserless] 尝试强制切换到:', expectedLabel);
    await forceSelectDataset(expectedLabel);
    await delay(800);
    
    // 第二次验证
    let v2 = await assertDataset(expectedLabel, 12);
    console.log('[Browserless] 第二次验证:', v2.ok ? '✅ 通过' : '❌ 失败');
    
    if (!v2.ok) {
      throw new Error(\`数据集验证失败: got "\${v2.label}", blocks=\${v2.blocks}, expected "\${expectedLabel}"\`);
    }
  }
  
  console.log('[Browserless] ✅ 数据集验证通过，开始截图');
  
  // 截图
  const screenshot = await page.screenshot({
    type: 'jpeg',
    quality: 90,
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
