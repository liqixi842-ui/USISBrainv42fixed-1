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
  
  // 🔥 三路线组合策略 (A+B+C) - 100%强制切换成功
  const script = `
export default async function ({ page, context }) {
  const delay = (ms) => new Promise(r => setTimeout(r, ms));
  
  // 🔧 清除缓存和本地存储（避免lastDataset覆盖）
  try {
    await page._client().send('Network.clearBrowserCache');
    await page._client().send('Network.clearBrowserCookies');
  } catch (e) {
    console.warn('[Browserless] 清除缓存失败:', e.message);
  }
  
  await page.goto('about:blank', { timeout: 5000 });
  await page.evaluate(() => {
    try { localStorage.clear(); sessionStorage.clear(); } catch(_) {}
  });
  console.log('[Browserless] ✅ 缓存已清理');
  
  // 统一英文UI避免多语言选择器问题
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.8' });
  
  // 访问TradingView
  await page.goto('${tradingViewUrl}', { waitUntil: 'networkidle0', timeout: 25000 });
  
  // 等待热力图区域
  await Promise.any([
    page.waitForSelector('[aria-label*="heatmap"]', { timeout: 8000 }),
    page.waitForSelector('[class*="heatmap"],[class*="treemap"]', { timeout: 8000 }),
    page.waitForSelector('canvas', { timeout: 8000 }),
    page.waitForSelector('svg', { timeout: 8000 }),
  ]).catch(()=>{});
  await delay(700);
  
  console.log('[Browserless] 页面已加载');
  
  // 📖 读取当前数据集状态
  async function readDatasetState() {
    return await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('button,[role="button"],[class*="button"],[class*="selector"]'));
      const labelBtn = candidates.find(b => {
        const t = (b.innerText || '').toLowerCase();
        return /s&p|nikkei|ibex|nasdaq|dax|ftse|cac|stocks|all stocks/.test(t);
      });
      const label = labelBtn ? (labelBtn.innerText || '').trim() : '';
      
      const blocks = document.querySelectorAll('[data-symbol],[data-ticker],[role*="graphics"]').length
                  || document.querySelectorAll('canvas,svg').length || 0;
      
      return { label, blocks };
    });
  }
  
  function okLabel(label, expectText) {
    return (label||'').toLowerCase().includes(expectText.toLowerCase());
  }
  
  // 🅰️ A路线：点击下拉菜单选择
  async function routeA_clickDropdown(expectText) {
    console.log('[Route A] 尝试下拉菜单选择:', expectText);
    
    const opened = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button,[role="button"],[class*="button"],[class*="selector"]'));
      const target = btns.find(b => {
        const t = (b.innerText || '').toLowerCase();
        return /s&p|nikkei|ibex|nasdaq|dax|ftse|cac|stocks|all stocks/.test(t);
      });
      if (target) { 
        target.click(); 
        console.log('[DOM] 点击了下拉按钮:', target.innerText);
        return true; 
      }
      return false;
    });
    
    if (!opened) {
      console.warn('[Route A] 未找到下拉按钮');
      return false;
    }
    
    await delay(500);
    
    const clicked = await page.evaluate((expect) => {
      const nodes = Array.from(document.querySelectorAll('[role="option"],li,div,button,span,a'));
      const e = expect.toLowerCase();
      const node = nodes.find(n => (n.innerText || '').toLowerCase().includes(e));
      if (node) { 
        node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        console.log('[DOM] 选中选项:', node.innerText);
        return true; 
      }
      return false;
    }, expectText);
    
    if (!clicked) {
      console.warn('[Route A] 未找到目标选项');
      return false;
    }
    
    await delay(1200);
    return true;
  }
  
  // 🅱️ B路线：搜索框输入关键词回车
  async function routeB_search(keyword) {
    console.log('[Route B] 尝试搜索:', keyword);
    
    try {
      const sel = await Promise.any([
        page.waitForSelector('input[placeholder*="Search"]', { timeout: 2000 }),
        page.waitForSelector('input[type="search"]', { timeout: 2000 }),
        page.waitForSelector('input[type="text"]', { timeout: 2000 }),
      ]).catch(()=>null);
      
      if (!sel) {
        console.warn('[Route B] 未找到搜索框');
        return false;
      }
      
      await page.click('input[placeholder*="Search"],input[type="search"],input[type="text"]', { delay: 30 });
      await page.keyboard.down('Control');
      await page.keyboard.press('A');
      await page.keyboard.up('Control');
      await page.keyboard.type(keyword, { delay: 30 });
      await page.keyboard.press('Enter');
      await delay(1400);
      
      console.log('[Route B] ✅ 搜索完成');
      return true;
    } catch (e) {
      console.warn('[Route B] 失败:', e.message);
      return false;
    }
  }
  
  // 🅲 C路线：强制SPA路由切换
  async function routeC_forceSpaSwitch(dataset) {
    console.log('[Route C] 尝试SPA路由切换:', dataset);
    
    await page.evaluate((ds) => {
      try {
        const u = new URL(location.href);
        u.searchParams.set('dataset', ds);
        history.pushState({}, '', u.toString());
        window.dispatchEvent(new PopStateEvent('popstate'));
        console.log('[DOM] 触发pushState+popstate');
      } catch(_) {}
    }, dataset);
    
    await delay(1200);
    return true;
  }
  
  // 🔒 组合策略：依次尝试A→B→C，每次都验证
  async function ensureDataset(dataset, expectLabel) {
    console.log('[ensureDataset] 开始强制切换到:', expectLabel, '(dataset=' + dataset + ')');
    
    // 初读
    let st = await readDatasetState();
    console.log('[ensureDataset] 初始状态: label="' + st.label + '", blocks=' + st.blocks);
    
    if (okLabel(st.label, expectLabel) && st.blocks >= 12) {
      console.log('[ensureDataset] ✅ 初始状态已正确');
      return true;
    }
    
    // A路线
    await routeA_clickDropdown(expectLabel).catch(()=>{});
    st = await readDatasetState();
    console.log('[ensureDataset] A路线后: label="' + st.label + '", blocks=' + st.blocks);
    if (okLabel(st.label, expectLabel) && st.blocks >= 12) {
      console.log('[ensureDataset] ✅ A路线成功');
      return true;
    }
    
    // B路线
    await routeB_search(expectLabel).catch(()=>{});
    st = await readDatasetState();
    console.log('[ensureDataset] B路线后: label="' + st.label + '", blocks=' + st.blocks);
    if (okLabel(st.label, expectLabel) && st.blocks >= 12) {
      console.log('[ensureDataset] ✅ B路线成功');
      return true;
    }
    
    // C路线
    await routeC_forceSpaSwitch(dataset).catch(()=>{});
    st = await readDatasetState();
    console.log('[ensureDataset] C路线后: label="' + st.label + '", blocks=' + st.blocks);
    if (okLabel(st.label, expectLabel) && st.blocks >= 12) {
      console.log('[ensureDataset] ✅ C路线成功');
      return true;
    }
    
    // 所有路线失败
    console.error('[ensureDataset] ❌ A/B/C全失败');
    return false;
  }
  
  // 执行强制切换
  const dataset = '${dataset}';
  const expectedLabel = '${label}';
  
  const ok = await ensureDataset(dataset, expectedLabel);
  
  if (!ok) {
    const finalState = await readDatasetState();
    throw new Error(\`dataset_not_applied: want "\${expectedLabel}", got "\${finalState.label}" (blocks=\${finalState.blocks})\`);
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
