/**
 * ═══════════════════════════════════════════════════════════════
 * USIS Brain v7.0 - Ticket Bot (解票机器人)
 * ═══════════════════════════════════════════════════════════════
 * 
 * 职责：专门处理"解票分析"功能
 * - 快速技术分析（30-60秒响应）
 * - TradingView K线图截图
 * - AI技术面分析
 * - 支持多语言输出（中文/英文/人话版）
 * 
 * 核心流程：
 * 1. 规范化股票代码
 * 2. 生成K线图 + AI分析（generateStockChart）
 * 3. 格式化输出（lightweightFormatter）
 * 4. 发送图片 + 文字到Telegram
 */

const { generateStockChart } = require('../stockChartService');
const lightweightFormatter = require('../v3_dev/services/lightweightTicketFormatter');
const dataBroker = require('../dataBroker');
const { STATIC_SYMBOL_MAP, lookupSymbol, lookupSymbolFromTwelveData, selectBestMatch } = require('../symbolResolver');
const fetch = require('node-fetch');

// 🆕 HDA v2: Human Desk Assistant 核心模块
const {
  createAnalysisPayload,
  generateHDAOutput,
  createDeepAnalysisButton,
  generateQuickTake,
  generateDeepTake,
  formatBilingualOutput
} = require('../services/hdaV2Core');

// 🆕 v7.0: AI 符号解析缓存（避免重复调用 API）
const AI_SYMBOL_CACHE = new Map();
const AI_CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时

/**
 * 🆕 v7.0: 检测输入是否需要 AI 翻译（包含非 ASCII 字符）
 */
function needsAITranslation(input) {
  // 检测非 ASCII 字符（中文、日文、韩文等）
  return /[^\x00-\x7F]/.test(input);
}

/**
 * 🆕 v7.0: AI 智能符号解析 - 使用 GPT-4o-mini 理解任何语言的公司名
 * @param {string} input - 用户输入（如 "苹果", "アップル", "manzana"）
 * @param {string|null} exchangeHint - 交易所提示
 * @returns {Promise<{symbol: string, exchange?: string, confidence: number}|null>}
 */
async function resolveWithAI(input, exchangeHint = null) {
  const cacheKey = `${input.toLowerCase()}_${exchangeHint || 'auto'}`;
  
  // 检查缓存
  const cached = AI_SYMBOL_CACHE.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < AI_CACHE_TTL)) {
    console.log(`   🧠 [AI缓存命中] "${input}" → ${cached.symbol}`);
    return { symbol: cached.symbol, exchange: cached.exchange, confidence: 0.95, source: 'ai_cache' };
  }
  
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    console.log(`   ⚠️  [AI] OpenAI API key not available`);
    return null;
  }
  
  try {
    console.log(`   🧠 [AI解析] 使用 GPT-4o-mini 理解: "${input}"`);
    
    const systemPrompt = `You are a stock symbol resolver. Given a company name in ANY language, return the most likely stock ticker symbol.

Rules:
1. Return ONLY a JSON object with format: {"symbol": "TICKER", "exchange": "EXCHANGE_CODE", "confidence": 0.0-1.0}
2. For US stocks, use the standard ticker (e.g., AAPL, NVDA, TSLA)
3. For non-US stocks, include exchange suffix if needed (e.g., 0700.HK for Tencent, COL.MC for Colonial)
4. If exchange hint is provided, prioritize that market
5. If you cannot identify the company, return {"symbol": null, "confidence": 0}
6. Common mappings: 苹果=AAPL, 微软=MSFT, 谷歌=GOOGL, 英伟达=NVDA, 特斯拉=TSLA, 腾讯=0700.HK, 阿里巴巴=BABA`;

    const userPrompt = exchangeHint 
      ? `Company: "${input}" (prefer ${exchangeHint} market)`
      : `Company: "${input}"`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
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
        max_tokens: 100,
        temperature: 0.1
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      console.warn(`   ⚠️  [AI] API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    
    if (!content) {
      return null;
    }
    
    // 解析 JSON 响应
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn(`   ⚠️  [AI] Invalid response format: ${content}`);
      return null;
    }
    
    const result = JSON.parse(jsonMatch[0]);
    
    if (result.symbol && result.confidence > 0.5) {
      console.log(`   ✅ [AI解析成功] "${input}" → ${result.symbol} (置信度: ${result.confidence})`);
      
      // 缓存结果
      AI_SYMBOL_CACHE.set(cacheKey, {
        symbol: result.symbol,
        exchange: result.exchange,
        timestamp: Date.now()
      });
      
      return {
        symbol: result.symbol,
        exchange: result.exchange,
        confidence: result.confidence,
        source: 'ai_gpt4o_mini'
      };
    }
    
    return null;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn(`   ⚠️  [AI] 请求超时 (8s)`);
    } else {
      console.warn(`   ⚠️  [AI] 解析失败: ${error.message}`);
    }
    return null;
  }
}

/**
 * 🆕 智能符号解析 - 支持中文公司名、英文名、股票代码 + 交易所提示
 * 优先级：AI理解 → 静态映射 → API查询 → 原样返回
 * @param {string} input - 用户输入（如 "英伟达", "nvidia", "NVDA"）
 * @param {string|null} exchangeHint - 交易所提示（如 "Spain", "HK", "US"）
 * @returns {Promise<{symbol: string, resolved: boolean, source: string, exchange?: string}>}
 */
async function resolveTicketSymbol(input, exchangeHint = null) {
  const normalized = input.toLowerCase().trim();
  const upper = input.toUpperCase().trim();
  
  console.log(`🔍 [TICKET Symbol Resolver] 解析输入: "${input}" (交易所提示: ${exchangeHint || '无'})`);
  
  // 🆕 v7.0: 如果输入包含非 ASCII 字符（中文/日文等），优先使用 AI 解析
  if (needsAITranslation(input)) {
    console.log(`   🌐 [检测] 输入包含非英文字符，启用 AI 智能解析...`);
    
    const aiResult = await resolveWithAI(input, exchangeHint);
    if (aiResult && aiResult.symbol) {
      return {
        symbol: aiResult.symbol,
        resolved: true,
        source: aiResult.source || 'ai',
        exchange: aiResult.exchange
      };
    }
    console.log(`   ⚠️  [AI] 未能识别，尝试其他方法...`);
  }
  
  // 🆕 如果有交易所提示，跳过静态映射，直接用 API 查询以获取正确的交易所符号
  if (exchangeHint) {
    console.log(`   🌍 [优先API] 检测到交易所提示 "${exchangeHint}"，跳过静态映射`);
    
    try {
      // 🔥 使用 Twelve Data（全球覆盖最广，推荐用于非美股）
      const TWELVE_DATA_KEY = process.env.TWELVE_DATA_API_KEY;
      if (TWELVE_DATA_KEY) {
        const results = await lookupSymbolFromTwelveData(input, exchangeHint);
        if (results && results.length > 0) {
          const best = selectBestMatch(results, exchangeHint, input);
          // 保留交易所后缀（如 COL.MC 表示西班牙）
          const finalSymbol = best.symbol;
          console.log(`   ✅ [Twelve Data + 交易所] ${input} → ${finalSymbol} (${best.exchange || best.description})`);
          return { symbol: finalSymbol, resolved: true, source: 'twelvedata_exchange', exchange: best.exchange };
        }
      }
      
      // 备用：Finnhub（美股和部分国际股票）
      const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
      if (FINNHUB_KEY) {
        const results = await lookupSymbol(input, exchangeHint);
        if (results && results.length > 0) {
          const best = selectBestMatch(results, exchangeHint, input);
          const finalSymbol = best.symbol;
          console.log(`   ✅ [Finnhub + 交易所] ${input} → ${finalSymbol}`);
          return { symbol: finalSymbol, resolved: true, source: 'finnhub_exchange', exchange: best.exchange };
        }
      }
    } catch (apiError) {
      console.warn(`   ⚠️  [API查询失败] ${apiError.message}`);
    }
  }
  
  // Layer 1: 静态映射精确匹配（最快）- 仅当无交易所提示时
  if (STATIC_SYMBOL_MAP[normalized]) {
    const resolved = STATIC_SYMBOL_MAP[normalized];
    console.log(`   ✅ [静态映射] ${input} → ${resolved}`);
    return { symbol: resolved, resolved: true, source: 'static_exact' };
  }
  
  // Layer 2: 静态映射部分匹配（支持 "苹果公司" → "苹果" → AAPL）
  for (const [key, symbol] of Object.entries(STATIC_SYMBOL_MAP)) {
    if ((key.includes(normalized) || normalized.includes(key)) && key.length >= 2 && normalized.length >= 2) {
      console.log(`   ✅ [静态映射-模糊] ${input} → ${symbol} (via ${key})`);
      return { symbol, resolved: true, source: 'static_fuzzy' };
    }
  }
  
  // Layer 3: 检查是否已经是有效的股票代码格式（纯英文+数字，1-10字符）
  const isLikelyTicker = /^[A-Z0-9.:]{1,10}$/i.test(input.trim());
  if (isLikelyTicker && !exchangeHint) {
    console.log(`   📈 [直接使用] ${upper} (看起来像股票代码)`);
    return { symbol: upper, resolved: false, source: 'passthrough' };
  }
  
  // Layer 4: API 查询（对于未知的公司名）
  try {
    console.log(`   🌐 [API查询] 尝试查找: ${input}`);
    
    // 尝试 Finnhub（优先，对英文名支持较好）
    const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
    if (FINNHUB_KEY) {
      const results = await lookupSymbol(input, exchangeHint);
      if (results && results.length > 0) {
        const best = selectBestMatch(results, exchangeHint, input);
        // 清理前缀（如 COMMON STOCK:AAPL → AAPL）
        const cleanSymbol = best.symbol.includes(':') ? best.symbol.split(':').pop() : best.symbol;
        console.log(`   ✅ [Finnhub] ${input} → ${cleanSymbol}`);
        return { symbol: cleanSymbol, resolved: true, source: 'finnhub' };
      }
    }
    
    // 尝试 Twelve Data（备用，全球覆盖更广）
    const TWELVE_DATA_KEY = process.env.TWELVE_DATA_API_KEY;
    if (TWELVE_DATA_KEY) {
      const results = await lookupSymbolFromTwelveData(input, exchangeHint);
      if (results && results.length > 0) {
        const best = selectBestMatch(results, exchangeHint, input);
        // 清理前缀（如 NASDAQ:AAPL → AAPL）
        const cleanSymbol = best.symbol.includes(':') ? best.symbol.split(':').pop() : best.symbol;
        console.log(`   ✅ [Twelve Data] ${input} → ${cleanSymbol}`);
        return { symbol: cleanSymbol, resolved: true, source: 'twelvedata' };
      }
    }
  } catch (apiError) {
    console.warn(`   ⚠️  [API查询失败] ${apiError.message}`);
  }
  
  // Layer 5: 最终回退 - 使用原始输入（大写）
  console.log(`   ⚠️  [回退] 无法解析，使用原始输入: ${upper}`);
  return { symbol: upper, resolved: false, source: 'fallback' };
}

/**
 * 解票主处理函数 (HDA v2 升级版)
 * @param {Array} args - 用户输入参数 [symbol, mode]
 * @param {number} chatId - Telegram 聊天室 ID
 * @param {Object} bot - Telegram Bot 实例
 * @param {Object} message - 原始 Telegram 消息对象
 * @param {Object} options - 可选参数 { exchangeHint: string, hdaMode: 'quick'|'deep' }
 * @returns {Promise<Object>} 解票结果对象
 */
async function handleTicket(args, chatId, bot, message, options = {}) {
  const startTime = Date.now();
  let statusMsg = null;
  const exchangeHint = options.exchangeHint || null;
  
  // 🆕 HDA v2: Quick/Deep 模式
  // - quick: 轻图 + 自然人话 + 深度按钮（默认）
  // - deep: 深图 + 详细 tape 分析
  const hdaMode = options.hdaMode || 'quick';
  
  // 🆕 v7.7.3: 智能时间范围检测
  // - 默认短期（1个月）
  // - 如果用户说"长线/中长期/长期/long term" → 3个月
  // - Deep 模式使用 3 个月
  const messageText = (message.text || '').toLowerCase();
  const isLongTerm = /长线|中长期|长期|long\s*term|中线|波段/.test(messageText);
  const chartRange = hdaMode === 'deep' ? '3M' : (isLongTerm ? '3M' : '1M');
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🎯 [TICKET] Ticket analysis request (HDA v2)`);
  console.log(`   ├─ Args: [${args.join(', ')}]`);
  console.log(`   ├─ Chat ID: ${chatId}`);
  console.log(`   ├─ User: ${message.from?.username || 'unknown'}`);
  console.log(`   ├─ 🌍 Exchange Hint: ${exchangeHint || '(none - default to US)'}`);
  console.log(`   ├─ 🎭 HDA Mode: ${hdaMode.toUpperCase()}`);
  console.log(`   └─ 📅 Chart Range: ${chartRange} (${isLongTerm ? '长线模式' : '短期模式'})`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  try {
    // ═══ STEP 1: 参数解析 ═══
    const parseResult = parseTicketArgs(args);
    
    if (!parseResult.valid) {
      console.log(`❌ [TICKET] Invalid arguments: ${parseResult.error}`);
      await sendErrorMessage(bot, chatId, parseResult.error);
      return {
        type: 'ticket_error',
        error: parseResult.error
      };
    }
    
    const { symbol: rawSymbol, mode } = parseResult;
    
    console.log(`✅ [TICKET] Parsed arguments:`);
    console.log(`   ├─ Raw Symbol: ${rawSymbol}`);
    console.log(`   ├─ Mode: ${mode}`);
    console.log(`   └─ Exchange: ${exchangeHint || 'auto-detect'}\n`);
    
    // ═══ STEP 1.5: 🆕 智能符号解析（中文公司名 → 股票代码 + 交易所）═══
    const resolveResult = await resolveTicketSymbol(rawSymbol, exchangeHint);
    const symbol = resolveResult.symbol;
    
    if (resolveResult.resolved) {
      console.log(`🎯 [TICKET] Symbol resolved: ${rawSymbol} → ${symbol} (via ${resolveResult.source})`);
    } else {
      console.log(`📈 [TICKET] Using symbol as-is: ${symbol}`);
    }
    
    // ═══ STEP 2: 发送初始状态消息 ═══
    const displayName = resolveResult.resolved ? `${rawSymbol} (${symbol})` : symbol;
    try {
      statusMsg = await bot.sendMessage(chatId, 
        `🎯 正在解票 ${displayName}\n\n` +
        `⏳ 正在生成图表和技术分析...\n\n` +
        `(预计 30-60 秒)`
      );
    } catch (sendError) {
      console.error(`⚠️  [TICKET] Failed to send status message: ${sendError.message}`);
    }
    
    // ═══ STEP 3: 生成股票图表 + AI分析 ═══
    console.log(`📊 [TICKET] Calling generateStockChart for ${symbol}...`);
    const chartStartTime = Date.now();
    
    let chartResult;
    try {
      chartResult = await generateStockChart(symbol, {
        includeVisionAnalysis: true,
        chartStyle: '1',  // Candlestick chart
        chartRange: chartRange  // 🆕 v7.7.3: 智能时间范围（1M/3M）
      });
    } catch (chartError) {
      console.error(`❌ [TICKET] Chart generation failed: ${chartError.message}`);
      // Fallback: 使用基础数据分析
      chartResult = await generateFallbackAnalysis(symbol);
    }
    
    const chartDuration = Date.now() - chartStartTime;
    
    console.log(`✅ [TICKET] Chart generation completed in ${chartDuration} ms`);
    console.log(`   ├─ Has chart URL: ${!!chartResult.chartUrl}`);
    console.log(`   ├─ Has analysis: ${!!chartResult.chartAnalysis}`);
    console.log(`   ├─ Analysis length: ${(chartResult.chartAnalysis || '').length} chars`);
    console.log(`   └─ Fallback mode: ${chartResult.fallback || false}\n`);
    
    // ═══ STEP 4: 更新状态消息 ═══
    if (statusMsg) {
      try {
        await bot.editMessageText(
          `🎯 正在解票 ${symbol}\n\n` +
          `✅ 图表生成完成\n` +
          `⏳ 正在格式化输出...`,
          {
            chat_id: chatId,
            message_id: statusMsg.message_id
          }
        );
      } catch (editError) {
        console.error(`⚠️  [TICKET] Failed to update status: ${editError.message}`);
      }
    }
    
    // ═══ STEP 5: 删除状态消息 ═══
    if (statusMsg) {
      try {
        await bot.deleteMessage(chatId, statusMsg.message_id);
      } catch (deleteError) {
        console.error(`⚠️  [TICKET] Failed to delete status: ${deleteError.message}`);
      }
    }
    
    // ═══ STEP 6: 发送图表截图 ═══
    let chartSent = false;
    const chartCaption = chartResult.caption || `📈 ${symbol} 技术图表`;
    
    if (chartResult.buffer) {
      console.log(`📊 [TICKET] Sending chart screenshot (Buffer mode)...`);
      try {
        await bot.sendPhoto(chatId, chartResult.buffer, {
          caption: chartCaption
        });
        console.log(`✅ [TICKET] Chart sent successfully (Buffer)`);
        chartSent = true;
      } catch (photoError) {
        console.error(`⚠️  [TICKET] Chart send failed (Buffer): ${photoError.message}`);
      }
    } else if (chartResult.imageBase64) {
      console.log(`📊 [TICKET] Sending chart screenshot (Base64 mode)...`);
      try {
        const photoBuffer = Buffer.from(chartResult.imageBase64, 'base64');
        await bot.sendPhoto(chatId, photoBuffer, {
          caption: chartCaption
        });
        console.log(`✅ [TICKET] Chart sent successfully (Base64)`);
        chartSent = true;
      } catch (photoError) {
        console.error(`⚠️  [TICKET] Chart send failed (Base64): ${photoError.message}`);
      }
    } else if (chartResult.chartUrl) {
      console.log(`📊 [TICKET] Sending chart screenshot (URL mode)...`);
      try {
        await bot.sendPhoto(chatId, chartResult.chartUrl, {
          caption: chartCaption
        });
        console.log(`✅ [TICKET] Chart sent successfully (URL)`);
        chartSent = true;
      } catch (photoError) {
        console.error(`⚠️  [TICKET] Chart send failed (URL): ${photoError.message}`);
      }
    } else {
      console.log(`⚠️  [TICKET] No chart data available (no buffer/base64/url), skipping chart send`);
    }
    
    if (!chartSent) {
      console.log(`⚠️  [TICKET] Chart was not sent to user`);
    }
    
    // ═══ STEP 7: HDA v2 分析负载生成 ═══
    console.log(`🎭 [TICKET] Generating HDA v2 output (${hdaMode} mode)...`);
    
    const stockData = {
      currentPrice: chartResult.stockData?.currentPrice || chartResult.price,
      change: chartResult.stockData?.change || chartResult.change,
      changePercent: chartResult.stockData?.changePercent || chartResult.changePercent
    };
    
    // 准备 legacy 格式数据（用于降级或特定模式）
    const ticketData = {
      symbol: chartResult.symbol || symbol,
      analysis: chartResult.chartAnalysis || '',
      price: stockData.currentPrice,
      change: stockData.change,
      changePercent: stockData.changePercent
    };
    
    let messages = [];
    let analysisPayload = null;
    
    // 🔧 兼容旧格式（如果用户指定了特定模式）
    if (mode && mode !== '标准版' && mode !== 'quick' && mode !== 'deep') {
      // 用户指定了特定输出模式，使用旧格式器
      messages = formatTicketMessages(ticketData, mode);
      console.log(`📝 [TICKET] Using legacy formatter for mode "${mode}"`);
    } else {
      // 尝试使用 HDA v2 格式
      try {
        // 创建分析负载
        analysisPayload = createAnalysisPayload(symbol, hdaMode, chartResult, stockData);
        
        // 🆕 HDA v2: 如果有 Vision AI 分析，使用它增强输出
        if (chartResult.chartAnalysis) {
          analysisPayload.vision_analysis = chartResult.chartAnalysis;
        }
        
        // 生成 HDA 自然语言输出
        const hdaOutput = generateHDAOutput(analysisPayload);
        
        console.log(`✅ [TICKET] HDA v2 output generated`);
        console.log(`   ├─ Mode: ${hdaMode}`);
        console.log(`   ├─ ZH length: ${hdaOutput.payload.final_output_zh.length} chars`);
        console.log(`   └─ EN length: ${hdaOutput.payload.final_output_en.length} chars`);
        
        messages = [hdaOutput.message];
        analysisPayload = hdaOutput.payload;
        console.log(`📝 [TICKET] Using HDA v2 natural language format`);
      } catch (hdaError) {
        // HDA 生成失败，降级到 legacy 格式
        console.error(`⚠️ [TICKET] HDA v2 generation failed, falling back to legacy: ${hdaError.message}`);
        messages = formatTicketMessages(ticketData, '标准版');
        console.log(`📝 [TICKET] Fallback to legacy formatter`);
      }
    }
    
    // ═══ STEP 8: 发送文字分析 ═══
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      console.log(`📤 [TICKET] Sending message ${i + 1}/${messages.length} (${msg.length} chars)`);
      
      try {
        // 🆕 HDA v2: Quick 模式添加深度分析按钮
        if (hdaMode === 'quick' && i === messages.length - 1) {
          const inlineKeyboard = createDeepAnalysisButton(symbol);
          await bot.sendMessage(chatId, msg, {
            reply_markup: inlineKeyboard
          });
          console.log(`🔘 [TICKET] Added inline button for deep analysis`);
        } else {
          await bot.sendMessage(chatId, msg);
        }
        
        // Rate limit protection
        if (i < messages.length - 1) {
          await sleep(800);
        }
      } catch (sendError) {
        console.error(`❌ [TICKET] Failed to send message ${i + 1}: ${sendError.message}`);
      }
    }
    
    // ═══ STEP 9: 记录完成 ═══
    const totalDuration = Date.now() - startTime;
    
    console.log(`\n✅ [TICKET] Ticket analysis completed in ${totalDuration} ms`);
    console.log(`   ├─ Symbol: ${symbol}`);
    console.log(`   ├─ HDA Mode: ${hdaMode.toUpperCase()}`);
    console.log(`   ├─ Output Mode: ${mode}`);
    console.log(`   ├─ Chart generation: ${chartDuration} ms`);
    console.log(`   ├─ Messages sent: ${messages.length}`);
    console.log(`   └─ Total time: ${totalDuration} ms`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    return {
      type: 'ticket_result',
      symbol: symbol,
      hdaMode: hdaMode,
      chartUrl: chartResult.chartUrl,
      aiText: chartResult.chartAnalysis,
      hdaPayload: analysisPayload || null,  // 🆕 HDA v2: 返回结构化负载（可能为 null）
      sentiment: chartResult.sentiment || null,
      quote: {
        price: chartResult.stockData?.currentPrice || chartResult.price,
        change: chartResult.stockData?.change || chartResult.change,
        changePercent: chartResult.changePercent
      },
      duration: totalDuration,
      success: true
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error(`\n❌ [TICKET] ERROR after ${duration} ms`);
    console.error(`   ├─ Error type: ${error.name || 'Error'}`);
    console.error(`   ├─ Error message: ${error.message}`);
    console.error(`   └─ Stack trace:`);
    console.error(error.stack);
    console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    // Delete status message if exists
    if (statusMsg) {
      try {
        await bot.deleteMessage(chatId, statusMsg.message_id);
      } catch (deleteError) {
        // Ignore
      }
    }
    
    // Send fallback error message
    try {
      await sendFallbackMessage(bot, chatId, args[0] || 'unknown', error.message);
    } catch (fallbackError) {
      console.error(`❌ [TICKET] Fallback message failed: ${fallbackError.message}`);
    }
    
    // Return error result (不抛出异常，避免 ManagerBot 崩溃)
    return {
      type: 'ticket_error',
      symbol: args[0] || 'unknown',
      error: error.message,
      duration: duration,
      success: false
    };
  }
}

/**
 * 解析解票命令参数
 * @param {Array} args - 用户输入参数
 * @returns {Object} { valid: boolean, symbol: string, mode: string, error: string }
 */
function parseTicketArgs(args) {
  if (!args || args.length === 0) {
    return {
      valid: false,
      error: '❌ 解票命令格式错误\n\n' +
             '**正确格式：**\n' +
             '解票 股票代码 [模式]\n\n' +
             '**示例：**\n' +
             '• 解票 NVDA（标准中文版）\n' +
             '• 解票 NVDA 双语（中文+英文）\n' +
             '• 解票 NVDA 聊天版（人话版）\n' +
             '• 解票 NVDA 完整版（所有格式）'
    };
  }
  
  const symbol = args[0].toUpperCase().trim();
  const mode = args[1] ? args[1].trim() : '标准版';
  
  // Validate symbol
  if (!symbol || symbol.length === 0) {
    return {
      valid: false,
      error: '❌ 股票代码不能为空'
    };
  }
  
  // 🆕 v7.1: 不再强制归一化模式，保留原始输入让 formatTicketMessages 处理
  return {
    valid: true,
    symbol: symbol,
    mode: mode || '标准版'  // 保留原始模式字符串
  };
}

/**
 * 🆕 v7.1: 格式化解票消息（支持灵活的语言组合）
 * 
 * 支持的模式：
 * - 预设模式：双语、三语、完整版、聊天版、标准版
 * - 自然语言组合：中文和西语、英语和中文、所有语言
 * - 单一语言：中文、英文、西语
 * 
 * @param {Object} ticketData - 解票数据
 * @param {string} mode - 输出模式（支持自然语言输入）
 * @returns {Array<string>} 消息数组
 */
function formatTicketMessages(ticketData, mode) {
  // 使用新的语言解析器
  const languages = lightweightFormatter.parseLanguageMode(mode);
  
  console.log(`🌍 [TICKET] 语言模式解析: "${mode}" → [${languages.join(', ')}]`);
  
  // 使用新的多语言格式化器
  return lightweightFormatter.formatByLanguages(ticketData, languages);
}

/**
 * 生成降级分析（当图表生成失败时）
 * @param {string} symbol - 股票代码
 * @returns {Promise<Object>} 降级分析结果
 */
async function generateFallbackAnalysis(symbol) {
  console.log(`🔄 [TICKET] Generating fallback analysis for ${symbol}...`);
  
  try {
    // 尝试获取基础行情数据
    const marketData = await dataBroker.fetchMarketData([symbol]);
    const quote = marketData.quotes ? marketData.quotes[symbol] : null;
    
    return {
      symbol: symbol,
      chartUrl: null,
      analysis: `系统繁忙，已切换至保底分析模式。\n\n` +
                `当前价格: ${quote?.currentPrice ? '$' + quote.currentPrice.toFixed(2) : 'N/A'}\n` +
                `涨跌幅: ${quote?.changePercent ? quote.changePercent.toFixed(2) + '%' : 'N/A'}\n\n` +
                `技术分析暂时不可用，请稍后重试完整分析。`,
      price: quote?.currentPrice,
      change: quote?.change,
      changePercent: quote?.changePercent,
      fallback: true,
      sentiment: null
    };
  } catch (fallbackError) {
    console.error(`❌ [TICKET] Fallback analysis failed: ${fallbackError.message}`);
    
    return {
      symbol: symbol,
      chartUrl: null,
      analysis: `系统繁忙，无法获取 ${symbol} 的数据。\n\n` +
                `请稍后重试或检查股票代码是否正确。`,
      price: null,
      change: null,
      changePercent: null,
      fallback: true,
      sentiment: null
    };
  }
}

/**
 * 发送错误消息
 * @param {Object} bot - Telegram Bot 实例
 * @param {number} chatId - 聊天室 ID
 * @param {string} errorText - 错误文本
 */
async function sendErrorMessage(bot, chatId, errorText) {
  try {
    await bot.sendMessage(chatId, errorText);
  } catch (error) {
    console.error(`❌ [TICKET] Failed to send error message: ${error.message}`);
  }
}

/**
 * 发送降级消息（当所有步骤都失败时）
 * @param {Object} bot - Telegram Bot 实例
 * @param {number} chatId - 聊天室 ID
 * @param {string} symbol - 股票代码
 * @param {string} errorMsg - 错误信息
 */
async function sendFallbackMessage(bot, chatId, symbol, errorMsg) {
  const fallbackText = 
    `❌ 解票失败\n\n` +
    `标的: ${symbol}\n\n` +
    `原因: ${errorMsg}\n\n` +
    `建议：\n` +
    `• 检查股票代码是否正确\n` +
    `• 稍后重试\n` +
    `• 如问题持续，请联系管理员\n\n` +
    `(v7-dev 解票功能 - 轻量级模式)`;
  
  try {
    await bot.sendMessage(chatId, fallbackText);
  } catch (error) {
    console.error(`❌ [TICKET] Failed to send fallback message: ${error.message}`);
  }
}

/**
 * 睡眠函数（用于速率限制）
 * @param {number} ms - 毫秒数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 🆕 HDA v2: 深度分析回调处理器
 * @param {string} ticker - 股票代码
 * @param {number} chatId - 聊天室 ID
 * @param {Object} bot - Telegram Bot 实例
 * @param {Object} query - Callback query 对象
 * @returns {Promise<Object>} 深度分析结果
 */
async function handleDeepCallback(ticker, chatId, bot, query) {
  console.log(`\n🔍 [HDA v2] Deep callback triggered for ${ticker}`);
  
  // 安全检查
  if (!chatId) {
    console.error(`❌ [HDA v2] No chatId available for deep callback`);
    try {
      await bot.answerCallbackQuery(query.id, {
        text: '无法处理请求',
        show_alert: true
      });
    } catch (e) { /* ignore */ }
    return { type: 'deep_callback_error', success: false };
  }
  
  let statusMsg = null;
  
  try {
    // 立即应答回调查询（避免 loading 状态卡住）
    await bot.answerCallbackQuery(query.id, {
      text: '🔍 正在生成深度分析...'
    });
    
    // 发送处理中状态
    statusMsg = await bot.sendMessage(chatId, `🔍 正在深入分析 ${ticker}，请稍候...`);
    
    // 构建消息对象（用于 handleTicket）
    const fakeMessage = {
      text: `解票 ${ticker} deep`,
      from: query.from,
      chat: query.message?.chat || { id: chatId }
    };
    
    // 调用 handleTicket 使用 deep 模式
    const result = await handleTicket([ticker], chatId, bot, fakeMessage, {
      hdaMode: 'deep'
    });
    
    // 删除状态消息
    if (statusMsg) {
      try {
        await bot.deleteMessage(chatId, statusMsg.message_id);
      } catch (e) {
        // Ignore delete errors
      }
    }
    
    console.log(`✅ [HDA v2] Deep analysis completed for ${ticker}`);
    
    return result;
  } catch (error) {
    console.error(`❌ [HDA v2] Deep callback error: ${error.message}`);
    
    // 删除状态消息
    if (statusMsg) {
      try {
        await bot.deleteMessage(chatId, statusMsg.message_id);
      } catch (e) { /* ignore */ }
    }
    
    // 发送错误消息
    try {
      await bot.sendMessage(chatId, 
        `❌ 深度分析失败\n\n` +
        `标的: ${ticker}\n` +
        `原因: ${error.message}\n\n` +
        `请稍后重试或直接输入: 解票 ${ticker}`
      );
    } catch (e) { /* ignore */ }
    
    return {
      type: 'deep_callback_error',
      ticker: ticker,
      error: error.message,
      success: false
    };
  }
}

/**
 * 默认导出
 */
module.exports = {
  handleTicket,
  handleDeepCallback  // 🆕 HDA v2: 深度分析回调
};

