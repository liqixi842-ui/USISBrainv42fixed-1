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
   * Schedule digest delivery
   */
  scheduleDelivery() {
    if (!this.pushService) return;

    // 2-hour digest
    const digest2hInterval = setInterval(() => {
      this.sendDigest('digest_2h');
    }, 2 * 60 * 60 * 1000);

    // 4-hour digest
    const digest4hInterval = setInterval(() => {
      this.sendDigest('digest_4h');
    }, 4 * 60 * 60 * 1000);

    this.intervals.push(digest2hInterval, digest4hInterval);
    console.log('⏰ [NewsScheduler] Digests scheduled (2h, 4h)');
  }

  /**
   * Send digest for a channel
   */
  async sendDigest(channel) {
    try {
      console.log(`\n📬 [NewsScheduler] Preparing ${channel} digest...`);

      const items = await this.router.getPendingItems(channel, 50);
      
      if (items.length === 0) {
        console.log(`ℹ️  [NewsScheduler] No items for ${channel}`);
        return;
      }

      await this.pushService.pushDigest(items, channel);
      await this.router.markAsSent(items.map(item => item.id));

      console.log(`✅ [NewsScheduler] ${channel} digest sent (${items.length} items)\n`);

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
