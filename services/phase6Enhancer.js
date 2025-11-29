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
const { 
  renderProfessionalCover, 
  renderTableOfContents, 
  extractSections, 
  renderInstitutionalHeader,
  renderKeyTakeawaysSection,
  renderKeyMetricsRow,
  renderConsensusTable,
  renderSectionDivider
} = require('./pdfTemplateUtils');
const { getPremiumContent } = require('./premiumContentBridge'); // Phase 7: Premium 桥接
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// ═══════════════════════════════════════════════════════════════
// 🆕 v7.2: 集中化页码管理控制器
// ═══════════════════════════════════════════════════════════════

/**
 * 创建页码控制器 - 统一管理所有分页和页眉渲染
 * @param {PDFDocument} doc - PDFKit 文档对象
 * @param {Object} options - 配置选项
 * @returns {Object} 页码控制器
 */
function createPageController(doc, options = {}) {
  const { firmName = 'USIS Research', initialPage = 1 } = options;
  let currentPage = initialPage;
  
  return {
    /** 获取当前页码 */
    get current() { return currentPage; },
    
    /** 设置当前页码（用于同步外部页码，如 TOC 溢出）*/
    set(pageNum) { currentPage = pageNum; },
    
    /** 仅渲染页眉（不创建新页面）*/
    syncHeader(opts = {}) {
      const { pageNum = currentPage, skipHeader = false } = opts;
      if (!skipHeader) {
        renderInstitutionalHeader(doc, { firmName, pageNumber: pageNum });
      }
    },
    
    /** 创建新页面并渲染页眉 */
    advance(opts = {}) {
      const { skipHeader = false } = opts;
      doc.addPage();
      currentPage++;
      if (!skipHeader) {
        renderInstitutionalHeader(doc, { firmName, pageNumber: currentPage });
      }
      return currentPage;
    },
    
    /** 仅递增页码（页面已通过其他方式创建）*/
    increment() {
      currentPage++;
      return currentPage;
    }
  };
}

/**
 * 生成增强版 PDF 研报
 * @param {string} symbol - 股票代码
 * @param {string} language - 语言（en/zh/es）
 * @param {Object} options - 可选参数
 * @param {boolean} options.premium - 是否使用 Premium 模式（DocRaptor）
 * @param {boolean} options.usePremium - 是否使用 v3_dev Premium 机构级内容（Phase 7）
 * @param {boolean} options.includeCharts - 是否包含图表（默认 true）
 * @param {boolean} options.includeConsensus - 是否包含多模型共识（默认 false）
 * @param {string} options.firmName - 自定义机构名（v7.2+）
 * @param {string} options.analystName - 自定义分析师名（v7.2+）
 * @returns {Promise<Buffer>} PDF Buffer
 */
async function generateEnhancedPdf(symbol, language = 'en', options = {}) {
  const {
    premium = false,
    usePremium = false,
    includeCharts = true,
    includeConsensus = false,
    firm = null,        // 🆕 v7.2: 自定义机构名（与 report-bot 保持一致）
    analyst = null      // 🆕 v7.2: 自定义分析师名
  } = options;
  
  // 别名支持：firmName/analystName 也可以使用
  const firmName = firm || options.firmName || null;
  const analystName = analyst || options.analystName || null;
  
  console.log(`\n🚀 [Phase6Enhancer] Generating enhanced PDF v7.2`);
  console.log(`   ├─ Symbol: ${symbol}`);
  console.log(`   ├─ Language: ${language}`);
  console.log(`   ├─ Premium: ${premium}`);
  console.log(`   ├─ Use Premium Content: ${usePremium ? '✅ v3_dev Engine' : 'Standard'}`);
  console.log(`   ├─ Charts: ${includeCharts}`);
  console.log(`   ├─ Consensus: ${includeConsensus}`);
  console.log(`   ├─ 🏢 Firm: ${firmName || 'USIS Research (default)'}`);
  console.log(`   └─ 👤 Analyst: ${analystName || 'USIS Brain v7.0 (default)'}\n`);
  
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
  // 🆕 v7.2: 提取自定义参数
  const firmName = options.firm || options.firmName || null;
  const analystName = options.analyst || options.analystName || null;
  const displayFirmName = firmName || 'USIS Research';
  
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
          target_price: premiumContent.targetPrice, // 兼容两种命名
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
          
          // 🆕 v7.2: 保留 V6 组件需要的关键数据
          price: premiumContent.price || premiumContent.priceData,
          valuation: premiumContent.valuation || premiumContent.valuation_metrics,
          fundamentals: premiumContent.fundamentals,
          catalysts: premiumContent.catalysts,
          risks: premiumContent.risks,
          summary_text: premiumContent.summary,
          investment_thesis: premiumContent.thesis,
          
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
      
      // Step 3: 渲染专业封面（支持自定义机构名/分析师名）
      console.log(`   ├─ Rendering professional cover...`);
      renderProfessionalCover(doc, report, {
        backgroundColor: '#1a2332',
        accentColor: '#3b82f6',
        textColor: '#ffffff',
        firmName: firmName,
        analystName: analystName
      });
      
      // 🆕 v7.2: 使用集中化页码控制器
      const pages = createPageController(doc, { firmName: displayFirmName, initialPage: 1 });
      
      // Step 4: 渲染目录
      console.log(`   ├─ Rendering table of contents...`);
      pages.increment(); // 目录页 = 第2页
      pages.syncHeader(); // 渲染目录页眉
      
      const sections = extractSections(report);
      const tocResult = renderTableOfContents(doc, sections, { firmName: displayFirmName, pageNumber: pages.current });
      
      // 同步页码（处理 TOC 溢出的情况）
      if (tocResult && tocResult.finalPageNumber) {
        pages.set(tocResult.finalPageNumber);
      }
      
      // ═══════════════════════════════════════════════════════════════
      // 🆕 v7.2: 插入 V6 风格的机构级摘要页（Key Takeaways + Key Metrics）
      // ═══════════════════════════════════════════════════════════════
      pages.advance(); // 创建新页面 + 渲染页眉
      
      // 提取 Key Messages 和 Key Risks（带增强的默认值保护）
      const keyMessages = extractKeyMessages(report);
      const keyRisks = extractKeyRisks(report);
      
      // 渲染 Key Takeaways（两列布局）
      let summaryY = renderKeyTakeawaysSection(doc, {
        messages: keyMessages,
        risks: keyRisks
      }, { startY: 60 });
      
      // 提取并渲染 Key Metrics
      const metricsData = extractMetrics(report);
      summaryY = renderKeyMetricsRow(doc, metricsData, { startY: summaryY + 20 });
      
      // 🆕 v7.2: 仅在有真实数据时渲染 Our View vs Consensus
      // 需要同时满足：1) 有评级或目标价 2) 至少有一个关键指标有值
      const ourRating = report?.rating;
      const ourTarget = report?.target_price || report?.targetPrice || report?.meta?.targetPrice;
      const ourRoe = metricsData?.roe;
      const ourEpsGrowth = metricsData?.eps_growth;
      
      // 检查是否有任何实质性的 "Our View" 数据
      const hasOurViewData = ourRating || ourTarget || ourRoe !== null || ourEpsGrowth !== null;
      
      if (hasOurViewData) {
        const consensusData = {
          ourView: {
            rating: ourRating || null,
            targetPrice: ourTarget || null,
            roe: ourRoe,
            epsGrowth: ourEpsGrowth
          },
          consensus: { rating: 'N/A', targetPrice: 'N/A', roe: 'N/A', epsGrowth: 'N/A' }
        };
        renderConsensusTable(doc, consensusData, { startY: summaryY + 10 });
      }
      
      console.log(`   ├─ ✅ Institutional summary page rendered (V6 style)`);
      
      // Step 5: 插入 K线图表（如果有）
      if (assets.klineChart) {
        pages.advance(); // 创建新页面 + 渲染页眉
        console.log(`   ├─ Inserting K-line chart...`);
        try {
          doc.fontSize(18).fillColor('#1a2332').font(hasFonts ? 'Bold' : 'Helvetica-Bold')
             .text('Technical Analysis - Daily Chart', 50, 60);
          doc.moveDown(1);
          
          doc.image(assets.klineChart, {
            fit: [doc.page.width - 120, 350],
            align: 'center'
          });
          console.log(`   ├─ ✅ K-line chart inserted`);
        } catch (error) {
          console.warn(`   ├─ ⚠️  K-line chart insertion failed: ${error.message}`);
        }
      }
      
      // Step 6: 插入财务图表（如果有）
      if (assets.financialCharts) {
        const { revenue, eps, margin } = assets.financialCharts;
        
        if (revenue || eps || margin) {
          pages.advance(); // 创建新页面 + 渲染页眉
          console.log(`   ├─ Inserting financial charts...`);
          
          doc.fontSize(18).fillColor('#1a2332').font(hasFonts ? 'Bold' : 'Helvetica-Bold')
             .text('Financial Trends', 50, 60);
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
            pages.advance(); // 使用页码控制器
            try {
              doc.image(eps, 50, 60, { width: doc.page.width - 100 });
              console.log(`   ├─ ✅ EPS chart inserted (new page)`);
            } catch (error) {
              console.warn(`   ├─ ⚠️  EPS chart failed: ${error.message}`);
            }
          }
          
          if (margin) {
            pages.advance(); // 使用页码控制器
            try {
              doc.image(margin, 50, 60, { width: doc.page.width - 100 });
              console.log(`   ├─ ✅ Margin chart inserted`);
            } catch (error) {
              console.warn(`   ├─ ⚠️  Margin chart failed: ${error.message}`);
            }
          }
        }
      }
      
      // Step 7: 渲染报告章节（每页添加机构页眉）
      console.log(`   ├─ Rendering report sections...`);
      report.sections.forEach((section, index) => {
        pages.advance(); // 使用页码控制器创建新页面 + 渲染页眉
        
        doc.fontSize(18).fillColor('#1a2332').font(hasFonts ? 'Bold' : 'Helvetica-Bold')
           .text(section.title || 'Section', 50, 60, { underline: false });
        
        doc.moveDown(1);
        
        doc.fontSize(11).fillColor('#333333').font(hasFonts ? 'Regular' : 'Helvetica');
        
        // 🆕 v7.2: 兼容 section.body 和 section.content（不同生成器使用不同字段名）
        const sectionContent = section.body || section.content || '';
        const paragraphs = sectionContent.split('\n\n');
        paragraphs.forEach(p => {
          if (p.trim()) {
            doc.text(p.trim(), { align: 'left', lineGap: 3 });
            doc.moveDown(0.5);
          }
        });
      });
      
      // Step 8: 插入多模型共识（如果有）
      if (assets.consensus) {
        console.log(`   ├─ Inserting multi-model consensus...`);
        pages.advance(); // 使用页码控制器
        
        doc.fontSize(20).fillColor('#1a2332').font(hasFonts ? 'Bold' : 'Helvetica-Bold')
           .text('VII. Multi-Model Consensus', 50, 60);
        
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

// ═══════════════════════════════════════════════════════════════
// 🆕 v7.2: V6 风格数据提取辅助函数
// ═══════════════════════════════════════════════════════════════

/**
 * 从报告中提取 Key Messages
 * @param {Object} report - 报告对象
 * @returns {Array<string>} Key Messages 数组
 */
function extractKeyMessages(report) {
  if (!report) return getDefaultKeyMessages();
  
  const messages = [];
  
  // 🆕 v7.2: 首先尝试从 meta.keyMessages 提取（Premium 报告）
  const metaMessages = report.meta?.keyMessages || report.keyMessages;
  if (Array.isArray(metaMessages) && metaMessages.length > 0) {
    messages.push(...metaMessages.slice(0, 4));
    return messages;
  }
  
  // 从 summary_text 提取
  if (report.summary_text) {
    const summaryLines = report.summary_text.split(/[.!?]/).filter(s => s.trim().length > 20);
    messages.push(...summaryLines.slice(0, 2).map(s => s.trim()));
  }
  
  // 从 investment_thesis 提取关键句
  if (report.investment_thesis) {
    const thesisLines = report.investment_thesis.split(/[.!?]/).filter(s => s.trim().length > 30);
    if (thesisLines.length > 0) {
      messages.push(thesisLines[0].trim());
    }
  }
  
  // 🆕 v7.2: 从 sections 中提取（标准报告 fallback）
  if (messages.length === 0 && report.sections && Array.isArray(report.sections)) {
    const execSummary = report.sections.find(s => 
      s.title?.toLowerCase().includes('executive') || 
      s.title?.toLowerCase().includes('summary') ||
      s.title?.toLowerCase().includes('thesis')
    );
    if (execSummary?.body) {
      const lines = execSummary.body.split(/[.!?]/).filter(s => s.trim().length > 30);
      messages.push(...lines.slice(0, 3).map(s => s.trim()));
    }
  }
  
  // 从 catalysts 提取
  const catalysts = report.catalysts || report.meta?.catalysts;
  if (catalysts && Array.isArray(catalysts)) {
    catalysts.slice(0, 2).forEach(cat => {
      const text = typeof cat === 'string' ? cat : cat.text || cat.description || '';
      if (text) messages.push(text);
    });
  }
  
  // 添加评级和目标价信息
  if (report.rating && report.symbol) {
    const price = report.price?.last || report.meta?.price?.last || report.currentPrice;
    const target = report.target_price || report.targetPrice || report.meta?.targetPrice;
    if (price && target) {
      const upside = ((target - price) / price * 100).toFixed(1);
      messages.unshift(`${report.symbol} is rated ${report.rating} with a target of $${target} (${upside}% ${upside > 0 ? 'upside' : 'downside'}).`);
    }
  }
  
  // 确保至少有一些默认消息
  if (messages.length === 0) {
    return getDefaultKeyMessages();
  }
  
  return messages.slice(0, 4);
}

/**
 * 获取默认 Key Messages
 */
function getDefaultKeyMessages() {
  return [
    'Strong market position with competitive advantages.',
    'Solid financial fundamentals and growth trajectory.',
    'Favorable industry dynamics support outlook.',
    'Management executing on strategic priorities.'
  ];
}

/**
 * 从报告中提取 Key Risks
 * @param {Object} report - 报告对象
 * @returns {Array<string>} Key Risks 数组
 */
function extractKeyRisks(report) {
  if (!report) return getDefaultKeyRisks();
  
  const risks = [];
  
  // 🆕 v7.2: 首先尝试从 meta.keyRisks 提取（Premium 报告）
  const metaRisks = report.meta?.keyRisks || report.keyRisks;
  if (Array.isArray(metaRisks) && metaRisks.length > 0) {
    metaRisks.slice(0, 4).forEach(risk => {
      const text = typeof risk === 'string' ? risk : risk.text || risk.description || '';
      if (text) risks.push(text);
    });
    if (risks.length > 0) return risks;
  }
  
  // 从 risks_text 或 risks 数组提取
  const riskSource = report.risks_text || report.risks || report.meta?.risks || [];
  
  if (Array.isArray(riskSource)) {
    riskSource.slice(0, 4).forEach(risk => {
      const text = typeof risk === 'string' ? risk : risk.text || risk.description || '';
      if (text) risks.push(text);
    });
  } else if (typeof riskSource === 'string') {
    const riskLines = riskSource.split(/[.!?]/).filter(s => s.trim().length > 20);
    risks.push(...riskLines.slice(0, 4).map(s => s.trim()));
  }
  
  // 🆕 v7.2: 从 sections 中提取（标准报告 fallback）
  if (risks.length === 0 && report.sections && Array.isArray(report.sections)) {
    const riskSection = report.sections.find(s => 
      s.title?.toLowerCase().includes('risk') ||
      s.title?.toLowerCase().includes('concern')
    );
    if (riskSection?.body) {
      const lines = riskSection.body.split(/[.!?]/).filter(s => s.trim().length > 20);
      risks.push(...lines.slice(0, 4).map(s => s.trim()));
    }
  }
  
  // 如果没有风险数据，添加默认风险
  if (risks.length === 0) {
    return getDefaultKeyRisks();
  }
  
  return risks.slice(0, 4);
}

/**
 * 获取默认 Key Risks
 */
function getDefaultKeyRisks() {
  return [
    'Competitive pressure could impact market share and margins.',
    'Macroeconomic conditions may affect demand.',
    'Regulatory changes pose potential compliance risks.',
    'Execution risk on strategic initiatives.'
  ];
}

/**
 * 从报告中提取关键指标
 * @param {Object} report - 报告对象
 * @returns {Object} 指标对象
 */
function extractMetrics(report) {
  if (!report) return getDefaultMetrics();
  
  // 🆕 v7.2: 使用可选链安全访问嵌套属性
  const valuation = report.valuation || report.meta?.valuation || {};
  const price = report.price || report.meta?.price || {};
  const fundamentals = report.fundamentals || report.meta?.fundamentals || {};
  const metaMetrics = report.meta?.metrics || {};
  
  // 辅助函数：安全提取数值
  const safeNum = (...sources) => {
    for (const v of sources) {
      if (v !== null && v !== undefined && !isNaN(v)) return v;
    }
    return null;
  };
  
  return {
    // 估值指标
    pe_ttm: safeNum(valuation.pe_ttm, valuation.peTTM, metaMetrics.pe_ttm),
    pe_fwd: safeNum(valuation.pe_fwd, valuation.peFwd, valuation.forwardPE, metaMetrics.pe_fwd),
    ps_ttm: safeNum(valuation.ps_ttm, valuation.psTTM, metaMetrics.ps_ttm),
    pb_ttm: safeNum(valuation.pb_ttm, valuation.pbTTM, metaMetrics.pb_ttm),
    
    // 价格指标
    beta: safeNum(price.beta, valuation.beta, metaMetrics.beta),
    high_52w: safeNum(price.high_52w, price.yearHigh, metaMetrics.high_52w),
    low_52w: safeNum(price.low_52w, price.yearLow, metaMetrics.low_52w),
    
    // 基本面指标
    div_yield: safeNum(fundamentals.dividend_yield, valuation.dividendYield, metaMetrics.div_yield),
    roe: safeNum(fundamentals.roe, valuation.roe, metaMetrics.roe),
    roa: safeNum(fundamentals.roa, metaMetrics.roa),
    
    // 增长指标
    eps_growth: safeNum(fundamentals.eps_growth, metaMetrics.eps_growth),
    revenue_growth: safeNum(fundamentals.revenue_growth, metaMetrics.revenue_growth),
    
    // 市值
    market_cap: safeNum(valuation.market_cap, price.marketCap, metaMetrics.market_cap)
  };
}

/**
 * 获取默认指标（全部为 null）
 */
function getDefaultMetrics() {
  return {
    pe_ttm: null, pe_fwd: null, ps_ttm: null, pb_ttm: null,
    beta: null, high_52w: null, low_52w: null,
    div_yield: null, roe: null, roa: null,
    eps_growth: null, revenue_growth: null, market_cap: null
  };
}

module.exports = {
  generateEnhancedPdf,
  getEnhancementStatus
};
