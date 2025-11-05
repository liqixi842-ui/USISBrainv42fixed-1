// USIS Brain v4.0 - GPT-5单核生成引擎
// 替换多AI并行投票，保留实时数据优势

const fetch = require('node-fetch');
const { buildAnalysisPrompt } = require('./analysisPrompt');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// 🔍 诊断：在模块加载时检查密钥
console.log(`🔑 [GPT-5 Brain] 模块加载 - OPENAI_API_KEY状态: ${OPENAI_API_KEY ? '已设置(' + OPENAI_API_KEY.slice(0, 7) + '...)' : '❌ 未设置'}`);

/**
 * GPT-5单核分析生成
 * 输入：实时市场数据 + 用户问题
 * 输出：统一格式的分析报告
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
  console.log(`🧠 [GPT-5 Brain] 开始生成分析...`);
  
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
      
      console.log(`✅ [GPT-5 Brain] Prompt构建完成 (${fullPrompt.length}字)`);
    } else {
      // 无市场数据时：使用增强型通用分析模式
      throw new Error('无市场数据，使用增强型推理模式');
    }
    
  } catch (error) {
    console.log(`📝 [GPT-5 Brain] 使用增强型推理模式:`, error.message);
    
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
  
  // 2. 调用GPT-5 API
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-5-mini', // ✅ GPT-5 Mini (系统卡: gpt-5-thinking-mini)
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 4000  // 🔧 GPT-5不支持temperature等参数，只保留必需参数
      }),
      timeout: 90000  // 🔧 GPT-5推理需要更长时间（90秒）
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API错误 (${response.status}): ${errorText}`);
    }
    
    const data = await response.json();
    const generatedText = data.choices?.[0]?.message?.content;
    const apiReturnedModel = data.model;  // API返回的实际模型
    
    if (!generatedText) {
      throw new Error('GPT-5返回空内容');
    }
    
    const elapsed = Date.now() - startTime;
    console.log(`✅ [GPT-5 Brain] 生成完成 (${elapsed}ms, ${generatedText.length}字, 实际模型=${apiReturnedModel})`);
    
    // 3. 返回兼容v3.1的格式（保持与multiAIAnalysis一致）
    return {
      success: true,
      model: 'gpt-5-mini',  // ✅ 正式GPT-5 Mini (成本优化的推理和聊天)
      text: generatedText,
      usage: {
        prompt_tokens: data.usage?.prompt_tokens || 0,
        completion_tokens: data.usage?.completion_tokens || 0,
        total_tokens: data.usage?.total_tokens || 0
      },
      elapsed_ms: elapsed,
      cost_usd: estimateCost(data.usage)
    };
    
  } catch (error) {
    console.error(`❌ [GPT-5 Brain] 生成失败:`, error.message);
    console.error(`❌ [GPT-5 Brain] 错误堆栈:`, error.stack);
    console.error(`❌ [GPT-5 Brain] OPENAI_API_KEY状态:`, OPENAI_API_KEY ? '已设置' : '未设置');
    
    // 降级：返回错误信息
    return {
      success: false,
      model: 'gpt-5-mini',
      text: '⚠️ AI分析暂时不可用，请稍后再试。',
      error: error.message,
      error_detail: error.stack?.split('\n')[0] || 'Unknown',
      elapsed_ms: Date.now() - startTime,
      cost_usd: 0
    };
  }
}

/**
 * 估算GPT-5 Mini调用成本
 */
function estimateCost(usage) {
  if (!usage) return 0;
  
  // GPT-5 Mini定价 (根据官方文档更新)
  const INPUT_COST_PER_1K = 0.005;  // $0.005/1K tokens (待确认实际价格)
  const OUTPUT_COST_PER_1K = 0.015; // $0.015/1K tokens (待确认实际价格)
  
  const inputCost = (usage.prompt_tokens / 1000) * INPUT_COST_PER_1K;
  const outputCost = (usage.completion_tokens / 1000) * OUTPUT_COST_PER_1K;
  
  return inputCost + outputCost;
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
    cost_usd: gpt5Result.cost_usd
  };
}

module.exports = {
  generateWithGPT5,
  wrapAsV31Synthesis
};
