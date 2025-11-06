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
    return `作为顶级金融分析师，基于以下多维数据生成专业的热力图分析报告：

【市场概况】
- 指数: ${context.market.index.symbol} 
- 当前价格: ${context.market.index.price} (${context.market.index.change >= 0 ? '+' : ''}${context.market.index.changePercent}%)
- 市场广度: 上涨${context.market.breadth.advances}家, 下跌${context.market.breadth.declines}家

【视觉分析洞察】
${context.visual.rawInsights}

【实时数据验证】
${this.formatMarketData(context.market)}

【宏观经济背景】
${this.formatEconomicData(context.economics)}

【新闻情绪分析】
${this.formatNewsData(context.news)}

【专业分析要求】
1. 识别3个关键交易机会
2. 评估市场风险等级(1-5级)
3. 给出具体板块配置建议
4. 提供技术位分析
5. 短期(1-3天)市场展望

请以专业机构研报格式输出，包含数据支撑的具体观点。`;
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
    return {
      title: `📊 ${context.market.index.symbol} 热力图深度分析报告`,
      executiveSummary: this.extractExecutiveSummary(analysis),
      marketOverview: this.formatMarketOverview(context.market),
      sectorAnalysis: this.formatSectorAnalysis(context.visual.sectors, context.market.sectors),
      technicalAnalysis: this.formatTechnicalAnalysis(context.market.technicals),
      tradingOpportunities: this.extractTradingOpportunities(analysis),
      riskAssessment: context.synthesis.riskLevel,
      outlook: this.extractOutlook(analysis),
      dataConfidence: `${context.synthesis.confidence.toFixed(1)}%`,
      timestamp: new Date().toISOString(),
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
      title: `📊 ${context.market.index.symbol} 热力图分析报告`,
      executiveSummary: '基于视觉分析和市场数据的综合评估',
      marketOverview: this.formatMarketOverview(context.market),
      sectorAnalysis: this.formatSectorAnalysis(context.visual.sectors, context.market.sectors),
      dataSources: '视觉分析 + 实时市场数据 + 宏观经济指标',
      confidence: '数据验证中',
      timestamp: new Date().toISOString(),
      note: 'AI分析服务暂时不可用，此为基于数据的直接分析'
    };
  }
}

module.exports = ProfessionalReporter;
