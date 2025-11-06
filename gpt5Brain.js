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
 * 🆕 生成个股综合分析（基础数据 + 图表技术分析）
 * @param {Object} stockData - 股票基础数据
 * @param {string} chartAnalysis - Vision AI的技术分析
 * @param {Object} context - 附加上下文
 * @returns {Promise<Object>} 综合分析结果
 */
async function generateStockAnalysis(stockData, chartAnalysis, context = {}) {
  const startTime = Date.now();
  
  console.log(`\n📊 [Stock Analysis] 生成${stockData.symbol}综合报告`);
  
  // 构建系统提示词
  const systemPrompt = `你是一位资深股票分析师，擅长综合基本面和技术面分析。请基于提供的数据生成专业的个股分析报告。

【输出要求】
1. 使用标准Markdown格式（## ### -）
2. 结合实时数据和技术分析给出结论
3. 提供具体的数值和价格位
4. 保持客观中立的专业态度
5. 避免绝对化判断，注明风险提示`;

  // 构建用户提示词
  const userPrompt = `请为${stockData.symbol}生成综合分析报告：

## 基础数据

**代码**: ${stockData.symbol || 'N/A'}
**公司**: ${stockData.companyName || 'N/A'}
**交易所**: ${stockData.exchange || 'N/A'}
**当前价**: $${stockData.c?.toFixed(2) || 'N/A'}
**涨跌额**: ${stockData.d >= 0 ? '+' : ''}${stockData.d?.toFixed(2) || 0}
**涨跌幅**: ${stockData.dp >= 0 ? '+' : ''}${stockData.dp?.toFixed(2) || 0}%
**开盘价**: $${stockData.o?.toFixed(2) || 'N/A'}
**最高价**: $${stockData.h?.toFixed(2) || 'N/A'}
**最低价**: $${stockData.l?.toFixed(2) || 'N/A'}
**昨收价**: $${stockData.pc?.toFixed(2) || 'N/A'}

## 图表技术分析

${chartAnalysis || '暂无技术分析'}

## 请输出以下内容

### I. 行情概览
- 当日走势特征
- 与昨收价对比分析
- 日内波动幅度评估

### II. 技术面综合判断
- 结合图表分析给出趋势判断
- 关键支撑阻力位确认
- 交易信号强度评估

### III. 操作建议
- 适合的交易策略（买入/观望/卖出）
- 建议入场价位和仓位
- 止损止盈设置建议

### IV. 风险提示
- 主要风险因素
- 需要关注的市场变化
- 投资者适用性说明

【注意】保持简洁专业，突出关键信息`;

  // 调用GPT-5生成报告
  const result = await callModelWithFallback({
    systemPrompt,
    userPrompt,
    requestStartTime: startTime
  });
  
  return result;
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
  generateWithGPT5,
  generateStockAnalysis,
  wrapAsV31Synthesis
};
