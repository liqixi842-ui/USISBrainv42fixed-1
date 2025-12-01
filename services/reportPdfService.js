/**
 * ═══════════════════════════════════════════════════════════════
 * USIS Brain v7.7 - Report PDF Service
 * ═══════════════════════════════════════════════════════════════
 * 
 * 功能：生成机构级 PDF 研报
 * - 复用 reportTextService 的文本生成逻辑
 * - 使用 pdfkit 渲染专业版面
 * - 支持多语言（EN/ZH/ES）
 * - A4 纵向，封面 + 章节分页
 * 
 * @author USIS Brain v7 Agent
 * @created 2024-11-24
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { generateFullTextReport } = require('./reportTextService');

// ═══════════════════════════════════════════════════════════════
// 字体配置
// ═══════════════════════════════════════════════════════════════

const FONT_REGULAR = path.join(__dirname, '..', 'fonts', 'NotoSansCJK-Regular.otf');
const FONT_BOLD = path.join(__dirname, '..', 'fonts', 'NotoSansCJK-Bold.otf');

// 检查字体文件是否存在
const hasFonts = fs.existsSync(FONT_REGULAR) && fs.existsSync(FONT_BOLD);

if (!hasFonts) {
  console.warn('⚠️  [ReportPdfService] CJK fonts not found, using system fonts');
  console.warn(`   Missing: ${FONT_REGULAR}`);
  console.warn(`   Missing: ${FONT_BOLD}`);
}

// ═══════════════════════════════════════════════════════════════
// 主函数：生成 PDF Buffer
// ═══════════════════════════════════════════════════════════════

/**
 * 生成研报 PDF Buffer
 * @param {string} symbol - 股票代码
 * @param {string} language - 语言（en/zh/es）
 * @param {Object} options - 可选参数
 * @returns {Promise<Buffer>} PDF Buffer
 */
async function generateReportPdfBuffer(symbol, language = 'en', options = {}) {
  const startTime = Date.now();
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📄 [ReportPdfService] Generating PDF report`);
  console.log(`   ├─ Symbol: ${symbol}`);
  console.log(`   ├─ Language: ${language}`);
  console.log(`   └─ Timestamp: ${new Date().toISOString()}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  try {
    // Step 1: 生成文本版研报
    console.log(`   ├─ Step 1/2: Generating text report...`);
    const report = await generateFullTextReport(symbol, language, options);
    console.log(`   ├─ ✅ Text report ready (${report.sections.length} sections)`);
    
    // Step 2: 渲染 PDF
    console.log(`   ├─ Step 2/2: Rendering PDF...`);
    const pdfBuffer = await renderPdfFromReport(report);
    
    const duration = Date.now() - startTime;
    const sizeKB = (pdfBuffer.length / 1024).toFixed(2);
    
    console.log(`   ├─ ✅ PDF rendered (${sizeKB} KB)`);
    console.log(`   └─ Total duration: ${duration} ms\n`);
    
    return pdfBuffer;
    
  } catch (error) {
    console.error(`\n❌ [ReportPdfService] PDF generation failed`);
    console.error(`   ├─ Symbol: ${symbol}`);
    console.error(`   ├─ Error: ${error.message}`);
    console.error(`   └─ Stack: ${error.stack.substring(0, 200)}...\n`);
    throw error;
  }
}

/**
 * 从研报对象渲染 PDF
 * @param {Object} report - 研报对象（来自 generateFullTextReport）
 * @returns {Promise<Buffer>} PDF Buffer
 */
async function renderPdfFromReport(report) {
  return new Promise((resolve, reject) => {
    try {
      // 创建 PDF 文档
      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: 50,
          bottom: 50,
          left: 60,
          right: 60
        },
        info: {
          Title: `${report.symbol} · Equity Research Report`,
          Author: 'USIS Brain v7.7 Multi-AI Research System',
          Subject: `Institutional research report for ${report.symbol}`,
          Keywords: 'research, equity, analysis, institutional',
          CreationDate: new Date()
        }
      });
      
      // Buffer 收集器
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      // 注册字体（如果可用）
      if (hasFonts) {
        doc.registerFont('Regular', FONT_REGULAR);
        doc.registerFont('Bold', FONT_BOLD);
      }
      
      // 渲染封面
      renderCoverPage(doc, report);
      
      // 渲染章节
      report.sections.forEach((section, index) => {
        renderSection(doc, section, index, report.language);
      });
      
      // 渲染页脚（免责声明）
      renderFooter(doc, report);
      
      // 完成 PDF
      doc.end();
      
    } catch (error) {
      reject(error);
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// 渲染函数
// ═══════════════════════════════════════════════════════════════

/**
 * 渲染封面页
 */
function renderCoverPage(doc, report) {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  
  // 背景色（浅灰）
  doc.rect(0, 0, pageWidth, pageHeight)
     .fill('#f8f9fa');
  
  // 重置颜色
  doc.fillColor('#000000');
  
  // 主标题
  const titleY = pageHeight * 0.35;
  setFont(doc, 'bold', 32);
  doc.text(
    `${report.symbol.toUpperCase()}`,
    0,
    titleY,
    { align: 'center', width: pageWidth }
  );
  
  doc.moveDown(0.5);
  
  // 副标题
  const subtitle = getTitleText(report.language);
  setFont(doc, 'regular', 20);
  doc.fillColor('#333333')
     .text(subtitle, { align: 'center', width: pageWidth });
  
  doc.moveDown(2);
  
  // 分隔线
  const lineY = doc.y;
  doc.moveTo(pageWidth * 0.3, lineY)
     .lineTo(pageWidth * 0.7, lineY)
     .stroke('#666666');
  
  doc.moveDown(2);
  
  // USIS Brain 标识
  setFont(doc, 'bold', 16);
  doc.fillColor('#000000')
     .text('USIS Brain v7.7', { align: 'center', width: pageWidth });
  
  doc.moveDown(0.3);
  setFont(doc, 'regular', 12);
  doc.fillColor('#666666')
     .text('Multi-AI Institutional Research System', { align: 'center', width: pageWidth });
  
  // 生成日期
  const dateY = pageHeight * 0.75;
  doc.y = dateY;
  setFont(doc, 'regular', 11);
  doc.fillColor('#999999')
     .text(
       `Generated: ${new Date(report.metadata.generatedAt).toLocaleDateString('en-US', {
         year: 'numeric',
         month: 'long',
         day: 'numeric'
       })}`,
       { align: 'center', width: pageWidth }
     );
  
  // 新建一页
  doc.addPage();
}

/**
 * 渲染单个章节（带完整分页逻辑）
 */
function renderSection(doc, section, index, language) {
  // 每个章节新起一页（除了第一个）
  if (index > 0) {
    doc.addPage();
  }
  
  // 章节标题
  setFont(doc, 'bold', 18);
  doc.fillColor('#1a1a1a')
     .text(section.title, {
       underline: false,
       lineGap: 8
     });
  
  doc.moveDown(1);
  
  // 章节正文
  setFont(doc, 'regular', 11);
  doc.fillColor('#333333');
  
  // 按段落分割
  const paragraphs = section.body.split('\n\n');
  
  paragraphs.forEach((paragraph, pIndex) => {
    if (paragraph.trim().length === 0) return;
    
    const cleaned = paragraph.trim();
    
    // 估算段落需要的高度
    const estimatedHeight = estimateParagraphHeight(doc, cleaned);
    const pageBottomMargin = 100; // 留出底部边距
    const availableSpace = doc.page.height - doc.page.margins.bottom - doc.y;
    
    // 检查是否需要分页（段落开始前检查）
    if (estimatedHeight > availableSpace - pageBottomMargin) {
      // 分页
      doc.addPage();
      
      // 在新页面上标注继续标记
      setFont(doc, 'regular', 9);
      doc.fillColor('#999999')
         .text(`${section.title} (continued)`, { italic: true });
      doc.moveDown(0.5);
      setFont(doc, 'regular', 11);
      doc.fillColor('#333333');
    }
    
    // 渲染段落
    doc.text(cleaned, {
      align: 'left',
      lineGap: 4,
      paragraphGap: 8
    });
    
    // 段落间距
    if (pIndex < paragraphs.length - 1) {
      doc.moveDown(0.8);
      
      // 再次检查是否接近页面底部（段落间距后）
      if (doc.y > doc.page.height - doc.page.margins.bottom - pageBottomMargin) {
        doc.addPage();
        
        // 继续标记
        setFont(doc, 'regular', 9);
        doc.fillColor('#999999')
           .text(`${section.title} (continued)`, { italic: true });
        doc.moveDown(0.5);
        setFont(doc, 'regular', 11);
        doc.fillColor('#333333');
      }
    }
  });
}

/**
 * 估算段落高度
 * @param {PDFDocument} doc - PDF 文档对象
 * @param {string} text - 段落文本
 * @returns {number} 估算高度（像素）
 */
function estimateParagraphHeight(doc, text) {
  // 简单估算：字符数 / 平均每行字符数 * 行高
  const avgCharsPerLine = 80; // A4 页面 11pt 字体约 80 字符/行
  const lineHeight = 16; // 11pt 字体 + lineGap 4
  const paragraphGap = 12;
  
  const estimatedLines = Math.ceil(text.length / avgCharsPerLine);
  return estimatedLines * lineHeight + paragraphGap;
}

/**
 * 渲染页脚（免责声明）
 */
function renderFooter(doc, report) {
  doc.addPage();
  
  // 分隔线
  doc.moveTo(60, doc.y)
     .lineTo(doc.page.width - 60, doc.y)
     .stroke('#cccccc');
  
  doc.moveDown(1);
  
  // 免责声明标题
  setFont(doc, 'bold', 12);
  doc.fillColor('#000000')
     .text(getDisclaimerTitle(report.language));
  
  doc.moveDown(0.5);
  
  // 免责声明内容
  setFont(doc, 'regular', 9);
  doc.fillColor('#666666')
     .text(getDisclaimerText(report.language), {
       align: 'justify',
       lineGap: 3
     });
  
  doc.moveDown(1.5);
  
  // 元数据
  setFont(doc, 'regular', 8);
  doc.fillColor('#999999')
     .text(
       `Document ID: ${report.symbol}-${report.language}-${Date.now().toString(36)}\n` +
       `Version: ${report.metadata.version}\n` +
       `Word Count: ~${report.metadata.wordCount} words\n` +
       `Generated: ${report.metadata.generatedAt}`,
       { align: 'left' }
     );
}

// ═══════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════

/**
 * 设置字体（兼容有无中文字体）
 */
function setFont(doc, style, size) {
  if (hasFonts) {
    // 有中文字体
    doc.font(style === 'bold' ? 'Bold' : 'Regular');
  } else {
    // 使用系统字体
    doc.font(style === 'bold' ? 'Helvetica-Bold' : 'Helvetica');
  }
  
  if (size) {
    doc.fontSize(size);
  }
  
  return doc;
}

/**
 * 获取封面标题文本
 */
function getTitleText(language) {
  const titles = {
    en: 'Equity Research Report',
    zh: '股票研究报告',
    es: 'Informe de Investigación'
  };
  return titles[language] || titles['en'];
}

/**
 * 获取免责声明标题
 */
function getDisclaimerTitle(language) {
  const titles = {
    en: 'DISCLAIMER',
    zh: '免责声明',
    es: 'DESCARGO DE RESPONSABILIDAD'
  };
  return titles[language] || titles['en'];
}

/**
 * 获取免责声明内容
 */
function getDisclaimerText(language) {
  const texts = {
    en: 
      'This report is for informational purposes only and does not constitute investment advice, a recommendation, ' +
      'or a solicitation to buy or sell any securities. The information contained herein is believed to be reliable ' +
      'but is not guaranteed as to accuracy or completeness. USIS Brain v7.7 is an AI-powered research system and ' +
      'all analysis is generated algorithmically. Past performance is not indicative of future results. Investors ' +
      'should conduct their own research and consult with a qualified financial advisor before making any investment decisions.',
    
    zh:
      '本报告仅供参考，不构成投资建议、推荐或买卖任何证券的招揽。报告中包含的信息被认为是可靠的，但不保证其准确性或完整性。' +
      'USIS Brain v7.7 是一个 AI 驱动的研究系统，所有分析均由算法生成。过往表现不代表未来结果。投资者在做出任何投资决策之前，' +
      '应进行自己的研究并咨询合格的财务顾问。',
    
    es:
      'Este informe es solo con fines informativos y no constituye asesoramiento de inversión, una recomendación ' +
      'o una solicitud para comprar o vender valores. La información contenida en este documento se considera confiable, ' +
      'pero no se garantiza su exactitud o integridad. USIS Brain v7.7 es un sistema de investigación impulsado por IA ' +
      'y todos los análisis se generan algorítmicamente. El rendimiento pasado no es indicativo de resultados futuros. ' +
      'Los inversores deben realizar su propia investigación y consultar con un asesor financiero calificado antes de tomar decisiones de inversión.'
  };
  
  return texts[language] || texts['en'];
}

// ═══════════════════════════════════════════════════════════════
// 模块导出
// ═══════════════════════════════════════════════════════════════

module.exports = {
  generateReportPdfBuffer
};
