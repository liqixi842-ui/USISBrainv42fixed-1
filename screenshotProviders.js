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
    
    // n8n返回ScreenshotAPI的JSON响应，包含screenshot URL
    if (jsonData.screenshot) {
      console.log(`📥 [下载截图] ${jsonData.screenshot}`);
      
      const imgController = new AbortController();
      const imgTimeoutId = setTimeout(() => imgController.abort(), 15000);
      
      const imgRes = await fetch(jsonData.screenshot, {
        signal: imgController.signal
      });
      
      clearTimeout(imgTimeoutId);
      
      if (!imgRes.ok) {
        throw new Error(`图片下载失败: ${imgRes.status}`);
      }
      
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      console.log(`✅ [截图成功] ${(buffer.length / 1024).toFixed(2)} KB`);
      
      return {
        success: true,
        provider: 'n8n-screenshotapi',
        validation: 'json-url',
        buffer: buffer
      };
    } else if (jsonData.market_data) {
      return { success: true, market_data: jsonData.market_data };
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
