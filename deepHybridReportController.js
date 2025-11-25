const { fetchMarketData, fetchCompanyProfile, fetchHistoricalPrices, fetchTechnicalIndicators, fetchFundamentals, fetchStockMetrics, fetchPeerBenchmarks } = require('./dataBroker');
const { fetchAndRankNews } = require('./newsBroker');
const { callModelWithFallback } = require('./gpt5Brain');
const { calculateSupportResistance } = require('./technicalLevels');
const QuickChart = require('quickchart-js');

const MODULE_PIPELINE = {
  cover: {
    data_source: "dataBroker.fetchMarketData + dataBroker.fetchCompanyProfile",
    ai_source: "gpt5Brain.generateCoreView",
    merge_logic: "data_first_then_ai_inject",
    output_format: "pdf_section"
  },
  investment_summary: {
    data_source: "dataBroker.fetchMarketData + dataBroker.fetchNews",
    ai_source: "gpt5Brain.generateInvestmentSummary",
    merge_logic: "data_context_for_ai_generation",
    output_format: "html"
  },
  company_overview: {
    data_source: null,
    ai_source: "gpt5Brain.generateCompanyOverview",
    merge_logic: "ai_only",
    output_format: "html"
  },
  industry_competitive: {
    data_source: "dataBroker.fetchCompanyProfile.finnhubIndustry",
    ai_source: "gpt5Brain.generateIndustryAnalysis",
    merge_logic: "data_context_for_ai_generation",
    output_format: "html"
  },
  key_financials_table: {
    data_source: "dataBroker.fetchFundamentals + dataBroker.fetchStockMetrics",
    ai_source: null,
    merge_logic: "data_only",
    output_format: "html"
  },
  financial_trend_chart: {
    data_source: "dataBroker.fetchFundamentals.statements",
    ai_source: null,
    merge_logic: "data_only",
    output_format: "html"
  },
  financials_analysis: {
    data_source: null,
    ai_source: "gpt5Brain.generateFinancialsAnalysis",
    merge_logic: "ai_only",
    output_format: "html"
  },
  peer_comparison_table: {
    data_source: "dataBroker.fetchPeerBenchmarks",
    ai_source: null,
    merge_logic: "data_only",
    output_format: "html"
  },
  price_chart_with_ema: {
    data_source: "dataBroker.fetchHistoricalPrices + technicalLevels.calculateSupportResistance",
    ai_source: null,
    merge_logic: "data_only",
    output_format: "html"
  },
  volume_chart: {
    data_source: "dataBroker.fetchHistoricalPrices.volume",
    ai_source: null,
    merge_logic: "data_only",
    output_format: "html"
  },
  technical_indicators_table: {
    data_source: "dataBroker.fetchTechnicalIndicators",
    ai_source: null,
    merge_logic: "data_only",
    output_format: "html"
  },
  technical_analysis: {
    data_source: null,
    ai_source: "gpt5Brain.generateTechnicalAnalysis",
    merge_logic: "ai_only",
    output_format: "html"
  },
  news_summary: {
    data_source: null,
    ai_source: "gpt5Brain.generateNewsSummary",
    merge_logic: "ai_only",
    output_format: "html"
  },
  risk_analysis: {
    data_source: null,
    ai_source: "gpt5Brain.generateRiskAnalysis",
    merge_logic: "ai_only",
    output_format: "html"
  },
  rating_conclusion: {
    data_source: "dataBroker.fetchMarketData + technicalLevels.calculateSupportResistance",
    ai_source: "gpt5Brain.generateRatingConclusion",
    merge_logic: "ai_with_data_validation",
    output_format: "pdf_section"
  },
  disclaimer: {
    data_source: "system.metadata",
    ai_source: null,
    merge_logic: "data_only",
    output_format: "html"
  }
};

const MODULE_ORDER = [
  'cover',
  'investment_summary',
  'company_overview',
  'industry_competitive',
  'key_financials_table',
  'financial_trend_chart',
  'financials_analysis',
  'peer_comparison_table',
  'price_chart_with_ema',
  'volume_chart',
  'technical_indicators_table',
  'technical_analysis',
  'news_summary',
  'risk_analysis',
  'rating_conclusion',
  'disclaimer'
];

async function collectAllData(symbol) {
  const [marketData, profile, historicalPrices, technicalIndicators, fundamentals, metrics, peerBenchmarks, news] = await Promise.all([
    fetchMarketData([symbol], ['quote']).catch(() => ({ quotes: {} })),
    fetchCompanyProfile(symbol).catch(() => ({ profile: {} })),
    fetchHistoricalPrices(symbol, { months: 12 }).catch(() => []),
    fetchTechnicalIndicators(symbol, '1day').catch(() => ({ technical: {} })),
    fetchFundamentals(symbol).catch(() => ({ fundamentals: {} })),
    fetchStockMetrics(symbol).catch(() => ({ metrics: {} })),
    fetchPeerBenchmarks(symbol, null).catch(() => ({})),
    fetchAndRankNews({ symbols: [symbol], topN: 10 }).catch(() => [])
  ]);

  const quote = marketData.quotes?.[symbol] || {};
  const supportResistance = historicalPrices.length > 0 ? calculateSupportResistance(quote) : { support: null, resistance: null };

  return {
    symbol,
    quote,
    profile: profile.profile || {},
    historicalPrices,
    technicalIndicators: technicalIndicators.technical || {},
    fundamentals: fundamentals.fundamentals || {},
    metrics: metrics.metrics || {},
    peerBenchmarks,
    news,
    supportResistance
  };
}

async function generateAIContent(moduleName, context) {
  const prompts = {
    generateCoreView: `你是资深证券分析师。请为${context.symbol}写一句核心投资观点（20-40字），必须包含催化剂或风险点。当前股价：$${context.quote?.c || 'N/A'}。只输出核心观点。`,
    generateInvestmentSummary: `你是投资分析师，请为${context.symbol}写投资摘要。股价：$${context.quote?.c || 'N/A'}，市值：${formatMarketCap(context.profile?.marketCapitalization)}。请输出JSON格式：{"highlights":["亮点1","亮点2","亮点3"],"risks":["风险1","风险2"],"valuation":"估值判断","view":"中短期观点"}`,
    generateCompanyOverview: `你是行业研究员，请介绍${context.symbol}。行业：${context.profile?.finnhubIndustry || '未知'}。请输出JSON格式：{"business":"主要业务","revenueModel":"商业模式","geography":"主要市场","keyProducts":"核心产品"}`,
    generateIndustryAnalysis: `你是首席行业分析师，请分析${context.symbol}所在行业${context.profile?.finnhubIndustry || ''}。请输出JSON格式：{"industryCycle":"行业周期","keyDrivers":["驱动因素1","驱动因素2"],"industryRisks":["风险1","风险2"],"outlook6_12m":"6-12月展望","competitors":[{"name":"竞争对手1","position":"定位"}],"companyPosition":"公司地位"}`,
    generateFinancialsAnalysis: `你是财务分析师，请分析${context.symbol}的财务与估值。市值：${formatMarketCap(context.profile?.marketCapitalization)}，PE：${context.fundamentals?.ratios?.peRatio || 'N/A'}。请输出JSON格式：{"revenueTrend":"营收趋势","profitability":"盈利能力","valuationView":"估值判断"}`,
    generateTechnicalAnalysis: `你是技术分析师，请分析${context.symbol}。股价：$${context.quote?.c || 'N/A'}，RSI：${context.technicalIndicators?.rsi?.value || 'N/A'}。请输出JSON格式：{"trend":"趋势判断","supportResistanceSummary":"支撑压力","indicators":"指标分析","conclusion":"技术结论"}`,
    generateNewsSummary: `你是新闻分析师，请总结${context.symbol}近期新闻。请输出JSON格式：{"summary":"新闻摘要","keyEvents":["事件1","事件2"],"sentiment":"情绪判断"}`,
    generateRiskAnalysis: `你是风险管理专家，请分析${context.symbol}的投资风险。行业：${context.profile?.finnhubIndustry || '未知'}。请输出JSON格式：{"industryRisks":["行业风险1","行业风险2"],"companyRisks":["公司风险1","公司风险2"],"marketRisks":["市场风险1","市场风险2"]}`,
    generateRatingConclusion: `你是首席分析师，请为${context.symbol}给出投资评级。股价：$${context.quote?.c || 'N/A'}，支撑位：$${context.supportResistance?.support || 'N/A'}，压力位：$${context.supportResistance?.resistance || 'N/A'}。请输出JSON格式：{"ratingCode":"BUY/HOLD/SELL","shortTermView":"短期观点","supportLevel":"支撑位","resistanceLevel":"压力位","breakoutTrigger":"突破触发点","suggestion":"投资建议","investmentSummary":"投资摘要"}`
  };

  const aiMethodMap = {
    cover: 'generateCoreView',
    investment_summary: 'generateInvestmentSummary',
    company_overview: 'generateCompanyOverview',
    industry_competitive: 'generateIndustryAnalysis',
    financials_analysis: 'generateFinancialsAnalysis',
    technical_analysis: 'generateTechnicalAnalysis',
    news_summary: 'generateNewsSummary',
    risk_analysis: 'generateRiskAnalysis',
    rating_conclusion: 'generateRatingConclusion'
  };

  const methodName = aiMethodMap[moduleName];
  if (!methodName || !prompts[methodName]) return null;

  const result = await callModelWithFallback({
    systemPrompt: '你是顶级投行的卖方研究分析师，使用专业、机构级语言。',
    userPrompt: prompts[methodName],
    temperature: 0.6,
    maxTokens: 800,
    scene: 'hybrid_report'
  });

  if (!result.success) return null;

  try {
    const text = result.text.replace(/```json\n?|\n?```/g, '').trim();
    if (text.startsWith('{') || text.startsWith('[')) {
      return JSON.parse(text);
    }
    return { content: text };
  } catch (e) {
    return { content: result.text };
  }
}

function formatMarketCap(marketCap) {
  if (!marketCap || isNaN(marketCap)) return 'N/A';
  const num = Number(marketCap);
  if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}T`;
  if (num >= 1000) return `$${(num / 1000).toFixed(2)}B`;
  if (num >= 1) return `$${num.toFixed(2)}M`;
  return `$${(num * 1000).toFixed(2)}K`;
}

function formatFinancialValue(value) {
  if (!value || isNaN(value)) return 'N/A';
  const num = Number(value);
  const abs = Math.abs(num);
  if (abs >= 1000000000) return `$${(num / 1000000000).toFixed(2)}B`;
  if (abs >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
  if (abs >= 1000) return `$${(num / 1000).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
}

function calculateEMA(prices, period) {
  if (prices.length < period) return [];
  const ema = [];
  const multiplier = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += prices[i];
  ema.push(sum / period);
  for (let i = period; i < prices.length; i++) {
    const value = (prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
    ema.push(value);
  }
  return [...Array(period - 1).fill(null), ...ema];
}

function generatePriceChartURL(historicalPrices, symbol, supportResistance) {
  if (!historicalPrices || historicalPrices.length === 0) return null;
  const recentPrices = historicalPrices.slice(-90);
  const labels = recentPrices.map(p => { const d = new Date(p.date); return `${d.getMonth()+1}/${d.getDate()}`; });
  const closes = recentPrices.map(p => p.close);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const datasets = [{ label: `${symbol}`, data: closes, borderColor: 'rgb(75,192,192)', fill: false, pointRadius: 0, borderWidth: 2 }];
  if (ema20.length > 0) datasets.push({ label: 'EMA20', data: ema20, borderColor: 'rgb(255,159,64)', fill: false, pointRadius: 0, borderWidth: 1.5, borderDash: [5,5] });
  if (ema50.length > 0) datasets.push({ label: 'EMA50', data: ema50, borderColor: 'rgb(153,102,255)', fill: false, pointRadius: 0, borderWidth: 1.5, borderDash: [10,5] });
  if (supportResistance?.support) datasets.push({ label: `Support $${supportResistance.support}`, data: Array(closes.length).fill(Number(supportResistance.support)), borderColor: 'rgb(46,204,113)', fill: false, pointRadius: 0, borderWidth: 1, borderDash: [2,2] });
  if (supportResistance?.resistance) datasets.push({ label: `Resistance $${supportResistance.resistance}`, data: Array(closes.length).fill(Number(supportResistance.resistance)), borderColor: 'rgb(231,76,60)', fill: false, pointRadius: 0, borderWidth: 1, borderDash: [2,2] });
  const chart = new QuickChart();
  chart.setConfig({ type: 'line', data: { labels, datasets }, options: { title: { display: true, text: `${symbol} Price (90D)` }, legend: { display: true, position: 'top' } } });
  chart.setWidth(800).setHeight(400).setBackgroundColor('#ffffff');
  return chart.getUrl();
}

function generateVolumeChartURL(historicalPrices, symbol) {
  if (!historicalPrices || historicalPrices.length === 0) return null;
  const recentPrices = historicalPrices.slice(-90);
  const labels = recentPrices.map(p => { const d = new Date(p.date); return `${d.getMonth()+1}/${d.getDate()}`; });
  const volumes = recentPrices.map(p => p.volume || 0);
  const chart = new QuickChart();
  chart.setConfig({ type: 'bar', data: { labels, datasets: [{ label: 'Volume', data: volumes, backgroundColor: 'rgba(54,162,235,0.6)' }] }, options: { title: { display: true, text: `${symbol} Volume (90D)` }, legend: { display: false } } });
  chart.setWidth(800).setHeight(200).setBackgroundColor('#ffffff');
  return chart.getUrl();
}

function generateFinancialChartURL(fundamentals, symbol) {
  const statements = fundamentals?.statements || [];
  if (statements.length === 0) return null;
  const labels = statements.map(s => s.fiscalDate || 'N/A').reverse();
  const revenues = statements.map(s => (s.revenue || 0) / 1000000).reverse();
  const netIncomes = statements.map(s => (s.netIncome || 0) / 1000000).reverse();
  const chart = new QuickChart();
  chart.setConfig({ type: 'bar', data: { labels, datasets: [{ label: 'Revenue ($M)', data: revenues, backgroundColor: 'rgba(75,192,192,0.6)' }, { label: 'Net Income ($M)', data: netIncomes, backgroundColor: 'rgba(255,99,132,0.6)' }] }, options: { title: { display: true, text: `${symbol} Financials` } } });
  chart.setWidth(800).setHeight(400).setBackgroundColor('#ffffff');
  return chart.getUrl();
}

function renderCoverHTML(data, ai) {
  const coreView = ai?.content || ai?.coreView || '';
  return `<div class="cover"><h1>USIS Hybrid Research Report</h1><div class="company">${data.profile?.name || data.symbol}</div><div class="symbol">${data.profile?.exchange || 'US'}:${data.symbol}</div><div class="price">$${data.quote?.c || 'N/A'} (${data.quote?.dp ? (data.quote.dp > 0 ? '+' : '') + data.quote.dp.toFixed(2) + '%' : 'N/A'})</div><div class="core-view"><strong>核心观点：</strong>${coreView}</div><div class="meta">报告日期：${new Date().toLocaleDateString('zh-CN')}</div></div>`;
}

function renderInvestmentSummaryHTML(data, ai) {
  const highlights = ai?.highlights || [];
  const risks = ai?.risks || [];
  return `<div class="section"><h2>一、投资摘要</h2><div class="highlight-box"><h3>投资亮点</h3><ul>${highlights.map(h => `<li>${h}</li>`).join('')}</ul><h3>关键风险</h3><ul>${risks.map(r => `<li>${r}</li>`).join('')}</ul><p><strong>估值判断：</strong>${ai?.valuation || 'N/A'}</p><p><strong>中短期观点：</strong>${ai?.view || 'N/A'}</p></div></div>`;
}

function renderCompanyOverviewHTML(data, ai) {
  return `<div class="section"><h2>二、公司概况</h2><p><strong>主要业务：</strong>${ai?.business || 'N/A'}</p><p><strong>商业模式：</strong>${ai?.revenueModel || 'N/A'}</p><p><strong>地理市场：</strong>${ai?.geography || 'N/A'}</p><p><strong>核心产品：</strong>${ai?.keyProducts || 'N/A'}</p></div>`;
}

function renderIndustryCompetitiveHTML(data, ai) {
  const competitors = ai?.competitors || [];
  const keyDrivers = ai?.keyDrivers || [];
  const industryRisks = ai?.industryRisks || [];
  return `<div class="section"><h2>三、行业与竞争格局</h2><h3>行业周期</h3><p>${ai?.industryCycle || 'N/A'}</p><h3>关键驱动因素</h3><ul>${keyDrivers.map(d => `<li>${d}</li>`).join('')}</ul><h3>行业风险</h3><ul>${industryRisks.map(r => `<li>${r}</li>`).join('')}</ul><h3>6-12月展望</h3><p>${ai?.outlook6_12m || 'N/A'}</p><h3>主要竞争对手</h3><table><thead><tr><th>公司</th><th>定位</th></tr></thead><tbody>${competitors.map(c => `<tr><td>${c.name}</td><td>${c.position}</td></tr>`).join('')}</tbody></table><h3>公司地位</h3><p>${ai?.companyPosition || 'N/A'}</p></div>`;
}

function renderKeyFinancialsTableHTML(data) {
  const fundamentals = data.fundamentals || {};
  const ratios = fundamentals.ratios || {};
  const statements = fundamentals.statements || [];
  const latestRevenue = statements[0]?.revenue ? formatFinancialValue(statements[0].revenue) : 'N/A';
  const latestNetIncome = statements[0]?.netIncome ? formatFinancialValue(statements[0].netIncome) : 'N/A';
  return `<div class="section"><h2>四、关键财务指标</h2><table><thead><tr><th>指标</th><th>数值</th></tr></thead><tbody><tr><td>营业收入</td><td>${latestRevenue}</td></tr><tr><td>净利润</td><td>${latestNetIncome}</td></tr><tr><td>市值</td><td>${formatMarketCap(ratios.marketCap || data.profile?.marketCapitalization)}</td></tr><tr><td>PE比率</td><td>${ratios.peRatio ? Number(ratios.peRatio).toFixed(2) : 'N/A'}</td></tr><tr><td>净利率</td><td>${ratios.netProfitMarginTTM ? Number(ratios.netProfitMarginTTM).toFixed(2) + '%' : 'N/A'}</td></tr><tr><td>ROE</td><td>${ratios.roeTTM ? Number(ratios.roeTTM).toFixed(2) + '%' : 'N/A'}</td></tr></tbody></table></div>`;
}

function renderFinancialTrendChartHTML(data) {
  const chartURL = generateFinancialChartURL(data.fundamentals, data.symbol);
  if (!chartURL) return `<div class="section"><h3>财务趋势图</h3><p>暂无财务数据</p></div>`;
  return `<div class="section"><h3>财务趋势图</h3><div class="chart-container"><img src="${chartURL}" alt="Financial Trend" style="max-width:100%;"/></div></div>`;
}

function renderFinancialsAnalysisHTML(data, ai) {
  return `<div class="section"><h3>财务分析</h3><p><strong>营收趋势：</strong>${ai?.revenueTrend || 'N/A'}</p><p><strong>盈利能力：</strong>${ai?.profitability || 'N/A'}</p><div class="highlight-box"><p><strong>估值判断：</strong>${ai?.valuationView || 'N/A'}</p></div></div>`;
}

function renderPeerComparisonTableHTML(data) {
  const peerBenchmarks = data.peerBenchmarks || {};
  const peers = peerBenchmarks.peers || [];
  const targetMetrics = peerBenchmarks.targetMetrics || {};
  const benchmarks = peerBenchmarks.benchmarks || {};
  if (peers.length === 0) return `<div class="section"><h2>五、同行对比</h2><p>暂无同行数据</p></div>`;
  return `<div class="section"><h2>五、同行对比</h2><table><thead><tr><th>公司</th><th>PE</th><th>市值</th><th>净利率</th><th>ROE</th></tr></thead><tbody><tr style="background:#e8f5e9;font-weight:bold;"><td>${data.symbol} (目标)</td><td>${targetMetrics.pe ? targetMetrics.pe.toFixed(2) : 'N/A'}</td><td>${formatMarketCap(targetMetrics.marketCap)}</td><td>${targetMetrics.profitMargin ? targetMetrics.profitMargin.toFixed(2) + '%' : 'N/A'}</td><td>${targetMetrics.roe ? targetMetrics.roe.toFixed(2) + '%' : 'N/A'}</td></tr>${peers.map(p => `<tr><td>${p.symbol}</td><td>${p.pe ? p.pe.toFixed(2) : 'N/A'}</td><td>${formatMarketCap(p.marketCap)}</td><td>${p.profitMargin ? p.profitMargin.toFixed(2) + '%' : 'N/A'}</td><td>${p.roe ? p.roe.toFixed(2) + '%' : 'N/A'}</td></tr>`).join('')}<tr style="background:#fff3e0;font-weight:bold;"><td>行业平均</td><td>${benchmarks.avgPE ? benchmarks.avgPE.toFixed(2) : 'N/A'}</td><td>-</td><td>-</td><td>${benchmarks.avgROE ? benchmarks.avgROE.toFixed(2) + '%' : 'N/A'}</td></tr></tbody></table></div>`;
}

function renderPriceChartWithEMAHTML(data) {
  const chartURL = generatePriceChartURL(data.historicalPrices, data.symbol, data.supportResistance);
  if (!chartURL) return `<div class="section"><h2>六、股价走势</h2><p>暂无历史价格数据</p></div>`;
  return `<div class="section"><h2>六、股价走势 + EMA</h2><div class="chart-container"><img src="${chartURL}" alt="Price Chart" style="max-width:100%;"/></div><p>支撑位：$${data.supportResistance?.support || 'N/A'} | 压力位：$${data.supportResistance?.resistance || 'N/A'}</p></div>`;
}

function renderVolumeChartHTML(data) {
  const chartURL = generateVolumeChartURL(data.historicalPrices, data.symbol);
  if (!chartURL) return `<div class="section"><h3>成交量</h3><p>暂无成交量数据</p></div>`;
  return `<div class="section"><h3>成交量趋势</h3><div class="chart-container"><img src="${chartURL}" alt="Volume Chart" style="max-width:100%;"/></div></div>`;
}

function renderTechnicalIndicatorsTableHTML(data) {
  const ti = data.technicalIndicators || {};
  const rsi = ti.rsi?.value;
  const macd = ti.macd;
  const ema = ti.ema?.value;
  const bbands = ti.bbands;
  const rsiSignal = rsi > 70 ? '超买' : rsi < 30 ? '超卖' : '中性';
  const macdTrend = macd?.histogram > 0 ? '多头' : '空头';
  return `<div class="section"><h3>技术指标</h3><table><thead><tr><th>指标</th><th>数值</th><th>信号</th></tr></thead><tbody><tr><td>RSI(14)</td><td>${rsi ? Number(rsi).toFixed(2) : 'N/A'}</td><td>${rsi ? rsiSignal : 'N/A'}</td></tr><tr><td>MACD</td><td>${macd?.macd ? Number(macd.macd).toFixed(2) : 'N/A'}</td><td>${macd ? macdTrend : 'N/A'}</td></tr><tr><td>EMA(20)</td><td>${ema ? '$' + Number(ema).toFixed(2) : 'N/A'}</td><td>${ema && data.quote?.c ? (data.quote.c > ema ? '突破' : '跌破') : 'N/A'}</td></tr><tr><td>布林带上轨</td><td>${bbands?.upper ? '$' + Number(bbands.upper).toFixed(2) : 'N/A'}</td><td>-</td></tr><tr><td>布林带下轨</td><td>${bbands?.lower ? '$' + Number(bbands.lower).toFixed(2) : 'N/A'}</td><td>-</td></tr></tbody></table></div>`;
}

function renderTechnicalAnalysisHTML(data, ai) {
  return `<div class="section"><h3>技术分析</h3><p><strong>趋势：</strong>${ai?.trend || 'N/A'}</p><p><strong>支撑/压力：</strong>${ai?.supportResistanceSummary || 'N/A'}</p><p><strong>指标分析：</strong>${ai?.indicators || 'N/A'}</p><div class="highlight-box"><p><strong>结论：</strong>${ai?.conclusion || 'N/A'}</p></div></div>`;
}

function renderNewsSummaryHTML(data, ai) {
  const keyEvents = ai?.keyEvents || [];
  return `<div class="section"><h2>七、新闻综述</h2><p><strong>摘要：</strong>${ai?.summary || 'N/A'}</p><h3>关键事件</h3><ul>${keyEvents.map(e => `<li>${e}</li>`).join('')}</ul><p><strong>市场情绪：</strong>${ai?.sentiment || 'N/A'}</p></div>`;
}

function renderRiskAnalysisHTML(data, ai) {
  const industryRisks = ai?.industryRisks || [];
  const companyRisks = ai?.companyRisks || [];
  const marketRisks = ai?.marketRisks || [];
  return `<div class="section"><h2>八、风险分析</h2><div class="risk-box"><h3>行业风险</h3><ul>${industryRisks.map(r => `<li>${r}</li>`).join('')}</ul><h3>公司风险</h3><ul>${companyRisks.map(r => `<li>${r}</li>`).join('')}</ul><h3>市场风险</h3><ul>${marketRisks.map(r => `<li>${r}</li>`).join('')}</ul></div></div>`;
}

function renderRatingConclusionHTML(data, ai) {
  const ratingColors = { BUY: '#27ae60', SELL: '#e74c3c', HOLD: '#f39c12' };
  const ratingCode = ai?.ratingCode || 'HOLD';
  const color = ratingColors[ratingCode] || '#f39c12';
  return `<div class="section"><h2>九、评级与结论</h2><div style="text-align:center;margin:20px 0;"><span style="display:inline-block;padding:15px 40px;font-size:24px;font-weight:bold;background:${color};color:white;border-radius:5px;">${ratingCode}</span></div><p><strong>短期观点：</strong>${ai?.shortTermView || 'N/A'}</p><p><strong>支撑位：</strong>$${ai?.supportLevel || 'N/A'} | <strong>压力位：</strong>$${ai?.resistanceLevel || 'N/A'}</p><p><strong>突破触发点：</strong>${ai?.breakoutTrigger || 'N/A'}</p><div class="highlight-box"><p><strong>投资建议：</strong>${ai?.suggestion || 'N/A'}</p></div><h3>投资摘要</h3><p>${ai?.investmentSummary || 'N/A'}</p></div>`;
}

function renderDisclaimerHTML(data) {
  return `<div class="disclaimer"><h3>免责声明</h3><p>本报告由 USIS Brain v7.0 Hybrid AI 系统自动生成，仅供参考，不构成投资建议。投资有风险，入市需谨慎。</p><p>报告日期：${new Date().toLocaleDateString('zh-CN')} | 版本：v7.0-Hybrid | 数据来源：Finnhub, Twelve Data, Alpha Vantage</p></div>`;
}

const RENDER_MAP = {
  cover: renderCoverHTML,
  investment_summary: renderInvestmentSummaryHTML,
  company_overview: renderCompanyOverviewHTML,
  industry_competitive: renderIndustryCompetitiveHTML,
  key_financials_table: renderKeyFinancialsTableHTML,
  financial_trend_chart: renderFinancialTrendChartHTML,
  financials_analysis: renderFinancialsAnalysisHTML,
  peer_comparison_table: renderPeerComparisonTableHTML,
  price_chart_with_ema: renderPriceChartWithEMAHTML,
  volume_chart: renderVolumeChartHTML,
  technical_indicators_table: renderTechnicalIndicatorsTableHTML,
  technical_analysis: renderTechnicalAnalysisHTML,
  news_summary: renderNewsSummaryHTML,
  risk_analysis: renderRiskAnalysisHTML,
  rating_conclusion: renderRatingConclusionHTML,
  disclaimer: renderDisclaimerHTML
};

async function processModule(moduleName, config, allData) {
  const result = { name: moduleName, html: '', data: null, ai: null };

  if (config.merge_logic === 'data_only') {
    result.data = allData;
    result.html = RENDER_MAP[moduleName] ? RENDER_MAP[moduleName](allData, null) : '';
  } else if (config.merge_logic === 'ai_only') {
    result.ai = await generateAIContent(moduleName, allData);
    result.html = RENDER_MAP[moduleName] ? RENDER_MAP[moduleName](allData, result.ai) : '';
  } else if (config.merge_logic === 'data_first_then_ai_inject' || config.merge_logic === 'data_context_for_ai_generation' || config.merge_logic === 'ai_with_data_validation') {
    result.data = allData;
    result.ai = await generateAIContent(moduleName, allData);
    result.html = RENDER_MAP[moduleName] ? RENDER_MAP[moduleName](allData, result.ai) : '';
  }

  return result;
}

async function generateHybridReport(symbol, options = {}) {
  console.log(`\n📊 [HybridReport] 开始生成混合研报: ${symbol}`);
  const startTime = Date.now();

  const allData = await collectAllData(symbol);
  console.log(`   ✅ 数据收集完成`);

  const modules = [];

  for (const moduleName of MODULE_ORDER) {
    const config = MODULE_PIPELINE[moduleName];
    console.log(`   ├─ 处理模块: ${moduleName} (${config.merge_logic})`);
    const moduleResult = await processModule(moduleName, config, allData);
    modules.push(moduleResult);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✅ [HybridReport] 混合研报生成完成 (${duration}s)`);

  return {
    symbol,
    date: new Date().toISOString(),
    duration: parseFloat(duration),
    modules
  };
}

module.exports = {
  generateHybridReport,
  MODULE_PIPELINE,
  MODULE_ORDER
};
