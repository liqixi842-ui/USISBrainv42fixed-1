// professionalReporter.js - 专业报告生成
const { generateWithGPT5 } = require('./gpt5Brain');

class ProfessionalReporter {
  constructor() {
    this.gpt5Brain = { generateWithGPT5 };
  }

  async generateHeatmapAnalysisReport(visualAnalysis, marketData, economicData, newsData) {
    const analysisContext = this.buildAnalysisContext(visualAnalysis, marketData, economicData, newsData);
    
    const prompt = this.buildProfessionalPrompt(analysisContext);
    
    try {
      const analysis = await generateWithGPT5({
        text: prompt,
        marketData: {},
        semanticIntent: { action: 'heatmap_analysis', symbols: [] },
        mode: 'analysis',
        scene: 'intraday',
        symbols: []
      });
      
      return this.formatProfessionalReport(analysis.text || analysis, analysisContext);
    } catch (error) {
      return this.generateFallbackReport(analysisContext);
    }
  }

  buildAnalysisContext(visualAnalysis, marketData, economicData, newsData) {
    return {
      visual: {
        sectors: visualAnalysis.sectors,
        metrics: visualAnalysis.metrics,
        rawInsights: visualAnalysis.rawAnalysis
      },
      
      market: {
        index: marketData.index,
        components: marketData.components,
        sectors: marketData.sectors,
        breadth: marketData.marketBreadth,
        technicals: marketData.technicals
      },
      
      economics: economicData,
      
      news: {
        articles: newsData.articles,
        sentiment: this.aggregateNewsSentiment(newsData.articles),
        totalResults: newsData.totalResults
      },
      
      synthesis: this.synthesizeData(visualAnalysis, marketData, economicData, newsData)
    };
  }

  buildProfessionalPrompt(context) {
    const adRatio = context.market.breadth?.advanceDeclineRatio || 0;
    const advPct = context.market.breadth?.advancePercentage || 0;
    
    return `作为机构研究部首席策略分析师，撰写${context.market.index.symbol}盘中策略报告（Morgan Stanley/Goldman Sachs标准）：

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 EXECUTIVE SUMMARY（执行摘要）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
指数: ${context.market.index.symbol} | 价格: ${context.market.index.price || 'N/A'} (${context.market.index.change >= 0 ? '+' : ''}${context.market.index.changePercent || 0}%)
市场广度: Advance ${context.market.breadth?.advances || 0} vs Decline ${context.market.breadth?.declines || 0} (A/D Ratio: ${adRatio.toFixed(2)})
广度健康度: ${advPct.toFixed(1)}% 成分股参与上行

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔬 TECHNICAL HEATMAP ANALYSIS（技术面热力图解读）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${context.visual.rawInsights}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 MARKET MICROSTRUCTURE（市场微观结构）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${this.formatMarketData(context.market)}

波动率指标: ${(context.market.technicals?.volatility || 0).toFixed(2)}% (${(context.market.technicals?.volatility || 0) > 2 ? '高波动环境' : '正常波动区间'})
涨跌幅分布: 最大涨幅${(context.market.technicals?.maxGain || 0).toFixed(2)}% vs 最大跌幅${(context.market.technicals?.maxLoss || 0).toFixed(2)}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌍 MACRO BACKDROP（宏观经济背景）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${this.formatEconomicData(context.economics)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📰 NEWS SENTIMENT GAUGE（新闻情绪指标）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${this.formatNewsData(context.news)}
情绪倾向: ${context.news.sentiment.toUpperCase()} (${context.news.totalResults} articles scanned)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 INSTITUTIONAL RESEARCH OUTPUT（机构研究结论）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
请按以下五大模块输出：

【I. MARKET OVERVIEW & INDEX PERFORMANCE】市场概览与指数表现
- 开盘至今价格行为特征（Price Action Profile）
- 成交量能结构分析（Volume Profile Analysis）
- 指数技术形态判断（Technical Pattern Recognition）

【II. SECTOR ROTATION DYNAMICS】板块轮动特征分析
- 领涨板块及持续性评估（Leading Sectors & Sustainability）
- 承压板块及反弹概率（Lagging Sectors & Reversal Probability）
- 板块相对强弱排序（Relative Strength Ranking）

【III. INDIVIDUAL STOCK DEEP DIVE】个股异动深度解读
- Top 3 催化剂驱动个股（Catalyst-Driven Movers）
- 基本面vs技术面一致性验证（Fundamental-Technical Alignment）
- 异常波动标的风险评估（Outlier Risk Assessment）

【IV. CAPITAL FLOW & TECHNICAL ANALYSIS】资金流向与技术面分析
- 主力资金净流向推断（Institutional Flow Inference）
- 关键支撑/阻力位定位（Key Support/Resistance Levels）
- 短期趋势强度打分（Momentum Score 1-10）

【V. TRADING STRATEGY & RISK MANAGEMENT】交易策略与风险管理
- 3个高确定性交易机会（High-Conviction Setups）
- 风险等级评估（Risk Rating: 1=Conservative → 5=Aggressive）
- 1-3日市场展望（1-3 Day Outlook）
- 止损止盈位建议（Risk/Reward Targets）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
写作要求：
✅ 使用机构研报标准术语（避免"红色板块"等视觉描述）
✅ 所有观点必须有数据支撑（引用具体数值）
✅ 采用客观严谨的分析师语气（非散户化表达）
✅ 突出逻辑推理链条（因果关系清晰）
✅ 提供可执行的交易指引（具体价格位/百分比）

术语规范：
❌ "红色板块较多" → ✅ "空头压力集中于XX板块"
❌ "绿色板块表现好" → ✅ "XX板块获得增量资金青睐"
❌ "颜色深浅" → ✅ "价格波动幅度差异显著"
❌ "看着很难受" → ✅ "技术面呈现明显承压特征"`;
  }

  formatMarketData(marketData) {
    const topGainers = marketData.components
      .filter(c => c.changePercent > 0)
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, 3);
      
    const topLosers = marketData.components
      .filter(c => c.changePercent < 0)
      .sort((a, b) => a.changePercent - b.changePercent)
      .slice(0, 3);
    
    return `领涨股: ${topGainers.map(s => `${s.symbol} +${s.changePercent.toFixed(2)}%`).join(', ')}
领跌股: ${topLosers.map(s => `${s.symbol} ${s.changePercent.toFixed(2)}%`).join(', ')}
板块表现: ${marketData.sectors.map(s => `${s.sector}: ${s.change}%`).join(', ')}`;
  }

  formatEconomicData(economicData) {
    return economicData.map(e => `${e.indicator}: ${e.value}${e.unit}`).join('\n');
  }

  formatNewsData(newsData) {
    const sentimentCount = {
      positive: newsData.articles.filter(a => a.sentiment === 'positive').length,
      negative: newsData.articles.filter(a => a.sentiment === 'negative').length,
      neutral: newsData.articles.filter(a => a.sentiment === 'neutral').length
    };
    
    return `新闻情绪: 正面${sentimentCount.positive}篇, 负面${sentimentCount.negative}篇, 中性${sentimentCount.neutral}篇
关键标题: ${newsData.articles.slice(0, 3).map(a => a.title).join(' | ')}`;
  }

  synthesizeData(visualAnalysis, marketData, economicData, newsData) {
    const synthesis = {
      confidence: 0,
      keyInsights: [],
      riskLevel: 3,
      opportunities: []
    };
    
    const visualSectors = visualAnalysis.sectors.map(s => s.name);
    const actualSectors = marketData.sectors.map(s => s.sector);
    const sectorOverlap = visualSectors.filter(s => actualSectors.includes(s));
    
    synthesis.confidence = (sectorOverlap.length / Math.max(visualSectors.length, 1)) * 100;
    
    if (marketData.breadth.advancePercentage > 60) {
      synthesis.keyInsights.push('市场广度健康，上涨股票占比超过60%');
    }
    
    if (newsData.sentiment === 'positive' && marketData.index.changePercent > 0) {
      synthesis.keyInsights.push('新闻情绪与价格走势一致，信心较强');
    }
    
    if (marketData.technicals.volatility > 2) {
      synthesis.riskLevel = 4;
    } else if (economicData.some(e => e.indicator.includes('Unemployment') && parseFloat(e.value) > 8)) {
      synthesis.riskLevel = 4;
    }
    
    return synthesis;
  }

  aggregateNewsSentiment(articles) {
    const sentiments = articles.map(a => a.sentiment);
    const positiveCount = sentiments.filter(s => s === 'positive').length;
    const negativeCount = sentiments.filter(s => s === 'negative').length;
    
    return positiveCount > negativeCount ? 'positive' :
           negativeCount > positiveCount ? 'negative' : 'neutral';
  }

  formatProfessionalReport(analysis, context) {
    const reportSections = this.parseInstitutionalReport(analysis);
    
    return {
      reportType: 'INSTITUTIONAL_HEATMAP_ANALYSIS',
      
      header: {
        title: `${context.market.index.symbol} 盘中策略报告`,
        subtitle: 'Intraday Tactical Strategy Report',
        analyst: 'USIS Brain Quantitative Research',
        timestamp: new Date().toISOString(),
        dataConfidence: `${context.synthesis.confidence.toFixed(1)}%`,
        riskRating: this.formatRiskRating(context.synthesis.riskLevel)
      },
      
      executiveSummary: {
        headline: this.extractHeadline(analysis),
        keyTakeaways: this.extractKeyTakeaways(analysis),
        marketCondition: this.assessMarketCondition(context),
        urgency: this.assessUrgency(context)
      },
      
      section1_marketOverview: {
        title: 'I. MARKET OVERVIEW & INDEX PERFORMANCE',
        indexMetrics: this.formatIndexMetrics(context.market),
        priceAction: reportSections.marketOverview || this.generateMarketOverviewFallback(context),
        volumeProfile: this.analyzeVolumeProfile(context.market),
        technicalPattern: this.identifyTechnicalPattern(context.market)
      },
      
      section2_sectorRotation: {
        title: 'II. SECTOR ROTATION DYNAMICS',
        leadingSectors: this.identifyLeadingSectors(context.visual.sectors, context.market.sectors),
        laggingSectors: this.identifyLaggingSectors(context.visual.sectors, context.market.sectors),
        rotationPhase: reportSections.sectorRotation || this.assessRotationPhase(context),
        relativeStrength: this.rankSectorStrength(context.market.sectors)
      },
      
      section3_stockDeepDive: {
        title: 'III. INDIVIDUAL STOCK DEEP DIVE',
        catalystDriven: this.identifyCatalystStocks(context.market.components, context.news),
        topMovers: this.analyzeTopMovers(context.market.components),
        outlierRisks: reportSections.stockDeepDive || this.assessOutlierRisks(context)
      },
      
      section4_technicalFlow: {
        title: 'IV. CAPITAL FLOW & TECHNICAL ANALYSIS',
        flowInference: this.inferCapitalFlow(context),
        keyLevels: this.identifyKeyLevels(context.market),
        momentumScore: this.calculateMomentumScore(context.market),
        technicalNarrative: reportSections.technicalAnalysis || '基于市场微观结构推断'
      },
      
      section5_tradingStrategy: {
        title: 'V. TRADING STRATEGY & RISK MANAGEMENT',
        highConvictionSetups: reportSections.tradingOpportunities || this.generateTradingSetups(context),
        riskManagement: this.formatRiskManagement(context),
        outlook_1to3days: reportSections.outlook || this.generate1to3DayOutlook(context),
        riskRewardTargets: this.calculateRiskRewardTargets(context.market)
      },
      
      metadata: {
        dataSources: ['Vision AI (GPT-4o)', 'Finnhub Real-time', 'FRED Economic', 'NewsAPI Sentiment'],
        analysisMode: 'Enhanced',
        confidenceScore: context.synthesis.confidence,
        generatedAt: new Date().toISOString()
      },
      
      rawAnalysis: analysis
    };
  }

  extractExecutiveSummary(analysis) {
    const sentences = analysis.split(/[.!?]+/);
    return sentences.slice(0, 3).join('. ') + '.';
  }

  formatMarketOverview(marketData) {
    return {
      indexPerformance: `${marketData.index.symbol}: ${marketData.index.price} (${marketData.index.change >= 0 ? '+' : ''}${marketData.index.changePercent}%)`,
      marketBreadth: `上涨${marketData.breadth.advances} / 下跌${marketData.breadth.declines} / 平盘${marketData.breadth.unchanged}`,
      volume: `成交量: ${marketData.index.volume?.toLocaleString() || 'N/A'}`,
      volatility: `波动率: ${marketData.technicals.volatility.toFixed(2)}%`
    };
  }

  formatSectorAnalysis(visualSectors, actualSectors) {
    const sectors = visualSectors.map(vs => {
      const actual = actualSectors.find(as => as.sector === vs.name);
      return {
        name: vs.name,
        visualTrend: vs.trend,
        visualChange: vs.change,
        actualChange: actual?.change || null,
        consistency: actual ? Math.abs(vs.change - actual.change) < 1 : false
      };
    });
    
    return sectors;
  }

  formatTechnicalAnalysis(technicals) {
    return {
      averageChange: `${technicals.averageChange.toFixed(2)}%`,
      maxGain: `+${technicals.maxGain.toFixed(2)}%`,
      maxLoss: `${technicals.maxLoss.toFixed(2)}%`,
      volatility: `${technicals.volatility.toFixed(2)}%`
    };
  }

  extractTradingOpportunities(analysis) {
    const opportunityRegex = /(关注|建议|机会|推荐)[^。！？]+[。！？]/g;
    const matches = analysis.match(opportunityRegex) || [];
    return matches.slice(0, 3);
  }

  extractOutlook(analysis) {
    const outlookRegex = /(预计|预期|展望|前景)[^。！？]+[。！？]/g;
    const matches = analysis.match(outlookRegex) || [];
    return matches[0] || '市场展望需结合更多数据判断';
  }

  generateFallbackReport(context) {
    return {
      reportType: 'INSTITUTIONAL_HEATMAP_ANALYSIS',
      header: {
        title: `${context.market.index.symbol} 盘中策略报告`,
        subtitle: 'Data-Driven Tactical Analysis (AI Service Unavailable)',
        analyst: 'USIS Brain Quantitative Research',
        timestamp: new Date().toISOString(),
        dataConfidence: `${context.synthesis.confidence.toFixed(1)}%`,
        riskRating: this.formatRiskRating(context.synthesis.riskLevel)
      },
      executiveSummary: {
        headline: '基于视觉分析和实时市场数据的综合评估',
        marketCondition: this.assessMarketCondition(context),
        note: 'AI分析引擎暂时不可用，以下为基于多维数据的直接分析'
      },
      marketOverview: this.formatMarketOverview(context.market),
      sectorAnalysis: this.formatSectorAnalysis(context.visual.sectors, context.market.sectors),
      dataSources: ['Vision AI', 'Finnhub Real-time', 'FRED Economic', 'NewsAPI Sentiment'],
      metadata: {
        analysisMode: 'Data-Only (AI Fallback)',
        generatedAt: new Date().toISOString()
      }
    };
  }
  
  parseInstitutionalReport(analysis) {
    const sections = {
      marketOverview: '',
      sectorRotation: '',
      stockDeepDive: '',
      technicalAnalysis: '',
      tradingOpportunities: '',
      outlook: ''
    };
    
    const sectionMatches = {
      marketOverview: /【I\.\s*MARKET OVERVIEW[^】]*】([^【]+)/i,
      sectorRotation: /【II\.\s*SECTOR ROTATION[^】]*】([^【]+)/i,
      stockDeepDive: /【III\.\s*INDIVIDUAL STOCK[^】]*】([^【]+)/i,
      technicalAnalysis: /【IV\.\s*CAPITAL FLOW[^】]*】([^【]+)/i,
      tradingOpportunities: /【V\.\s*TRADING STRATEGY[^】]*】([^【]+)/i,
      outlook: /(1-3[日天]市场展望|outlook)[^。！？]*[。！？]/i
    };
    
    for (const [key, regex] of Object.entries(sectionMatches)) {
      const match = analysis.match(regex);
      if (match) {
        sections[key] = match[1] || match[0];
      }
    }
    
    return sections;
  }
  
  formatRiskRating(riskLevel) {
    const ratings = {
      1: 'CONSERVATIVE (低风险)',
      2: 'MODERATE-LOW (中低风险)',
      3: 'MODERATE (中等风险)',
      4: 'MODERATE-HIGH (中高风险)',
      5: 'AGGRESSIVE (高风险)'
    };
    return ratings[riskLevel] || 'MODERATE';
  }
  
  extractHeadline(analysis) {
    const sentences = analysis.split(/[。！？]/);
    return sentences[0] || '市场呈现分化特征';
  }
  
  extractKeyTakeaways(analysis) {
    const takeaways = [];
    const bulletRegex = /[-•]\s*([^。！？\n]+)/g;
    let match;
    while ((match = bulletRegex.exec(analysis)) && takeaways.length < 3) {
      takeaways.push(match[1].trim());
    }
    return takeaways.length > 0 ? takeaways : ['数据综合分析中'];
  }
  
  assessMarketCondition(context) {
    const advanceRatio = context.market.breadth.advancePercentage;
    if (advanceRatio > 70) return 'RISK-ON (普涨行情)';
    if (advanceRatio < 30) return 'RISK-OFF (普跌行情)';
    return 'MIXED (分化行情)';
  }
  
  assessUrgency(context) {
    if (context.market.technicals.volatility > 3) return 'HIGH';
    if (Math.abs(context.market.index.changePercent) > 2) return 'MEDIUM';
    return 'LOW';
  }
  
  formatIndexMetrics(marketData) {
    return {
      symbol: marketData.index.symbol,
      price: marketData.index.price,
      change: `${marketData.index.change >= 0 ? '+' : ''}${marketData.index.changePercent}%`,
      volume: marketData.index.volume?.toLocaleString() || 'N/A',
      marketBreadth: `A:${marketData.breadth.advances} / D:${marketData.breadth.declines} / U:${marketData.breadth.unchanged}`
    };
  }
  
  analyzeVolumeProfile(marketData) {
    const avgVolume = marketData.index.volume || 0;
    return avgVolume > 0 ? `成交量: ${avgVolume.toLocaleString()}` : '成交量数据暂缺';
  }
  
  identifyTechnicalPattern(marketData) {
    if (marketData.technicals.volatility > 3) return '高波动震荡';
    if (marketData.index.changePercent > 1.5) return '强势上行';
    if (marketData.index.changePercent < -1.5) return '弱势下行';
    return '窄幅整理';
  }
  
  identifyLeadingSectors(visualSectors, actualSectors) {
    return actualSectors
      .filter(s => s.change > 0)
      .sort((a, b) => b.change - a.change)
      .slice(0, 3)
      .map(s => `${s.sector}: +${s.change.toFixed(2)}%`);
  }
  
  identifyLaggingSectors(visualSectors, actualSectors) {
    return actualSectors
      .filter(s => s.change < 0)
      .sort((a, b) => a.change - b.change)
      .slice(0, 3)
      .map(s => `${s.sector}: ${s.change.toFixed(2)}%`);
  }
  
  assessRotationPhase(context) {
    const leadingCount = context.market.sectors.filter(s => s.change > 0).length;
    const totalSectors = context.market.sectors.length;
    const ratio = leadingCount / totalSectors;
    
    if (ratio > 0.7) return '板块轮动呈现普涨特征';
    if (ratio < 0.3) return '板块轮动呈现普跌特征';
    return '板块轮动呈现分化特征';
  }
  
  rankSectorStrength(sectors) {
    return sectors
      .sort((a, b) => b.change - a.change)
      .map((s, i) => `#${i+1} ${s.sector}: ${s.change >= 0 ? '+' : ''}${s.change.toFixed(2)}%`);
  }
  
  identifyCatalystStocks(components, newsData) {
    const topMovers = components
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
      .slice(0, 3);
    
    return topMovers.map(stock => {
      const newsMatch = newsData.articles.find(a => a.title.includes(stock.symbol));
      return {
        symbol: stock.symbol,
        change: `${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%`,
        catalyst: newsMatch ? newsMatch.title : '技术性波动'
      };
    });
  }
  
  analyzeTopMovers(components) {
    const gainers = components.filter(c => c.changePercent > 0).sort((a, b) => b.changePercent - a.changePercent).slice(0, 3);
    const losers = components.filter(c => c.changePercent < 0).sort((a, b) => a.changePercent - b.changePercent).slice(0, 3);
    
    return {
      topGainers: gainers.map(s => `${s.symbol}: +${s.changePercent.toFixed(2)}%`),
      topLosers: losers.map(s => `${s.symbol}: ${s.changePercent.toFixed(2)}%`)
    };
  }
  
  assessOutlierRisks(context) {
    const volatility = context.market.technicals.volatility;
    if (volatility > 3) return '高波动环境下异常波动标的风险加大';
    return '正常波动区间内异常波动风险可控';
  }
  
  inferCapitalFlow(context) {
    const netFlow = context.market.breadth.advances - context.market.breadth.declines;
    if (netFlow > 50) return '资金呈现净流入特征';
    if (netFlow < -50) return '资金呈现净流出特征';
    return '资金流向处于均衡状态';
  }
  
  identifyKeyLevels(marketData) {
    const price = marketData.index.price;
    const volatility = marketData.technicals.volatility;
    
    return {
      support: (price * (1 - volatility / 100)).toFixed(2),
      resistance: (price * (1 + volatility / 100)).toFixed(2)
    };
  }
  
  calculateMomentumScore(marketData) {
    let score = 5;
    if (marketData.index.changePercent > 1) score += 2;
    if (marketData.index.changePercent < -1) score -= 2;
    if (marketData.breadth.advancePercentage > 60) score += 1;
    if (marketData.breadth.advancePercentage < 40) score -= 1;
    if (marketData.technicals.volatility > 2) score -= 1;
    
    return Math.max(1, Math.min(10, score));
  }
  
  generateTradingSetups(context) {
    const setups = [];
    
    if (context.market.breadth.advancePercentage > 60) {
      setups.push('做多领涨板块龙头股，设置移动止损保护利润');
    }
    
    if (context.market.technicals.volatility > 2.5) {
      setups.push('高波动环境下减少仓位，采用区间交易策略');
    }
    
    if (context.news.sentiment === 'positive' && context.market.index.changePercent > 0) {
      setups.push('新闻情绪与价格走势共振，可适度追涨强势标的');
    }
    
    return setups.length > 0 ? setups : ['等待更明确的交易信号'];
  }
  
  formatRiskManagement(context) {
    return {
      riskLevel: this.formatRiskRating(context.synthesis.riskLevel),
      positionSizing: context.synthesis.riskLevel > 3 ? '建议降低仓位至50%以下' : '可维持正常仓位',
      stopLoss: `建议设置${context.market.technicals.volatility.toFixed(1)}%的止损位`
    };
  }
  
  generate1to3DayOutlook(context) {
    const momentum = this.calculateMomentumScore(context.market);
    if (momentum > 7) return '短期趋势向上，预计延续强势特征';
    if (momentum < 4) return '短期趋势向下，预计延续弱势特征';
    return '短期趋势不明确，预计维持震荡格局';
  }
  
  calculateRiskRewardTargets(marketData) {
    const keyLevels = this.identifyKeyLevels(marketData);
    const currentPrice = marketData.index.price;
    
    return {
      entryZone: `${(currentPrice * 0.995).toFixed(2)} - ${(currentPrice * 1.005).toFixed(2)}`,
      target: keyLevels.resistance,
      stopLoss: keyLevels.support,
      riskRewardRatio: '1:2 (推荐)'
    };
  }
  
  generateMarketOverviewFallback(context) {
    return `${context.market.index.symbol}当前交易于${context.market.index.price}，日内${context.market.index.change >= 0 ? '上涨' : '下跌'}${Math.abs(context.market.index.changePercent)}%。市场广度显示${context.market.breadth.advances}家成分股上涨，${context.market.breadth.declines}家下跌，呈现${this.assessMarketCondition(context)}特征。`;
  }
}

module.exports = ProfessionalReporter;
