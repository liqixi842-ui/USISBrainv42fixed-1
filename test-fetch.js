const fetch = require('node-fetch');

async function testN8N() {
  try {
    console.log('📸 开始调用n8n...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('⏰ 40秒超时触发');
      controller.abort();
    }, 40000);
    
    const res = await fetch('https://qian.app.n8n.cloud/webhook/capture_heatmap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        url: 'https://www.tradingview.com/heatmap/stock/?dataset=SPX500' 
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    console.log(`✅ 响应状态: ${res.status}`);
    
    const buf = Buffer.from(await res.arrayBuffer());
    console.log(`✅ 文件大小: ${(buf.length / 1024).toFixed(2)} KB`);
    
    return buf;
  } catch (error) {
    console.error(`❌ 错误:`, error.name, error.message);
    throw error;
  }
}

testN8N()
  .then(() => {
    console.log('🎉 测试成功');
    process.exit(0);
  })
  .catch((err) => {
    console.error('💥 测试失败:', err);
    process.exit(1);
  });
