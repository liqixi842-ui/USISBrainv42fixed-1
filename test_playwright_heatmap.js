// 快速测试Playwright热力图截图功能
const { captureTvHeatmapWithRetry, INDEX_LABEL } = require('./tvHeatmapCapture');

async function test() {
  console.log('🧪 测试1: 日本大盘（NIKKEI225）');
  try {
    const result1 = await captureTvHeatmapWithRetry({
      dataset: 'NIKKEI225',
      label: INDEX_LABEL.NIKKEI225,
      lang: 'ja-JP',
      timeout: 15000
    }, 1);
    console.log(`✅ 成功: ${result1.image_base64.length} bytes, visual="${result1.visual_index_label}"`);
  } catch (e) {
    console.error(`❌ 失败:`, e.message);
  }
  
  console.log('\n🧪 测试2: 西班牙大盘（IBEX35）');
  try {
    const result2 = await captureTvHeatmapWithRetry({
      dataset: 'IBEX35',
      label: INDEX_LABEL.IBEX35,
      lang: 'es-ES',
      timeout: 15000
    }, 1);
    console.log(`✅ 成功: ${result2.image_base64.length} bytes, visual="${result2.visual_index_label}"`);
  } catch (e) {
    console.error(`❌ 失败:`, e.message);
  }
  
  console.log('\n🧪 测试3: 美股科技（SPX500 + technology）');
  try {
    const result3 = await captureTvHeatmapWithRetry({
      dataset: 'SPX500',
      label: INDEX_LABEL.SPX500,
      sector: 'technology',
      lang: 'en-US',
      timeout: 15000
    }, 1);
    console.log(`✅ 成功: ${result3.image_base64.length} bytes, visual="${result3.visual_index_label}"`);
  } catch (e) {
    console.error(`❌ 失败:`, e.message);
  }
  
  console.log('\n✅ 所有测试完成');
}

test().catch(console.error);
