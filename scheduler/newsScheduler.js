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
   * Schedule digest delivery (v2.0 Fixed Schedule)
   * Push at even hours: 00:00, 02:00, 04:00, 06:00, 08:00, 10:00, 12:00, 14:00, 16:00, 18:00, 20:00, 22:00
   */
  scheduleDelivery() {
    if (!this.pushService) return;

    // Check every minute if we should send digest
    const checkInterval = setInterval(() => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      
      // Send at even hours (0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22) at 00 minutes
      if (hour % 2 === 0 && minute === 0) {
        console.log(`⏰ [NewsScheduler] Triggered at ${hour.toString().padStart(2, '0')}:00`);
        this.sendDigest('digest_2h');
      }
    }, 60 * 1000); // Check every minute

    this.intervals.push(checkInterval);
    
    const now = new Date();
    const currentHour = now.getHours();
    const nextEvenHour = currentHour % 2 === 0 ? currentHour + 2 : currentHour + 1;
    const nextHourDisplay = (nextEvenHour % 24).toString().padStart(2, '0');
    
    console.log('⏰ [NewsScheduler] Top-10 digest scheduled for even hours (00:00, 02:00, 04:00, 06:00, 08:00, 10:00, 12:00, 14:00, 16:00, 18:00, 20:00, 22:00)');
    console.log(`⏰ [NewsScheduler] Next push: ${nextHourDisplay}:00`);
  }

  /**
   * Send digest for a channel (v3.1 Fixed: Always Push Top 10)
   * 
   * NEW Logic:
   * - Primary: Last 2 hours, all news regardless of routing channel
   * - Fallback: Extend to 12 hours if <10 items found
   * - Always send Top 10 by score (even low scores like 4, 3, 2, 1)
   * - No channel filtering (was causing <10 results due to suppressed routing)
   */
  async sendDigest(channel) {
    try {
      console.log(`\n📬 [NewsScheduler] Preparing ${channel} Top-10 digest...`);

      // Step 1: Try last 2 hours first (strict SLA)
      let result = await safeQuery(`
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
          nsrc.name as source_name,
          nsrc.tier
        FROM news_items ni
        JOIN news_scores ns ON ns.news_item_id = ni.id
        LEFT JOIN news_sources nsrc ON nsrc.id = ni.source_id
        WHERE ni.published_at > NOW() - INTERVAL '2 hours'
        ORDER BY ns.composite_score DESC, ni.published_at DESC
        LIMIT 10
      `);

      let items = result.rows;
      let timeWindow = '2h';
      
      // Step 2: Fallback to 12 hours if insufficient items
      if (items.length < 10) {
        console.log(`⚠️  [NewsScheduler] Only ${items.length} items in last 2h, expanding to 12h...`);
        
        result = await safeQuery(`
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
            nsrc.name as source_name,
            nsrc.tier
          FROM news_items ni
          JOIN news_scores ns ON ns.news_item_id = ni.id
          LEFT JOIN news_sources nsrc ON nsrc.id = ni.source_id
          WHERE ni.published_at > NOW() - INTERVAL '12 hours'
          ORDER BY ns.composite_score DESC, ni.published_at DESC
          LIMIT 10
        `);
        
        items = result.rows;
        timeWindow = '12h (fallback)';
      }
      
      if (items.length === 0) {
        console.log(`❌ [NewsScheduler] No items found even in last 12h!`);
        return;
      }

      console.log(`📊 [NewsScheduler] Found ${items.length} items in ${timeWindow}`);

      // Push digest (no markAsSent - allows repeats)
      await this.pushService.pushDigest(items, channel);

      console.log(`✅ [NewsScheduler] ${channel} digest sent: Top ${items.length} from ${timeWindow}\n`);

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
