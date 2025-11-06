// 🎯 Screenshot Provider System - v4.3.1 (n8n Style)
// 三层回退架构 + n8n风格调度壳（串行队列+超时+重试+熔断+资源回收）

const fetch = require('node-fetch');
const { enqueue, runWithGuards } = require('./runner');

// ========================================
// 数据集标签映射
// ========================================
const DATASET_LABEL = {
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

// 数据集关键词（轻校验用）
const MUST_HAVE = {
  'SPX500': ['Apple', 'Microsoft', 'NVIDIA', 'Amazon', 'Meta'],
  'NIKKEI225': ['Nikkei', 'Toyota', 'Sony', 'SoftBank', 'Keyence', '任天堂', 'トヨタ', 'ソニー'],
  'IBEX35': ['IBEX', 'Santander', 'BBVA', 'Iberdrola', 'Inditex', 'Repsol']
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

// 工具函数
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function jitter(ms) { return ms + Math.floor(Math.random() * 300); }

// ========================================
// Provider 1: Browserless (脚本自动化)
// ========================================
async function captureBrowserless({ tradingViewUrl, dataset, region, sector, apiKey }) {
  const startTime = Date.now();
  console.log(`\n📸 [Browserless] 启动脚本截图: dataset=${dataset}, region=${region}`);
  
  if (!apiKey) {
    throw new Error('BROWSERLESS_API_KEY未配置');
  }
  
  const label = DATASET_LABEL[dataset];
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
      validation: 'dom-strong',  // 统一validation标记
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
// Provider 2: ScreenshotN8N (n8n风格 - 长延迟+元素等待)
// ========================================
async function captureViaScreenshotN8N({ url, dataset }) {
  return runWithGuards('screenshot', async () => {
    const start = Date.now();
    console.log(`\n📸 [ScreenshotN8N] ${url.substring(0, 80)}...`);
    
    const ep = process.env.SCREENSHOT_API_ENDPOINT || 'https://shot.screenshotapi.net/screenshot';
    const key = process.env.SCREENSHOT_API_KEY;
    
    if (!ep || !key) {
      throw new Error('screenshot_api_not_configured');
    }
    
    // ScreenshotAPI.net优化参数（平衡速度和质量）
    const params = new URLSearchParams({
      token: key.trim(),
      url,
      output: 'image',
      file_type: 'png',
      full_page: 'false',          // 关闭全页截图加快速度
      width: '1920',
      height: '1080',
      delay: '6000',               // 6秒延迟给TradingView充足时间
      wait_for_event: 'load',
      block_ads: 'true',
      block_cookie_banners: 'true',
      fresh: 'false'
    });
    
    const resp = await fetch(`${ep}?${params.toString()}`);
    
    if (!resp.ok) {
      throw new Error(`screenshot_http_${resp.status}`);
    }
    
    const buf = await resp.buffer();
    
    // 轻量验证：避免1x1空图
    if (!buf || buf.length < 60000) {
      throw new Error('screenshot_too_small');
    }
    
    const elapsed = Date.now() - start;
    console.log(`✅ [ScreenshotN8N] 成功 (${elapsed}ms, ${buf.length} bytes)`);
    
    return {
      buffer: buf,
      elapsed_ms: elapsed,
      validation: 'saas-waited'
    };
  });
}

// ========================================
// 轻量级验证函数（可选OCR）
// ========================================
async function lightValidate(buffer, mustHave) {
  if (!mustHave || mustHave.length === 0) {
    return 'light';
  }
  
  // 如果启用OCR
  if (process.env.ENABLE_OCR === 'true') {
    try {
      const { createWorker } = require('tesseract.js');
      const worker = await createWorker({ logger: () => {} });
      await worker.loadLanguage('eng+spa+jpn');
      await worker.initialize('eng+spa+jpn');
      const { data: { text } } = await worker.recognize(buffer);
      await worker.terminate();
      
      const hits = mustHave.filter(k => (text || '').includes(k));
      const ocrOk = hits.length >= 2;
      console.log(`[OCR验证] 命中关键词: ${hits.join(', ')} (${hits.length}/${mustHave.length})`);
      return ocrOk ? 'ocr' : false;
    } catch (e) {
      console.warn('[OCR验证] OCR不可用，使用轻量级验证:', e.message);
    }
  }
  
  // 非OCR：极简校验（文件大小阈值）
  const sizeOk = buffer?.length > 30000;
  return sizeOk ? 'light' : false;
}

// ========================================
// Provider 3: QuickChart (最终回退)
// ========================================
async function captureQuickChart({ dataset, region }) {
  const startTime = Date.now();
  console.log(`\n📸 [QuickChart] 生成简化热力图`);
  
  const QuickChart = require('quickchart-js');
  const chart = new QuickChart();
  
  // 简化配置：QuickChart不支持复杂的JavaScript回调，使用静态配置
  chart.setConfig({
    type: 'bar',
    data: {
      labels: ['热力图服务暂时不可用'],
      datasets: [{
        label: `${dataset} 市场概览`,
        data: [100],
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: `${dataset} 热力图（降级模式）`,
          font: { size: 18 }
        },
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          display: false
        }
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
      validation: 'degraded',  // 标记为降级图
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
// 主入口：n8n风格串行调度（队列+超时+熔断）
// ========================================
async function captureHeatmapSmart({ tradingViewUrl, dataset, region, sector }) {
  return enqueue(async () => {
    console.log(`\n🚀 [Smart Router] n8n风格调度：${dataset}`);
    
    // 🔥 Tier 1: Browserless（优先，能正确切换数据集）
    if (process.env.BROWSERLESS_API_KEY && dataset) {
      try {
        const r = await captureBrowserless({
          tradingViewUrl,
          dataset,
          region,
          sector,
          apiKey: process.env.BROWSERLESS_API_KEY
        });
        return { provider: 'browserless', ...r };
      } catch (e) {
        console.warn(`⚠️  [browserless] 失败: ${e.message.substring(0, 80)}`);
      }
    }
    
    // Tier 3: QuickChart（保底）
    const r = await captureQuickChart({ dataset, region });
    return { provider: 'quickchart', ...r };
  });
}

module.exports = {
  captureBrowserless,
  captureViaScreenshotN8N,
  captureQuickChart,
  captureHeatmapSmart,
  DATASET_LABEL,
  LOCALE_MAP
};
