/**
 * v3-dev Research Report Service v1 (Test Version)
 * 只在开发环境使用，不影响 v2-stable
 */

const fetch = require('node-fetch');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * 构建简易研报
 * @param {string} symbol - 股票代码
 * @param {object} basicData - 基础数据（报价等）
 * @returns {Promise<object>} 研报对象
 */
async function buildSimpleReport(symbol, basicData = {}) {
  console.log(`📊 [v3-dev Report Service] 开始生成研报: ${symbol}`);
  
  const startTime = Date.now();
  
  try {
    // 准备数据上下文
    const price = basicData.price || basicData.c || 'N/A';
    const change = basicData.change || basicData.d || 'N/A';
    const changePercent = basicData.changePercent || basicData.dp || 'N/A';
    const high = basicData.high || basicData.h || 'N/A';
    const low = basicData.low || basicData.l || 'N/A';
    const volume = basicData.volume || basicData.v || 'N/A';
    
    // 构建 AI prompt
    const systemPrompt = `你是一位专业的股票分析师。请基于提供的市场数据，生成一份简明的股票研究报告。

要求：
1. 评级只能是：STRONG_BUY（强烈买入）、BUY（买入）、HOLD（持有）、SELL（卖出）、STRONG_SELL（强烈卖出）之一
2. 时间范围：短期（1-3月）、中期（3-12月）、长期（1年以上）
3. 简明扼要，不要过度解读
4. 明确标注这是基于有限数据的初步分析
5. 必须用中文回复

返回格式（纯JSON，不要markdown代码块）：
{
  "rating": "评级",
  "horizon": "时间范围",
  "summary": "核心观点（50-100字）",
  "drivers": ["驱动因素1", "驱动因素2", "驱动因素3"],
  "risks": ["风险点1", "风险点2"],
  "technical_view": "技术面简评（30-50字）"
}`;

    const userPrompt = `请分析以下股票：

股票代码：${symbol.toUpperCase()}
当前价格：${price}
涨跌幅：${changePercent}%
涨跌额：${change}
最高价：${high}
最低价：${low}
成交量：${volume}

请基于以上数据生成研报JSON。`;

    // 调用 GPT-4o-mini（轻量快速）
    console.log(`🤖 [v3-dev Report] 调用 AI: gpt-4o-mini`);
    
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
        max_completion_tokens: 1000,
        temperature: 0.7
      }),
      timeout: 15000 // 15秒超时
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiContent = data.choices?.[0]?.message?.content;
    
    if (!aiContent) {
      throw new Error('AI 返回空内容');
    }

    // 解析 AI 返回的 JSON
    let reportData;
    try {
      // 移除可能的 markdown 代码块标记
      const cleanContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      reportData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.warn(`⚠️  [v3-dev Report] AI返回非JSON格式，使用fallback`);
      // Fallback: 基于价格变化的简单判断
      reportData = generateFallbackReport(symbol, basicData, startTime);
    }

    const elapsed = Date.now() - startTime;
    console.log(`✅ [v3-dev Report] 研报生成完成 (${elapsed}ms)`);

    // 构建最终报告结构
    return {
      title: `${symbol.toUpperCase()} 研究报告（测试版）`,
      symbol: symbol.toUpperCase(),
      rating: reportData.rating || 'HOLD',
      horizon: reportData.horizon || '中期',
      summary: reportData.summary || '数据不足，建议谨慎观察。',
      drivers: reportData.drivers || ['市场波动', '行业趋势'],
      risks: reportData.risks || ['市场风险', '数据有限'],
      technical_view: reportData.technical_view || '技术面中性',
      price_info: {
        current: price,
        change: change,
        change_percent: changePercent,
        high: high,
        low: low,
        volume: volume
      },
      generated_at: new Date().toISOString(),
      model_used: 'gpt-4o-mini',
      latency_ms: elapsed,
      disclaimer: '⚠️ 本报告为 v3-dev 测试版本，基于有限数据生成，仅供参考，不构成投资建议。'
    };

  } catch (error) {
    console.error(`❌ [v3-dev Report] 生成失败:`, error.message);
    
    // 完全失败时的 fallback
    return generateFallbackReport(symbol, basicData, startTime);
  }
}

/**
 * Fallback 报告生成（不调用 AI）
 */
function generateFallbackReport(symbol, basicData, startTime = Date.now()) {
  const price = basicData.price || basicData.c || 'N/A';
  const changePercent = basicData.changePercent || basicData.dp || 0;
  
  // 简单的评级逻辑
  let rating = 'HOLD';
  if (changePercent > 5) rating = 'BUY';
  else if (changePercent > 10) rating = 'STRONG_BUY';
  else if (changePercent < -5) rating = 'SELL';
  else if (changePercent < -10) rating = 'STRONG_SELL';

  const elapsed = Date.now() - startTime;

  return {
    title: `${symbol.toUpperCase()} 研究报告（简化版）`,
    symbol: symbol.toUpperCase(),
    rating: rating,
    horizon: '短期',
    summary: `${symbol.toUpperCase()} 当前价格 ${price}，涨跌幅 ${changePercent}%。建议根据市场情况谨慎操作。`,
    drivers: ['市场整体走势', '板块轮动', '资金流向'],
    risks: ['市场波动风险', '政策不确定性', '数据时效性'],
    technical_view: '基于当前价格走势的初步判断，建议关注成交量变化。',
    price_info: {
      current: price,
      change: basicData.change || basicData.d || 'N/A',
      change_percent: changePercent,
      high: basicData.high || basicData.h || 'N/A',
      low: basicData.low || basicData.l || 'N/A',
      volume: basicData.volume || basicData.v || 'N/A'
    },
    generated_at: new Date().toISOString(),
    model_used: 'fallback',
    latency_ms: elapsed,
    disclaimer: '⚠️ 本报告为测试版本，数据有限，仅供参考。'
  };
}

module.exports = {
  buildSimpleReport
};
