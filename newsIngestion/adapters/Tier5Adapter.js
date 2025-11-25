/**
 * USIS News v2.0 - Tier 5 Adapter (官方/监管源)
 * 
 * Sources: SEC EDGAR, Fed, ECB, NYSE, NASDAQ
 * Reliability: 5.0 (最高可信度)
 */

const { NewsAdapter, NormalizedArticle } = require('../AdapterInterface');
const { fetchRSSFeed, stripHtml } = require('../utils/rssFetcher');
const { apiRequest } = require('../../apiClient');

class Tier5RegulatoryAdapter extends NewsAdapter {
  constructor() {
    super({
      tier: 5,
      name: 'Tier5-Regulatory',
      reliabilityScore: 5.0,
      rateLimitPerHour: 60,
      fetchInterval: 15, // Check every 15 minutes
      costPerRequest: 0, // Free RSS feeds
      enabled: true
    });

    this.sources = [
      {
        name: 'SEC-EDGAR-Latest',
        url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&CIK=&type=&company=&dateb=&owner=include&start=0&count=40&output=atom',
        type: 'atom',
        region: 'US'
      },
      {
        name: 'Federal-Reserve-News',
        url: 'https://www.federalreserve.gov/feeds/press_all.xml',
        type: 'rss',
        region: 'US'
      }
      // 可扩展：ECB, NYSE, NASDAQ press releases
    ];
  }

  async fetchBatch({ since, until, limit = 100 }) {
    const results = { ok: [], errors: [] };
    const sinceTime = since.getTime();

    for (const source of this.sources) {
      try {
        const items = await fetchRSSFeed(source.url, { timeout: 15000 });
        
        for (const item of items.slice(0, limit)) {
          try {
            const article = this.normalizeRegulatoryItem(item, source);
            
            // Filter by time range
            if (article.published_at.getTime() >= sinceTime) {
              results.ok.push(article);
            }
          } catch (err) {
            results.errors.push(new Error(`Failed to normalize ${source.name}: ${err.message}`));
          }
        }

        console.log(`✅ [Tier5] ${source.name}: Fetched ${items.length} items`);

      } catch (error) {
        results.errors.push(new Error(`Failed to fetch ${source.name}: ${error.message}`));
        console.error(`❌ [Tier5] ${source.name}:`, error.message);
      }
    }

    return results;
  }

  normalizeRegulatoryItem(item, source) {
    // Parse publication date
    let pubDate = new Date(item.pubDate);
    if (isNaN(pubDate.getTime())) {
      pubDate = new Date(); // Fallback to now
    }

    // Extract symbols from title/content (basic keyword matching)
    const text = `${item.title} ${item.description}`.toUpperCase();
    const symbols = this.extractSymbols(text);

    return new NormalizedArticle({
      external_id: `tier5_${source.name}_${item.guid || item.link}`,
      title: stripHtml(item.title),
      summary: stripHtml(item.description).substring(0, 500),
      body: stripHtml(item.content || item.description),
      url: item.link,
      published_at: pubDate,
      primary_symbol: symbols[0] || null,
      symbols: symbols,
      entities: {
        source: source.name,
        regulatory_type: this.detectRegulatoryType(item.title)
      },
      region: source.region,
      lang: 'en',
      tags: ['regulatory', 'official', ...(item.category || [])],
      raw_data: item
    });
  }

  /**
   * Extract stock symbols from text (basic pattern matching)
   * More sophisticated NLP in production
   */
  extractSymbols(text) {
    const symbols = new Set();
    
    // Common patterns: "AAPL", "TSLA", etc.
    const tickerPattern = /\b([A-Z]{1,5})\b/g;
    const matches = text.match(tickerPattern) || [];
    
    // Filter out common words
    const stopWords = new Set(['SEC', 'EDGAR', 'FED', 'NYSE', 'NASDAQ', 'USA', 'USD', 'THE', 'AND', 'FOR']);
    
    for (const match of matches) {
      if (!stopWords.has(match) && match.length >= 2 && match.length <= 5) {
        symbols.add(match);
      }
    }
    
    return Array.from(symbols).slice(0, 10); // Max 10 symbols
  }

  /**
   * Detect regulatory filing type
   */
  detectRegulatoryType(title) {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('8-k')) return '8-K';
    if (lowerTitle.includes('10-k')) return '10-K';
    if (lowerTitle.includes('10-q')) return '10-Q';
    if (lowerTitle.includes('13f')) return '13F';
    if (lowerTitle.includes('press release')) return 'Press Release';
    if (lowerTitle.includes('interest rate')) return 'Monetary Policy';
    return 'General';
  }
}

module.exports = Tier5RegulatoryAdapter;
