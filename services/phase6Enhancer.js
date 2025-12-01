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
const { renderV6InstitutionalPdf, buildV6ReportData } = require('./v6Renderer'); // V6 20-page renderer (legacy PDFKit)
const { generateV6PdfWithPuppeteer } = require('./puppeteerPdfRenderer'); // V6 Puppeteer renderer
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
  console.log(`   └─ 👤 Analyst: ${analystName || 'USIS Brain v7.7 (default)'}\n`);
  
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
 * 渲染增强版 PDF（使用 Puppeteer + v3_dev HTML 模板）
 * V7.3: 改用 Puppeteer 渲染 v3_dev 的 20 页 HTML 模板（无水印）
 * @param {string} symbol - 股票代码
 * @param {string} language - 语言
 * @param {Object} assets - 生成的资源（图表、共识）- 暂时未使用，将来可扩展
 * @param {Object} options - 可选参数
 * @returns {Promise<Buffer>} PDF Buffer
 */
async function renderEnhancedPdf(symbol, language, assets, options) {
  const firmName = options.firm || options.firmName || 'USIS Research';
  const analystName = options.analyst || options.analystName || 'USIS Brain v7.7 Multi-AI System';
  
  console.log(`\n📄 [Phase6Enhancer] Using V6 Puppeteer HTML-to-PDF renderer...`);
  console.log(`   ├─ Firm: ${firmName}`);
  console.log(`   ├─ Analyst: ${analystName}`);
  console.log(`   └─ Template: v3_dev 20-page institutional HTML\n`);
  
  try {
    const pdfBuffer = await generateV6PdfWithPuppeteer(symbol, language, {
      firmName: firmName,
      analystName: analystName,
      assetType: 'equity'
    });
    
    return pdfBuffer;
    
  } catch (error) {
    console.error(`❌ [Phase6Enhancer] Puppeteer PDF failed: ${error.message}`);
    console.warn(`⚠️  [Phase6Enhancer] Falling back to legacy PDFKit renderer...`);
    
    return renderEnhancedPdfLegacy(symbol, language, assets, options);
  }
}

/**
 * Legacy PDFKit 渲染器（备用方案）
 * @deprecated 使用 renderEnhancedPdf (Puppeteer) 代替
 */
async function renderEnhancedPdfLegacy(symbol, language, assets, options) {
  const firmName = options.firm || options.firmName || null;
  const analystName = options.analyst || options.analystName || null;
  const displayFirmName = firmName || 'USIS Research';
  
  return new Promise(async (resolve, reject) => {
    try {
      console.log(`\n📄 [Phase6Enhancer Legacy] Using PDFKit V6 layout...`);
      
      let premiumContent;
      
      if (options.usePremium) {
        console.log(`   ├─ Fetching Premium content (v3_dev Engine)...`);
        premiumContent = await getPremiumContent(symbol, language, options);
        console.log(`   ├─ ✅ Premium content ready`);
      } else {
        console.log(`   ├─ Generating text report...`);
        const report = await generateFullTextReport(symbol, language, options);
        premiumContent = {
          symbol: report.symbol,
          name: report.name,
          rating: report.rating,
          targetPrice: report.targetPrice,
          summary: report.summary_text || report.sections?.find(s => s.title.includes('Summary'))?.content,
          thesis: report.investment_thesis || report.sections?.find(s => s.title.includes('Thesis'))?.content,
          valuation: report.valuation_text || report.sections?.find(s => s.title.includes('Valuation'))?.content,
          industry: report.industry_text || report.sections?.find(s => s.title.includes('Industry'))?.content,
          catalysts: report.catalysts || [],
          risks: report.risks || [],
          price: report.price,
          valuationData: report.valuation,
          fundamentals: report.fundamentals,
          growth: report.growth,
          segments: report.segments,
          peers: report.peers,
          targets: report.targets,
          meta: report.meta || { brand: displayFirmName, firm: displayFirmName, analyst: analystName || 'USIS Brain' }
        };
        console.log(`   ├─ ✅ Text report converted`);
      }
      
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 60, right: 60 },
        info: {
          Title: `${symbol} · V6 Institutional Equity Research Report`,
          Author: 'USIS Brain v7.7 Multi-AI Research System',
          Subject: `Institutional research report for ${symbol}`,
          Keywords: 'research, equity, analysis, institutional, V6',
          CreationDate: new Date()
        }
      });
      
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      renderV6InstitutionalPdf(doc, premiumContent, assets, {
        firmName: displayFirmName,
        analystName: analystName || premiumContent.meta?.analyst || 'USIS Brain'
      });
      
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
