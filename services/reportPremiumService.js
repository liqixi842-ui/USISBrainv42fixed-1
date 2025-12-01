/**
 * ═══════════════════════════════════════════════════════════════
 * USIS Brain v7.7 - Premium Report PDF Service (Phase 5)
 * ═══════════════════════════════════════════════════════════════
 * 
 * 功能：包装 v3_dev 机构级研报引擎，提供"Premium"模式
 * - 复用 v3_dev/services/reportService.js（V3-V5 演进）
 * - 使用 DocRaptor API 云渲染（专业 HTML→PDF）
 * - v4.0 Taste+Truth 专业校正层（消除 AI 幻觉）
 * - 多 AI 模型集成（6 模型智能路由）
 * 
 * 与 Phase 4 基础版区别：
 * - 基础版（reportPdfService.js）: pdfkit 本地渲染，60-90s
 * - Premium 版（本服务）: DocRaptor 云渲染，机构级标准，60-120s
 * 
 * @author USIS Brain v7 Agent - Phase 5
 * @created 2024-11-24
 */

// ═══════════════════════════════════════════════════════════════
// 依赖：v3_dev 核心引擎（不修改原文件）
// ═══════════════════════════════════════════════════════════════

const {
  buildResearchReport,
  buildHtmlFromReport,
  generatePdfWithDocRaptor
} = require('../v3_dev/services/reportService');

// ═══════════════════════════════════════════════════════════════
// 配置检查
// ═══════════════════════════════════════════════════════════════

const DOC_RAPTOR_API_KEY = process.env.DOC_RAPTOR_API_KEY || '';
const DOC_RAPTOR_TEST_MODE = process.env.DOC_RAPTOR_TEST_MODE === 'true';

/**
 * 检查 DocRaptor API 密钥是否配置
 * @returns {Object} { available: boolean, message: string }
 */
function checkDocRaptorAvailability() {
  if (!DOC_RAPTOR_API_KEY) {
    return {
      available: false,
      message: 'DocRaptor API key not configured. Premium PDF service unavailable.'
    };
  }
  
  return {
    available: true,
    message: `DocRaptor configured (${DOC_RAPTOR_TEST_MODE ? 'test' : 'production'} mode)`
  };
}

// ═══════════════════════════════════════════════════════════════
// 主函数：生成 Premium PDF Buffer
// ═══════════════════════════════════════════════════════════════

/**
 * 生成机构级 Premium PDF 研报（v3_dev 引擎）
 * @param {string} symbol - 股票代码
 * @param {string} language - 语言（en/zh/es）
 * @param {Object} options - 可选参数
 * @param {string} options.assetType - 资产类型（equity/index/etf/crypto）
 * @param {string} options.brand - 品牌名称
 * @param {string} options.firm - 机构名称
 * @param {string} options.analyst - 分析师名称
 * @returns {Promise<Buffer>} PDF Buffer
 */
async function generatePremiumPdf(symbol, language = 'en', options = {}) {
  const startTime = Date.now();
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📄 [ReportPremiumService] Generating Premium PDF`);
  console.log(`   ├─ Symbol: ${symbol}`);
  console.log(`   ├─ Language: ${language}`);
  console.log(`   ├─ Asset Type: ${options.assetType || 'auto-detect'}`);
  console.log(`   ├─ Engine: v3_dev (V3-V5 with v4.0 Taste+Truth)`);
  console.log(`   └─ Renderer: DocRaptor API`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  try {
    // ═══ STEP 0: 检查 DocRaptor 可用性 ═══
    const availability = checkDocRaptorAvailability();
    if (!availability.available) {
      throw new Error(
        `Premium PDF service unavailable: ${availability.message}\n\n` +
        `Please configure DOC_RAPTOR_API_KEY environment variable.\n` +
        `Tip: Use basic PDF service (/reportpdf) instead.`
      );
    }
    
    console.log(`✅ [Premium] ${availability.message}\n`);
    
    // ═══ STEP 1: 构建研报对象（v3_dev 引擎）═══
    console.log(`🔬 [Premium] Step 1/3: Building research report...`);
    
    const assetType = options.assetType || 'equity';
    const brandOptions = {
      brand: options.brand || 'USIS Research',
      firm: options.firm || 'USIS Research Division',
      analyst: options.analyst || 'USIS Brain v7.7 Multi-AI System',
      lang: language
    };
    
    const report = await buildResearchReport(symbol, assetType, brandOptions);
    
    console.log(`✅ [Premium] Report built successfully`);
    console.log(`   ├─ Sections: ${Object.keys(report.sections || {}).length}`);
    console.log(`   ├─ Rating: ${report.rating || 'N/A'}`);
    console.log(`   └─ Target Price: ${report.targetPrice || 'N/A'}\n`);
    
    // ═══ STEP 2: 转换为 HTML ═══
    console.log(`🎨 [Premium] Step 2/3: Converting to HTML template...`);
    
    const htmlContent = buildHtmlFromReport(report);
    
    const htmlSizeKB = (Buffer.byteLength(htmlContent, 'utf8') / 1024).toFixed(2);
    console.log(`✅ [Premium] HTML template generated (${htmlSizeKB} KB)\n`);
    
    // ═══ STEP 3: DocRaptor 云渲染 PDF ═══
    console.log(`☁️  [Premium] Step 3/3: Rendering PDF via DocRaptor...`);
    console.log(`   (This may take 30-60 seconds)\n`);
    
    const pdfBuffer = await generatePdfWithDocRaptor(symbol, htmlContent);
    
    // 验证 PDF Buffer
    if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
      throw new Error('DocRaptor returned invalid PDF buffer');
    }
    
    if (pdfBuffer.length === 0) {
      throw new Error('DocRaptor returned empty PDF buffer');
    }
    
    const duration = Date.now() - startTime;
    const sizeKB = (pdfBuffer.length / 1024).toFixed(2);
    
    console.log(`✅ [Premium] PDF rendered successfully`);
    console.log(`   ├─ Size: ${sizeKB} KB`);
    console.log(`   ├─ Duration: ${duration} ms`);
    console.log(`   └─ Renderer: DocRaptor ${DOC_RAPTOR_TEST_MODE ? '(test)' : '(prod)'}\n`);
    
    return pdfBuffer;
    
  } catch (error) {
    console.error(`\n❌ [ReportPremiumService] Premium PDF generation failed`);
    console.error(`   ├─ Symbol: ${symbol}`);
    console.error(`   ├─ Error: ${error.message}`);
    console.error(`   └─ Stack: ${error.stack.substring(0, 300)}...\n`);
    
    // 友好错误消息
    const friendlyError = getFriendlyErrorMessage(error);
    throw new Error(friendlyError);
  }
}

/**
 * 获取友好的错误消息
 * @param {Error} error - 原始错误
 * @returns {string} 友好错误消息
 */
function getFriendlyErrorMessage(error) {
  const message = error.message.toLowerCase();
  
  // DocRaptor 相关错误
  if (message.includes('docraptor') || message.includes('doc_raptor')) {
    if (message.includes('api key') || message.includes('unauthorized') || message.includes('401')) {
      return 'DocRaptor API key invalid or missing. Please check DOC_RAPTOR_API_KEY environment variable.';
    }
    
    if (message.includes('timeout')) {
      return 'DocRaptor PDF generation timeout. Please try again or use basic PDF service (/reportpdf).';
    }
    
    if (message.includes('quota') || message.includes('limit')) {
      return 'DocRaptor API quota exceeded. Please upgrade your DocRaptor plan or use basic PDF service.';
    }
    
    return `DocRaptor error: ${error.message}`;
  }
  
  // 网络错误
  if (message.includes('econnrefused') || message.includes('network')) {
    return 'Network error connecting to DocRaptor API. Please check internet connection.';
  }
  
  // AI 模型错误
  if (message.includes('openai') || message.includes('anthropic') || message.includes('google')) {
    return `AI model error: ${error.message}. Please check API keys.`;
  }
  
  // 数据获取错误
  if (message.includes('finnhub') || message.includes('twelve data')) {
    return `Market data error: ${error.message}. Symbol may be invalid.`;
  }
  
  // 默认错误
  return `Premium PDF generation failed: ${error.message}`;
}

/**
 * 检查 Premium 服务是否可用
 * @returns {boolean} 是否可用
 */
function isPremiumServiceAvailable() {
  return checkDocRaptorAvailability().available;
}

/**
 * 获取 Premium 服务状态信息
 * @returns {Object} 状态信息
 */
function getPremiumServiceStatus() {
  const availability = checkDocRaptorAvailability();
  
  return {
    available: availability.available,
    message: availability.message,
    renderer: 'DocRaptor API',
    engine: 'v3_dev (V3-V5 with v4.0 Taste+Truth)',
    models: ['GPT-4o', 'Claude 3.5', 'Gemini 2.5', 'DeepSeek V3', 'Mistral Large', 'Perplexity Sonar Pro'],
    features: [
      'Morgan Stanley / Goldman Sachs level analysis',
      'v4.0 Taste+Truth correction layer',
      'PE × EPS valuation model',
      '5-year history + 2-year forecasts',
      'Peer comparison with industry context',
      'Multi-AI model routing'
    ],
    testMode: DOC_RAPTOR_TEST_MODE,
    cost: DOC_RAPTOR_TEST_MODE ? '$0 (test mode)' : '$0.015/page (production)'
  };
}

// ═══════════════════════════════════════════════════════════════
// 模块导出
// ═══════════════════════════════════════════════════════════════

module.exports = {
  generatePremiumPdf,
  isPremiumServiceAvailable,
  getPremiumServiceStatus,
  checkDocRaptorAvailability
};
