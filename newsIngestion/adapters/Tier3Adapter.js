/**
 * USIS News v2.0 - Tier 3 Adapter (行业权威 + 聚合器)
 * 
 * Sources: 
 * - Industry: TechCrunch, The Verge, EE Times, Fierce Pharma
 * - Aggregators: Yahoo Finance, Seeking Alpha, Benzinga
 * Reliability: 3.5-4.0
 */

const { NewsAdapter, NormalizedArticle } = require('../AdapterInterface');
const { fetchRSSFeed, stripHtml } = require('../utils/rssFetcher');
const { apiRequest } = require('../../apiClient');

class Tier3IndustryAggregatorAdapter extends NewsAdapter {
  constructor() {
    super({
      tier: 3,
      name: 'Tier3-Industry-Aggregator',
      reliabilityScore: 3.8,
      rateLimitPerHour: 180,
      fetchInterval: 10, // Check every 10 minutes
      costPerRequest: 0,
      enabled: true
    });

    this.sources = [
      // Industry Authority
      {
        name: 'TechCrunch',
        url: 'https://techcrunch.com/feed/',
        type: 'rss',
        region: 'US',
        category: 'tech'
      },
      {
        name: 'The-Verge',
        url: 'https://www.theverge.com/rss/index.xml',
        type: 'rss',
        region: 'US',
        category: 'tech'
      },
      // Financial Aggregators
      {
        name: 'Yahoo-Finance',
        url: 'https://finance.yahoo.com/news/rssindex',
        type: 'rss',
        region: 'US',
        category: 'finance'
      },
      {
        name: 'Seeking-Alpha',
        url: 'https://seekingalpha.com/feed.xml',
        type: 'rss',
        region: 'US',
        category: 'finance'
      },
      {
        name: 'Benzinga',
        url: 'https://www.benzinga.com/feed',
        type: 'rss',
        region: 'US',
        category: 'finance'
      }
    ];
  }

  async fetchBatch({ since, until, limit = 100 }) {
    const results = { ok: [], errors: [] };
    const sinceTime = since.getTime();

    for (const source of this.sources) {
      try {
        const items = await fetchRSSFeed(source.url, { timeout: 12000 });
        
        for (const item of items.slice(0, limit)) {
          try {
            const article = this.normalizeIndustryItem(item, source);
            
            if (article.published_at.getTime() >= sinceTime) {
              results.ok.push(article);
            }
          } catch (err) {
            results.errors.push(new Error(`Failed to normalize ${source.name}: ${err.message}`));
          }
        }

        console.log(`✅ [Tier3] ${source.name}: Fetched ${items.length} items`);

      } catch (error) {
        results.errors.push(new Error(`Failed to fetch ${source.name}: ${error.message}`));
        console.error(`❌ [Tier3] ${source.name}:`, error.message);
      }
    }

    return results;
  }

  normalizeIndustryItem(item, source) {
    let pubDate = new Date(item.pubDate);
    if (isNaN(pubDate.getTime())) {
      pubDate = new Date();
    }

    const text = `${item.title} ${item.description}`.toUpperCase();
    const symbols = this.extractSymbols(text);

    return new NormalizedArticle({
      external_id: `tier3_${source.name}_${item.guid || this.hashUrl(item.link)}`,
      title: stripHtml(item.title),
      summary: stripHtml(item.description).substring(0, 500),
      body: stripHtml(item.content || item.description),
      url: item.link,
      published_at: pubDate,
      primary_symbol: symbols[0] || null,
      symbols: symbols,
      entities: {
        source: source.name,
        category: source.category
      },
      region: source.region,
      lang: 'en',
      tags: ['tier3', source.category, ...(item.category || [])],
      raw_data: item
    });
  }

  extractSymbols(text) {
    const symbols = new Set();
    
    const parenthesesPattern = /\(([A-Z]{1,5})\)/g;
    let match;
    while ((match = parenthesesPattern.exec(text)) !== null) {
      symbols.add(match[1]);
    }
    
    const tickerPattern = /\b([A-Z]{2,5})\b/g;
    const matches = text.match(tickerPattern) || [];
    const stopWords = new Set(['RSS', 'XML', 'API', 'USA', 'USD', 'EUR', 'CEO', 'CFO', 'IPO', 'ETF', 'THE', 'AND', 'FOR', 'INC', 'TECH']);
    
    for (const m of matches) {
      if (!stopWords.has(m)) {
        symbols.add(m);
      }
    }
    
    return Array.from(symbols).slice(0, 10);
  }

  hashUrl(url) {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      hash = ((hash << 5) - hash) + url.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}

module.exports = Tier3IndustryAggregatorAdapter;
