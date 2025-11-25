/**
 * phase6Enhancer.js
 * 
 * Phase 6 集成器：将所有增强功能集成到现有 PDF 服务
 * 
 * 增强列表：
 * A. K线截图自动插入
 * B. 财务图表自动插入
 * C. 专业封面、页眉、页脚、目录
 * D. 多模型智囊团共识
 * 
 * 使用方式：
 * const { generateEnhancedPdf } = require('./services/phase6Enhancer');
 * const pdfBuffer = await generateEnhancedPdf('NVDA', 'en', { premium: true });
 */

const { generateReportPdfBuffer } = require('./reportPdfService');
const { generatePremiumPdf } = require('./reportPremiumService');
const { getDailyKlineImage } = require('./chartImageService');
const { generateAllFinancialCharts } = require('./financialChartService');
const { getMultiModelViews, consolidateConsensus } = require('./multiModelConsensus');
const { generateFullTextReport } = require('./reportTextService');
const { renderProfessionalCover, renderTableOfContents, extractSections } = require('./pdfTemplateUtils');
const { getPremiumContent } = require('./premiumContentBridge'); // Phase 7: Premium 桥接
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

/**
 * 生成增强版 PDF 研报
 * @param {string} symbol - 股票代码
 * @param {string} language - 语言（en/zh/es）
 * @param {Object} options - 可选参数
 * @param {boolean} options.premium - 是否使用 Premium 模式（DocRaptor）
 * @param {boolean} options.usePremium - 是否使用 v3_dev Premium 机构级内容（Phase 7）
 * @param {boolean} options.includeCharts - 是否包含图表（默认 true）
 * @param {boolean} options.includeConsensus - 是否包含多模型共识（默认 false）
 * @returns {Promise<Buffer>} PDF Buffer
 */
async function generateEnhancedPdf(symbol, language = 'en', options = {}) {
  const {
    premium = false,
    usePremium = false,
    includeCharts = true,
    includeConsensus = false
  } = options;
  
  console.log(`\n🚀 [Phase6Enhancer] Generating enhanced PDF`);
  console.log(`   ├─ Symbol: ${symbol}`);
  console.log(`   ├─ Language: ${language}`);
  console.log(`   ├─ Premium: ${premium}`);
  console.log(`   ├─ Use Premium Content: ${usePremium ? '✅ v3_dev Engine' : 'Standard'}`);
  console.log(`   ├─ Charts: ${includeCharts}`);
  console.log(`   └─ Consensus: ${includeConsensus}\n`);
  
  const startTime = Date.now();
  
  try {
    // ═══ STEP 1: 并行生成图表和共识（如果需要）═══
    const assets = {};
    
    if (includeCharts || includeConsensus) {
      console.log(`📊 [Phase6Enhancer] Generating additional assets...\n`);
      
      const assetPromises = [];
      
      // 图表生成
      if (includeCharts) {
        assetPromises.push(
          (async () => {
            try {
              console.log(`   ├─ Generating K-line chart...`);
              assets.klineChart = await getDailyKlineImage(symbol, { theme: 'light' });
              console.log(`   ├─ ${assets.klineChart ? '✅' : '⚠️ '} K-line chart`);
            } catch (error) {
              console.warn(`   ├─ ⚠️  K-line chart failed: ${error.message}`);
              assets.klineChart = null;
            }
          })(),
          (async () => {
            try {
              console.log(`   ├─ Generating financial charts...`);
              const charts = await generateAllFinancialCharts(symbol, { language });
              assets.financialCharts = charts;
              const count = Object.values(charts).filter(c => c !== null).length;
              console.log(`   ├─ ✅ ${count}/3 financial charts`);
            } catch (error) {
              console.warn(`   ├─ ⚠️  Financial charts failed: ${error.message}`);
              assets.financialCharts = { revenue: null, eps: null, margin: null };
            }
          })()
        );
      }
      
      // 多模型共识
      if (includeConsensus) {
        assetPromises.push(
          (async () => {
            try {
              console.log(`   ├─ Generating multi-model consensus...`);
              const models = await getMultiModelViews(symbol, language);
              assets.consensus = consolidateConsensus(models, language);
              console.log(`   ├─ ✅ Consensus: ${assets.consensus.rating}`);
            } catch (error) {
              console.warn(`   ├─ ⚠️  Consensus failed: ${error.message}`);
              assets.consensus = null;
            }
          })()
        );
      }
      
      // 等待所有资源生成
      await Promise.all(assetPromises);
      
      // Phase 7.1: 验证图表已准备好
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`✅ [Phase6Enhancer] Assets generation completed`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`[Phase7.1] Charts ready:`);
      console.log(`   ├─ K-line: ${assets.klineChart ? '✅ ' + (assets.klineChart.length / 1024).toFixed(2) + ' KB' : '❌ Missing'}`);
      console.log(`   ├─ Revenue: ${assets.financialCharts?.revenue ? '✅ ' + (assets.financialCharts.revenue.length / 1024).toFixed(2) + ' KB' : '❌ Missing'}`);
      console.log(`   ├─ EPS: ${assets.financialCharts?.eps ? '✅ ' + (assets.financialCharts.eps.length / 1024).toFixed(2) + ' KB' : '❌ Missing'}`);
      console.log(`   ├─ Margin: ${assets.financialCharts?.margin ? '✅ ' + (assets.financialCharts.margin.length / 1024).toFixed(2) + ' KB' : '❌ Missing'}`);
      console.log(`   └─ Consensus: ${assets.consensus ? '✅ ' + assets.consensus.rating : '❌ Missing'}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    }
    
    // ═══ STEP 2: 生成增强 PDF ═══
    console.log(`📄 [Phase6Enhancer] Generating enhanced PDF...\n`);
    
    let pdfBuffer;
    
    if (premium) {
      // Premium 模式：DocRaptor 暂不支持直接插入图表
      // 使用基础 Premium PDF，但添加警告
      console.warn(`⚠️  [Phase6Enhancer] Premium mode (DocRaptor) does not support chart insertion yet`);
      console.warn(`⚠️  [Phase6Enhancer] Falling back to standard Premium PDF`);
      pdfBuffer = await generatePremiumPdf(symbol, language, options);
    } else {
      // 基础模式：使用增强渲染器
      console.log(`   Using enhanced PDFKit renderer with charts and templates...\n`);
      pdfBuffer = await renderEnhancedPdf(symbol, language, assets, options);
    }
    
    const duration = Date.now() - startTime;
    const sizeKB = (pdfBuffer.length / 1024).toFixed(2);
    
    console.log(`\n✅ [Phase6Enhancer] Enhanced PDF generated successfully`);
    console.log(`   ├─ Size: ${sizeKB} KB`);
    console.log(`   ├─ Duration: ${duration} ms`);
    console.log(`   ├─ Charts: ${includeCharts ? 'Yes' : 'No'}`);
    console.log(`   └─ Consensus: ${includeConsensus ? 'Yes' : 'No'}\n`);
    
    return pdfBuffer;
    
  } catch (error) {
    console.error(`\n❌ [Phase6Enhancer] Enhanced PDF generation failed`);
    console.error(`   ├─ Symbol: ${symbol}`);
    console.error(`   ├─ Error: ${error.message}`);
    console.error(`   └─ Stack: ${error.stack.substring(0, 300)}...\n`);
    throw error;
  }
}

/**
 * 渲染增强版 PDF（使用 PDFKit + Phase 6 增强）
 * @param {string} symbol - 股票代码
 * @param {string} language - 语言
 * @param {Object} assets - 生成的资源（图表、共识）
 * @param {Object} options - 可选参数
 * @returns {Promise<Buffer>} PDF Buffer
 */
async function renderEnhancedPdf(symbol, language, assets, options) {
  return new Promise(async (resolve, reject) => {
    try {
      // Step 1: 生成文本报告
      let report;
      
      if (options.usePremium) {
        // Phase 7: 使用 Premium 机构级内容
        console.log(`   ├─ Fetching Premium content (v3_dev Engine)...`);
        const premiumContent = await getPremiumContent(symbol, language, options);
        
        // 转换 Premium 内容为标准报告格式
        report = {
          symbol: premiumContent.symbol,
          name: premiumContent.name,
          rating: premiumContent.rating,
          targetPrice: premiumContent.targetPrice,
          analyst: premiumContent.analyst,
          date: premiumContent.date,
          sections: [
            { title: 'I. Executive Summary', content: premiumContent.summary },
            { title: 'II. Investment Thesis', content: premiumContent.thesis },
            { title: 'III. Valuation Analysis', content: premiumContent.valuation },
            { title: 'IV. Industry & Competitive Landscape', content: premiumContent.industry },
            { title: 'V. Catalysts & Opportunities', content: formatCatalysts(premiumContent.catalysts) },
            { title: 'VI. Risks & Conclusions', content: formatRisks(premiumContent.risks) + '\n\n' + premiumContent.conclusions }
          ],
          meta: premiumContent.meta
        };
        console.log(`   ├─ ✅ Premium report ready (${report.sections.length} sections, v3_dev)`);
      } else {
        // 标准模式：使用基础文本报告服务
        console.log(`   ├─ Generating text report...`);
        report = await generateFullTextReport(symbol, language, options);
        console.log(`   ├─ ✅ Text report ready (${report.sections.length} sections)`);
      }
      
      // Step 2: 创建 PDF 文档
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 60, right: 60 },
        info: {
          Title: `${symbol} · Enhanced Equity Research Report`,
          Author: 'USIS Brain v7.0 Multi-AI Research System (Phase 6)',
          Subject: `Institutional research report for ${symbol}`,
          Keywords: 'research, equity, analysis, institutional, enhanced',
          CreationDate: new Date()
        }
      });
      
      // Buffer 收集器
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      // 使用内置字体（最安全的选择）
      // 注意：自定义 CJK 字体可选，当前使用 Helvetica 避免缺失字体导致崩溃
      const hasFonts = false; // 禁用自定义字体以确保稳定性
      
      // Step 3: 渲染专业封面
      console.log(`   ├─ Rendering professional cover...`);
      renderProfessionalCover(doc, report, {
        backgroundColor: '#1a2332',
        accentColor: '#3b82f6',
        textColor: '#ffffff'
      });
      
      // Step 4: 渲染目录
      console.log(`   ├─ Rendering table of contents...`);
      const sections = extractSections(report);
      renderTableOfContents(doc, sections);
      
      // Step 5: 插入 K线图表（如果有）
      if (assets.klineChart) {
        console.log(`   ├─ Inserting K-line chart...`);
        try {
          doc.fontSize(18).fillColor('#1a2332').font(hasFonts ? 'Bold' : 'Helvetica-Bold')
             .text('Technical Analysis - Daily Chart', 50, 100);
          doc.moveDown(1);
          
          doc.image(assets.klineChart, {
            fit: [doc.page.width - 120, 350],
            align: 'center'
          });
          
          doc.addPage();
          console.log(`   ├─ ✅ K-line chart inserted`);
        } catch (error) {
          console.warn(`   ├─ ⚠️  K-line chart insertion failed: ${error.message}`);
        }
      }
      
      // Step 6: 插入财务图表（如果有）
      if (assets.financialCharts) {
        const { revenue, eps, margin } = assets.financialCharts;
        
        if (revenue || eps || margin) {
          console.log(`   ├─ Inserting financial charts...`);
          doc.fontSize(18).fillColor('#1a2332').font(hasFonts ? 'Bold' : 'Helvetica-Bold')
             .text('Financial Trends', 50, 100);
          doc.moveDown(1);
          
          let chartY = doc.y;
          
          if (revenue) {
            try {
              doc.image(revenue, 50, chartY, { width: doc.page.width - 100 });
              chartY += 220;
              console.log(`   ├─ ✅ Revenue chart inserted`);
            } catch (error) {
              console.warn(`   ├─ ⚠️  Revenue chart failed: ${error.message}`);
            }
          }
          
          if (eps && chartY < doc.page.height - 300) {
            try {
              doc.image(eps, 50, chartY, { width: doc.page.width - 100 });
              console.log(`   ├─ ✅ EPS chart inserted`);
            } catch (error) {
              console.warn(`   ├─ ⚠️  EPS chart failed: ${error.message}`);
            }
          } else if (eps) {
            doc.addPage();
            try {
              doc.image(eps, 50, 100, { width: doc.page.width - 100 });
              console.log(`   ├─ ✅ EPS chart inserted (new page)`);
            } catch (error) {
              console.warn(`   ├─ ⚠️  EPS chart failed: ${error.message}`);
            }
          }
          
          if (margin) {
            doc.addPage();
            try {
              doc.image(margin, 50, 100, { width: doc.page.width - 100 });
              console.log(`   ├─ ✅ Margin chart inserted`);
            } catch (error) {
              console.warn(`   ├─ ⚠️  Margin chart failed: ${error.message}`);
            }
          }
          
          doc.addPage();
        }
      }
      
      // Step 7: 渲染报告章节
      console.log(`   ├─ Rendering report sections...`);
      report.sections.forEach((section, index) => {
        doc.fontSize(18).fillColor('#1a2332').font(hasFonts ? 'Bold' : 'Helvetica-Bold')
           .text(section.title, 50, 100, { underline: false });
        
        doc.moveDown(1);
        
        doc.fontSize(11).fillColor('#333333').font(hasFonts ? 'Regular' : 'Helvetica');
        
        const paragraphs = section.body.split('\n\n');
        paragraphs.forEach(p => {
          if (p.trim()) {
            doc.text(p.trim(), { align: 'left', lineGap: 3 });
            doc.moveDown(0.5);
          }
        });
        
        if (index < report.sections.length - 1) {
          doc.addPage();
        }
      });
      
      // Step 8: 插入多模型共识（如果有）
      if (assets.consensus) {
        console.log(`   ├─ Inserting multi-model consensus...`);
        doc.addPage();
        
        doc.fontSize(20).fillColor('#1a2332').font(hasFonts ? 'Bold' : 'Helvetica-Bold')
           .text('VII. Multi-Model Consensus', 50, 100);
        
        doc.moveDown(1);
        
        // 移除 Markdown 格式化标记
        const cleanConsensusText = assets.consensus.consensus
          .replace(/\*\*([^*]+)\*\*/g, '$1')  // 移除 **bold**
          .replace(/\*([^*]+)\*/g, '$1')      // 移除 *italic*
          .replace(/^#+\s+/gm, '')            // 移除 # headers
          .trim();
        
        doc.fontSize(12).fillColor('#333333').font(hasFonts ? 'Regular' : 'Helvetica')
           .text(cleanConsensusText, { align: 'left', lineGap: 5 });
        
        console.log(`   ├─ ✅ Consensus section inserted`);
      }
      
      // Step 9: 完成 PDF
      console.log(`   └─ Finalizing PDF...`);
      doc.end();
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 获取增强功能状态
 * @returns {Object} 状态信息
 */
function getEnhancementStatus() {
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasDeepSeek = !!process.env.DEEPSEEK_API_KEY;
  const hasTwelveData = !!process.env.TWELVE_DATA_API_KEY;
  const hasFinnhub = !!process.env.FINNHUB_API_KEY;
  
  return {
    version: 'Phase 6 - Flagship PDF Enhancements',
    features: {
      klineCharts: {
        available: true,
        provider: 'Browserless + TradingView',
        description: 'Auto-insert K-line charts into PDF'
      },
      financialCharts: {
        available: hasTwelveData || hasFinnhub,
        provider: 'QuickChart + FinancialDataBroker',
        description: 'Revenue, EPS, Margin charts',
        dataSource: hasTwelveData ? 'Twelve Data' : hasFinnhub ? 'Finnhub' : 'None'
      },
      professionalTemplate: {
        available: true,
        features: ['Cover page', 'Table of contents', 'Header/footer', 'Page numbers'],
        description: 'Morgan Stanley/Goldman Sachs level templates'
      },
      multiModelConsensus: {
        available: hasOpenAI || hasAnthropic || hasDeepSeek,
        models: [
          hasOpenAI ? 'GPT-4o-mini' : null,
          hasAnthropic ? 'Claude 3.5' : null,
          hasDeepSeek ? 'DeepSeek V3' : null
        ].filter(Boolean),
        description: 'Multi-AI model voting and consensus'
      }
    },
    apiKeys: {
      openai: hasOpenAI,
      anthropic: hasAnthropic,
      deepseek: hasDeepSeek,
      twelveData: hasTwelveData,
      finnhub: hasFinnhub
    }
  };
}

/**
 * 格式化催化剂数组为文本 (Phase 7)
 * @param {Array} catalysts - 催化剂数组
 * @returns {string} 格式化后的文本
 */
function formatCatalysts(catalysts) {
  if (!Array.isArray(catalysts) || catalysts.length === 0) {
    return 'Key catalysts include upcoming product launches, market expansion opportunities, and operational improvements.';
  }
  
  return catalysts.map((cat, idx) => {
    const text = typeof cat === 'string' ? cat : cat.text || '';
    const impact = cat.impact ? ` (Impact: ${cat.impact})` : '';
    return `${idx + 1}. ${text}${impact}`;
  }).join('\n\n');
}

/**
 * 格式化风险数组为文本 (Phase 7)
 * @param {Array} risks - 风险数组
 * @returns {string} 格式化后的文本
 */
function formatRisks(risks) {
  if (!Array.isArray(risks) || risks.length === 0) {
    return 'Key risks include competitive pressures, regulatory changes, and macroeconomic conditions.';
  }
  
  return risks.map((risk, idx) => {
    const text = typeof risk === 'string' ? risk : risk.text || '';
    const severity = risk.severity ? ` (Severity: ${risk.severity})` : '';
    return `${idx + 1}. ${text}${severity}`;
  }).join('\n\n');
}

module.exports = {
  generateEnhancedPdf,
  getEnhancementStatus
};
