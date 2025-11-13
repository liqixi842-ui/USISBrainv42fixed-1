// ====== Company Research Report Service (Beta v1.0) ======
// 自动生成公司研究报告PDF：8部分结构化报告 + AI分析

const fetch = require("node-fetch");
const { fetchMarketData, fetchCompanyProfile, fetchHistoricalPrices } = require("./dataBroker");
const { fetchAndRankNews } = require("./newsBroker");
const { getMultiAIProvider } = require("./multiAiProvider");
const { buildStockChartURL } = require("./stockChartService");

// PDFShift API配置（50个免费PDF/月，无需Chromium）
const PDFSHIFT_API_KEY = process.env.PDFSHIFT_API_KEY || '';

/**
 * 生成公司研究报告（8部分结构）
 * @param {string} symbol - 股票代码
 * @param {Object} options - 配置选项
 * @returns {Promise<Object>} - { pdfBuffer, summary, metadata }
 */
async function generateCompanyReport(symbol, options = {}) {
  console.log(`\n📄 [Report Service] 生成研究报告: ${symbol}`);
  const startTime = Date.now();
  
  try {
    // ===== 数据收集阶段 =====
    console.log('   📊 [1/3] 数据收集中...');
    const dataCollection = await collectReportData(symbol);
    
    // ===== 内容生成阶段 =====
    console.log('   🤖 [2/3] AI内容生成中...');
    const reportContent = await generateReportContent(symbol, dataCollection);
    
    // ===== PDF渲染阶段 =====
    console.log('   📝 [3/3] PDF渲染中...');
    const { pdfBuffer, htmlContent } = await renderReportPDF(symbol, reportContent);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ [Report Service] 报告生成完成 (${duration}s)`);
    
    return {
      pdfBuffer,
      htmlContent,
      summary: reportContent.summary,
      metadata: {
        symbol,
        generatedAt: new Date().toISOString(),
        duration: parseFloat(duration),
        sections: Object.keys(reportContent.sections).length
      }
    };
    
  } catch (error) {
    console.error(`❌ [Report Service] 生成失败: ${error.message}`);
    throw new Error(`报告生成失败: ${error.message}`);
  }
}

/**
 * 收集报告所需的所有数据
 */
async function collectReportData(symbol) {
  const tasks = [];
  
  // 1. 实时行情
  tasks.push(
    fetchMarketData([symbol], ['quote'])
      .then(data => ({ quotes: data.quotes }))
      .catch(err => {
        console.warn(`⚠️  获取行情失败: ${err.message}`);
        return { quotes: {} };
      })
  );
  
  // 2. 公司概况
  tasks.push(
    fetchCompanyProfile(symbol)
      .then(data => ({ profile: data.profile }))
      .catch(err => {
        console.warn(`⚠️  获取公司概况失败: ${err.message}`);
        return { profile: null };
      })
  );
  
  // 3. 历史价格（6-12个月）
  tasks.push(
    fetchHistoricalPrices(symbol, { months: 12 })
      .then(data => ({ historicalPrices: data }))
      .catch(err => {
        console.warn(`⚠️  获取历史价格失败: ${err.message}`);
        return { historicalPrices: [] };
      })
  );
  
  // 4. 新闻数据
  tasks.push(
    fetchAndRankNews({ symbols: [symbol], topN: 5 })
      .then(data => ({ news: data || [] }))
      .catch(err => {
        console.warn(`⚠️  获取新闻失败: ${err.message}`);
        return { news: [] };
      })
  );
  
  // 并行获取所有数据
  const results = await Promise.all(tasks);
  
  // 合并结果
  return results.reduce((acc, curr) => ({ ...acc, ...curr }), {});
}

/**
 * 使用AI生成8部分报告内容
 */
async function generateReportContent(symbol, dataCollection) {
  const { quotes, profile, historicalPrices, news } = dataCollection;
  const quote = quotes[symbol] || {};
  
  // 构建AI分析提示词
  const prompt = buildReportPrompt(symbol, { quote, profile, historicalPrices, news });
  
  // 使用GPT-4o生成报告
  const multiAI = getMultiAIProvider();
  const aiResponse = await multiAI.generate('gpt-4o', [
    { role: 'user', content: prompt }
  ], {
    maxTokens: 2000,
    temperature: 0.7
  });
  
  // 解析AI响应为结构化内容
  const sections = parseAIResponse(aiResponse.text || aiResponse);
  
  // 生成3-5行摘要
  const summary = generateSummary(sections, quote);
  
  return {
    sections,
    summary,
    data: dataCollection
  };
}

/**
 * 构建AI分析提示词
 */
function buildReportPrompt(symbol, { quote, profile, historicalPrices, news }) {
  const companyName = profile?.companyName || profile?.name || symbol; // 🔧 兼容companyName字段
  const price = quote.c || 'N/A';
  const change = quote.dp ? `${quote.dp > 0 ? '+' : ''}${quote.dp}%` : 'N/A';
  
  return `你是一位专业的股票分析师。请为${companyName} (${symbol})生成一份研究报告草稿。

当前数据：
- 股价: $${price} (${change})
- 行业: ${profile?.industry || '未知'}
- 市值: $${profile?.marketCapitalization || 'N/A'}M
- 最近新闻: ${news.length}条

请按以下结构生成内容（每部分2-4句话即可，保持简洁）：

### 1. 封面信息
[公司全称、股票代码、报告生成日期（${new Date().toLocaleDateString('zh-CN')}）]

### 2. 公司概览
[简述公司业务、主要产品/服务、市场地位]

### 3. 股价与图表
[分析当前股价$${price}，涨跌幅${change}，短期走势特征]

### 4. 财务概况
[描述营收/利润趋势、利润率变化、负债情况]

### 5. 最近重要新闻
${news.slice(0, 3).map((n, i) => `${i+1}. ${n.title || n.headline || '未知标题'}`).join('\n')}
[对以上新闻进行AI总结，分析对股价的潜在影响]

### 6. 技术面分析
[基于当前价格$${price}，分析趋势、关键支撑阻力位、技术指标]

### 7. 风险提示
[列出行业风险、公司特定风险、市场波动风险]

### 8. 综合评价
[给出估值判断（偏贵/合理/偏便宜）和情绪判断（偏多/偏空），简要说明理由]

要求：
1. 语言专业但易懂
2. 每部分2-4句话
3. 使用Markdown格式
4. 基于数据分析，避免空洞表述
5. 必须生成所有8个部分`;
}

/**
 * 解析AI响应为结构化章节
 */
function parseAIResponse(aiText) {
  const sections = {};
  
  // 简单解析Markdown标题
  const sectionMatches = aiText.match(/###\s+(\d+)\.\s+(.+?)\n([\s\S]+?)(?=###|\n\n$|$)/g) || [];
  
  sectionMatches.forEach(match => {
    const titleMatch = match.match(/###\s+(\d+)\.\s+(.+?)\n/);
    if (titleMatch) {
      const sectionNum = titleMatch[1];
      const sectionTitle = titleMatch[2].trim();
      const content = match.replace(titleMatch[0], '').trim();
      
      sections[sectionTitle] = {
        number: parseInt(sectionNum),
        content
      };
    }
  });
  
  return sections;
}

/**
 * 生成3-5行摘要
 */
function generateSummary(sections, quote) {
  const price = quote.c || 'N/A';
  const change = quote.dp ? `${quote.dp > 0 ? '+' : ''}${quote.dp.toFixed(2)}%` : 'N/A';
  
  const lines = [
    `📊 当前股价: $${price} (${change})`,
    sections['综合评价']?.content?.split('.')[0] || '综合评价生成中',
    '⚠️ 本报告为自动生成草稿，仅供参考，不构成投资建议'
  ];
  
  return lines.join('\n');
}

/**
 * 渲染HTML并生成PDF
 */
async function renderReportPDF(symbol, reportContent) {
  const { sections, data } = reportContent;
  const quote = data.quotes[symbol] || {};
  const profile = data.profile || {};
  
  // 生成图表URL
  const chartURL = buildStockChartURL(symbol, {
    interval: 'D',
    theme: 'light'
  });
  
  // 构建HTML内容
  const htmlContent = buildReportHTML({
    symbol,
    companyName: profile.companyName || profile.name || symbol, // 🔧 兼容companyName字段
    date: new Date().toLocaleDateString('zh-CN'),
    price: quote.c || 'N/A',
    change: quote.dp ? `${quote.dp > 0 ? '+' : ''}${quote.dp.toFixed(2)}%` : 'N/A',
    sections,
    chartURL
  });
  
  // 使用PDFShift API生成PDF（无需本地Chromium）
  const pdfBuffer = await convertHTMLtoPDF(htmlContent);
  
  return { pdfBuffer, htmlContent };
}

/**
 * 使用PDFShift API将HTML转换为PDF
 * @param {string} htmlContent - HTML内容
 * @returns {Promise<Buffer>} PDF Buffer
 */
async function convertHTMLtoPDF(htmlContent) {
  // 如果没有API Key，使用备用方案（纯文本PDF）
  if (!PDFSHIFT_API_KEY) {
    console.warn('⚠️  PDFShift API Key未配置，使用PDFKit备用方案');
    return generateFallbackPDF(htmlContent);
  }
  
  try {
    console.log('📄 [PDFShift] 开始生成PDF...');
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
    console.log('✅ [PDFShift] PDF生成成功');
    return Buffer.from(arrayBuffer);
    
  } catch (error) {
    console.error('❌ PDFShift API调用失败:', error.message);
    console.warn('⚠️  降级到PDFKit备用方案');
    return generateFallbackPDF(htmlContent);
  }
}

/**
 * 备用方案：使用PDFKit生成纯文本PDF
 */
function generateFallbackPDF(htmlContent) {
  console.log('📝 [PDFKit] 使用备用方案生成PDF...');
  
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
      console.log('✅ [PDFKit] PDF生成成功');
      resolve(Buffer.concat(chunks));
    });
    doc.on('error', reject);
  });
}

/**
 * 构建HTML报告模板
 */
function buildReportHTML({ symbol, companyName, date, price, change, sections, chartURL }) {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>研究报告 - ${symbol}</title>
  <style>
    body {
      font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .cover {
      text-align: center;
      padding: 60px 0;
      border-bottom: 3px solid #2c3e50;
      margin-bottom: 40px;
    }
    .cover h1 {
      font-size: 32px;
      margin-bottom: 10px;
      color: #2c3e50;
    }
    .cover .symbol {
      font-size: 24px;
      color: #7f8c8d;
      margin-bottom: 20px;
    }
    .cover .meta {
      font-size: 14px;
      color: #95a5a6;
    }
    .cover .draft {
      font-size: 12px;
      color: #e74c3c;
      margin-top: 20px;
      font-weight: bold;
    }
    .section {
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    .section h2 {
      font-size: 20px;
      color: #2c3e50;
      border-left: 4px solid #3498db;
      padding-left: 10px;
      margin-bottom: 15px;
    }
    .section p {
      margin: 10px 0;
      text-align: justify;
    }
    .price-box {
      background: #ecf0f1;
      padding: 15px;
      border-radius: 5px;
      margin: 20px 0;
      text-align: center;
    }
    .price-box .price {
      font-size: 28px;
      font-weight: bold;
      color: ${change.startsWith('+') ? '#27ae60' : change.startsWith('-') ? '#e74c3c' : '#7f8c8d'};
    }
    .chart-container {
      margin: 20px 0;
      text-align: center;
    }
    .chart-container img {
      max-width: 100%;
      border: 1px solid #ddd;
      border-radius: 5px;
    }
    .disclaimer {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin-top: 40px;
      font-size: 12px;
      color: #856404;
    }
    .news-item {
      margin: 10px 0;
      padding-left: 15px;
    }
  </style>
</head>
<body>
  <!-- 封面 -->
  <div class="cover">
    <h1>${companyName}</h1>
    <div class="symbol">${symbol}</div>
    <div class="meta">研究报告 · ${date}</div>
    <div class="draft">⚠️ 自动生成草稿 · 仅供参考</div>
  </div>

  <!-- 1. (封面已包含) -->

  <!-- 2. 公司概览 -->
  <div class="section">
    <h2>2. 公司概览</h2>
    <p>${sections['公司概览']?.content || '暂无数据'}</p>
  </div>

  <!-- 3. 股价 & 图表 -->
  <div class="section">
    <h2>3. 股价 & 图表</h2>
    <div class="price-box">
      <div>当前股价</div>
      <div class="price">$${price} <span style="font-size:18px">${change}</span></div>
    </div>
    <div class="chart-container">
      <p><em>TradingView图表链接:</em></p>
      <p><a href="${chartURL}" style="color:#3498db;word-break:break-all">${chartURL}</a></p>
      <p style="font-size:12px;color:#7f8c8d">（PDF中暂不嵌入实时图表，请访问链接查看）</p>
    </div>
  </div>

  <!-- 4. 财务概况 -->
  <div class="section">
    <h2>4. 财务概况</h2>
    <p>${sections['财务概况']?.content || '暂无数据'}</p>
  </div>

  <!-- 5. 最近重要新闻 -->
  <div class="section">
    <h2>5. 最近重要新闻</h2>
    <p>${sections['最近重要新闻']?.content || '暂无数据'}</p>
  </div>

  <!-- 6. 技术面分析 -->
  <div class="section">
    <h2>6. 技术面分析</h2>
    <p>${sections['技术面分析']?.content || '暂无数据'}</p>
  </div>

  <!-- 7. 风险提示 -->
  <div class="section">
    <h2>7. 风险提示</h2>
    <p>${sections['风险提示']?.content || '暂无数据'}</p>
  </div>

  <!-- 8. 综合评价 -->
  <div class="section">
    <h2>8. 综合评价</h2>
    <p>${sections['综合评价']?.content || '暂无数据'}</p>
  </div>

  <!-- 免责声明 -->
  <div class="disclaimer">
    <strong>免责声明：</strong>本报告由AI自动生成，内容仅供参考，不构成任何投资建议。
    投资有风险，入市需谨慎。请根据自身情况谨慎决策，本系统不对投资结果负责。
  </div>
</body>
</html>
  `.trim();
}

module.exports = {
  generateCompanyReport
};
