/**
 * 架构调整#021 - JSON数据流模式
 * N8n返回市场数据JSON，不再返回图片
 */

const fetch = require('node-fetch');

async function captureHeatmapSmart({ tradingViewUrl }) {
  console.log(`\n🧠 [JSON数据模式] 请求市场数据: ${tradingViewUrl}`);
  
  try {
    const n8nWebhook = process.env.N8N_HEATMAP_WEBHOOK || 'https://qian.app.n8n.cloud/webhook/capture_heatmap';
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    
    const response = await fetch(n8nWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        url: tradingViewUrl,
        output_format: 'json'
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`n8n_http_${response.status}`);
    }
    
    const jsonData = await response.json();
    console.log('✅ [N8n JSON响应]', JSON.stringify(jsonData, null, 2));
    
    if (!jsonData.market_data) {
      throw new Error('N8n返回的JSON缺少market_data字段');
    }
    
    return {
      success: true,
      data_type: 'json',
      market_data: jsonData.market_data,
      analysis_ready: true,
      elapsed_ms: jsonData.elapsed_ms || 0
    };
    
  } catch (error) {
    console.error(`❌ [JSON数据获取错误]`, error.message);
    throw new Error(`市场数据获取失败: ${error.message}`);
  }
}

module.exports = {
  captureHeatmapSmart
};
