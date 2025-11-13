#!/usr/bin/env node
// 🔧 v4.0.2: 测试深度研报生成（离线测试，不触发Telegram）
// 用途：在开发环境生成完整PDF样本，供人工审核

const fs = require('fs');
const path = require('path');
const { generateDeepReport } = require('./deepReportService');

async function testDeepReport(symbol) {
  console.log(`\n🧪 ═══════════════════════════════════════════════════`);
  console.log(`   测试深度研报生成: ${symbol}`);
  console.log(`   环境: Development (离线测试)`);
  console.log(`   时间: ${new Date().toISOString()}`);
  console.log(`═══════════════════════════════════════════════════\n`);
  
  try {
    // 生成深度研报
    const result = await generateDeepReport(symbol);
    
    // 保存PDF到本地
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `${symbol}_USIS_Research_${timestamp}_TEST.pdf`;
    const filepath = path.join(__dirname, 'test-reports', filename);
    
    // 确保目录存在
    if (!fs.existsSync(path.join(__dirname, 'test-reports'))) {
      fs.mkdirSync(path.join(__dirname, 'test-reports'), { recursive: true });
    }
    
    fs.writeFileSync(filepath, result.pdfBuffer);
    
    console.log(`\n✅ ═══════════════ 测试成功 ═══════════════`);
    console.log(`📄 PDF已保存: ${filepath}`);
    console.log(`📊 评级: ${result.rating}`);
    console.log(`💡 核心观点: ${result.coreView}`);
    console.log(`📏 预估页数: ${result.metadata.pages}页`);
    console.log(`⏱  生成时间: ${result.metadata.duration}秒`);
    console.log(`\n📋 投资摘要:\n${result.summary}\n`);
    console.log(`═══════════════════════════════════════════════════\n`);
    
    // 保存HTML版本供调试
    const htmlFilepath = filepath.replace('.pdf', '.html');
    fs.writeFileSync(htmlFilepath, result.htmlContent);
    console.log(`📝 HTML源码已保存: ${htmlFilepath} (用于字体调试)`);
    
    return {
      success: true,
      pdfPath: filepath,
      htmlPath: htmlFilepath,
      result
    };
    
  } catch (error) {
    console.error(`\n❌ ═══════════════ 测试失败 ═══════════════`);
    console.error(`错误: ${error.message}`);
    console.error(`堆栈: ${error.stack}`);
    console.error(`═══════════════════════════════════════════════════\n`);
    
    return {
      success: false,
      error: error.message
    };
  }
}

// 命令行执行
if (require.main === module) {
  const symbol = process.argv[2] || 'NVDA';
  
  testDeepReport(symbol)
    .then(result => {
      if (result.success) {
        console.log(`\n✅ 测试完成！请检查生成的PDF文件：\n   ${result.pdfPath}\n`);
        console.log(`🔍 如果PDF中文乱码，请检查HTML源码：\n   ${result.htmlPath}\n`);
        process.exit(0);
      } else {
        console.error(`\n❌ 测试失败: ${result.error}\n`);
        process.exit(1);
      }
    })
    .catch(err => {
      console.error(`\n❌ 未捕获错误: ${err.message}\n`);
      process.exit(1);
    });
}

module.exports = { testDeepReport };
