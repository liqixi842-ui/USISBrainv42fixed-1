/**
 * V6 Institutional PDF Renderer
 * Exact 20-page structure matching v3_dev/services/reportService.js
 * Uses PDFKit instead of DocRaptor for watermark-free output
 */

const {
  renderProfessionalCover,
  renderInstitutionalHeader,
  renderKeyTakeawaysSection,
  renderKeyMetricsRow,
  renderConsensusTable,
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

/**
 * Build V6-compatible report data from premium content
 * Complete schema matching v3_dev/services/reportService.js requirements
 */
function buildV6ReportData(premiumContent, options = {}) {
  const pc = premiumContent || {};
  const meta = pc.meta || {};
  
  return {
    symbol: pc.symbol || 'N/A',
    name: pc.name || pc.symbol || 'Unknown Company',
    rating: pc.rating || 'HOLD',
    horizon: pc.horizon || '12M',
    
    meta: {
      brand: options.firmName || meta.brand || 'USIS Research',
      firm: options.firmName || meta.firm || 'USIS Research',
      analyst: options.analystName || meta.analyst || 'USIS Brain v7.0',
      generated_at: meta.generated_at || new Date().toISOString(),
      version: meta.version || 'V6.0',
      model: meta.model || 'Multi-AI System',
      reportDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    },
    
    price: {
      last: pc.price?.last || pc.priceData?.last || null,
      change_pct: pc.price?.change_pct || pc.priceData?.change_pct || 0,
      change_abs: pc.price?.change_abs || pc.priceData?.change_abs || 0,
      high_52w: pc.price?.high_52w || pc.priceData?.high_52w || null,
      low_52w: pc.price?.low_52w || pc.priceData?.low_52w || null,
      beta: pc.price?.beta || pc.priceData?.beta || null,
      avg_volume: pc.price?.avg_volume || pc.priceData?.avg_volume || null
    },
    
    targets: {
      base: {
        price: pc.targetPrice || pc.targets?.base?.price || null,
        upside_pct: pc.targets?.base?.upside_pct || calculateUpside(pc.price?.last, pc.targetPrice || pc.targets?.base?.price),
        rationale: pc.targets?.base?.rationale || 'Base case assumes steady execution with in-line growth expectations.'
      },
      bull: {
        price: pc.targets?.bull?.price || null,
        upside_pct: pc.targets?.bull?.upside_pct || null,
        rationale: pc.targets?.bull?.rationale || 'Bull case assumes accelerated growth and multiple expansion.'
      },
      bear: {
        price: pc.targets?.bear?.price || null,
        upside_pct: pc.targets?.bear?.upside_pct || null,
        rationale: pc.targets?.bear?.rationale || 'Bear case assumes slower growth and multiple contraction.'
      }
    },
    
    kpi: {
      pe_ttm: pc.valuationData?.pe_ttm || pc.valuation?.pe_ttm || null,
      pe_forward: pc.valuationData?.pe_forward || pc.valuation?.pe_forward || null,
      peg: pc.valuationData?.peg || null,
      ps_ttm: pc.valuationData?.ps_ttm || pc.valuation?.ps_ttm || null,
      pb: pc.valuationData?.pb || pc.valuation?.pb || null,
      ev_ebitda: pc.valuationData?.ev_ebitda || pc.valuation?.ev_ebitda || null,
      dividend_yield: pc.valuationData?.dividend_yield || pc.valuation?.dividend_yield || null,
      fcf_yield: pc.valuationData?.fcf_yield || null,
      gross_margin: pc.fundamentals?.gross_margin || null,
      operating_margin: pc.fundamentals?.operating_margin || null,
      net_margin: pc.fundamentals?.net_margin || null,
      roe: pc.fundamentals?.roe || null,
      roic: pc.fundamentals?.roic || null,
      leverage: pc.fundamentals?.leverage || pc.fundamentals?.debt_to_equity || null,
      eps_cagr_3y: pc.growth?.eps_cagr_3y || null,
      revenue_cagr_3y: pc.growth?.revenue_cagr_3y || null
    },
    
    valuation: {
      market_cap: pc.valuationData?.market_cap || pc.valuation?.market_cap || null,
      pe_ttm: pc.valuationData?.pe_ttm || pc.valuation?.pe_ttm || null,
      pe_forward: pc.valuationData?.pe_forward || pc.valuation?.pe_forward || null,
      ps_ttm: pc.valuationData?.ps_ttm || pc.valuation?.ps_ttm || null,
      pb: pc.valuationData?.pb || pc.valuation?.pb || null,
      ev_ebitda: pc.valuationData?.ev_ebitda || pc.valuation?.ev_ebitda || null,
      dividend_yield: pc.valuationData?.dividend_yield || pc.valuation?.dividend_yield || null,
      historical_pe_5y: pc.valuationData?.historical_pe_5y || { low: null, avg: null, high: null },
      historical_ps_5y: pc.valuationData?.historical_ps_5y || { low: null, avg: null, high: null },
      dcf_inputs: pc.valuationData?.dcf_inputs || null,
      relative_premium: pc.valuationData?.relative_premium || null
    },
    
    consensus: {
      rating_distribution: pc.consensus?.rating_distribution || { buy: 0, hold: 0, sell: 0 },
      avg_target: pc.consensus?.avg_target || null,
      upside_pct: pc.consensus?.upside_pct || null,
      num_analysts: pc.consensus?.num_analysts || 0,
      surprise_pct: pc.consensus?.surprise_pct || null,
      text: pc.consensus?.text || null
    },
    
    fundamentals: {
      revenue_5y: pc.fundamentals?.revenue_5y || [],
      eps_5y: pc.fundamentals?.eps_5y || [],
      gross_margin: pc.fundamentals?.gross_margin || null,
      operating_margin: pc.fundamentals?.operating_margin || null,
      net_margin: pc.fundamentals?.net_margin || null,
      roe: pc.fundamentals?.roe || null,
      roa: pc.fundamentals?.roa || null,
      roic: pc.fundamentals?.roic || null,
      debt_to_equity: pc.fundamentals?.debt_to_equity || null,
      current_ratio: pc.fundamentals?.current_ratio || null,
      fcf: pc.fundamentals?.fcf || null
    },
    
    growth: {
      revenue_cagr_3y: pc.growth?.revenue_cagr_3y || null,
      eps_cagr_3y: pc.growth?.eps_cagr_3y || null,
      eps_yoy_latest: pc.growth?.eps_yoy_latest || null,
      revenue_yoy_latest: pc.growth?.revenue_yoy_latest || null
    },
    
    segments: pc.segments || generateDefaultSegments(),
    peers: pc.peers || generateDefaultPeers(pc.symbol),
    
    summary_text: pc.summary || 'Executive summary in progress.',
    investment_thesis: pc.thesis || 'Investment thesis analysis in progress.',
    valuation_text: typeof pc.valuation === 'string' ? pc.valuation : 'Valuation analysis in progress.',
    industry_text: pc.industry || 'Industry analysis in progress.',
    macro_text: pc.macro || 'Macro environment analysis in progress.',
    company_overview: pc.companyOverview || 'Company overview analysis in progress.',
    
    key_messages: extractArrayField(pc.keyMessages || meta.keyMessages, 4, 'Key investment consideration'),
    key_risks: extractArrayField(pc.keyRisks || meta.keyRisks, 4, 'Risk factor to monitor'),
    catalysts: extractArrayField(pc.catalysts, 8, 'Potential catalyst'),
    risks: extractArrayField(pc.risks, 8, 'Risk consideration'),
    
    valuation_framework: {
      narrative: pc.valuationFramework?.narrative || 'Our valuation framework incorporates multiple methodologies including relative valuation, DCF analysis, and sum-of-parts where applicable.',
      drivers: pc.valuationFramework?.drivers || generateDefaultValuationDrivers()
    },
    
    tech_indicators: pc.technicalIndicators || generateDefaultTechIndicators(),
    tech_commentary: pc.technicalCommentary || 'Technical analysis suggests monitoring key support and resistance levels.',
    tech_support_resistance: pc.techSupportResistance || null,
    
    strategy: {
      entry_range: pc.strategy?.entry_range || null,
      stop_loss: pc.strategy?.stop_loss || null,
      time_horizon: pc.strategy?.time_horizon || '12 months',
      position_sizing: pc.strategy?.position_sizing || 'Position sizing should reflect individual risk tolerance.',
      action_text: pc.strategy?.action_text || pc.actionRecommendation || null
    },
    
    appendix: {
      detailed_metrics: pc.appendix?.detailed_metrics || generateDefaultDetailedMetrics(),
      methodology: pc.appendix?.methodology || 'Our research methodology combines fundamental analysis with quantitative screening.',
      disclosures: pc.appendix?.disclosures || generateDefaultDisclosures()
    },
    
    glossary: pc.glossary || generateDefaultGlossary(),
    rating_definitions: pc.ratingDefinitions || generateDefaultRatingDefinitions(),
    analyst_view: pc.analystView || null,
    conclusions: pc.conclusions || 'Investment conclusion pending further analysis.'
  };
}

function calculateUpside(currentPrice, targetPrice) {
  if (!currentPrice || !targetPrice) return null;
  return ((targetPrice - currentPrice) / currentPrice * 100);
}

function extractArrayField(field, count, defaultText) {
  if (Array.isArray(field) && field.length > 0) {
    return field.slice(0, count).map(item => 
      typeof item === 'string' ? item : (item.text || item.description || defaultText)
    );
  }
  return Array(count).fill().map((_, i) => `${defaultText} ${i + 1}`);
}

function generateDefaultSegments() {
  return [
    { name: 'Primary Segment', revenue_pct: 55, growth: 'N/A', margin: 'N/A', comment: 'Core business operations' },
    { name: 'Secondary Segment', revenue_pct: 30, growth: 'N/A', margin: 'N/A', comment: 'Supporting business line' },
    { name: 'Emerging/Other', revenue_pct: 15, growth: 'N/A', margin: 'N/A', comment: 'Growth initiatives' }
  ];
}

function generateDefaultPeers(symbol) {
  return [
    { symbol: 'PEER1', name: 'Competitor A', market_cap: null, pe_forward: null, ps_ttm: null, roe: null, comment: 'Primary competitor' },
    { symbol: 'PEER2', name: 'Competitor B', market_cap: null, pe_forward: null, ps_ttm: null, roe: null, comment: 'Industry peer' },
    { symbol: 'PEER3', name: 'Competitor C', market_cap: null, pe_forward: null, ps_ttm: null, roe: null, comment: 'Regional peer' },
    { symbol: 'PEER4', name: 'Competitor D', market_cap: null, pe_forward: null, ps_ttm: null, roe: null, comment: 'Market peer' }
  ];
}

function generateDefaultValuationDrivers() {
  return [
    { driver: 'Revenue Growth', impact: '+', value_delta: '+5%', price_impact: '+$8.50', description: 'Sustainable top-line growth trajectory' },
    { driver: 'Margin Expansion', impact: '+', value_delta: '+3%', price_impact: '+$4.20', description: 'Operating leverage and efficiency gains' },
    { driver: 'Multiple Re-rating', impact: '~', value_delta: '0%', price_impact: '$0.00', description: 'Valuation multiples vs historical range' },
    { driver: 'Capital Allocation', impact: '+', value_delta: '+2%', price_impact: '+$2.80', description: 'Shareholder returns and reinvestment' }
  ];
}

function generateDefaultTechIndicators() {
  return [
    { indicator: 'RSI (14)', value: 'N/A', signal: 'Neutral' },
    { indicator: 'MACD', value: 'N/A', signal: 'N/A' },
    { indicator: '50-Day MA', value: 'N/A', signal: 'N/A' },
    { indicator: '200-Day MA', value: 'N/A', signal: 'N/A' }
  ];
}

function generateDefaultDetailedMetrics() {
  return [
    { category: 'Valuation', metrics: ['PE Ratio', 'EV/EBITDA', 'P/S', 'P/B'] },
    { category: 'Profitability', metrics: ['Gross Margin', 'Operating Margin', 'Net Margin', 'ROE'] },
    { category: 'Growth', metrics: ['Revenue CAGR', 'EPS CAGR', 'FCF Growth'] },
    { category: 'Financial Health', metrics: ['Debt/Equity', 'Current Ratio', 'Interest Coverage'] }
  ];
}

function generateDefaultDisclosures() {
  return [
    'This research report is provided for informational purposes only.',
    'The analyst certifies that views expressed accurately reflect personal views.',
    'No part of analyst compensation was related to specific recommendations.',
    'The firm may have positions in securities mentioned in this report.'
  ];
}

function generateDefaultGlossary() {
  return [
    { term: 'PE (Price-to-Earnings)', definition: 'Ratio of share price to earnings per share' },
    { term: 'P/S (Price-to-Sales)', definition: 'Ratio of market cap to annual revenue' },
    { term: 'EV/EBITDA', definition: 'Enterprise value to EBITDA, capital structure-neutral metric' },
    { term: 'ROE (Return on Equity)', definition: 'Net income as percentage of shareholder equity' },
    { term: 'CAGR', definition: 'Compound Annual Growth Rate over specified period' },
    { term: 'Beta', definition: 'Measure of stock volatility relative to market' },
    { term: 'TTM', definition: 'Trailing Twelve Months financial data' },
    { term: 'Forward PE', definition: 'PE using next 12 months estimated earnings' }
  ];
}

function generateDefaultRatingDefinitions() {
  return [
    { rating: 'STRONG BUY', description: 'Expected total return >25% over 12 months with high conviction' },
    { rating: 'BUY', description: 'Expected total return 10-25% over 12 months' },
    { rating: 'HOLD', description: 'Expected total return -10% to +10% over 12 months' },
    { rating: 'SELL', description: 'Expected total return -10% to -25% over 12 months' },
    { rating: 'STRONG SELL', description: 'Expected total return <-25% over 12 months' }
  ];
}

function createV6Helpers(report) {
  const fmt = (val, decimals = 2, suffix = '') => {
    if (val === null || val === undefined || isNaN(val)) return 'N/A';
    return Number(val).toFixed(decimals) + suffix;
  };
  
  const fmtCurrency = (val) => {
    if (val === null || val === undefined || isNaN(val)) return 'N/A';
    return '$' + Number(val).toFixed(2);
  };
  
  const fmtLarge = (val) => {
    if (val === null || val === undefined || isNaN(val)) return 'N/A';
    if (val >= 1e12) return '$' + (val / 1e12).toFixed(2) + 'T';
    if (val >= 1e9) return '$' + (val / 1e9).toFixed(2) + 'B';
    if (val >= 1e6) return '$' + (val / 1e6).toFixed(2) + 'M';
    return '$' + val.toFixed(0);
  };
  
  const splitToParagraphs = (text, count = 3) => {
    if (!text || typeof text !== 'string') return ['Analysis in progress.'];
    const paragraphs = text.split(/\n\n|\n/).filter(p => p.trim().length > 10);
    return paragraphs.length > 0 ? paragraphs.slice(0, count) : ['Analysis in progress.'];
  };
  
  return { fmt, fmtCurrency, fmtLarge, splitToParagraphs };
}

function renderV6Page1(doc, report, h, assets, options) {
  renderProfessionalCover(doc, report, {
    backgroundColor: '#1a2332',
    accentColor: '#3b82f6',
    textColor: '#ffffff',
    firmName: options.firmName,
    analystName: options.analystName
  });
}

function renderV6Page2(doc, report, h, assets, options) {
  doc.fontSize(16).fillColor('#1a2332').font('Helvetica-Bold').text('Key Takeaways', 50, 60);
  
  const colWidth = (doc.page.width - 120) / 2;
  let leftY = 90;
  let rightY = 90;
  
  doc.fontSize(11).fillColor('#1a2332').font('Helvetica-Bold').text('Key Messages', 50, leftY);
  leftY += 18;
  doc.fontSize(9).fillColor('#374151').font('Helvetica');
  report.key_messages.forEach((msg, i) => {
    const text = `${i + 1}. ${msg.substring(0, 120)}${msg.length > 120 ? '...' : ''}`;
    doc.text(text, 50, leftY, { width: colWidth - 10 });
    leftY += doc.heightOfString(text, { width: colWidth - 10 }) + 6;
  });
  
  doc.fontSize(11).fillColor('#1a2332').font('Helvetica-Bold').text('Key Risks', 50 + colWidth + 20, 90);
  rightY = 108;
  doc.fontSize(9).fillColor('#374151').font('Helvetica');
  report.key_risks.forEach((risk, i) => {
    const text = `${i + 1}. ${risk.substring(0, 120)}${risk.length > 120 ? '...' : ''}`;
    doc.text(text, 50 + colWidth + 20, rightY, { width: colWidth - 10 });
    rightY += doc.heightOfString(text, { width: colWidth - 10 }) + 6;
  });
  
  const metricsY = Math.max(leftY, rightY) + 15;
  doc.fontSize(12).fillColor('#1a2332').font('Helvetica-Bold').text('Key Metrics', 50, metricsY);
  
  const kpiData = [
    ['PE (TTM)', h.fmt(report.kpi.pe_ttm, 1, 'x')],
    ['PE (Fwd)', h.fmt(report.kpi.pe_forward, 1, 'x')],
    ['P/S', h.fmt(report.kpi.ps_ttm, 1, 'x')],
    ['P/B', h.fmt(report.kpi.pb, 1, 'x')],
    ['EV/EBITDA', h.fmt(report.kpi.ev_ebitda, 1, 'x')],
    ['Div Yield', h.fmt(report.kpi.dividend_yield, 2, '%')],
    ['ROE', h.fmt(report.kpi.roe, 1, '%')],
    ['Beta', h.fmt(report.price.beta, 2)]
  ];
  
  const boxWidth = (doc.page.width - 140) / 4;
  const boxHeight = 45;
  let kpiY = metricsY + 22;
  
  kpiData.forEach((kpi, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 50 + col * (boxWidth + 10);
    const y = kpiY + row * (boxHeight + 8);
    
    doc.rect(x, y, boxWidth, boxHeight).fill('#f8fafc');
    doc.fontSize(7).fillColor('#6b7280').font('Helvetica').text(kpi[0], x + 5, y + 6, { width: boxWidth - 10, align: 'center' });
    doc.fontSize(12).fillColor('#1a2332').font('Helvetica-Bold').text(kpi[1], x + 5, y + 22, { width: boxWidth - 10, align: 'center' });
  });
  
  const consensusY = kpiY + 2 * (boxHeight + 8) + 15;
  if (report.consensus.avg_target || report.consensus.num_analysts > 0) {
    doc.fontSize(11).fillColor('#1a2332').font('Helvetica-Bold').text('Consensus Quick Stats', 50, consensusY);
    doc.fontSize(9).fillColor('#374151').font('Helvetica');
    const consensusText = `Avg Target: ${h.fmtCurrency(report.consensus.avg_target)} | Analysts: ${report.consensus.num_analysts} | Upside: ${h.fmt(report.consensus.upside_pct, 1, '%')}`;
    doc.text(consensusText, 50, consensusY + 18, { width: doc.page.width - 100 });
  }
}

function renderV6Page3(doc, report, h, assets, options) {
  doc.fontSize(16).fillColor('#1a2332').font('Helvetica-Bold').text('Investment Thesis', 50, 60);
  
  const thesisParas = h.splitToParagraphs(report.investment_thesis, 4);
  let y = 88;
  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  thesisParas.forEach(para => {
    doc.text(para, 50, y, { width: doc.page.width - 100 });
    y += doc.heightOfString(para, { width: doc.page.width - 100 }) + 8;
  });
  
  y = Math.max(y, 280);
  doc.fontSize(12).fillColor('#1a2332').font('Helvetica-Bold').text('Our View vs Consensus', 50, y);
  y += 20;
  
  const tableData = [
    ['Metric', 'Our View', 'Consensus'],
    ['Rating', report.rating || 'HOLD', 'N/A'],
    ['Target Price', h.fmtCurrency(report.targets.base.price), h.fmtCurrency(report.consensus.avg_target)],
    ['Upside', h.fmt(report.targets.base.upside_pct, 1, '%'), h.fmt(report.consensus.upside_pct, 1, '%')],
    ['EPS Growth', h.fmt(report.growth.eps_yoy_latest, 1, '%'), 'N/A'],
    ['ROE', h.fmt(report.kpi.roe, 1, '%'), 'N/A']
  ];
  
  renderGenericTable(doc, { startY: y, headers: tableData[0], rows: tableData.slice(1), colWidths: [150, 130, 130] });
}

function renderV6Page4(doc, report, h, assets, options) {
  doc.fontSize(16).fillColor('#1a2332').font('Helvetica-Bold').text('Company & Segment Overview', 50, 60);
  
  const overviewParas = h.splitToParagraphs(report.company_overview, 3);
  let y = 88;
  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  overviewParas.forEach(para => {
    doc.text(para, 50, y, { width: doc.page.width - 100 });
    y += doc.heightOfString(para, { width: doc.page.width - 100 }) + 8;
  });
  
  y = Math.max(y, 200);
  doc.fontSize(12).fillColor('#1a2332').font('Helvetica-Bold').text('Business Segment Breakdown', 50, y);
  y += 20;
  
  const segmentHeaders = ['Segment', 'Revenue %', 'Growth', 'Margin', 'Comment'];
  const segmentRows = report.segments.map(s => [
    s.name || 'N/A',
    s.revenue_pct ? h.fmt(s.revenue_pct, 0, '%') : 'N/A',
    s.growth || 'N/A',
    s.margin || 'N/A',
    s.comment || '-'
  ]);
  
  renderGenericTable(doc, { startY: y, headers: segmentHeaders, rows: segmentRows, colWidths: [120, 75, 65, 65, 130] });
}

function renderV6Page5(doc, report, h, assets, options) {
  const industryItems = h.splitToParagraphs(report.industry_text, 4).map(p => p.substring(0, 180));
  const macroItems = h.splitToParagraphs(report.macro_text, 4).map(p => p.substring(0, 160));
  
  renderTwoColumnSection(doc, {
    startY: 60,
    sectionTitle: 'Industry & Macro Environment',
    leftTitle: 'Industry Trends',
    rightTitle: 'Macro Factors',
    leftItems: industryItems.length > 0 ? industryItems : ['Industry analysis in progress.'],
    rightItems: macroItems.length > 0 ? macroItems : ['Macro analysis in progress.']
  });
}

function renderV6Page6(doc, report, h, assets, options) {
  doc.fontSize(16).fillColor('#1a2332').font('Helvetica-Bold').text('Valuation Snapshot', 50, 60);
  
  const valHeaders = ['Metric', 'Current', '5Y Low', '5Y Avg', '5Y High'];
  const valRows = [
    ['Price', h.fmtCurrency(report.price.last), h.fmtCurrency(report.price.low_52w), '-', h.fmtCurrency(report.price.high_52w)],
    ['PE (TTM)', h.fmt(report.valuation.pe_ttm, 1, 'x'), h.fmt(report.valuation.historical_pe_5y?.low, 1, 'x'), h.fmt(report.valuation.historical_pe_5y?.avg, 1, 'x'), h.fmt(report.valuation.historical_pe_5y?.high, 1, 'x')],
    ['P/S (TTM)', h.fmt(report.valuation.ps_ttm, 1, 'x'), h.fmt(report.valuation.historical_ps_5y?.low, 1, 'x'), h.fmt(report.valuation.historical_ps_5y?.avg, 1, 'x'), h.fmt(report.valuation.historical_ps_5y?.high, 1, 'x')],
    ['P/B', h.fmt(report.valuation.pb, 1, 'x'), 'N/A', 'N/A', 'N/A'],
    ['EV/EBITDA', h.fmt(report.valuation.ev_ebitda, 1, 'x'), 'N/A', 'N/A', 'N/A'],
    ['Div Yield', h.fmt(report.valuation.dividend_yield, 2, '%'), 'N/A', 'N/A', 'N/A']
  ];
  
  renderGenericTable(doc, { startY: 88, headers: valHeaders, rows: valRows, colWidths: [100, 85, 85, 85, 85] });
  
  let y = 300;
  doc.fontSize(12).fillColor('#1a2332').font('Helvetica-Bold').text('Valuation Commentary', 50, y);
  y += 18;
  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  h.splitToParagraphs(report.valuation_text, 3).forEach(para => {
    doc.text(para, 50, y, { width: doc.page.width - 100 });
    y += doc.heightOfString(para, { width: doc.page.width - 100 }) + 8;
  });
}

function renderV6Page7(doc, report, h, assets, options) {
  doc.fontSize(16).fillColor('#1a2332').font('Helvetica-Bold').text('Valuation Framework', 50, 60);
  
  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  doc.text(report.valuation_framework.narrative, 50, 88, { width: doc.page.width - 100 });
  
  let y = 150;
  doc.fontSize(12).fillColor('#1a2332').font('Helvetica-Bold').text('Value Drivers Waterfall', 50, y);
  y += 20;
  
  const driverHeaders = ['Driver', 'Impact', 'Value Delta', 'Price Impact', 'Description'];
  const driverRows = report.valuation_framework.drivers.map(d => [
    d.driver,
    d.impact,
    d.value_delta || 'N/A',
    d.price_impact || 'N/A',
    (d.description || '').substring(0, 30)
  ]);
  
  renderGenericTable(doc, { startY: y, headers: driverHeaders, rows: driverRows, colWidths: [100, 50, 70, 80, 150] });
  
  y = 320;
  doc.fontSize(12).fillColor('#1a2332').font('Helvetica-Bold').text('Scenario Targets', 50, y);
  y += 20;
  
  const scenHeaders = ['Scenario', 'Target Price', 'Upside', 'Rationale'];
  const scenRows = [
    ['Bull Case', h.fmtCurrency(report.targets.bull.price), h.fmt(report.targets.bull.upside_pct, 1, '%'), (report.targets.bull.rationale || '-').substring(0, 50)],
    ['Base Case', h.fmtCurrency(report.targets.base.price), h.fmt(report.targets.base.upside_pct, 1, '%'), (report.targets.base.rationale || '-').substring(0, 50)],
    ['Bear Case', h.fmtCurrency(report.targets.bear.price), h.fmt(report.targets.bear.upside_pct, 1, '%'), (report.targets.bear.rationale || '-').substring(0, 50)]
  ];
  
  renderGenericTable(doc, { startY: y, headers: scenHeaders, rows: scenRows, colWidths: [80, 90, 70, 210] });
}

function renderV6Page8(doc, report, h, assets, options) {
  doc.fontSize(16).fillColor('#1a2332').font('Helvetica-Bold').text('Peer Comparison', 50, 60);
  
  const peerHeaders = ['Company', 'Ticker', 'Mkt Cap', 'PE (Fwd)', 'P/S', 'ROE', 'Comment'];
  const peerRows = report.peers.slice(0, 5).map(p => [
    (p.name || p.symbol).substring(0, 18),
    p.symbol || '-',
    h.fmtLarge(p.market_cap),
    h.fmt(p.pe_forward, 1, 'x'),
    h.fmt(p.ps_ttm, 1, 'x'),
    h.fmt(p.roe, 1, '%'),
    (p.comment || '-').substring(0, 20)
  ]);
  
  renderGenericTable(doc, { startY: 88, headers: peerHeaders, rows: peerRows, colWidths: [90, 50, 60, 55, 50, 50, 95] });
  
  let y = 280;
  doc.fontSize(12).fillColor('#1a2332').font('Helvetica-Bold').text('Comparative Analysis', 50, y);
  y += 18;
  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  const compText = `${report.symbol} trades at ${h.fmt(report.valuation.pe_forward, 1, 'x')} forward PE vs peer average. ` +
    `The company's ROE of ${h.fmt(report.kpi.roe, 1, '%')} compares to the peer group median. ` +
    `Our analysis suggests the valuation is justified given the growth and profitability profile.`;
  doc.text(compText, 50, y, { width: doc.page.width - 100 });
}

function renderV6Page9(doc, report, h, assets, options) {
  doc.fontSize(16).fillColor('#1a2332').font('Helvetica-Bold').text('Financial Overview', 50, 60);
  
  const finHeaders = ['Metric', 'Value', 'YoY Change'];
  const latestRevenue = report.fundamentals.revenue_5y?.[report.fundamentals.revenue_5y.length - 1]?.value;
  const latestEps = report.fundamentals.eps_5y?.[report.fundamentals.eps_5y.length - 1]?.value;
  
  const finRows = [
    ['Revenue (TTM)', h.fmtLarge(latestRevenue), h.fmt(report.growth.revenue_yoy_latest, 1, '%')],
    ['Revenue 3Y CAGR', h.fmt(report.growth.revenue_cagr_3y, 1, '%'), '-'],
    ['EPS (TTM)', h.fmtCurrency(latestEps), h.fmt(report.growth.eps_yoy_latest, 1, '%')],
    ['EPS 3Y CAGR', h.fmt(report.growth.eps_cagr_3y, 1, '%'), '-'],
    ['Gross Margin', h.fmt(report.fundamentals.gross_margin, 1, '%'), '-'],
    ['Operating Margin', h.fmt(report.fundamentals.operating_margin, 1, '%'), '-'],
    ['Net Margin', h.fmt(report.fundamentals.net_margin, 1, '%'), '-'],
    ['ROE', h.fmt(report.fundamentals.roe, 1, '%'), '-'],
    ['ROA', h.fmt(report.fundamentals.roa, 1, '%'), '-'],
    ['Debt/Equity', h.fmt(report.fundamentals.debt_to_equity, 2, 'x'), '-']
  ];
  
  renderGenericTable(doc, { startY: 88, headers: finHeaders, rows: finRows, colWidths: [180, 140, 100] });
  
  let y = 420;
  doc.fontSize(12).fillColor('#1a2332').font('Helvetica-Bold').text('Financial Health Summary', 50, y);
  y += 18;
  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  const healthText = `The company demonstrates ${report.fundamentals.gross_margin > 50 ? 'strong' : 'moderate'} profitability with ` +
    `gross margins of ${h.fmt(report.fundamentals.gross_margin, 1, '%')}. ` +
    `Return on equity stands at ${h.fmt(report.fundamentals.roe, 1, '%')}, ` +
    `reflecting management's ability to generate shareholder value.`;
  doc.text(healthText, 50, y, { width: doc.page.width - 100 });
}

function renderV6Page10(doc, report, h, assets, options) {
  doc.fontSize(16).fillColor('#1a2332').font('Helvetica-Bold').text('Financial Trends', 50, 60);
  
  doc.fontSize(12).fillColor('#1a2332').font('Helvetica-Bold').text('Revenue Trend (5 Years)', 50, 88);
  
  if (assets?.financialCharts?.revenue) {
    try {
      doc.image(assets.financialCharts.revenue, 50, 108, { width: doc.page.width - 100, height: 170 });
    } catch (e) {
      renderChartFrame(doc, { startY: 108, title: 'Revenue Trend', placeholder: 'Revenue chart currently unavailable', height: 170 });
    }
  } else {
    renderChartFrame(doc, { startY: 108, title: 'Revenue Trend', placeholder: `Revenue data: ${report.fundamentals.revenue_5y?.length || 0} periods available`, height: 170 });
  }
  
  doc.fontSize(12).fillColor('#1a2332').font('Helvetica-Bold').text('EPS Trend (5 Years)', 50, 310);
  
  if (assets?.financialCharts?.eps) {
    try {
      doc.image(assets.financialCharts.eps, 50, 330, { width: doc.page.width - 100, height: 170 });
    } catch (e) {
      renderChartFrame(doc, { startY: 330, title: 'EPS Trend', placeholder: 'EPS chart currently unavailable', height: 170 });
    }
  } else {
    renderChartFrame(doc, { startY: 330, title: 'EPS Trend', placeholder: `EPS data: ${report.fundamentals.eps_5y?.length || 0} periods available`, height: 170 });
  }
}

function renderV6Page11(doc, report, h, assets, options) {
  doc.fontSize(16).fillColor('#1a2332').font('Helvetica-Bold').text('Key Catalysts', 50, 60);
  
  let y = 90;
  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  
  report.catalysts.forEach((cat, i) => {
    const text = typeof cat === 'string' ? cat : (cat.text || cat.description || '');
    const shortText = text.substring(0, 280);
    doc.font('Helvetica-Bold').fillColor('#1a2332').text(`Catalyst ${i + 1}: `, 50, y, { continued: true });
    doc.font('Helvetica').fillColor('#374151').text(`${shortText}${text.length > 280 ? '...' : ''}`, { width: doc.page.width - 100 });
    y = doc.y + 12;
  });
}

function renderV6Page12(doc, report, h, assets, options) {
  doc.fontSize(16).fillColor('#1a2332').font('Helvetica-Bold').text('Key Risks', 50, 60);
  
  let y = 90;
  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  
  report.risks.forEach((risk, i) => {
    const text = typeof risk === 'string' ? risk : (risk.text || risk.description || '');
    const shortText = text.substring(0, 280);
    doc.font('Helvetica-Bold').fillColor('#1a2332').text(`Risk ${i + 1}: `, 50, y, { continued: true });
    doc.font('Helvetica').fillColor('#374151').text(`${shortText}${text.length > 280 ? '...' : ''}`, { width: doc.page.width - 100 });
    y = doc.y + 12;
  });
}

function renderV6Page13(doc, report, h, assets, options) {
  doc.fontSize(16).fillColor('#1a2332').font('Helvetica-Bold').text('Technical Analysis', 50, 60);
  
  doc.fontSize(12).fillColor('#1a2332').font('Helvetica-Bold').text('Price Chart (90 Days)', 50, 88);
  
  if (assets?.klineChart) {
    try {
      doc.image(assets.klineChart, 50, 108, { fit: [doc.page.width - 100, 180], align: 'center' });
    } catch (e) {
      renderChartFrame(doc, { startY: 108, title: 'Price Trend', placeholder: '90-day price chart unavailable', height: 180 });
    }
  } else {
    renderChartFrame(doc, { startY: 108, title: 'Price Trend', placeholder: 'Technical chart pending generation', height: 180 });
  }
  
  let y = 310;
  doc.fontSize(12).fillColor('#1a2332').font('Helvetica-Bold').text('Technical Indicators', 50, y);
  y += 18;
  
  const techHeaders = ['Indicator', 'Value', 'Signal'];
  const techRows = report.tech_indicators.map(ind => [ind.indicator, ind.value, ind.signal]);
  
  renderGenericTable(doc, { startY: y, headers: techHeaders, rows: techRows, colWidths: [160, 130, 130] });
  
  y = 480;
  doc.fontSize(12).fillColor('#1a2332').font('Helvetica-Bold').text('Technical Commentary', 50, y);
  y += 18;
  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  doc.text(report.tech_commentary.substring(0, 400), 50, y, { width: doc.page.width - 100 });
}

function renderV6Page14(doc, report, h, assets, options) {
  doc.fontSize(16).fillColor('#1a2332').font('Helvetica-Bold').text('Investment Strategy', 50, 60);
  
  const price = report.price.last || 100;
  const baseTarget = report.targets.base.price || price * 1.1;
  const bullTarget = report.targets.bull.price || price * 1.25;
  
  const stratHeaders = ['Profile', 'Entry Range', 'Target', 'Stop Loss', 'Position', 'Notes'];
  const stratRows = [
    ['Aggressive', `${h.fmtCurrency(price * 0.95)}-${h.fmtCurrency(price)}`, h.fmtCurrency(bullTarget), h.fmtCurrency(price * 0.90), '5-10%', 'Higher risk tolerance'],
    ['Balanced', `${h.fmtCurrency(price * 0.97)}-${h.fmtCurrency(price * 1.02)}`, h.fmtCurrency(baseTarget), h.fmtCurrency(price * 0.93), '3-7%', 'Core holding'],
    ['Conservative', `Below ${h.fmtCurrency(price * 0.95)}`, h.fmtCurrency(baseTarget * 0.95), h.fmtCurrency(price * 0.88), '2-5%', 'Wait for pullback']
  ];
  
  renderGenericTable(doc, { startY: 88, headers: stratHeaders, rows: stratRows, colWidths: [75, 90, 70, 70, 55, 95] });
  
  let y = 250;
  doc.fontSize(12).fillColor('#1a2332').font('Helvetica-Bold').text('Position Sizing Guidance', 50, y);
  y += 18;
  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  doc.text(report.strategy.position_sizing, 50, y, { width: doc.page.width - 100 });
  
  y += 60;
  doc.fontSize(12).fillColor('#1a2332').font('Helvetica-Bold').text('Action Recommendations', 50, y);
  y += 18;
  const actionText = report.strategy.action_text || 
    'We recommend scaling into positions over time rather than establishing full positions at once. ' +
    'Use technical pullbacks to add to positions within the entry range specified above.';
  doc.fontSize(10).fillColor('#374151').font('Helvetica').text(actionText.substring(0, 400), 50, y, { width: doc.page.width - 100 });
}

function renderV6Page15(doc, report, h, assets, options) {
  doc.fontSize(16).fillColor('#1a2332').font('Helvetica-Bold').text('Appendix – Detailed Metrics', 50, 60);
  
  const metricsFromAppendix = report.appendix?.detailed_metrics || [];
  const hasStructuredMetrics = metricsFromAppendix.length > 0 && metricsFromAppendix[0]?.category;
  
  if (hasStructuredMetrics) {
    let y = 90;
    metricsFromAppendix.forEach(cat => {
      doc.fontSize(11).fillColor('#1a2332').font('Helvetica-Bold').text(cat.category, 50, y);
      y += 16;
      doc.fontSize(8).fillColor('#374151').font('Helvetica');
      const metricsList = Array.isArray(cat.metrics) ? cat.metrics : [];
      metricsList.forEach(metric => {
        const metricName = typeof metric === 'string' ? metric : metric.name;
        const metricValue = typeof metric === 'object' ? (metric.value || 'N/A') : 'N/A';
        doc.text(`• ${metricName}: ${metricValue}`, 60, y, { width: doc.page.width - 120 });
        y += 12;
      });
      y += 8;
    });
  } else {
    const leftMetrics = [
      ['Latest Price', h.fmtCurrency(report.price.last)],
      ['52W High', h.fmtCurrency(report.price.high_52w)],
      ['52W Low', h.fmtCurrency(report.price.low_52w)],
      ['Beta', h.fmt(report.price.beta, 3)],
      ['Market Cap', h.fmtLarge(report.valuation.market_cap)],
      ['PE (TTM)', h.fmt(report.valuation.pe_ttm, 2, 'x')],
      ['PE (Forward)', h.fmt(report.valuation.pe_forward, 2, 'x')],
      ['P/S (TTM)', h.fmt(report.valuation.ps_ttm, 2, 'x')],
      ['P/B', h.fmt(report.valuation.pb, 2, 'x')],
      ['EV/EBITDA', h.fmt(report.valuation.ev_ebitda, 2, 'x')]
    ];
    
    const rightMetrics = [
      ['Gross Margin', h.fmt(report.fundamentals.gross_margin, 2, '%')],
      ['Operating Margin', h.fmt(report.fundamentals.operating_margin, 2, '%')],
      ['Net Margin', h.fmt(report.fundamentals.net_margin, 2, '%')],
      ['ROE', h.fmt(report.fundamentals.roe, 2, '%')],
      ['ROA', h.fmt(report.fundamentals.roa, 2, '%')],
      ['ROIC', h.fmt(report.fundamentals.roic, 2, '%')],
      ['Debt/Equity', h.fmt(report.fundamentals.debt_to_equity, 2, 'x')],
      ['Current Ratio', h.fmt(report.fundamentals.current_ratio, 2, 'x')],
      ['Revenue CAGR (3Y)', h.fmt(report.growth.revenue_cagr_3y, 1, '%')],
      ['EPS CAGR (3Y)', h.fmt(report.growth.eps_cagr_3y, 1, '%')]
    ];
    
    doc.fontSize(11).fillColor('#1a2332').font('Helvetica-Bold').text('Valuation Metrics', 50, 90);
    let y = 108;
    doc.fontSize(8).fillColor('#374151').font('Helvetica');
    leftMetrics.forEach(([label, value]) => {
      doc.text(`${label}:`, 50, y, { continued: true, width: 130 });
      doc.text(` ${value}`);
      y += 14;
    });
    
    doc.fontSize(11).fillColor('#1a2332').font('Helvetica-Bold').text('Profitability & Growth', 280, 90);
    y = 108;
    rightMetrics.forEach(([label, value]) => {
      doc.fontSize(8).fillColor('#374151').font('Helvetica');
      doc.text(`${label}:`, 280, y, { continued: true, width: 130 });
      doc.text(` ${value}`);
      y += 14;
    });
  }
}

function renderV6Page16(doc, report, h, assets, options) {
  doc.fontSize(16).fillColor('#1a2332').font('Helvetica-Bold').text('Appendix – Methodology', 50, 60);
  
  const customMethodology = report.appendix?.methodology;
  const hasCustomMethodology = customMethodology && typeof customMethodology === 'string' && customMethodology.length > 100;
  
  if (hasCustomMethodology) {
    let y = 88;
    doc.fontSize(11).fillColor('#1a2332').font('Helvetica-Bold').text('Research Methodology', 50, y);
    y += 16;
    doc.fontSize(9).fillColor('#374151').font('Helvetica');
    doc.text(customMethodology.substring(0, 1500), 50, y, { width: doc.page.width - 100 });
    y = doc.y + 20;
    
    doc.fontSize(11).fillColor('#1a2332').font('Helvetica-Bold').text('Model Information', 50, y);
    y += 16;
    doc.fontSize(9).fillColor('#374151').font('Helvetica');
    doc.text(`Version: ${report.meta.version}`, 50, y);
    doc.text(`Model: ${report.meta.model}`, 50, y + 14);
    doc.text(`Generated: ${report.meta.reportDate}`, 50, y + 28);
  } else {
    const sections = [
      { title: 'Data Sources', text: 'This report integrates real-time financial data from multiple authoritative sources including Finnhub, Twelve Data, and Alpha Vantage. Market quotes, fundamental metrics, and historical financials are verified across providers to ensure accuracy.' },
      { title: 'Multi-Model AI Analysis', text: 'Our research platform employs a multi-model AI architecture where specialist models analyze different aspects of the investment thesis in parallel. This approach combines deep learning insights with traditional financial analysis.' },
      { title: 'Valuation Methodology', text: `The valuation framework applies multiple methodologies including PE multiples analysis, DCF modeling (where applicable), and peer-relative valuation. Price targets reflect ${report.horizon || '12-month'} forward expectations.` },
      { title: 'Technical Analysis', text: 'Technical indicators are calculated using standard methodologies. RSI uses 14-period lookback, MACD uses 12/26/9 settings, and moving averages are simple (SMA) unless otherwise specified.' },
      { title: 'Risk Assessment', text: 'Risks are evaluated across multiple dimensions including business model, competitive dynamics, financial health, regulatory environment, and macroeconomic sensitivity.' }
    ];
    
    let y = 88;
    sections.forEach(section => {
      doc.fontSize(11).fillColor('#1a2332').font('Helvetica-Bold').text(section.title, 50, y);
      y += 16;
      doc.fontSize(9).fillColor('#374151').font('Helvetica').text(section.text, 50, y, { width: doc.page.width - 100 });
      y = doc.y + 12;
    });
    
    y += 10;
    doc.fontSize(11).fillColor('#1a2332').font('Helvetica-Bold').text('Model Information', 50, y);
    y += 16;
    doc.fontSize(9).fillColor('#374151').font('Helvetica');
    doc.text(`Version: ${report.meta.version}`, 50, y);
    doc.text(`Model: ${report.meta.model}`, 50, y + 14);
    doc.text(`Generated: ${report.meta.reportDate}`, 50, y + 28);
  }
}

function renderV6Page17(doc, report, h, assets, options) {
  const firmName = report.meta.firm;
  
  doc.fontSize(16).fillColor('#1a2332').font('Helvetica-Bold').text('Important Disclosures', 50, 60);
  
  const customDisclosures = report.appendix?.disclosures;
  const hasCustomDisclosures = Array.isArray(customDisclosures) && customDisclosures.length > 0;
  
  if (hasCustomDisclosures) {
    let y = 88;
    customDisclosures.forEach((disclosure, i) => {
      const disclosureText = typeof disclosure === 'string' ? disclosure : (disclosure.text || disclosure.description || '');
      const disclosureTitle = typeof disclosure === 'object' && disclosure.title ? disclosure.title : `Disclosure ${i + 1}`;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#1a2332').text(`${disclosureTitle}: `, 50, y, { continued: true });
      doc.font('Helvetica').fillColor('#374151').text(disclosureText.substring(0, 400), { width: doc.page.width - 100 });
      y = doc.y + 8;
    });
  } else {
    const disclosures = [
      { title: 'Important Information', text: `This research report is provided for informational purposes only and does not constitute an offer or solicitation to buy or sell any securities. ${firmName} makes no representation or warranty as to accuracy or completeness.` },
      { title: 'Not Investment Advice', text: 'This report is not intended to provide investment advice and should not be relied upon as such. Investors should conduct their own due diligence and consult with qualified financial advisors.' },
      { title: 'Risk Disclosure', text: 'All investments carry risk, including potential loss of principal. Securities mentioned may be volatile. Price targets and ratings are subject to change without notice.' },
      { title: 'Forward-Looking Statements', text: 'This report may contain forward-looking statements that are inherently uncertain. Actual results may differ materially from forecasts.' },
      { title: 'Data Sources', text: `Financial data is sourced from third-party providers. While we endeavor to ensure accuracy, ${firmName} is not responsible for errors in third-party data.` },
      { title: 'Conflicts of Interest', text: `${firmName} may have business relationships with companies covered. Analysts may hold positions in securities mentioned.` },
      { title: 'Copyright', text: `© ${new Date().getFullYear()} ${firmName}. All rights reserved. Reproduction without consent is prohibited.` }
    ];
    
    let y = 88;
    disclosures.forEach(d => {
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#1a2332').text(`${d.title}: `, 50, y, { continued: true });
      doc.font('Helvetica').fillColor('#374151').text(d.text, { width: doc.page.width - 100 });
      y = doc.y + 8;
    });
  }
}

function renderV6Page18(doc, report, h, assets, options) {
  doc.fontSize(16).fillColor('#1a2332').font('Helvetica-Bold').text('Appendix – Glossary', 50, 60);
  
  let y = 88;
  doc.fontSize(8).fillColor('#374151').font('Helvetica');
  
  report.glossary.forEach(item => {
    doc.font('Helvetica-Bold').fillColor('#1a2332').text(item.term, 50, y, { continued: true, width: 180 });
    doc.font('Helvetica').fillColor('#374151').text(`: ${item.definition}`, { width: doc.page.width - 140 });
    y = doc.y + 6;
  });
}

function renderV6Page19(doc, report, h, assets, options) {
  doc.fontSize(16).fillColor('#1a2332').font('Helvetica-Bold').text('Appendix – Rating Definitions', 50, 60);
  
  doc.fontSize(12).fillColor('#1a2332').font('Helvetica-Bold').text('Stock Ratings', 50, 90);
  
  let y = 110;
  report.rating_definitions.forEach(rd => {
    const ratingColors = { 'STRONG BUY': '#10B981', 'BUY': '#34D399', 'HOLD': '#FBBF24', 'SELL': '#F87171', 'STRONG SELL': '#EF4444' };
    doc.fontSize(9).font('Helvetica-Bold').fillColor(ratingColors[rd.rating] || '#1a2332').text(rd.rating, 50, y, { continued: true, width: 100 });
    doc.font('Helvetica').fillColor('#374151').text(`: ${rd.description}`, { width: doc.page.width - 160 });
    y = doc.y + 10;
  });
  
  y += 20;
  doc.fontSize(12).fillColor('#1a2332').font('Helvetica-Bold').text('Risk Ratings', 50, y);
  y += 18;
  
  const riskDefs = [
    { level: 'Low Risk', text: 'Established business model, stable cash flows, minimal leverage.' },
    { level: 'Medium Risk', text: 'Moderate competitive position, cyclical exposure, balanced profile.' },
    { level: 'High Risk', text: 'Emerging model, high growth expectations, elevated leverage or uncertainty.' }
  ];
  
  doc.fontSize(9).fillColor('#374151').font('Helvetica');
  riskDefs.forEach(rd => {
    doc.font('Helvetica-Bold').text(`${rd.level}: `, 50, y, { continued: true });
    doc.font('Helvetica').text(rd.text, { width: doc.page.width - 100 });
    y = doc.y + 8;
  });
  
  y += 15;
  doc.fontSize(12).fillColor('#1a2332').font('Helvetica-Bold').text('Time Horizon', 50, y);
  y += 18;
  doc.fontSize(9).fillColor('#374151').font('Helvetica').text(
    'Unless otherwise specified, price targets and ratings reflect a 12-month investment horizon.',
    50, y, { width: doc.page.width - 100 }
  );
}

function renderV6Page20(doc, report, h, assets, options) {
  doc.fontSize(16).fillColor('#1a2332').font('Helvetica-Bold').text('Analyst View', 50, 60);
  
  doc.rect(50, 88, doc.page.width - 100, 90).fill('#f8f9fa');
  doc.rect(50, 88, 4, 90).fill('#007b5e');
  
  doc.fontSize(12).fillColor('#1a2332').font('Helvetica-Bold').text('Final Recommendation', 60, 98);
  
  const ratingColors = { 'STRONG BUY': '#10B981', 'BUY': '#34D399', 'HOLD': '#FBBF24', 'SELL': '#F87171', 'STRONG SELL': '#EF4444' };
  const ratingColor = ratingColors[report.rating] || '#6B7280';
  
  doc.fontSize(10).fillColor('#374151').font('Helvetica').text('Rating: ', 60, 120, { continued: true });
  doc.fillColor(ratingColor).font('Helvetica-Bold').text(report.rating || 'HOLD');
  
  doc.fillColor('#374151').font('Helvetica');
  doc.text(`Target Price: ${h.fmtCurrency(report.targets.base.price)} (${h.fmt(report.targets.base.upside_pct, 1, '%')} upside)`, 60, 138);
  doc.text(`Horizon: ${report.horizon || '12M'}`, 60, 156);
  
  let y = 195;
  doc.fontSize(12).fillColor('#1a2332').font('Helvetica-Bold').text('Investment Summary', 50, y);
  y += 18;
  
  const summaryParas = h.splitToParagraphs(report.summary_text, 3);
  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  summaryParas.forEach(para => {
    doc.text(para, 50, y, { width: doc.page.width - 100 });
    y = doc.y + 8;
  });
  
  y = Math.max(y, 380);
  doc.fontSize(12).fillColor('#1a2332').font('Helvetica-Bold').text('Conclusion', 50, y);
  y += 18;
  
  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  doc.text(report.conclusions.substring(0, 400), 50, y, { width: doc.page.width - 100 });
  
  y = Math.max(doc.y + 30, 500);
  doc.fontSize(9).fillColor('#555555').font('Helvetica');
  doc.text(`Firm: ${report.meta.firm}`, 50, y);
  doc.text(`Lead Analyst: ${report.meta.analyst}`, 50, y + 14);
  doc.text(`Report Date: ${report.meta.reportDate}`, 50, y + 28);
  
  y += 55;
  doc.fontSize(9).fillColor('#666666').font('Helvetica');
  doc.text('— End of Report —', 50, y, { align: 'center', width: doc.page.width - 100 });
  doc.text(`For questions, please contact ${report.meta.brand}.`, 50, y + 18, { align: 'center', width: doc.page.width - 100 });
}

function renderV6InstitutionalPdf(doc, premiumContent, assets, options = {}) {
  const report = buildV6ReportData(premiumContent, options);
  const h = createV6Helpers(report);
  const firmName = options.firmName || report.meta.firm;
  
  console.log(`\n📄 [V6Renderer] Starting V6 Institutional 20-page layout...`);
  console.log(`   Symbol: ${report.symbol}, Firm: ${firmName}`);
  
  const renderPage = (pageNum, renderFn) => {
    if (pageNum > 1) {
      doc.addPage();
      renderInstitutionalHeader(doc, { firmName, pageNumber: pageNum });
    }
    renderFn();
    if (pageNum > 1) {
      renderPageFooter(doc, { pageNumber: pageNum, brand: firmName });
    }
  };
  
  renderV6Page1(doc, report, h, assets, options);
  console.log(`   ├─ Page 1: Cover`);
  
  renderPage(2, () => renderV6Page2(doc, report, h, assets, options));
  console.log(`   ├─ Page 2: Key Takeaways + KPI Grid`);
  
  renderPage(3, () => renderV6Page3(doc, report, h, assets, options));
  console.log(`   ├─ Page 3: Investment Thesis`);
  
  renderPage(4, () => renderV6Page4(doc, report, h, assets, options));
  console.log(`   ├─ Page 4: Company & Segment Overview`);
  
  renderPage(5, () => renderV6Page5(doc, report, h, assets, options));
  console.log(`   ├─ Page 5: Industry & Macro Environment`);
  
  renderPage(6, () => renderV6Page6(doc, report, h, assets, options));
  console.log(`   ├─ Page 6: Valuation Snapshot`);
  
  renderPage(7, () => renderV6Page7(doc, report, h, assets, options));
  console.log(`   ├─ Page 7: Valuation Framework`);
  
  renderPage(8, () => renderV6Page8(doc, report, h, assets, options));
  console.log(`   ├─ Page 8: Peer Comparison`);
  
  renderPage(9, () => renderV6Page9(doc, report, h, assets, options));
  console.log(`   ├─ Page 9: Financial Overview`);
  
  renderPage(10, () => renderV6Page10(doc, report, h, assets, options));
  console.log(`   ├─ Page 10: Financial Trends`);
  
  renderPage(11, () => renderV6Page11(doc, report, h, assets, options));
  console.log(`   ├─ Page 11: Key Catalysts`);
  
  renderPage(12, () => renderV6Page12(doc, report, h, assets, options));
  console.log(`   ├─ Page 12: Key Risks`);
  
  renderPage(13, () => renderV6Page13(doc, report, h, assets, options));
  console.log(`   ├─ Page 13: Technical Analysis`);
  
  renderPage(14, () => renderV6Page14(doc, report, h, assets, options));
  console.log(`   ├─ Page 14: Investment Strategy`);
  
  renderPage(15, () => renderV6Page15(doc, report, h, assets, options));
  console.log(`   ├─ Page 15: Appendix - Detailed Metrics`);
  
  renderPage(16, () => renderV6Page16(doc, report, h, assets, options));
  console.log(`   ├─ Page 16: Appendix - Methodology`);
  
  renderPage(17, () => renderV6Page17(doc, report, h, assets, options));
  console.log(`   ├─ Page 17: Important Disclosures`);
  
  renderPage(18, () => renderV6Page18(doc, report, h, assets, options));
  console.log(`   ├─ Page 18: Glossary`);
  
  renderPage(19, () => renderV6Page19(doc, report, h, assets, options));
  console.log(`   ├─ Page 19: Rating Definitions`);
  
  renderPage(20, () => renderV6Page20(doc, report, h, assets, options));
  console.log(`   └─ Page 20: Analyst View`);
  
  console.log(`\n✅ [V6Renderer] V6 Institutional PDF complete (20 pages)`);
  
  return report;
}

module.exports = {
  buildV6ReportData,
  createV6Helpers,
  renderV6InstitutionalPdf,
  generateDefaultPeers,
  generateDefaultSegments
};
