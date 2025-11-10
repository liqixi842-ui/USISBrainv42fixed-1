// 诊断截图服务是否正常工作
const fetch = require('node-fetch');

async function testScreenshotService() {
  console.log('\n🔍 诊断截图服务...\n');
  
  // 1. 检查环境变量
  const stockWebhook = process.env.N8N_STOCK_WEBHOOK;
  const defaultWebhook = 'https://qian.app.n8n.cloud/webhook/stock_analysis_full';
  
  console.log('1️⃣ 环境变量检查:');
  console.log(`   N8N_STOCK_WEBHOOK: ${stockWebhook ? '✅ 已配置' : '⚠️  未配置（将使用默认）'}`);
  console.log(`   实际使用: ${stockWebhook || defaultWebhook}\n`);
  
  // 2. 测试N8N webhook连通性
  console.log('2️⃣ 测试N8N webhook连通性...');
  const testUrl = stockWebhook || defaultWebhook;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const startTime = Date.now();
    const response = await fetch(testUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://www.tradingview.com/chart/?symbol=NASDAQ:AAPL&interval=D',
        symbols: ['AAPL'],
        text: 'AAPL走势图',
        mode: 'intraday'
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    const elapsed = Date.now() - startTime;
    
    console.log(`   ⏱️  响应时间: ${elapsed}ms`);
    console.log(`   📡 HTTP状态: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`   ❌ 错误响应: ${errorText.substring(0, 200)}`);
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`   ✅ N8N webhook响应成功`);
    console.log(`   📦 返回数据键: ${Object.keys(data).join(', ')}`);
    
    if (data.chart_binary) {
      const binarySize = typeof data.chart_binary === 'string' 
        ? Buffer.from(data.chart_binary, 'base64').length 
        : data.chart_binary.data?.length || 0;
      console.log(`   🖼️  图表数据: ${(binarySize / 1024).toFixed(2)} KB`);
    } else if (data.screenshot) {
      console.log(`   🖼️  截图URL: ${data.screenshot.substring(0, 60)}...`);
    } else {
      console.log(`   ⚠️  警告: 没有chart_binary或screenshot字段`);
    }
    
    console.log('\n✅ 截图服务正常工作！');
    return true;
    
  } catch (error) {
    console.log(`   ❌ N8N webhook失败: ${error.message}`);
    
    if (error.name === 'AbortError') {
      console.log(`   ⏱️  原因: 超时（>30秒）`);
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      console.log(`   🌐 原因: 网络连接失败`);
    }
    
    console.log('\n❌ 截图服务无法工作 - 这就是为什么"分析苹果"只显示基础分析！');
    return false;
  }
}

// 运行测试
testScreenshotService()
  .then(result => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`诊断结果: ${result ? '✅ 服务正常' : '❌ 服务异常'}`);
    console.log(`${'='.repeat(60)}\n`);
    process.exit(result ? 0 : 1);
  })
  .catch(error => {
    console.error('\n💥 测试脚本异常:', error);
    process.exit(1);
  });
