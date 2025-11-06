/**
 * 诊断模式#023 - 检查N8n返回的JSON结构
 */

const fetch = require('node-fetch');

async function captureHeatmapSmart({ tradingViewUrl }) {
  console.log(`\n🔍 [诊断模式] 检查N8n返回结构`);
  
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
    
    // 先不解析，直接查看原始响应
    const rawResponse = await response.text();
    console.log('📦 [N8n原始响应]', rawResponse);
    
    // 尝试解析JSON
    let jsonData;
    try {
      jsonData = JSON.parse(rawResponse);
      console.log('✅ [JSON解析成功]', JSON.stringify(jsonData, null, 2));
    } catch (parseError) {
      console.log('❌ [JSON解析失败]', parseError.message);
      return {
        success: false,
        error: 'N8n返回的不是JSON格式',
        raw_data: rawResponse.substring(0, 200)
      };
    }
    
    // 检查JSON结构
    console.log('🔍 [JSON键列表]', Object.keys(jsonData));
    
    // 根据实际结构调整
    if (jsonData.market_data) {
      return { success: true, market_data: jsonData.market_data };
    } else if (jsonData.data) {
      return { success: true, market_data: jsonData.data };
    } else if (jsonData.screenshot) {
      return { 
        success: false, 
        error: 'N8n仍返回图片模式数据',
        screenshot_url: jsonData.screenshot 
      };
    } else {
      return { 
        success: false, 
        error: '无法识别的JSON结构',
        full_response: jsonData 
      };
    }
    
  } catch (error) {
    console.error(`❌ [诊断错误]`, error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  captureHeatmapSmart
};
