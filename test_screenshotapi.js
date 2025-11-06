const fetch = require('node-fetch');

async function testScreenshotAPI() {
  try {
    console.log('🧪 开始测试ScreenshotAPI...');
    
    // 测试URL - 日本热力图
    const testURL = 'https://www.tradingview.com/heatmap/stock/?color=change&dataset=NIKKEI225&group=sector&blockSize=market_cap_basic&blockColor=change';
    
    // ScreenshotAPI配置（从环境变量读取）
    const token = process.env.SCREENSHOTAPI_TOKEN || 'HHBYB5H-4CT4970-MVZEKM2-EMEWEXX';
    
    // 新API端点（v2）- token作为query参数
    const apiUrl = `https://shot.screenshotapi.net/screenshot`;
    const params = new URLSearchParams({
      token: token,
      url: testURL,
      fresh: 'true',
      output: 'json',
      width: '1920',
      height: '1080',
      delay: '5000'
    });
    
    const fullUrl = `${apiUrl}?${params.toString()}`;
    
    console.log(`🔗 测试URL: ${testURL}`);
    console.log(`🔑 使用Token: ${token.substring(0, 8)}...`);
    console.log('📤 发送请求到ScreenshotAPI (新端点v2)...');
    
    // 使用AbortController实现超时（node-fetch v2兼容）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(fullUrl, {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const result = await response.json();
    console.log('✅ ScreenshotAPI响应:', JSON.stringify(result, null, 2));
    
    if (result.screenshot) {
      console.log('🎉 截图成功！图像URL:', result.screenshot);
      return true;
    } else {
      console.log('❌ 截图失败:', result);
      return false;
    }
    
  } catch (error) {
    console.error('💥 测试失败:', error.message);
    return false;
  }
}

// 执行测试
testScreenshotAPI().then(success => {
  console.log(success ? '🎊 ScreenshotAPI测试成功！' : '😞 ScreenshotAPI测试失败');
  process.exit(success ? 0 : 1);
});
