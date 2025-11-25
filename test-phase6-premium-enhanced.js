/**
 * test-phase6-premium-enhanced.js
 * 
 * Phase 6 测试：增强版 PDF 结构
 * 测试封面、目录、页眉页脚、多模型共识
 */

const { renderProfessionalCover, renderTableOfContents, extractSections } = require('./services/pdfTemplateUtils');
const { getMultiModelViews, consolidateConsensus } = require('./services/multiModelConsensus');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// 测试符号
const TEST_SYMBOL = 'AAPL';

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`🧪 Phase 6 Premium PDF Enhancement Test`);
console.log(`   Symbol: ${TEST_SYMBOL}`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

/**
 * 测试 PDF 模板工具
 */
async function testPdfTemplateUtils() {
  console.log(`\n═══ Test 1: PDF Template Utilities ═══\n`);
  
  try {
    // 创建测试 PDF
    const doc = new PDFDocument({ size: 'A4' });
    const outputPath = path.join(__dirname, `test-enhanced-pdf-${TEST_SYMBOL}.pdf`);
    const writeStream = fs.createWriteStream(outputPath);
    
    doc.pipe(writeStream);
    
    // 模拟研报对象
    const mockReport = {
      symbol: TEST_SYMBOL,
      company_name: 'Apple Inc.',
      rating: 'Buy',
      targetPrice: '$200',
      target_price: '$200',
      analyst: 'USIS Brain v7.0 Multi-AI System',
      date: new Date().toLocaleDateString('en-US'),
      sections: [
        { title: 'Executive Summary', content: 'Test content' },
        { title: 'Financial Analysis', content: 'Test content' },
        { title: 'Technical Analysis', content: 'Test content' },
        { title: 'Risk Assessment', content: 'Test content' },
        { title: 'Valuation', content: 'Test content' },
        { title: 'Investment Recommendation', content: 'Test content' }
      ]
    };
    
    // Test 1a: 专业封面
    console.log(`   ├─ Testing professional cover...`);
    renderProfessionalCover(doc, mockReport);
    console.log(`   ├─ ✅ Cover page rendered`);
    
    // Test 1b: 目录
    console.log(`   ├─ Testing table of contents...`);
    const sections = extractSections(mockReport);
    renderTableOfContents(doc, sections);
    console.log(`   ├─ ✅ Table of contents rendered (${sections.length} sections)`);
    
    // Test 1c: 添加示例内容页
    console.log(`   ├─ Adding sample content pages...`);
    mockReport.sections.forEach((section, index) => {
      doc.fontSize(18)
         .fillColor('#1a2332')
         .font('Bold')
         .text(section.title, 50, 100);
      
      doc.fontSize(12)
         .fillColor('#000000')
         .font('Regular')
         .text(section.content, 50, 140);
      
      if (index < mockReport.sections.length - 1) {
        doc.addPage();
      }
    });
    console.log(`   ├─ ✅ Content pages added`);
    
    // 完成 PDF
    doc.end();
    
    // 等待文件写入完成
    await new Promise((resolve) => writeStream.on('finish', resolve));
    
    // 验证文件存在
    const stats = fs.statSync(outputPath);
    console.log(`   └─ ✅ PDF file created: ${outputPath}`);
    console.log(`      Size: ${(stats.size / 1024).toFixed(2)} KB\n`);
    
    return true;
    
  } catch (error) {
    console.error(`❌ PDF template test failed: ${error.message}`);
    console.error(error.stack);
    return false;
  }
}

/**
 * 测试多模型共识
 */
async function testMultiModelConsensus() {
  console.log(`\n═══ Test 2: Multi-Model Consensus ═══\n`);
  
  try {
    // 检查 API 密钥
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
    const hasDeepSeek = !!process.env.DEEPSEEK_API_KEY;
    
    console.log(`   API Keys Status:`);
    console.log(`   ├─ OpenAI:    ${hasOpenAI ? '✅' : '❌'}`);
    console.log(`   ├─ Anthropic: ${hasAnthropic ? '✅' : '❌'}`);
    console.log(`   └─ DeepSeek:  ${hasDeepSeek ? '✅' : '❌'}\n`);
    
    if (!hasOpenAI && !hasAnthropic && !hasDeepSeek) {
      console.warn(`⚠️  No API keys configured, skipping multi-model test`);
      return true; // Skip test, not a failure
    }
    
    // 构建测试上下文
    const context = {
      symbol: TEST_SYMBOL,
      price: 175.50,
      marketCap: '2.8T',
      pe_ratio: 28.5,
      revenue_growth: 0.08
    };
    
    console.log(`   Testing multi-model consensus for ${TEST_SYMBOL}...`);
    console.log(`   (This may take 30-60 seconds)\n`);
    
    // 获取多模型观点
    const models = await getMultiModelViews(TEST_SYMBOL, 'en', context);
    
    // 生成共识
    const consensus = consolidateConsensus(models, 'en');
    
    console.log(`\n   Multi-Model Results:`);
    console.log(`   ├─ Consensus Rating: ${consensus.rating}`);
    console.log(`   ├─ Confidence: ${consensus.confidence}%`);
    console.log(`   ├─ Models Used: ${consensus.models.join(', ')}`);
    console.log(`   └─ Divergence Points: ${consensus.divergence.length}\n`);
    
    console.log(`   Consensus Text Preview:`);
    console.log(`   ${consensus.consensus.substring(0, 300)}...\n`);
    
    return true;
    
  } catch (error) {
    console.error(`❌ Multi-model consensus test failed: ${error.message}`);
    console.error(error.stack);
    return false;
  }
}

async function runAllTests() {
  console.log(`\n🚀 Starting Phase 6 Premium Enhancement Tests...\n`);
  
  const results = {
    pdfTemplate: false,
    multiModel: false
  };
  
  // Test 1: PDF Template
  results.pdfTemplate = await testPdfTemplateUtils();
  
  // Test 2: Multi-Model Consensus
  results.multiModel = await testMultiModelConsensus();
  
  // 总结
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 Phase 6 Premium Enhancement Tests Summary`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   PDF Template:       ${results.pdfTemplate ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Multi-Model:        ${results.multiModel ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  const allPassed = Object.values(results).every(r => r === true);
  
  if (allPassed) {
    console.log(`✅ All premium enhancement tests PASSED!`);
    process.exit(0);
  } else {
    console.error(`❌ Some premium enhancement tests FAILED!`);
    process.exit(1);
  }
}

// 运行测试
runAllTests().catch(error => {
  console.error(`\n❌ Fatal error during testing:`, error);
  process.exit(1);
});
