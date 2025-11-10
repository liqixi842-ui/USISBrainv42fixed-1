/**
 * USIS News v2.0 - News Scheduler (N8N-Optimized)
 * 
 * Simplified scheduler for digest delivery and cleanup.
 * News ingestion is handled by N8N workflows (see n8n-workflows/news-rss-collector.json)
 * 
 * Schedules:
 * - 2h Digest: Every 2 hours
 * - 4h Digest: Every 4 hours
 * - Cache Cleanup: Every 6 hours
 * 
 * Note: Fastlane push is handled by newsIngestAPI.js immediately upon ingestion
 */

const { getDeduplicator } = require('../newsDeduplication');
const { getRouter } = require('../newsRouter');
const NewsPushService = require('../newsPushService');
const { safeQuery } = require('../dbUtils');

class NewsScheduler {
  constructor(config = {}) {
    this.enabled = config.enabled !== false;
    this.telegramToken = config.telegramToken;
    this.newsChannelId = config.newsChannelId;
    
    // Simplified: Only need dedupe, router, and push service
    // Ingestion is handled by N8N → newsIngestAPI.js
    this.deduplicator = getDeduplicator();
    this.router = getRouter();
    this.pushService = null;
    
    this.intervals = [];
    this.isRunning = false;
  }

  /**
   * Health check: Verify database schema exists
   */
  async checkDatabaseSchema() {
    try {
      const result = await safeQuery(`
        SELECT COUNT(*) as count
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('news_sources', 'news_items', 'news_scores', 'news_routing_state', 'news_push_history', 'news_dedupe_cache', 'news_analyst_notes')
      `);

      const tableCount = parseInt(result.rows[0].count);
      
      if (tableCount < 7) {
        throw new Error(`Missing news tables: expected 7, found ${tableCount}. Run: node init-news-schema.js`);
      }

      console.log(`✅ [NewsScheduler] Database schema verified (${tableCount}/7 tables)`);
      return true;

    } catch (error) {
      console.error(`❌ [NewsScheduler] Schema check failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Start all scheduled tasks
   */
  async start() {
    if (!this.enabled) {
      console.log('ℹ️  [NewsScheduler] Disabled (enable with ENABLE_NEWS_SYSTEM=true)');
      return;
    }

    if (this.isRunning) {
      console.warn('⚠️  [NewsScheduler] Already running');
      return;
    }

    console.log('🚀 [NewsScheduler] Starting (N8N-optimized mode)...');

    // Health check: Verify database schema
    await this.checkDatabaseSchema();

    // Initialize routing pipeline (required for digest queries)
    console.log('🔧 [NewsScheduler] Initializing routing pipeline...');
    await this.router.initialize();
    console.log('✅ [NewsScheduler] Router initialized');

    // Initialize push service if credentials available
    if (this.telegramToken && this.newsChannelId) {
      this.pushService = new NewsPushService(this.telegramToken, this.newsChannelId);
      console.log('✅ [NewsScheduler] Telegram push service initialized');
      
      // Schedule delivery tasks (2h/4h digests)
      this.scheduleDelivery();
      console.log('✅ [NewsScheduler] Digest delivery scheduled');
    } else {
      console.warn('⚠️  [NewsScheduler] Telegram push disabled (missing credentials)');
      console.warn('⚠️  [NewsScheduler] Skipping digest delivery scheduling');
    }

    // Always schedule cleanup tasks (doesn't require Telegram)
    this.scheduleCleanup();
    console.log('✅ [NewsScheduler] Cache cleanup scheduled');

    this.isRunning = true;
    console.log('✅ [NewsScheduler] Scheduler ready (N8N-optimized mode)');
    console.log('ℹ️  [NewsScheduler] News ingestion handled by N8N workflows');
  }

  // Note: Ingestion, scoring, routing, and Fastlane push are now handled by:
  // N8N → /api/news/ingest → newsIngestAPI.js
  // This scheduler only handles digest delivery and cleanup

  /**
   * Schedule digest delivery (v3.0 Simplified)
   * Only 2-hour Top-10 digest now
   */
  scheduleDelivery() {
    if (!this.pushService) return;

    // Execute immediately on startup, then every 2 hours
    this.sendDigest('digest_2h').catch(err => {
      console.error('❌ [NewsScheduler] Initial digest failed:', err.message);
    });

    // 2-hour Top-10 digest (repeatable)
    const digest2hInterval = setInterval(() => {
      this.sendDigest('digest_2h');
    }, 2 * 60 * 60 * 1000);

    this.intervals.push(digest2hInterval);
    console.log('⏰ [NewsScheduler] 2-hour Top-10 digest scheduled (immediate + every 2h)');
  }

  /**
   * Send digest for a channel (v3.0 Top-10 Logic)
   * 
   * NEW: Queries Top 10 news by score (allows repeats)
   * - Lookback: last 12 hours (configurable)
   * - Includes translations and AI commentary
   * - No markAsSent (allows repeat digests)
   */
  async sendDigest(channel) {
    try {
      console.log(`\n📬 [NewsScheduler] Preparing ${channel} Top-10 digest...`);

      // Configurable lookback window (default 12 hours)
      const lookbackHours = parseInt(process.env.DIGEST_LOOKBACK_HOURS) || 12;

      // Query Top 10 news by composite score
      const result = await safeQuery(`
        SELECT 
          ni.id,
          ni.title,
          ni.summary,
          ni.url,
          ni.published_at,
          ni.symbols,
          ni.translated_title,
          ni.translated_summary,
          ni.ai_commentary,
          ns.composite_score,
          nsrc.name as source,
          nsrc.tier
        FROM news_items ni
        JOIN news_scores ns ON ns.news_item_id = ni.id
        LEFT JOIN news_sources nsrc ON nsrc.id = ni.source_id
        JOIN news_routing_state nrs ON nrs.news_item_id = ni.id
        WHERE ni.published_at > NOW() - INTERVAL '${lookbackHours} hours'
          AND nrs.channel IN ('urgent_10', 'digest_2h')
        ORDER BY ns.composite_score DESC, ni.published_at DESC
        LIMIT 10
      `);

      const items = result.rows;
      
      if (items.length === 0) {
        console.log(`ℹ️  [NewsScheduler] No items in last ${lookbackHours}h for ${channel}`);
        return;
      }

      // Push digest (no markAsSent - allows repeats)
      await this.pushService.pushDigest(items, channel);

      console.log(`✅ [NewsScheduler] ${channel} digest sent: Top ${items.length} from last ${lookbackHours}h\n`);

    } catch (error) {
      console.error(`❌ [NewsScheduler] Failed to send ${channel} digest:`, error.message);
    }
  }

  /**
   * Schedule cleanup tasks
   */
  scheduleCleanup() {
    // Cache cleanup every 6 hours
    const cleanupInterval = setInterval(async () => {
      console.log('🧹 [NewsScheduler] Running cleanup...');
      await this.deduplicator.cleanupCache();
    }, 6 * 60 * 60 * 1000);

    this.intervals.push(cleanupInterval);
    console.log('⏰ [NewsScheduler] Cleanup scheduled (every 6h)');
  }

  /**
   * Stop all scheduled tasks
   */
  stop() {
    console.log('🛑 [NewsScheduler] Stopping...');

    for (const interval of this.intervals) {
      clearInterval(interval);
    }

    this.intervals = [];
    this.isRunning = false;

    console.log('✅ [NewsScheduler] Stopped');
  }

  /**
   * Get scheduler status
   */
  async getStatus() {
    const routerStats = await this.router.getStats();
    const pushStats = this.pushService ? await this.pushService.getStats() : null;

    return {
      running: this.isRunning,
      enabled: this.enabled,
      push_enabled: !!this.pushService,
      active_intervals: this.intervals.length,
      mode: 'n8n-optimized',
      note: 'News ingestion handled by N8N workflows',
      stats: {
        routing: routerStats,
        push: pushStats
      }
    };
  }
}

// Singleton instance
let schedulerInstance = null;

function getScheduler(config) {
  if (!schedulerInstance) {
    schedulerInstance = new NewsScheduler(config);
  }
  return schedulerInstance;
}

module.exports = {
  NewsScheduler,
  getScheduler
};
