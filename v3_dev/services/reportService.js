/**
 * v3-dev Research Report Service v1 (Test Version)
 * 只在开发环境使用，不影响 v2-stable
 */

const fetch = require('node-fetch');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ========== PDFKit 已移除 ==========
// v3-dev 现使用外部 PDF 生成服务
// 本地不再使用 pdfkit、字体文件等

/**
 * 构建简易研报
 * @param {string} symbol - 股票代码
 * @param {object} basicData - 基础数据（报价等）
 * @returns {Promise<object>} 研报对象
 */
async function buildSimpleReport(symbol, basicData = {}) {
  console.log(`📊 [v3-dev Report Service] 开始生成研报: ${symbol}`);
  
  const startTime = Date.now();
  
  // ========== 快速失败：无 API Key 直接用 fallback ==========
  if (!OPENAI_API_KEY) {
    console.warn(`⚠️  [v3-dev Report] 无 OPENAI_API_KEY，使用 fallback`);
    return generateFallbackReport(symbol, basicData, startTime);
  }
  
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
      return generateFallbackReport(symbol, basicData, startTime);
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
    console.error(`❌ [v3-dev Report] AI 调用失败:`, error.message);
    
    // 完全失败时的 fallback
    return generateFallbackReport(symbol, basicData, startTime);
  }
}

/**
 * Fallback 报告生成（不调用 AI）
 */
function generateFallbackReport(symbol, basicData, startTime = Date.now()) {
  // 确保 symbol 是字符串，避免 toUpperCase 报错
  const sym = String(symbol || "UNKNOWN").toUpperCase();
  
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
    title: `${sym} 研究报告（简化版）`,
    symbol: sym,
    rating: rating,
    horizon: '短期',
    summary: `${sym} 当前价格 ${price}，涨跌幅 ${changePercent}%。建议根据市场情况谨慎操作。`,
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

/**
 * 生成 HTML 格式研报
 * @param {string} symbol - 股票代码
 * @param {object} report - 研报对象
 * @returns {string} HTML 字符串
 */
function generateHTMLReport(symbol, report) {
  console.log(`📄 [v3-dev HTML] 生成 HTML 研报: ${symbol}`);
  
  const ratingColors = {
    'STRONG_BUY': '#10B981',
    'BUY': '#34D399',
    'HOLD': '#FBBF24',
    'SELL': '#F87171',
    'STRONG_SELL': '#EF4444'
  };
  const ratingColor = ratingColors[report.rating] || '#6B7280';
  
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.symbol} 研究报告 - USIS v3-dev</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
      line-height: 1.6;
      color: #1F2937;
      background: #F9FAFB;
      padding: 40px 20px;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #E5E7EB;
    }
    h1 {
      color: #4F46E5;
      font-size: 28px;
      margin-bottom: 10px;
    }
    .symbol {
      font-size: 24px;
      font-weight: bold;
      color: #1F2937;
      margin: 10px 0;
    }
    .rating {
      display: inline-block;
      padding: 8px 20px;
      background: ${ratingColor};
      color: white;
      border-radius: 20px;
      font-weight: bold;
      font-size: 16px;
      margin: 10px 0;
    }
    .horizon {
      color: #6B7280;
      font-size: 14px;
    }
    .section {
      margin: 25px 0;
    }
    .section-title {
      color: #4F46E5;
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid #E5E7EB;
    }
    .price-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin: 15px 0;
    }
    .price-item {
      background: #F3F4F6;
      padding: 12px;
      border-radius: 6px;
    }
    .price-label {
      color: #6B7280;
      font-size: 12px;
    }
    .price-value {
      color: #1F2937;
      font-weight: bold;
      font-size: 16px;
    }
    .summary-box {
      background: #EEF2FF;
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid #4F46E5;
      margin: 15px 0;
    }
    ul {
      margin: 15px 0;
      padding-left: 20px;
    }
    li {
      margin: 8px 0;
      line-height: 1.8;
    }
    .meta {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #E5E7EB;
      font-size: 13px;
      color: #6B7280;
    }
    .meta-item {
      margin: 5px 0;
    }
    .disclaimer {
      background: #FEF3C7;
      border: 1px solid #F59E0B;
      border-radius: 8px;
      padding: 15px;
      margin-top: 25px;
      font-size: 12px;
      color: #92400E;
    }
    .disclaimer strong {
      display: block;
      margin-bottom: 8px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>USIS 研究报告</h1>
      <div class="symbol">${report.symbol}</div>
      <div class="rating">${report.rating}</div>
      <div class="horizon">时间范围：${report.horizon}</div>
    </div>

    <div class="section">
      <div class="section-title">价格信息</div>
      <div class="price-grid">
        <div class="price-item">
          <div class="price-label">当前价</div>
          <div class="price-value">${report.price_info.current}</div>
        </div>
        <div class="price-item">
          <div class="price-label">涨跌</div>
          <div class="price-value">${report.price_info.change} (${report.price_info.change_percent}%)</div>
        </div>
        <div class="price-item">
          <div class="price-label">最高</div>
          <div class="price-value">${report.price_info.high}</div>
        </div>
        <div class="price-item">
          <div class="price-label">最低</div>
          <div class="price-value">${report.price_info.low}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">核心观点</div>
      <div class="summary-box">${report.summary}</div>
    </div>

    <div class="section">
      <div class="section-title">驱动因素</div>
      <ul>
        ${report.drivers.map(d => `<li>${d}</li>`).join('')}
      </ul>
    </div>

    <div class="section">
      <div class="section-title">风险提示</div>
      <ul>
        ${report.risks.map(r => `<li>${r}</li>`).join('')}
      </ul>
    </div>

    <div class="section">
      <div class="section-title">技术面分析</div>
      <p>${report.technical_view}</p>
    </div>

    <div class="meta">
      <div class="meta-item">🤖 AI 模型：${report.model_used}</div>
      <div class="meta-item">⏱ 生成时间：${report.latency_ms}ms</div>
      <div class="meta-item">📅 生成于：${new Date(report.generated_at).toLocaleString('zh-CN')}</div>
      <div class="meta-item">🔬 环境：v3-dev (测试版)</div>
    </div>

    <div class="disclaimer">
      <strong>免责声明</strong>
      ${report.disclaimer}
    </div>
  </div>
</body>
</html>`;

  console.log(`✅ [v3-dev HTML] HTML 生成完成`);
  return html;
}

/**
 * 生成 Markdown 格式研报
 * @param {string} symbol - 股票代码
 * @param {object} report - 研报对象
 * @returns {string} Markdown 字符串
 */
function generateMarkdownReport(symbol, report) {
  console.log(`📄 [v3-dev MD] 生成 Markdown 研报: ${symbol}`);
  
  const ratingEmoji = {
    'STRONG_BUY': '🟢🟢',
    'BUY': '🟢',
    'HOLD': '🟡',
    'SELL': '🔴',
    'STRONG_SELL': '🔴🔴'
  }[report.rating] || '⚪';

  const markdown = `# USIS 研究报告

## ${report.symbol}

**评级**：${ratingEmoji} ${report.rating}  
**时间范围**：${report.horizon}

---

## 💰 价格信息

| 指标 | 数值 |
|------|------|
| 当前价 | ${report.price_info.current} |
| 涨跌 | ${report.price_info.change} (${report.price_info.change_percent}%) |
| 最高 | ${report.price_info.high} |
| 最低 | ${report.price_info.low} |
| 成交量 | ${report.price_info.volume} |

---

## 📈 核心观点

${report.summary}

---

## 🎯 驱动因素

${report.drivers.map((d, i) => `${i + 1}. ${d}`).join('\n')}

---

## ⚠️ 风险提示

${report.risks.map((r, i) => `${i + 1}. ${r}`).join('\n')}

---

## 📉 技术面分析

${report.technical_view}

---

## 📊 元信息

- **🤖 AI 模型**：${report.model_used}
- **⏱ 生成时间**：${report.latency_ms}ms
- **📅 生成于**：${new Date(report.generated_at).toLocaleString('zh-CN')}
- **🔬 环境**：v3-dev (测试版)

---

## ⚖️ 免责声明

${report.disclaimer}
`;

  console.log(`✅ [v3-dev MD] Markdown 生成完成`);
  return markdown;
}

module.exports = {
  buildSimpleReport,
  generateHTMLReport,
  generateMarkdownReport
};
