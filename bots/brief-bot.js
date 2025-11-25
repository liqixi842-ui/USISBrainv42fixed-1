/**
 * ═══════════════════════════════════════════════════════════════
 * USIS Brain v7.0 - Brief Bot (极简研报机器人)
 * ═══════════════════════════════════════════════════════════════
 * 
 * 职责：生成不超过 1500 字的文本研报（无 PDF）
 * - 快速研报生成（3 个核心部分）
 * - 多语言支持（en/es/zh）
 * - 纯文本输出，不生成附件
 * 
 * 核心流程：
 * 1. 股票代码规范化和解析
 * 2. 调用 LLM 生成极简研报
 * 3. 格式化并发送 Telegram 消息
 */

const { callModelWithFallback } = require('../gpt5Brain');
const { logError } = require('./supervisor-bot.js');

/**
 * Brief Bot 主处理函数
 * @param {Array} args - 命令参数 [symbol, language]
 * @param {number} chatId - Telegram 聊天室 ID
 * @param {Object} bot - Telegram Bot 实例
 * @param {Object} message - 原始 Telegram 消息对象
 * @returns {Promise<Object>} 处理结果
 */
async function handleBrief(args, chatId, bot, message) {
  const startTime = Date.now();
  let statusMsg = null;
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📄 [v7-brief] Quick report request received`);
  console.log(`   ├─ Args: [${args.join(', ')}]`);
  console.log(`   ├─ Chat ID: ${chatId}`);
  console.log(`   └─ User: ${message.from?.username || 'unknown'}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  try {
    // ═══ STEP 1: 参数验证 ═══
    if (!args || args.length === 0) {
      console.log(`❌ [v7-brief] No symbol provided`);
      await bot.sendMessage(chatId,
        `❌ *简报命令格式错误*\n\n` +
        `**正确格式：**\n` +
        `\`/brief 股票代码 [语言]\`\n\n` +
        `**示例：**\n` +
        `• \`/brief NVDA\` - 英文简报\n` +
        `• \`/brief NVDA zh\` - 中文简报\n` +
        `• \`简报 AAPL es\` - 西班牙语简报`,
        { parse_mode: 'Markdown' }
      );
      return {
        type: 'brief_error',
        error: 'No symbol provided'
      };
    }
    
    // ═══ STEP 2: 解析参数（股票代码 + 语言） ═══
    const symbol = normalizeSymbol(args[0]);
    const language = (args[1] || 'en').toLowerCase();
    
    // 验证语言代码
    const validLanguages = ['en', 'es', 'zh'];
    const lang = validLanguages.includes(language) ? language : 'en';
    
    console.log(`✅ [v7-brief] Normalized symbol: ${symbol}`);
    console.log(`   └─ Language: ${lang}\n`);
    
    // ═══ STEP 3: 发送初始状态消息 ═══
    try {
      const langText = {
        'en': 'Generating quick research brief',
        'zh': '正在生成研报简报',
        'es': 'Generando informe rápido'
      };
      
      statusMsg = await bot.sendMessage(chatId,
        `📄 *${symbol} ${langText[lang]}*\n\n` +
        `⏳ ${lang === 'zh' ? '正在调用AI模型生成分析...' : lang === 'es' ? 'Llamando al modelo AI...' : 'Calling AI model...'}\n\n` +
        `${lang === 'zh' ? '(预计 20-40 秒)' : lang === 'es' ? '(~20-40 segundos)' : '(~20-40 seconds)'}`,
        { parse_mode: 'Markdown' }
      );
    } catch (sendError) {
      console.error(`⚠️  [v7-brief] Failed to send status message: ${sendError.message}`);
    }
    
    // ═══ STEP 4: 生成研报 (调用 LLM) ═══
    console.log(`🧠 [v7-brief] Generating brief with LLM...`);
    const generateStartTime = Date.now();
    
    const briefText = await generateBrief(symbol, lang);
    
    const generateDuration = Date.now() - generateStartTime;
    
    console.log(`✅ [v7-brief] Brief generated in ${generateDuration} ms`);
    console.log(`   └─ Length: ${briefText.length} characters\n`);
    
    // ═══ STEP 5: 删除状态消息 ═══
    if (statusMsg) {
      try {
        await bot.deleteMessage(chatId, statusMsg.message_id);
      } catch (deleteError) {
        console.error(`⚠️  [v7-brief] Failed to delete status: ${deleteError.message}`);
      }
    }
    
    // ═══ STEP 6: 发送研报 ═══
    console.log(`📤 [v7-brief] Sending brief to user...`);
    
    // Check if text exceeds Telegram limit (4096 chars)
    if (briefText.length <= 4000) {
      // Send as single message
      await bot.sendMessage(chatId, briefText, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });
    } else {
      // Split into multiple messages
      const parts = splitTextIntoChunks(briefText, 3900);
      
      for (let i = 0; i < parts.length; i++) {
        await bot.sendMessage(chatId, parts[i], {
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        });
        
        // Add delay between messages
        if (i < parts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
    
    // ═══ STEP 7: 记录完成 ═══
    const totalDuration = Date.now() - startTime;
    
    console.log(`\n✅ [v7-brief] Brief request completed in ${totalDuration} ms`);
    console.log(`   ├─ Symbol: ${symbol}`);
    console.log(`   ├─ Language: ${lang}`);
    console.log(`   ├─ Brief length: ${briefText.length} chars`);
    console.log(`   ├─ Generation duration: ${generateDuration} ms`);
    console.log(`   └─ Total duration: ${totalDuration} ms`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    return {
      type: 'brief_result',
      symbol: symbol,
      language: lang,
      success: true,
      duration: totalDuration,
      text_length: briefText.length
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error(`\n❌ [v7-brief] ERROR after ${duration} ms`);
    console.error(`   ├─ Error type: ${error.name || 'Error'}`);
    console.error(`   ├─ Error message: ${error.message}`);
    console.error(`   └─ Stack trace:`);
    console.error(error.stack);
    console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    // 记录错误到 Supervisor
    logError({
      timestamp: new Date().toISOString(),
      type: error.name,
      message: `[v7-brief] ${error.message}`,
      stack: error.stack
    });
    
    // 删除状态消息
    if (statusMsg) {
      try {
        await bot.deleteMessage(chatId, statusMsg.message_id);
      } catch (deleteError) {
        // Ignore
      }
    }
    
    // 发送错误消息
    try {
      await bot.sendMessage(chatId,
        `❌ *简报生成失败*\n\n` +
        `标的: ${args[0] || 'unknown'}\n\n` +
        `原因: ${error.message}\n\n` +
        `建议：\n` +
        `• 检查股票代码是否正确\n` +
        `• 稍后重试\n` +
        `• 如问题持续，请联系管理员`,
        { parse_mode: 'Markdown' }
      );
    } catch (sendError) {
      console.error(`❌ [v7-brief] Failed to send error message: ${sendError.message}`);
    }
    
    return {
      type: 'brief_error',
      symbol: args[0] || 'unknown',
      error: error.message,
      duration: duration,
      success: false
    };
  }
}

/**
 * 规范化股票代码
 * @param {string} rawSymbol - 原始股票代码
 * @returns {string} 规范化的股票代码
 */
function normalizeSymbol(rawSymbol) {
  let symbol = rawSymbol.toUpperCase().trim();
  
  // 移除多余空格
  symbol = symbol.replace(/\s+/g, '');
  
  return symbol;
}

/**
 * 生成极简研报（调用 LLM）
 * @param {string} symbol - 股票代码
 * @param {string} language - 语言代码 (en/es/zh)
 * @returns {Promise<string>} 研报文本
 */
async function generateBrief(symbol, language) {
  // Language-specific instructions
  const languageInstructions = {
    'en': {
      outputLanguage: 'English',
      headerFormat: `📄 ${symbol} · Quick Research Brief (USIS v7)`,
      sections: ['I. Summary', 'II. Investment Thesis', 'III. Key Risks']
    },
    'zh': {
      outputLanguage: 'Chinese (Simplified)',
      headerFormat: `📄 ${symbol} · 快速研报简报 (USIS v7)`,
      sections: ['一、摘要', '二、投资论点', '三、关键风险']
    },
    'es': {
      outputLanguage: 'Spanish',
      headerFormat: `📄 ${symbol} · Informe Rápido (USIS v7)`,
      sections: ['I. Resumen', 'II. Tesis de Inversión', 'III. Riesgos Clave']
    }
  };
  
  const langConfig = languageInstructions[language] || languageInstructions['en'];
  
  // System prompt (sell-side research analyst tone)
  const systemPrompt = `You are a senior sell-side equity research analyst at a top-tier investment bank. Your analysis is data-driven, concise, and institutional-grade. You write clear, actionable research for professional investors.

Key principles:
- Use sell-side research language and tone
- Be specific with numbers, multiples, and targets where possible
- Avoid generic statements or obvious observations
- Focus on actionable insights
- Keep sentences crisp and professional`;
  
  // User prompt
  const userPrompt = `Generate a quick research brief for ${symbol} in ${langConfig.outputLanguage}. 

**STRUCTURE:**
${langConfig.sections[0]}: 2-3 sentences summarizing the investment story, current price action, and recommendation
${langConfig.sections[1]}: 4-6 sentences on key thesis points (growth drivers, competitive position, valuation rationale)
${langConfig.sections[2]}: 3-4 sentences on major risks to the investment case

**REQUIREMENTS:**
1. Total length: 1200-1500 words maximum
2. Output language: ${langConfig.outputLanguage}
3. Tone: Professional sell-side analyst
4. Format: Plain text with clear section headers
5. Header: ${langConfig.headerFormat}
6. Use specific data points when you can (PE, revenue growth, margins, etc.)
7. Avoid generic phrases like "strong fundamentals" without specifics

**OUTPUT FORMAT:**
${langConfig.headerFormat}

${langConfig.sections[0]}
[Your summary text here]

${langConfig.sections[1]}
[Your investment thesis here]

${langConfig.sections[2]}
[Your key risks here]

---
_Generated by USIS Brain v7 · For professional use only_`;
  
  // Call LLM with fallback mechanism
  const result = await callModelWithFallback({
    systemPrompt: systemPrompt,
    userPrompt: userPrompt,
    requestStartTime: Date.now()
  });
  
  if (!result.success) {
    throw new Error(`LLM generation failed: ${result.error || 'Unknown error'}`);
  }
  
  return result.text;
}

/**
 * 将长文本分割成多个块（避免超过 Telegram 限制）
 * @param {string} text - 原始文本
 * @param {number} maxLength - 每块最大长度
 * @returns {Array<string>} 文本块数组
 */
function splitTextIntoChunks(text, maxLength) {
  const chunks = [];
  let currentChunk = '';
  
  // Split by lines
  const lines = text.split('\n');
  
  for (const line of lines) {
    // If adding this line would exceed max length
    if (currentChunk.length + line.length + 1 > maxLength) {
      // Save current chunk and start new one
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      
      // If single line is too long, truncate it
      if (line.length > maxLength) {
        chunks.push(line.substring(0, maxLength - 3) + '...');
      } else {
        currentChunk = line;
      }
    } else {
      // Add line to current chunk
      currentChunk += (currentChunk ? '\n' : '') + line;
    }
  }
  
  // Add remaining chunk
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

/**
 * 默认导出
 */
module.exports = {
  handleBrief
};
