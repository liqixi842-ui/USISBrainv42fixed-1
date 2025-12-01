/**
 * N8n Webhook截图服务
 * n8n → ScreenshotAPI → 返回screenshot URL → Replit下载
 */

const fetch = require('node-fetch');
const axios = require('axios');
const sharp = require('sharp');

async function captureHeatmapSmart({ tradingViewUrl, timeoutMs = 45000, maxRetries = 2 }) {
  const start = Date.now();
  
  // MarketScreener 页面较重，需要更长超时
  if (tradingViewUrl.includes('marketscreener.com')) {
    timeoutMs = Math.max(timeoutMs, 60000);
    console.log(`\n📸 [N8n] 调用截图服务 - MarketScreener (超时: ${timeoutMs}ms, 最大重试: ${maxRetries}次)`);
  } else {
    console.log(`\n📸 [N8n] 调用截图服务 (超时: ${timeoutMs}ms, 最大重试: ${maxRetries}次)`);
  }
  
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 截图尝试 ${attempt}/${maxRetries}`);
      
      const n8nWebhook = process.env.N8N_HEATMAP_WEBHOOK || 'https://qian.app.n8n.cloud/webhook/capture_heatmap';
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      // 构建请求体，添加延迟参数让页面完全加载
      const requestBody = { 
        url: tradingViewUrl,
        delay: tradingViewUrl.includes('marketscreener.com') ? 5000 : 2000,  // MarketScreener需要更长加载时间
        fullPage: false  // 只截取可见区域
      };
      
      console.log(`🔗 [Webhook URL] ${tradingViewUrl.substring(0, 60)}...`);
      
      const response = await fetch(n8nWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const jsonData = await response.json();
      
      if (!jsonData.screenshot) {
        console.error('❌ N8n响应:', jsonData);
        throw new Error('无截图URL');
      }
      
      console.log(`📥 下载截图: ${jsonData.screenshot.substring(0, 80)}...`);
      
      const imgController = new AbortController();
      const imgTimeoutId = setTimeout(() => imgController.abort(), 20000);
      
      const imgRes = await fetch(jsonData.screenshot, {
        signal: imgController.signal
      });
      
      clearTimeout(imgTimeoutId);
      
      if (!imgRes.ok) {
        throw new Error(`下载失败 ${imgRes.status}`);
      }
      
      let buffer = Buffer.from(await imgRes.arrayBuffer());
      const elapsed = Date.now() - start;
      
      console.log(`✅ 截图成功 (尝试 ${attempt}/${maxRetries}, 耗时 ${elapsed}ms, ${(buffer.length / 1024).toFixed(2)} KB)`);
      
      // 检查是否需要裁剪（MarketScreener 等网页需要裁剪掉头部广告）
      if (tradingViewUrl.includes('marketscreener.com')) {
        console.log(`✂️  [裁剪] MarketScreener 截图 - 裁剪头部广告区域`);
        try {
          const metadata = await sharp(buffer).metadata();
          // 裁剪掉顶部 350px（广告区域）和右侧 300px（侧边栏）
          const cropTop = 350;
          const cropRight = 300;
          const newWidth = Math.max(metadata.width - cropRight, 800);
          const newHeight = Math.max(metadata.height - cropTop, 400);
          
          buffer = await sharp(buffer)
            .extract({
              left: 0,
              top: cropTop,
              width: newWidth,
              height: newHeight
            })
            .toBuffer();
          console.log(`   └─ 裁剪后: ${(buffer.length / 1024).toFixed(2)} KB`);
        } catch (cropError) {
          console.warn(`⚠️  裁剪失败，使用原图: ${cropError.message}`);
        }
      }
      
      return {
        success: true,
        provider: 'n8n-screenshotapi',
        validation: 'webhook',
        buffer: buffer,
        elapsed_ms: elapsed,
        attempt: attempt
      };
      
    } catch (error) {
      lastError = error;
      const isTimeout = error.name === 'AbortError';
      console.error(`❌ 截图尝试 ${attempt}/${maxRetries} ${isTimeout ? '超时' : '失败'}:`, error.message);
      
      if (attempt < maxRetries) {
        const waitTime = 3000;
        console.log(`⏳ 等待 ${waitTime}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  const isTimeout = lastError.name === 'AbortError';
  throw new Error(`所有 ${maxRetries} 次截图尝试均失败: ${isTimeout ? '超时' : lastError.message}`);
}

/**
 * 🆕 个股K线图专用截图服务
 * 调用N8N的stock_analysis_full工作流
 * @param {Object} params - 参数
 * @param {string} params.tradingViewUrl - TradingView图表URL
 * @param {string} params.symbol - 股票代码
 * @param {number} params.timeoutMs - 超时时间（默认45秒）
 * @param {number} params.maxRetries - 最大重试次数（默认2次）
 * @returns {Promise<Object>} 截图结果
 */
async function captureStockChartSmart({ tradingViewUrl, symbol, timeoutMs = 45000, maxRetries = 2 }) {
  const start = Date.now();
  console.log(`\n📸 [Stock Chart N8n] 调用个股截图服务 (超时: ${timeoutMs}ms, 最大重试: ${maxRetries}次)`);
  
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 个股截图尝试 ${attempt}/${maxRetries}`);
      
      // 🆕 使用stock_analysis_full webhook（非capture_heatmap）
      const n8nStockWebhook = process.env.N8N_STOCK_WEBHOOK || 
        'https://qian.app.n8n.cloud/webhook/stock_analysis_full';
      
      console.log(`🔗 [Webhook] ${n8nStockWebhook}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch(n8nStockWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: tradingViewUrl,
          symbols: [symbol],
          text: `${symbol}走势图`,
          mode: 'intraday'
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const jsonData = await response.json();
      
      // N8N stock_analysis_full返回格式：{chart_binary, analysis_text, ...}
      if (!jsonData.chart_binary && !jsonData.screenshot) {
        console.error('❌ N8n股票分析响应:', jsonData);
        throw new Error('无截图数据');
      }
      
      // 处理返回的binary数据
      let buffer;
      if (jsonData.chart_binary) {
        const binaryType = typeof jsonData.chart_binary;
        const isBufferLike = jsonData.chart_binary && jsonData.chart_binary.type === 'Buffer';
        console.log(`🔍 [Binary检测] 类型=${binaryType}, isBuffer=${Buffer.isBuffer(jsonData.chart_binary)}, isBufferLike=${isBufferLike}`);
        
        // 方式1: 如果是base64字符串
        if (typeof jsonData.chart_binary === 'string') {
          console.log(`📝 [Binary] Base64字符串 (长度: ${jsonData.chart_binary.length})`);
          buffer = Buffer.from(jsonData.chart_binary, 'base64');
        } 
        // 方式2: 如果是Buffer对象序列化形式 {type: 'Buffer', data: [...]}
        else if (jsonData.chart_binary.type === 'Buffer' && Array.isArray(jsonData.chart_binary.data)) {
          console.log(`📦 [Binary] Buffer对象序列化 (data长度: ${jsonData.chart_binary.data.length})`);
          buffer = Buffer.from(jsonData.chart_binary.data);
        } 
        // 方式3: 如果已经是Buffer实例
        else if (Buffer.isBuffer(jsonData.chart_binary)) {
          console.log(`✅ [Binary] 已是Buffer实例`);
          buffer = jsonData.chart_binary;
        }
        // 方式4: 尝试作为ArrayBuffer或Uint8Array处理
        else if (jsonData.chart_binary instanceof ArrayBuffer || jsonData.chart_binary instanceof Uint8Array) {
          console.log(`🔢 [Binary] ArrayBuffer/Uint8Array`);
          buffer = Buffer.from(jsonData.chart_binary);
        }
        // 未知格式
        else {
          console.error('❌ [Binary] 未知格式:', {
            type: binaryType,
            constructor: jsonData.chart_binary?.constructor?.name,
            keys: Object.keys(jsonData.chart_binary || {}).slice(0, 5)
          });
          throw new Error(`不支持的binary格式: ${binaryType}`);
        }
        
        // 最终验证
        if (!Buffer.isBuffer(buffer)) {
          throw new Error(`buffer转换失败，结果不是Buffer实例`);
        }
        
        console.log(`✅ [Binary] 转换成功，大小: ${(buffer.length / 1024).toFixed(2)} KB`);
      } else if (jsonData.screenshot) {
        // 下载截图URL
        console.log(`📥 下载截图: ${jsonData.screenshot.substring(0, 80)}...`);
        const imgController = new AbortController();
        const imgTimeoutId = setTimeout(() => imgController.abort(), 20000);
        
        const imgRes = await fetch(jsonData.screenshot, {
          signal: imgController.signal
        });
        
        clearTimeout(imgTimeoutId);
        
        if (!imgRes.ok) {
          throw new Error(`下载失败 ${imgRes.status}`);
        }
        
        buffer = Buffer.from(await imgRes.arrayBuffer());
      }
      
      const elapsed = Date.now() - start;
      
      console.log(`✅ 个股截图成功 (尝试 ${attempt}/${maxRetries}, 耗时 ${elapsed}ms, ${(buffer.length / 1024).toFixed(2)} KB)`);
      
      return {
        success: true,
        provider: 'n8n-stock-analysis',
        validation: 'webhook',
        buffer: buffer,
        analysis: jsonData.analysis_text || null,
        elapsed_ms: elapsed,
        attempt: attempt
      };
      
    } catch (error) {
      lastError = error;
      const isTimeout = error.name === 'AbortError';
      console.error(`❌ 个股截图尝试 ${attempt}/${maxRetries} ${isTimeout ? '超时' : '失败'}:`, error.message);
      
      if (attempt < maxRetries) {
        const waitTime = 3000;
        console.log(`⏳ 等待 ${waitTime}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  const isTimeout = lastError.name === 'AbortError';
  throw new Error(`所有 ${maxRetries} 次个股截图尝试均失败: ${isTimeout ? '超时' : lastError.message}`);
}

/**
 * 🆕 Browserless截图方法（TradingView K线图专用）
 * 自动关闭Black Friday弹窗
 * @param {string} symbolForTv - TradingView格式的股票代码（如 "NASDAQ:NVDA"）
 * @returns {Promise<Object>} 截图结果
 */
async function captureWithBrowserlessTv(symbolForTv) {
  const token = process.env.BROWSERLESS_TOKEN;
  if (!token) throw new Error('BROWSERLESS_TOKEN not set');

  const targetUrl = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbolForTv)}&feature=chart_embed`;
  
  const cookieHeader = process.env.TRADINGVIEW_COOKIE;
  if (!cookieHeader) {
    console.warn('[Browserless Embed] TRADINGVIEW_COOKIE not set, fallback to anonymous mode (may show ads).');
  }

  let cookies = [];
  if (cookieHeader) {
    cookies = cookieHeader.split(';').map(pair => {
      const trimmed = pair.trim();
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) return null;
      
      const name = trimmed.substring(0, eqIndex).trim();
      const value = trimmed.substring(eqIndex + 1).trim();
      
      if (!name || !value) return null;
      
      return {
        name: name,
        value: value,
        domain: '.tradingview.com',
        path: '/',
        secure: true,
        httpOnly: false
      };
    }).filter(c => c !== null);
    
    console.log(`📸 [Browserless Embed] 开始截图（TradingView Pro 模式，${cookies.length} cookies）: ${targetUrl}`);
  } else {
    console.log(`📸 [Browserless Embed] 开始截图: ${targetUrl}`);
  }

  try {
    const payload = {
      url: targetUrl,
      options: { fullPage: true, type: 'png' },
      gotoOptions: { waitUntil: 'networkidle2', timeout: 45000 }
    };

    if (cookies.length > 0) {
      payload.cookies = cookies;
    }

    const res = await axios.post(
      `https://production-sfo.browserless.io/screenshot?token=${token}`,
      payload,
      { responseType: 'arraybuffer', timeout: 60000 }
    );

    const buffer = Buffer.from(res.data);
    console.log(`✅ [Browserless Embed] 截图成功: ${(buffer.length / 1024).toFixed(2)} KB`);

    // 轻度裁剪：去掉顶部 5%（边框区域），保留底部 95%
    console.log(`✂️  [Browserless Embed] 裁剪图片（去除顶部 5% 边框）...`);
    const meta = await sharp(buffer).metadata();
    const width = meta.width;
    const height = meta.height;
    const cropTop = Math.floor(height * 0.05);
    const cropHeight = height - cropTop;

    const croppedBuffer = await sharp(buffer)
      .extract({ left: 0, top: cropTop, width, height: cropHeight })
      .toBuffer();

    console.log(`✅ [Browserless Embed] 裁剪完成: 原始 ${width}x${height} → 裁剪后 ${width}x${cropHeight} (${(croppedBuffer.length / 1024).toFixed(2)} KB)`);

    return {
      success: true,
      buffer: croppedBuffer,
      provider: 'browserless-tv-embed-pro',
      validation: 'browserless',
      caption: '📈 TradingView Pro 嵌入式K线图'
    };
  } catch (error) {
    console.error(`❌ [Browserless Embed] 截图失败: ${error.message}`);
    throw error;
  }
}

/**
 * 🆕 国际市场热力图专用 Browserless 截图
 * 使用 Puppeteer 渲染 TradingView，注入 hash 配置
 * @param {string} marketIndex - 市场指数代码 (TSX, DAX, FTSE, CAC40, AS51, KOSPI 等)
 * @returns {Promise<Object>} 截图结果
 */
async function captureInternationalHeatmap(marketIndex) {
  const token = process.env.BROWSERLESS_TOKEN;
  if (!token) {
    console.error('❌ [国际热力图] BROWSERLESS_TOKEN 未设置，回退到默认美股热力图');
    return null;
  }

  // TradingView 热力图 hash 配置（每个市场的参数）
  const marketConfigs = {
    'TSX': {
      dataSource: 'TSX60',
      grouping: 'sector',
      blockSize: 'market_cap_basic',
      blockColor: 'change',
      locale: 'en',
      symbolUrl: '',
      colorTheme: 'dark',
      hasTopBar: false,
      isDataSet498: false,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      isMonoSize: false
    },
    'DAX': {
      dataSource: 'DAX40',
      grouping: 'sector',
      blockSize: 'market_cap_basic',
      blockColor: 'change',
      locale: 'en',
      symbolUrl: '',
      colorTheme: 'dark',
      hasTopBar: false,
      isDataSetEnabled: false,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      isMonoSize: false
    },
    'DAX40': { /* 同 DAX */ },
    'FTSE': {
      dataSource: 'FTSE100',
      grouping: 'sector',
      blockSize: 'market_cap_basic',
      blockColor: 'change',
      locale: 'en',
      symbolUrl: '',
      colorTheme: 'dark',
      hasTopBar: false,
      isDataSetEnabled: false,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      isMonoSize: false
    },
    'FTSE100': { /* 同 FTSE */ },
    'CAC40': {
      dataSource: 'CAC40',
      grouping: 'sector',
      blockSize: 'market_cap_basic',
      blockColor: 'change',
      locale: 'en',
      symbolUrl: '',
      colorTheme: 'dark',
      hasTopBar: false,
      isDataSetEnabled: false,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      isMonoSize: false
    },
    'AS51': {
      dataSource: 'ASX200',
      grouping: 'sector',
      blockSize: 'market_cap_basic',
      blockColor: 'change',
      locale: 'en',
      symbolUrl: '',
      colorTheme: 'dark',
      hasTopBar: false,
      isDataSetEnabled: false,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      isMonoSize: false
    },
    'AS200': { /* 同 AS51 */ },
    'KOSPI': {
      dataSource: 'KOSPI',
      grouping: 'sector',
      blockSize: 'market_cap_basic',
      blockColor: 'change',
      locale: 'en',
      symbolUrl: '',
      colorTheme: 'dark',
      hasTopBar: false,
      isDataSetEnabled: false,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      isMonoSize: false
    },
    'NIKKEI225': {
      dataSource: 'NI225',
      grouping: 'sector',
      blockSize: 'market_cap_basic',
      blockColor: 'change',
      locale: 'en',
      symbolUrl: '',
      colorTheme: 'dark',
      hasTopBar: false,
      isDataSetEnabled: false,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      isMonoSize: false
    },
    'IBEX35': {
      dataSource: 'IBEX35',
      grouping: 'sector',
      blockSize: 'market_cap_basic',
      blockColor: 'change',
      locale: 'en',
      symbolUrl: '',
      colorTheme: 'dark',
      hasTopBar: false,
      isDataSetEnabled: false,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      isMonoSize: false
    }
  };

  // 复制别名
  marketConfigs['DAX40'] = marketConfigs['DAX'];
  marketConfigs['FTSE100'] = marketConfigs['FTSE'];
  marketConfigs['AS200'] = marketConfigs['AS51'];

  const config = marketConfigs[marketIndex];
  if (!config) {
    console.log(`⚠️  [国际热力图] 未知市场 ${marketIndex}，使用默认配置`);
    return null;
  }

  const hashConfig = encodeURIComponent(JSON.stringify(config));
  const targetUrl = `https://www.tradingview.com/heatmap/stock/#${hashConfig}`;
  
  console.log(`\n📸 [Browserless 国际热力图] 开始截图: ${marketIndex}`);
  console.log(`🔗 [目标URL] ${targetUrl.substring(0, 100)}...`);

  try {
    // Browserless /screenshot API with JavaScript execution
    const payload = {
      url: 'https://www.tradingview.com/heatmap/stock/',
      options: { 
        fullPage: false, 
        type: 'png',
        clip: {
          x: 0,
          y: 0,
          width: 1920,
          height: 1080
        }
      },
      viewport: {
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1
      },
      gotoOptions: { 
        waitUntil: 'networkidle0', 
        timeout: 30000 
      },
      // 关键：在页面加载后注入 hash 并等待热力图渲染
      addScriptTag: [{
        content: `
          // 设置 hash 参数
          window.location.hash = '${hashConfig}';
          
          // 等待热力图容器出现
          function waitForHeatmap() {
            return new Promise((resolve) => {
              const checkInterval = setInterval(() => {
                const heatmap = document.querySelector('.tv-heatmap, [class*="heatmap"], canvas');
                if (heatmap) {
                  clearInterval(checkInterval);
                  // 额外等待渲染完成
                  setTimeout(resolve, 2000);
                }
              }, 500);
              // 最多等待 15 秒
              setTimeout(() => {
                clearInterval(checkInterval);
                resolve();
              }, 15000);
            });
          }
          waitForHeatmap();
        `
      }],
      waitForTimeout: 8000  // 额外等待确保渲染完成
    };

    const startTime = Date.now();
    const res = await axios.post(
      `https://production-sfo.browserless.io/screenshot?token=${token}`,
      payload,
      { 
        responseType: 'arraybuffer', 
        timeout: 60000,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const buffer = Buffer.from(res.data);
    const elapsed = Date.now() - startTime;
    
    console.log(`✅ [Browserless 国际热力图] 截图成功: ${marketIndex} (${(buffer.length / 1024).toFixed(2)} KB, ${elapsed}ms)`);

    return {
      success: true,
      buffer: buffer,
      provider: 'browserless-intl-heatmap',
      validation: 'browserless',
      market: marketIndex,
      elapsed_ms: elapsed
    };

  } catch (error) {
    console.error(`❌ [Browserless 国际热力图] 截图失败: ${error.message}`);
    
    // 详细错误日志
    if (error.response) {
      console.error(`   HTTP ${error.response.status}: ${error.response.statusText}`);
      if (error.response.data) {
        const errText = Buffer.isBuffer(error.response.data) 
          ? error.response.data.toString('utf8').substring(0, 200)
          : JSON.stringify(error.response.data).substring(0, 200);
        console.error(`   响应: ${errText}`);
      }
    }
    
    return null;
  }
}

/**
 * 🆕 智能热力图截图路由
 * 根据市场类型选择最佳截图方法
 * @param {string} tradingViewUrl - 热力图URL
 * @param {string} marketIndex - 市场指数代码
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 截图结果
 */
async function captureHeatmapRouter({ tradingViewUrl, marketIndex, timeoutMs = 45000, maxRetries = 2 }) {
  // 美国市场 - 使用 N8N 快速通道
  const usMarkets = ['SPX500', 'NASDAQ100', 'DJ30', 'DJI', 'RUT'];
  
  if (usMarkets.includes(marketIndex)) {
    console.log(`🇺🇸 [热力图路由] 美国市场 ${marketIndex} → N8N 通道`);
    return captureHeatmapSmart({ tradingViewUrl, timeoutMs, maxRetries });
  }
  
  // 国际市场 - 使用 Browserless 渲染通道
  const intlMarkets = ['TSX', 'DAX', 'DAX40', 'FTSE', 'FTSE100', 'CAC40', 'AS51', 'AS200', 'KOSPI', 'NIKKEI225', 'IBEX35'];
  
  if (intlMarkets.includes(marketIndex)) {
    console.log(`🌍 [热力图路由] 国际市场 ${marketIndex} → Browserless 通道`);
    
    const result = await captureInternationalHeatmap(marketIndex);
    
    if (result && result.success) {
      return result;
    }
    
    // Browserless 失败，回退到 N8N（会显示默认美股）
    console.log(`⚠️  [热力图路由] Browserless 失败，回退 N8N`);
    return captureHeatmapSmart({ tradingViewUrl, timeoutMs, maxRetries });
  }
  
  // 其他市场 - 默认 N8N
  console.log(`📊 [热力图路由] 其他市场 ${marketIndex} → N8N 通道`);
  return captureHeatmapSmart({ tradingViewUrl, timeoutMs, maxRetries });
}

module.exports = {
  captureHeatmapSmart,
  captureStockChartSmart,
  captureWithBrowserlessTv,
  captureInternationalHeatmap,
  captureHeatmapRouter
};
