/**
 * ═══════════════════════════════════════════════════════════════
 * USIS Brain v7.0 - Premium Report Service Test
 * ═══════════════════════════════════════════════════════════════
 * 
 * 测试范围：
 * - Premium PDF 服务可用性检查
 * - DocRaptor API 密钥验证
 * - PDF Buffer 生成（如果密钥已配置）
 * - 无需真实 Telegram 发送
 * 
 * 注意：本测试需要 DocRaptor API 密钥，如果未配置会跳过实际生成
 */

const {
  generatePremiumPdf,
  isPremiumServiceAvailable,
  getPremiumServiceStatus,
  checkDocRaptorAvailability
} = require('./services/reportPremiumService');

const fs = require('fs');
const path = require('path');

/**
 * 测试 Premium 服务状态
 */
function testPremiumServiceStatus() {
  console.log(`\n╔════════════════════════════════════════════════════╗`);
  console.log(`║   Premium Service Status Check                    ║`);
  console.log(`╚════════════════════════════════════════════════════╝\n`);
  
  const status = getPremiumServiceStatus();
  
  console.log(`Premium Service Status:`);
  console.log(`   ├─ Available: ${status.available ? '✅ YES' : '❌ NO'}`);
  console.log(`   ├─ Message: ${status.message}`);
  console.log(`   ├─ Renderer: ${status.renderer}`);
  console.log(`   ├─ Engine: ${status.engine}`);
  console.log(`   ├─ Test Mode: ${status.testMode ? 'YES (free)' : 'NO (production)'}`);
  console.log(`   └─ Cost: ${status.cost}`);
  
  console.log(`\nAI Models:`);
  status.models.forEach((model, index) => {
    console.log(`   ${index + 1}. ${model}`);
  });
  
  console.log(`\nFeatures:`);
  status.features.forEach((feature, index) => {
    console.log(`   ${index + 1}. ${feature}`);
  });
  
  return status.available;
}

/**
 * 测试 DocRaptor 可用性
 */
function testDocRaptorAvailability() {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🧪 Test: DocRaptor Availability`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  const check = checkDocRaptorAvailability();
  
  if (check.available) {
    console.log(`✅ DocRaptor is available`);
    console.log(`   Message: ${check.message}`);
  } else {
    console.log(`❌ DocRaptor is NOT available`);
    console.log(`   Message: ${check.message}`);
    console.log(`\n💡 Tip: Set DOC_RAPTOR_API_KEY environment variable to enable Premium service`);
  }
  
  return check.available;
}

/**
 * 测试 Premium PDF 生成（如果可用）
 */
async function testPremiumPdfGeneration() {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🧪 Test: Premium PDF Generation`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  if (!isPremiumServiceAvailable()) {
    console.log(`⚠️  SKIPPED: DocRaptor API key not configured`);
    console.log(`   Please set DOC_RAPTOR_API_KEY to test Premium PDF generation`);
    return false;
  }
  
  console.log(`⏳ Generating Premium PDF for NVDA (English)...`);
  console.log(`   (This may take 60-120 seconds)\n`);
  
  const startTime = Date.now();
  
  try {
    const pdfBuffer = await generatePremiumPdf('NVDA', 'en', {
      assetType: 'equity',
      brand: 'USIS Research (Test)',
      firm: 'USIS Research Division (Test)',
      analyst: 'Test Agent'
    });
    
    const duration = Date.now() - startTime;
    
    // 验证 1: Buffer 类型
    if (!Buffer.isBuffer(pdfBuffer)) {
      console.log(`❌ FAILED: Not a Buffer`);
      return false;
    }
    console.log(`✅ Validation 1: Is Buffer`);
    
    // 验证 2: Buffer 非空
    if (pdfBuffer.length === 0) {
      console.log(`❌ FAILED: Empty Buffer`);
      return false;
    }
    console.log(`✅ Validation 2: Non-empty Buffer`);
    
    // 验证 3: Buffer 大小 > 50KB（Premium 版应该更大）
    const sizeKB = (pdfBuffer.length / 1024).toFixed(2);
    if (pdfBuffer.length < 50 * 1024) {
      console.log(`❌ FAILED: Buffer too small (${sizeKB} KB < 50 KB)`);
      return false;
    }
    console.log(`✅ Validation 3: Buffer size sufficient (${sizeKB} KB > 50 KB)`);
    
    // 验证 4: PDF 文件头
    const header = pdfBuffer.toString('ascii', 0, 5);
    if (header !== '%PDF-') {
      console.log(`❌ FAILED: Invalid PDF header (got: ${header})`);
      return false;
    }
    console.log(`✅ Validation 4: Valid PDF header (%PDF-)`);
    
    // 保存到临时文件
    const tempDir = path.join(__dirname, 'tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const filename = `test_premium_NVDA_en_${Date.now()}.pdf`;
    const filepath = path.join(tempDir, filename);
    fs.writeFileSync(filepath, pdfBuffer);
    console.log(`💾 PDF saved to: ${filepath}`);
    
    console.log(`\n📊 Summary:`);
    console.log(`   ├─ Symbol: NVDA`);
    console.log(`   ├─ Language: en`);
    console.log(`   ├─ Size: ${sizeKB} KB`);
    console.log(`   ├─ Duration: ${duration} ms (${(duration / 1000).toFixed(2)}s)`);
    console.log(`   └─ File: ${filepath}`);
    
    console.log(`\n✅ Premium PDF Generation - ALL VALIDATIONS PASSED`);
    
    return true;
    
  } catch (error) {
    console.error(`\n❌ Premium PDF Generation - FAILED`);
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack: ${error.stack.substring(0, 300)}...`);
    
    return false;
  }
}

/**
 * 主测试运行器
 */
async function runAllTests() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`USIS Brain v7.0 - Premium Report Service Test Suite`);
  console.log(`${'='.repeat(60)}\n`);
  
  try {
    // Test 1: Service Status
    const statusAvailable = testPremiumServiceStatus();
    
    // Test 2: DocRaptor Availability
    const docRaptorAvailable = testDocRaptorAvailability();
    
    // Test 3: PDF Generation (only if available)
    let generationPassed = null;
    if (docRaptorAvailable) {
      generationPassed = await testPremiumPdfGeneration();
    } else {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`ℹ️  Premium PDF generation test skipped (DocRaptor not configured)`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    }
    
    // Final summary
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Test Suite Complete`);
    console.log(`${'='.repeat(60)}`);
    console.log(`\nService Status: ${statusAvailable ? '✅ Available' : '⚠️  Unavailable (API key missing)'}`);
    console.log(`DocRaptor Check: ${docRaptorAvailable ? '✅ Configured' : '⚠️  Not configured'}`);
    
    if (generationPassed !== null) {
      console.log(`PDF Generation: ${generationPassed ? '✅ PASS' : '❌ FAIL'}`);
    } else {
      console.log(`PDF Generation: ⏭️  SKIPPED (configure DOC_RAPTOR_API_KEY to test)`);
    }
    
    console.log(`\n💡 Next Steps:`);
    if (!docRaptorAvailable) {
      console.log(`   1. Set DOC_RAPTOR_API_KEY environment variable`);
      console.log(`   2. Optional: Set DOC_RAPTOR_TEST_MODE=true for free testing`);
      console.log(`   3. Run this test again to verify Premium PDF generation`);
    } else {
      console.log(`   1. Premium service is ready for production`);
      console.log(`   2. Integrate with /reportpdf pro command`);
      console.log(`   3. Test with real Telegram bot`);
    }
    
    if (generationPassed) {
      console.log(`\n🎉 All tests passed! Premium service is fully operational.\n`);
      process.exit(0);
    } else if (docRaptorAvailable && generationPassed === false) {
      console.log(`\n⚠️  Some tests failed. Please review errors above.\n`);
      process.exit(1);
    } else {
      console.log(`\n✅ Service wrapper is ready (API key configuration needed for full testing).\n`);
      process.exit(0);
    }
    
  } catch (error) {
    console.error(`\n❌ Test suite crashed:`);
    console.error(error);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  testPremiumServiceStatus,
  testDocRaptorAvailability,
  testPremiumPdfGeneration
};
