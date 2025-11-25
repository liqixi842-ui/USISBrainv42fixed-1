/**
 * multiModelConsensus.js
 * 
 * Phase 6D: 多模型智囊团（Multi-Model Consensus）
 * 用于 Premium PDF 增强 - 整合多个 AI 模型的观点
 * 
 * 功能：
 * - 并行调用 GPT-4o-mini, Claude 3.5 Sonnet, DeepSeek V3
 * - 对每个模型的分析结果进行投票和评分
 * - 生成共识报告和分歧点分析
 */

const fetch = require('node-fetch');

// API 密钥
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';

/**
 * 获取多模型观点
 * @param {string} symbol - 股票代码
 * @param {string} language - 语言（en/zh/es）
 * @param {Object} context - 上下文数据（报价、财务数据等）
 * @returns {Promise<Object>} 多模型分析结果
 */
async function getMultiModelViews(symbol, language = 'en', context = {}) {
  console.log(`\n🧠 [MultiModel] Starting consensus analysis for ${symbol}`);
  console.log(`   ├─ Language: ${language}`);
  console.log(`   └─ Models: GPT-4o-mini, Claude 3.5, DeepSeek V3\n`);
  
  const prompt = buildAnalysisPrompt(symbol, language, context);
  
  // 并行调用所有模型
  const [gptResult, claudeResult, deepseekResult] = await Promise.allSettled([
    callGPT4oMini(prompt),
    callClaude35(prompt),
    callDeepSeekV3(prompt)
  ]);
  
  // 整理结果
  const models = {
    gpt4o_mini: processResult(gptResult, 'GPT-4o-mini'),
    claude_35: processResult(claudeResult, 'Claude 3.5'),
    deepseek_v3: processResult(deepseekResult, 'DeepSeek V3')
  };
  
  // 统计成功/失败
  const successCount = Object.values(models).filter(m => m.success).length;
  console.log(`\n✅ [MultiModel] ${successCount}/3 models completed successfully\n`);
  
  return models;
}

/**
 * 生成共识报告
 * @param {Object} models - 多模型结果
 * @param {string} language - 语言
 * @returns {Object} 共识分析
 */
function consolidateConsensus(models, language = 'en') {
  console.log(`\n📊 [MultiModel] Consolidating consensus...`);
  
  const successfulModels = Object.entries(models)
    .filter(([, result]) => result.success)
    .map(([name, result]) => ({ name, ...result }));
  
  if (successfulModels.length === 0) {
    console.warn(`⚠️  [MultiModel] No successful model results`);
    return {
      consensus: language === 'zh' ? '无法生成共识：所有模型均失败' : 'Unable to generate consensus: all models failed',
      confidence: 0,
      ratings: {},
      divergence: []
    };
  }
  
  // 提取评级
  const ratings = extractRatings(successfulModels);
  
  // 计算共识评级
  const consensusRating = calculateConsensusRating(ratings);
  
  // 识别分歧点
  const divergence = identifyDivergence(successfulModels);
  
  // 生成共识文本
  const consensusText = generateConsensusText(successfulModels, consensusRating, language);
  
  console.log(`✅ [MultiModel] Consensus: ${consensusRating.rating} (${consensusRating.confidence}% confidence)`);
  console.log(`   ├─ Agreement: ${ratings.length > 0 ? 'Yes' : 'Partial'}`);
  console.log(`   └─ Divergence points: ${divergence.length}\n`);
  
  return {
    consensus: consensusText,
    rating: consensusRating.rating,
    confidence: consensusRating.confidence,
    ratings: ratings,
    divergence: divergence,
    models: successfulModels.map(m => m.name)
  };
}

// ═══════════════════════════════════════════════════════════════
// AI 模型调用函数
// ═══════════════════════════════════════════════════════════════

/**
 * 调用 GPT-4o-mini
 */
async function callGPT4oMini(prompt) {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }
  
  console.log(`🤖 [GPT-4o-mini] Sending request...`);
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a professional financial analyst. Provide concise investment analysis.' },
        { role: 'user', content: prompt }
      ],
      max_completion_tokens: 1500,
      temperature: 0.7
    }),
    timeout: 30000
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GPT-4o-mini API error ${response.status}: ${errorText.substring(0, 200)}`);
  }
  
  const data = await response.json();
  const analysis = data.choices?.[0]?.message?.content;
  
  if (!analysis) {
    throw new Error('GPT-4o-mini returned empty response');
  }
  
  console.log(`✅ [GPT-4o-mini] Success (${analysis.length} chars)`);
  
  return {
    analysis,
    model: 'gpt-4o-mini',
    usage: data.usage
  };
}

/**
 * 调用 Claude 3.5 Sonnet
 */
async function callClaude35(prompt) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key not configured');
  }
  
  console.log(`🤖 [Claude 3.5] Sending request...`);
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1500,
      messages: [
        { role: 'user', content: prompt }
      ],
      system: 'You are a professional financial analyst. Provide concise investment analysis.'
    }),
    timeout: 30000
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude 3.5 API error ${response.status}: ${errorText.substring(0, 200)}`);
  }
  
  const data = await response.json();
  const analysis = data.content?.[0]?.text;
  
  if (!analysis) {
    throw new Error('Claude 3.5 returned empty response');
  }
  
  console.log(`✅ [Claude 3.5] Success (${analysis.length} chars)`);
  
  return {
    analysis,
    model: 'claude-3-5-sonnet',
    usage: data.usage
  };
}

/**
 * 调用 DeepSeek V3
 */
async function callDeepSeekV3(prompt) {
  if (!DEEPSEEK_API_KEY) {
    throw new Error('DeepSeek API key not configured');
  }
  
  console.log(`🤖 [DeepSeek V3] Sending request...`);
  
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'You are a professional financial analyst. Provide concise investment analysis.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1500,
      temperature: 0.7
    }),
    timeout: 30000
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek V3 API error ${response.status}: ${errorText.substring(0, 200)}`);
  }
  
  const data = await response.json();
  const analysis = data.choices?.[0]?.message?.content;
  
  if (!analysis) {
    throw new Error('DeepSeek V3 returned empty response');
  }
  
  console.log(`✅ [DeepSeek V3] Success (${analysis.length} chars)`);
  
  return {
    analysis,
    model: 'deepseek-chat',
    usage: data.usage
  };
}

// ═══════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════

/**
 * 处理 Promise.allSettled 结果
 */
function processResult(result, modelName) {
  if (result.status === 'fulfilled') {
    return {
      success: true,
      ...result.value
    };
  } else {
    console.error(`❌ [${modelName}] Failed: ${result.reason.message}`);
    return {
      success: false,
      model: modelName,
      error: result.reason.message
    };
  }
}

/**
 * 构建分析提示词
 * @param {string} symbol - 股票代码
 * @param {string} language - 语言
 * @param {Object} context - 上下文数据
 * @returns {string} 提示词
 */
function buildAnalysisPrompt(symbol, language, context) {
  const lang = language === 'zh' ? 'Chinese' : language === 'es' ? 'Spanish' : 'English';
  
  const contextStr = Object.keys(context).length > 0 
    ? `\n\nContext data:\n${Object.entries(context).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`
    : '';
  
  return `Analyze stock ${symbol} and provide:
1. Investment Rating (Strong Buy / Buy / Hold / Sell / Strong Sell)
2. Key Strengths (2-3 bullet points)
3. Key Risks (2-3 bullet points)
4. Price Target (if possible)
5. Brief Rationale (2-3 sentences)${contextStr}

Respond in ${lang}. Be concise and professional.`;
}

/**
 * 提取评级
 */
function extractRatings(models) {
  const ratings = [];
  
  const ratingKeywords = {
    'Strong Buy': 5,
    'Buy': 4,
    'Hold': 3,
    'Sell': 2,
    'Strong Sell': 1
  };
  
  models.forEach(model => {
    const analysis = model.analysis.toLowerCase();
    
    for (const [rating, score] of Object.entries(ratingKeywords)) {
      if (analysis.includes(rating.toLowerCase())) {
        ratings.push({ model: model.name, rating, score });
        break;
      }
    }
  });
  
  return ratings;
}

/**
 * 计算共识评级
 */
function calculateConsensusRating(ratings) {
  if (ratings.length === 0) {
    return { rating: 'N/A', confidence: 0 };
  }
  
  // 计算平均分数
  const avgScore = ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;
  
  // 转换为评级
  const scoreToRating = {
    5: 'Strong Buy',
    4: 'Buy',
    3: 'Hold',
    2: 'Sell',
    1: 'Strong Sell'
  };
  
  const roundedScore = Math.round(avgScore);
  const rating = scoreToRating[roundedScore] || 'Hold';
  
  // 计算一致性（置信度）
  const uniqueRatings = new Set(ratings.map(r => r.rating));
  const confidence = Math.round((1 - (uniqueRatings.size - 1) / ratings.length) * 100);
  
  return { rating, confidence, avgScore };
}

/**
 * 识别分歧点
 */
function identifyDivergence(models) {
  const divergence = [];
  
  // 简单实现：如果评级不同，标记为分歧
  const ratings = models.map(m => {
    const analysis = m.analysis.toLowerCase();
    if (analysis.includes('strong buy')) return 'Strong Buy';
    if (analysis.includes('buy')) return 'Buy';
    if (analysis.includes('hold')) return 'Hold';
    if (analysis.includes('sell')) return 'Sell';
    if (analysis.includes('strong sell')) return 'Strong Sell';
    return 'Unknown';
  });
  
  const uniqueRatings = new Set(ratings);
  
  if (uniqueRatings.size > 1) {
    divergence.push({
      aspect: 'Rating',
      views: models.map((m, i) => ({ model: m.name, rating: ratings[i] }))
    });
  }
  
  return divergence;
}

/**
 * 生成共识文本
 */
function generateConsensusText(models, consensusRating, language) {
  const lang = {
    en: {
      consensus: 'Multi-Model Consensus Analysis',
      rating: 'Consensus Rating',
      confidence: 'Confidence',
      models: 'Models Consulted'
    },
    zh: {
      consensus: '多模型共识分析',
      rating: '共识评级',
      confidence: '置信度',
      models: '咨询模型'
    },
    es: {
      consensus: 'Análisis de Consenso Multi-Modelo',
      rating: 'Calificación de Consenso',
      confidence: 'Confianza',
      models: 'Modelos Consultados'
    }
  }[language] || { consensus: 'Multi-Model Consensus Analysis', rating: 'Consensus Rating', confidence: 'Confidence', models: 'Models Consulted' };
  
  const modelNames = models.map(m => m.name).join(', ');
  
  return `**${lang.consensus}**\n\n` +
         `${lang.rating}: **${consensusRating.rating}**\n` +
         `${lang.confidence}: ${consensusRating.confidence}%\n` +
         `${lang.models}: ${modelNames}\n\n` +
         models.map(m => `**${m.name}**: ${m.analysis.substring(0, 300)}...`).join('\n\n');
}

module.exports = {
  getMultiModelViews,
  consolidateConsensus
};
