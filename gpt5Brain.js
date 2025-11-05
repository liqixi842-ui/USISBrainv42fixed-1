// USIS Brain v4.0 - GPT-5单核生成引擎
// 替换多AI并行投票，保留实时数据优势

const fetch = require('node-fetch');
const { buildAnalysisPrompt } = require('./analysisPrompt');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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
    // 使用buildAnalysisPrompt构建反编造prompt
    const fullPrompt = buildAnalysisPrompt({
      marketData,
      intent: semanticIntent,
      userQuery: text,
      mode,
      language: semanticIntent?.language || 'zh'
    });
    
    // 分离system和user部分
    systemPrompt = `你是专业市场分析师。严格遵守以下规则：
1. 只使用提供的实时数据，禁止编造数字
2. 如果数据不足，明确说明而不是猜测
3. 保持自然语气，避免机器式复述
4. 根据responseMode生成对应格式：
   - news: 只输出新闻资讯
   - analysis: 只输出市场分析
   - advice: 只输出操作建议
   - full_report: 完整报告（默认）`;
    
    userPrompt = fullPrompt;
    
    console.log(`✅ [GPT-5 Brain] Prompt构建完成 (${fullPrompt.length}字)`);
    
  } catch (error) {
    console.warn(`⚠️  [GPT-5 Brain] Prompt构建失败，使用简化版本:`, error.message);
    
    // 降级：简化prompt
    systemPrompt = `你是专业市场分析师。基于提供的实时数据生成分析，禁止编造数据。`;
    
    // 构建简化的数据上下文
    let dataContext = '';
    if (marketData && marketData.summary) {
      dataContext = `实时市场数据：\n${marketData.summary}\n\n`;
    }
    
    if (rankedNews && rankedNews.length > 0) {
      dataContext += `最新新闻（ImpactRank排序）：\n`;
      rankedNews.slice(0, 3).forEach((news, i) => {
        dataContext += `${i + 1}. ${news.title} (评分: ${news.impact_score})\n`;
      });
      dataContext += '\n';
    }
    
    userPrompt = `${dataContext}用户问题：${text}`;
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
        model: 'gpt-4o', // 暂用gpt-4o，GPT-5正式发布后改为gpt-5-turbo
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1200,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      }),
      timeout: 30000
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API错误 (${response.status}): ${errorText}`);
    }
    
    const data = await response.json();
    const generatedText = data.choices?.[0]?.message?.content;
    
    if (!generatedText) {
      throw new Error('GPT-5返回空内容');
    }
    
    const elapsed = Date.now() - startTime;
    console.log(`✅ [GPT-5 Brain] 生成完成 (${elapsed}ms, ${generatedText.length}字)`);
    
    // 3. 返回兼容v3.1的格式（保持与multiAIAnalysis一致）
    return {
      success: true,
      model: 'gpt-5-single',
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
    
    // 降级：返回错误信息
    return {
      success: false,
      model: 'gpt-5-single',
      text: '⚠️ AI分析暂时不可用，请稍后再试。',
      error: error.message,
      elapsed_ms: Date.now() - startTime,
      cost_usd: 0
    };
  }
}

/**
 * 估算GPT-5调用成本
 */
function estimateCost(usage) {
  if (!usage) return 0;
  
  // GPT-4o定价（待GPT-5发布后更新）
  const INPUT_COST_PER_1K = 0.005;  // $0.005/1K tokens
  const OUTPUT_COST_PER_1K = 0.015; // $0.015/1K tokens
  
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
