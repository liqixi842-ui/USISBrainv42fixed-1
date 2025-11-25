/**
 * USIS News v2.0 - Tier 4 Adapter (一线媒体)
 * 
 * Sources: Bloomberg, Reuters, WSJ, Financial Times
 * Reliability: 4.5-5.0 (最高媒体可信度)
 */

const { NewsAdapter, NormalizedArticle } = require('../AdapterInterface');
const { fetchRSSFeed, stripHtml } = require('../utils/rssFetcher');

class Tier4PremiumMediaAdapter extends NewsAdapter {
  constructor() {
    super({
      tier: 4,
      name: 'Tier4-Premium-Media',
      reliabilityScore: 4.8,
      rateLimitPerHour: 120,
      fetchInterval: 5, // Check every 5 minutes (high-frequency)
      costPerRequest: 0, // Free RSS feeds (limited access)
      enabled: true
    });

    this.sources = [
      {
        name: 'Reuters-Business',
        url: 'https://www.reutersagency.com/feed/?taxonomy=best-topics&post_type=best',
        type: 'rss',
        region: 'Global'
      },
      {
        name: 'WSJ-Markets',
        url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',
        type: 'rss',
        region: 'US'
      },
      {
        name: 'FT-Companies',
        url: 'https://www.ft.com/companies?format=rss',
        type: 'rss',
        region: 'Global'
      },
      {
        name: 'MarketWatch-Top',
        url: 'http://feeds.marketwatch.com/marketwatch/topstories/',
        type: 'rss',
        region: 'US'
      }
      // Bloomberg RSS需要付费订阅，暂不包含
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
            const article = this.normalizePremiumMediaItem(item, source);
            
            // Filter by time range
            if (article.published_at.getTime() >= sinceTime) {
              results.ok.push(article);
            }
          } catch (err) {
            results.errors.push(new Error(`Failed to normalize ${source.name}: ${err.message}`));
          }
        }

        console.log(`✅ [Tier4] ${source.name}: Fetched ${items.length} items`);

      } catch (error) {
        results.errors.push(new Error(`Failed to fetch ${source.name}: ${error.message}`));
        console.error(`❌ [Tier4] ${source.name}:`, error.message);
      }
    }

    return results;
  }

  normalizePremiumMediaItem(item, source) {
    // Parse publication date
    let pubDate = new Date(item.pubDate);
    if (isNaN(pubDate.getTime())) {
      pubDate = new Date();
    }

    // Extract symbols (will be enhanced by symbolResolver later)
    const text = `${item.title} ${item.description}`.toUpperCase();
    const symbols = this.extractSymbols(text);

    // Detect market impact keywords
    const impactKeywords = this.detectImpactKeywords(item.title + ' ' + item.description);

    return new NormalizedArticle({
      external_id: `tier4_${source.name}_${item.guid || this.hashUrl(item.link)}`,
      title: stripHtml(item.title),
      summary: stripHtml(item.description).substring(0, 500),
      body: stripHtml(item.content || item.description),
      url: item.link,
      published_at: pubDate,
      primary_symbol: symbols[0] || null,
      symbols: symbols,
      entities: {
        source: source.name,
        impact_keywords: impactKeywords
      },
      region: source.region,
      lang: 'en',
      tags: ['premium-media', 'tier4', ...(item.category || [])],
      raw_data: item
    });
  }

  /**
   * Extract stock symbols from text
   */
  extractSymbols(text) {
    const symbols = new Set();
    
    // Pattern 1: Ticker in parentheses: "Apple (AAPL)"
    const parenthesesPattern = /\(([A-Z]{1,5})\)/g;
    let match;
    while ((match = parenthesesPattern.exec(text)) !== null) {
      symbols.add(match[1]);
    }
    
    // Pattern 2: Standalone tickers
    const tickerPattern = /\b([A-Z]{2,5})\b/g;
    const matches = text.match(tickerPattern) || [];
    
    const stopWords = new Set(['WSJ', 'FT', 'NYSE', 'NASDAQ', 'USA', 'USD', 'EUR', 'GBP', 'CEO', 'CFO', 'IPO', 'ETF', 'THE', 'AND', 'FOR', 'INC', 'LLC', 'CORP']);
    
    for (const m of matches) {
      if (!stopWords.has(m) && m.length >= 2 && m.length <= 5) {
        symbols.add(m);
      }
    }
    
    return Array.from(symbols).slice(0, 10);
  }

  /**
   * Detect high-impact keywords
   */
  detectImpactKeywords(text) {
    const lowerText = text.toLowerCase();
    const keywords = [];
    
    const patterns = {
      earnings: /\b(earnings|revenue|profit|loss|eps|guidance)\b/i,
      merger: /\b(merger|acquisition|buyout|takeover|deal)\b/i,
      lawsuit: /\b(lawsuit|litigation|settlement|fraud|investigation)\b/i,
      product: /\b(launch|release|recall|approval|fda)\b/i,
      executive: /\b(ceo|cfo|resign|appoint|hire|fire)\b/i,
      bankruptcy: /\b(bankruptcy|chapter 11|insolvency|default)\b/i,
      upgrade: /\b(upgrade|downgrade|rating|analyst|target)\b/i
    };
    
    for (const [key, pattern] of Object.entries(patterns)) {
      if (pattern.test(lowerText)) {
        keywords.push(key);
      }
    }
    
    return keywords;
  }

  /**
   * Simple URL hash for ID generation
   */
  hashUrl(url) {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

module.exports = Tier4PremiumMediaAdapter;
