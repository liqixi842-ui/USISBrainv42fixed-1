// enhancedDataBroker.js - 增强数据经纪人
const axios = require('axios');

class EnhancedDataBroker {
  constructor() {
    this.finnhubKey = process.env.FINNHUB_API_KEY;
    this.fredKey = process.env.FRED_API_KEY;
    this.newsKey = process.env.NEWS_API_KEY;
  }

  async fetchComprehensiveMarketData(index, region, sector = null) {
    try {
      const [indexData, components, sectorData, economicData, newsData] = await Promise.all([
        this.fetchIndexData(index),
        this.fetchIndexComponents(index),
        this.fetchSectorPerformance(region, sector),
        this.fetchEconomicIndicators(region),
        this.fetchSectorNews(region, sector)
      ]);

      return {
        index: indexData,
        components: components,
        sectors: sectorData,
        economics: economicData,
        news: newsData,
        marketBreadth: this.calculateMarketBreadth(components),
        technicals: this.calculateTechnicalIndicators(components)
      };
    } catch (error) {
      console.error('Data fetch failed:', error);
      throw new Error(`数据获取失败: ${error.message}`);
    }
  }

  async fetchIndexData(index) {
    const response = await axios.get(`https://finnhub.io/api/v1/quote?symbol=${index}&token=${this.finnhubKey}`);
    return {
      symbol: index,
      price: response.data.c,
      change: response.data.d,
      changePercent: response.data.dp,
      high: response.data.h,
      low: response.data.l,
      volume: response.data.v,
      timestamp: new Date(response.data.t * 1000)
    };
  }

  async fetchIndexComponents(index) {
    const symbols = this.getIndexSymbols(index);
    
    const componentData = await Promise.all(
      symbols.map(async symbol => {
        try {
          const quote = await axios.get(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${this.finnhubKey}`);
          const profile = await axios.get(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${this.finnhubKey}`);
          
          return {
            symbol: symbol,
            name: profile.data.name,
            price: quote.data.c,
            change: quote.data.d,
            changePercent: quote.data.dp,
            volume: quote.data.v,
            marketCap: profile.data.marketCapitalization,
            sector: profile.data.finnhubIndustry,
            timestamp: new Date(quote.data.t * 1000)
          };
        } catch (error) {
          console.warn(`Failed to fetch data for ${symbol}:`, error.message);
          return null;
        }
      })
    );

    return componentData.filter(Boolean);
  }

  async fetchSectorPerformance(region, sector) {
    const response = await axios.get(`https://finnhub.io/api/v1/stock/sector?token=${this.finnhubKey}`);
    
    const regionalSectors = response.data.filter(s => 
      s.region === this.mapRegionToCode(region)
    );
    
    return sector ? 
      regionalSectors.filter(s => s.sector === sector) :
      regionalSectors;
  }

  async fetchEconomicIndicators(region) {
    const indicators = this.getRegionalIndicators(region);
    
    const economicData = await Promise.all(
      indicators.map(async indicator => {
        try {
          const response = await axios.get(
            `https://api.stlouisfed.org/fred/series/observations?series_id=${indicator.id}&api_key=${this.fredKey}&file_type=json&sort_order=desc&limit=1`
          );
          
          return {
            indicator: indicator.name,
            value: response.data.observations[0]?.value,
            date: response.data.observations[0]?.date,
            unit: indicator.unit
          };
        } catch (error) {
          console.warn(`Failed to fetch ${indicator.name}:`, error.message);
          return null;
        }
      })
    );

    return economicData.filter(Boolean);
  }

  async fetchSectorNews(region, sector) {
    const query = sector ? `${sector} ${this.mapRegionToName(region)}` : this.mapRegionToName(region);
    
    const response = await axios.get(`https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&apiKey=${this.newsKey}`);
    
    return {
      articles: response.data.articles.slice(0, 10).map(article => ({
        title: article.title,
        description: article.description,
        url: article.url,
        publishedAt: article.publishedAt,
        source: article.source.name,
        sentiment: this.analyzeSentiment(article.title + ' ' + article.description)
      })),
      totalResults: response.data.totalResults
    };
  }

  calculateMarketBreadth(components) {
    if (!components || components.length === 0) {
      return {
        advances: 0,
        declines: 0,
        unchanged: 0,
        advanceDeclineRatio: 0,
        advancePercentage: 0
      };
    }
    
    const advances = components.filter(c => c.change > 0).length;
    const declines = components.filter(c => c.change < 0).length;
    const unchanged = components.filter(c => c.change === 0).length;
    
    return {
      advances,
      declines, 
      unchanged,
      advanceDeclineRatio: advances / (declines || 1),
      advancePercentage: (advances / components.length) * 100
    };
  }

  calculateTechnicalIndicators(components) {
    const changes = components.map(c => c.changePercent).filter(Boolean);
    
    if (!changes || changes.length === 0) {
      return {
        averageChange: 0,
        maxGain: 0,
        maxLoss: 0,
        volatility: 0
      };
    }
    
    return {
      averageChange: changes.reduce((a, b) => a + b, 0) / changes.length,
      maxGain: Math.max(...changes),
      maxLoss: Math.min(...changes),
      volatility: this.calculateVolatility(changes)
    };
  }

  getIndexSymbols(index) {
    const symbolMap = {
      'IBEX35': ['SAN.MC', 'BBVA.MC', 'ITX.MC', 'TEF.MC', 'REP.MC', 'CABK.MC', 'ENG.MC', 'IAG.MC', 'FER.MC', 'GRF.MC'],
      'NIKKEI225': ['7203.T', '6758.T', '6861.T', '8306.T', '9433.T', '9984.T', '9432.T', '7267.T', '4502.T', '6098.T'],
      'DAX40': ['SAP.DE', 'SIE.DE', 'ALV.DE', 'DTE.DE', 'ADS.DE', 'VOW3.DE', 'DBK.DE', 'BMW.DE', 'BAYN.DE', 'BAS.DE'],
      'SPX500': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'JPM', 'V'],
      'NASDAQ100': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'AVGO', 'COST', 'NFLX'],
      'HSI': ['0700.HK', '9988.HK', '0941.HK', '0388.HK', '2318.HK', '1299.HK', '0005.HK', '9618.HK', '1398.HK', '3690.HK']
    };
    
    return symbolMap[index] || [];
  }

  mapRegionToCode(region) {
    const regionMap = {
      'ES': 'EU',
      'JP': 'AS', 
      'DE': 'EU',
      'US': 'NA'
    };
    return regionMap[region] || 'GLOBAL';
  }

  mapRegionToName(region) {
    const nameMap = {
      'ES': 'Spain',
      'JP': 'Japan',
      'DE': 'Germany', 
      'US': 'United States'
    };
    return nameMap[region] || region;
  }

  getRegionalIndicators(region) {
    const indicatorMap = {
      'ES': [
        { id: 'CLVMNACSCAB1GQES', name: 'GDP Growth', unit: '%' },
        { id: 'CPHPTT01ESM659N', name: 'Inflation Rate', unit: '%' },
        { id: 'LRUN64TTESQ156S', name: 'Unemployment Rate', unit: '%' }
      ],
      'JP': [
        { id: 'JPNRGDPEXP', name: 'GDP Growth', unit: '%' },
        { id: 'JPNCPIALLQINMEI', name: 'Inflation Rate', unit: '%' },
        { id: 'LRUN64TTJPQ156S', name: 'Unemployment Rate', unit: '%' }
      ]
    };
    
    return indicatorMap[region] || [];
  }

  analyzeSentiment(text) {
    const positiveWords = ['growth', 'gain', 'rise', 'bullish', 'positive', 'strong', 'recovery', 'optimistic'];
    const negativeWords = ['decline', 'fall', 'drop', 'bearish', 'negative', 'weak', 'recession', 'pessimistic'];
    
    const words = text.toLowerCase().split(/\s+/);
    const positiveCount = words.filter(word => positiveWords.includes(word)).length;
    const negativeCount = words.filter(word => negativeWords.includes(word)).length;
    
    return positiveCount > negativeCount ? 'positive' : 
           negativeCount > positiveCount ? 'negative' : 'neutral';
  }

  calculateVolatility(changes) {
    if (!changes || changes.length === 0) {
      return 0;
    }
    
    const mean = changes.reduce((a, b) => a + b, 0) / changes.length;
    const variance = changes.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / changes.length;
    return Math.sqrt(variance);
  }
}

module.exports = EnhancedDataBroker;
