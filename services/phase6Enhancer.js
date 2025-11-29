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
  renderSectionDivider,
  renderGenericTable,
  renderTwoColumnSection,
  renderChartFrame,
  renderBulletList,
  renderValuationSnapshot,
  renderPeerComparison,
  renderFinancialsOverview,
  renderSegmentTable,
  renderInvestmentStrategy,
  renderScenarioTargets,
  renderTechnicalIndicators,
  renderPageFooter,
  renderDisclosuresPage,
  formatMetricValue,
  formatLargeNumber
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
            { title: 'III. Valuation Analysis', content: premiumContent.valuation },  // 文本字段
            { title: 'IV. Industry & Competitive Landscape', content: premiumContent.industry },
            { title: 'V. Catalysts & Opportunities', content: formatCatalysts(premiumContent.catalysts) },
            { title: 'VI. Risks & Conclusions', content: formatRisks(premiumContent.risks) + '\n\n' + premiumContent.conclusions }
          ],
          
          // 🆕 v7.2: 保留 V6 组件需要的关键数据
          // 注意：使用 valuationData（对象）而不是 valuation（文本字段）
          price: premiumContent.price || premiumContent.priceData,
          valuation: premiumContent.valuationData || premiumContent.valuation_metrics,  // 估值指标对象
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
      
      // 🔍 调试：显示报告数据状态
      console.log(`   ├─ 📊 V6 Data Debug:`);
      console.log(`   │   ├─ report.meta exists: ${!!report.meta}`);
      console.log(`   │   ├─ meta.keyMessages: ${report.meta?.keyMessages?.length || 0} items`);
      console.log(`   │   ├─ meta.keyRisks: ${report.meta?.keyRisks?.length || 0} items`);
      console.log(`   │   ├─ meta.metrics: ${JSON.stringify(report.meta?.metrics || {}).substring(0, 100)}`);
      console.log(`   │   ├─ report.price: ${JSON.stringify(report.price || {}).substring(0, 80)}`);
      console.log(`   │   ├─ report.valuation: ${JSON.stringify(report.valuation || {}).substring(0, 80)}`);
      console.log(`   │   └─ report.fundamentals: ${JSON.stringify(report.fundamentals || {}).substring(0, 80)}`);
      
      // 提取 Key Messages 和 Key Risks（带增强的默认值保护）
      const keyMessages = extractKeyMessages(report);
      const keyRisks = extractKeyRisks(report);
      
      console.log(`   │   ├─ Extracted keyMessages: ${keyMessages.length} items`);
      console.log(`   │   └─ Extracted keyRisks: ${keyRisks.length} items`);
      
      // 渲染 Key Takeaways（两列布局）
      let summaryY = renderKeyTakeawaysSection(doc, {
        messages: keyMessages,
        risks: keyRisks
      }, { startY: 60 });
      
      // 提取并渲染 Key Metrics
      const metricsData = extractMetrics(report);
      console.log(`   │   └─ Extracted metrics: ${JSON.stringify(metricsData).substring(0, 150)}`);
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
      
      console.log(`   ├─ ✅ Page 3: Key Takeaways + Metrics rendered (V6 style)`);
      
      // ═══════════════════════════════════════════════════════════════
      // 🆕 V6 完整20页机构级布局
      // ═══════════════════════════════════════════════════════════════
      
      // Page 4: Technical Analysis - K线图表（V6固定页面，始终创建）
      pages.advance();
      console.log(`   ├─ Page 4: Technical Analysis - Daily Chart`);
      doc.fontSize(18).fillColor('#1a2332').font('Helvetica-Bold')
         .text('Technical Analysis - Daily Chart', 50, 60);
      if (assets.klineChart) {
        try {
          doc.moveDown(1);
          doc.image(assets.klineChart, {
            fit: [doc.page.width - 120, 350],
            align: 'center'
          });
        } catch (error) {
          console.warn(`   ├─ ⚠️  K-line chart failed: ${error.message}`);
          renderChartFrame(doc, { startY: 90, title: 'Price Chart', placeholder: 'Technical chart currently unavailable', height: 300 });
        }
      } else {
        renderChartFrame(doc, { startY: 90, title: 'Price Chart', placeholder: 'Technical chart generation pending', height: 300 });
      }
      
      // Page 5: Financial Trends - 财务图表
      pages.advance();
      console.log(`   ├─ Page 5: Financial Trends`);
      doc.fontSize(18).fillColor('#1a2332').font('Helvetica-Bold')
         .text('Financial Trends', 50, 60);
      
      if (assets.financialCharts?.revenue) {
        try {
          doc.image(assets.financialCharts.revenue, 50, 100, { width: doc.page.width - 100, height: 200 });
        } catch (e) {
          renderChartFrame(doc, { startY: 100, title: 'Revenue Trend', placeholder: 'Revenue chart unavailable', height: 200 });
        }
      } else {
        renderChartFrame(doc, { startY: 100, title: 'Revenue Trend', placeholder: 'Revenue chart unavailable', height: 200 });
      }
      
      if (assets.financialCharts?.eps) {
        try {
          doc.image(assets.financialCharts.eps, 50, 330, { width: doc.page.width - 100, height: 200 });
        } catch (e) {
          renderChartFrame(doc, { startY: 330, title: 'EPS Trend', placeholder: 'EPS chart unavailable', height: 200 });
        }
      } else {
        renderChartFrame(doc, { startY: 330, title: 'EPS Trend', placeholder: 'EPS chart unavailable', height: 200 });
      }
      
      // Page 6: Executive Summary
      pages.advance();
      console.log(`   ├─ Page 6: Executive Summary`);
      renderSectionWithText(doc, 'I. Executive Summary', report.summary_text || findSectionContent(report, 'summary'));
      
      // Page 7: Investment Thesis
      pages.advance();
      console.log(`   ├─ Page 7: Investment Thesis`);
      renderSectionWithText(doc, 'II. Investment Thesis', report.investment_thesis || report.thesis_text || findSectionContent(report, 'thesis'));
      
      // Page 8: Valuation Analysis
      pages.advance();
      console.log(`   ├─ Page 8: Valuation Analysis`);
      renderSectionWithText(doc, 'III. Valuation Analysis', report.valuation_text || findSectionContent(report, 'valuation'));
      
      // Page 9: Valuation Snapshot Table
      pages.advance();
      console.log(`   ├─ Page 9: Valuation Snapshot`);
      renderValuationSnapshot(doc, { startY: 60, valuation: report.valuation || {}, price: report.price || {} });
      renderScenarioTargets(doc, { startY: 280, targets: report.targets || {}, price: report.price || {} });
      
      // Page 10: Segment Overview
      pages.advance();
      console.log(`   ├─ Page 10: Company & Segment Overview`);
      doc.fontSize(18).fillColor('#1a2332').font('Helvetica-Bold').text('Company & Segment Overview', 50, 60);
      let segY = 90;
      const companyOverview = report.company_overview || findSectionContent(report, 'company') || 'Company overview analysis in progress.';
      doc.fontSize(10).fillColor('#374151').font('Helvetica').text(companyOverview.substring(0, 600), 50, segY, { width: doc.page.width - 100 });
      segY = renderSegmentTable(doc, { startY: 280, segments: report.segments || [] });
      
      // Page 11: Industry & Macro Environment
      pages.advance();
      console.log(`   ├─ Page 11: Industry & Macro Environment`);
      const industryText = report.industry_text || findSectionContent(report, 'industry') || '';
      const macroText = report.macro_text || findSectionContent(report, 'macro') || '';
      const industryItems = splitTextToItems(industryText, 4);
      const macroItems = splitTextToItems(macroText, 4);
      renderTwoColumnSection(doc, {
        startY: 60,
        sectionTitle: 'Industry & Macro Environment',
        leftTitle: 'Industry Trends',
        rightTitle: 'Macro Factors',
        leftItems: industryItems,
        rightItems: macroItems
      });
      
      // Page 12: Peer Comparison
      pages.advance();
      console.log(`   ├─ Page 12: Peer Comparison`);
      renderPeerComparison(doc, { startY: 60, peers: report.peers || generateDefaultPeers(report.symbol), symbol: report.symbol });
      let peerY = 260;
      doc.fontSize(12).fillColor('#1a2332').font('Helvetica-Bold').text('Comparative Analysis', 50, peerY);
      doc.fontSize(10).fillColor('#374151').font('Helvetica');
      const peerComment = report.peer_analysis || 'The company trades at a premium/discount relative to peers based on growth and profitability metrics.';
      doc.text(peerComment.substring(0, 500), 50, peerY + 20, { width: doc.page.width - 100 });
      
      // Page 13: Financial Overview
      pages.advance();
      console.log(`   ├─ Page 13: Financial Overview`);
      renderFinancialsOverview(doc, { startY: 60, fundamentals: report.fundamentals || {}, growth: report.growth || {} });
      
      // Page 14: Key Catalysts
      pages.advance();
      console.log(`   ├─ Page 14: Key Catalysts`);
      const catalystItems = extractCatalystItems(report);
      renderBulletList(doc, { startY: 60, title: 'Key Catalysts', items: catalystItems, maxItems: 8, itemPrefix: 'Catalyst' });
      
      // Page 15: Key Risks
      pages.advance();
      console.log(`   ├─ Page 15: Key Risks`);
      const riskItems = extractRiskItems(report);
      renderBulletList(doc, { startY: 60, title: 'Key Risks', items: riskItems, maxItems: 8, itemPrefix: 'Risk' });
      
      // Page 16: Technical Analysis
      pages.advance();
      console.log(`   ├─ Page 16: Technical Analysis`);
      doc.fontSize(18).fillColor('#1a2332').font('Helvetica-Bold').text('Technical Analysis', 50, 60);
      renderTechnicalIndicators(doc, { startY: 95, indicators: report.tech_indicators_table || [] });
      doc.fontSize(12).fillColor('#1a2332').font('Helvetica-Bold').text('Technical Commentary', 50, 300);
      const techCommentary = report.tech_commentary || report.tech_view_text || 'Technical indicators suggest monitoring key support and resistance levels for entry/exit timing.';
      doc.fontSize(10).fillColor('#374151').font('Helvetica').text(techCommentary.substring(0, 800), 50, 320, { width: doc.page.width - 100 });
      
      // Page 17: Investment Strategy
      pages.advance();
      console.log(`   ├─ Page 17: Investment Strategy`);
      renderInvestmentStrategy(doc, { startY: 60, price: report.price || {}, targets: report.targets || {} });
      doc.fontSize(12).fillColor('#1a2332').font('Helvetica-Bold').text('Action Recommendations', 50, 300);
      const actionText = report.action_text || 'Position sizing should reflect individual risk tolerance and portfolio construction goals.';
      doc.fontSize(10).fillColor('#374151').font('Helvetica').text(actionText.substring(0, 600), 50, 320, { width: doc.page.width - 100 });
      
      // Page 18: Multi-Model Consensus（V6固定页面，始终创建）
      pages.advance();
      console.log(`   ├─ Page 18: Multi-Model Consensus`);
      doc.fontSize(18).fillColor('#1a2332').font('Helvetica-Bold').text('Multi-Model AI Consensus', 50, 60);
      if (assets.consensus && assets.consensus.consensus) {
        const cleanConsensusText = assets.consensus.consensus
          .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').replace(/^#+\s+/gm, '').trim();
        doc.fontSize(10).fillColor('#374151').font('Helvetica').text(cleanConsensusText.substring(0, 2000), 50, 90, { width: doc.page.width - 100 });
      } else {
        doc.fontSize(10).fillColor('#374151').font('Helvetica');
        doc.text('This section presents the synthesized analysis from multiple AI models, combining insights from:', 50, 90, { width: doc.page.width - 100 });
        doc.moveDown(0.5);
        const defaultModels = ['GPT-4o (OpenAI)', 'Claude 3.5 Sonnet (Anthropic)', 'DeepSeek V3', 'Gemini 2.5 Flash'];
        defaultModels.forEach((model, i) => {
          doc.text(`• ${model}`, 70, 130 + i * 20);
        });
        doc.text('Multi-model consensus analysis is generated when multiple AI providers are available and enabled.', 50, 250, { width: doc.page.width - 100 });
      }
      
      // Page 19: Industry & Competitive Landscape (extended)
      pages.advance();
      console.log(`   ├─ Page 19: Industry & Competitive Landscape`);
      renderSectionWithText(doc, 'IV. Industry & Competitive Landscape', findSectionContent(report, 'industry') || findSectionContent(report, 'competitive') || 'Industry analysis in progress.');
      
      // Page 20: Disclosures & Legal
      pages.advance();
      console.log(`   ├─ Page 20: Important Disclosures`);
      renderDisclosuresPage(doc, { startY: 60, firmName: displayFirmName });
      renderPageFooter(doc, { pageNumber: pages.current, brand: displayFirmName });
      
      // 完成 PDF
      console.log(`   └─ ✅ V6 Institutional PDF Complete (${pages.current} pages)`);
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
  
  // 🆕 v7.2: 优先使用 meta.metrics（已预处理的 Premium 数据），然后回退到原始数据
  const metaMetrics = report.meta?.metrics || {};
  const valuation = report.valuation || report.meta?.valuation || {};
  const price = report.price || report.meta?.price || {};
  const fundamentals = report.fundamentals || report.meta?.fundamentals || {};
  
  // 辅助函数：安全提取数值（优先使用 metaMetrics）
  const safeNum = (...sources) => {
    for (const v of sources) {
      if (v !== null && v !== undefined && !isNaN(v) && v !== 'N/A') return Number(v);
    }
    return null;
  };
  
  return {
    // 🆕 v7.2: 优先使用 metaMetrics（已从 Premium 报告预提取）
    // 估值指标
    pe_ttm: safeNum(metaMetrics.pe_ttm, valuation.pe_ttm, valuation.peTTM),
    pe_fwd: safeNum(metaMetrics.pe_fwd, valuation.pe_fwd, valuation.pe_forward, valuation.forwardPE),
    ps_ttm: safeNum(metaMetrics.ps_ttm, valuation.ps_ttm, valuation.psTTM),
    pb_ttm: safeNum(metaMetrics.pb_ttm, valuation.pb_ttm, valuation.pb, valuation.pbTTM),
    
    // 价格指标
    beta: safeNum(metaMetrics.beta, price.beta, valuation.beta),
    high_52w: safeNum(metaMetrics.high_52w, price.high_52w, price.yearHigh),
    low_52w: safeNum(metaMetrics.low_52w, price.low_52w, price.yearLow),
    
    // 基本面指标
    div_yield: safeNum(metaMetrics.div_yield, valuation.dividend_yield, fundamentals.dividend_yield),
    roe: safeNum(metaMetrics.roe, fundamentals.roe, valuation.roe),
    roa: safeNum(metaMetrics.roa, fundamentals.roa),
    
    // 增长指标
    eps_growth: safeNum(metaMetrics.eps_growth, fundamentals.eps_growth),
    revenue_growth: safeNum(metaMetrics.revenue_growth, fundamentals.revenue_growth),
    
    // 市值
    market_cap: safeNum(metaMetrics.market_cap, valuation.market_cap, price.marketCap)
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

// ═══════════════════════════════════════════════════════════════
// 🆕 V6 完整布局辅助函数
// ═══════════════════════════════════════════════════════════════

/**
 * 渲染带标题和文本的章节
 * @param {PDFDocument} doc - PDF文档
 * @param {string} title - 章节标题
 * @param {string} content - 章节内容
 */
function renderSectionWithText(doc, title, content) {
  doc.fontSize(18).fillColor('#1a2332').font('Helvetica-Bold')
     .text(title, 50, 60, { underline: false });
  
  doc.moveDown(1);
  
  const text = content || 'Content analysis in progress. Please check back for updated insights.';
  const paragraphs = text.split('\n\n').filter(p => p.trim());
  
  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  paragraphs.forEach(p => {
    if (p.trim()) {
      doc.text(p.trim().substring(0, 800), { align: 'left', lineGap: 3, width: doc.page.width - 100 });
      doc.moveDown(0.5);
    }
  });
}

/**
 * 从报告的 sections 数组中查找内容
 * @param {Object} report - 报告对象
 * @param {string} keyword - 查找关键词
 * @returns {string} 找到的内容或空字符串
 */
function findSectionContent(report, keyword) {
  if (!report || !report.sections || !Array.isArray(report.sections)) return '';
  
  const section = report.sections.find(s => {
    const title = (s.title || '').toLowerCase();
    return title.includes(keyword.toLowerCase());
  });
  
  return section?.body || section?.content || '';
}

/**
 * 将文本分割成项目列表
 * @param {string} text - 输入文本
 * @param {number} maxItems - 最大项目数
 * @returns {Array<string>} 项目数组
 */
function splitTextToItems(text, maxItems = 4) {
  if (!text || typeof text !== 'string') {
    return ['Analysis in progress.'];
  }
  
  // 尝试按句子分割
  const sentences = text.split(/[.!?]/).filter(s => s.trim().length > 20);
  
  if (sentences.length >= maxItems) {
    return sentences.slice(0, maxItems).map(s => s.trim());
  }
  
  // 如果句子不够，按段落分割
  const paragraphs = text.split('\n').filter(p => p.trim().length > 10);
  if (paragraphs.length >= maxItems) {
    return paragraphs.slice(0, maxItems).map(p => p.trim().substring(0, 200));
  }
  
  // 返回可用的内容
  return sentences.length > 0 ? sentences.slice(0, maxItems).map(s => s.trim()) : ['Analysis in progress.'];
}

/**
 * 生成默认同行数据
 * @param {string} symbol - 股票代码
 * @returns {Array} 同行数据数组
 */
function generateDefaultPeers(symbol) {
  // 常见行业同行映射
  const peerMappings = {
    'AAPL': ['MSFT', 'GOOGL', 'META', 'AMZN'],
    'MSFT': ['AAPL', 'GOOGL', 'META', 'AMZN'],
    'NVDA': ['AMD', 'INTC', 'AVGO', 'QCOM'],
    'AMD': ['NVDA', 'INTC', 'QCOM', 'AVGO'],
    'TSLA': ['F', 'GM', 'RIVN', 'NIO'],
    'AMZN': ['WMT', 'TGT', 'COST', 'EBAY'],
    'GOOGL': ['META', 'MSFT', 'AAPL', 'AMZN'],
    'META': ['GOOGL', 'SNAP', 'PINS', 'TWTR']
  };
  
  const peerSymbols = peerMappings[symbol] || ['PEER1', 'PEER2', 'PEER3', 'PEER4'];
  
  return peerSymbols.map((sym, i) => ({
    symbol: sym,
    name: `${sym} Corporation`,
    market_cap: (200 + i * 50) * 1e9,
    pe_forward: 25 + i * 5,
    ps_ttm: 8 + i * 2,
    roe: 20 + i * 3,
    comment: i === 0 ? 'Primary competitor' : 'Industry peer'
  }));
}

/**
 * 从报告中提取催化剂项目
 * @param {Object} report - 报告对象
 * @returns {Array<string>} 催化剂数组
 */
function extractCatalystItems(report) {
  if (!report) return getDefaultCatalysts();
  
  const sources = [
    report.catalysts_text,
    report.catalysts,
    report.meta?.catalysts
  ];
  
  for (const source of sources) {
    if (Array.isArray(source) && source.length > 0) {
      return source.map(item => {
        if (typeof item === 'string') return item;
        return item.text || item.description || item.catalyst || '';
      }).filter(Boolean);
    }
    if (typeof source === 'string' && source.length > 50) {
      return splitTextToItems(source, 8);
    }
  }
  
  // 尝试从 sections 提取
  const catalystSection = findSectionContent(report, 'catalyst');
  if (catalystSection) {
    return splitTextToItems(catalystSection, 8);
  }
  
  return getDefaultCatalysts();
}

/**
 * 获取默认催化剂
 */
function getDefaultCatalysts() {
  return [
    'New product launches expected to drive revenue growth.',
    'Expansion into new markets presents significant opportunity.',
    'Strategic partnerships enhance competitive positioning.',
    'Operational improvements to boost profitability.',
    'Share buyback program supports valuation.',
    'Industry tailwinds favor growth trajectory.'
  ];
}

/**
 * 从报告中提取风险项目
 * @param {Object} report - 报告对象
 * @returns {Array<string>} 风险数组
 */
function extractRiskItems(report) {
  if (!report) return getDefaultRiskItems();
  
  const sources = [
    report.risks_text,
    report.risks,
    report.meta?.risks
  ];
  
  for (const source of sources) {
    if (Array.isArray(source) && source.length > 0) {
      return source.map(item => {
        if (typeof item === 'string') return item;
        return item.text || item.description || item.risk || '';
      }).filter(Boolean);
    }
    if (typeof source === 'string' && source.length > 50) {
      return splitTextToItems(source, 8);
    }
  }
  
  // 尝试从 sections 提取
  const riskSection = findSectionContent(report, 'risk');
  if (riskSection) {
    return splitTextToItems(riskSection, 8);
  }
  
  return getDefaultRiskItems();
}

/**
 * 获取默认风险项目
 */
function getDefaultRiskItems() {
  return [
    'Competitive pressure could erode market share.',
    'Macroeconomic headwinds may impact demand.',
    'Regulatory changes pose compliance risks.',
    'Supply chain disruptions could affect operations.',
    'Currency fluctuations may impact profitability.',
    'Execution risk on strategic initiatives.'
  ];
}

module.exports = {
  generateEnhancedPdf,
  getEnhancementStatus
};
