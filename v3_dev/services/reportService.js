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
    
    // 构建 AI prompt - 投行级研报风格
    const systemPrompt = `你是一位资深的卖方研究分析师。请基于提供的市场数据，生成一份机构级别的股票研究报告。

要求：
1. 语言风格：专业、正式、客观，避免使用口语化表达和emoji
2. 评级只能是：STRONG_BUY、BUY、HOLD、SELL、STRONG_SELL 之一
3. 时间范围：短期（1-3月）、中期（3-12月）、长期（1年以上）
4. 必须用中文回复

返回格式（纯JSON，不要markdown代码块）：
{
  "rating": "评级",
  "horizon": "时间范围",
  "company_name": "公司全称（如 NVIDIA Corporation）",
  "investment_summary": "投资结论（2-3句话，专业措辞，明确操作建议和核心理由）",
  "thesis": ["核心观点1（行业/赛道逻辑）", "核心观点2（竞争优势）", "核心观点3（财务表现）"],
  "catalysts": ["催化剂1（产品/事件）", "催化剂2（市场/客户）", "催化剂3（财报/指引）"],
  "risks": ["风险1（需求周期）", "风险2（竞争/监管）", "风险3（估值/市场）"],
  "technical_view": "技术面简评（3-4句话，包含趋势、指标、操作建议）",
  "action": "操作建议（1-2段话，针对不同持仓成本给出建议）"
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

    // 构建最终报告结构 - 投行级格式
    return {
      title: `${symbol.toUpperCase()} 研究报告`,
      symbol: symbol.toUpperCase(),
      company_name: reportData.company_name || symbol.toUpperCase(),
      rating: reportData.rating || 'HOLD',
      horizon: reportData.horizon || '中期',
      investment_summary: reportData.investment_summary || '基于当前数据，建议谨慎观察市场走势。',
      thesis: reportData.thesis || ['市场环境分析', '公司基本面评估', '估值合理性判断'],
      catalysts: reportData.catalysts || ['产品周期演进', '市场需求变化', '财报表现'],
      risks: reportData.risks || ['宏观经济波动', '行业竞争加剧', '估值压力'],
      technical_view: reportData.technical_view || '技术面呈现中性态势，建议关注成交量变化和关键支撑位。',
      action: reportData.action || '建议投资者根据自身风险偏好和持仓成本，谨慎评估操作时机。',
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
      disclaimer: '本报告基于公开市场数据生成，仅供参考，不构成投资建议。投资者应独立判断并承担相应风险。'
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
    title: `${sym} 研究报告`,
    symbol: sym,
    company_name: sym,
    rating: rating,
    horizon: '短期',
    investment_summary: `基于当前市场数据，${sym} 价格为 ${price}，日内涨跌幅 ${changePercent}%。鉴于数据有限，建议投资者保持谨慎，密切关注后续市场动态。`,
    thesis: ['市场整体走势影响短期表现', '板块轮动带来结构性机会', '资金流向决定短期波动方向'],
    catalysts: ['重要财报发布窗口', '行业政策动向', '宏观经济数据公布'],
    risks: ['市场系统性波动风险', '政策不确定性影响', '数据时效性局限'],
    technical_view: '基于当前价格走势的初步判断，技术面呈现观望态势。建议关注成交量变化和关键支撑位的有效性。',
    action: '建议投资者根据自身风险承受能力和投资周期，审慎评估入场时机。对于已有持仓者，可根据成本区间适当调整仓位结构。',
    price_info: {
      current: price,
      change: basicData.change || basicData.d || '暂不提供',
      change_percent: changePercent,
      high: basicData.high || basicData.h || '暂不提供',
      low: basicData.low || basicData.l || '暂不提供',
      volume: basicData.volume || basicData.v || '暂不提供'
    },
    generated_at: new Date().toISOString(),
    model_used: 'fallback',
    latency_ms: elapsed,
    disclaimer: '本报告基于有限市场数据生成，仅供参考，不构成投资建议。投资者应独立判断并承担相应风险。'
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
  <title>${report.symbol} 研究报告 - USIS</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
      line-height: 1.8;
      color: #1F2937;
      background: #F9FAFB;
      padding: 40px 20px;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      padding: 50px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .header {
      margin-bottom: 40px;
      padding-bottom: 30px;
      border-bottom: 3px solid #E5E7EB;
    }
    h1 {
      color: #111827;
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .symbol-line {
      font-size: 26px;
      font-weight: 600;
      color: #374151;
      margin: 15px 0;
    }
    .company-name {
      color: #6B7280;
      font-size: 16px;
    }
    .rating-badge {
      display: inline-block;
      padding: 10px 24px;
      background: ${ratingColor};
      color: white;
      border-radius: 6px;
      font-weight: 600;
      font-size: 18px;
      margin: 15px 0;
    }
    .meta-line {
      color: #6B7280;
      font-size: 15px;
      margin: 8px 0;
    }
    h2 {
      color: #111827;
      font-size: 22px;
      font-weight: 600;
      margin: 35px 0 15px 0;
      padding-bottom: 8px;
      border-bottom: 2px solid #E5E7EB;
    }
    h3 {
      color: #374151;
      font-size: 18px;
      font-weight: 600;
      margin: 25px 0 12px 0;
    }
    .section {
      margin: 30px 0;
    }
    .investment-summary {
      background: #EEF2FF;
      padding: 24px;
      border-radius: 8px;
      border-left: 4px solid #4F46E5;
      margin: 20px 0;
      font-size: 16px;
      line-height: 1.9;
    }
    .price-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 15px;
    }
    .price-table th {
      background: #F3F4F6;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #374151;
      border-bottom: 2px solid #E5E7EB;
    }
    .price-table td {
      padding: 12px;
      border-bottom: 1px solid #E5E7EB;
    }
    ul {
      margin: 15px 0;
      padding-left: 24px;
    }
    li {
      margin: 12px 0;
      line-height: 1.8;
    }
    .action-box {
      background: #F0FDF4;
      padding: 24px;
      border-radius: 8px;
      border-left: 4px solid #10B981;
      margin: 20px 0;
    }
    .note {
      color: #6B7280;
      font-size: 13px;
      font-style: italic;
      margin: 10px 0;
    }
    .meta {
      margin-top: 40px;
      padding-top: 25px;
      border-top: 2px solid #E5E7EB;
      font-size: 14px;
      color: #6B7280;
    }
    .meta-item {
      margin: 6px 0;
    }
    .disclaimer {
      background: #FEF3C7;
      border: 1px solid #F59E0B;
      border-radius: 8px;
      padding: 20px;
      margin-top: 30px;
      font-size: 13px;
      color: #92400E;
      line-height: 1.7;
    }
    .disclaimer strong {
      display: block;
      margin-bottom: 10px;
      font-size: 15px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>USIS 研究报告</h1>
      <div class="symbol-line">${report.symbol} - <span class="company-name">${report.company_name}</span></div>
      <div class="rating-badge">${report.rating}</div>
      <div class="meta-line">时间范围：${report.horizon}</div>
      <div class="meta-line">最新价格：${report.price_info.current} 美元 | 日内涨跌：${report.price_info.change} (${report.price_info.change_percent}%)</div>
    </div>

    <h2>一、投资结论（Investment Summary）</h2>
    <div class="investment-summary">${report.investment_summary}</div>

    <h2>二、核心观点（Key Investment Thesis）</h2>
    <ul>
      ${report.thesis.map(t => `<li>${t}</li>`).join('')}
    </ul>

    <h2>三、估值与财务概览（Valuation & Financials）</h2>
    <h3>价格信息</h3>
    <table class="price-table">
      <tr>
        <th>指标</th>
        <th>数值</th>
      </tr>
      <tr>
        <td>当前价格</td>
        <td>${report.price_info.current} 美元</td>
      </tr>
      <tr>
        <td>日内涨跌</td>
        <td>${report.price_info.change} (${report.price_info.change_percent}%)</td>
      </tr>
      <tr>
        <td>日内最高</td>
        <td>${report.price_info.high} 美元</td>
      </tr>
      <tr>
        <td>日内最低</td>
        <td>${report.price_info.low} 美元</td>
      </tr>
      <tr>
        <td>成交量</td>
        <td>${report.price_info.volume}</td>
      </tr>
    </table>
    <p class="note">注：部分估值指标（市盈率、市销率等）需接入更详细的财务数据源，当前版本暂不提供。</p>

    <h2>四、关键驱动因素（Catalysts）</h2>
    <ul>
      ${report.catalysts.map(c => `<li>${c}</li>`).join('')}
    </ul>

    <h2>五、核心风险（Key Risks）</h2>
    <ul>
      ${report.risks.map(r => `<li>${r}</li>`).join('')}
    </ul>

    <h2>六、技术面简评（Technical View）</h2>
    <p>${report.technical_view}</p>

    <h2>七、操作建议（Action）</h2>
    <div class="action-box">${report.action}</div>

    <div class="meta">
      <div class="meta-item">生成时间：${new Date(report.generated_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</div>
      <div class="meta-item">AI 模型：${report.model_used}</div>
      <div class="meta-item">处理时长：${report.latency_ms}ms</div>
      <div class="meta-item">报告版本：v3-dev</div>
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
  
  // 投行级风格 - 移除emoji，使用专业评级符号
  const ratingSymbol = {
    'STRONG_BUY': '++',
    'BUY': '+',
    'HOLD': '=',
    'SELL': '-',
    'STRONG_SELL': '--'
  }[report.rating] || '=';

  const markdown = `# USIS 研究报告

## ${report.symbol} - ${report.company_name}

**评级：${report.rating}** (${ratingSymbol})  
**时间范围：${report.horizon}**  
**最新价格：${report.price_info.current} 美元**  
**日内涨跌：${report.price_info.change} (${report.price_info.change_percent}%)**

---

## 一、投资结论（Investment Summary）

${report.investment_summary}

---

## 二、核心观点（Key Investment Thesis）

${report.thesis.map((t, i) => `${i + 1}. ${t}`).join('\n')}

---

## 三、估值与财务概览（Valuation & Financials）

### 价格信息

| 指标 | 数值 |
|------|------|
| 当前价格 | ${report.price_info.current} 美元 |
| 日内涨跌 | ${report.price_info.change} (${report.price_info.change_percent}%) |
| 日内最高 | ${report.price_info.high} 美元 |
| 日内最低 | ${report.price_info.low} 美元 |
| 成交量 | ${report.price_info.volume} |

_注：部分估值指标（市盈率、市销率等）需接入更详细的财务数据源，当前版本暂不提供。_

---

## 四、关键驱动因素（Catalysts）

${report.catalysts.map((c, i) => `${i + 1}. ${c}`).join('\n')}

---

## 五、核心风险（Key Risks）

${report.risks.map((r, i) => `${i + 1}. ${r}`).join('\n')}

---

## 六、技术面简评（Technical View）

${report.technical_view}

---

## 七、操作建议（Action）

${report.action}

---

## 报告信息

- **生成时间：** ${new Date(report.generated_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
- **AI 模型：** ${report.model_used}
- **处理时长：** ${report.latency_ms}ms
- **报告版本：** v3-dev

---

## 免责声明

${report.disclaimer}
`;

  console.log(`✅ [v3-dev MD] Markdown 生成完成`);
  return markdown;
}

/**
 * 使用 PDFShift API 将 HTML 转换为 PDF
 * @param {string} htmlContent - HTML内容
 * @returns {Promise<Buffer>} PDF Buffer
 */
async function convertHTMLtoPDF(htmlContent) {
  const PDFSHIFT_API_KEY = process.env.PDFSHIFT_API_KEY || '';
  
  // 如果没有API Key，使用备用方案（纯文本PDF）
  if (!PDFSHIFT_API_KEY) {
    console.warn('⚠️  [v3-dev PDF] PDFShift API Key 未配置，使用 PDFKit 备用方案');
    return generateFallbackPDF(htmlContent);
  }
  
  try {
    console.log('📄 [v3-dev PDFShift] 开始生成 PDF...');
    const fetch = require('node-fetch');
    
    const response = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from('api:' + PDFSHIFT_API_KEY).toString('base64')}`
      },
      body: JSON.stringify({
        source: htmlContent,
        format: 'A4',
        margin: '20mm 15mm',
        print_background: true
      }),
      timeout: 30000
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PDFShift API错误: ${response.status} - ${errorText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    console.log(`✅ [v3-dev PDFShift] PDF生成成功 (${arrayBuffer.byteLength} bytes)`);
    return Buffer.from(arrayBuffer);
    
  } catch (error) {
    console.error('❌ [v3-dev PDFShift] API调用失败:', error.message);
    console.warn('⚠️  [v3-dev PDF] 降级到 PDFKit 备用方案');
    return generateFallbackPDF(htmlContent);
  }
}

/**
 * 备用方案：使用 PDFKit 生成纯文本 PDF
 * @param {string} htmlContent - HTML内容
 * @returns {Promise<Buffer>} PDF Buffer
 */
function generateFallbackPDF(htmlContent) {
  console.log('📝 [v3-dev PDFKit] 使用备用方案生成PDF...');
  
  // 提取文本内容
  const textContent = htmlContent
    .replace(/<style>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/\n+/g, '\n')
    .trim();
  
  const PDFDocument = require('pdfkit');
  const chunks = [];
  
  const doc = new PDFDocument({ 
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 }
  });
  
  doc.on('data', chunk => chunks.push(chunk));
  
  // 标题
  doc.fontSize(16).font('Helvetica-Bold').text('USIS Research Report', { align: 'center' });
  doc.moveDown();
  
  // 内容
  doc.fontSize(10).font('Helvetica').text(textContent, {
    width: 500,
    align: 'left'
  });
  
  doc.end();
  
  return new Promise((resolve, reject) => {
    doc.on('end', () => {
      console.log('✅ [v3-dev PDFKit] PDF生成成功');
      resolve(Buffer.concat(chunks));
    });
    doc.on('error', reject);
  });
}

module.exports = {
  buildSimpleReport,
  generateHTMLReport,
  generateMarkdownReport,
  convertHTMLtoPDF
};
