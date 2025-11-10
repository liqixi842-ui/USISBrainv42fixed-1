/**
 * USIS News v2.0 - News Scheduler
 * 
 * Coordinates periodic news ingestion, scoring, routing, and delivery
 * 
 * Schedules:
 * - Tier 5 (Regulatory): Every 15 minutes
 * - Tier 4 (Premium): Every 5 minutes
 * - Tier 3 (Industry): Every 10 minutes
 * - Fastlane Push: Continuous (as articles scored ≥7)
 * - 2h Digest: Every 2 hours
 * - 4h Digest: Every 4 hours
 * - Cache Cleanup: Every 6 hours
 */

const { getOrchestrator } = require('../newsIngestion/NewsOrchestrator');
const { getDeduplicator } = require('../newsDeduplication');
const { getScorer } = require('../newsScoring');
const { getRouter } = require('../newsRouter');
const NewsPushService = require('../newsPushService');
const { safeQuery } = require('../dbUtils');

class NewsScheduler {
  constructor(config = {}) {
    this.enabled = config.enabled !== false;
    this.telegramToken = config.telegramToken;
    this.newsChannelId = config.newsChannelId;
    
    this.orchestrator = getOrchestrator();
    this.deduplicator = getDeduplicator();
    this.scorer = getScorer();
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

    console.log('🚀 [NewsScheduler] Starting...');

    // Health check: Verify database schema
    await this.checkDatabaseSchema();

    // Initialize components
    await this.orchestrator.initialize();

    // Initialize push service if credentials available
    if (this.telegramToken && this.newsChannelId) {
      this.pushService = new NewsPushService(this.telegramToken, this.newsChannelId);
      console.log('✅ [NewsScheduler] Telegram push service initialized');
    } else {
      console.warn('⚠️  [NewsScheduler] Telegram push disabled (missing credentials)');
    }

    // Schedule ingestion tasks
    this.scheduleIngestion();

    // Schedule delivery tasks
    this.scheduleDelivery();

    // Schedule cleanup tasks
    this.scheduleCleanup();

    this.isRunning = true;
    console.log('✅ [NewsScheduler] All tasks scheduled');
  }

  /**
   * Schedule news ingestion (respecting per-tier intervals)
   */
  scheduleIngestion() {
    // Run initial ingestion immediately
    this.runFullIngestionCycle();

    // Schedule based on fastest adapter interval (5 minutes for Tier 4)
    // This ensures all tiers are checked frequently, orchestrator handles timing
    const mainInterval = setInterval(() => {
      this.runFullIngestionCycle();
    }, 5 * 60 * 1000);

    this.intervals.push(mainInterval);
    console.log('⏰ [NewsScheduler] Ingestion scheduled (every 5 min for Tier 4, 10 min Tier 3, 15 min Tier 5)');
  }

  /**
   * Run full ingestion → scoring → routing cycle
   */
  async runFullIngestionCycle() {
    console.log('\n📰 [NewsScheduler] Starting ingestion cycle...');

    try {
      // Step 1: Fetch news from all sources
      const since = new Date(Date.now() - 60 * 60 * 1000); // Last hour
      const stats = await this.orchestrator.runIngestion({ since, limit: 100 });

      console.log(`📥 [NewsScheduler] Ingestion: ${stats.total_fetched} fetched, ${stats.total_stored} stored`);

      // Step 2: Score and route new articles
      await this.scoreAndRouteNewArticles();

      // Step 3: Push Fastlane items immediately
      if (this.pushService) {
        await this.pushFastlaneItems();
      }

      console.log('✅ [NewsScheduler] Ingestion cycle complete\n');

    } catch (error) {
      console.error('❌ [NewsScheduler] Ingestion cycle failed:', error.message);
    }
  }

  /**
   * Score and route newly fetched articles
   */
  async scoreAndRouteNewArticles() {
    try {
      // Get unscored articles (fetched in last hour)
      const result = await safeQuery(`
        SELECT ni.*, ns_src.tier
        FROM news_items ni
        JOIN news_sources ns_src ON ni.source_id = ns_src.id
        LEFT JOIN news_scores ns ON ni.id = ns.news_item_id
        WHERE ns.news_item_id IS NULL
        AND ni.fetched_at > NOW() - INTERVAL '1 hour'
        ORDER BY ni.fetched_at DESC
        LIMIT 100
      `);

      const articles = result.rows;
      console.log(`📊 [NewsScheduler] Scoring ${articles.length} new articles...`);

      for (const article of articles) {
        try {
          // Check deduplication
          const dedupeResult = await this.deduplicator.checkDuplicate(article, article.tier);
          
          if (dedupeResult.isDuplicate && !dedupeResult.upgraded) {
            console.log(`⏭️  [NewsScheduler] Skipped duplicate: ${article.title.substring(0, 50)}...`);
            continue;
          }

          // Score article
          const context = {
            corroboration: dedupeResult.corroboration || 0,
            topicHash: this.deduplicator.hashTopic(article.title, article.summary)
          };

          const scoringResult = await this.scorer.scoreArticle(article, article.tier, context);
          await this.scorer.storeScore(article.id, scoringResult);

          // Route article
          const routingResult = await this.router.routeNewsItem(
            article.id, 
            scoringResult.composite_score,
            context
          );

          console.log(`✅ [NewsScheduler] ${article.title.substring(0, 40)}... → ${routingResult.channel} (${scoringResult.composite_score}/10)`);

        } catch (error) {
          console.error(`❌ [NewsScheduler] Failed to process article ${article.id}:`, error.message);
        }
      }

    } catch (error) {
      console.error('❌ [NewsScheduler] Scoring/routing failed:', error.message);
    }
  }

  /**
   * Push Fastlane items immediately
   */
  async pushFastlaneItems() {
    try {
      const items = await this.router.getPendingItems('fastlane', 10);
      
      if (items.length === 0) return;

      console.log(`📤 [NewsScheduler] Pushing ${items.length} Fastlane items...`);

      for (const item of items) {
        try {
          await this.pushService.pushFastlane(item);
          await this.router.markAsSent([item.id]);
        } catch (error) {
          console.error(`❌ [NewsScheduler] Failed to push Fastlane item:`, error.message);
        }
      }

    } catch (error) {
      console.error('❌ [NewsScheduler] Fastlane push failed:', error.message);
    }
  }

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
    const orchestratorStats = await this.orchestrator.getStats();
    const routerStats = await this.router.getStats();
    const pushStats = this.pushService ? await this.pushService.getStats() : [];

    return {
      running: this.isRunning,
      enabled: this.enabled,
      push_enabled: !!this.pushService,
      active_intervals: this.intervals.length,
      stats: {
        ingestion: orchestratorStats,
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
