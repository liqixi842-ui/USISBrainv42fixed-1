/**
 * symbolResolver/newResolver.js
 * 新一代符号解析器 - normalize → score → validate 流程
 * 
 * 流程：
 * 1. Search: 调用Twelve Data symbol_search API
 * 2. Normalize: 标准化候选对象
 * 3. Score: 多维度评分（100分制）
 * 4. Validate: 快速验证top-2候选
 * 5. Return: {qualified, confidence, winner, alternates}
 */

const fetch = require("node-fetch");
const { normalizeCountry, normalizeCandidate, toTradingView, toTwelveData } = require("../normalize");
const { scoreCandidates, applyValidationBonus } = require("./scoring");
const { quickValidate } = require("./validator");

const TWELVE_DATA_KEY = process.env.TWELVE_DATA_API_KEY;
const FINNHUB_KEY = process.env.FINNHUB_API_KEY;

// Feature flags
const USE_VALIDATION = process.env.SYMBOL_RESOLVER_VALIDATE !== 'false'; // 默认启用
const VALIDATION_TIMEOUT = parseInt(process.env.SYMBOL_RESOLVER_VALIDATION_TIMEOUT) || 3000;

/**
 * 调用Finnhub Symbol Search API（Fallback）
 * @param {string} query - 搜索关键词
 * @returns {Promise<Array>} 原始候选列表（Finnhub格式）
 */
async function searchFinnhub(query) {
  if (!FINNHUB_KEY) {
    throw new Error("FINNHUB_API_KEY not configured");
  }
  
  const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${FINNHUB_KEY}`;
  
  console.log(`   🌐 [Search] Finnhub: "${query}"`);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const results = data.result || [];
    
    console.log(`   📊 [Search] 找到 ${results.length} 个结果 (Finnhub)`);
    
    // 转换为标准格式
    return results.map(item => ({
      symbol: item.symbol || item.displaySymbol,
      exchange: item.type,
      instrument_name: item.description,
      country: null,
      currency: null,
      type: item.type
    }));
    
  } catch (error) {
    console.error(`   ❌ [Search] Finnhub失败: ${error.message}`);
    throw error;
  }
}

/**
 * 调用Twelve Data Symbol Search API
 * @param {string} query - 搜索关键词
 * @returns {Promise<Array>} 原始候选列表
 */
async function searchTwelveData(query) {
  if (!TWELVE_DATA_KEY) {
    throw new Error("TWELVE_DATA_API_KEY not configured");
  }
  
  const url = `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(query)}&apikey=${TWELVE_DATA_KEY}`;
  
  console.log(`   🌐 [Search] Twelve Data: "${query}"`);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const results = data.data || [];
    
    console.log(`   📊 [Search] 找到 ${results.length} 个结果`);
    
    return results;
    
  } catch (error) {
    console.error(`   ❌ [Search] 失败: ${error.message}`);
    throw error;
  }
}

/**
 * 生成歧义消解提示
 * @param {Array} alternates - 备选列表
 * @returns {string}
 */
function generateDisambiguationPrompt(alternates) {
  if (!alternates || alternates.length === 0) {
    return null;
  }
  
  const options = alternates.slice(0, 3).map((alt, i) => 
    `${i + 1}. ${alt.exchange}:${alt.ticker} (${alt.country || alt.name || ''})`
  ).join(', ');
  
  return `符号存在多个市场匹配，请确认：${options}`;
}

/**
 * 新一代符号解析器
 * @param {Object} intent - 语义意图对象
 * @param {string} intent.ticker - 股票代码（如"COL"）
 * @param {string} [intent.nameHint] - 公司名称提示
 * @param {string} [intent.exchangeHint] - 交易所提示（优先entity级）
 * @param {string} [intent.exchange] - 全局交易所提示（fallback）
 * @returns {Promise<Object>} ResolveResult
 */
async function resolveSymbol(intent) {
  console.log(`\n🔍 [NewResolver] 开始解析符号`);
  console.log(`   Input: ticker="${intent.ticker}", exchange="${intent.exchangeHint || intent.exchange}"`);
  
  const startTime = Date.now();
  
  try {
    // Step 1: 确定查询关键词和交易所上下文
    const query = intent.ticker || intent.nameHint;
    if (!query) {
      throw new Error("Missing ticker or nameHint");
    }
    
    // 🔧 SHORT-CIRCUIT: 如果符号已带交易所前缀/后缀，直接返回
    if (query.includes(':') || query.includes('.')) {
      console.log(`   ✅ [ShortCircuit] 符号已包含交易所标识: ${query}`);
      
      // 解析已有前缀
      let ticker, exchange;
      if (query.includes(':')) {
        [exchange, ticker] = query.split(':');
      } else {
        // 后缀格式（如GRF.MC）
        const parts = query.split('.');
        ticker = parts[0];
        exchange = parts[1]?.toUpperCase();
      }
      
      const candidate = {
        ticker,
        exchange,
        name: `${ticker} (${exchange})`,
        score: 100,
        reasons: ['pre-qualified:already_has_exchange'],
        validated: true
      };
      
      return {
        qualified: { tv: toTradingView(candidate), td: toTwelveData(candidate) },
        confidence: 100,
        winner: candidate,
        alternates: [],
        disambiguationPrompt: null
      };
    }
    
    // 优先使用entity级exchangeHint，fallback到全局exchange
    const exchangeHint = intent.exchangeHint || intent.exchange;
    const exchangeMap = exchangeHint ? normalizeCountry(exchangeHint) : null;
    
    console.log(`   Exchange context: ${exchangeHint} → ${exchangeMap ? exchangeMap.preferred : 'none'}`);
    
    // Step 2: Search - 调用API获取候选（带Finnhub fallback）
    let rawResults = [];
    
    if (TWELVE_DATA_KEY) {
      try {
        rawResults = await searchTwelveData(query);
      } catch (tdError) {
        console.warn(`   ⚠️  Twelve Data失败: ${tdError.message}, 尝试Finnhub fallback`);
        
        if (FINNHUB_KEY) {
          rawResults = await searchFinnhub(query);
        } else {
          throw new Error("Both Twelve Data and Finnhub failed/unavailable");
        }
      }
    } else if (FINNHUB_KEY) {
      console.log(`   🔄 [Fallback] 使用Finnhub（Twelve Data未配置）`);
      rawResults = await searchFinnhub(query);
    } else {
      throw new Error("No API key configured for symbol search");
    }
    
    if (!rawResults || rawResults.length === 0) {
      throw new Error(`No results found for "${query}"`);
    }
    
    // Step 3: Normalize - 标准化候选对象
    const candidates = rawResults.map(raw => normalizeCandidate(raw));
    
    console.log(`   📋 [Normalize] 标准化 ${candidates.length} 个候选`);
    
    // Step 4: Score - 多维度评分
    const scoredCandidates = scoreCandidates(candidates, {
      ticker: intent.ticker,
      nameHint: intent.nameHint,
      exchangeHint,
      exchangeMap
    });
    
    // Step 5: Validate - 快速验证top-2（可选）
    let finalCandidates = scoredCandidates;
    
    if (USE_VALIDATION && scoredCandidates.length > 0) {
      const validationResults = await quickValidate(scoredCandidates, {
        enabled: true,
        timeout: VALIDATION_TIMEOUT,
        maxCandidates: 2
      });
      
      // 应用验证奖励
      finalCandidates = applyValidationBonus(scoredCandidates, validationResults);
      
      // 重新排序
      finalCandidates.sort((a, b) => b.score - a.score);
    }
    
    // Step 6: 确定winner和alternates
    const winner = finalCandidates[0];
    const alternates = finalCandidates.slice(1, 4); // top-4（不含winner）
    
    if (!winner) {
      throw new Error("No valid candidate after scoring");
    }
    
    // 计算置信度
    const confidence = Math.min(100, Math.round(winner.score));
    
    // 生成qualified符号
    const qualified = {
      tv: toTradingView(winner),
      td: toTwelveData(winner)
    };
    
    // 🔧 完整的Confidence Bands逻辑
    let disambiguationPrompt = null;
    let finalWinner = winner;
    let finalAlternates = alternates;
    
    if (confidence >= 85) {
      // ✅ 高置信度（≥85）：仅返回winner
      console.log(`   ✅ [Confidence] 高置信度 (${confidence}) - 单一winner`);
      finalAlternates = [];
    } else if (confidence >= 70) {
      // ⚠️  中等置信度（70-84）：返回winner + alternates
      console.log(`   ⚠️  [Confidence] 中等置信度 (${confidence}) - winner + ${alternates.length} alternates`);
      disambiguationPrompt = null; // 不需要提示，但提供备选
    } else {
      // ❌ 低置信度（<70）：仅返回alternates + 提示
      console.log(`   ❌ [Confidence] 低置信度 (${confidence}) - 需要用户澄清`);
      disambiguationPrompt = generateDisambiguationPrompt([winner, ...alternates]);
      // 仍然返回winner，但标记为"需要确认"
    }
    
    const elapsed = Date.now() - startTime;
    
    console.log(`\n✅ [NewResolver] 解析完成 (${elapsed}ms)`);
    console.log(`   Winner: ${qualified.tv} (confidence=${confidence})`);
    console.log(`   TradingView: ${qualified.tv}`);
    console.log(`   Twelve Data: ${qualified.td}`);
    console.log(`   Alternates: ${finalAlternates.length} 个`);
    
    if (disambiguationPrompt) {
      console.log(`   ⚠️  低置信度警告: ${disambiguationPrompt}`);
    }
    
    return {
      qualified,
      confidence,
      winner: finalWinner,
      alternates: finalAlternates,
      disambiguationPrompt
    };
    
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`\n❌ [NewResolver] 解析失败 (${elapsed}ms): ${error.message}`);
    throw error;
  }
}

/**
 * 批量解析符号（支持多个entity）
 * @param {Array<Object>} entities - 实体列表
 * @param {Object} globalContext - 全局上下文（intent.exchange等）
 * @returns {Promise<Array<Object>>} 解析结果列表
 */
async function resolveSymbols(entities, globalContext = {}) {
  console.log(`\n🔄 [NewResolver] 批量解析 ${entities.length} 个符号`);
  
  const results = [];
  
  for (const entity of entities) {
    try {
      // 构建intent
      const intent = {
        ticker: entity.type === 'symbol' ? entity.value : null,
        nameHint: entity.type === 'company' ? entity.value : null,
        exchangeHint: entity.exchangeHint,
        exchangeConfidence: entity.exchangeConfidence,
        exchange: globalContext.exchange // fallback
      };
      
      const result = await resolveSymbol(intent);
      results.push({
        entity,
        result,
        success: true
      });
      
    } catch (error) {
      console.error(`   ❌ 实体解析失败: ${entity.value} - ${error.message}`);
      results.push({
        entity,
        error: error.message,
        success: false
      });
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  console.log(`✅ [NewResolver] 批量解析完成: ${successCount}/${entities.length} 成功`);
  
  return results;
}

module.exports = {
  resolveSymbol,
  resolveSymbols
};
