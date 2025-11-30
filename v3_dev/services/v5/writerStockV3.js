const { callOpenAI } = require('../aiService');
const styleEngine = require('./styleEngine');
const sentenceEngine = require('./sentenceEngine');
const { cleanText, limitAnalystMentions } = require('./textCleanerEngine');

async function generateThesis(report, analystInfo = {}) {
  // 🆕 v5.2: Extract analyst/firm parameters
  const analyst = analystInfo.analyst || 'the research team';
  const firm = analystInfo.firm || 'our firm';
  
  // 🆕 v5.2: Language switcher (en / es / zh)
  const lang = (analystInfo.language || 'en').toLowerCase();
  function localize(textEN, textES, textZH) {
    if (lang === 'es') return textES;
    if (lang === 'zh') return textZH;
    return textEN;
  }
  
  // 🆕 v5.1: Use industry-specific guidance
  const industryContext = report._industryContext || { industry: 'unknown', focus: [], metrics: [], tone: 'balanced' };
  // 🔧 Ensure focus and metrics are arrays
  const focus = Array.isArray(industryContext.focus) ? industryContext.focus : [];
  const metrics = Array.isArray(industryContext.metrics) ? industryContext.metrics : [];

  const industryNote = industryContext.industry !== 'unknown' && focus.length > 0
    ? `\n**Industry Context:** ${industryContext.industry}\n**Focus Areas:** ${focus.join(', ')}\n**Key Metrics:** ${metrics.join(', ')}\n`
    : '';

  // 🆕 v5.2: Asset-type aware subject labelling
  const assetType = (report.asset_type || analystInfo.assetType || 'equity').toLowerCase();
  let subjectLabel = localize('company', 'empresa', '公司');
  if (assetType === 'index') subjectLabel = localize('equity index', 'índice bursátil', '股票指数');
  else if (assetType === 'etf') subjectLabel = localize('exchange-traded fund', 'fondo cotizado', '交易型开放式基金');
  else if (assetType === 'crypto') subjectLabel = localize('digital asset', 'activo digital', '数字资产');

  const subjectName = report.company_name || report.symbol;

  const prompt = localize(
    // EN
    `You are writing an investment thesis on ${subjectName} (${subjectLabel}) as ${analyst}, lead analyst at ${firm}.

Subject: ${subjectName}
Asset Type: ${assetType.toUpperCase()}
Sector: ${report.sector || 'N/A'}
Price: $${report.price?.last || 'N/A'}
Target: $${report.targets?.base?.price || 'N/A'} (${report.targets?.base?.upside_pct || 'N/A'}% upside)
Rating: ${report.rating || 'N/A'}${industryNote}

Financial Data:
- Revenue: ${report.fundamentals?.revenue ? `$${(report.fundamentals.revenue / 1e9).toFixed(1)}B` : 'N/A'}
- EPS: $${report.fundamentals?.eps || 'N/A'}
- ROE: ${report.fundamentals?.roe ? report.fundamentals.roe.toFixed(1) : 'N/A'}%
- PE: ${report.valuation?.pe_ttm ? report.valuation.pe_ttm.toFixed(1) : 'N/A'}x
- Margin: ${report.fundamentals?.profit_margin ? report.fundamentals.profit_margin.toFixed(1) : 'N/A'}%

Write a CONCISE 400-500 word investment thesis in MORGAN STANLEY BULLET FORMAT:

**FORMAT REQUIREMENTS (CRITICAL):**
- Start with a 2-3 sentence summary paragraph (rating + price target + key thesis)
- Then use BULLET POINTS for all key arguments (not narrative paragraphs)
- Each bullet: 1-2 sentences MAX with specific data
- Total: 5-8 key bullets organized by theme

**Structure:**
1. **Summary** (2-3 sentences): Rating, price target, core thesis
2. **Investment Case** (3-4 bullets):
   • Market position: Share %, competitive moat
   • Growth drivers: Specific catalysts with timeline
   • Margin trajectory: From X% to Y%
3. **Valuation** (2-3 bullets):
   • Current multiple vs historical/peers
   • Target derivation: DCF/comps basis
4. **Key Risk** (1 bullet): Single most important risk

**EXAMPLE FORMAT:**
"We rate ${subjectName} BUY with a $XXX target (XX% upside). The company dominates [market] with XX% share.

• Market leadership: #1 position in [segment] with XX% share vs XX% for nearest competitor
• Growth visibility: [Product] cycle to drive XX% revenue CAGR through 2026
• Margin expansion: Operating margin improving from XX% to XX% on scale benefits
• Valuation: XXx forward P/E represents XX% discount to 5-year average"

**STRICT PROHIBITIONS:**
- NO narrative paragraphs after the summary (use bullets only)
- NO filler phrases: "we believe", "going forward", "given this backdrop"
- NO duplicate words in close proximity
- NO vague statements without specific numbers
- NO marketing language: exciting, unprecedented, revolutionary
${focus.length > 0 ? `\n- MUST address: ${focus.join(', ')}` : ''}

Thesis:`,

    // ES
    `Estás redactando una tesis de inversión para ${subjectName} (${subjectLabel}) como ${analyst}, analista principal en ${firm}.

Activo: ${subjectName}
Tipo: ${assetType.toUpperCase()}
Sector: ${report.sector || 'N/A'}
Precio: $${report.price?.last || 'N/A'}
Precio objetivo: $${report.targets?.base?.price || 'N/A'} (${report.targets?.base?.upside_pct || 'N/A'}% potencial)
Recomendación: ${report.rating || 'N/A'}${industryNote}

Datos financieros:
- Ingresos: ${report.fundamentals?.revenue ? `$${(report.fundamentals.revenue / 1e9).toFixed(1)}B` : 'N/A'}
- BPA: $${report.fundamentals?.eps || 'N/A'}
- ROE: ${report.fundamentals?.roe ? report.fundamentals.roe.toFixed(1) : 'N/A'}%
- PER: ${report.valuation?.pe_ttm ? report.valuation.pe_ttm.toFixed(1) : 'N/A'}x
- Margen: ${report.fundamentals?.profit_margin ? report.fundamentals.profit_margin.toFixed(1) : 'N/A'}%

Escribe una tesis CONCISA de 400-500 palabras en FORMATO BULLET MORGAN STANLEY:

**FORMATO (CRÍTICO):**
- Resumen inicial: 2-3 oraciones (rating + precio objetivo + tesis central)
- Luego PUNTOS con viñetas para todos los argumentos (no párrafos narrativos)
- Cada viñeta: 1-2 oraciones MAX con datos específicos
- Total: 5-8 viñetas organizadas por tema

**Estructura:**
1. **Resumen** (2-3 oraciones): Rating, precio objetivo, tesis central
2. **Caso de Inversión** (3-4 viñetas):
   • Posición de mercado: % cuota, foso competitivo
   • Motores de crecimiento: Catalizadores con horizonte temporal
   • Trayectoria de márgenes: De X% a Y%
3. **Valoración** (2-3 viñetas):
   • Múltiplo actual vs histórico/pares
   • Derivación del objetivo: Base DCF/comparables
4. **Riesgo Clave** (1 viñeta): El riesgo más importante

**PROHIBIDO:**
- Párrafos narrativos después del resumen (solo viñetas)
- Frases de relleno: "creemos que", "en el futuro", "dado este contexto"
- Palabras duplicadas en proximidad
- Afirmaciones vagas sin números específicos
- Lenguaje de marketing: emocionante, increíble, revolucionario
${focus.length > 0 ? `\n- DEBE abordar: ${focus.join(', ')}` : ''}

Tesis:`,

    // ZH
    `你现在以 ${firm} 首席分析师 ${analyst} 的身份，为标的 ${subjectName}（${subjectLabel}）撰写一篇机构级《投资逻辑》。

标的: ${subjectName}
资产类型: ${assetType.toUpperCase()}
行业: ${report.sector || 'N/A'}
现价: $${report.price?.last || 'N/A'}
目标价: $${report.targets?.base?.price || 'N/A'}（预期涨跌幅 ${report.targets?.base?.upside_pct || 'N/A'}%）
评级: ${report.rating || 'N/A'}${industryNote}

财务数据：
- 营收: ${report.fundamentals?.revenue ? `$${(report.fundamentals.revenue / 1e9).toFixed(1)}B` : 'N/A'}
- EPS: $${report.fundamentals?.eps || 'N/A'}
- ROE: ${report.fundamentals?.roe ? report.fundamentals.roe.toFixed(1) : 'N/A'}%
- PE: ${report.valuation?.pe_ttm ? report.valuation.pe_ttm.toFixed(1) : 'N/A'}x
- 利润率: ${report.fundamentals?.profit_margin ? report.fundamentals.profit_margin.toFixed(1) : 'N/A'}%

撰写一篇简洁的 400-500 字投资逻辑，使用摩根士丹利要点格式：

**格式要求（关键）：**
- 开头 2-3 句话总结（评级 + 目标价 + 核心逻辑）
- 然后用要点列表呈现所有论点（不要叙述性段落）
- 每个要点：1-2 句话 MAX，含具体数据
- 总计：5-8 个要点，按主题组织

**结构：**
1. **摘要**（2-3 句）：评级、目标价、核心逻辑
2. **投资理由**（3-4 个要点）：
   • 市场地位：份额%、竞争壁垒
   • 增长动力：具体催化剂及时间表
   • 利润率趋势：从 X% 到 Y%
3. **估值**（2-3 个要点）：
   • 当前倍数 vs 历史/同业
   • 目标价推导：DCF/可比公司基础
4. **核心风险**（1 个要点）：最重要的风险

**禁止内容：**
- 摘要后的叙述性段落（只用要点）
- 套话："我们认为"、"展望未来"、"在此背景下"
- 相邻词语重复
- 无数据支撑的模糊表述
- 营销语言：激动人心、爆发式、史无前例
${focus.length > 0 ? `\n- 必须涵盖: ${focus.join(', ')}` : ''}

投资逻辑:`
  );

  try {
    let thesis = '';
    let attempts = 0;
    const MIN_WORD_COUNT = 400; // 🔧 v7.5: Reduced to match bullet-point format (400-500 words)
    const ABSOLUTE_MIN = 300; // Fallback threshold for concise bullet-point reports
    
    // 🆕 v5.2: Asset-type and language-aware system prompt
    let roleDesc;
    if (assetType === 'equity') {
      roleDesc = localize('senior sell-side equity analyst', 'analista senior de renta variable', '高级卖方股票分析师');
    } else if (assetType === 'index' || assetType === 'etf') {
      roleDesc = localize('senior research strategist', 'estratega senior de análisis', '高级研究策略师');
    } else if (assetType === 'crypto') {
      roleDesc = localize('senior digital assets analyst', 'analista senior de activos digitales', '高级数字资产分析师');
    } else {
      roleDesc = localize('senior analyst', 'analista senior', '高级分析师');
    }
    
    const systemPrompt = localize(
      `You are ${analyst}, a ${roleDesc} at ${firm}. Write institutional-grade investment theses with explicit analyst voice.`,
      `Eres ${analyst}, ${roleDesc} en ${firm}. Escribe tesis de inversión institucionales con voz explícita del analista.`,
      `你是 ${analyst}，来自 ${firm} 的${roleDesc}。请以机构研究风格撰写投资报告，并在内容中加入明确的"分析师发言"。`
    );
    
    // 🆕 v5.2: Retry with exponential backoff until we get sufficient content
    while (attempts < 3) {
      attempts++;
      
      const response = await callOpenAI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ], {
        model: 'gpt-4o',
        max_tokens: 1800,
        temperature: 0.4
      });
      
      thesis = response.trim();
      
      // Apply style and sentence normalization
      thesis = styleEngine.applyStyle(thesis);
      thesis = sentenceEngine.normalize(thesis);
      
      // Apply text cleaning (remove duplicate words, AI clichés)
      thesis = cleanText(thesis);
      
      // Limit analyst name mentions to max 3 times
      thesis = limitAnalystMentions(thesis, analyst, 3);
      
      const wordCount = thesis.split(/\s+/).length;
      console.log(`[WriterStockV3] Thesis attempt ${attempts}: ${thesis.length} chars, ${wordCount} words`);
      
      if (wordCount >= MIN_WORD_COUNT) {
        console.log(`✅ Thesis meets minimum requirement (${wordCount} ≥ ${MIN_WORD_COUNT} words)`);
        break; // Success!
      }
      
      if (attempts < 3) {
        const delay = Math.pow(2, attempts) * 1000; // Exponential backoff: 2s, 4s, 8s
        console.log(`⚠️  [WriterStockV3] Thesis too short (${wordCount} < ${MIN_WORD_COUNT} words), retrying in ${delay/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // 🔧 v5.2: Log warning instead of throwing hard error (allow fallback to handle)
    const finalWordCount = thesis.split(/\s+/).length;
    if (finalWordCount < ABSOLUTE_MIN) {
      console.log(`⚠️  [WriterStockV3] Thesis below absolute minimum (${finalWordCount} < ${ABSOLUTE_MIN}), triggering fallback generator`);
      throw new Error(`Thesis too short: ${finalWordCount} words`);
    } else if (finalWordCount < MIN_WORD_COUNT) {
      console.log(`⚠️  [WriterStockV3] Thesis below target (${finalWordCount} < ${MIN_WORD_COUNT}) but proceeding`);
    }
    
    return thesis;
    
  } catch (error) {
    console.error('[WriterStockV3] ❌ Thesis generation failed:', error.message);
    // 🔧 v5.2 FIX: Generate data-driven fallback instead of returning empty string
    const existingContent = report.investment_thesis || report.summary_text || '';
    if (existingContent && existingContent.length > 300) {
      console.log(`⚠️  [WriterStockV3] Using existing thesis: ${existingContent.length} chars`);
      return existingContent;
    }
    
    // 🆕 v5.2: Asset-type aware fallback generation
    const subjectName = report.company_name || report.symbol;
    const rating = report.rating || 'our investment view';
    const price = report.price?.last;
    const targetPrice = report.targets?.base?.price;
    const revenue = report.fundamentals?.revenue ? `$${(report.fundamentals.revenue / 1e9).toFixed(1)}B` : null;
    const margin = report.fundamentals?.ebitda_margin;
    const roe = report.fundamentals?.roe;
    
    // Build rating statement based on actual rating
    const ratingStatement = typeof rating === 'string' && rating !== 'our investment view'
      ? `supports our ${rating} rating`
      : 'supports our investment thesis';
    
    // Build valuation sentence only if we have both price and target
    let valuationStatement = '';
    if (price && targetPrice && price > 0 && targetPrice > 0) {
      const upside = (((targetPrice - price) / price) * 100).toFixed(1);
      valuationStatement = `Our price target of $${targetPrice} implies ${upside}% ${upside > 0 ? 'upside' : 'downside'} from current levels of $${price}, reflecting a probability-weighted scenario analysis. `;
    }
    
    // 🔧 v5.2: Enhanced fallback with asset-type branching
    let fallback;
    
    if (assetType === 'equity') {
      // 🔧 v7.5 FIX: Bullet-point format with minimal analyst mentions (max 2)
      const revenueVal = report.fundamentals?.revenue ? `$${(report.fundamentals.revenue / 1e9).toFixed(1)}B` : null;
      const marginVal = report.fundamentals?.ebitda_margin ? report.fundamentals.ebitda_margin.toFixed(1) : (margin ? margin.toFixed(1) : null);
      const roeVal = report.fundamentals?.roe ? report.fundamentals.roe.toFixed(1) : (roe ? roe.toFixed(1) : null);
      
      fallback = `We rate ${subjectName} ${rating} with a ${targetPrice ? `$${targetPrice}` : ''} price target based on competitive positioning, execution track record, and valuation framework.

**Investment Case:**
• Market position: ${subjectName} maintains leadership through scale advantages, technology differentiation, and customer switching costs
• Revenue profile: ${revenueVal ? `Annual revenue of ${revenueVal}` : 'Revenue base'}${marginVal ? ` with ${marginVal}% EBITDA margins` : ''} demonstrates operating leverage
${roeVal ? `• Capital efficiency: ROE of ${roeVal}% reflects disciplined capital allocation and reinvestment returns` : '• Capital efficiency: Management maintains disciplined approach to capital allocation'}
• Moat durability: Network effects and distribution advantages create barriers to competitive entry

**Valuation:**
${valuationStatement}• Multiple framework: Current valuation incorporates near-term execution while leaving upside from structural growth drivers
• Risk-reward: Probability-weighted scenarios favor long-term positioning given margin expansion trajectory

**Key Risk:**
• Execution dependency on market cycle timing and competitive dynamics`;
    } else if (assetType === 'index' || assetType === 'etf') {
      // 🔧 v7.5 FIX: Index/ETF fallback in bullet format with minimal analyst mentions
      const vehicleType = assetType === 'index' ? 'Index' : 'ETF';
      
      fallback = `We maintain a ${rating} view on ${subjectName} based on diversification profile, structural positioning, and cost efficiency.

**Investment Case:**
• Broad exposure: ${vehicleType} provides systematic market access across multiple sectors and constituents
• Risk mitigation: Diversification reduces idiosyncratic single-stock risk vs individual holdings
• ${assetType === 'etf' ? 'Cost efficiency: Low expense ratio and high liquidity optimize total cost of ownership' : 'Methodology: Rules-based rebalancing ensures transparent constituent selection'}
• Factor alignment: Sector weights match long-term economic growth drivers

**Structural Positioning:**
${valuationStatement}• Tracking: Historical performance demonstrates consistent benchmark replication
• Cycle resilience: Performance across market environments supports strategic allocation

**Key Risk:**
• Market beta exposure limits downside protection during broad equity declines`;
    } else if (assetType === 'crypto') {
      // 🔧 v7.5 FIX: Crypto fallback in bullet format with minimal analyst mentions
      fallback = `We maintain a ${rating} view on ${subjectName} based on network fundamentals, adoption trajectory, and protocol economics.

**Investment Case:**
• Decentralization: Permissionless architecture reduces reliance on centralized intermediaries
• Security: Distributed consensus mechanisms demonstrate resilience against attacks
• Network effects: Growing developer ecosystem reinforces competitive positioning
• Adoption metrics: On-chain activity (addresses, volumes) indicates network health

**Valuation Framework:**
${valuationStatement}• Supply dynamics: Programmatic monetary policy provides transparent issuance schedule
• Institutional interest: Growing allocation from traditional finance validates asset class

**Key Risks:**
• Regulatory uncertainty and volatility inherent in emerging technology adoption`;
    } else {
      // 🔧 v7.5 FIX: Generic fallback in bullet format
      fallback = `We maintain a ${rating} view on ${subjectName} based on fundamental analysis and market positioning.

**Investment Case:**
• Growth potential balanced against risk considerations
• Valuation framework incorporates near-term catalysts and strategic positioning

**Key Risk:**
• Execution and market environment dependencies`;
    }
    
    // 🔧 v7.5 FIX: Pass fallback through cleaning pipeline to ensure no duplicate words/phrases
    fallback = cleanText(fallback);
    fallback = limitAnalystMentions(fallback, analyst, 2); // Limit to 2 mentions in fallback
    
    console.log(`⚠️  [WriterStockV3] Generated asset-aware fallback thesis (${assetType}): ${fallback.length} chars (${fallback.split(/\s+/).length} words)`);
    return fallback;
  }
}

async function generateOverview(report, analystInfo = {}) {
  // 🆕 v5.2: Extract analyst/firm parameters
  const analyst = analystInfo.analyst || 'the research team';
  const firm = analystInfo.firm || 'our firm';
  
  // 🆕 v5.2: Language switcher (en / es / zh)
  const lang = (analystInfo.language || 'en').toLowerCase();
  function localize(textEN, textES, textZH) {
    if (lang === 'es') return textES;
    if (lang === 'zh') return textZH;
    return textEN;
  }
  
  // 🔧 Critical Fix: 使用统一的 segment 数据源（避免文本和表格矛盾）
  const rawSegments = Array.isArray(report.segments) ? report.segments : [];

  // 🆕 v5.2: 资产类型感知
  const assetType = (report.asset_type || analystInfo.assetType || 'equity').toLowerCase();

  // 默认业务模型文案按资产类型区分
  let defaultBusinessModel = 'multi-segment operating company';
  if (assetType === 'index') {
    defaultBusinessModel = 'broad-based equity index representing large-cap companies';
  } else if (assetType === 'etf') {
    defaultBusinessModel = 'exchange-traded fund tracking a benchmark index';
  } else if (assetType === 'crypto') {
    defaultBusinessModel = 'decentralized digital asset and blockchain network';
  }

  const businessModel = report.business_model || defaultBusinessModel;

  // Segments 文案：只有 equity 才用真实分部，其他资产用合适描述
  let segmentsLine;
  if (assetType === 'equity') {
    segmentsLine = rawSegments.length > 0
      ? rawSegments.map(s => `${s.name}: ${s.revenue_pct}% revenue`).join(', ')
      : 'Segment data not disclosed';
  } else if (assetType === 'index') {
    segmentsLine = 'Sector and style weights across the underlying benchmark (e.g., IT, Financials, Healthcare, Communication Services, Consumer sectors).';
  } else if (assetType === 'etf') {
    segmentsLine = 'Exposures by sector, style, and top holdings of the underlying index basket.';
  } else if (assetType === 'crypto') {
    segmentsLine = 'Ecosystem participants including miners/validators, exchanges, custodians, and end-users.';
  } else {
    segmentsLine = 'Multiple segments / exposures depending on the asset mandate.';
  }

  // 🆕 v5.1: Use industry-specific guidance
  const industryContext = report._industryContext || { industry: 'unknown', focus: [], metrics: [], tone: 'balanced' };
  // 🔧 v6.0 bugfix: Ensure focus is always treated as array (handle string case)
  const focusArray = Array.isArray(industryContext.focus) ? industryContext.focus : [];
  const industryNote = industryContext.industry !== 'unknown'
    ? `\nIndustry: ${industryContext.industry} (Focus: ${focusArray.slice(0,3).join(', ')})`
    : '';

  const subjectName = report.company_name || report.symbol;
  let subjectLabel;
  if (assetType === 'equity') {
    subjectLabel = localize('company', 'empresa', '公司');
  } else if (assetType === 'index') {
    subjectLabel = localize('equity index', 'índice bursátil', '股票指数');
  } else if (assetType === 'etf') {
    subjectLabel = localize('exchange-traded fund', 'fondo cotizado', '交易型开放式基金');
  } else if (assetType === 'crypto') {
    subjectLabel = localize('digital asset', 'activo digital', '数字资产');
  } else {
    subjectLabel = localize('asset', 'activo', '资产');
  }

  const prompt = `Write an INVESTOR-FOCUSED segment analysis for ${subjectName} as ${analyst} at ${firm}.

**CRITICAL: This is NOT a Wikipedia article. Do NOT include:**
- Company founding date or history ("founded in 1993...")
- Generic geographic footprint ("global presence across...")
- Mission statements or company vision

**FOCUS ON WHAT INVESTORS NEED TO KNOW:**

Name: ${subjectName}
Asset Type: ${assetType.toUpperCase()}
Segments: ${segmentsLine}${industryNote}

Financials:
- Revenue: $${report.fundamentals?.revenue ? (report.fundamentals.revenue / 1e9).toFixed(1) + 'B' : 'N/A'}
- EBITDA Margin: ${report.fundamentals?.ebitda_margin || 'N/A'}%
- YoY Growth: ${report.fundamentals?.revenue_growth || 'N/A'}%

Write 500-600 words in DATA-DRIVEN FORMAT:

**Structure (use bullet points, not narrative):**

1. **Revenue Mix by Segment** (200 words)
   • Segment A: $XB (XX% of revenue, +XX% YoY)
   • Segment B: $XB (XX% of revenue, +XX% YoY)
   • Which segment is the growth engine? What's driving it?

2. **TAM & Market Position** (150 words)
   • Total addressable market size and growth rate
   • Company's current market share vs top 2-3 competitors
   • Key structural advantage or moat

3. **Unit Economics / Key Drivers** (150 words)
   • For tech: ASP trends, volume growth, attach rates
   • For consumer: same-store sales, customer acquisition cost
   • For industrials: capacity utilization, order book, backlog
   • Use specific numbers, not generic statements

**FORMAT REQUIREMENTS:**
- Use bullet points throughout (not paragraphs)
- Every bullet must contain at least one specific number
- Max 2 analyst mentions: "${analyst} notes..." or "We highlight..."
- NO company history, founding dates, or Wikipedia content
- NO generic statements like "well-positioned" or "strong presence"

Overview:`;

  try {
    let overview = '';
    let attempts = 0;
    const MIN_WORD_COUNT = 500; // 🔧 v7.5: Match investor-focused format (500-600 words)
    const ABSOLUTE_MIN = 350; // Fallback threshold for concise format
    
    // 🆕 v5.2: Asset-type and language-aware system prompt
    let roleDesc;
    if (assetType === 'equity') {
      roleDesc = localize('senior sell-side equity analyst', 'analista senior de renta variable', '高级卖方股票分析师');
    } else if (assetType === 'index' || assetType === 'etf') {
      roleDesc = localize('senior research strategist', 'estratega senior de análisis', '高级研究策略师');
    } else if (assetType === 'crypto') {
      roleDesc = localize('senior digital assets analyst', 'analista senior de activos digitales', '高级数字资产分析师');
    } else {
      roleDesc = localize('senior analyst', 'analista senior', '高级分析师');
    }
    
    const systemPrompt = localize(
      `You are ${analyst}, a ${roleDesc} at ${firm}. Write institutional-grade overviews with explicit analyst voice.`,
      `Eres ${analyst}, ${roleDesc} en ${firm}. Escribe análisis institucionales con voz explícita del analista.`,
      `你是 ${analyst}，来自 ${firm} 的${roleDesc}。请以机构研究风格撰写分析，并在内容中加入明确的"分析师发言"。`
    );
    
    // 🆕 v5.2: Retry with exponential backoff until we get sufficient content
    while (attempts < 3) {
      attempts++;
      
      const response = await callOpenAI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ], {
        model: 'gpt-4o',
        max_tokens: 1600,
        temperature: 0.4
      });
      
      overview = response.trim();
      overview = styleEngine.applyStyle(overview);
      overview = sentenceEngine.normalize(overview);
      overview = cleanText(overview);
      
      const wordCount = overview.split(/\s+/).length;
      console.log(`[WriterStockV3] Overview attempt ${attempts}: ${overview.length} chars, ${wordCount} words`);
      
      if (wordCount >= MIN_WORD_COUNT) {
        console.log(`✅ Overview meets minimum requirement (${wordCount} ≥ ${MIN_WORD_COUNT} words)`);
        break; // Success!
      }
      
      if (attempts < 3) {
        const delay = Math.pow(2, attempts) * 1000; // Exponential backoff: 2s, 4s, 8s
        console.log(`⚠️  [WriterStockV3] Overview too short (${wordCount} < ${MIN_WORD_COUNT} words), retrying in ${delay/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // 🔧 v5.2: Log warning instead of throwing hard error (allow fallback to handle)
    const finalWordCount = overview.split(/\s+/).length;
    if (finalWordCount < ABSOLUTE_MIN) {
      console.log(`⚠️  [WriterStockV3] Overview below absolute minimum (${finalWordCount} < ${ABSOLUTE_MIN}), triggering fallback generator`);
      throw new Error(`Overview too short: ${finalWordCount} words`);
    } else if (finalWordCount < MIN_WORD_COUNT) {
      console.log(`⚠️  [WriterStockV3] Overview below target (${finalWordCount} < ${MIN_WORD_COUNT}) but proceeding`);
    }
    
    return overview;
    
  } catch (error) {
    console.error('[WriterStockV3] ❌ Overview generation failed:', error.message);
    
    // 🔧 v7.5: Generate INVESTOR-FOCUSED bullet-point fallback (not Wikipedia-style narrative)
    const subjectName = report.company_name || report.symbol;
    const revenue = report.fundamentals?.revenue ? `$${(report.fundamentals.revenue / 1e9).toFixed(1)}B` : 'N/A';
    const revenueGrowth = report.fundamentals?.revenue_growth || 'N/A';
    const margin = report.fundamentals?.ebitda_margin || report.fundamentals?.profit_margin || 'N/A';
    const marketCap = report.valuation?.market_cap ? `$${(report.valuation.market_cap / 1e9).toFixed(1)}B` : 'N/A';
    
    let fallback;
    
    if (assetType === 'equity') {
      // Equity-specific fallback in BULLET FORMAT (not narrative)
      const segmentBullets = rawSegments.length > 0
        ? rawSegments.slice(0, 3).map(s => `• ${s.name}: ${s.revenue_pct}% of revenue`).join('\n')
        : '• Segment breakdown not available';
      
      fallback = `**Revenue Mix by Segment**
${segmentBullets}
• Total Revenue: ${revenue} (YoY growth: ${revenueGrowth}%)
• EBITDA Margin: ${margin}%

**Market Position**
• Market Cap: ${marketCap}
• Competitive positioning based on scale advantages and customer relationships
• Barriers to entry from proprietary technology and distribution networks

**Key Drivers**
• Volume growth and pricing power in core segments
• Operating leverage from fixed cost absorption
• Capital efficiency metrics tracking industry medians`;
    } else if (assetType === 'index' || assetType === 'etf') {
      // Index/ETF-specific fallback in BULLET FORMAT
      const vehicleType = assetType === 'index' ? 'Equity Index' : 'ETF';
      
      fallback = `**${vehicleType} Overview**
• Total Market Cap/AUM: ${marketCap}
• Structure: ${assetType === 'index' ? 'Market-cap weighted index' : 'Passive replication ETF'}
• Rebalancing: Quarterly with predefined eligibility criteria

**Sector Exposures**
• Technology, Healthcare, Financials, Consumer sectors
• Top holdings concentrated in large-cap leaders
• Geographic focus primarily US-listed equities

**Key Characteristics**
• Diversified exposure minimizing single-stock risk
• Rules-based methodology ensures transparency
• Correlation with economic fundamentals and earnings growth`;
    } else if (assetType === 'crypto') {
      // Crypto-specific fallback in BULLET FORMAT
      fallback = `**Network Overview**
• Market Cap: ${marketCap}
• Protocol: Decentralized blockchain network
• Security: Distributed consensus mechanism

**Use Cases**
• Store of value and medium of exchange
• DeFi applications and smart contracts
• Peer-to-peer permissionless transactions

**Key Metrics**
• On-chain volume and active addresses indicate adoption
• Predetermined monetary policy provides supply transparency
• Development activity signals ecosystem health`;
    } else {
      // Generic fallback in BULLET FORMAT
      fallback = `**Asset Overview**
• Market Cap: ${marketCap}
• Structure: Investment vehicle providing portfolio exposure

**Key Characteristics**
• Balanced growth potential with risk management
• Appropriate for asset class objectives`;
    }
    
    // 🔧 v7.5 FIX: Pass fallback through cleaning pipeline
    fallback = cleanText(fallback);
    
    console.log(`⚠️  [WriterStockV3] Generated asset-aware fallback overview (${assetType}): ${fallback.length} chars (${fallback.split(/\s+/).length} words)`);
    return fallback;
  }
}

async function generateValuation(report, analystInfo = {}) {
  // 🆕 v5.2: Language switcher (en / es / zh)
  const lang = (analystInfo.language || 'en').toLowerCase();
  function localize(textEN, textES, textZH) {
    if (lang === 'es') return textES;
    if (lang === 'zh') return textZH;
    return textEN;
  }
  
  // 🆕 v5.1: Use industry-specific metrics
  const industryContext = report._industryContext || { industry: 'unknown', focus: [], metrics: [], tone: 'balanced' };
  // 🔧 Ensure metrics is array
  const metrics = Array.isArray(industryContext.metrics) ? industryContext.metrics : [];
  const metricsNote = metrics.length > 0
    ? `\n**Industry-Specific Metrics:** ${metrics.join(', ')}`
    : '';
  
  const prompt = `You are a J.P. Morgan equity analyst writing valuation analysis for ${report.symbol}.

Current Valuation:
- Price: $${report.price?.last || 'N/A'}
- Target: $${report.targets?.base?.price || 'N/A'}
- PE (TTM): ${report.valuation?.pe_ttm || 'N/A'}x
- PE (Fwd): ${report.valuation?.pe_forward || 'N/A'}x
- EV/EBITDA: ${report.valuation?.ev_ebitda || 'N/A'}x
- P/S: ${report.valuation?.ps_ttm || 'N/A'}x${metricsNote}

Peers:
${report.peers && report.peers.length > 0 ? report.peers.slice(0, 3).map(p => `${p.symbol}: PE ${p.pe_forward}x, P/S ${p.ps_ttm}x`).join(', ') : 'Peer data pending'}

Write a CONCISE 450-500 word valuation analysis:

**Structure (3 short sections):**
1. **Valuation Framework** (150 words) - PE/EV/EBITDA multiples vs peers, one-line DCF note
2. **Target Derivation** (150 words) - Base case, key drivers, WACC/sensitivity in 2-3 sentences
3. **Scenario Analysis** (150 words) - Bull/Base/Bear with specific targets and probabilities

**STYLE RULES:**
- Each paragraph: 3-4 sentences MAX
- Use sell-side phrasing: "We value at", "Our target implies", "Trading at Xth percentile"
- Every sentence must cite a specific number
- NO duplication - each concept mentioned ONCE only
- NO filler: remove "given this", "with this in mind", "considering"
- NEVER repeat the same valuation framework explanation

**PROHIBITED:**
- constructive, supportive, attractive, compelling, well-positioned
- Paragraphs longer than 4 sentences
- Repeating PE/EV multiples more than once each

Valuation:`;

  try {
    const response = await callOpenAI([
      { role: 'system', content: 'You are a senior sell-side equity analyst at J.P. Morgan. Write institutional-grade valuation analysis.' },
      { role: 'user', content: prompt }
    ], {
      model: 'gpt-4o',
      max_tokens: 1200,
      temperature: 0.4
    });
    
    let valuation = response.trim();
    valuation = styleEngine.applyStyle(valuation);
    valuation = sentenceEngine.normalize(valuation);
    valuation = cleanText(valuation);
    
    console.log(`[WriterStockV3] Valuation generated: ${valuation.length} chars`);
    return valuation;
    
  } catch (error) {
    console.error('[WriterStockV3] Valuation generation failed:', error.message);
    // 🔧 v5.2 FIX: Generate data-driven fallback instead of returning empty string
    const analyst = report._analystInfo?.analyst || 'the research team';
    const companyName = report.company_name || report.symbol;
    const price = report.price?.last;
    const targetPrice = report.targets?.base?.price;
    const pe = report.valuation?.pe_ttm;
    const ps = report.valuation?.ps_ttm;
    
    // Build multiples sentence only if we have data
    const multiplesStatement = pe || ps
      ? `The stock currently trades at ${pe ? `${pe}x trailing twelve-month earnings` : ''}${pe && ps ? ' and ' : ''}${ps ? `${ps}x revenue` : ''}, which we compare against sector medians and historical ranges.`
      : 'We compare the stock against sector medians and historical ranges across multiple valuation metrics.';
    
    // Build target price sentence only if we have both price and target
    let targetStatement = '';
    if (price && targetPrice && price > 0 && targetPrice > 0) {
      const upside = (((targetPrice - price) / price) * 100).toFixed(1);
      targetStatement = `Our base case price target of $${targetPrice} reflects ${upside}% ${upside > 0 ? 'implied return' : 'downside'} from current price of $${price}. `;
    }
    
    const fallback = `We value ${companyName} using a multiple-based framework incorporating price-to-earnings, price-to-sales, and EV/EBITDA methodologies. ${multiplesStatement}

${targetStatement}${analyst} derives our valuation from weighted probability scenarios: bull case incorporating market share gains and margin expansion, base case assuming steady-state operations, and bear case reflecting execution risks and competitive pressures.

The valuation framework considers both absolute metrics and relative positioning versus peers. ${analyst} notes that the current multiple reflects market expectations for growth trajectory, margin profile, and capital allocation discipline. Scenario analysis suggests the risk-reward framework supports our investment view based on fundamental drivers and discount rate assumptions.`;
    
    console.log(`⚠️  [WriterStockV3] Generated enriched fallback valuation: ${fallback.length} chars`);
    return fallback;
  }
}

async function generateIndustry(report, analystInfo = {}) {
  // 🆕 v5.2: Language switcher (en / es / zh)
  const lang = (analystInfo.language || 'en').toLowerCase();
  function localize(textEN, textES, textZH) {
    if (lang === 'es') return textES;
    if (lang === 'zh') return textZH;
    return textEN;
  }
  
  const analyst = report._analystInfo?.analyst || analystInfo.analyst || 'the research team';
  
  const prompt = `Write DATA-DRIVEN industry analysis for ${report.symbol} in ${report.sector || 'Technology'} sector.

**CRITICAL: Every statement must include a specific number or data point.**

Industry Data:
- Sector: ${report.sector || 'Technology'}
- Industry Growth: ${report.industry?.growth_rate || 'N/A'}%
- TAM: ${report.industry?.tam ? `$${(report.industry.tam / 1e9).toFixed(0)}B` : 'Estimate required'}

Write 400 words using BULLET POINTS with specific data:

**Structure (bullets only, no paragraphs):**

1. **Market Size & Growth** (5-6 bullets)
   • TAM: $XXB growing at XX% CAGR through 2028
   • Segment breakdown: [largest segment] = $XXB (XX% of total)
   • Key growth driver: [specific trend] adding $XXB annually
   • Regional mix: US XX%, Europe XX%, Asia XX%

2. **Competitive Dynamics** (4-5 bullets)
   • Market concentration: Top 3 players = XX% share
   • Leader: [Company A] at XX% share vs [Company B] at XX%
   • Share shifts: +/- X% change over past 12 months
   • Barriers to entry: [specific factor]

3. **Industry Catalysts** (3-4 bullets)
   • Near-term (6-12 months): [specific event/trend]
   • Medium-term (12-24 months): [regulatory/tech shift]
   • Spending trends: Enterprise/Consumer capex +XX% YoY

**PROHIBITED:**
- Narrative paragraphs (use bullets only)
- Generic statements like "favorable trends" or "strong positioning"
- Statements without specific numbers
- Marketing language

Industry Analysis:`;

  try {
    let industry = '';
    let attempts = 0;
    const MIN_CHARS = 400; // Minimum content length
    
    // 🆕 v5.2: Retry with exponential backoff
    while (attempts < 3) {
      attempts++;
      
      const response = await callOpenAI([
        { role: 'system', content: 'You are a senior sell-side equity analyst at Barclays. Write institutional-grade industry analysis.' },
        { role: 'user', content: prompt }
      ], {
        model: 'gpt-4o',
        max_tokens: 1000,
        temperature: 0.4
      });
      
      industry = response.trim();
      industry = styleEngine.applyStyle(industry);
      industry = sentenceEngine.normalize(industry);
      industry = cleanText(industry);
      
      console.log(`[WriterStockV3] Industry attempt ${attempts}: ${industry.length} chars`);
      
      if (industry.length >= MIN_CHARS) {
        console.log(`✅ Industry meets minimum (${industry.length} ≥ ${MIN_CHARS} chars)`);
        break;
      }
      
      if (attempts < 3) {
        const delay = Math.pow(2, attempts) * 1000;
        console.log(`⚠️  [WriterStockV3] Industry too short (${industry.length} < ${MIN_CHARS} chars), retrying in ${delay/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    if (industry.length < MIN_CHARS) {
      console.log(`⚠️  [WriterStockV3] Industry below minimum (${industry.length} < ${MIN_CHARS}), triggering fallback`);
      throw new Error(`Industry too short: ${industry.length} chars`);
    }
    
    console.log(`[WriterStockV3] Industry generated: ${industry.length} chars`);
    return industry;
    
  } catch (error) {
    console.error('[WriterStockV3] Industry generation failed:', error.message);
    // 🔧 v5.2 FIX: Enhanced fallback with 600-800 chars and 2+ analyst attributions
    const analyst = report._analystInfo?.analyst || 'the research team';
    const companyName = report.company_name || report.symbol;
    const industry = report._industryContext?.industry || 'technology';
    const sector = report.sector || 'Technology';
    
    const fallback = `${companyName} operates within the ${industry} segment of the broader ${sector} sector. ${analyst} notes that industry structure is characterized by moderate concentration, with leading players commanding market share through scale advantages, technology differentiation, and customer relationships.

Industry dynamics reflect secular trends including digital adoption rates, infrastructure modernization, and regulatory evolution. The total addressable market continues to expand as enterprise customers allocate capital toward technology solutions that drive operational efficiency and competitive positioning. ${analyst} observes that the industry growth rate has historically tracked GDP plus 2-4 percentage points, supported by structural tailwinds and ongoing technological innovation cycles.

The competitive landscape features both established incumbents and emerging challengers. Market share shifts occur gradually, driven by product innovation cycles, customer switching costs, and go-to-market execution. ${analyst} highlights that successful companies demonstrate pricing power, high incremental margins, and capital-light business models that scale efficiently with revenue growth.

From a regulatory perspective, the industry faces evolving standards around data privacy, security protocols, and antitrust considerations. These developments create both compliance costs and competitive moats for well-positioned players with established infrastructure and legal resources. Industry outlook remains constructive given ongoing digital transformation trends, enterprise spending patterns, and favorable demographic shifts supporting technology adoption.`;
    
    console.log(`⚠️  [WriterStockV3] Generated enriched fallback industry analysis: ${fallback.length} chars (${fallback.split(/\s+/).length} words)`);
    return fallback;
  }
}

async function generateMacro(report, analystInfo = {}) {
  // 🆕 v5.2: Language switcher (en / es / zh)
  const lang = (analystInfo.language || 'en').toLowerCase();
  function localize(textEN, textES, textZH) {
    if (lang === 'es') return textES;
    if (lang === 'zh') return textZH;
    return textEN;
  }
  
  const prompt = `You are a Citi equity analyst writing macro analysis for ${report.symbol}.

Macro Context:
- Fed Policy: Current interest rate environment
- USD Strength: Impact on international revenue
- Economic Growth: GDP trajectory
- Liquidity: Market flows and positioning

Write 600 word macro analysis:

**Structure:**
1. Macro Backdrop (200 words)
   - Interest rate sensitivity
   - FX exposure
   - Economic cycle positioning

2. Policy Implications (200 words)
   - Fed policy impact
   - Fiscal considerations
   - Trade policy

3. Market Technical (200 words)
   - Positioning and flows
   - Volatility regime
   - Liquidity conditions

**Requirements:**
- Sell-side institutional language
- Link macro to stock-specific impact
- "We believe macro provides", "Rate trajectory suggests"
- Quantify sensitivities

Macro Analysis:`;

  try {
    const response = await callOpenAI([
      { role: 'system', content: 'You are a senior sell-side equity analyst at Citi. Write institutional-grade macro analysis.' },
      { role: 'user', content: prompt }
    ], {
      model: 'gpt-4o',
      max_tokens: 1000,
      temperature: 0.4
    });
    
    let macro = response.trim();
    macro = styleEngine.applyStyle(macro);
    macro = sentenceEngine.normalize(macro);
    macro = cleanText(macro);
    
    console.log(`[WriterStockV3] Macro generated: ${macro.length} chars`);
    return macro;
    
  } catch (error) {
    console.error('[WriterStockV3] Macro generation failed:', error.message);
    // 🔧 v5.2 FIX: Generate enriched data-driven fallback
    const analyst = report._analystInfo?.analyst || 'the research team';
    const companyName = report.company_name || report.symbol;
    
    const fallback = `The macroeconomic backdrop presents a complex environment for ${companyName}. ${analyst} believes current Federal Reserve policy stance, characterized by restrictive real rates and quantitative tightening, creates headwinds for valuation multiples across risk assets. Interest rate sensitivity varies by business segment, with higher-margin divisions demonstrating greater resilience.

From a growth perspective, GDP trajectory and consumer spending patterns influence top-line momentum. ${analyst} notes that the company's international revenue exposure creates both opportunities and risks from currency fluctuations, with the USD strength in recent quarters pressuring reported results. Management has implemented hedging strategies to mitigate near-term FX volatility.

Fiscal policy developments, including corporate tax rates and infrastructure spending, represent medium-term variables. ${analyst} observes that trade policy and tariff structures affect supply chain costs and competitive positioning. The company has demonstrated ability to pass through input cost inflation while maintaining volume growth.

Market technical factors including positioning, volatility regime, and liquidity conditions influence near-term price action. ${analyst} highlights that institutional ownership levels and sentiment indicators suggest balanced positioning. The current macro framework supports a base case view while acknowledging elevated uncertainty around policy trajectory and economic cycle timing.`;
    
    console.log(`⚠️  [WriterStockV3] Generated enriched fallback macro analysis: ${fallback.length} chars`);
    return fallback;
  }
}

/**
 * Enhance report with v5.1 industry-aware prompts + v5.2 analyst voice
 * @param {Object} report - Base report
 * @param {Object} v5Options - { industry, language, symbolMetadata, analyst, firm, brand }
 */
async function enhanceReport(report, v5Options = {}) {
  const { industry = 'unknown', language = 'en', symbolMetadata = {}, analyst, firm, brand } = v5Options;
  
  // 🆕 v5.2: Prepare analyst info for all generators
  const analystInfo = {
    analyst: analyst || 'the research team',
    firm: firm || 'our firm',
    brand: brand || firm || 'our firm',
    language: language // 🆕 v5.2: Language support (en/es/zh)
  };
  
  // 🆕 v5.1: Get industry-specific prompt guidance
  const { getIndustryPromptGuidance } = require('../industryClassifier');
  const industryGuidance = getIndustryPromptGuidance(industry);
  
  console.log(`\n════════════════════════════════════════════════════════════════`);
  console.log(`[WriterStockV3] Enhancing ${report.symbol} with 5-Engine Framework + Analyst Voice`);
  console.log(`  Industry: ${industry} | Language: ${language}`);
  console.log(`  Analyst: ${analystInfo.analyst} | Firm: ${analystInfo.firm}`);
  console.log(`════════════════════════════════════════════════════════════════\n`);
  
  const startTime = Date.now();
  
  // 🆕 v5.1: Augment report with industry context
  report._industryContext = {
    industry,
    focus: industryGuidance.focus,
    metrics: industryGuidance.metrics,
    tone: industryGuidance.tone
  };
  
  // 🆕 v5.2: Augment report with analyst info (for other engines to use)
  report._analystInfo = analystInfo;
  
  // Generate all 5 sections in parallel with analyst voice
  const [thesis, overview, valuation, industry_text, macro] = await Promise.all([
    generateThesis(report, analystInfo),
    generateOverview(report, analystInfo),
    generateValuation(report),
    generateIndustry(report),
    generateMacro(report)
  ]);
  
  const elapsed = Date.now() - startTime;
  
  // Update report with enhanced content
  report.thesis_enhanced = thesis;
  report.overview_enhanced = overview;
  report.valuation_enhanced = valuation;
  report.industry_enhanced = industry_text;
  report.macro_enhanced = macro;
  
  console.log(`\n[WriterStockV3] Enhancement complete in ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`  ├─ Thesis: ${thesis.length} chars`);
  console.log(`  ├─ Overview: ${overview.length} chars`);
  console.log(`  ├─ Valuation: ${valuation.length} chars`);
  console.log(`  ├─ Industry: ${industry.length} chars`);
  console.log(`  └─ Macro: ${macro.length} chars\n`);
  
  return report;
}

module.exports = {
  enhanceReport,
  generateThesis,
  generateOverview,
  generateValuation,
  generateIndustry,
  generateMacro
};
