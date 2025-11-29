/**
 * premiumContentBridge.js
 * 
 * Phase 7: Premium Content Bridge
 * 桥接 v3_dev Premium 引擎到 Phase 6 增强模板
 * 
 * 功能：
 * - 调用 v3_dev/services/reportService.js 的 buildResearchReport
 * - 将机构级深度内容归一化为 Phase 6 模板所需格式
 * - 不修改 v3_dev 原有代码
 */

const { buildResearchReport } = require('../v3_dev/services/reportService.js');

/**
 * 获取 Premium 机构级研究报告内容
 * @param {string} symbol - 股票代码
 * @param {string} language - 语言 (en/zh)
 * @param {Object} options - 可选配置
 * @returns {Promise<Object>} 归一化的报告内容
 */
async function getPremiumContent(symbol, language = 'en', options = {}) {
  const {
    assetType = 'equity',
    brand = 'USIS Brain v7.0',
    firm = 'USIS Research Division',
    analyst = 'Multi-AI System',
    symbolMetadata = {}
  } = options;

  console.log(`\n🔗 [PremiumBridge] Fetching premium content for ${symbol}`);
  console.log(`   ├─ Language: ${language}`);
  console.log(`   ├─ Asset Type: ${assetType}`);
  console.log(`   └─ Brand: ${brand}`);

  try {
    // 调用 v3_dev Premium 引擎生成完整报告
    const report = await buildResearchReport(symbol, assetType, {
      brand,
      firm,
      analyst,
      language,
      symbolMetadata
    });

    console.log(`✅ [PremiumBridge] Premium report generated`);
    console.log(`   ├─ Rating: ${report.rating}`);
    console.log(`   ├─ Target: ${report.targets?.base?.price || 'N/A'}`);
    console.log(`   └─ Sections: ${Object.keys(report).length} fields`);

    // 归一化数据结构为 Phase 6 模板格式
    const normalizedContent = {
      // === 基础信息 ===
      symbol: report.symbol,
      name: report.name,
      rating: report.rating,
      targetPrice: report.targets?.base?.price || null,
      upside: report.targets?.base?.upside_pct || null,
      analyst: analyst,
      date: new Date().toISOString(),

      // === 六大章节内容 (Institutional Grade) ===
      
      // I. Executive Summary
      summary: report.summary_text || 'Premium analysis in progress',
      
      // II. Investment Thesis
      thesis: report.thesis_text || 'Investment thesis analysis unavailable',
      
      // III. Valuation Analysis
      valuation: report.valuation_text || 'Valuation analysis unavailable',
      
      // IV. Industry & Segments (合并)
      industry: combineIndustryAnalysis(report),
      
      // V. Catalysts (机遇)
      catalysts: normalizeCatalysts(report.catalysts_text),
      
      // VI. Risks & Conclusions (合并)
      risks: normalizeRisks(report.risks_text),
      conclusions: report.action_text || generateConclusions(report),

      // === 数据引用（供图表使用）===
      priceData: report.price,
      fundamentals: report.fundamentals,
      valuation_metrics: report.valuation,
      growth: report.growth,
      peers: report.peers,
      charts: report.charts,
      
      // 🆕 v7.2: 保留原始价格和估值数据供 V6 组件使用
      price: report.price,
      valuation: report.valuation,
      
      // === 元数据 ===
      meta: {
        source: 'v3_dev Premium Engine',
        model: report.meta?.model || 'Multi-AI',
        version: 'v7.0',
        generated_at: new Date().toISOString(),
        language,
        
        // 🆕 v7.2: V6 组件需要的关键数据
        keyMessages: extractKeyMessagesFromReport(report),
        keyRisks: extractKeyRisksFromReport(report),
        metrics: extractMetricsFromReport(report),
        
        // 保留原始 Premium 数据引用
        price: report.price,
        valuation: report.valuation,
        fundamentals: report.fundamentals,
        targetPrice: report.targets?.base?.price || null
      }
    };

    console.log(`✅ [PremiumBridge] Content normalized for Phase 6`);
    console.log(`   ├─ Summary: ${normalizedContent.summary.length} chars`);
    console.log(`   ├─ Thesis: ${normalizedContent.thesis.length} chars`);
    console.log(`   ├─ Valuation: ${normalizedContent.valuation.length} chars`);
    console.log(`   ├─ Industry: ${normalizedContent.industry.length} chars`);
    console.log(`   ├─ Catalysts: ${normalizedContent.catalysts.length} items`);
    console.log(`   └─ Risks: ${normalizedContent.risks.length} items`);

    return normalizedContent;

  } catch (error) {
    console.error(`❌ [PremiumBridge] Error fetching premium content:`, error.message);
    throw error;
  }
}

/**
 * 合并行业分析与细分市场分析
 */
function combineIndustryAnalysis(report) {
  let combined = '';

  // 宏观经济与行业趋势
  if (report.macro_text) {
    combined += `## Industry & Macro Trends\n\n${report.macro_text}\n\n`;
  }

  // 细分市场分析
  if (report.segment_text) {
    combined += `## Segment Analysis\n\n${report.segment_text}\n\n`;
  }

  // 技术分析视角
  if (report.tech_view_text) {
    combined += `## Technical View\n\n${report.tech_view_text}`;
  }

  return combined || 'Industry and competitive landscape analysis in progress';
}

/**
 * 归一化催化剂为数组格式
 */
function normalizeCatalysts(catalysts) {
  if (!catalysts) return [];
  
  // 已经是数组
  if (Array.isArray(catalysts)) {
    return catalysts.map(cat => {
      if (typeof cat === 'string') {
        return { text: cat, impact: 'medium' };
      }
      return cat;
    });
  }
  
  // 字符串转数组
  if (typeof catalysts === 'string') {
    // 按换行符或数字列表分割
    const items = catalysts
      .split(/\n+/)
      .filter(line => line.trim().length > 0)
      .map(line => line.replace(/^[\d\.\-\*\•]\s*/, '').trim())
      .filter(line => line.length > 10); // 过滤太短的行

    return items.map(text => ({ text, impact: 'medium' }));
  }
  
  return [];
}

/**
 * 归一化风险为数组格式
 */
function normalizeRisks(risks) {
  if (!risks) return [];
  
  // 已经是数组
  if (Array.isArray(risks)) {
    return risks.map(risk => {
      if (typeof risk === 'string') {
        return { text: risk, severity: 'medium' };
      }
      return risk;
    });
  }
  
  // 字符串转数组
  if (typeof risks === 'string') {
    const items = risks
      .split(/\n+/)
      .filter(line => line.trim().length > 0)
      .map(line => line.replace(/^[\d\.\-\*\•]\s*/, '').trim())
      .filter(line => line.length > 10);

    return items.map(text => ({ text, severity: 'medium' }));
  }
  
  return [];
}

/**
 * 生成结论（如果缺失）
 */
function generateConclusions(report) {
  const rating = report.rating || 'HOLD';
  const symbol = report.symbol;
  const target = report.targets?.base?.price || 'N/A';
  const upside = report.targets?.base?.upside_pct || 0;

  let conclusion = `Based on our comprehensive analysis, we assign a ${rating} rating to ${symbol} `;
  
  if (target !== 'N/A') {
    conclusion += `with a 12-month price target of $${target} (${upside > 0 ? '+' : ''}${upside.toFixed(1)}% upside). `;
  }

  if (rating === 'BUY' || rating === 'STRONG_BUY') {
    conclusion += `The company's strong fundamentals and growth prospects support our positive outlook. `;
  } else if (rating === 'SELL' || rating === 'STRONG_SELL') {
    conclusion += `Valuation concerns and competitive risks warrant a cautious stance. `;
  } else {
    conclusion += `Current valuation appears fairly priced relative to growth prospects. `;
  }

  conclusion += `Investors should monitor key catalysts and risk factors outlined in this report.`;

  return conclusion;
}

// ═══════════════════════════════════════════════════════════════
// 🆕 v7.2: V6 组件数据提取函数
// ═══════════════════════════════════════════════════════════════

/**
 * 从 Premium 报告中提取 Key Messages（用于 V6 Key Takeaways）
 */
function extractKeyMessagesFromReport(report) {
  const messages = [];
  
  // 添加评级和目标价信息
  if (report.rating && report.symbol) {
    const price = report.price?.last;
    const target = report.targets?.base?.price;
    if (price && target) {
      const upside = ((target - price) / price * 100).toFixed(1);
      messages.push(`${report.symbol} rated ${report.rating} with $${target} target (${upside}% ${upside > 0 ? 'upside' : 'downside'}).`);
    }
  }
  
  // 从 summary_text 提取关键句
  if (report.summary_text) {
    const summaryLines = report.summary_text
      .split(/[.!?]/)
      .map(s => s.trim())
      .filter(s => s.length > 30 && s.length < 200);
    messages.push(...summaryLines.slice(0, 2));
  }
  
  // 从 investment_thesis 或 thesis_text 提取
  const thesis = report.investment_thesis || report.thesis_text;
  if (thesis && messages.length < 3) {
    const thesisLines = thesis
      .split(/[.!?]/)
      .map(s => s.trim())
      .filter(s => s.length > 30 && s.length < 200);
    if (thesisLines.length > 0) {
      messages.push(thesisLines[0]);
    }
  }
  
  // 从 catalysts 添加关键催化剂
  const catalysts = report.catalysts_text;
  if (Array.isArray(catalysts) && catalysts.length > 0) {
    const topCatalyst = typeof catalysts[0] === 'string' ? catalysts[0] : catalysts[0]?.text;
    if (topCatalyst && topCatalyst.length > 20) {
      messages.push(topCatalyst.substring(0, 150) + (topCatalyst.length > 150 ? '...' : ''));
    }
  }
  
  return messages.slice(0, 4);
}

/**
 * 从 Premium 报告中提取 Key Risks（用于 V6 Key Takeaways）
 */
function extractKeyRisksFromReport(report) {
  const risks = [];
  
  // 从 risks_text 提取
  const riskSource = report.risks_text;
  
  if (Array.isArray(riskSource)) {
    riskSource.slice(0, 4).forEach(risk => {
      const text = typeof risk === 'string' ? risk : risk?.text;
      if (text && text.length > 20) {
        risks.push(text.substring(0, 150) + (text.length > 150 ? '...' : ''));
      }
    });
  } else if (typeof riskSource === 'string') {
    const riskLines = riskSource
      .split(/[.!?]/)
      .map(s => s.trim())
      .filter(s => s.length > 30 && s.length < 200);
    risks.push(...riskLines.slice(0, 4));
  }
  
  return risks.slice(0, 4);
}

/**
 * 从 Premium 报告中提取关键指标（用于 V6 Key Metrics）
 */
function extractMetricsFromReport(report) {
  const valuation = report.valuation || {};
  const price = report.price || {};
  const fundamentals = report.fundamentals || {};
  
  return {
    // 估值指标
    pe_ttm: valuation.pe_ttm || null,
    pe_fwd: valuation.pe_forward || valuation.pe_fwd || null,
    ps_ttm: valuation.ps_ttm || null,
    pb_ttm: valuation.pb || valuation.pb_ttm || null,
    
    // 价格指标
    beta: price.beta || null,
    high_52w: price.high_52w || null,
    low_52w: price.low_52w || null,
    
    // 基本面指标
    div_yield: fundamentals.dividend_yield || valuation.dividend_yield || null,
    roe: fundamentals.roe || null,
    roa: fundamentals.roa || null,
    
    // 增长指标
    eps_growth: fundamentals.eps_growth || null,
    revenue_growth: fundamentals.revenue_growth || null,
    
    // 市值
    market_cap: valuation.market_cap || null
  };
}

module.exports = {
  getPremiumContent
};
