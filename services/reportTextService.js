/**
 * ═══════════════════════════════════════════════════════════════
 * USIS Brain v7.0 - Report Text Service (文本版研报生成服务)
 * ═══════════════════════════════════════════════════════════════
 * 
 * 职责：
 * - 生成纯文本格式的机构级投资研报
 * - 包装旧有的研报生成逻辑（professionalReporter, writerStockV3）
 * - 调用 gpt5Brain 的 callModelWithFallback
 * - 输出标准 6 节结构研报
 * 
 * 架构：
 * - 不涉及 PDF 生成（保留旧 PDF 模块不动）
 * - 纯文本输出，适配 Telegram Markdown
 * - 总字数控制在 ≤ 4500 字
 * - Sell-side 研究员口吻
 */

const { callModelWithFallback } = require('../gpt5Brain');
const { generateWithGPT5 } = require('../gpt5Brain');

// 集成旧研报模块（如果存在）
let professionalReporter = null;
let writerStockV3 = null;

try {
  professionalReporter = require('../professionalReporter');
  console.log('✅ [ReportTextService] professionalReporter loaded');
} catch (error) {
  console.warn('⚠️  [ReportTextService] professionalReporter not found, using direct AI calls');
}

try {
  writerStockV3 = require('../v3_dev/services/v5/writerStockV3');
  console.log('✅ [ReportTextService] writerStockV3 loaded');
} catch (error) {
  console.warn('⚠️  [ReportTextService] writerStockV3 not found, using direct AI calls');
}

/**
 * 生成完整的文本版研报
 * @param {string} symbol - 股票代码（如 NVDA, AAPL）
 * @param {string} language - 语言代码（en, zh, es）
 * @param {Object} options - 可选参数
 * @returns {Promise<Object>} 研报对象
 */
async function generateFullTextReport(symbol, language = 'en', options = {}) {
  const startTime = Date.now();
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 [ReportTextService] Generating text report`);
  console.log(`   ├─ Symbol: ${symbol}`);
  console.log(`   ├─ Language: ${language}`);
  console.log(`   └─ Timestamp: ${new Date().toISOString()}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  try {
    // 构建研报结构（6个章节）
    const sections = await generateReportSections(symbol, language, options);
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ [ReportTextService] Report generated successfully`);
    console.log(`   ├─ Symbol: ${symbol}`);
    console.log(`   ├─ Sections: ${sections.length}`);
    console.log(`   ├─ Total words: ~${estimateWordCount(sections)} words`);
    console.log(`   └─ Duration: ${duration} ms`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    return {
      symbol,
      language,
      sections,
      metadata: {
        generatedAt: new Date().toISOString(),
        duration,
        wordCount: estimateWordCount(sections),
        version: 'v7.0-text'
      }
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error(`\n❌ [ReportTextService] Report generation failed`);
    console.error(`   ├─ Symbol: ${symbol}`);
    console.error(`   ├─ Language: ${language}`);
    console.error(`   ├─ Error: ${error.message}`);
    console.error(`   └─ Duration: ${duration} ms`);
    console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    throw error;
  }
}

/**
 * 生成所有研报章节
 * @param {string} symbol - 股票代码
 * @param {string} language - 语言代码
 * @param {Object} options - 可选参数
 * @returns {Promise<Array>} 章节数组
 */
async function generateReportSections(symbol, language, options) {
  const lang = language.toLowerCase();
  
  // 定义章节标题（多语言）
  const sectionTitles = getSectionTitles(lang);
  
  const sections = [];
  
  // 逐个生成章节
  for (let i = 0; i < sectionTitles.length; i++) {
    const sectionTitle = sectionTitles[i];
    console.log(`   ├─ Generating: ${sectionTitle.title}...`);
    
    try {
      const sectionBody = await generateSection(
        symbol,
        sectionTitle.key,
        lang,
        options
      );
      
      sections.push({
        title: sectionTitle.title,
        key: sectionTitle.key,
        body: sectionBody
      });
      
      console.log(`   ├─ ✅ ${sectionTitle.title} (${countWords(sectionBody)} words)`);
      
    } catch (error) {
      console.error(`   ├─ ❌ Failed to generate ${sectionTitle.title}: ${error.message}`);
      
      // 使用 fallback 内容
      sections.push({
        title: sectionTitle.title,
        key: sectionTitle.key,
        body: getFallbackContent(sectionTitle.key, symbol, lang)
      });
    }
  }
  
  return sections;
}

/**
 * 生成单个研报章节
 * @param {string} symbol - 股票代码
 * @param {string} sectionKey - 章节键名
 * @param {string} language - 语言代码
 * @param {Object} options - 可选参数
 * @returns {Promise<string>} 章节内容
 */
async function generateSection(symbol, sectionKey, language, options) {
  const prompt = buildSectionPrompt(symbol, sectionKey, language, options);
  
  try {
    // 使用 callModelWithFallback（更稳定的降级策略）
    const result = await callModelWithFallback({
      systemPrompt: getSystemPrompt(language),
      userPrompt: prompt,
      temperature: 0.7,
      maxTokens: 1500,
      scene: 'research_report'
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Model call failed');
    }
    
    // 根据章节类型设置字数限制
    const limits = getSectionLimits(sectionKey);
    return cleanSectionText(result.text || '', limits);
    
  } catch (error) {
    console.error(`   ├─ Section generation error (${sectionKey}): ${error.message}`);
    throw error;
  }
}

/**
 * 构建章节生成 prompt
 * @param {string} symbol - 股票代码
 * @param {string} sectionKey - 章节键名
 * @param {string} language - 语言代码
 * @param {Object} options - 可选参数
 * @returns {string} Prompt 文本
 */
function buildSectionPrompt(symbol, sectionKey, language, options) {
  const lang = language.toLowerCase();
  
  // 基础信息
  const baseInfo = lang === 'zh' 
    ? `标的：${symbol}（美股）`
    : lang === 'es'
    ? `Activo: ${symbol} (US equity)`
    : `Subject: ${symbol} (US equity)`;
  
  // 根据章节类型构建 prompt
  const promptTemplates = {
    en: {
      executive_summary: `Write an Executive Summary for ${symbol} as a sell-side equity research analyst.

**Requirements:**
- 3-5 paragraphs (400-600 words total)
- Include: investment thesis, price target rationale, key catalysts, top risks
- Use institutional language (avoid: exciting, compelling, well-positioned)
- Reference concrete data points where possible
- Conclude with clear investment recommendation

Write the Executive Summary:`,

      investment_thesis: `Write the Investment Thesis section for ${symbol} as a sell-side equity research analyst.

**Requirements:**
- 4-6 paragraphs (500-700 words total)
- Core value proposition and competitive advantages
- Revenue growth drivers and margin expansion potential
- Management quality and execution track record
- Use institutional language with specific business metrics
- Include forward-looking statements with disclaimers

Write the Investment Thesis:`,

      valuation: `Write the Valuation section for ${symbol} as a sell-side equity research analyst.

**Requirements:**
- 3-5 paragraphs (400-600 words total)
- Discuss valuation methodology (DCF, comps, sum-of-parts)
- P/E, EV/EBITDA, and sector-relative metrics
- Price target derivation and upside/downside scenarios
- Acknowledge valuation limitations and sensitivities

Write the Valuation section:`,

      industry: `Write the Industry & Competitive Landscape section for ${symbol} as a sell-side equity research analyst.

**Requirements:**
- 4-6 paragraphs (500-700 words total)
- Industry growth trends and market size
- Competitive positioning and market share analysis
- Regulatory environment and industry headwinds/tailwinds
- Compare to 2-3 key competitors

Write the Industry & Competitive Landscape section:`,

      catalysts: `Write the Catalysts section for ${symbol} as a sell-side equity research analyst.

**Requirements:**
- 3-5 paragraphs (400-500 words total)
- Near-term catalysts (next 3-6 months)
- Medium-term catalysts (6-18 months)
- Catalyst probability and impact assessment
- Specific dates/events where applicable

Write the Catalysts section:`,

      risks: `Write the Key Risks section for ${symbol} as a sell-side equity research analyst.

**Requirements:**
- 4-6 paragraphs (500-600 words total)
- Company-specific risks (execution, management, competition)
- Industry/sector risks (regulation, disruption, cycles)
- Macro risks (rates, recession, geopolitics)
- Quantify impact where possible (e.g., "10-15% downside risk")

Write the Key Risks section:`
    },
    
    zh: {
      executive_summary: `以卖方研究分析师身份，为 ${symbol} 撰写《执行摘要》章节。

**要求：**
- 3-5 段（400-600 字）
- 包含：投资逻辑、目标价依据、关键催化剂、主要风险
- 使用机构级语言（避免：激动人心、极具吸引力等）
- 引用具体数据点
- 结尾给出明确投资建议

撰写执行摘要：`,

      investment_thesis: `以卖方研究分析师身份，为 ${symbol} 撰写《投资逻辑》章节。

**要求：**
- 4-6 段（500-700 字）
- 核心价值主张和竞争优势
- 营收增长驱动因素和利润率扩张潜力
- 管理层质量和执行记录
- 使用具体业务指标
- 包含前瞻性声明及免责说明

撰写投资逻辑：`,

      valuation: `以卖方研究分析师身份，为 ${symbol} 撰写《估值分析》章节。

**要求：**
- 3-5 段（400-600 字）
- 讨论估值方法（DCF、可比公司、分部估值）
- P/E、EV/EBITDA 及行业相对估值指标
- 目标价推导及上行/下行情景
- 承认估值局限性和敏感性

撰写估值分析：`,

      industry: `以卖方研究分析师身份，为 ${symbol} 撰写《行业与竞争格局》章节。

**要求：**
- 4-6 段（500-700 字）
- 行业增长趋势和市场规模
- 竞争地位和市场份额分析
- 监管环境和行业顺风/逆风
- 对比 2-3 家主要竞争对手

撰写行业与竞争格局：`,

      catalysts: `以卖方研究分析师身份，为 ${symbol} 撰写《催化剂》章节。

**要求：**
- 3-5 段（400-500 字）
- 近期催化剂（未来 3-6 个月）
- 中期催化剂（6-18 个月）
- 催化剂概率和影响评估
- 具体日期/事件（如适用）

撰写催化剂：`,

      risks: `以卖方研究分析师身份，为 ${symbol} 撰写《关键风险》章节。

**要求：**
- 4-6 段（500-600 字）
- 公司特定风险（执行、管理、竞争）
- 行业/板块风险（监管、颠覆、周期）
- 宏观风险（利率、衰退、地缘政治）
- 尽可能量化影响（如"10-15% 下行风险"）

撰写关键风险：`
    },
    
    es: {
      executive_summary: `Como analista sell-side, escribe el Resumen Ejecutivo para ${symbol}.

**Requisitos:**
- 3-5 párrafos (400-600 palabras)
- Incluir: tesis de inversión, justificación de precio objetivo, catalizadores clave, riesgos principales
- Lenguaje institucional (evitar: emocionante, convincente)
- Referenciar datos concretos
- Concluir con recomendación clara

Escribe el Resumen Ejecutivo:`,

      investment_thesis: `Como analista sell-side, escribe la Tesis de Inversión para ${symbol}.

**Requisitos:**
- 4-6 párrafos (500-700 palabras)
- Propuesta de valor y ventajas competitivas
- Motores de crecimiento de ingresos y expansión de márgenes
- Calidad de gestión y historial de ejecución
- Métricas de negocio específicas

Escribe la Tesis de Inversión:`,

      valuation: `Como analista sell-side, escribe la sección de Valoración para ${symbol}.

**Requisitos:**
- 3-5 párrafos (400-600 palabras)
- Metodología de valoración (DCF, comparables)
- P/E, EV/EBITDA, métricas relativas al sector
- Derivación del precio objetivo y escenarios
- Limitaciones y sensibilidades

Escribe la Valoración:`,

      industry: `Como analista sell-side, escribe Industria y Panorama Competitivo para ${symbol}.

**Requisitos:**
- 4-6 párrafos (500-700 palabras)
- Tendencias de crecimiento y tamaño de mercado
- Posicionamiento competitivo y cuota de mercado
- Entorno regulatorio
- Comparar con 2-3 competidores clave

Escribe Industria y Panorama Competitivo:`,

      catalysts: `Como analista sell-side, escribe la sección de Catalizadores para ${symbol}.

**Requisitos:**
- 3-5 párrafos (400-500 palabras)
- Catalizadores a corto plazo (3-6 meses)
- Catalizadores a medio plazo (6-18 meses)
- Evaluación de probabilidad e impacto
- Fechas/eventos específicos

Escribe Catalizadores:`,

      risks: `Como analista sell-side, escribe la sección de Riesgos Clave para ${symbol}.

**Requisitos:**
- 4-6 párrafos (500-600 palabras)
- Riesgos específicos de la empresa
- Riesgos de industria/sector
- Riesgos macro (tasas, recesión, geopolítica)
- Cuantificar impacto cuando sea posible

Escribe Riesgos Clave:`
    }
  };
  
  const langTemplates = promptTemplates[lang] || promptTemplates['en'];
  return langTemplates[sectionKey] || langTemplates['executive_summary'];
}

/**
 * 获取系统 prompt
 * @param {string} language - 语言代码
 * @returns {string} 系统 prompt
 */
function getSystemPrompt(language) {
  const prompts = {
    en: `You are a senior sell-side equity research analyst at a top-tier investment bank (Morgan Stanley, Goldman Sachs, JPMorgan caliber).

**Writing Style:**
- Professional, institutional language
- Data-driven with specific metrics
- Balanced view (acknowledge both positives and risks)
- Avoid hyperbolic language (exciting, compelling, well-positioned, robust)
- Use analyst voice with subtle opinion markers ("we believe", "in our view")

**Prohibited:**
- Generic platitudes without data support
- Overly promotional language
- Unsubstantiated claims
- Bullet points for main content (use flowing paragraphs)

**Output Format:**
- Natural paragraphs (3-8 per section)
- Markdown formatting allowed (but use sparingly)
- No emojis
- Professional tone throughout`,

    zh: `你是顶级投行（摩根士丹利、高盛、摩根大通级别）的卖方股票研究高级分析师。

**写作风格：**
- 专业、机构级语言
- 数据驱动，具体指标
- 平衡观点（承认正面和风险）
- 避免夸张语言（激动人心、极具吸引力、稳健）
- 使用分析师口吻（"我们认为"、"据我们判断"）

**禁止：**
- 无数据支撑的空泛陈词
- 过度宣传性语言
- 无根据的断言
- 主要内容使用项目符号（使用流畅段落）

**输出格式：**
- 自然段落（每节 3-8 段）
- 可使用 Markdown 格式（但要节制）
- 无表情符号
- 全文保持专业口吻`,

    es: `Eres un analista senior sell-side en un banco de inversión de primer nivel (Morgan Stanley, Goldman Sachs, JPMorgan).

**Estilo:**
- Lenguaje profesional institucional
- Basado en datos con métricas específicas
- Vista equilibrada (reconocer positivos y riesgos)
- Evitar lenguaje hiperbólico
- Usar voz de analista ("creemos que", "en nuestra opinión")

**Prohibido:**
- Generalidades sin datos
- Lenguaje excesivamente promocional
- Afirmaciones sin fundamento
- Viñetas para contenido principal (usar párrafos)

**Formato:**
- Párrafos naturales (3-8 por sección)
- Formato Markdown permitido (usar con moderación)
- Sin emojis
- Tono profesional`
  };
  
  return prompts[language] || prompts['en'];
}

/**
 * 清理章节文本并强制执行字数/段落限制
 * @param {string} text - 原始文本
 * @param {Object} limits - 限制参数 { minWords, maxWords, minParagraphs, maxParagraphs }
 * @returns {string} 清理后的文本
 */
function cleanSectionText(text, limits = {}) {
  // 基础清理
  let cleaned = text
    .trim()
    .replace(/\n{3,}/g, '\n\n')  // 移除多余换行
    .replace(/^\s*[-*]\s*/gm, '• ');  // 统一列表符号
  
  // 强制执行段落限制（3-8 段）
  const minParagraphs = limits.minParagraphs || 3;
  const maxParagraphs = limits.maxParagraphs || 8;
  
  const paragraphs = cleaned.split('\n\n').filter(p => p.trim().length > 0);
  
  if (paragraphs.length > maxParagraphs) {
    // 截断超出的段落
    cleaned = paragraphs.slice(0, maxParagraphs).join('\n\n');
    console.warn(`⚠️  [ReportTextService] Truncated from ${paragraphs.length} to ${maxParagraphs} paragraphs`);
  } else if (paragraphs.length < minParagraphs) {
    console.warn(`⚠️  [ReportTextService] Only ${paragraphs.length} paragraphs (expected ${minParagraphs}-${maxParagraphs})`);
  }
  
  // 强制执行字数限制
  const maxWords = limits.maxWords || 800;
  const wordCount = countWords(cleaned);
  
  if (wordCount > maxWords) {
    // 按句子截断以保持语义完整性
    const sentences = cleaned.match(/[^.!?]+[.!?]+/g) || [];
    let truncated = '';
    let currentWords = 0;
    
    for (const sentence of sentences) {
      const sentenceWords = countWords(sentence);
      if (currentWords + sentenceWords > maxWords) {
        break;
      }
      truncated += sentence;
      currentWords += sentenceWords;
    }
    
    if (truncated) {
      cleaned = truncated.trim();
      console.warn(`⚠️  [ReportTextService] Truncated from ${wordCount} to ${currentWords} words`);
    }
  }
  
  return cleaned;
}

/**
 * 获取章节标题（多语言）
 * @param {string} language - 语言代码
 * @returns {Array} 章节标题数组
 */
function getSectionTitles(language) {
  const titles = {
    en: [
      { key: 'executive_summary', title: 'I. Executive Summary' },
      { key: 'investment_thesis', title: 'II. Investment Thesis' },
      { key: 'valuation', title: 'III. Valuation' },
      { key: 'industry', title: 'IV. Industry & Competitive Landscape' },
      { key: 'catalysts', title: 'V. Catalysts' },
      { key: 'risks', title: 'VI. Key Risks' }
    ],
    zh: [
      { key: 'executive_summary', title: '一、执行摘要' },
      { key: 'investment_thesis', title: '二、投资逻辑' },
      { key: 'valuation', title: '三、估值分析' },
      { key: 'industry', title: '四、行业与竞争格局' },
      { key: 'catalysts', title: '五、催化剂' },
      { key: 'risks', title: '六、关键风险' }
    ],
    es: [
      { key: 'executive_summary', title: 'I. Resumen Ejecutivo' },
      { key: 'investment_thesis', title: 'II. Tesis de Inversión' },
      { key: 'valuation', title: 'III. Valoración' },
      { key: 'industry', title: 'IV. Industria y Panorama Competitivo' },
      { key: 'catalysts', title: 'V. Catalizadores' },
      { key: 'risks', title: 'VI. Riesgos Clave' }
    ]
  };
  
  return titles[language] || titles['en'];
}

/**
 * 获取 fallback 内容
 * @param {string} sectionKey - 章节键名
 * @param {string} symbol - 股票代码
 * @param {string} language - 语言代码
 * @returns {string} Fallback 内容
 */
function getFallbackContent(sectionKey, symbol, language) {
  const fallbacks = {
    en: `This section is currently unavailable due to temporary API limitations. Please refer to public filings and recent analyst reports for ${symbol} for comprehensive coverage of this topic.`,
    zh: `由于临时 API 限制，本节暂时无法生成。请参阅 ${symbol} 的公开文件和近期分析师报告，以获得此主题的全面覆盖。`,
    es: `Esta sección no está disponible temporalmente debido a limitaciones de API. Consulte los informes públicos y los informes de analistas recientes para ${symbol} para obtener cobertura completa de este tema.`
  };
  
  return fallbacks[language] || fallbacks['en'];
}

/**
 * 估算文本字数并强制上限
 * @param {Array} sections - 章节数组
 * @param {number} maxTotal - 最大总字数
 * @returns {number} 估算字数
 */
function estimateWordCount(sections, maxTotal = 4500) {
  const totalWords = sections.reduce((total, section) => {
    return total + countWords(section.body);
  }, 0);
  
  if (totalWords > maxTotal) {
    console.warn(`⚠️  [ReportTextService] Total word count (${totalWords}) exceeds limit (${maxTotal})`);
  }
  
  return totalWords;
}

/**
 * 统计字数
 * @param {string} text - 文本
 * @returns {number} 字数
 */
function countWords(text) {
  if (!text) return 0;
  
  // 处理中文（按字符计算）
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  
  // 处理英文和西班牙文（按单词计算）
  const words = text
    .replace(/[\u4e00-\u9fa5]/g, '')  // 移除中文字符
    .split(/\s+/)
    .filter(w => w.length > 0)
    .length;
  
  return chineseChars + words;
}

/**
 * 获取章节字数/段落限制
 * @param {string} sectionKey - 章节键名
 * @returns {Object} 限制对象
 */
function getSectionLimits(sectionKey) {
  const limits = {
    executive_summary: { minWords: 400, maxWords: 600, minParagraphs: 3, maxParagraphs: 5 },
    investment_thesis: { minWords: 500, maxWords: 700, minParagraphs: 4, maxParagraphs: 6 },
    valuation: { minWords: 400, maxWords: 600, minParagraphs: 3, maxParagraphs: 5 },
    industry: { minWords: 500, maxWords: 700, minParagraphs: 4, maxParagraphs: 6 },
    catalysts: { minWords: 400, maxWords: 500, minParagraphs: 3, maxParagraphs: 5 },
    risks: { minWords: 500, maxWords: 600, minParagraphs: 4, maxParagraphs: 6 }
  };
  
  return limits[sectionKey] || { minWords: 400, maxWords: 700, minParagraphs: 3, maxParagraphs: 8 };
}

/**
 * 模块导出
 */
module.exports = {
  generateFullTextReport,
  generateReportSections,
  generateSection
};
