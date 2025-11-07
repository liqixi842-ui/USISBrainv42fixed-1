/**
 * N8n Webhook截图服务
 * n8n → ScreenshotAPI → 返回screenshot URL → Replit下载
 */

const fetch = require('node-fetch');

async function captureHeatmapSmart({ tradingViewUrl, timeoutMs = 45000, maxRetries = 2 }) {
  const start = Date.now();
  console.log(`\n📸 [N8n] 调用截图服务 (超时: ${timeoutMs}ms, 最大重试: ${maxRetries}次)`);
  
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 截图尝试 ${attempt}/${maxRetries}`);
      
      const n8nWebhook = process.env.N8N_HEATMAP_WEBHOOK || 'https://qian.app.n8n.cloud/webhook/capture_heatmap';
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch(n8nWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: tradingViewUrl }),
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
      
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      const elapsed = Date.now() - start;
      
      console.log(`✅ 截图成功 (尝试 ${attempt}/${maxRetries}, 耗时 ${elapsed}ms, ${(buffer.length / 1024).toFixed(2)} KB)`);
      
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
        // 如果是base64编码
        if (typeof jsonData.chart_binary === 'string') {
          buffer = Buffer.from(jsonData.chart_binary, 'base64');
        } else if (jsonData.chart_binary.type === 'Buffer' && Array.isArray(jsonData.chart_binary.data)) {
          buffer = Buffer.from(jsonData.chart_binary.data);
        } else {
          buffer = jsonData.chart_binary;
        }
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

module.exports = {
  captureHeatmapSmart,
  captureStockChartSmart  // 🆕 导出个股图表专用函数
};
