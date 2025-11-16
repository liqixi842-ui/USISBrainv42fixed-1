/**
 * v3-dev Research Report Service v2 (Generic Multi-Asset Engine)
 * 
 * Morgan-level institutional research report system
 * Supports any symbol: equities, indices, ETFs, crypto
 * 
 * ResearchReport v1 Schema - Standardized JSON structure
 * Used by all output formats (JSON, HTML, PDF, Markdown)
 */

const fetch = require('node-fetch');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY;

// ========== PDFKit 已移除 ==========
// v3-dev 现使用外部 PDF 生成服务
// 本地不再使用 pdfkit、字体文件等

/**
 * ═══════════════════════════════════════════════════════════════
 * GENERIC RESEARCH REPORT ENGINE v1
 * ═══════════════════════════════════════════════════════════════
 * 
 * Universal report builder for ANY symbol (equities, indices, ETFs, crypto)
 * Returns standardized ResearchReport v1 JSON schema
 */

/**
 * Build Generic Research Report (ResearchReport v1 Schema)
 * @param {string} symbol - Stock symbol (e.g., AAPL, NVDA, SPX, QQQ)
 * @param {string} assetType - Asset type: "equity" | "index" | "etf" | "crypto"
 * @returns {Promise<object>} ResearchReport v1 object
 */
async function buildResearchReport(symbol, assetType = "equity") {
  console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║  USIS Research Report Engine v1 - ${symbol} (${assetType})      `);
  console.log(`╚════════════════════════════════════════════════════════════════╝`);
  
  const startTime = Date.now();
  
  try {
    // ─────────────────────────────────────────────────────────────
    // Phase 1: Data Aggregation (Multi-Source)
    // ─────────────────────────────────────────────────────────────
    console.log(`📡 [Phase 1] Fetching market data for ${symbol}...`);
    
    const marketData = await fetchComprehensiveData(symbol, assetType);
    
    console.log(`✅ [Phase 1] Data retrieved`);
    console.log(`   ├─ Price: ${marketData.price.last || 'N/A'}`);
    console.log(`   ├─ Market Cap: ${marketData.valuation.market_cap || 'N/A'}`);
    console.log(`   └─ Name: ${marketData.name || symbol}`);
    
    // ─────────────────────────────────────────────────────────────
    // Phase 2: AI Analysis (Long-form texts)
    // ─────────────────────────────────────────────────────────────
    console.log(`🤖 [Phase 2] Generating AI analysis...`);
    
    const aiTexts = await generateAIAnalysis(symbol, marketData, assetType);
    
    console.log(`✅ [Phase 2] AI analysis complete (${Date.now() - startTime}ms)`);
    
    // ─────────────────────────────────────────────────────────────
    // Phase 3: Assembly (ResearchReport v1 Schema)
    // ─────────────────────────────────────────────────────────────
    console.log(`🔧 [Phase 3] Assembling ResearchReport v1 schema...`);
    
    const report = {
      // ═══ Header ═══
      symbol: symbol.toUpperCase(),
      name: marketData.name,
      asset_type: assetType,
      rating: aiTexts.rating,
      horizon: aiTexts.horizon,
      
      // ═══ Price Data ═══
      price: marketData.price,
      
      // ═══ Valuation Metrics ═══
      valuation: marketData.valuation,
      
      // ═══ Growth Metrics ═══
      growth: marketData.growth,
      
      // ═══ Fundamentals ═══
      fundamentals: marketData.fundamentals,
      
      // ═══ Peer Comparison ═══
      peer_comparison: marketData.peer_comparison || [],
      
      // ═══ Technical Indicators ═══
      techs: marketData.techs,
      
      // ═══ Price Targets ═══
      targets: aiTexts.targets,
      
      // ═══ Long-form Analysis (AI-generated) ═══
      summary_text: aiTexts.summary_text,
      thesis_text: aiTexts.thesis_text,
      valuation_text: aiTexts.valuation_text,
      catalysts_text: aiTexts.catalysts_text,
      risks_text: aiTexts.risks_text,
      tech_view_text: aiTexts.tech_view_text,
      action_text: aiTexts.action_text,
      
      // ═══ Metadata ═══
      meta: {
        generated_at: new Date().toISOString(),
        model: aiTexts.model,
        version: "v3-dev",
        latency_ms: Date.now() - startTime
      }
    };
    
    console.log(`✅ [Phase 3] ResearchReport v1 complete`);
    console.log(`╚═══════════════════════════════════════════════════════════════╝\n`);
    
    // Debug: Log final report JSON for verification
    console.log(`\n[DEBUG] ResearchReport ${symbol}:`);
    console.log(JSON.stringify(report, null, 2));
    console.log(`\n`);
    
    return report;
    
  } catch (error) {
    console.error(`❌ [buildResearchReport] Error: ${error.message}`);
    
    // Return minimal fallback report
    return buildFallbackReport(symbol, assetType, startTime);
  }
}

/**
 * Fetch comprehensive market data from multiple sources
 * @param {string} symbol - Stock symbol
 * @param {string} assetType - Asset type
 * @returns {Promise<object>} Aggregated market data
 */
async function fetchComprehensiveData(symbol, assetType) {
  // Initialize empty data structure matching ResearchReport v1 schema
  const data = {
    name: null,
    price: {
      last: null,
      change_abs: null,
      change_pct: null,
      high_1d: null,
      low_1d: null,
      high_52w: null,
      low_52w: null,
      ytd_return_pct: null,
      currency: "USD"
    },
    valuation: {
      market_cap: null,
      pe_ttm: null,
      pe_forward: null,
      ps_ttm: null,
      pb: null,
      dividend_yield: null,
      ev_ebitda: null
    },
    growth: {
      revenue_cagr_3y: null,
      eps_cagr_3y: null,
      revenue_yoy_latest: null,
      eps_yoy_latest: null
    },
    fundamentals: {
      gross_margin: null,
      operating_margin: null,
      net_margin: null,
      roe: null,
      roa: null,
      fcf_margin: null
    },
    peer_comparison: [],
    techs: {
      rsi_14: null,
      macd: null,
      ema_20: null,
      ema_50: null,
      ema_200: null,
      support_levels: null,
      resistance_levels: null
    }
  };
  
  // Try dataBroker first (if available in parent context)
  try {
    const dataBroker = require('../../dataBroker');
    const marketData = await dataBroker.fetchMarketData([symbol], ['quote']);
    
    if (marketData.quotes && marketData.quotes[symbol]) {
      const quote = marketData.quotes[symbol];
      
      // Map normalized quote data to price fields (dataBroker returns normalized field names)
      data.price.last = quote.currentPrice || null;
      data.price.change_abs = quote.change || null;
      data.price.change_pct = quote.changePercent || null;
      data.price.high_1d = quote.high || null;
      data.price.low_1d = quote.low || null;
      data.price.open = quote.open || null;
      data.price.previous_close = quote.previousClose || null;
      
      // Try to get company name from quote (fallback to symbol)
      data.name = quote.name || symbol.toUpperCase();
      
      console.log(`   └─ dataBroker: quote retrieved (price: ${data.price.last}, change: ${data.price.change_pct}%)`);
    }
  } catch (err) {
    console.log(`   └─ dataBroker unavailable, using API fallback`);
  }
  
  // Fetch company profile from Finnhub (for name and metrics)
  if (FINNHUB_API_KEY && !data.name) {
    try {
      const profileRes = await fetch(
        `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_API_KEY}`,
        { timeout: 5000 }
      );
      
      if (profileRes.ok) {
        const profile = await profileRes.json();
        data.name = profile.name || symbol.toUpperCase();
        data.valuation.market_cap = profile.marketCapitalization ? profile.marketCapitalization * 1000000 : null;
        
        console.log(`   └─ Finnhub: company profile retrieved`);
      }
    } catch (err) {
      console.log(`   └─ Finnhub profile fetch failed`);
    }
  }
  
  // Fetch basic metrics from Finnhub
  if (FINNHUB_API_KEY) {
    try {
      const metricsRes = await fetch(
        `https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_API_KEY}`,
        { timeout: 5000 }
      );
      
      if (metricsRes.ok) {
        const metrics = await metricsRes.json();
        const m = metrics.metric || {};
        
        // Valuation
        data.valuation.pe_ttm = m.peBasicExclExtraTTM || m.peTTM || null;
        data.valuation.pe_forward = m.peNormalizedAnnual || null;
        data.valuation.ps_ttm = m.psTTM || null;
        data.valuation.pb = m.pbAnnual || null;
        data.valuation.dividend_yield = m.dividendYieldIndicatedAnnual || null;
        
        // Fundamentals
        data.fundamentals.gross_margin = m.grossMarginTTM || null;
        data.fundamentals.operating_margin = m.operatingMarginTTM || null;
        data.fundamentals.net_margin = m.netProfitMarginTTM || null;
        data.fundamentals.roe = m.roeTTM || null;
        data.fundamentals.roa = m.roaRfy || null;
        
        // Price data
        if (!data.price.high_52w) data.price.high_52w = m['52WeekHigh'] || null;
        if (!data.price.low_52w) data.price.low_52w = m['52WeekLow'] || null;
        
        console.log(`   └─ Finnhub: metrics retrieved`);
      }
    } catch (err) {
      console.log(`   └─ Finnhub metrics fetch failed`);
    }
  }
  
  // Ensure name is set
  if (!data.name) {
    data.name = symbol.toUpperCase();
  }
  
  return data;
}

/**
 * Generate AI-powered analysis texts
 * @param {string} symbol - Stock symbol
 * @param {object} marketData - Market data object
 * @param {string} assetType - Asset type
 * @returns {Promise<object>} AI-generated texts and ratings
 */
async function generateAIAnalysis(symbol, marketData, assetType) {
  if (!OPENAI_API_KEY) {
    console.warn(`⚠️  No OpenAI API key, using fallback analysis`);
    return generateFallbackAnalysis(symbol, marketData, assetType);
  }
  
  try {
    const systemPrompt = `You are a senior sell-side equity research analyst at a top-tier investment bank. Generate a professional institutional research report.

Requirements:
1. Professional, formal, objective language (NO emojis, NO casual language)
2. Rating: STRONG_BUY | BUY | HOLD | SELL | STRONG_SELL
3. Horizon: 1-3M (short-term) | 3-12M (medium-term) | 12M+ (long-term)
4. Base analysis on provided market data
5. Calculate price targets based on the CURRENT PRICE (not hardcoded values)
6. Response MUST be in Chinese for Chinese users

Price Target Calculation (use these specific percentages for consistency):
- Base Case: Current Price × 1.15 (15% upside for 12M horizon)
- Bull Case: Current Price × 1.35 (35% upside for best case)
- Bear Case: Current Price × 0.85 (15% downside for worst case)

Return ONLY valid JSON (no markdown code blocks):
{
  "rating": "BUY",
  "horizon": "3-12M",
  "summary_text": "简明投资结论（2-3句话，专业措辞）",
  "thesis_text": "核心投资逻辑（3-4段，每段2-3句话，涵盖：行业地位、竞争优势、财务表现、未来前景）",
  "valuation_text": "估值分析（2-3段，结合PE、PS、PB等指标，给出估值合理性判断）",
  "catalysts_text": "催化剂（3-5个要点，包括产品周期、市场拓展、政策利好等）",
  "risks_text": "风险提示（3-5个要点，包括宏观风险、行业风险、公司特定风险）",
  "tech_view_text": "技术面观点（2-3句话，趋势、关键指标、操作建议）",
  "action_text": "操作建议（2-3段，针对不同持仓成本给出具体建议）",
  "targets": {
    "base": { "price": <calculated from current price>, "upside_pct": <your estimated upside %>, "horizon": "12M" },
    "bull": { "price": <calculated from current price>, "upside_pct": <your bull case upside %> },
    "bear": { "price": <calculated from current price>, "downside_pct": <your bear case downside %> }
  }
}`;

    const price = marketData.price.last || 'N/A';
    const changePct = marketData.price.change_pct || 0;
    const marketCap = marketData.valuation.market_cap ? `$${(marketData.valuation.market_cap / 1e9).toFixed(1)}B` : 'N/A';
    const pe = marketData.valuation.pe_ttm || 'N/A';
    
    const userPrompt = `Analyze the following ${assetType}:

Symbol: ${symbol.toUpperCase()}
Name: ${marketData.name}
Current Price: ${price}
Daily Change: ${changePct}%
Market Cap: ${marketCap}
PE Ratio: ${pe}
52W High: ${marketData.price.high_52w || 'N/A'}
52W Low: ${marketData.price.low_52w || 'N/A'}

IMPORTANT: Calculate all price targets based on the current price of ${price}. Do NOT use hardcoded values.

Generate a comprehensive research report based on this data.`;

    console.log(`   └─ Calling OpenAI GPT-4o-mini...`);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 2000,
        temperature: 0.7
      }),
      timeout: 20000
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiContent = data.choices?.[0]?.message?.content;
    
    if (!aiContent) {
      throw new Error('AI returned empty content');
    }

    // Parse JSON response
    const cleanContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const aiData = JSON.parse(cleanContent);
    
    return {
      ...aiData,
      model: 'gpt-4o-mini'
    };
    
  } catch (error) {
    console.warn(`⚠️  AI analysis failed: ${error.message}, using fallback`);
    return generateFallbackAnalysis(symbol, marketData, assetType);
  }
}

/**
 * Generate fallback analysis (no AI)
 */
function generateFallbackAnalysis(symbol, marketData, assetType) {
  const price = marketData.price.last || 0;
  const changePct = marketData.price.change_pct || 0;
  
  // Simple rating logic
  let rating = 'HOLD';
  if (changePct > 5) rating = 'BUY';
  else if (changePct > 10) rating = 'STRONG_BUY';
  else if (changePct < -5) rating = 'SELL';
  else if (changePct < -10) rating = 'STRONG_SELL';
  
  // Calculate price targets based on current price (simple heuristic model)
  const baseUpsidePct = 15;  // +15% base case
  const bullUpsidePct = 35;  // +35% bull case
  const bearDownsidePct = -15; // -15% bear case
  
  const baseTarget = price ? parseFloat((price * (1 + baseUpsidePct / 100)).toFixed(2)) : null;
  const bullTarget = price ? parseFloat((price * (1 + bullUpsidePct / 100)).toFixed(2)) : null;
  const bearTarget = price ? parseFloat((price * (1 + bearDownsidePct / 100)).toFixed(2)) : null;
  
  return {
    rating: rating,
    horizon: "3-12M",
    summary_text: `基于当前市场数据，${symbol} 价格为 ${price}，日内涨跌幅 ${changePct}%。建议投资者保持谨慎，密切关注后续市场动态。`,
    thesis_text: `${marketData.name || symbol} 作为${assetType === 'index' ? '重要市场指数' : '市场参与主体'}，其表现受到多重因素影响。\n\n市场整体走势对短期表现有直接影响。板块轮动可能带来结构性机会。资金流向在很大程度上决定短期波动方向。\n\n投资者应关注宏观经济环境、行业政策动向以及公司基本面变化，综合评估投资价值。`,
    valuation_text: `当前价格${price}处于${marketData.price.high_52w && marketData.price.low_52w ? `52周区间（${marketData.price.low_52w}-${marketData.price.high_52w}）` : '合理估值区间'}。\n\n${marketData.valuation.pe_ttm ? `市盈率${marketData.valuation.pe_ttm.toFixed(1)}倍，` : ''}估值水平需结合行业平均水平和公司成长性综合判断。建议投资者关注估值修复机会和成长性溢价的平衡。`,
    catalysts_text: `重要财报发布窗口可能带来估值重估机会。\n\n行业政策动向值得持续关注。\n\n宏观经济数据公布可能影响市场情绪和资金流向。\n\n技术性突破可能引发趋势性行情。`,
    risks_text: `市场系统性波动风险不容忽视，宏观经济环境变化可能影响整体估值水平。\n\n政策不确定性可能对行业发展和公司经营带来影响。\n\n数据时效性存在局限，投资者应及时跟踪最新动态。\n\n个股流动性风险需要关注，特别是在市场波动加剧时期。`,
    tech_view_text: `基于当前价格走势的初步判断，技术面呈现${changePct > 0 ? '相对强势' : '观望'}态势。建议关注成交量变化和关键支撑位的有效性，结合趋势指标综合判断短期走势。`,
    action_text: `建议投资者根据自身风险承受能力和投资周期，审慎评估入场时机。\n\n对于已有持仓者，可根据成本区间适当调整仓位结构。持仓成本低于当前价格的投资者可考虑部分获利了结；持仓成本高于当前价格的投资者建议耐心等待基本面改善或技术性反弹机会。\n\n新进投资者建议采取分批建仓策略，控制单次投入比例，降低时点选择风险。`,
    targets: {
      base: { 
        price: baseTarget, 
        upside_pct: baseTarget && price ? parseFloat(((baseTarget - price) / price * 100).toFixed(1)) : null, 
        horizon: "12M" 
      },
      bull: { 
        price: bullTarget, 
        upside_pct: bullTarget && price ? parseFloat(((bullTarget - price) / price * 100).toFixed(1)) : null 
      },
      bear: { 
        price: bearTarget, 
        downside_pct: bearTarget && price ? parseFloat(((bearTarget - price) / price * 100).toFixed(1)) : null 
      }
    },
    model: 'fallback'
  };
}

/**
 * Build minimal fallback report on complete failure
 */
function buildFallbackReport(symbol, assetType, startTime) {
  const fallbackAnalysis = generateFallbackAnalysis(symbol, {
    name: symbol.toUpperCase(),
    price: { last: null, change_pct: 0 },
    valuation: {},
    growth: {},
    fundamentals: {},
    techs: {}
  }, assetType);
  
  return {
    symbol: symbol.toUpperCase(),
    name: symbol.toUpperCase(),
    asset_type: assetType,
    rating: fallbackAnalysis.rating,
    horizon: fallbackAnalysis.horizon,
    price: {
      last: null,
      change_abs: null,
      change_pct: null,
      high_1d: null,
      low_1d: null,
      high_52w: null,
      low_52w: null,
      ytd_return_pct: null,
      currency: "USD"
    },
    valuation: {
      market_cap: null,
      pe_ttm: null,
      pe_forward: null,
      ps_ttm: null,
      pb: null,
      dividend_yield: null,
      ev_ebitda: null
    },
    growth: {
      revenue_cagr_3y: null,
      eps_cagr_3y: null,
      revenue_yoy_latest: null,
      eps_yoy_latest: null
    },
    fundamentals: {
      gross_margin: null,
      operating_margin: null,
      net_margin: null,
      roe: null,
      roa: null,
      fcf_margin: null
    },
    peer_comparison: [],
    techs: {
      rsi_14: null,
      macd: null,
      ema_20: null,
      ema_50: null,
      ema_200: null,
      support_levels: null,
      resistance_levels: null
    },
    targets: fallbackAnalysis.targets,
    summary_text: fallbackAnalysis.summary_text,
    thesis_text: fallbackAnalysis.thesis_text,
    valuation_text: fallbackAnalysis.valuation_text,
    catalysts_text: fallbackAnalysis.catalysts_text,
    risks_text: fallbackAnalysis.risks_text,
    tech_view_text: fallbackAnalysis.tech_view_text,
    action_text: fallbackAnalysis.action_text,
    meta: {
      generated_at: new Date().toISOString(),
      model: 'fallback',
      version: "v3-dev",
      latency_ms: Date.now() - startTime
    }
  };
}

/**
 * ═══════════════════════════════════════════════════════════════
 * LEGACY FUNCTIONS (Backward Compatibility)
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * 构建简易研报
 * @param {string} symbol - 股票代码
 * @param {object} basicData - 基础数据（报价等）
 * @returns {Promise<object>} 研报对象
 */
async function buildSimpleReport(symbol, basicData = {}) {
  console.log(`📊 [v3-dev Report Service] 开始生成研报: ${symbol}`);
  
  const startTime = Date.now();
  
  // ========== 快速失败：无 API Key 直接用 fallback ==========
  if (!OPENAI_API_KEY) {
    console.warn(`⚠️  [v3-dev Report] 无 OPENAI_API_KEY，使用 fallback`);
    return generateFallbackReport(symbol, basicData, startTime);
  }
  
  try {
    // 准备数据上下文
    const price = basicData.price || basicData.c || 'N/A';
    const change = basicData.change || basicData.d || 'N/A';
    const changePercent = basicData.changePercent || basicData.dp || 'N/A';
    const high = basicData.high || basicData.h || 'N/A';
    const low = basicData.low || basicData.l || 'N/A';
    const volume = basicData.volume || basicData.v || 'N/A';
    
    // 构建 AI prompt - 投行级研报风格
    const systemPrompt = `你是一位资深的卖方研究分析师。请基于提供的市场数据，生成一份机构级别的股票研究报告。

要求：
1. 语言风格：专业、正式、客观，避免使用口语化表达和emoji
2. 评级只能是：STRONG_BUY、BUY、HOLD、SELL、STRONG_SELL 之一
3. 时间范围：短期（1-3月）、中期（3-12月）、长期（1年以上）
4. 必须用中文回复

返回格式（纯JSON，不要markdown代码块）：
{
  "rating": "评级",
  "horizon": "时间范围",
  "company_name": "公司全称（如 NVIDIA Corporation）",
  "investment_summary": "投资结论（2-3句话，专业措辞，明确操作建议和核心理由）",
  "thesis": ["核心观点1（行业/赛道逻辑）", "核心观点2（竞争优势）", "核心观点3（财务表现）"],
  "catalysts": ["催化剂1（产品/事件）", "催化剂2（市场/客户）", "催化剂3（财报/指引）"],
  "risks": ["风险1（需求周期）", "风险2（竞争/监管）", "风险3（估值/市场）"],
  "technical_view": "技术面简评（3-4句话，包含趋势、指标、操作建议）",
  "action": "操作建议（1-2段话，针对不同持仓成本给出建议）"
}`;

    const userPrompt = `请分析以下股票：

股票代码：${symbol.toUpperCase()}
当前价格：${price}
涨跌幅：${changePercent}%
涨跌额：${change}
最高价：${high}
最低价：${low}
成交量：${volume}

请基于以上数据生成研报JSON。`;

    // 调用 GPT-4o-mini（轻量快速）
    console.log(`🤖 [v3-dev Report] 调用 AI: gpt-4o-mini`);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 1000,
        temperature: 0.7
      }),
      timeout: 15000 // 15秒超时
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiContent = data.choices?.[0]?.message?.content;
    
    if (!aiContent) {
      throw new Error('AI 返回空内容');
    }

    // 解析 AI 返回的 JSON
    let reportData;
    try {
      // 移除可能的 markdown 代码块标记
      const cleanContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      reportData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.warn(`⚠️  [v3-dev Report] AI返回非JSON格式，使用fallback`);
      // Fallback: 基于价格变化的简单判断
      return generateFallbackReport(symbol, basicData, startTime);
    }

    const elapsed = Date.now() - startTime;
    console.log(`✅ [v3-dev Report] 研报生成完成 (${elapsed}ms)`);

    // 构建最终报告结构 - 投行级格式
    return {
      title: `${symbol.toUpperCase()} 研究报告`,
      symbol: symbol.toUpperCase(),
      company_name: reportData.company_name || symbol.toUpperCase(),
      rating: reportData.rating || 'HOLD',
      horizon: reportData.horizon || '中期',
      investment_summary: reportData.investment_summary || '基于当前数据，建议谨慎观察市场走势。',
      thesis: reportData.thesis || ['市场环境分析', '公司基本面评估', '估值合理性判断'],
      catalysts: reportData.catalysts || ['产品周期演进', '市场需求变化', '财报表现'],
      risks: reportData.risks || ['宏观经济波动', '行业竞争加剧', '估值压力'],
      technical_view: reportData.technical_view || '技术面呈现中性态势，建议关注成交量变化和关键支撑位。',
      action: reportData.action || '建议投资者根据自身风险偏好和持仓成本，谨慎评估操作时机。',
      price_info: {
        current: price,
        change: change,
        change_percent: changePercent,
        high: high,
        low: low,
        volume: volume
      },
      generated_at: new Date().toISOString(),
      model_used: 'gpt-4o-mini',
      latency_ms: elapsed,
      disclaimer: '本报告基于公开市场数据生成，仅供参考，不构成投资建议。投资者应独立判断并承担相应风险。'
    };

  } catch (error) {
    console.error(`❌ [v3-dev Report] AI 调用失败:`, error.message);
    
    // 完全失败时的 fallback
    return generateFallbackReport(symbol, basicData, startTime);
  }
}

/**
 * Fallback 报告生成（不调用 AI）
 */
function generateFallbackReport(symbol, basicData, startTime = Date.now()) {
  // 确保 symbol 是字符串，避免 toUpperCase 报错
  const sym = String(symbol || "UNKNOWN").toUpperCase();
  
  const price = basicData.price || basicData.c || 'N/A';
  const changePercent = basicData.changePercent || basicData.dp || 0;
  
  // 简单的评级逻辑
  let rating = 'HOLD';
  if (changePercent > 5) rating = 'BUY';
  else if (changePercent > 10) rating = 'STRONG_BUY';
  else if (changePercent < -5) rating = 'SELL';
  else if (changePercent < -10) rating = 'STRONG_SELL';

  const elapsed = Date.now() - startTime;

  return {
    title: `${sym} 研究报告`,
    symbol: sym,
    company_name: sym,
    rating: rating,
    horizon: '短期',
    investment_summary: `基于当前市场数据，${sym} 价格为 ${price}，日内涨跌幅 ${changePercent}%。鉴于数据有限，建议投资者保持谨慎，密切关注后续市场动态。`,
    thesis: ['市场整体走势影响短期表现', '板块轮动带来结构性机会', '资金流向决定短期波动方向'],
    catalysts: ['重要财报发布窗口', '行业政策动向', '宏观经济数据公布'],
    risks: ['市场系统性波动风险', '政策不确定性影响', '数据时效性局限'],
    technical_view: '基于当前价格走势的初步判断，技术面呈现观望态势。建议关注成交量变化和关键支撑位的有效性。',
    action: '建议投资者根据自身风险承受能力和投资周期，审慎评估入场时机。对于已有持仓者，可根据成本区间适当调整仓位结构。',
    price_info: {
      current: price,
      change: basicData.change || basicData.d || '暂不提供',
      change_percent: changePercent,
      high: basicData.high || basicData.h || '暂不提供',
      low: basicData.low || basicData.l || '暂不提供',
      volume: basicData.volume || basicData.v || '暂不提供'
    },
    generated_at: new Date().toISOString(),
    model_used: 'fallback',
    latency_ms: elapsed,
    disclaimer: '本报告基于有限市场数据生成，仅供参考，不构成投资建议。投资者应独立判断并承担相应风险。'
  };
}

/**
 * 生成 HTML 格式研报
 * @param {string} symbol - 股票代码
 * @param {object} report - 研报对象
 * @returns {string} HTML 字符串
 */
function generateHTMLReport(symbol, report) {
  console.log(`📄 [v3-dev HTML] 生成 HTML 研报: ${symbol}`);
  
  const ratingColors = {
    'STRONG_BUY': '#10B981',
    'BUY': '#34D399',
    'HOLD': '#FBBF24',
    'SELL': '#F87171',
    'STRONG_SELL': '#EF4444'
  };
  const ratingColor = ratingColors[report.rating] || '#6B7280';
  
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.symbol} 研究报告 - USIS</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
      line-height: 1.8;
      color: #1F2937;
      background: #F9FAFB;
      padding: 40px 20px;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      padding: 50px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .header {
      margin-bottom: 40px;
      padding-bottom: 30px;
      border-bottom: 3px solid #E5E7EB;
    }
    h1 {
      color: #111827;
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .symbol-line {
      font-size: 26px;
      font-weight: 600;
      color: #374151;
      margin: 15px 0;
    }
    .company-name {
      color: #6B7280;
      font-size: 16px;
    }
    .rating-badge {
      display: inline-block;
      padding: 10px 24px;
      background: ${ratingColor};
      color: white;
      border-radius: 6px;
      font-weight: 600;
      font-size: 18px;
      margin: 15px 0;
    }
    .meta-line {
      color: #6B7280;
      font-size: 15px;
      margin: 8px 0;
    }
    h2 {
      color: #111827;
      font-size: 22px;
      font-weight: 600;
      margin: 35px 0 15px 0;
      padding-bottom: 8px;
      border-bottom: 2px solid #E5E7EB;
    }
    h3 {
      color: #374151;
      font-size: 18px;
      font-weight: 600;
      margin: 25px 0 12px 0;
    }
    .section {
      margin: 30px 0;
    }
    .investment-summary {
      background: #EEF2FF;
      padding: 24px;
      border-radius: 8px;
      border-left: 4px solid #4F46E5;
      margin: 20px 0;
      font-size: 16px;
      line-height: 1.9;
    }
    .price-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 15px;
    }
    .price-table th {
      background: #F3F4F6;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #374151;
      border-bottom: 2px solid #E5E7EB;
    }
    .price-table td {
      padding: 12px;
      border-bottom: 1px solid #E5E7EB;
    }
    ul {
      margin: 15px 0;
      padding-left: 24px;
    }
    li {
      margin: 12px 0;
      line-height: 1.8;
    }
    .action-box {
      background: #F0FDF4;
      padding: 24px;
      border-radius: 8px;
      border-left: 4px solid #10B981;
      margin: 20px 0;
    }
    .note {
      color: #6B7280;
      font-size: 13px;
      font-style: italic;
      margin: 10px 0;
    }
    .meta {
      margin-top: 40px;
      padding-top: 25px;
      border-top: 2px solid #E5E7EB;
      font-size: 14px;
      color: #6B7280;
    }
    .meta-item {
      margin: 6px 0;
    }
    .disclaimer {
      background: #FEF3C7;
      border: 1px solid #F59E0B;
      border-radius: 8px;
      padding: 20px;
      margin-top: 30px;
      font-size: 13px;
      color: #92400E;
      line-height: 1.7;
    }
    .disclaimer strong {
      display: block;
      margin-bottom: 10px;
      font-size: 15px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>USIS 研究报告</h1>
      <div class="symbol-line">${report.symbol} - <span class="company-name">${report.company_name}</span></div>
      <div class="rating-badge">${report.rating}</div>
      <div class="meta-line">时间范围：${report.horizon}</div>
      <div class="meta-line">最新价格：${report.price_info.current} 美元 | 日内涨跌：${report.price_info.change} (${report.price_info.change_percent}%)</div>
    </div>

    <h2>一、投资结论（Investment Summary）</h2>
    <div class="investment-summary">${report.investment_summary}</div>

    <h2>二、核心观点（Key Investment Thesis）</h2>
    <ul>
      ${report.thesis.map(t => `<li>${t}</li>`).join('')}
    </ul>

    <h2>三、估值与财务概览（Valuation & Financials）</h2>
    <h3>价格信息</h3>
    <table class="price-table">
      <tr>
        <th>指标</th>
        <th>数值</th>
      </tr>
      <tr>
        <td>当前价格</td>
        <td>${report.price_info.current} 美元</td>
      </tr>
      <tr>
        <td>日内涨跌</td>
        <td>${report.price_info.change} (${report.price_info.change_percent}%)</td>
      </tr>
      <tr>
        <td>日内最高</td>
        <td>${report.price_info.high} 美元</td>
      </tr>
      <tr>
        <td>日内最低</td>
        <td>${report.price_info.low} 美元</td>
      </tr>
      <tr>
        <td>成交量</td>
        <td>${report.price_info.volume}</td>
      </tr>
    </table>
    <p class="note">注：部分估值指标（市盈率、市销率等）需接入更详细的财务数据源，当前版本暂不提供。</p>

    <h2>四、关键驱动因素（Catalysts）</h2>
    <ul>
      ${report.catalysts.map(c => `<li>${c}</li>`).join('')}
    </ul>

    <h2>五、核心风险（Key Risks）</h2>
    <ul>
      ${report.risks.map(r => `<li>${r}</li>`).join('')}
    </ul>

    <h2>六、技术面简评（Technical View）</h2>
    <p>${report.technical_view}</p>

    <h2>七、操作建议（Action）</h2>
    <div class="action-box">${report.action}</div>

    <div class="meta">
      <div class="meta-item">生成时间：${new Date(report.generated_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</div>
      <div class="meta-item">AI 模型：${report.model_used}</div>
      <div class="meta-item">处理时长：${report.latency_ms}ms</div>
      <div class="meta-item">报告版本：v3-dev</div>
    </div>

    <div class="disclaimer">
      <strong>免责声明</strong>
      ${report.disclaimer}
    </div>
  </div>
</body>
</html>`;

  console.log(`✅ [v3-dev HTML] HTML 生成完成`);
  return html;
}

/**
 * 生成 Markdown 格式研报
 * @param {string} symbol - 股票代码
 * @param {object} report - 研报对象
 * @returns {string} Markdown 字符串
 */
function generateMarkdownReport(symbol, report) {
  console.log(`📄 [v3-dev MD] 生成 Markdown 研报: ${symbol}`);
  
  // 投行级风格 - 移除emoji，使用专业评级符号
  const ratingSymbol = {
    'STRONG_BUY': '++',
    'BUY': '+',
    'HOLD': '=',
    'SELL': '-',
    'STRONG_SELL': '--'
  }[report.rating] || '=';

  const markdown = `# USIS 研究报告

## ${report.symbol} - ${report.company_name}

**评级：${report.rating}** (${ratingSymbol})  
**时间范围：${report.horizon}**  
**最新价格：${report.price_info.current} 美元**  
**日内涨跌：${report.price_info.change} (${report.price_info.change_percent}%)**

---

## 一、投资结论（Investment Summary）

${report.investment_summary}

---

## 二、核心观点（Key Investment Thesis）

${report.thesis.map((t, i) => `${i + 1}. ${t}`).join('\n')}

---

## 三、估值与财务概览（Valuation & Financials）

### 价格信息

| 指标 | 数值 |
|------|------|
| 当前价格 | ${report.price_info.current} 美元 |
| 日内涨跌 | ${report.price_info.change} (${report.price_info.change_percent}%) |
| 日内最高 | ${report.price_info.high} 美元 |
| 日内最低 | ${report.price_info.low} 美元 |
| 成交量 | ${report.price_info.volume} |

_注：部分估值指标（市盈率、市销率等）需接入更详细的财务数据源，当前版本暂不提供。_

---

## 四、关键驱动因素（Catalysts）

${report.catalysts.map((c, i) => `${i + 1}. ${c}`).join('\n')}

---

## 五、核心风险（Key Risks）

${report.risks.map((r, i) => `${i + 1}. ${r}`).join('\n')}

---

## 六、技术面简评（Technical View）

${report.technical_view}

---

## 七、操作建议（Action）

${report.action}

---

## 报告信息

- **生成时间：** ${new Date(report.generated_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
- **AI 模型：** ${report.model_used}
- **处理时长：** ${report.latency_ms}ms
- **报告版本：** v3-dev

---

## 免责声明

${report.disclaimer}
`;

  console.log(`✅ [v3-dev MD] Markdown 生成完成`);
  return markdown;
}

/**
 * 使用 DocRaptor API 将 HTML 转换为 PDF（主要方案）
 * @param {string} symbol - 股票代码
 * @param {string} htmlContent - HTML内容
 * @returns {Promise<Buffer>} PDF Buffer
 */
async function generatePdfWithDocRaptor(symbol, htmlContent) {
  const DOC_RAPTOR_API_KEY = process.env.DOC_RAPTOR_API_KEY || '';
  const DOC_RAPTOR_TEST_MODE = process.env.DOC_RAPTOR_TEST_MODE === 'true';
  
  // 如果没有API Key，使用备用方案
  if (!DOC_RAPTOR_API_KEY) {
    console.warn('⚠️  [v3-dev PDF] DocRaptor API Key 未配置，使用 PDFKit 备用方案');
    return generateFallbackPDF(htmlContent);
  }
  
  try {
    console.log(`📄 [v3-dev DocRaptor] 开始生成 PDF (${DOC_RAPTOR_TEST_MODE ? '测试模式' : '生产模式'})...`);
    const fetch = require('node-fetch');
    
    const response = await fetch('https://docraptor.com/docs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_credentials: DOC_RAPTOR_API_KEY,
        test: DOC_RAPTOR_TEST_MODE,
        document_type: 'pdf',
        name: `${symbol}_USIS_Research.pdf`,
        document_content: htmlContent,
        prince_options: {
          media: 'print'
        }
      }),
      timeout: 30000
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DocRaptor API错误: ${response.status} - ${errorText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    console.log(`✅ [v3-dev DocRaptor] PDF生成成功 (${arrayBuffer.byteLength} bytes)`);
    return Buffer.from(arrayBuffer);
    
  } catch (error) {
    console.error('❌ [v3-dev DocRaptor] API调用失败:', error.message);
    console.warn('⚠️  [v3-dev PDF] 降级到 PDFKit 备用方案');
    return generateFallbackPDF(htmlContent);
  }
}

/**
 * 旧的 PDFShift API 函数（已弃用，保留向后兼容）
 * @deprecated 请使用 generatePdfWithDocRaptor
 */
async function convertHTMLtoPDF(htmlContent, symbol = 'UNKNOWN') {
  console.warn('⚠️  [v3-dev] convertHTMLtoPDF 已弃用，自动切换到 DocRaptor');
  return generatePdfWithDocRaptor(symbol, htmlContent);
}

/**
 * 备用方案：使用 PDFKit 生成纯文本 PDF
 * @param {string} htmlContent - HTML内容
 * @returns {Promise<Buffer>} PDF Buffer
 */
function generateFallbackPDF(htmlContent) {
  console.log('📝 [v3-dev PDFKit] 使用备用方案生成PDF...');
  
  // 提取文本内容
  const textContent = htmlContent
    .replace(/<style>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/\n+/g, '\n')
    .trim();
  
  const PDFDocument = require('pdfkit');
  const chunks = [];
  
  const doc = new PDFDocument({ 
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 }
  });
  
  doc.on('data', chunk => chunks.push(chunk));
  
  // 标题
  doc.fontSize(16).font('Helvetica-Bold').text('USIS Research Report', { align: 'center' });
  doc.moveDown();
  
  // 内容
  doc.fontSize(10).font('Helvetica').text(textContent, {
    width: 500,
    align: 'left'
  });
  
  doc.end();
  
  return new Promise((resolve, reject) => {
    doc.on('end', () => {
      console.log('✅ [v3-dev PDFKit] PDF生成成功');
      resolve(Buffer.concat(chunks));
    });
    doc.on('error', reject);
  });
}

/**
 * ═══════════════════════════════════════════════════════════════
 * GENERIC HTML GENERATOR (ResearchReport v1 Consumer)
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Build HTML from ResearchReport v1 schema
 * @param {object} report - ResearchReport v1 object
 * @returns {string} HTML string
 */
function buildHtmlFromReport(report) {
  console.log(`📄 [HTML Generator] Building HTML for ${report.symbol}...`);
  
  const ratingColors = {
    'STRONG_BUY': '#10B981',
    'BUY': '#34D399',
    'HOLD': '#FBBF24',
    'SELL': '#F87171',
    'STRONG_SELL': '#EF4444'
  };
  const ratingColor = ratingColors[report.rating] || '#6B7280';
  
  // Helper: format number with null check
  const fmt = (val, decimals = 2, suffix = '') => {
    if (val === null || val === undefined) return 'N/A';
    return Number(val).toFixed(decimals) + suffix;
  };
  
  // Helper: format currency
  const fmtCurrency = (val, currency = 'USD') => {
    if (val === null || val === undefined) return 'N/A';
    const symbol = currency === 'USD' ? '$' : currency;
    return `${symbol}${Number(val).toFixed(2)}`;
  };
  
  // Helper: format large numbers (e.g., market cap)
  const fmtLarge = (val) => {
    if (val === null || val === undefined) return 'N/A';
    if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    return `$${val.toFixed(2)}`;
  };
  
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.symbol} 研究报告 - USIS</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
      line-height: 1.8;
      color: #1F2937;
      background: #F9FAFB;
      padding: 40px 20px;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      padding: 50px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .header {
      margin-bottom: 40px;
      padding-bottom: 30px;
      border-bottom: 3px solid #E5E7EB;
    }
    h1 {
      color: #111827;
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .symbol-line {
      font-size: 26px;
      font-weight: 600;
      color: #374151;
      margin: 15px 0;
    }
    .company-name {
      color: #6B7280;
      font-size: 16px;
    }
    .asset-type {
      display: inline-block;
      padding: 4px 12px;
      background: #EEF2FF;
      color: #4F46E5;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 500;
      margin-left: 10px;
    }
    .rating-badge {
      display: inline-block;
      padding: 10px 24px;
      background: ${ratingColor};
      color: white;
      border-radius: 6px;
      font-weight: 600;
      font-size: 18px;
      margin: 15px 0;
    }
    .meta-line {
      color: #6B7280;
      font-size: 15px;
      margin: 8px 0;
    }
    .price-highlight {
      font-size: 20px;
      font-weight: 600;
      color: #111827;
      margin: 12px 0;
    }
    .change-positive {
      color: #10B981;
      font-weight: 600;
    }
    .change-negative {
      color: #EF4444;
      font-weight: 600;
    }
    h2 {
      color: #111827;
      font-size: 22px;
      font-weight: 600;
      margin: 35px 0 15px 0;
      padding-bottom: 8px;
      border-bottom: 2px solid #E5E7EB;
    }
    h3 {
      color: #374151;
      font-size: 18px;
      font-weight: 600;
      margin: 25px 0 12px 0;
    }
    .section {
      margin: 30px 0;
    }
    .investment-summary {
      background: #EEF2FF;
      padding: 24px;
      border-radius: 8px;
      border-left: 4px solid #4F46E5;
      margin: 20px 0;
      font-size: 16px;
      line-height: 1.9;
      white-space: pre-wrap;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 15px;
    }
    .data-table th {
      background: #F3F4F6;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #374151;
      border-bottom: 2px solid #E5E7EB;
    }
    .data-table td {
      padding: 12px;
      border-bottom: 1px solid #E5E7EB;
    }
    .data-table tr:hover {
      background: #F9FAFB;
    }
    .text-content {
      margin: 15px 0;
      line-height: 1.9;
      white-space: pre-wrap;
    }
    .targets-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin: 20px 0;
    }
    .target-card {
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .target-card.base {
      background: #EEF2FF;
      border: 2px solid #4F46E5;
    }
    .target-card.bull {
      background: #F0FDF4;
      border: 2px solid #10B981;
    }
    .target-card.bear {
      background: #FEF2F2;
      border: 2px solid #EF4444;
    }
    .target-label {
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      color: #6B7280;
      margin-bottom: 8px;
    }
    .target-price {
      font-size: 28px;
      font-weight: 700;
      color: #111827;
      margin: 8px 0;
    }
    .target-upside {
      font-size: 16px;
      font-weight: 600;
    }
    .action-box {
      background: #F0FDF4;
      padding: 24px;
      border-radius: 8px;
      border-left: 4px solid #10B981;
      margin: 20px 0;
      white-space: pre-wrap;
    }
    .note {
      color: #6B7280;
      font-size: 13px;
      font-style: italic;
      margin: 10px 0;
    }
    .meta {
      margin-top: 40px;
      padding-top: 25px;
      border-top: 2px solid #E5E7EB;
      font-size: 14px;
      color: #6B7280;
    }
    .meta-item {
      margin: 6px 0;
    }
    .disclaimer {
      background: #FEF3C7;
      border: 1px solid #F59E0B;
      border-radius: 8px;
      padding: 20px;
      margin-top: 30px;
      font-size: 13px;
      color: #92400E;
      line-height: 1.7;
    }
    .disclaimer strong {
      display: block;
      margin-bottom: 10px;
      font-size: 15px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>USIS 研究报告 / USIS Research Report</h1>
      <div class="symbol-line">
        ${report.symbol} - <span class="company-name">${report.name}</span>
        <span class="asset-type">${report.asset_type.toUpperCase()}</span>
      </div>
      <div class="rating-badge">${report.rating}</div>
      <div class="meta-line">投资期限 / Horizon：${report.horizon}</div>
      <div class="price-highlight">
        最新价格 / Last Price: ${fmtCurrency(report.price.last, report.price.currency)}
        ${report.price.change_pct !== null ? `<span class="${report.price.change_pct >= 0 ? 'change-positive' : 'change-negative'}">${report.price.change_abs >= 0 ? '+' : ''}${fmt(report.price.change_abs)} (${report.price.change_pct >= 0 ? '+' : ''}${fmt(report.price.change_pct, 2, '%')})</span>` : ''}
      </div>
    </div>

    <h2>一、投资结论 / Investment Summary</h2>
    <div class="investment-summary">${report.summary_text}</div>

    <h2>二、核心投资逻辑 / Key Investment Thesis</h2>
    <div class="text-content">${report.thesis_text}</div>

    <h2>三、估值与财务分析 / Valuation & Financials</h2>
    
    <h3>价格数据 / Price Data</h3>
    <table class="data-table">
      <tr>
        <th>指标 / Metric</th>
        <th>数值 / Value</th>
      </tr>
      <tr>
        <td>当前价格 / Current Price</td>
        <td>${fmtCurrency(report.price.last, report.price.currency)}</td>
      </tr>
      <tr>
        <td>日内涨跌 / Daily Change</td>
        <td class="${report.price.change_pct >= 0 ? 'change-positive' : 'change-negative'}">${fmt(report.price.change_abs)} (${fmt(report.price.change_pct, 2, '%')})</td>
      </tr>
      <tr>
        <td>日内高点 / Intraday High</td>
        <td>${fmtCurrency(report.price.high_1d, report.price.currency)}</td>
      </tr>
      <tr>
        <td>日内低点 / Intraday Low</td>
        <td>${fmtCurrency(report.price.low_1d, report.price.currency)}</td>
      </tr>
      <tr>
        <td>52周高点 / 52-Week High</td>
        <td>${fmtCurrency(report.price.high_52w, report.price.currency)}</td>
      </tr>
      <tr>
        <td>52周低点 / 52-Week Low</td>
        <td>${fmtCurrency(report.price.low_52w, report.price.currency)}</td>
      </tr>
    </table>

    <h3>估值指标 / Valuation Metrics</h3>
    <table class="data-table">
      <tr>
        <th>指标 / Metric</th>
        <th>数值 / Value</th>
      </tr>
      <tr>
        <td>市值 / Market Cap</td>
        <td>${fmtLarge(report.valuation.market_cap)}</td>
      </tr>
      <tr>
        <td>市盈率(TTM) / P/E Ratio (TTM)</td>
        <td>${fmt(report.valuation.pe_ttm, 2, 'x')}</td>
      </tr>
      <tr>
        <td>预期市盈率 / Forward P/E</td>
        <td>${fmt(report.valuation.pe_forward, 2, 'x')}</td>
      </tr>
      <tr>
        <td>市销率(TTM) / P/S Ratio (TTM)</td>
        <td>${fmt(report.valuation.ps_ttm, 2, 'x')}</td>
      </tr>
      <tr>
        <td>市净率 / P/B Ratio</td>
        <td>${fmt(report.valuation.pb, 2, 'x')}</td>
      </tr>
      <tr>
        <td>股息率 / Dividend Yield</td>
        <td>${fmt(report.valuation.dividend_yield, 2, '%')}</td>
      </tr>
    </table>

    <h3>基本面指标 / Fundamentals</h3>
    <table class="data-table">
      <tr>
        <th>指标 / Metric</th>
        <th>数值 / Value</th>
      </tr>
      <tr>
        <td>毛利率 / Gross Margin</td>
        <td>${fmt(report.fundamentals.gross_margin, 1, '%')}</td>
      </tr>
      <tr>
        <td>营业利润率 / Operating Margin</td>
        <td>${fmt(report.fundamentals.operating_margin, 1, '%')}</td>
      </tr>
      <tr>
        <td>净利率 / Net Margin</td>
        <td>${fmt(report.fundamentals.net_margin, 1, '%')}</td>
      </tr>
      <tr>
        <td>净资产收益率 / ROE</td>
        <td>${fmt(report.fundamentals.roe, 1, '%')}</td>
      </tr>
      <tr>
        <td>总资产收益率 / ROA</td>
        <td>${fmt(report.fundamentals.roa, 1, '%')}</td>
      </tr>
    </table>

    <div class="text-content">${report.valuation_text}</div>

    <h2>四、目标价格 / Price Targets</h2>
    <div class="targets-grid">
      <div class="target-card base">
        <div class="target-label">基准目标 / Base Case</div>
        <div class="target-price">${fmtCurrency(report.targets.base.price, report.price.currency)}</div>
        <div class="target-upside change-positive">${report.targets.base.upside_pct !== null ? `+${fmt(report.targets.base.upside_pct, 1, '%')}` : 'N/A'}</div>
        <div class="note">${report.targets.base.horizon || ''}</div>
      </div>
      <div class="target-card bull">
        <div class="target-label">乐观情形 / Bull Case</div>
        <div class="target-price">${fmtCurrency(report.targets.bull.price, report.price.currency)}</div>
        <div class="target-upside change-positive">${report.targets.bull.upside_pct !== null ? `+${fmt(report.targets.bull.upside_pct, 1, '%')}` : 'N/A'}</div>
      </div>
      <div class="target-card bear">
        <div class="target-label">悲观情形 / Bear Case</div>
        <div class="target-price">${fmtCurrency(report.targets.bear.price, report.price.currency)}</div>
        <div class="target-upside change-negative">${report.targets.bear.downside_pct !== null ? `${fmt(report.targets.bear.downside_pct, 1, '%')}` : 'N/A'}</div>
      </div>
    </div>

    <h2>五、关键驱动因素 / Catalysts</h2>
    <div class="text-content">${report.catalysts_text}</div>

    <h2>六、核心风险 / Key Risks</h2>
    <div class="text-content">${report.risks_text}</div>

    <h2>七、技术面观点 / Technical View</h2>
    <div class="text-content">${report.tech_view_text}</div>
    ${report.techs.rsi_14 !== null || report.techs.ema_50 !== null ? `
    <h3>技术指标 / Technical Indicators</h3>
    <table class="data-table">
      <tr>
        <th>指标 / Indicator</th>
        <th>数值 / Value</th>
      </tr>
      ${report.techs.rsi_14 !== null ? `<tr><td>RSI(14)</td><td>${fmt(report.techs.rsi_14, 1)}</td></tr>` : ''}
      ${report.techs.ema_20 !== null ? `<tr><td>EMA(20)</td><td>${fmtCurrency(report.techs.ema_20, report.price.currency)}</td></tr>` : ''}
      ${report.techs.ema_50 !== null ? `<tr><td>EMA(50)</td><td>${fmtCurrency(report.techs.ema_50, report.price.currency)}</td></tr>` : ''}
      ${report.techs.ema_200 !== null ? `<tr><td>EMA(200)</td><td>${fmtCurrency(report.techs.ema_200, report.price.currency)}</td></tr>` : ''}
    </table>
    ` : ''}

    <h2>八、操作建议 / Action</h2>
    <div class="action-box">${report.action_text}</div>

    <div class="meta">
      <div class="meta-item">生成时间 / Generated：${new Date(report.meta.generated_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</div>
      <div class="meta-item">AI 模型 / Model：${report.meta.model}</div>
      <div class="meta-item">处理时长 / Latency：${report.meta.latency_ms}ms</div>
      <div class="meta-item">报告版本 / Version：${report.meta.version}</div>
    </div>

    <div class="disclaimer">
      <strong>免责声明 / Disclaimer</strong>
      本报告基于公开市场数据生成，仅供参考，不构成投资建议。投资者应独立判断并承担相应风险。This report is generated based on publicly available market data and is for reference only. It does not constitute investment advice. Investors should make independent judgments and bear corresponding risks.
    </div>
  </div>
</body>
</html>`;

  console.log(`✅ [HTML Generator] HTML complete for ${report.symbol}`);
  return html;
}

module.exports = {
  // v1 Generic API
  buildResearchReport,
  buildHtmlFromReport,
  
  // Legacy API (backward compatibility)
  buildSimpleReport,
  generateHTMLReport,
  generateMarkdownReport,
  convertHTMLtoPDF,
  generatePdfWithDocRaptor
};
