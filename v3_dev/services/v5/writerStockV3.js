const { callOpenAI } = require('../aiService');
const styleEngine = require('./styleEngine');
const sentenceEngine = require('./sentenceEngine');
const { cleanText } = require('./textCleanerEngine');

async function generateThesis(report, analystInfo = {}) {
  // 🆕 v5.2: Extract analyst/firm parameters
  const analyst = analystInfo.analyst || 'the research team';
  const firm = analystInfo.firm || 'our firm';
  
  // 🆕 v5.1: Use industry-specific guidance
  const industryContext = report._industryContext || { industry: 'unknown', focus: [], metrics: [], tone: 'balanced' };
  // 🔧 Ensure focus and metrics are arrays
  const focus = Array.isArray(industryContext.focus) ? industryContext.focus : [];
  const metrics = Array.isArray(industryContext.metrics) ? industryContext.metrics : [];
  const industryNote = industryContext.industry !== 'unknown' && focus.length > 0
    ? `\n**Industry Context:** ${industryContext.industry}\n**Focus Areas:** ${focus.join(', ')}\n**Key Metrics:** ${metrics.join(', ')}\n`
    : '';
  
  const prompt = `You are writing an investment thesis for ${report.symbol} as ${analyst}, lead analyst at ${firm}.

Company: ${report.company_name || report.symbol}
Sector: ${report.sector || 'N/A'}
Price: $${report.price?.last || 'N/A'}
Target: $${report.targets?.base?.price || 'N/A'} (${report.targets?.base?.upside_pct || 'N/A'}% upside)
Rating: ${report.rating || 'N/A'}${industryNote}

Financial Data:
- Revenue: ${report.fundamentals?.revenue ? `$${(report.fundamentals.revenue / 1e9).toFixed(1)}B` : 'N/A'}
- EPS: $${report.fundamentals?.eps || 'N/A'}
- ROE: ${report.fundamentals?.roe || 'N/A'}%
- PE: ${report.valuation?.pe_ttm || 'N/A'}x
- Margin: ${report.fundamentals?.profit_margin || 'N/A'}%

Write a 900-1000 word institutional investment thesis with **ANALYST VOICE**:

**CRITICAL - Analyst Voice Requirements:**
- Include AT LEAST 3 explicit analyst references using ${analyst}'s name:
  * "In ${analyst}'s view, ..."
  * "${analyst} argues that ..."
  * "According to ${analyst}, ..."
  * "${analyst} highlights that ..."
  * "As ${analyst} notes, ..."
- Make it feel like ${analyst} is personally presenting this analysis
- Use a mix of "we" (for the research team) and direct analyst attribution

**Structure:**
1. Core Investment Rationale (250-300 words)
   - Lead with strongest bull case (with analyst attribution)
   - Quantify opportunity size
   - State conviction level

2. Competitive Position (350 words)
   - Market leadership metrics
   - Structural advantages
   - Barriers to entry
   - Include at least 1 analyst voice reference here

3. Financial Framework (300-350 words)
   - Margin trajectory
   - Capital efficiency
   - Cash generation
   - Include at least 1 analyst voice reference here

**Requirements:**
- Mix "we" (research team) with explicit ${analyst} attributions
- Include specific numbers and timeframes
- **PROHIBITED WORDS**: exciting, amazing, poised to, well-positioned, compelling, attractive, robust
- **REQUIRED**: Every claim must cite a specific metric, percentage, or dollar figure
- **MINIMUM LENGTH**: 900 words (this is critical - do NOT write less than 800 words)
- 3 subheaders minimum
- Tone: ${industryContext.tone} (institutional sell-side style)${focus.length > 0 ? `\n- MUST address these industry-specific factors: ${focus.join(', ')}` : ''}${metrics.length > 0 ? `\n- Prioritize these metrics: ${metrics.slice(0,4).join(', ')}` : ''}

Thesis:`;

  try {
    let thesis = '';
    let attempts = 0;
    const MIN_WORD_COUNT = 900; // 🔧 Architect fix: Match prompt requirement (900-1000 words)
    const ABSOLUTE_MIN = 600; // Fallback threshold
    
    // 🆕 v5.2: Retry with exponential backoff until we get sufficient content
    while (attempts < 3) {
      attempts++;
      
      const response = await callOpenAI([
        { role: 'system', content: `You are ${analyst}, a senior sell-side equity analyst at ${firm}. Write institutional-grade investment theses with your personal analytical voice.` },
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
    
    // Generate enriched data-driven thesis with institutional tone
    const companyName = report.company_name || report.symbol;
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
    
    // Build financial metrics sentence
    const metricsStatement = revenue
      ? `The company generates annual revenue of ${revenue}${margin ? ` with EBITDA margins of ${margin}%` : ''}${roe ? ` and ROE of ${roe}%` : ''}, reflecting operational discipline and capital efficiency.`
      : 'The company demonstrates operational discipline and capital efficiency.';
    
    // Build valuation sentence only if we have both price and target
    let valuationStatement = '';
    if (price && targetPrice && price > 0 && targetPrice > 0) {
      const upside = (((targetPrice - price) / price) * 100).toFixed(1);
      valuationStatement = `Our price target of $${targetPrice} implies ${upside}% ${upside > 0 ? 'upside' : 'downside'} from current levels of $${price}, reflecting a probability-weighted scenario analysis. `;
    }
    
    // 🔧 v5.2: Enhanced fallback with 800-1000 chars and 3+ analyst attributions
    const fallback = `In ${analyst}'s view, ${companyName} ${ratingStatement} based on three core factors: sustainable competitive advantages, execution momentum, and valuation framework. ${metricsStatement}

${analyst} argues that the company's market position creates durable barriers to entry through scale economies, technology leadership, and customer relationships. The business model demonstrates network effects and switching costs that protect market share against competitive pressures. Management has demonstrated consistent ability to allocate capital toward high-return projects while maintaining balance sheet flexibility.

From an operational perspective, ${analyst} highlights that the company has delivered consistent margin expansion through operating leverage and cost discipline. The management team's track record of navigating market cycles and executing strategic initiatives supports our confidence in forward estimates. Industry positioning provides secular tailwinds that should support above-market growth over the intermediate term.

${valuationStatement}According to ${analyst}, the risk-reward framework favors long-term investors given structural growth drivers and margin expansion opportunities. As ${analyst} notes, current valuation incorporates near-term headwinds while underappreciating the durability of competitive advantages and the compounding nature of market position. We maintain conviction in the investment thesis based on fundamental analysis, industry positioning, and management's proven execution capability.`;
    
    console.log(`⚠️  [WriterStockV3] Generated enriched fallback thesis: ${fallback.length} chars (${fallback.split(/\s+/).length} words)`);
    return fallback;
  }
}

async function generateOverview(report, analystInfo = {}) {
  // 🆕 v5.2: Extract analyst/firm parameters
  const analyst = analystInfo.analyst || 'the research team';
  const firm = analystInfo.firm || 'our firm';
  
  // 🔧 Critical Fix: 使用统一的 segment 数据源（避免文本和表格矛盾）
  const segments = report.segments && report.segments.length > 0
    ? report.segments.map(s => `${s.name}: ${s.revenue_pct}% revenue`).join(', ')
    : 'Segment data pending';
  
  // 🆕 v5.1: Use industry-specific guidance
  const industryContext = report._industryContext || { industry: 'unknown', focus: [], metrics: [], tone: 'balanced' };
  // 🔧 Ensure focus is array
  const focus = Array.isArray(industryContext.focus) ? industryContext.focus : [];
  const industryNote = industryContext.industry !== 'unknown' && focus.length > 0
    ? `\nIndustry: ${industryContext.industry} (Focus: ${focus.slice(0,3).join(', ')})`
    : '';

  const prompt = `You are writing a company overview for ${report.symbol} as ${analyst}, lead analyst at ${firm}.

Company: ${report.company_name || report.symbol}
Business Model: ${report.business_model || 'Multi-segment technology company'}
Segments: ${segments}${industryNote}

Financial Profile:
- Market Cap: $${report.valuation?.market_cap ? (report.valuation.market_cap / 1e9).toFixed(1) + 'B' : 'N/A'}
- Revenue: $${report.fundamentals?.revenue ? (report.fundamentals.revenue / 1e9).toFixed(1) + 'B' : 'N/A'}
- EBITDA Margin: ${report.fundamentals?.ebitda_margin || 'N/A'}%
- ROE: ${report.fundamentals?.roe || 'N/A'}%

Write an 800-900 word company overview with segment breakdown and **ANALYST VOICE**:

**CRITICAL - Analyst Voice Requirements:**
- Include AT LEAST 2 explicit analyst references using ${analyst}'s name:
  * "${analyst} highlights that ..."
  * "As ${analyst} notes, ..."
  * "${analyst} observes that ..."
- Make it sound like ${analyst} is explaining the business to clients

**CRITICAL - Data Accuracy**:
When discussing business segments, you MUST use the EXACT percentages provided in the "Segments" data above. Do NOT make up different percentages. This ensures consistency with the data table.

**Structure:**
1. Business Overview (250 words)
   - Core operations (with 1 analyst attribution)
   - Revenue model
   - Geographic footprint

2. Segment Analysis (400 words)
   - For each segment, state the EXACT percentage from the data above
   - Margin and growth drivers
   - DO NOT use phrases like "approximately" or "roughly" - use the exact numbers provided
   - Include 1 analyst observation about segment mix

3. Operational Excellence (200-250 words)
   - Execution track record
   - Management quality
   - Capital allocation discipline

**Requirements:**
- Mix "we" (research team) with explicit ${analyst} attributions
- Quantify each segment's contribution with exact percentages
- **PROHIBITED**: exciting, innovative, leading, cutting-edge, state-of-the-art
- **REQUIRED**: Cite revenue mix, margin data, growth rates for each segment
- **MINIMUM LENGTH**: 800 words (do NOT write less than 700 words)
- No marketing language or superlatives

Overview:`;

  try {
    let overview = '';
    let attempts = 0;
    const MIN_WORD_COUNT = 800; // 🔧 Architect fix: Match prompt requirement (800-900 words)
    const ABSOLUTE_MIN = 500; // Fallback threshold
    
    // 🆕 v5.2: Retry with exponential backoff until we get sufficient content
    while (attempts < 3) {
      attempts++;
      
      const response = await callOpenAI([
        { role: 'system', content: `You are ${analyst}, a senior sell-side equity analyst at ${firm}. Write institutional-grade company overviews with your personal analytical voice.` },
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
    // 🔧 v5.2 FIX: Generate data-driven fallback instead of returning empty string
    const existingContent = report.company_overview || report.segment_text || '';
    if (existingContent && existingContent.length > 300) {
      console.log(`⚠️  [WriterStockV3] Using existing overview: ${existingContent.length} chars`);
      return existingContent;
    }
    
    // Generate enriched data-driven overview with segment details
    const companyName = report.company_name || report.symbol;
    const businessModel = report.business_model || 'a diversified technology company';
    const revenue = report.fundamentals?.revenue ? `$${(report.fundamentals.revenue / 1e9).toFixed(1)}B` : 'N/A';
    const employees = report.employees || 'N/A';
    const marketCap = report.valuation?.market_cap ? `$${(report.valuation.market_cap / 1e9).toFixed(1)}B` : 'N/A';
    
    // Extract segment data if available
    const segmentInfo = report.segments && report.segments.length > 0
      ? report.segments.slice(0, 3).map(s => `${s.name} (${s.revenue_pct}% of revenue)`).join(', ')
      : 'multiple business segments';
    
    // 🔧 v5.2: Enhanced fallback with 700-900 chars and 2+ analyst attributions
    const fallback = `${companyName} operates as ${businessModel} with ${revenue} in annual revenue and a market capitalization of ${marketCap}. The organization employs approximately ${employees} people globally across its operational footprint.

${analyst} highlights that the company's business model centers on ${segmentInfo}. This diversified structure provides both revenue stability and growth optionality across economic cycles. The segment mix reflects strategic capital allocation decisions and management's assessment of market opportunities across different customer segments and geographic regions.

The operational framework emphasizes margin discipline, R&D investment, and customer retention. ${analyst} notes that management has established track records in capital efficiency, reflected in consistent cash generation and return on invested capital metrics that exceed industry medians. The company maintains competitive positioning through proprietary technology, distribution advantages, and brand equity accumulated over multiple product cycles.

From an organizational perspective, ${analyst} observes that leadership continuity and execution culture support sustained performance through market volatility. The management team demonstrates ability to adapt strategy while maintaining financial discipline. The balance sheet structure provides flexibility for both organic growth investments and inorganic opportunities, while maintaining appropriate leverage ratios for the sector and credit rating objectives.`;
    
    console.log(`⚠️  [WriterStockV3] Generated enriched fallback overview: ${fallback.length} chars (${fallback.split(/\s+/).length} words)`);
    return fallback;
  }
}

async function generateValuation(report) {
  // 🆕 v5.1: Use industry-specific metrics
  const industryContext = report._industryContext || { industry: 'unknown', focus: [], metrics: [], tone: 'balanced' };
  const metricsNote = industryContext.metrics.length > 0
    ? `\n**Industry-Specific Metrics:** ${industryContext.metrics.join(', ')}`
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

Write 700 word valuation analysis:

**Structure:**
1. Valuation Framework (250 words)
   - Multiple-based approach (PE, EV/EBITDA, P/S)
   - DCF summary
   - Relative to peers

2. Target Price Derivation (250 words)
   - Base case assumptions
   - Key value drivers
   - Sensitivities

3. Scenario Analysis (200 words)
   - Bull case (assumptions + target)
   - Bear case (assumptions + target)
   - Probability weighting

**Requirements:**
- Institutional sell-side language: "We value the stock at", "Our target implies", "We derive"
- Cite specific numbers, multiples, and percentile ranks
- Compare to peer median/quartiles with exact figures
- **PROHIBITED PHRASES** (use alternatives):
  * ❌ "constructive" → ✅ "fair value $X represents Y% upside"
  * ❌ "supportive" → ✅ "trades at Z% discount to peers"
  * ❌ "attractive" → ✅ "valuation at Xth percentile"
  * ❌ "compelling" → ✅ "implies X% IRR vs. Y% WACC"
  * ❌ "well-positioned" → ✅ "commands premium given [specific reason]"
- Every valuation claim must cite a specific multiple or calculation

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

async function generateIndustry(report) {
  const analyst = report._analystInfo?.analyst || 'the research team';
  
  const prompt = `You are a Barclays equity analyst writing industry analysis for ${report.symbol} in ${report.sector || 'Technology'} sector.

Industry Context:
- Sector: ${report.sector || 'Technology'}
- Industry Growth: ${report.industry?.growth_rate || 'N/A'}%
- TAM: ${report.industry?.tam ? `$${(report.industry.tam / 1e9).toFixed(0)}B` : 'Multi-billion dollar opportunity'}

Write 600 word industry analysis:

**Structure:**
1. Industry Dynamics (200 words)
   - TAM and growth trajectory
   - Key secular trends
   - Technology disruption

2. Competitive Landscape (250 words)
   - Market structure
   - Leading players
   - Share shifts

3. Industry Outlook (150 words)
   - 12-24 month catalysts
   - Regulatory developments
   - Technology inflections

**Requirements:**
- Institutional tone
- Quantify market sizes
- "We see", "Industry checks indicate"
- No generic statements

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

async function generateMacro(report) {
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
    brand: brand || firm || 'our firm'
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
