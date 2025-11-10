/**
 * USIS News v2.0 - News Ingestion Orchestrator
 * 
 * Coordinates multi-tier news fetching, normalization, and storage
 */

const { safeQuery } = require('../dbUtils');
const Tier5Adapter = require('./adapters/Tier5Adapter');
const Tier4Adapter = require('./adapters/Tier4Adapter');
const Tier3Adapter = require('./adapters/Tier3Adapter');

class NewsOrchestrator {
  constructor() {
    this.adapters = [];
    this.sourceIdCache = new Map(); // source_name -> db id
    this.isInitialized = false;
  }

  /**
   * Initialize orchestrator and register all adapters
   */
  async initialize() {
    if (this.isInitialized) return;

    console.log('🔧 [NewsOrchestrator] Initializing...');

    // Register adapters (Tier 5 → 4 → 3 in order of priority)
    this.adapters = [
      new Tier5Adapter(),
      new Tier4Adapter(),
      new Tier3Adapter()
      // Tier 1-2 (social) will be added later with feature flag
    ];

    // Validate all adapters
    for (const adapter of this.adapters) {
      adapter.validate();
    }

    // Ensure news sources are registered in database
    await this.ensureSourcesInDatabase();

    this.isInitialized = true;
    console.log(`✅ [NewsOrchestrator] Initialized with ${this.adapters.length} adapters`);
  }

  /**
   * Ensure all news sources exist in database
   */
  async ensureSourcesInDatabase() {
    for (const adapter of this.adapters) {
      const metadata = adapter.getSourceMetadata();
      
      try {
        // Check if source exists
        const existing = await safeQuery(
          'SELECT id FROM news_sources WHERE name = $1',
          [metadata.name]
        );

        if (existing.rows.length > 0) {
          this.sourceIdCache.set(metadata.name, existing.rows[0].id);
        } else {
          // Insert new source
          const result = await safeQuery(
            `INSERT INTO news_sources (name, tier, reliability_score, fetch_config, rate_limit_per_hour, enabled)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id`,
            [
              metadata.name,
              metadata.tier,
              metadata.reliability_score,
              JSON.stringify(metadata.fetch_config),
              metadata.rate_limit_per_hour,
              metadata.enabled
            ]
          );
          
          this.sourceIdCache.set(metadata.name, result.rows[0].id);
          console.log(`✅ [NewsOrchestrator] Registered source: ${metadata.name} (Tier ${metadata.tier})`);
        }
      } catch (error) {
        console.error(`❌ [NewsOrchestrator] Failed to register source ${metadata.name}:`, error.message);
      }
    }
  }

  /**
   * Run ingestion for all enabled adapters
   */
  async runIngestion(options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const {
      since = new Date(Date.now() - 3600000), // Default: last 1 hour
      until = new Date(),
      limit = 100
    } = options;

    console.log(`📰 [NewsOrchestrator] Starting ingestion (since: ${since.toISOString()})`);

    const stats = {
      total_fetched: 0,
      total_stored: 0,
      total_errors: 0,
      by_tier: {}
    };

    // Fetch from all adapters in parallel
    const fetchPromises = this.adapters
      .filter(adapter => adapter.enabled)
      .map(adapter => this.runAdapterIngestion(adapter, { since, until, limit }));

    const results = await Promise.allSettled(fetchPromises);

    // Aggregate results
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { tier, fetched, stored, errors } = result.value;
        stats.total_fetched += fetched;
        stats.total_stored += stored;
        stats.total_errors += errors;
        stats.by_tier[tier] = { fetched, stored, errors };
      } else {
        stats.total_errors++;
        console.error('❌ [NewsOrchestrator] Adapter failed:', result.reason);
      }
    }

    console.log(`✅ [NewsOrchestrator] Ingestion complete:`, stats);
    return stats;
  }

  /**
   * Run ingestion for a single adapter
   */
  async runAdapterIngestion(adapter, options) {
    const startTime = Date.now();
    const tierName = `Tier ${adapter.tier}`;

    try {
      console.log(`📡 [${tierName}] Starting fetch...`);

      // Fetch batch from adapter
      const result = await adapter.fetchBatch(options);
      const { ok: articles, errors } = result;

      console.log(`📥 [${tierName}] Fetched ${articles.length} articles, ${errors.length} errors`);

      // Store articles in database
      let storedCount = 0;
      for (const article of articles) {
        try {
          const stored = await this.storeArticle(article, adapter);
          if (stored) storedCount++;
        } catch (err) {
          console.error(`❌ [${tierName}] Failed to store article:`, err.message);
          errors.push(err);
        }
      }

      const duration = Date.now() - startTime;
      console.log(`✅ [${tierName}] Completed in ${duration}ms: ${storedCount}/${articles.length} stored`);

      return {
        tier: adapter.tier,
        fetched: articles.length,
        stored: storedCount,
        errors: errors.length
      };

    } catch (error) {
      console.error(`❌ [${tierName}] Ingestion failed:`, error.message);
      throw error;
    }
  }

  /**
   * Store article in database (with deduplication check)
   */
  async storeArticle(article, adapter) {
    try {
      article.validate();
      
      const sourceId = this.sourceIdCache.get(adapter.name);
      if (!sourceId) {
        throw new Error(`Source ID not found for ${adapter.name}`);
      }

      // Check if article already exists (URL-based dedup)
      const existing = await safeQuery(
        'SELECT id FROM news_items WHERE url = $1',
        [article.url]
      );

      if (existing.rows.length > 0) {
        // Article already exists, skip
        return false;
      }

      // Generate unique ID
      const articleId = `${adapter.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Insert article
      await safeQuery(
        `INSERT INTO news_items 
         (id, source_id, external_id, title, summary, body, url, published_at, primary_symbol, symbols, entities, region, lang, tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          articleId,
          sourceId,
          article.external_id,
          article.title,
          article.summary,
          article.body,
          article.url,
          article.published_at,
          article.primary_symbol,
          article.symbols,
          JSON.stringify(article.entities),
          article.region,
          article.lang,
          JSON.stringify(article.tags)
        ]
      );

      console.log(`💾 [NewsOrchestrator] Stored: ${article.title.substring(0, 60)}...`);
      return true;

    } catch (error) {
      if (error.message.includes('duplicate key')) {
        // Duplicate detected, skip silently
        return false;
      }
      throw error;
    }
  }

  /**
   * Get ingestion statistics
   */
  async getStats() {
    const result = await safeQuery(`
      SELECT 
        ns.tier,
        ns.name,
        COUNT(ni.id) as article_count,
        MAX(ni.fetched_at) as last_fetch
      FROM news_sources ns
      LEFT JOIN news_items ni ON ns.id = ni.source_id
      GROUP BY ns.tier, ns.name
      ORDER BY ns.tier DESC, article_count DESC
    `);

    return result.rows;
  }
}

// Singleton instance
let orchestratorInstance = null;

function getOrchestrator() {
  if (!orchestratorInstance) {
    orchestratorInstance = new NewsOrchestrator();
  }
  return orchestratorInstance;
}

module.exports = {
  NewsOrchestrator,
  getOrchestrator
};
