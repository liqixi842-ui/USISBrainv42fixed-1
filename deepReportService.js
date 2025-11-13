// ====== USIS Deep Research Report Service v3.0 ======
// 机构级深度研报：9大章节 + 分章节AI生成 + 专业评级
// 生成时间：2-5分钟 | 长度：8-20页

const fetch = require("node-fetch");
const { fetchMarketData, fetchCompanyProfile, fetchHistoricalPrices, fetchTechnicalIndicators, fetchFundamentals, fetchStockMetrics } = require("./dataBroker");
const { fetchAndRankNews } = require("./newsBroker");
const { getMultiAIProvider } = require("./multiAiProvider");
const QuickChart = require('quickchart-js');

const PDFSHIFT_API_KEY = process.env.PDFSHIFT_API_KEY || '';

/**
 * 🔧 格式化市值（自动单位：B/M/K）
 * @param {number} marketCap - 原始市值（以百万为单位）
 * @returns {string} 格式化后的市值字符串
 */
function formatMarketCap(marketCap) {
  if (!marketCap || isNaN(marketCap)) return 'N/A';
  
  const numCap = Number(marketCap);
  
  // 如果已经是以百万为单位（来自Finnhub profile.marketCapitalization）
  if (numCap > 1000) {
    // 转换为十亿（Billion）
    return `$${(numCap / 1000).toFixed(2)}B`;
  } else if (numCap >= 1) {
    // 保持百万（Million）
    return `$${numCap.toFixed(2)}M`;
  } else {
    // 转换为千（Thousand）
    return `$${(numCap * 1000).toFixed(2)}K`;
  }
}

/**
 * 🔧 格式化财务数值（自动单位：B/M/K）
 * @param {number} value - 原始值
 * @returns {string} 格式化后的字符串
 */
function formatFinancialValue(value) {
  if (!value || isNaN(value)) return 'N/A';
  
  const num = Number(value);
  const abs = Math.abs(num);
  
  if (abs >= 1000000000) {
    return `$${(num / 1000000000).toFixed(2)}B`;
  } else if (abs >= 1000000) {
    return `$${(num / 1000000).toFixed(2)}M`;
  } else if (abs >= 1000) {
    return `$${(num / 1000).toFixed(2)}K`;
  } else {
    return `$${num.toFixed(2)}`;
  }
}

/**
 * 🆕 v4.0: 标准化财务数据为时间序列（用于图表和分析）
 * @param {Object} fundamentals - Twelve Data基本面数据
 * @param {Object} metrics - Finnhub估值指标
 * @returns {Object} 标准化的财务时间序列
 */
function normalizeFinancialData(fundamentals, metrics) {
  const normalized = {
    fiscalPeriods: [],
    revenue: [],
    netIncome: [],
    eps: [],
    grossMargin: [],
    operatingMargin: [],
    netMargin: [],
    pe: metrics?.peRatio || null,
    industryPE: null, // TODO: 需要行业平均PE数据
    marketCap: metrics?.symbol ? (metrics.marketCap || null) : null,
    missing: []
  };
  
  // 处理利润表数据（Twelve Data）
  if (fundamentals?.income_statement?.data) {
    const income = fundamentals.income_statement.data;
    
    if (income.fiscal_date) normalized.fiscalPeriods.push(income.fiscal_date);
    if (income.revenue) normalized.revenue.push(Number(income.revenue));
    if (income.net_income) normalized.netIncome.push(Number(income.net_income));
    
    // 计算毛利率和营业利润率
    if (income.gross_profit && income.revenue) {
      normalized.grossMargin.push((Number(income.gross_profit) / Number(income.revenue) * 100).toFixed(2));
    }
    
    if (income.operating_income && income.revenue) {
      normalized.operatingMargin.push((Number(income.operating_income) / Number(income.revenue) * 100).toFixed(2));
    }
    
    if (income.net_income && income.revenue) {
      normalized.netMargin.push((Number(income.net_income) / Number(income.revenue) * 100).toFixed(2));
    }
  } else {
    normalized.missing.push('income_statement');
  }
  
  // 处理统计数据（EPS）
  if (fundamentals?.statistics?.data) {
    const stats = fundamentals.statistics.data;
    if (stats.eps) {
      normalized.eps.push(Number(stats.eps));
    }
  }
  
  // 补充Finnhub指标数据
  if (metrics) {
    if (!normalized.grossMargin.length && metrics.profitMargin) {
      normalized.netMargin = [Number(metrics.profitMargin).toFixed(2)];
    }
  } else {
    normalized.missing.push('metrics');
  }
  
  return normalized;
}

/**
 * 🆕 v4.0: 生成财务趋势图表URL（Revenue + Net Income）
 * @param {Object} financialData - 标准化财务数据
 * @param {string} symbol - 股票代码
 * @returns {string} QuickChart图表URL
 */
function generateFinancialTrendChart(financialData, symbol) {
  if (!financialData.revenue.length && !financialData.netIncome.length) {
    return 'https://quickchart.io/chart?c={type:%27bar%27,data:{labels:[%27No%20Data%27],datasets:[{label:%27Revenue%27,data:[0]}]}}';
  }
  
  const chart = new QuickChart();
  const datasets = [];
  
  // Revenue dataset (柱状图)
  if (financialData.revenue.length > 0) {
    datasets.push({
      label: '营业收入 (Revenue)',
      data: financialData.revenue.map(v => (v / 1000000).toFixed(2)), // 转换为百万
      backgroundColor: 'rgba(75, 192, 192, 0.6)',
      borderColor: 'rgb(75, 192, 192)',
      borderWidth: 2,
      type: 'bar'
    });
  }
  
  // Net Income dataset (折线图)
  if (financialData.netIncome.length > 0) {
    datasets.push({
      label: '净利润 (Net Income)',
      data: financialData.netIncome.map(v => (v / 1000000).toFixed(2)), // 转换为百万
      borderColor: 'rgb(255, 99, 132)',
      backgroundColor: 'rgba(255, 99, 132, 0.1)',
      fill: false,
      type: 'line',
      borderWidth: 3,
      pointRadius: 5
    });
  }
  
  chart.setConfig({
    type: 'bar',
    data: {
      labels: financialData.fiscalPeriods.length > 0 ? financialData.fiscalPeriods : ['Latest'],
      datasets: datasets
    },
    options: {
      title: {
        display: true,
        text: `${symbol} 财务趋势（单位：百万美元）`,
        fontSize: 16,
        fontColor: '#2c3e50'
      },
      scales: {
        yAxes: [{
          ticks: {
            callback: function(value) {
              return '$' + value + 'M';
            }
          },
          gridLines: {
            color: '#ecf0f1'
          }
        }],
        xAxes: [{
          gridLines: {
            display: false
          }
        }]
      },
      legend: {
        display: true,
        position: 'top'
      }
    }
  });
  
  chart.setWidth(800);
  chart.setHeight(450);
  chart.setBackgroundColor('#ffffff');
  
  return chart.getUrl();
}

/**
 * 🆕 生成QuickChart价格走势图URL（静态PNG，DocRaptor兼容）
 * @param {Array} historicalPrices - 历史价格数据
 * @param {string} symbol - 股票代码
 * @returns {string} QuickChart图表URL
 */
function generatePriceChartURL(historicalPrices, symbol) {
  if (!historicalPrices || historicalPrices.length === 0) {
    // 返回占位图
    return 'https://quickchart.io/chart?c={type:%27line%27,data:{labels:[%27No%27,%27Data%27],datasets:[{label:%27Price%27,data:[0,0]}]}}';
  }
  
  // 取最近90天数据（避免图表过于拥挤）
  const recentPrices = historicalPrices.slice(-90);
  
  const labels = recentPrices.map(p => {
    const date = new Date(p.date);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  });
  
  const closes = recentPrices.map(p => p.close);
  
  const chart = new QuickChart();
  chart.setConfig({
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: `${symbol} 收盘价`,
        data: closes,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        fill: true,
        tension: 0.1,
        pointRadius: 0,
        borderWidth: 2
      }]
    },
    options: {
      title: {
        display: true,
        text: `${symbol} 股价走势（90天）`,
        fontSize: 16,
        fontColor: '#2c3e50'
      },
      scales: {
        yAxes: [{
          ticks: {
            callback: function(value) {
              return '$' + value.toFixed(2);
            }
          },
          gridLines: {
            color: '#ecf0f1'
          }
        }],
        xAxes: [{
          gridLines: {
            display: false
          },
          ticks: {
            maxTicksLimit: 10
          }
        }]
      },
      legend: {
        display: false
      }
    }
  });
  
  chart.setWidth(800);
  chart.setHeight(400);
  chart.setBackgroundColor('#ffffff');
  
  return chart.getUrl();
}

/**
 * 生成机构级深度研报
 * @param {string} symbol - 股票代码
 * @param {Object} options - 配置选项
 * @returns {Promise<Object>} - { pdfBuffer, summary, rating, metadata }
 */
async function generateDeepReport(symbol, options = {}) {
  console.log(`\n📊 [Deep Report v3.0] 生成机构级深度研报: ${symbol}`);
  const startTime = Date.now();
  
  try {
    // ===== 第1阶段：深度数据收集（30-60秒） =====
    console.log('   📊 [1/4] 深度数据收集中...');
    const enrichedData = await collectEnrichedData(symbol);
    
    // ===== 第2阶段：分章节AI生成（60-180秒） =====
    console.log('   🤖 [2/4] 分章节AI内容生成中（9个章节）...');
    const sections = await generateAllSections(symbol, enrichedData);
    
    // ===== 第3阶段：评级与综合结论（10-20秒） =====
    console.log('   🎯 [3/4] 生成评级与投资建议...');
    const rating = await generateRatingAndConclusion(symbol, enrichedData, sections);
    
    // ===== 第4阶段：PDF渲染（10-30秒） =====
    console.log('   📝 [4/4] 渲染机构级PDF...');
    const { pdfBuffer, htmlContent } = await renderDeepReportPDF(symbol, enrichedData, sections, rating);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ [Deep Report] 深度研报生成完成 (${duration}s)`);
    
    return {
      pdfBuffer,
      htmlContent,
      summary: rating.investmentSummary,
      rating: rating.ratingCode, // BUY/HOLD/SELL
      coreView: rating.coreView,
      metadata: {
        symbol,
        version: '3.0-institutional',
        generatedAt: new Date().toISOString(),
        duration: parseFloat(duration),
        sections: Object.keys(sections).length,
        pages: estimatePageCount(sections)
      }
    };
    
  } catch (error) {
    console.error(`❌ [Deep Report] 生成失败: ${error.message}`);
    throw new Error(`深度研报生成失败: ${error.message}`);
  }
}

/**
 * 收集深度研报所需的全部数据
 */
async function collectEnrichedData(symbol) {
  console.log('   📦 开始并行收集数据...');
  
  const tasks = [];
  
  // 1. 实时行情
  tasks.push(
    fetchMarketData([symbol], ['quote'])
      .then(data => ({ quote: data.quotes[symbol] || {} }))
      .catch(() => ({ quote: {} }))
  );
  
  // 2. 公司概况
  tasks.push(
    fetchCompanyProfile(symbol)
      .then(data => ({ profile: data.profile || {} }))
      .catch(() => ({ profile: {} }))
  );
  
  // 3. 历史价格（12个月用于技术分析）
  tasks.push(
    fetchHistoricalPrices(symbol, { months: 12 })
      .then(data => ({ historicalPrices: data || [] }))
      .catch(() => ({ historicalPrices: [] }))
  );
  
  // 4. 新闻数据（深度版：取前10条）
  tasks.push(
    fetchAndRankNews({ symbols: [symbol], topN: 10 })
      .then(data => ({ news: data || [] }))
      .catch(() => ({ news: [] }))
  );
  
  // 5. 🆕 技术指标数据（RSI, MACD, EMA, BBANDS, ADX）
  tasks.push(
    fetchTechnicalIndicators(symbol, '1day')
      .then(data => ({ technicalIndicators: data.technical || {} }))
      .catch(() => ({ technicalIndicators: {} }))
  );
  
  // 6. 🆕 v4.0: 财务报表数据（利润表、资产负债表、现金流）
  tasks.push(
    fetchFundamentals(symbol)
      .then(data => ({ fundamentals: data.fundamentals || {} }))
      .catch(() => ({ fundamentals: {} }))
  );
  
  // 7. 🆕 v4.0: 估值指标数据（PE, PB, 毛利率等）
  tasks.push(
    fetchStockMetrics(symbol)
      .then(data => ({ metrics: data.metrics || {} }))
      .catch(() => ({ metrics: {} }))
  );
  
  const results = await Promise.all(tasks);
  const enrichedData = results.reduce((acc, curr) => ({ ...acc, ...curr }), {});
  
  // 🔍 v4.0: 详细数据诊断日志
  console.log(`   ✅ 数据收集完成: 行情✓ 概况✓ 历史✓ 新闻✓ 技术指标✓ 财务✓ 估值✓`);
  console.log(`   🔍 [诊断] 财务数据状态:`);
  console.log(`      - Fundamentals: ${enrichedData.fundamentals?.income_statement ? '有数据' : '⚠️ 缺失'}`);
  console.log(`      - Metrics: ${enrichedData.metrics?.peRatio ? '有数据' : '⚠️ 缺失'}`);
  console.log(`      - 新闻数量: ${enrichedData.news?.length || 0}条`);
  console.log(`      - 历史价格点数: ${enrichedData.historicalPrices?.length || 0}`);
  console.log(`      - 技术指标: RSI=${enrichedData.technicalIndicators?.rsi ? '✓' : '✗'} MACD=${enrichedData.technicalIndicators?.macd ? '✓' : '✗'}`);
  
  return {
    symbol,
    ...enrichedData,
    timestamp: new Date().toISOString()
  };
}

/**
 * 分章节生成AI内容（9个章节）
 */
async function generateAllSections(symbol, data) {
  console.log('   🤖 开始分章节AI生成...');
  
  const multiAI = getMultiAIProvider();
  const sections = {};
  
  // 章节1：封面信息（核心观点）
  console.log('      [1/9] 生成封面核心观点...');
  sections.cover = await generateSection_Cover(symbol, data, multiAI);
  
  // 章节2：投资摘要
  console.log('      [2/9] 生成投资摘要...');
  sections.summary = await generateSection_Summary(symbol, data, multiAI);
  
  // 章节3：公司概况
  console.log('      [3/9] 生成公司概况...');
  sections.company = await generateSection_Company(symbol, data, multiAI);
  
  // 章节4：行业与竞争格局
  console.log('      [4/9] 生成行业分析...');
  sections.industry = await generateSection_Industry(symbol, data, multiAI);
  
  // 章节5：财务与估值分析
  console.log('      [5/9] 生成财务分析...');
  sections.financials = await generateSection_Financials(symbol, data, multiAI);
  
  // 章节6：股价与技术面分析
  console.log('      [6/9] 生成技术分析...');
  sections.technical = await generateSection_Technical(symbol, data, multiAI);
  
  // 章节7：重大事件与新闻综述
  console.log('      [7/9] 生成新闻综述...');
  sections.newsAnalysis = await generateSection_News(symbol, data, multiAI);
  
  // 章节8：核心风险提示
  console.log('      [8/9] 生成风险分析...');
  sections.risks = await generateSection_Risks(symbol, data, multiAI);
  
  // 章节9将在评级阶段生成
  
  console.log('   ✅ 8个章节生成完成');
  return sections;
}

/**
 * 章节1：封面核心观点
 */
async function generateSection_Cover(symbol, data, multiAI) {
  const { quote, profile } = data;
  const companyName = profile.companyName || profile.name || symbol;
  
  const prompt = `你是一位资深证券分析师。请为${companyName} (${symbol})写一句核心投资观点（thesis），要求：

当前股价：$${quote.c || 'N/A'}
公司行业：${profile.finnhubIndustry || '未知'}

要求：
1. 一句话概括核心逻辑（20-40字）
2. 必须包含"催化剂"或"风险点"
3. 风格参考："受益于XX周期复苏，公司中期具备β+α机会"或"面临XX压力，短期建议观望"

只输出核心观点，不要多余解释。`;

  const response = await multiAI.generate('gpt-4o-mini', [
    { role: 'user', content: prompt }
  ], { maxTokens: 100, temperature: 0.7 });
  
  return {
    coreView: response.text.trim()
  };
}

/**
 * 章节2：投资摘要（3-5个bullet）
 */
async function generateSection_Summary(symbol, data, multiAI) {
  const { quote, profile, news } = data;
  const companyName = profile.companyName || profile.name || symbol;
  
  const prompt = `你是一位投资分析师，请为${companyName} (${symbol})写投资摘要。

数据：
- 股价: $${quote.c || 'N/A'} (${quote.dp ? (quote.dp > 0 ? '+' : '') + quote.dp.toFixed(2) + '%' : 'N/A'})
- 市值: ${formatMarketCap(profile.marketCapitalization)}
- 行业: ${profile.finnhubIndustry || '未知'}
- 最近新闻: ${news.slice(0, 3).map(n => n.headline).join('; ')}

请输出JSON格式：
{
  "highlights": ["投资亮点1", "投资亮点2", "投资亮点3"],
  "risks": ["关键风险1", "关键风险2"],
  "valuation": "估值判断（偏贵/合理/偏便宜）",
  "view": "中短期观点（偏多/偏空/观望）"
}

要求：简洁专业，每条10-20字。`;

  const response = await multiAI.generate('gpt-4o', [
    { role: 'user', content: prompt }
  ], { maxTokens: 400, temperature: 0.6 });
  
  try {
    const parsed = JSON.parse(response.text.replace(/```json\n?|\n?```/g, ''));
    return parsed;
  } catch (e) {
    return {
      highlights: ['数据解析失败'],
      risks: ['数据解析失败'],
      valuation: '无法判断',
      view: '观望'
    };
  }
}

/**
 * 章节3：公司概况
 */
async function generateSection_Company(symbol, data, multiAI) {
  const { profile } = data;
  const companyName = profile.companyName || profile.name || symbol;
  
  const prompt = `你是行业研究员，请简要介绍${companyName} (${symbol})：

已知信息：
- 公司名称: ${companyName}
- 行业: ${profile.finnhubIndustry || '需要推断'}
- 国家: ${profile.country || '未知'}
- 网址: ${profile.weburl || ''}

请输出JSON格式：
{
  "business": "公司主要业务（2-3句话）",
  "revenueModel": "商业模式（订阅/许可/硬件销售/混合等）",
  "geography": "主要市场地区",
  "keyProducts": "核心产品或服务"
}

要求：专业简洁，基于行业常识推断。如果信息不足，给出合理推测。`;

  const response = await multiAI.generate('gpt-4o', [
    { role: 'user', content: prompt }
  ], { maxTokens: 500, temperature: 0.6 });
  
  try {
    const parsed = JSON.parse(response.text.replace(/```json\n?|\n?```/g, ''));
    return parsed;
  } catch (e) {
    return {
      business: '信息获取失败',
      revenueModel: '未知',
      geography: '全球',
      keyProducts: '详见公司官网'
    };
  }
}

/**
 * 章节4：行业与竞争格局
 */
async function generateSection_Industry(symbol, data, multiAI) {
  const { profile } = data;
  const companyName = profile.companyName || profile.name || symbol;
  const industry = profile.finnhubIndustry || '未知';
  
  // 🆕 v4.0: 增强为结构化行业分析
  const prompt = `你是首席行业分析师，请深入分析${companyName} (${symbol})所在行业：

行业：${industry}

请输出JSON格式：
{
  "industryCycle": "行业当前周期状态（例如：库存周期复苏/下行周期/成长期/成熟期，30字内）",
  "keyDrivers": ["驱动因素1（如AI需求/政策支持）", "驱动因素2", "驱动因素3"],
  "industryRisks": ["行业风险1（如供应链/监管）", "行业风险2"],
  "outlook6_12m": "未来6-12个月展望（60字内，明确方向和关键变量）",
  "competitors": [
    {"name": "竞争对手1", "position": "一句话定位"},
    {"name": "竞争对手2", "position": "一句话定位"}
  ],
  "companyPosition": "公司在行业中的位置（领先/追赶/小众/新进入者）"
}

要求：
1. 基于${industry}行业的常识和2024-2025年趋势
2. 驱动因素要具体（不要泛泛而谈）
3. 展望要包含关键判断节点`;

  const response = await multiAI.generate('gpt-4o', [
    { role: 'user', content: prompt }
  ], { maxTokens: 600, temperature: 0.6 });
  
  try {
    const parsed = JSON.parse(response.text.replace(/```json\n?|\n?```/g, ''));
    return parsed;
  } catch (e) {
    console.error('      ⚠️  行业分析失败:', e.message);
    // 🆕 v4.0: 返回完整结构化字段（防止undefined）
    return {
      industryCycle: '行业周期分析失败',
      keyDrivers: ['数据不足', '无法分析', '请人工判断'],
      industryRisks: ['分析失败', '请人工评估'],
      outlook6_12m: '展望生成失败，请人工判断',
      competitors: [],
      companyPosition: '未知'
    };
  }
}

/**
 * 章节5：财务与估值分析
 */
async function generateSection_Financials(symbol, data, multiAI) {
  const { quote, profile, fundamentals = {}, metrics = {} } = data;
  const companyName = profile.companyName || profile.name || symbol;
  
  // 🆕 v4.0: 标准化财务数据
  const financialData = normalizeFinancialData(fundamentals, metrics);
  const hasRealData = fundamentals?.income_statement?.data || metrics?.peRatio;
  
  // 🔍 诊断日志
  console.log(`      📊 财务数据标准化结果:`);
  console.log(`         - Revenue数据点: ${financialData.revenue.length}`);
  console.log(`         - NetIncome数据点: ${financialData.netIncome.length}`);
  console.log(`         - PE比率: ${financialData.pe || 'N/A'}`);
  console.log(`         - 市值: ${formatMarketCap(profile.marketCapitalization)}`);
  console.log(`         - 缺失字段: ${financialData.missing.join(', ') || '无'}`);
  console.log(`         - hasRealData: ${hasRealData}`);
  
  // 构建真实财务上下文
  const finContext = hasRealData ? `
**真实财务数据（Twelve Data + Finnhub）**：
- 营业收入: ${financialData.revenue.length > 0 ? '$' + (financialData.revenue[0] / 1000000).toFixed(2) + 'M' : 'N/A'}
- 净利润: ${financialData.netIncome.length > 0 ? '$' + (financialData.netIncome[0] / 1000000).toFixed(2) + 'M' : 'N/A'}
- 毛利率: ${financialData.grossMargin[0] || 'N/A'}%
- 净利率: ${financialData.netMargin[0] || metrics?.profitMargin ? (metrics.profitMargin * 100).toFixed(2) : 'N/A'}%
- PE比率: ${metrics?.peRatio?.toFixed(2) || 'N/A'}
- 营收增长: ${metrics?.revenueGrowth ? (metrics.revenueGrowth * 100).toFixed(2) + '%' : 'N/A'}
- ROE: ${metrics?.roe ? (metrics.roe * 100).toFixed(2) + '%' : 'N/A'}` : '⚠️ 财务数据缺失';
  
  const prompt = `你是财务分析师，请分析${companyName} (${symbol})的财务与估值：

数据：
- 市值: ${formatMarketCap(profile.marketCapitalization)}
- 股价: $${quote.c || 'N/A'}
- 行业: ${profile.finnhubIndustry || '未知'}
${finContext}

请输出JSON格式：
{
  "revenueTrend": "${hasRealData ? '基于真实数据分析营收趋势' : '数据不足，推断'}",
  "profitability": "${hasRealData ? '基于毛利率、净利率、ROE分析盈利能力' : '数据有限'}",
  "valuationView": "${hasRealData ? '基于PE对比行业平均判断估值水平' : '数据不足'}",
  "keyMetrics": {
    "revenue": "${financialData.revenue[0] ? formatFinancialValue(financialData.revenue[0]) : 'N/A'}",
    "netIncome": "${financialData.netIncome[0] ? formatFinancialValue(financialData.netIncome[0]) : 'N/A'}",
    "pe": "${metrics?.peRatio?.toFixed(2) || 'N/A'}",
    "marketCap": "${formatMarketCap(profile.marketCapitalization)}"
  },
  "tableData": {
    "recentYears": "${hasRealData ? '基于真实数据' : '数据有限'}"
  }
}`;

  const response = await multiAI.generate('gpt-4o', [
    { role: 'user', content: prompt }
  ], { maxTokens: 700, temperature: 0.5 });
  
  try {
    const parsed = JSON.parse(response.text.replace(/```json\n?|\n?```/g, ''));
    return { ...parsed, realFinancialData: financialData, hasRealData };
  } catch (e) {
    return {
      revenueTrend: hasRealData ? 'AI解析失败，但已获取真实数据' : '数据不足',
      profitability: '数据有限',
      valuationView: '数据有限',
      keyMetrics: {
        revenue: financialData.revenue[0] ? formatFinancialValue(financialData.revenue[0]) : 'N/A',
        netIncome: financialData.netIncome[0] ? formatFinancialValue(financialData.netIncome[0]) : 'N/A',
        pe: metrics?.peRatio?.toFixed(2) || 'N/A',
        marketCap: formatMarketCap(profile.marketCapitalization)
      },
      tableData: { recentYears: '数据缺失' },
      realFinancialData: financialData,
      hasRealData
    };
  }
}

/**
 * 章节6：股价与技术面分析
 * 🆕 v3.1: 使用Twelve Data真实技术指标
 */
async function generateSection_Technical(symbol, data, multiAI) {
  const { quote, historicalPrices, technicalIndicators = {} } = data;
  
  // 🆕 提取真实技术指标数据（修复：强制类型转换为数字）
  const indicatorsData = {};
  
  if (technicalIndicators.rsi && !technicalIndicators.rsi.error && !isNaN(technicalIndicators.rsi.value)) {
    indicatorsData.rsi = Number(technicalIndicators.rsi.value);
    indicatorsData.rsi_signal = indicatorsData.rsi > 70 ? '超买' : (indicatorsData.rsi < 30 ? '超卖' : '中性');
  }
  
  if (technicalIndicators.macd && !technicalIndicators.macd.error && !isNaN(technicalIndicators.macd.macd)) {
    indicatorsData.macd = Number(technicalIndicators.macd.macd);
    indicatorsData.macd_signal = Number(technicalIndicators.macd.signal);
    indicatorsData.macd_histogram = Number(technicalIndicators.macd.histogram);
    indicatorsData.macd_trend = indicatorsData.macd_histogram > 0 ? '多头信号' : '空头信号';
  }
  
  if (technicalIndicators.ema && !technicalIndicators.ema.error && !isNaN(technicalIndicators.ema.value)) {
    indicatorsData.ema20 = Number(technicalIndicators.ema.value);
    indicatorsData.price_vs_ema20 = quote.c > indicatorsData.ema20 ? '突破均线' : '跌破均线';
  }
  
  if (technicalIndicators.bbands && !technicalIndicators.bbands.error && !isNaN(technicalIndicators.bbands.upper) && technicalIndicators.bbands.lower !== undefined) {
    indicatorsData.bbands_upper = Number(technicalIndicators.bbands.upper);
    indicatorsData.bbands_lower = Number(technicalIndicators.bbands.lower);
    const position = quote.c > indicatorsData.bbands_upper ? '超买区' : (quote.c < indicatorsData.bbands_lower ? '超卖区' : '正常区');
    indicatorsData.bbands_position = position;
  }
  
  // 🆕 v4.0: 计算支撑/压力位（对象格式）
  let supportResistance = { support: 'N/A', resistance: 'N/A', summary: '数据不足' };
  if (historicalPrices.length > 0) {
    const recentPrices = historicalPrices.slice(-60); // 最近60天
    const highs = recentPrices.map(p => p.high);
    const lows = recentPrices.map(p => p.low);
    const resistance = Math.max(...highs).toFixed(2);
    const support = Math.min(...lows).toFixed(2);
    supportResistance = {
      support,
      resistance,
      summary: `支撑位$${support}，阻力位$${resistance}`
    };
  }
  
  const hasRealData = Object.keys(indicatorsData).length > 0;
  
  const prompt = `你是技术分析师，请分析${symbol}的股价走势：

当前股价：$${quote.c || 'N/A'} (${quote.dp ? (quote.dp > 0 ? '+' : '') + quote.dp.toFixed(2) + '%' : 'N/A'})
历史数据点数：${historicalPrices.length}

🆕 **真实技术指标数据**（来自Twelve Data）：
${hasRealData ? `
- RSI(14): ${indicatorsData.rsi?.toFixed(2) || 'N/A'} (${indicatorsData.rsi_signal || 'N/A'})
- MACD: ${indicatorsData.macd?.toFixed(2) || 'N/A'} / Signal: ${indicatorsData.macd_signal?.toFixed(2) || 'N/A'} (${indicatorsData.macd_trend || 'N/A'})
- EMA(20): $${indicatorsData.ema20?.toFixed(2) || 'N/A'} (价格${indicatorsData.price_vs_ema20 || 'N/A'})
- 布林带: 上轨$${indicatorsData.bbands_upper?.toFixed(2) || 'N/A'} / 下轨$${indicatorsData.bbands_lower?.toFixed(2) || 'N/A'} (${indicatorsData.bbands_position || 'N/A'})
- 支撑位: $${supportResistance.support}, 压力位: $${supportResistance.resistance}
` : '⚠️ 技术指标数据缺失（可能是免费API限制），请基于历史价格推断'}

请输出JSON格式：
{
  "trend": "主要趋势（上涨/下跌/震荡），结合RSI、MACD说明",
  "supportResistanceSummary": "${supportResistance.summary}",
  "indicators": "${hasRealData ? '基于真实指标的详细分析（RSI+MACD+EMA+布林带）' : '数据有限，基于价格行为推断'}",
  "conclusion": "技术面结论（2-3句人话），明确说明${hasRealData ? '指标显示的方向' : '数据局限性'}"
}

要求：${hasRealData ? '直接使用提供的真实指标数据，不要猜测' : '说明缺乏详细指标数据'}。`;

  const response = await multiAI.generate('gpt-4o-mini', [
    { role: 'user', content: prompt }
  ], { maxTokens: 600, temperature: 0.5 });
  
  try {
    const parsed = JSON.parse(response.text.replace(/```json\n?|\n?```/g, ''));
    
    // 🆕 v4.0: 附加结构化数据到返回值
    return {
      ...parsed,
      supportResistance, // 🆕 对象格式 {support, resistance, summary}
      realIndicators: indicatorsData, // 真实指标数据
      historicalDataPoints: historicalPrices.length
    };
  } catch (e) {
    console.error('      ⚠️  技术分析失败:', e.message);
    // 🆕 v4.0: 返回完整结构化字段（防止undefined）
    return {
      trend: '数据不足',
      supportResistance, // 对象格式
      supportResistanceSummary: supportResistance.summary,
      indicators: hasRealData ? 'AI解析失败，但已获取真实指标' : '数据有限',
      conclusion: '技术分析生成失败',
      realIndicators: indicatorsData,
      historicalDataPoints: historicalPrices.length
    };
  }
}

/**
 * 章节7：重大事件与新闻综述
 */
async function generateSection_News(symbol, data, multiAI) {
  const { news = [] } = data; // 🆕 v4.0: 默认空数组
  const companyName = data.profile.companyName || data.profile.name || symbol;
  
  console.log(`      📰 新闻数量: ${news.length}条`);
  
  if (news.length === 0) {
    console.log(`      ⚠️  新闻数据为空，返回空结果`);
    return {
      themes: [],
      summary: '暂无重大新闻或新闻数据获取失败',
      overallSentiment: '无数据',
      newsCount: 0,
      rawNews: []
    };
  }
  
  // 🔍 诊断日志：检查新闻数据质量
  console.log(`      🔍 新闻数据样本: ${news[0]?.headline?.substring(0, 50)}...`);
  console.log(`      🔍 ImpactScore: ${news[0]?.impactScore || 'N/A'}`);
  
  // 🆕 v4.0: 过去1-4周新闻，增加ImpactRank信息
  const recentNews = news.slice(0, 15); // 增加到15条以便聚类
  const newsText = recentNews.map((n, i) => 
    `${i + 1}. ${n.headline} (${new Date(n.datetime * 1000).toLocaleDateString()}) [影响力:${n.impactScore?.toFixed(1) || 'N/A'}]`
  ).join('\n');
  
  const prompt = `你是资深新闻分析师，请分析${companyName} (${symbol})的最近新闻，聚类成2-4个主题：

**新闻列表（共${recentNews.length}条）**：
${newsText}

请输出JSON格式：
{
  "themes": [
    {"topic": "主题1（如业绩/并购/产品发布/监管）", "sentiment": "利好/中性/利空", "analysis": "事件内容+影响（30-50字）", "newsCount": 3},
    {"topic": "主题2", "sentiment": "判断", "analysis": "分析", "newsCount": 2}
  ],
  "summary": "综合新闻综述（3-5句话，包含整体影响判断）",
  "overallSentiment": "整体情绪（正面/中性/负面）"
}

要求：
1. 合并相似新闻为主题（例如多条财报新闻合并为"财报主题"）
2. 每个主题标明利好/中性/利空
3. 提炼2-4个核心主题`;

  try {
    const response = await multiAI.generate('gpt-4o', [
      { role: 'user', content: prompt }
    ], { maxTokens: 900, temperature: 0.6 });
    
    const parsed = JSON.parse(response.text.replace(/```json\n?|\n?```/g, ''));
    return {
      ...parsed,
      newsCount: recentNews.length,
      rawNews: recentNews.slice(0, 5)
    };
  } catch (e) {
    console.error('      ⚠️  新闻分析失败:', e.message);
    return {
      themes: recentNews.slice(0, 5).map(n => ({
        topic: n.headline,
        sentiment: '未分析',
        analysis: n.summary || '无摘要',
        newsCount: 1
      })),
      summary: `最近${recentNews.length}条新闻，AI分析失败，显示原始列表`,
      overallSentiment: '未分析',
      newsCount: recentNews.length,
      rawNews: recentNews.slice(0, 5)
    };
  }
}

/**
 * 章节8：核心风险提示
 */
async function generateSection_Risks(symbol, data, multiAI) {
  const { profile } = data;
  const companyName = profile.companyName || profile.name || symbol;
  
  const prompt = `你是风险管理专家，请分析${companyName} (${symbol})的投资风险：

行业：${profile.finnhubIndustry || '未知'}
国家：${profile.country || '未知'}

请输出JSON格式：
{
  "industryRisks": ["行业风险1", "行业风险2"],
  "companyRisks": ["公司特有风险1", "公司特有风险2"],
  "marketRisks": ["市场风险1", "市场风险2"]
}

要求：每类风险2-3条，简洁明确，10-20字/条。`;

  const response = await multiAI.generate('gpt-4o-mini', [
    { role: 'user', content: prompt }
  ], { maxTokens: 500, temperature: 0.6 });
  
  try {
    const parsed = JSON.parse(response.text.replace(/```json\n?|\n?```/g, ''));
    return parsed;
  } catch (e) {
    return {
      industryRisks: ['风险分析生成失败'],
      companyRisks: ['请自行评估'],
      marketRisks: ['市场波动风险']
    };
  }
}

/**
 * 生成评级与综合结论（章节9）
 */
async function generateRatingAndConclusion(symbol, data, sections) {
  const multiAI = getMultiAIProvider();
  const { quote, profile } = data;
  const companyName = profile.companyName || profile.name || symbol;
  
  // 构建综合分析上下文
  const context = `
公司：${companyName} (${symbol})
股价：$${quote.c || 'N/A'} (${quote.dp ? (quote.dp > 0 ? '+' : '') + quote.dp.toFixed(2) + '%' : 'N/A'})

投资摘要：
- 估值判断：${sections.summary.valuation}
- 中短期观点：${sections.summary.view}

财务估值：${sections.financials.valuationView}
技术面：${sections.technical.conclusion}
新闻综述：${sections.newsAnalysis.summary}
`;

  // 🆕 v4.0: 添加技术面数据到上下文
  const technicalContext = sections.technical?.realIndicators ? `
技术指标：
- RSI(14): ${sections.technical.realIndicators.rsi || 'N/A'}
- MACD: ${sections.technical.realIndicators.macd || 'N/A'}
- 支撑位: ${sections.technical.supportResistance?.support || 'N/A'}
- 压力位: ${sections.technical.supportResistance?.resistance || 'N/A'}
` : '';
  
  const prompt = `你是首席分析师，请给出最终评级与结构化投资策略：

${context}${technicalContext}

请输出JSON格式：
{
  "ratingCode": "BUY或HOLD或SELL（三选一）",
  "shortTermView": "1-4周短期观点（30字内）",
  "supportLevel": "${sections.technical?.supportResistance?.support || '基于60日低点推测'}",
  "resistanceLevel": "${sections.technical?.supportResistance?.resistance || '基于60日高点推测'}",
  "breakoutTrigger": "突破触发点（例如：突破$XX+放量 或 特定事件催化）",
  "breakdownRisk": "下行风险触发点（例如：跌破$XX 或 负面财报）",
  "riskTier": "风险等级（A-低风险/B-中风险/C-高风险，基于波动性和不确定性）",
  "valuation": "估值判断：偏贵/合理/偏便宜",
  "rationale": "评级理由（3-5句话）",
  "suggestion": "对应建议（BUY=长期配置逻辑；HOLD=观望+触发点；SELL=主要担忧）",
  "investmentSummary": "5-10行投资摘要（包含评级、核心逻辑、风险、建议）"
}

要求：逻辑清晰，明确表态。`;

  const response = await multiAI.generate('gpt-4o', [
    { role: 'user', content: prompt }
  ], { maxTokens: 800, temperature: 0.6 });
  
  try {
    const parsed = JSON.parse(response.text.replace(/```json\n?|\n?```/g, ''));
    return {
      ...parsed,
      coreView: sections.cover.coreView // 封面核心观点
    };
  } catch (e) {
    console.error('      ⚠️  评级生成失败:', e.message);
    // 🆕 v4.0: 返回完整结构化策略字段（防止undefined）
    return {
      ratingCode: 'HOLD',
      shortTermView: '数据不足，建议观望',
      supportLevel: sections.technical?.supportResistance?.support || 'N/A',
      resistanceLevel: sections.technical?.supportResistance?.resistance || 'N/A',
      breakoutTrigger: '评级失败，无法提供触发点',
      breakdownRisk: '评级失败，无法评估风险',
      riskTier: 'B',
      valuation: '无法判断',
      rationale: '评级生成失败，AI解析错误',
      suggestion: '建议人工复核财务和技术指标后决策',
      investmentSummary: '评级系统错误，请人工分析。建议审查财务数据、技术指标和新闻后做出投资决定。',
      coreView: sections.cover.coreView
    };
  }
}

/**
 * 渲染机构级PDF
 */
async function renderDeepReportPDF(symbol, data, sections, rating) {
  const { quote, profile } = data;
  const companyName = profile.companyName || profile.name || symbol;
  
  // 🆕 生成QuickChart静态K线图（DocRaptor兼容）
  const chartURL = generatePriceChartURL(data.historicalPrices, symbol);
  
  // 🆕 v4.0: 生成财务趋势图（如果有数据）
  const financialChartURL = sections.financials?.realFinancialData 
    ? generateFinancialTrendChart(sections.financials.realFinancialData, symbol)
    : null;
  
  // 构建HTML内容
  const htmlContent = buildDeepReportHTML({
    symbol,
    companyName,
    exchange: profile.exchange || 'UNKNOWN',
    date: new Date().toLocaleDateString('zh-CN'),
    price: quote.c || 'N/A',
    change: quote.dp ? `${quote.dp > 0 ? '+' : ''}${quote.dp.toFixed(2)}%` : 'N/A',
    rating,
    sections,
    chartURL,
    financialChartURL // 🆕 v4.0
  });
  
  // 生成PDF
  const pdfBuffer = await convertHTMLtoPDF(htmlContent);
  
  return { pdfBuffer, htmlContent };
}

/**
 * 构建深度报告HTML模板
 */
function buildDeepReportHTML({ symbol, companyName, exchange, date, price, change, rating, sections, chartURL, financialChartURL }) {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <title>USIS Research Report - ${symbol}</title>
  <style>
    /* DocRaptor优化：中文字体支持 */
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap');
    
    body {
      font-family: "Noto Sans SC", "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "WenQuanYi Micro Hei", "SimHei", sans-serif;
      line-height: 1.8;
      color: #2c3e50;
      max-width: 900px;
      margin: 0 auto;
      padding: 30px;
    }
    
    /* 封面 */
    .cover {
      text-align: center;
      padding: 80px 0;
      border-bottom: 4px solid #3498db;
      margin-bottom: 50px;
      page-break-after: always;
    }
    .cover h1 {
      font-size: 28px;
      color: #2c3e50;
      margin-bottom: 15px;
      font-weight: 700;
      font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif;
    }
    .cover .company {
      font-size: 24px;
      color: #34495e;
      margin-bottom: 10px;
    }
    .cover .symbol {
      font-size: 18px;
      color: #7f8c8d;
      margin-bottom: 30px;
    }
    .cover .rating {
      display: inline-block;
      padding: 12px 30px;
      margin: 20px 0;
      font-size: 22px;
      font-weight: bold;
      border-radius: 5px;
      ${rating.ratingCode === 'BUY' ? 'background: #27ae60; color: white;' : ''}
      ${rating.ratingCode === 'SELL' ? 'background: #e74c3c; color: white;' : ''}
      ${rating.ratingCode === 'HOLD' ? 'background: #f39c12; color: white;' : ''}
    }
    .cover .core-view {
      font-size: 16px;
      color: #34495e;
      margin: 30px 50px;
      padding: 20px;
      background: #ecf0f1;
      border-left: 5px solid #3498db;
      font-style: italic;
    }
    .cover .meta {
      font-size: 14px;
      color: #95a5a6;
      margin-top: 40px;
    }
    
    /* 章节标题 */
    h2 {
      font-size: 22px;
      color: #2c3e50;
      border-bottom: 3px solid #3498db;
      padding-bottom: 10px;
      margin-top: 40px;
      margin-bottom: 25px;
      page-break-after: avoid;
      font-weight: 700;
      font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif;
    }
    h3 {
      font-size: 18px;
      color: #34495e;
      margin-top: 25px;
      margin-bottom: 15px;
      font-weight: 700;
      font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif;
    }
    
    /* 段落 */
    p {
      margin: 15px 0;
      text-align: justify;
    }
    
    /* 列表 */
    ul {
      margin: 15px 0;
      padding-left: 25px;
    }
    li {
      margin: 8px 0;
    }
    
    /* 表格 */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th {
      background: #3498db;
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: bold;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #ddd;
    }
    tr:nth-child(even) {
      background: #f8f9fa;
    }
    
    /* 高亮框 */
    .highlight-box {
      background: #e8f4f8;
      border-left: 5px solid #3498db;
      padding: 20px;
      margin: 25px 0;
    }
    .warning-box {
      background: #fff3cd;
      border-left: 5px solid #f39c12;
      padding: 20px;
      margin: 25px 0;
    }
    .risk-box {
      background: #f8d7da;
      border-left: 5px solid #e74c3c;
      padding: 20px;
      margin: 25px 0;
    }
    
    /* 图表 */
    .chart-container {
      margin: 25px 0;
      text-align: center;
    }
    .chart-link {
      display: inline-block;
      padding: 12px 25px;
      background: #3498db;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      margin: 10px 0;
    }
    
    /* 免责声明 */
    .disclaimer {
      margin-top: 50px;
      padding: 25px;
      background: #ecf0f1;
      border: 2px solid #95a5a6;
      font-size: 12px;
      color: #7f8c8d;
      line-height: 1.6;
    }
    
    /* 分页 */
    .page-break {
      page-break-before: always;
    }
  </style>
</head>
<body>

  <!-- 封面 -->
  <div class="cover">
    <h1>USIS Research Report</h1>
    <div class="company">${companyName}</div>
    <div class="symbol">${exchange}:${symbol}</div>
    <div class="rating">${rating.ratingCode}</div>
    <div class="core-view">
      <strong>核心观点：</strong>${rating.coreView}
    </div>
    <div class="meta">
      报告日期：${date}<br>
      当前股价：$${price} (${change})<br>
      版本：USIS v3.0 Institutional Beta
    </div>
  </div>

  <!-- 投资摘要 -->
  <h2>一、投资摘要</h2>
  <div class="highlight-box">
    <h3>投资亮点</h3>
    <ul>
      ${sections.summary.highlights.map(h => `<li>${h}</li>`).join('')}
    </ul>
    
    <h3>关键风险</h3>
    <ul>
      ${sections.summary.risks.map(r => `<li>${r}</li>`).join('')}
    </ul>
    
    <h3>估值与观点</h3>
    <p><strong>当前估值：</strong>${sections.summary.valuation}</p>
    <p><strong>中短期观点：</strong>${sections.summary.view}</p>
  </div>

  <!-- 公司概况 -->
  <div class="page-break"></div>
  <h2>二、公司概况</h2>
  <p><strong>主要业务：</strong>${sections.company.business}</p>
  <p><strong>商业模式：</strong>${sections.company.revenueModel}</p>
  <p><strong>地理市场：</strong>${sections.company.geography}</p>
  <p><strong>核心产品：</strong>${sections.company.keyProducts}</p>

  <!-- 行业与竞争 -->
  <h2>三、行业与竞争格局</h2>
  
  ${sections.industry.industryCycle ? `
  <h3>行业周期</h3>
  <div class="highlight-box">
    <p>${sections.industry.industryCycle}</p>
  </div>
  ` : ''}
  
  ${sections.industry.keyDrivers && sections.industry.keyDrivers.length > 0 ? `
  <h3>关键驱动因素</h3>
  <ul>
    ${sections.industry.keyDrivers.map(d => `<li>${d}</li>`).join('')}
  </ul>
  ` : ''}
  
  ${sections.industry.industryRisks && sections.industry.industryRisks.length > 0 ? `
  <h3>行业风险</h3>
  <ul>
    ${sections.industry.industryRisks.map(r => `<li>${r}</li>`).join('')}
  </ul>
  ` : ''}
  
  ${sections.industry.outlook6_12m ? `
  <h3>未来6-12个月展望</h3>
  <p>${sections.industry.outlook6_12m}</p>
  ` : ''}
  
  <h3>主要竞争对手</h3>
  ${sections.industry.competitors && sections.industry.competitors.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>公司</th>
          <th>定位</th>
        </tr>
      </thead>
      <tbody>
        ${sections.industry.competitors.map(c => `
          <tr>
            <td>${c.name}</td>
            <td>${c.position}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : '<p>竞争对手信息有限</p>'}
  
  <h3>公司市场地位</h3>
  <p>${sections.industry.companyPosition}</p>

  <!-- 财务与估值 -->
  <div class="page-break"></div>
  <h2>四、财务与估值分析</h2>
  
  ${sections.financials.hasRealData ? `
  <h3>关键财务指标</h3>
  <table>
    <thead>
      <tr>
        <th>指标</th>
        <th>数值</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>营业收入 (Revenue)</td><td>${sections.financials.keyMetrics.revenue}</td></tr>
      <tr><td>净利润 (Net Income)</td><td>${sections.financials.keyMetrics.netIncome}</td></tr>
      <tr><td>市值 (Market Cap)</td><td>${sections.financials.keyMetrics.marketCap}</td></tr>
      <tr><td>PE比率 (P/E Ratio)</td><td>${sections.financials.keyMetrics.pe}</td></tr>
    </tbody>
  </table>
  
  ${financialChartURL ? `
  <h3>财务趋势图（Revenue & Net Income）</h3>
  <div class="chart-container" style="text-align: center; margin: 20px 0;">
    <img src="${financialChartURL}" alt="${symbol} Financial Trends" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 5px;" />
    <p style="font-size: 12px; color: #7f8c8d; margin-top: 10px;">数据来源：Twelve Data + Finnhub | 单位：百万美元</p>
  </div>
  ` : ''}
  ` : ''}
  
  <h3>营收与盈利趋势</h3>
  <p><strong>营收趋势：</strong>${sections.financials.revenueTrend}</p>
  <p><strong>盈利能力：</strong>${sections.financials.profitability}</p>
  
  <h3>估值分析</h3>
  <div class="highlight-box">
    <p>${sections.financials.valuationView}</p>
  </div>
  
  <p><em>注：${sections.financials.tableData.recentYears}</em></p>

  <!-- 技术分析 -->
  <h2>五、股价与技术面分析</h2>
  
  <h3>股价走势图（6-12个月）</h3>
  <div class="chart-container" style="text-align: center; margin: 20px 0;">
    <img src="${chartURL}" alt="${symbol} Stock Chart" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 5px;" />
    <p style="font-size: 12px; color: #7f8c8d; margin-top: 10px;">数据来源：TradingView | 历史数据点：${sections.technical.historicalDataPoints || 0}条</p>
  </div>
  
  ${sections.technical.realIndicators && Object.keys(sections.technical.realIndicators).length > 0 ? `
  <h3>🆕 技术指标（Twelve Data实时数据）</h3>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <thead>
      <tr style="background: #ecf0f1;">
        <th style="border: 1px solid #bdc3c7; padding: 10px; text-align: left;">指标</th>
        <th style="border: 1px solid #bdc3c7; padding: 10px; text-align: right;">数值</th>
        <th style="border: 1px solid #bdc3c7; padding: 10px; text-align: center;">信号</th>
      </tr>
    </thead>
    <tbody>
      ${sections.technical.realIndicators && sections.technical.realIndicators.rsi ? `
      <tr>
        <td style="border: 1px solid #bdc3c7; padding: 10px;"><strong>RSI(14)</strong></td>
        <td style="border: 1px solid #bdc3c7; padding: 10px; text-align: right;">${sections.technical.realIndicators.rsi.toFixed(2)}</td>
        <td style="border: 1px solid #bdc3c7; padding: 10px; text-align: center;">
          <span style="padding: 5px 10px; border-radius: 3px; ${sections.technical.realIndicators.rsi_signal === '超买' ? 'background: #e74c3c; color: white;' : (sections.technical.realIndicators.rsi_signal === '超卖' ? 'background: #27ae60; color: white;' : 'background: #f39c12; color: white;')}">${sections.technical.realIndicators.rsi_signal || '暂无'}</span>
        </td>
      </tr>
      ` : ''}
      ${sections.technical.realIndicators && sections.technical.realIndicators.macd !== undefined && !isNaN(sections.technical.realIndicators.macd) ? `
      <tr>
        <td style="border: 1px solid #bdc3c7; padding: 10px;"><strong>MACD</strong></td>
        <td style="border: 1px solid #bdc3c7; padding: 10px; text-align: right;">${sections.technical.realIndicators.macd.toFixed(4)}</td>
        <td style="border: 1px solid #bdc3c7; padding: 10px; text-align: center;">
          <span style="padding: 5px 10px; border-radius: 3px; ${sections.technical.realIndicators.macd_trend === '多头信号' ? 'background: #27ae60; color: white;' : 'background: #e74c3c; color: white;'}">${sections.technical.realIndicators.macd_trend || '暂无'}</span>
        </td>
      </tr>
      ` : ''}
      ${sections.technical.realIndicators && sections.technical.realIndicators.ema20 ? `
      <tr>
        <td style="border: 1px solid #bdc3c7; padding: 10px;"><strong>EMA(20)</strong></td>
        <td style="border: 1px solid #bdc3c7; padding: 10px; text-align: right;">$${sections.technical.realIndicators.ema20.toFixed(2)}</td>
        <td style="border: 1px solid #bdc3c7; padding: 10px; text-align: center;">${sections.technical.realIndicators.price_vs_ema20 || '暂无'}</td>
      </tr>
      ` : ''}
      ${sections.technical.realIndicators && sections.technical.realIndicators.bbands_upper ? `
      <tr>
        <td style="border: 1px solid #bdc3c7; padding: 10px;"><strong>布林带</strong></td>
        <td style="border: 1px solid #bdc3c7; padding: 10px; text-align: right;">上轨$${sections.technical.realIndicators.bbands_upper.toFixed(2)} / 下轨$${sections.technical.realIndicators.bbands_lower.toFixed(2)}</td>
        <td style="border: 1px solid #bdc3c7; padding: 10px; text-align: center;">${sections.technical.realIndicators.bbands_position || '暂无'}</td>
      </tr>
      ` : ''}
    </tbody>
  </table>
  ` : '<p style="color: #e67e22;"><em>⚠️ 技术指标数据暂不可用（可能受API限制）</em></p>'}
  
  <h3>技术面综合分析</h3>
  <p><strong>主要趋势：</strong>${sections.technical.trend}</p>
  <p><strong>支撑/压力：</strong>${sections.technical.supportResistance?.summary || sections.technical.supportResistanceSummary || '数据不足'}</p>
  <p><strong>指标解读：</strong>${sections.technical.indicators}</p>
  
  <div class="highlight-box">
    <strong>技术面结论：</strong>${sections.technical.conclusion}
  </div>

  <!-- 新闻综述 -->
  <div class="page-break"></div>
  <h2>六、重大事件与新闻综述</h2>
  <p>${sections.newsAnalysis.summary}</p>
  
  ${sections.newsAnalysis.themes.length > 0 ? `
    <h3>新闻主题分析</h3>
    ${sections.newsAnalysis.themes.map(theme => `
      <div class="highlight-box">
        <h4>${theme.topic}</h4>
        <p><strong>影响判断：</strong>${theme.analysis}</p>
        <p>${theme.details}</p>
      </div>
    `).join('')}
  ` : '<p>近期无重大新闻</p>'}

  <!-- 风险提示 -->
  <h2>七、核心风险提示</h2>
  <div class="risk-box">
    <h3>行业风险</h3>
    <ul>
      ${sections.risks.industryRisks.map(r => `<li>${r}</li>`).join('')}
    </ul>
    
    <h3>公司风险</h3>
    <ul>
      ${sections.risks.companyRisks.map(r => `<li>${r}</li>`).join('')}
    </ul>
    
    <h3>市场风险</h3>
    <ul>
      ${sections.risks.marketRisks.map(r => `<li>${r}</li>`).join('')}
    </ul>
  </div>

  <!-- 综合结论与评级 -->
  <div class="page-break"></div>
  <h2>八、综合结论与投资策略</h2>
  <div class="highlight-box">
    <h3>评级：${rating.ratingCode} ${rating.riskTier ? `| 风险等级：${rating.riskTier}` : ''}</h3>
    <p><strong>估值判断：</strong>${rating.valuation}</p>
    <p><strong>评级理由：</strong>${rating.rationale}</p>
  </div>
  
  ${rating.shortTermView ? `
  <h3>短期观点（1-4周）</h3>
  <p>${rating.shortTermView}</p>
  ` : ''}
  
  ${(rating.supportLevel || rating.resistanceLevel) ? `
  <h3>关键价位</h3>
  <table>
    <thead>
      <tr>
        <th>类型</th>
        <th>价位</th>
      </tr>
    </thead>
    <tbody>
      ${rating.supportLevel ? `<tr><td>支撑位</td><td>$${rating.supportLevel}</td></tr>` : ''}
      ${rating.resistanceLevel ? `<tr><td>压力位</td><td>$${rating.resistanceLevel}</td></tr>` : ''}
    </tbody>
  </table>
  ` : ''}
  
  ${(rating.breakoutTrigger || rating.breakdownRisk) ? `
  <h3>触发点与风险</h3>
  ${rating.breakoutTrigger ? `<p><strong>突破触发点：</strong>${rating.breakoutTrigger}</p>` : ''}
  ${rating.breakdownRisk ? `<p><strong>下行风险：</strong>${rating.breakdownRisk}</p>` : ''}
  ` : ''}
  
  <h3>投资建议</h3>
  <p><strong>${rating.suggestion}</strong></p>
  
  <h3>投资摘要</h3>
  <p style="white-space: pre-line;">${rating.investmentSummary}</p>

  <!-- 免责声明 -->
  <div class="disclaimer">
    <strong>免责声明</strong><br><br>
    本报告由USIS Brain v3.0 AI系统自动生成，仅为学习交流草稿，不构成任何投资建议。
    报告中的数据、观点、评级均基于公开信息和AI算法分析，可能存在信息滞后、数据偏差或分析错误。
    投资者应独立判断，审慎决策，并承担相应风险。
    本报告不对任何投资损失承担责任。
    <br><br>
    生成时间：${new Date().toISOString()}<br>
    数据来源：Finnhub, Twelve Data, Alpha Vantage, OpenAI<br>
    版权所有：USIS Research (Beta)
  </div>

</body>
</html>
`;
}

/**
 * 使用DocRaptor或PDFKit生成PDF（完美支持中文UTF-8）
 */
async function convertHTMLtoPDF(htmlContent) {
  const DOCRAPTOR_API_KEY = process.env.DOCRAPTOR_API_KEY;
  
  // 优先使用DocRaptor（专业HTML→PDF，完美中文支持）
  if (DOCRAPTOR_API_KEY) {
    try {
      console.log('📄 [DocRaptor] 开始生成专业PDF（中文支持）...');
      const axios = require('axios');
      
      const response = await axios({
        url: 'https://api.docraptor.com/docs',
        method: 'POST',
        responseType: 'arraybuffer', // 获取二进制PDF
        headers: {
          'Content-Type': 'application/json'
        },
        data: {
          user_credentials: DOCRAPTOR_API_KEY,
          doc: {
            test: false, // 生产模式（无水印，需API额度）
            document_type: 'pdf',
            document_content: htmlContent,
            javascript: false,
            prince_options: {
              media: 'print',
              pdf_title: 'USIS Research Report',
              pdf_forms: false,
              // 中文字体支持优化
              no_xinclude: true,
              no_network: false // 允许加载Google Fonts中文字体
            }
          }
        },
        timeout: 60000 // 深度报告允许60秒
      });
      
      console.log('✅ [DocRaptor] 专业PDF生成成功（完整中文排版）');
      return Buffer.from(response.data);
      
    } catch (error) {
      console.error('❌ DocRaptor API调用失败:', error.response?.data?.toString() || error.message);
      console.warn('⚠️  降级到备用方案');
    }
  }
  
  // 备用方案1: PDFShift（如果配置）
  if (PDFSHIFT_API_KEY) {
    try {
      console.log('📄 [PDFShift] 尝试备用PDF服务...');
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
        timeout: 45000
      });
      
      if (!response.ok) {
        throw new Error(`PDFShift错误: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      console.log('✅ [PDFShift] PDF生成成功');
      return Buffer.from(arrayBuffer);
      
    } catch (error) {
      console.error('❌ PDFShift失败:', error.message);
    }
  }
  
  // 最后备用方案：PDFKit（纯文本，无中文）
  console.warn('⚠️  所有专业PDF服务不可用，使用PDFKit纯文本方案（不支持中文）');
  return generateFallbackPDF(htmlContent);
}

/**
 * PDFKit备用方案
 */
function generateFallbackPDF(htmlContent) {
  console.log('📝 [PDFKit] 使用备用方案生成深度研报PDF...');
  
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
  
  doc.fontSize(18).font('Helvetica-Bold').text('USIS Deep Research Report', { align: 'center' });
  doc.moveDown();
  doc.fontSize(10).font('Helvetica').text(textContent, {
    width: 500,
    align: 'left'
  });
  
  doc.end();
  
  return new Promise((resolve, reject) => {
    doc.on('end', () => {
      console.log('✅ [PDFKit] 深度研报PDF生成成功');
      resolve(Buffer.concat(chunks));
    });
    doc.on('error', reject);
  });
}

/**
 * 估算页数
 */
function estimatePageCount(sections) {
  // 简单估算：每个章节约1-2页，总计8-20页
  const sectionCount = Object.keys(sections).length;
  return Math.max(8, Math.min(20, sectionCount * 2));
}

module.exports = {
  generateDeepReport
};
