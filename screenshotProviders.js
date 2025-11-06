/**
 * Screenshot Provider System - v5.0 n8n Webhook
 * 
 * 使用 n8n workflow 调用 Browserless API
 * n8n 处理截图逻辑，Replit 专注于 Bot 接口和自然语言解析
 */

const fetch = require('node-fetch');

/**
 * 通过 n8n webhook 调用 Browserless 截图
 * @param {string} url - TradingView URL
 * @returns {Promise<{provider: string, validation: string, elapsed_ms: number, buffer: Buffer}>}
 */
async function captureViaN8N(url, webhookUrl) {
  if (!webhookUrl) {
    throw new Error('n8n_webhook_url_missing');
  }

  const start = Date.now();
  console.log(`\n📸 [n8n Webhook] 调用截图服务...`);
  console.log(`   URL: ${url}`);
  
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
    timeout: 40000
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`❌ [n8n] HTTP ${res.status}: ${errorText.substring(0, 200)}`);
    throw new Error(`n8n_http_${res.status}`);
  }

  const contentType = res.headers.get('content-type');
  if (!contentType || !contentType.includes('image/png')) {
    console.error(`❌ [n8n] 错误的Content-Type: ${contentType}`);
    throw new Error('n8n_invalid_content_type');
  }

  const buf = Buffer.from(await res.arrayBuffer());
  
  if (!buf || buf.length < 20000) {
    throw new Error('n8n_small_image');
  }

  const elapsed = Date.now() - start;
  console.log(`✅ [n8n Webhook] 成功 (${elapsed}ms, ${(buf.length / 1024).toFixed(2)} KB)`);

  return {
    provider: 'n8n-browserless',
    validation: 'saas-waited',
    elapsed_ms: elapsed,
    buffer: buf
  };
}

/**
 * 使用 Browserless Function API + Puppeteer 脚本切换数据集并截图
 * @param {string} url - TradingView URL
 * @param {string} dataset - 数据集 (例如: NIKKEI225, SPX500, IBEX35)
 * @returns {Promise<{provider: string, validation: string, elapsed_ms: number, buffer: Buffer}>}
 */
async function captureViaBrowserlessPuppeteer(url, dataset) {
  const apiKey = process.env.BROWSERLESS_API_KEY;
  if (!apiKey) {
    throw new Error('browserless_api_key_missing');
  }

  const start = Date.now();
  console.log(`\n📸 [Browserless/Puppeteer] 切换到 ${dataset} 并截图...`);
  
  const endpoint = `https://production-sfo.browserless.io/function?token=${apiKey}`;
  
  // Puppeteer 脚本：点击切换数据集
  const puppeteerCode = `
    module.exports = async ({ page }) => {
      const targetDataset = '${dataset}';
      
      // 1. 访问页面
      await page.goto('${url}', { waitUntil: 'networkidle0' });
      
      // 2. 等待热力图加载
      await page.waitForSelector('[data-name="legend-sources-item"]', { timeout: 10000 });
      
      // 3. 点击数据集下拉菜单
      const datasetButton = await page.$('[data-name="legend-sources-item"]');
      if (datasetButton) {
        await datasetButton.click();
        await page.waitForTimeout(1000);
        
        // 4. 查找并点击目标数据集
        const options = await page.$$('[data-name="legend-source-item"]');
        for (const option of options) {
          const text = await option.evaluate(el => el.textContent);
          if (text && text.includes(targetDataset)) {
            await option.click();
            await page.waitForTimeout(3000);
            break;
          }
        }
      }
      
      // 5. 截图
      const screenshot = await page.screenshot({
        fullPage: true,
        type: 'png'
      });
      
      return screenshot.toString('base64');
    };
  `;
  
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: puppeteerCode
    }),
    timeout: 60000
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`❌ [Browserless/Puppeteer] HTTP ${res.status}: ${errorText.substring(0, 200)}`);
    throw new Error(`browserless_puppeteer_http_${res.status}`);
  }

  const base64Data = await res.text();
  const buf = Buffer.from(base64Data, 'base64');
  
  if (!buf || buf.length < 20000) {
    throw new Error('browserless_small_image');
  }

  const elapsed = Date.now() - start;
  console.log(`✅ [Browserless/Puppeteer] 成功 (${elapsed}ms, ${(buf.length / 1024).toFixed(2)} KB)`);

  return {
    provider: 'browserless-puppeteer',
    validation: 'dom-interaction',
    elapsed_ms: elapsed,
    buffer: buf
  };
}

/**
 * 从 URL 中提取 dataset 参数
 */
function extractDataset(url) {
  const match = url.match(/dataset=([^&]+)/);
  return match ? match[1] : 'SPX500';
}

/**
 * 主入口：智能热力图截图
 * v5.0: 优先使用 n8n webhook，回退到 Browserless Puppeteer
 * @param {Object} params
 * @param {string} params.tradingViewUrl - TradingView 热力图 URL
 * @returns {Promise<{provider: string, validation: string, elapsed_ms: number, buffer: Buffer}>}
 */
async function captureHeatmapSmart({ tradingViewUrl }) {
  // Tier 1: n8n webhook (推荐) - 默认使用 n8n
  const n8nWebhook = process.env.N8N_HEATMAP_WEBHOOK || 'https://qian.app.n8n.cloud/webhook/capture_heatmap';
  
  try {
    return await captureViaN8N(tradingViewUrl, n8nWebhook);
  } catch (error) {
    console.error(`⚠️ [n8n] 失败，回退到 Browserless Puppeteer: ${error.message}`);
  }
  
  // Tier 2: Browserless Puppeteer (备用)
  const dataset = extractDataset(tradingViewUrl);
  return captureViaBrowserlessPuppeteer(tradingViewUrl, dataset);
}

module.exports = {
  captureHeatmapSmart
};
