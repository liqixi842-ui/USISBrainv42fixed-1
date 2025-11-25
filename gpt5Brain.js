// USIS Brain v4.1 - 智能主脑 + 自动保底引擎
// 主脑优先：GPT-5 Mini → 保底链：GPT-4o → GPT-4o-mini

const fetch = require('node-fetch');
const fs = require('fs');
const { buildAnalysisPrompt } = require('./analysisPrompt');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// 加载模型注册表
let modelRegistry = {
  primary: { id: 'gpt-5-mini', max_tokens: 4000, timeout_ms: 45000 },
  fallback: [
    { id: 'gpt-4o', max_tokens: 3000, timeout_ms: 30000 },
    { id: 'gpt-4o-mini', max_tokens: 2000, timeout_ms: 20000 }
  ]
};

try {
  const registryPath = './config/models.json';
  if (fs.existsSync(registryPath)) {
    modelRegistry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    console.log(`✅ [SmartBrain] 模型注册表已加载`);
  }
} catch (error) {
  console.warn(`⚠️  [SmartBrain] 模型注册表加载失败，使用默认配置:`, error.message);
}

// 环境变量控制（紧急回退）
if (process.env.PRIMARY_MODEL) {
  modelRegistry.primary.id = process.env.PRIMARY_MODEL;
  console.log(`🔧 [SmartBrain] 主脑模型已覆盖: ${process.env.PRIMARY_MODEL}`);
}

// 禁用降级开关（调试用）
const DISABLE_FALLBACK = process.env.DISABLE_FALLBACK === 'true';
if (DISABLE_FALLBACK) {
  console.warn(`⚠️  [SmartBrain] 自动降级已禁用（仅用于调试）`);
}

console.log(`🔑 [SmartBrain] OPENAI_API_KEY状态: ${OPENAI_API_KEY ? '已设置(' + OPENAI_API_KEY.slice(0, 7) + '...)' : '❌ 未设置'}`);
console.log(`🧠 [SmartBrain] 主脑: ${modelRegistry.primary.id}`);
console.log(`🛡️  [SmartBrain] 保底链: ${modelRegistry.fallback.map(f => f.id).join(' → ')}`);

/**
 * v4.1核心：智能模型调用（自动降级）
 */
async function callModelWithFallback({
  systemPrompt,
  userPrompt,
  requestStartTime
}) {
  const modelChain = [modelRegistry.primary, ...modelRegistry.fallback];
  let lastError = null;
  const errorHistory = []; // 🆕 记录所有失败历史
  
  for (let i = 0; i < modelChain.length; i++) {
    const modelConfig = modelChain[i];
    const isFallback = i > 0;
    
    // 如果禁用降级且不是主脑，跳过
    if (DISABLE_FALLBACK && isFallback) {
      console.log(`⚠️  [SmartBrain] 自动降级已禁用，跳过 ${modelConfig.id}`);
      continue;
    }
    
    try {
      console.log(`${isFallback ? '🛡️ ' : '🧠'} [SmartBrain] 尝试: ${modelConfig.id} (${i + 1}/${modelChain.length})`);
      
      const callStartTime = Date.now();
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: modelConfig.id,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_completion_tokens: modelConfig.max_tokens
        }),
        timeout: modelConfig.timeout_ms
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API ${response.status}: ${errorText.slice(0, 200)}`);
      }
      
      const data = await response.json();
      const generatedText = data.choices?.[0]?.message?.content;
      
      if (!generatedText) {
        throw new Error('模型返回空内容');
      }
      
      const latency = Date.now() - callStartTime;
      const totalLatency = Date.now() - requestStartTime;
      
      console.log(`✅ [SmartBrain] 成功: ${modelConfig.id} (${latency}ms, ${generatedText.length}字)`);
      
      // 🆕 如果有失败历史，记录到debug中
      const debugInfo = {
        model_used: modelConfig.id,
        fallback_used: isFallback,
        latency_ms: totalLatency,
        call_latency_ms: latency,
        attempts: i + 1
      };
      
      if (errorHistory.length > 0) {
        debugInfo.error_history = errorHistory;
      }
      
      return {
        success: true,
        model: modelConfig.id,
        text: generatedText,
        usage: {
          prompt_tokens: data.usage?.prompt_tokens || 0,
          completion_tokens: data.usage?.completion_tokens || 0,
          total_tokens: data.usage?.total_tokens || 0
        },
        debug: debugInfo,
        elapsed_ms: totalLatency,
        cost_usd: estimateCost(modelConfig.id, data.usage)
      };
      
    } catch (error) {
      lastError = error;
      
      // 🆕 记录失败详情
      const errorDetail = {
        model: modelConfig.id,
        error: error.message,
        type: error.name,
        timestamp: new Date().toISOString()
      };
      errorHistory.push(errorDetail);
      
      console.error(`❌ [SmartBrain] ${modelConfig.id} 失败: ${error.message}`);
      console.error(`   错误类型: ${error.name}`);
      
      // 如果不是最后一个模型，继续尝试下一个
      if (i < modelChain.length - 1) {
        console.log(`🔄 [SmartBrain] 切换到下一个模型...`);
        continue;
      }
    }
  }
  
  // 所有模型都失败了
  const totalLatency = Date.now() - requestStartTime;
  console.error(`❌ [SmartBrain] 所有模型均失败，最后错误:`, lastError?.message);
  console.error(`📋 [SmartBrain] 失败历史:`, JSON.stringify(errorHistory, null, 2));
  
  return {
    success: false,
    model: 'none',
    text: '⚠️ AI分析暂时不可用，所有模型均失败，请稍后再试。',
    error: lastError?.message || 'All models failed',
    debug: {
      model_used: 'none',
      fallback_used: true,
      latency_ms: totalLatency,
      attempts: modelChain.length,
      all_failed: true,
      error_history: errorHistory  // 🆕 暴露所有失败原因
    },
    elapsed_ms: totalLatency,
    cost_usd: 0
  };
}

/**
 * GPT-5单核分析生成（v4.1增强版）
 */
async function generateWithGPT5({
  text,
  marketData,
  semanticIntent,
  mode,
  scene,
  symbols,
  rankedNews = []
}) {
  console.log(`🧠 [SmartBrain] 开始生成分析...`);
  
  const startTime = Date.now();
  
  // 1. 构建prompt（复用v3.1的反编造系统）
  let systemPrompt = '';
  let userPrompt = '';
  
  try {
    // 使用buildAnalysisPrompt构建反编造prompt（仅当有有效marketData时）
    if (marketData && marketData.collected) {
      const fullPrompt = buildAnalysisPrompt({
        marketData,
        intent: semanticIntent,
        userQuery: text,
        mode,
        language: semanticIntent?.language || 'zh'
      });
      
      systemPrompt = `你是专业市场分析师。严格遵守以下规则：
1. 只使用提供的实时数据，禁止编造数字
2. 如果数据不足，明确说明而不是猜测
3. 保持自然语气，避免机器式复述
4. 进行深度推理：分析趋势、风险、机会，而不是简单复述数据
5. 🔴 **字数限制**：回复必须控制在800字以内（简洁、精准、有洞察力）`;
      
      userPrompt = fullPrompt;
      
      console.log(`✅ [SmartBrain] Prompt构建完成 (${fullPrompt.length}字)`);
    } else {
      // 无市场数据时：使用增强型通用分析模式
      throw new Error('无市场数据，使用增强型推理模式');
    }
    
  } catch (error) {
    console.log(`📝 [SmartBrain] 使用增强型推理模式:`, error.message);
    
    // 增强型推理prompt（不是简单模板！）
    systemPrompt = `你是USIS Brain高级市场分析师。你的核心能力：

🧠 **深度推理模式**（而非模板填充）：
1. **趋势分析** - 识别数据背后的市场逻辑和驱动因素
2. **风险评估** - 评估潜在风险和不确定性
3. **机会挖掘** - 发现市场机会和关键拐点
4. **策略建议** - 提供可执行的投资策略

📝 **输出风格**：
- 使用自然段落而非强制的数字列表（1、2、3）
- 像资深分析师和投资者对话，而非写报告
- 可以用emoji增强可读性，但要自然（如💡📊⚠️）
- 避免僵硬的markdown标题（###），用流畅的叙述
- 🔴 **字数限制**：回复必须控制在800字以内（简洁、精准、有洞察力）

⚠️ **禁止事项**：
- 禁止简单罗列数据（如"价格是X，涨幅Y%"）
- 禁止使用训练数据中的价格信息
- 禁止机械式复述而不做推理

✅ **必须做到**：
- 解释"为什么"（价格为什么涨/跌？市场在担心什么？）
- 推理"接下来"（基于当前数据，可能的走势是？）
- 建议"怎么做"（投资者应该关注什么？）

语言风格：自然、专业、有洞察力，像一个资深分析师在解读市场。`;
    
    // 构建智能上下文（而非简单摘要）
    let intelligentContext = '';
    
    // 1. 市场数据（如果有）
    if (marketData && marketData.summary) {
      intelligentContext += `📊 **实时市场数据**：\n${marketData.summary}\n\n`;
      
      // 添加数据质量信息
      if (marketData.metadata) {
        intelligentContext += `数据质量：${(marketData.metadata.dataQuality?.overallScore * 100 || 0).toFixed(0)}% | `;
        intelligentContext += `新鲜度：${(marketData.metadata.dataQuality?.freshnessAvg * 100 || 0).toFixed(0)}%\n\n`;
      }
    }
    
    // 2. ImpactRank新闻（智能注入）
    if (rankedNews && rankedNews.length > 0) {
      intelligentContext += `📰 **市场新闻动态**（按ImpactRank评分排序）：\n\n`;
      rankedNews.slice(0, 5).forEach((news, i) => {
        intelligentContext += `${i + 1}. **${news.title}**\n`;
        intelligentContext += `   影响力评分: ${news.impact_score.toFixed(1)}/10 (紧迫度:${news.urgency} | 相关度:${news.relevance} | 权威性:${news.authority})\n`;
        if (news.summary) {
          intelligentContext += `   摘要: ${news.summary}\n`;
        }
        intelligentContext += `   来源: ${news.source} | 发布时间: ${new Date(news.datetime).toLocaleString()}\n\n`;
      });
    }
    
    // 3. 语义意图（帮助AI理解用户真正想要什么）
    if (semanticIntent) {
      intelligentContext += `🎯 **用户意图解析**：\n`;
      intelligentContext += `- 意图类型: ${semanticIntent.intentType}\n`;
      intelligentContext += `- 分析模式: ${semanticIntent.mode}\n`;
      intelligentContext += `- 响应模式: ${semanticIntent.responseMode || 'full_report'}\n`;
      if (semanticIntent.reasoning) {
        intelligentContext += `- AI推理: ${semanticIntent.reasoning}\n`;
      }
      intelligentContext += `\n`;
    }
    
    // 4. 股票符号（如果有）
    if (symbols && symbols.length > 0) {
      intelligentContext += `📌 **关注标的**: ${symbols.join(', ')}\n\n`;
    }
    
    // 5. 分析指令（明确要求深度推理）
    intelligentContext += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    intelligentContext += `📋 **分析任务**：\n`;
    intelligentContext += `用户问题："${text}"\n\n`;
    intelligentContext += `请基于以上数据进行**深度推理分析**，而不是简单数据复述：\n`;
    intelligentContext += `1. 解读市场信号（数据和新闻背后的逻辑）\n`;
    intelligentContext += `2. 评估风险与机会（短期和中期视角）\n`;
    intelligentContext += `3. 提供可执行建议（具体的关注点和策略）\n\n`;
    intelligentContext += `注意：如果数据不足，明确说明而不是猜测。保持专业但自然的语气。`;
    
    userPrompt = intelligentContext;
  }
  
  // 2. 调用智能模型链（自动降级）
  return await callModelWithFallback({
    systemPrompt,
    userPrompt,
    requestStartTime: startTime
  });
}

/**
 * 估算模型调用成本（支持多模型）
 */
function estimateCost(modelId, usage) {
  if (!usage) return 0;
  
  // 模型定价表（$/1K tokens）
  const pricing = {
    'gpt-5-mini': { input: 0.005, output: 0.015 },
    'gpt-4o': { input: 0.0025, output: 0.010 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 }
  };
  
  const price = pricing[modelId] || pricing['gpt-4o-mini']; // 默认最便宜
  
  const inputCost = (usage.prompt_tokens / 1000) * price.input;
  const outputCost = (usage.completion_tokens / 1000) * price.output;
  
  return inputCost + outputCost;
}

/**
 * 🆕 v5.0: 生成数据驱动的机构级个股分析
 * @param {Object} dataPackage - 完整数据包（来自fetchDataDrivenAnalysis）
 * @param {string} chartAnalysis - Vision AI的技术分析（可选）
 * @param {Object} context - 附加上下文
 * @returns {Promise<Object>} 机构级分析结果
 */
async function generateDataDrivenStockAnalysis(dataPackage, chartAnalysis, context = {}) {
  const startTime = Date.now();
  const symbol = dataPackage.symbol;
  
  console.log(`\n📊 [Data-Driven Stock Analysis] 生成${symbol}机构级报告`);
  
  // 构建系统提示词 - 机构级分析师角色
  const systemPrompt = `你是高盛(Goldman Sachs)股票研究部的首席分析师，专注于提供数据驱动的投资建议。

【核心原则】
1. 数据至上：每个判断必须有数据支撑
2. 量化优先：优先使用具体数值和百分比
3. 权威表述：避免"可能"、"或许"等防御性措辞，直接陈述基于数据的判断
4. 结构清晰：采用机构投研报告格式
5. 可执行性：提供具体的操作建议和价格位

【支撑压力位使用规则】🎯
- 如果数据中包含"技术分析 - 支撑/压力位"，你必须直接引用其中的具体价格
- 不要说"我没有数据"或"无法给出精确价位"——数据已经在下方提供了
- 不要给理论框架或"如果你提供数据"的回答——直接使用已有数据

【禁止行为】
- 禁止编造任何未在数据中提供的数字
- 禁止使用"根据历史经验"等模糊表述
- 禁止提供无法验证的主观评论
- 禁止使用过多免责声明干扰核心结论
- 禁止在已有支撑压力位数据时说"我没有实时数据"`;

  // 构建用户提示词 - 数据驱动结构
  const userPrompt = buildDataDrivenPrompt(dataPackage, chartAnalysis, context);

  // 调用GPT-5生成报告
  const result = await callModelWithFallback({
    systemPrompt,
    userPrompt,
    requestStartTime: startTime
  });
  
  return result;
}

/**
 * 🆕 v6.2: 格式化Twelve Data技术指标
 */
function buildTwelveDataTechnicalText(technical_indicators) {
  if (!technical_indicators || technical_indicators.error) return '';
  
  const { rsi, macd, ema, bbands, adx } = technical_indicators;
  
  let text = '\n### 📊 Twelve Data技术指标 (实时)\n';
  
  // RSI指标
  if (rsi && !rsi.error) {
    const rsiValue = parseFloat(rsi.value);
    const rsiSignal = rsiValue > 70 ? '超买' : rsiValue < 30 ? '超卖' : '中性';
    text += `- **RSI(14)**: ${rsiValue.toFixed(2)} - ${rsiSignal}\n`;
  }
  
  // MACD指标
  if (macd && !macd.error) {
    const macdValue = parseFloat(macd.macd);
    const signal = parseFloat(macd.signal);
    const histogram = parseFloat(macd.histogram);
    const macdSignal = histogram > 0 ? '看多' : '看空';
    text += `- **MACD**: ${macdValue.toFixed(4)} (信号线: ${signal.toFixed(4)}, 柱状图: ${histogram.toFixed(4)}) - ${macdSignal}\n`;
  }
  
  // EMA指标
  if (ema && !ema.error) {
    text += `- **EMA(20)**: $${parseFloat(ema.value).toFixed(2)}\n`;
  }
  
  // 布林带
  if (bbands && !bbands.error) {
    text += `- **布林带**: 上轨 $${parseFloat(bbands.upper).toFixed(2)} | 中轨 $${parseFloat(bbands.middle).toFixed(2)} | 下轨 $${parseFloat(bbands.lower).toFixed(2)}\n`;
  }
  
  // ADX趋势强度
  if (adx && !adx.error) {
    const adxValue = parseFloat(adx.value);
    const trendStrength = adxValue > 25 ? '强趋势' : adxValue > 20 ? '中等趋势' : '弱趋势';
    text += `- **ADX(14)**: ${adxValue.toFixed(2)} - ${trendStrength}\n`;
  }
  
  return text + '\n';
}

/**
 * 🆕 v6.2: 格式化Twelve Data基本面数据
 */
function buildFundamentalsText(fundamentals) {
  if (!fundamentals || fundamentals.error) return '';
  
  let text = '\n### 💰 基本面数据 (Twelve Data)\n';
  
  // 利润表
  if (fundamentals.income_statement && !fundamentals.income_statement.error) {
    const income = fundamentals.income_statement.data;
    if (income) {
      text += `\n**利润表 (${income.fiscal_date || '最新年报'})**:\n`;
      if (income.total_revenue) text += `- 总收入: $${(income.total_revenue / 1e9).toFixed(2)}B\n`;
      if (income.net_income) text += `- 净利润: $${(income.net_income / 1e9).toFixed(2)}B\n`;
      if (income.operating_income) text += `- 营业利润: $${(income.operating_income / 1e9).toFixed(2)}B\n`;
      if (income.gross_profit) text += `- 毛利润: $${(income.gross_profit / 1e9).toFixed(2)}B\n`;
    }
  }
  
  // 资产负债表
  if (fundamentals.balance_sheet && !fundamentals.balance_sheet.error) {
    const balance = fundamentals.balance_sheet.data;
    if (balance) {
      text += `\n**资产负债表 (${balance.fiscal_date || '最新'})**:\n`;
      if (balance.total_assets) text += `- 总资产: $${(balance.total_assets / 1e9).toFixed(2)}B\n`;
      if (balance.total_liabilities) text += `- 总负债: $${(balance.total_liabilities / 1e9).toFixed(2)}B\n`;
      if (balance.total_equity) text += `- 股东权益: $${(balance.total_equity / 1e9).toFixed(2)}B\n`;
      if (balance.cash) text += `- 现金: $${(balance.cash / 1e9).toFixed(2)}B\n`;
    }
  }
  
  // 现金流量表
  if (fundamentals.cash_flow && !fundamentals.cash_flow.error) {
    const cashFlow = fundamentals.cash_flow.data;
    if (cashFlow) {
      text += `\n**现金流量表 (${cashFlow.fiscal_date || '最新'})**:\n`;
      if (cashFlow.operating_cash_flow) text += `- 经营性现金流: $${(cashFlow.operating_cash_flow / 1e9).toFixed(2)}B\n`;
      if (cashFlow.investing_cash_flow) text += `- 投资性现金流: $${(cashFlow.investing_cash_flow / 1e9).toFixed(2)}B\n`;
      if (cashFlow.financing_cash_flow) text += `- 筹资性现金流: $${(cashFlow.financing_cash_flow / 1e9).toFixed(2)}B\n`;
    }
  }
  
  // 统计数据
  if (fundamentals.statistics && !fundamentals.statistics.error) {
    const stats = fundamentals.statistics.data;
    if (stats) {
      text += `\n**估值指标**:\n`;
      if (stats.pe_ratio) text += `- P/E比率: ${stats.pe_ratio.toFixed(2)}\n`;
      if (stats.pb_ratio) text += `- P/B比率: ${stats.pb_ratio.toFixed(2)}\n`;
      if (stats.dividend_yield) text += `- 股息率: ${(stats.dividend_yield * 100).toFixed(2)}%\n`;
      if (stats.market_cap) text += `- 市值: $${(stats.market_cap / 1e9).toFixed(2)}B\n`;
    }
  }
  
  return text + '\n';
}

/**
 * 🆕 v6.2: 格式化Twelve Data分析师评级
 */
function buildAnalystRatingsText(analyst_ratings) {
  if (!analyst_ratings || analyst_ratings.error) return '';
  
  let text = '\n### 👔 分析师评级 (Twelve Data)\n';
  
  // 推荐评级
  if (analyst_ratings.recommendations && !analyst_ratings.recommendations.error) {
    const rec = analyst_ratings.recommendations;
    if (rec.buy || rec.strong_buy || rec.hold || rec.sell) {
      text += `\n**分析师推荐汇总**:\n`;
      if (rec.strong_buy) text += `- 强力买入: ${rec.strong_buy} 位分析师\n`;
      if (rec.buy) text += `- 买入: ${rec.buy} 位分析师\n`;
      if (rec.hold) text += `- 持有: ${rec.hold} 位分析师\n`;
      if (rec.sell) text += `- 卖出: ${rec.sell} 位分析师\n`;
      if (rec.strong_sell) text += `- 强力卖出: ${rec.strong_sell} 位分析师\n`;
      if (rec.recommendation_mean) text += `- 平均评级: ${rec.recommendation_mean}\n`;
    }
  }
  
  // 价格目标
  if (analyst_ratings.price_target && !analyst_ratings.price_target.error) {
    const target = analyst_ratings.price_target;
    if (target.price_target_average || target.price_target_high || target.price_target_low) {
      text += `\n**分析师目标价**:\n`;
      if (target.price_target_average) text += `- 平均目标价: $${target.price_target_average.toFixed(2)}\n`;
      if (target.price_target_high) text += `- 最高目标价: $${target.price_target_high.toFixed(2)}\n`;
      if (target.price_target_low) text += `- 最低目标价: $${target.price_target_low.toFixed(2)}\n`;
      if (target.number_of_analysts) text += `- 覆盖分析师数: ${target.number_of_analysts} 位\n`;
    }
  }
  
  return text + '\n';
}

/**
 * 🆕 v5.0: 构建数据驱动提示词（机构级投研模板）
 */
function buildDataDrivenPrompt(dataPackage, chartAnalysis, context) {
  const { symbol, quote, profile, metrics, news, technical_indicators, fundamentals, analyst_ratings } = dataPackage;
  
  // 🎯 计算技术分析：支撑压力位
  let technicalLevelsText = '';
  if (quote && quote.currentPrice) {
    try {
      const { calculateSupportResistance } = require('./technicalLevels');
      const technicalLevels = calculateSupportResistance(quote);
      if (technicalLevels) {
        console.log(`✅ [Technical Levels] ${symbol} 支撑压力位已计算并注入到prompt`);
        
        const resistances = technicalLevels.resistances.map((r, i) => 
          `  ${i+1}. $${r.price.toFixed(2)} (+${r.distance}%) - ${r.type}`
        ).join('\n');
        
        const supports = technicalLevels.supports.map((s, i) => 
          `  ${i+1}. $${s.price.toFixed(2)} (-${s.distance}%) - ${s.type}`
        ).join('\n');
        
        technicalLevelsText = '\n### 技术分析 - 支撑/压力位 (Pivot Points算法)\n' +
          '- **当前价格**: $' + technicalLevels.current.toFixed(2) + '\n\n' +
          '**📈 压力位 (Resistance Levels)**:\n' + resistances + '\n\n' +
          '**📉 支撑位 (Support Levels)**:\n' + supports + '\n\n' +
          '**🎯 关键价位**:\n' +
          '- Pivot Point: $' + technicalLevels.pivot.main.toFixed(2) + '\n' +
          '- R1: $' + technicalLevels.pivot.r1.toFixed(2) + ' | S1: $' + technicalLevels.pivot.s1.toFixed(2) + '\n' +
          '- R2: $' + technicalLevels.pivot.r2.toFixed(2) + ' | S2: $' + technicalLevels.pivot.s2.toFixed(2) + '\n' +
          '- 今日高: $' + technicalLevels.keyLevels.todayHigh.toFixed(2) + ' | 今日低: $' + technicalLevels.keyLevels.todayLow.toFixed(2) + '\n';
      }
    } catch (err) {
      console.warn(`[Technical Levels] 计算失败: ${err.message}`);
    }
  }
  
  // 计算关键指标
  const marketCap = profile?.marketCapitalization 
    ? `$${(profile.marketCapitalization / 1000).toFixed(2)}B` 
    : 'N/A';
  
  const currentPrice = quote?.currentPrice?.toFixed(2) || 'N/A';
  const changePercent = quote?.changePercent?.toFixed(2) || 0;
  const changeSymbol = quote?.changePercent >= 0 ? '+' : '';
  
  // 估值水平判断
  const peRatio = metrics?.peRatio?.toFixed(2) || 'N/A';
  const pbRatio = metrics?.pbRatio?.toFixed(2) || 'N/A';
  
  // 盈利能力
  const profitMargin = metrics?.profitMargin 
    ? `${(metrics.profitMargin * 100).toFixed(1)}%` 
    : 'N/A';
  const roe = metrics?.roe 
    ? `${(metrics.roe * 100).toFixed(1)}%` 
    : 'N/A';
  
  // 成长性
  const revenueGrowth = metrics?.revenueGrowth 
    ? `${(metrics.revenueGrowth * 100).toFixed(1)}%` 
    : 'N/A';
  
  // 52周区间
  const high52Week = metrics?.high52Week?.toFixed(2) || 'N/A';
  const low52Week = metrics?.low52Week?.toFixed(2) || 'N/A';
  
  // 当前价格在52周区间的位置
  let pricePosition = 'N/A';
  if (quote?.currentPrice && metrics?.high52Week && metrics?.low52Week) {
    const range = metrics.high52Week - metrics.low52Week;
    const position = (quote.currentPrice - metrics.low52Week) / range;
    pricePosition = `${(position * 100).toFixed(1)}%`;
  }
  
  // 新闻摘要
  const newsHeadlines = news?.slice(0, 3).map((n, i) => `${i+1}. ${n.headline}`).join('\n') || '暂无近期新闻';
  
  return `基于以下实时数据为${symbol}生成机构级投资分析报告：

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 **核心数据** (数据来源: Finnhub实时API)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 基本信息
- **股票代码**: ${symbol}
- **公司名称**: ${profile?.companyName || 'N/A'}
- **行业分类**: ${profile?.finnhubIndustry || 'N/A'}
- **交易所**: ${profile?.exchange || 'N/A'}
- **市值**: ${marketCap}

### 实时行情
- **当前价格**: $${currentPrice}
- **涨跌幅**: ${changeSymbol}${changePercent}%
- **开盘价**: $${quote?.open?.toFixed(2) || 'N/A'}
- **日内高低**: $${quote?.high?.toFixed(2) || 'N/A'} / $${quote?.low?.toFixed(2) || 'N/A'}
- **昨收**: $${quote?.previousClose?.toFixed(2) || 'N/A'}

### 估值指标
- **市盈率(P/E)**: ${peRatio}
- **市净率(P/B)**: ${pbRatio}
- **盈利能力(净利润率)**: ${profitMargin}
- **股东回报(ROE)**: ${roe}

### 成长性指标
- **营收增长(YoY)**: ${revenueGrowth}
- **EPS增长(YoY)**: ${metrics?.epsGrowth ? `${(metrics.epsGrowth * 100).toFixed(1)}%` : 'N/A'}

### 技术指标
- **52周高点**: $${high52Week}
- **52周低点**: $${low52Week}
- **当前位置**: ${pricePosition} (在52周区间内)
- **Beta系数**: ${metrics?.beta?.toFixed(2) || 'N/A'}

${technicalLevelsText}
${buildTwelveDataTechnicalText(technical_indicators)}
${buildFundamentalsText(fundamentals)}
${buildAnalystRatingsText(analyst_ratings)}
${chartAnalysis ? `### Vision AI技术分析\n${chartAnalysis}\n` : ''}

### 近期新闻
${newsHeadlines}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 **分析要求** (机构投研报告格式)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

请按照以下结构生成**数据驱动**的分析报告：

## 📈 ${symbol} 投资分析报告

**【市场快照】**
📊 **现价**: $${currentPrice} (${changeSymbol}${changePercent}%)
📈 **日内波动**: $${quote?.low?.toFixed(2) || 'N/A'} - $${quote?.high?.toFixed(2) || 'N/A'}
💰 **市值**: ${marketCap} | **P/E**: ${peRatio}

---

### 🔍 执行摘要
【直接陈述核心判断，无防御性开场白】
基于${symbol}当前市值${marketCap}和${changeSymbol}${changePercent}%的表现，市场对该股的定位是...${peRatio !== 'N/A' ? `估值水平显示P/E=${peRatio}` : '估值数据暂缺'}。核心投资逻辑...

### 📊 量化数据分析

**市场表现**
- 当日表现: 数据显示${symbol}报收$${currentPrice}，${changeSymbol}${changePercent}%...
- 历史区间: 当前价格位于52周区间的${pricePosition}位置，距离高点$${high52Week}...

**估值水平**
- P/E=${peRatio}，相对行业均值...（给出判断：高估/合理/低估）
- 盈利质量: 净利润率${profitMargin}，ROE=${roe}，显示公司...

**成长性**
- 营收增长${revenueGrowth}，指标显示...
- EPS增长趋势...

${chartAnalysis ? '**技术面**\n- 图表显示...\n- 关键价格位...\n' : ''}

### 🎯 投资主题
【基于数据提炼2-3个核心主题】
1. **主题1**: （数据支撑）
2. **主题2**: （数据支撑）

### ⚠️ 风险评估
【量化风险，给出具体监控指标】
- **风险1**: （具体数据 + 影响程度）
- **风险2**: （监控指标）

### 💡 操作建议

**目标价位**: 基于当前估值${peRatio}倍P/E和行业对标...
**建议仓位**: （具体百分比）
**入场策略**: 
- 激进型: $XX - $XX
- 稳健型: $XX - $XX
**止损位**: $XX（理由：技术支撑/估值下限）

**投资时间框架**: 短期(1-3月) / 中期(3-6月)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  **写作规范**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. **严格使用提供的数据**：所有数值必须来自上述数据，禁止编造
2. **数据驱动陈述**：使用"数据显示"、"图表显示"、"指标证实"等确定性表述
3. **禁止防御性开场白**：
   ❌ "我没有实时数据..."
   ❌ "作为AI，我需要提醒..."
   ❌ "根据历史经验可能..."
   ✅ "基于实时图表分析，${symbol}报收$${currentPrice}..."
   ✅ "数据显示该股位于52周区间的${pricePosition}位置..."
4. **强制量化指标（基于可用数据）**：
   - 如果有估值数据（P/E、P/B），必须给出基于估值的目标价位
   - 如果有技术数据（52周高低点），必须给出基于技术支撑的入场区间
   - 如果有完整数据，必须给出量化风险评分（1-10分）
   - 如果数据不足，明确说明"当前数据不足以计算精确目标价位"
5. **可执行性**：尽可能给出具体建议
   - 有充分数据时："建议20%仓位在$XX-$XX区间分批建仓"
   - 数据不足时："建议等待更多财报数据后再做决策"

请立即生成报告：`;
}

/**
 * 🔄 v5.0兼容层：旧版generateStockAnalysis（已废弃，保留向后兼容）
 * 建议使用generateDataDrivenStockAnalysis
 */
async function generateStockAnalysis(stockData, chartAnalysis, context = {}) {
  console.warn('⚠️  [Deprecated] 使用旧版generateStockAnalysis，建议升级到generateDataDrivenStockAnalysis');
  
  // 简单包装为新格式
  const dataPackage = {
    symbol: stockData.symbol,
    quote: {
      currentPrice: stockData.c,
      changePercent: stockData.dp,
      change: stockData.d,
      open: stockData.o,
      high: stockData.h,
      low: stockData.l,
      previousClose: stockData.pc
    },
    profile: {
      companyName: stockData.companyName,
      exchange: stockData.exchange
    },
    metrics: null,
    news: []
  };
  
  return generateDataDrivenStockAnalysis(dataPackage, chartAnalysis, context);
}

/**
 * 兼容层：包装成synthesizeAIOutputs格式
 */
function wrapAsV31Synthesis(gpt5Result) {
  return {
    success: gpt5Result.success,
    synthesized: true,
    text: gpt5Result.text,
    confidence: gpt5Result.success ? 0.95 : 0.3,
    model: gpt5Result.model,
    usage: gpt5Result.usage,
    cost_usd: gpt5Result.cost_usd,
    debug: gpt5Result.debug // v4.1新增：调试信息
  };
}

module.exports = {
  callModelWithFallback, // 🆕 v7.0 Brief Bot 需要
  generateWithGPT5,
  generateStockAnalysis, // 旧版（兼容）
  generateDataDrivenStockAnalysis, // 🆕 v5.0新版
  wrapAsV31Synthesis
};
