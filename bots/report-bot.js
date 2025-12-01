/**
 * ═══════════════════════════════════════════════════════════════
 * USIS Brain v7.0 - Report Bot (研报机器人 - 文本版)
 * ═══════════════════════════════════════════════════════════════
 * 
 * 职责：专门处理"研报生成"功能（纯文本版）
 * 
 * 功能：
 * - 生成机构级 6 节投资研报（纯文本）
 * - 自动分页发送（每条 ≤ 4000 字）
 * - 支持多语言（EN/ZH/ES）
 * - Markdown 格式化输出
 * 
 * 命令格式：
 * - /report NVDA
 * - /report NVDA zh
 * - 研报 NVDA
 */

const { generateFullTextReport } = require('../services/reportTextService');
const { generatePremiumPdf, isPremiumServiceAvailable } = require('../services/reportPremiumService');
const { generateEnhancedPdf } = require('../services/phase6Enhancer'); // Phase 7 Final Renderer
const { sendPdfReport, generatePdfFilename, generatePdfCaption } = require('../utils/telegramPdf');

/**
 * 研报请求处理函数
 * @param {Array} args - 用户输入参数 [symbol, language?, ...]
 * @param {number} chatId - Telegram 聊天室 ID
 * @param {Object} bot - Telegram Bot 实例
 * @param {Object} message - 原始 Telegram 消息对象
 * @returns {Promise<Object>} 处理结果对象
 */
async function handleReport(args, chatId, bot, message) {
  const startTime = Date.now();
  
  // 提取参数
  const symbol = args && args.length > 0 ? args[0].toUpperCase() : null;
  const language = args && args.length > 1 ? args[1].toLowerCase() : 'en';
  const username = message.from?.username || message.from?.first_name || 'unknown';
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 [REPORT_BOT] Report request received`);
  console.log(`   ├─ Symbol: ${symbol || 'not provided'}`);
  console.log(`   ├─ Language: ${language}`);
  console.log(`   ├─ Args: [${args.join(', ')}]`);
  console.log(`   ├─ Chat ID: ${chatId}`);
  console.log(`   └─ User: ${username}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  // 验证输入
  if (!symbol) {
    await bot.sendMessage(chatId,
      `❌ 缺少股票代码\n\n` +
      `用法示例：\n` +
      `• /report NVDA\n` +
      `• /report AAPL zh\n` +
      `• 研报 TSLA en`
    );
    return {
      type: 'report_error',
      success: false,
      error: 'Missing symbol'
    };
  }
  
  try {
    // 发送生成中提示
    const loadingMsg = await bot.sendMessage(chatId,
      getLoadingMessage(symbol, language),
      { parse_mode: 'Markdown' }
    );
    
    console.log(`📝 [REPORT_BOT] Generating report for ${symbol}...`);
    
    // 生成研报
    const report = await generateFullTextReport(symbol, language);
    
    console.log(`✅ [REPORT_BOT] Report generated, preparing messages...`);
    
    // 删除加载消息
    try {
      await bot.deleteMessage(chatId, loadingMsg.message_id);
    } catch (e) {
      console.warn(`⚠️  [REPORT_BOT] Failed to delete loading message: ${e.message}`);
    }
    
    // 发送研报（自动分页）
    await sendReportInChunks(bot, chatId, report);
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ [REPORT_BOT] Report sent successfully`);
    console.log(`   ├─ Symbol: ${symbol}`);
    console.log(`   ├─ Language: ${language}`);
    console.log(`   ├─ Sections: ${report.sections.length}`);
    console.log(`   ├─ User: ${username}`);
    console.log(`   └─ Duration: ${duration} ms`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    return {
      type: 'report_text',
      symbol,
      language,
      success: true,
      duration,
      sectionsCount: report.sections.length
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error(`\n❌ [REPORT_BOT] Report generation failed`);
    console.error(`   ├─ Symbol: ${symbol}`);
    console.error(`   ├─ Language: ${language}`);
    console.error(`   ├─ User: ${username}`);
    console.error(`   ├─ Error type: ${error.name || 'Error'}`);
    console.error(`   ├─ Error message: ${error.message}`);
    console.error(`   └─ Duration: ${duration} ms`);
    console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    // 发送错误消息给用户
    try {
      await bot.sendMessage(chatId,
        getErrorMessage(symbol, language, error),
        { parse_mode: 'Markdown' }
      );
    } catch (sendError) {
      console.error(`❌ [REPORT_BOT] Failed to send error message: ${sendError.message}`);
    }
    
    return {
      type: 'report_error',
      symbol,
      language,
      success: false,
      error: error.message,
      duration
    };
  }
}

/**
 * 自动分页发送研报
 * @param {Object} bot - Telegram Bot 实例
 * @param {number} chatId - Chat ID
 * @param {Object} report - 研报对象
 */
async function sendReportInChunks(bot, chatId, report) {
  const { symbol, language, sections, metadata } = report;
  
  // 构建完整报告文本
  const fullText = buildFullReportText(symbol, language, sections, metadata);
  
  // 分块发送（每条 ≤ 4000 字符）
  const chunks = splitIntoChunks(fullText, 4000);
  
  console.log(`📤 [REPORT_BOT] Sending ${chunks.length} message chunk(s)...`);
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const isFirst = i === 0;
    const isLast = i === chunks.length - 1;
    
    try {
      await bot.sendMessage(chatId, chunk, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });
      
      console.log(`   ├─ Sent chunk ${i + 1}/${chunks.length} (${chunk.length} chars)`);
      
      // 短暂延迟，避免触发 Telegram 速率限制
      if (!isLast) {
        await sleep(300);
      }
      
    } catch (error) {
      console.error(`   ├─ ❌ Failed to send chunk ${i + 1}: ${error.message}`);
      
      // 如果是格式错误，尝试纯文本发送
      if (error.message.includes('parse') || error.message.includes('markdown')) {
        try {
          await bot.sendMessage(chatId, chunk, {
            disable_web_page_preview: true
          });
          console.log(`   ├─ Resent chunk ${i + 1} as plain text`);
        } catch (retryError) {
          console.error(`   ├─ ❌ Retry failed: ${retryError.message}`);
        }
      }
    }
  }
}

/**
 * 构建完整报告文本
 * @param {string} symbol - 股票代码
 * @param {string} language - 语言代码
 * @param {Array} sections - 章节数组
 * @param {Object} metadata - 元数据
 * @returns {string} 完整报告文本
 */
function buildFullReportText(symbol, language, sections, metadata) {
  const lang = language.toLowerCase();
  
  // 标题
  const header = getReportHeader(symbol, lang);
  
  // 章节内容
  const sectionsText = sections.map(section => {
    return `\n\n## ${section.title}\n\n${section.body}`;
  }).join('');
  
  // 页脚
  const footer = getReportFooter(lang, metadata);
  
  return `${header}${sectionsText}\n\n${footer}`;
}

/**
 * 获取报告头部
 * @param {string} symbol - 股票代码
 * @param {string} language - 语言代码
 * @returns {string} 头部文本
 */
function getReportHeader(symbol, language) {
  const headers = {
    en: `📄 **${symbol} · Equity Research Report**\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `*USIS Brain v7.0 · Institutional Analysis*\n` +
        `Language: English`,
    
    zh: `📄 **${symbol} · 股票研究报告**\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `*USIS Brain v7.0 · 机构级分析*\n` +
        `语言：中文`,
    
    es: `📄 **${symbol} · Informe de Investigación**\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `*USIS Brain v7.0 · Análisis Institucional*\n` +
        `Idioma: Español`
  };
  
  return headers[language] || headers['en'];
}

/**
 * 获取报告页脚
 * @param {string} language - 语言代码
 * @param {Object} metadata - 元数据
 * @returns {string} 页脚文本
 */
function getReportFooter(language, metadata) {
  const timestamp = new Date(metadata.generatedAt).toISOString().split('T')[0];
  
  const footers = {
    en: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `*Generated: ${timestamp} · Words: ~${metadata.wordCount}*\n` +
        `*USIS Brain v7.0 Multi-AI Research System*\n\n` +
        `**Disclaimer:** This report is for informational purposes only. Not investment advice. ` +
        `Always conduct your own research and consult with a qualified financial advisor.`,
    
    zh: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `*生成时间：${timestamp} · 字数：约 ${metadata.wordCount} 字*\n` +
        `*USIS Brain v7.0 多 AI 研究系统*\n\n` +
        `**免责声明：** 本报告仅供参考，不构成投资建议。` +
        `请务必进行自己的研究并咨询合格的财务顾问。`,
    
    es: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `*Generado: ${timestamp} · Palabras: ~${metadata.wordCount}*\n` +
        `*USIS Brain v7.0 Sistema Multi-AI*\n\n` +
        `**Descargo:** Este informe es solo informativo. No es asesoramiento de inversión. ` +
        `Realice su propia investigación y consulte a un asesor financiero calificado.`
  };
  
  return footers[language] || footers['en'];
}

/**
 * 获取加载消息
 * @param {string} symbol - 股票代码
 * @param {string} language - 语言代码
 * @returns {string} 加载消息
 */
function getLoadingMessage(symbol, language) {
  const messages = {
    en: `⏳ Generating institutional research report for *${symbol}*...\n\n` +
        `This may take 30-60 seconds.\n\n` +
        `Generating:\n` +
        `• Executive Summary\n` +
        `• Investment Thesis\n` +
        `• Valuation\n` +
        `• Industry Analysis\n` +
        `• Catalysts\n` +
        `• Key Risks`,
    
    zh: `⏳ 正在为 *${symbol}* 生成机构级研究报告...\n\n` +
        `预计需要 30-60 秒。\n\n` +
        `生成中：\n` +
        `• 执行摘要\n` +
        `• 投资逻辑\n` +
        `• 估值分析\n` +
        `• 行业分析\n` +
        `• 催化剂\n` +
        `• 关键风险`,
    
    es: `⏳ Generando informe institucional para *${symbol}*...\n\n` +
        `Esto puede tardar 30-60 segundos.\n\n` +
        `Generando:\n` +
        `• Resumen Ejecutivo\n` +
        `• Tesis de Inversión\n` +
        `• Valoración\n` +
        `• Análisis de Industria\n` +
        `• Catalizadores\n` +
        `• Riesgos Clave`
  };
  
  return messages[language] || messages['en'];
}

/**
 * 获取错误消息
 * @param {string} symbol - 股票代码
 * @param {string} language - 语言代码
 * @param {Error} error - 错误对象
 * @returns {string} 错误消息
 */
function getErrorMessage(symbol, language, error) {
  const messages = {
    en: `❌ Failed to generate report for *${symbol}*\n\n` +
        `Error: ${error.message}\n\n` +
        `Please try again later or try another symbol.\n\n` +
        `Alternative commands:\n` +
        `• /news ${symbol} - Latest news\n` +
        `• /ticket ${symbol} - Quick technical analysis`,
    
    zh: `❌ 无法生成 *${symbol}* 的研报\n\n` +
        `错误：${error.message}\n\n` +
        `请稍后重试或尝试其他股票代码。\n\n` +
        `替代命令：\n` +
        `• /news ${symbol} - 最新新闻\n` +
        `• /ticket ${symbol} - 快速技术分析`,
    
    es: `❌ Error al generar informe para *${symbol}*\n\n` +
        `Error: ${error.message}\n\n` +
        `Inténtelo más tarde o pruebe otro símbolo.\n\n` +
        `Comandos alternativos:\n` +
        `• /news ${symbol} - Noticias recientes\n` +
        `• /ticket ${symbol} - Análisis técnico rápido`
  };
  
  return messages[language] || messages['en'];
}

/**
 * 将文本分割成多个块
 * @param {string} text - 完整文本
 * @param {number} maxLength - 每块最大长度
 * @returns {Array<string>} 文本块数组
 */
function splitIntoChunks(text, maxLength = 4000) {
  const chunks = [];
  let currentChunk = '';
  
  // 按段落分割
  const paragraphs = text.split('\n\n');
  
  for (const paragraph of paragraphs) {
    // 如果单个段落超长，强制分割
    if (paragraph.length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      // 强制分割长段落
      const parts = paragraph.match(new RegExp(`.{1,${maxLength}}`, 'g')) || [];
      chunks.push(...parts);
      continue;
    }
    
    // 检查是否会超出限制
    if ((currentChunk + '\n\n' + paragraph).length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = paragraph;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }
  
  // 添加最后一块
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(c => c.length > 0);
}

/**
 * 延迟函数
 * @param {number} ms - 毫秒数
 * @returns {Promise} Promise
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════
// PDF 研报处理器（新功能：/reportpdf）
// ═══════════════════════════════════════════════════════════════

/**
 * 处理 PDF 研报请求
 * @param {Array} args - 命令参数 [symbol, language?]
 * @param {number} chatId - 聊天 ID
 * @param {Object} bot - Telegram Bot 实例
 * @param {Object} message - 原始消息对象
 * @param {Object} flags - 命令标志 { premium: boolean }
 * @returns {Promise<Object>} 处理结果
 */
async function handleReportPdf(args, chatId, bot, message, flags = {}) {
  const startTime = Date.now();
  let isPremium = flags.premium === true; // 使用 let，允许降级修改
  
  console.log(`\n╔════════════════════════════════════════════════════╗`);
  console.log(`║   Report PDF Bot Handler                          ║`);
  console.log(`╚════════════════════════════════════════════════════╝`);
  console.log(`📊 [ReportPdfBot] Processing PDF request`);
  console.log(`   ├─ Chat ID: ${chatId}`);
  console.log(`   ├─ Args: ${JSON.stringify(args)}`);
  console.log(`   ├─ Flags: ${JSON.stringify(flags)}`);
  console.log(`   ├─ Mode: ${isPremium ? '⭐ PREMIUM' : '📄 BASIC'}`);
  console.log(`   └─ Timestamp: ${new Date().toISOString()}\n`);
  
  let loadingMsg = null;
  
  try {
    // ═══ STEP 1: 参数解析 ═══
    // 🆕 v7.7.2: 智能参数解析 - 过滤掉无效值如 "PDF", "pro", 语言代码等
    const INVALID_SYMBOLS = ['pdf', 'pro', 'premium', 'basic', 'en', 'zh', 'es', 'chinese', 'english', 'spanish'];
    const VALID_LANGUAGES = ['en', 'zh', 'es'];
    
    // 从 args 中找到第一个有效的股票代码
    let symbol = flags.symbol || null;
    let language = flags.language || 'en';
    
    if (!symbol && args.length > 0) {
      // 遍历 args，找到第一个看起来像股票代码的参数
      for (const arg of args) {
        const argLower = arg.toLowerCase();
        
        // 跳过无效值
        if (INVALID_SYMBOLS.includes(argLower)) {
          console.log(`[DEBUG report-bot] Skipping invalid symbol: ${arg}`);
          continue;
        }
        
        // 检查是否是语言代码
        if (VALID_LANGUAGES.includes(argLower)) {
          language = argLower;
          continue;
        }
        
        // 找到第一个有效的股票代码
        if (!symbol && /^[A-Z0-9.:]{1,15}$/i.test(arg)) {
          symbol = arg.toUpperCase();
          console.log(`[DEBUG report-bot] Found valid symbol: ${symbol}`);
        }
      }
    }
    
    console.log(`[DEBUG report-bot] BEFORE validation:`);
    console.log(`   - symbol = ${symbol}`);
    console.log(`   - language = ${language}`);
    console.log(`   - flags = ${JSON.stringify(flags)}`);
    console.log(`   - raw args = ${JSON.stringify(args)}`);
    
    // 检查 symbol 是否存在
    if (!symbol) {
      await bot.sendMessage(
        chatId,
        `❌ Missing stock symbol\n\n` +
        `Usage:\n` +
        `• \`/reportpdf NVDA\` - Basic PDF (local)\n` +
        `• \`/reportpdf pro NVDA\` - Premium PDF (institutional)\n` +
        `• \`/reportpdf NVDA pro zh\` - Premium Chinese PDF\n` +
        `• \`研报PDF TSLA\` - Chinese command`,
        { parse_mode: 'Markdown' }
      );
      return { type: 'report_pdf_missing_symbol', success: false };
    }
    
    // ✅ 确保 symbol 是大写，language 是小写
    symbol = symbol.toUpperCase();
    language = language.toLowerCase();
    
    // 验证语言并强制降级
    if (!['en', 'zh', 'es'].includes(language)) {
      const invalidLanguage = language;
      language = 'en'; // 强制降级到英文
      
      await bot.sendMessage(
        chatId,
        `⚠️  Unsupported language: \`${invalidLanguage}\`\n\n` +
        `Supported languages: en, zh, es\n` +
        `Defaulting to English...`,
        { parse_mode: 'Markdown' }
      );
    }
    
    // 🆕 v7.1: 提取机构名和分析师名
    const firm = flags.firm || null;
    const analyst = flags.analyst || null;
    
    // 🆕 v7.2: 当有自定义机构名或分析师名时，强制使用 Phase 6（无水印）
    // DocRaptor 模板不支持自定义品牌，只有 Phase 6 PDFKit 渲染器支持
    if ((firm || analyst) && isPremium) {
      console.log(`🔄 [ReportPdfBot] Custom branding detected, forcing Phase 6 renderer (no watermarks)`);
      console.log(`   ├─ Firm: ${firm || '(default)'}`);
      console.log(`   ├─ Analyst: ${analyst || '(default)'}`);
      console.log(`   └─ Reason: DocRaptor templates don't support custom branding`);
      isPremium = false;
      flags.premium = false;
    }
    
    console.log(`[DEBUG report-bot] AFTER validation:`);
    console.log(`   - symbol = ${symbol} (FINAL)`);
    console.log(`   - language = ${language} (FINAL)`);
    console.log(`   - isPremium = ${isPremium} (FINAL)`);
    console.log(`   - firm = ${firm || '(default)'}`);
    console.log(`   - analyst = ${analyst || '(default)'}`);
    console.log(`✅ [ReportPdfBot] Parsed: symbol=${symbol}, language=${language}, premium=${isPremium}`);
    
    // ═══ STEP 1.5: Premium 模式可用性检查 ═══
    if (isPremium && !isPremiumServiceAvailable()) {
      console.log(`⚠️  [ReportPdfBot] Premium service not available, falling back to basic mode`);
      
      await bot.sendMessage(
        chatId,
        `⚠️  Premium service unavailable\n\n` +
        `DocRaptor API key not configured.\n` +
        `Falling back to basic PDF mode...\n\n` +
        `_Tip: Ask admin to set DOC_RAPTOR_API_KEY for premium features_`,
        { parse_mode: 'Markdown' }
      );
      
      // 降级到基础模式（同时更新 flags 和 isPremium）
      flags.premium = false;
      isPremium = false; // 🔧 FIX: 必须更新 isPremium 变量，否则仍会调用 premium 服务
    }
    
    // ═══ STEP 2: 发送加载消息 ═══
    const loadingText = getLoadingMessagePdf(symbol, language, isPremium);
    loadingMsg = await bot.sendMessage(chatId, loadingText, { parse_mode: 'Markdown' });
    console.log(`📤 [ReportPdfBot] Loading message sent (ID: ${loadingMsg.message_id})`);
    
    // ═══ STEP 3: 生成 PDF（根据模式选择服务）═══
    console.log(`\n🔄 [ReportPdfBot] Generating ${isPremium ? 'PREMIUM' : 'ENHANCED'} PDF report...`);
    
    // 🆕 v7.1: 构建 PDF 生成选项（包含机构名/分析师名）
    const pdfOptions = {
      firm: firm || undefined,
      analyst: analyst || undefined
    };
    
    let pdfBuffer;
    if (isPremium) {
      // 使用 Premium 服务（DocRaptor + v3_dev）
      console.log(`   ├─ Mode: Premium (DocRaptor)`);
      if (firm) console.log(`   ├─ Firm: ${firm}`);
      if (analyst) console.log(`   ├─ Analyst: ${analyst}`);
      pdfBuffer = await generatePremiumPdf(symbol, language, pdfOptions);
    } else {
      // Phase 7: 使用 Premium 内容 + Phase 6 增强渲染器
      console.log(`   ├─ Mode: Phase 7 Flagship (Premium Content + Charts + Consensus)`);
      if (firm) console.log(`   ├─ Firm: ${firm}`);
      if (analyst) console.log(`   ├─ Analyst: ${analyst}`);
      
      // 首先尝试完整的 Premium + 增强模式
      try {
        pdfBuffer = await generateEnhancedPdf(symbol, language, {
          premium: false,
          usePremium: true,         // Phase 7: 使用 v3_dev Premium 机构级内容
          includeCharts: true,      // K-line + Financial charts
          includeConsensus: true,   // Multi-model AI consensus
          ...pdfOptions             // 🆕 v7.1: 传递机构名/分析师名
        });
        console.log(`   ├─ ✅ Phase 7 Flagship PDF generated (Premium + Enhanced)`);
      } catch (enhancedError) {
        console.warn(`   ├─ ⚠️  Phase 7 flagship renderer failed: ${enhancedError.message}`);
        console.warn(`   ├─ Attempting graceful degradation (no Premium content)...`);
        
        // 优雅降级：使用基础文本 + 增强渲染器（不使用 Premium）
        try {
          pdfBuffer = await generateEnhancedPdf(symbol, language, {
            premium: false,
            usePremium: false,        // 降级：不使用 Premium 内容
            includeCharts: true,      // 仍然包含图表
            includeConsensus: true,   // 仍然包含多模型共识
            ...pdfOptions             // 🆕 v7.1: 传递机构名/分析师名
          });
          console.log(`   └─ ✅ Gracefully degraded to Enhanced PDF (no Premium)`);
        } catch (fallbackError) {
          console.error(`   └─ ❌ All renderers failed: ${fallbackError.message}`);
          throw new Error(`PDF generation failed: ${enhancedError.message} → ${fallbackError.message}`);
        }
      }
    }
    
    const sizeKB = (pdfBuffer.length / 1024).toFixed(2);
    console.log(`✅ [ReportPdfBot] PDF generated successfully (${sizeKB} KB)\n`);
    
    // ═══ STEP 4: 发送 PDF ═══
    // 🆕 v7.1: 传递机构名/分析师名到文件名和说明
    const filename = generatePdfFilename(symbol, language, pdfOptions);
    const caption = generatePdfCaption(symbol, language, pdfOptions);
    
    await sendPdfReport(chatId, pdfBuffer, filename, caption, bot);
    
    // ═══ STEP 5: 删除加载消息 ═══
    try {
      await bot.deleteMessage(chatId, loadingMsg.message_id);
      console.log(`🗑️  [ReportPdfBot] Loading message deleted`);
    } catch (deleteError) {
      console.warn(`⚠️  [ReportPdfBot] Could not delete loading message: ${deleteError.message}`);
    }
    
    const duration = Date.now() - startTime;
    console.log(`\n✅ [ReportPdfBot] PDF report sent successfully`);
    console.log(`   ├─ Symbol: ${symbol}`);
    console.log(`   ├─ Language: ${language}`);
    console.log(`   ├─ Size: ${sizeKB} KB`);
    console.log(`   ├─ Filename: ${filename}`);
    console.log(`   └─ Duration: ${duration} ms\n`);
    
    return {
      type: 'report_pdf_success',
      success: true,
      symbol,
      language,
      mode: isPremium ? 'premium' : 'basic',
      sizeKB: parseFloat(sizeKB),
      duration
    };
    
  } catch (error) {
    console.error(`\n❌ [ReportPdfBot] Error processing PDF request`);
    console.error(`   ├─ Error: ${error.message}`);
    console.error(`   └─ Stack: ${error.stack}\n`);
    
    // 删除加载消息（如果存在）
    if (loadingMsg) {
      try {
        await bot.deleteMessage(chatId, loadingMsg.message_id);
      } catch (deleteError) {
        // 静默忽略
      }
    }
    
    // 发送错误消息
    await bot.sendMessage(
      chatId,
      `❌ Failed to generate PDF report\n\n` +
      `Symbol: \`${args[0]?.toUpperCase() || 'N/A'}\`\n` +
      `Error: ${error.message}\n\n` +
      `Tip: Try the text version with \`/report ${args[0] || 'SYMBOL'}\``,
      { parse_mode: 'Markdown' }
    );
    
    return {
      type: 'report_pdf_error',
      success: false,
      error: error.message,
      duration: Date.now() - startTime
    };
  }
}

/**
 * 获取加载消息（多语言）
 */
function getLoadingMessagePdf(symbol, language, isPremium = false) {
  const mode = isPremium ? '⭐ Premium' : '📄 Basic';
  const duration = isPremium ? '60-120' : '60-90';
  
  const messages = {
    en: 
      `⏳ Generating ${mode} PDF report for *${symbol}*...\n\n` +
      `This may take ${duration} seconds.\n\n` +
      `Generating:\n` +
      `• Executive Summary\n` +
      `• Investment Thesis\n` +
      `• Valuation Analysis\n` +
      `• Industry & Competition\n` +
      `• Catalysts\n` +
      `• Risk Factors\n` +
      (isPremium ? `• v4.0 Professional Correction\n` : '') +
      `• Rendering professional PDF layout...`,
    
    zh:
      `⏳ 正在为 *${symbol}* 生成 ${mode} PDF 研报...\n\n` +
      `预计需要 ${duration} 秒。\n\n` +
      `生成中：\n` +
      `• 执行摘要\n` +
      `• 投资逻辑\n` +
      `• 估值分析\n` +
      `• 行业与竞争\n` +
      `• 催化剂\n` +
      `• 风险因素\n` +
      (isPremium ? `• v4.0 专业校正层\n` : '') +
      `• 渲染专业 PDF 版面...`,
    
    es:
      `⏳ Generando informe ${mode} PDF para *${symbol}*...\n\n` +
      `Esto puede tomar ${duration} segundos.\n\n` +
      `Generando:\n` +
      `• Resumen Ejecutivo\n` +
      `• Tesis de Inversión\n` +
      `• Análisis de Valoración\n` +
      `• Industria y Competencia\n` +
      `• Catalizadores\n` +
      `• Factores de Riesgo\n` +
      (isPremium ? `• Corrección Profesional v4.0\n` : '') +
      `• Renderizando diseño PDF profesional...`
  };
  
  return messages[language] || messages['en'];
}

/**
 * 模块导出
 */
module.exports = {
  handleReport,
  handleReportPdf
};
