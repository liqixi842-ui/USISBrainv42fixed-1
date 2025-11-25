/**
 * USIS News v2.0 - Routing Engine (Simplified)
 * 
 * NEW Routing Strategy:
 * - Score = 10.0: urgent_10 (push within 10 minutes)
 * - All others: digest_2h (Top 10 every 2 hours)
 * 
 * No more fastlane/4h digest. Simple and clean.
 */

const { safeQuery } = require('./dbUtils');

class NewsRouter {
  constructor() {
    this.routingRules = [
      { minScore: 10.0, channel: 'urgent_10', description: 'Perfect score - instant push within 10min' },
      { minScore: 0, channel: 'digest_2h', description: 'All news - 2h Top 10 digest' }
    ];

    this.fadeThreshold = 3; // Number of times before starting fade
    this.maxFadeLevel = 5;  // Max fade level before suppression
  }

  /**
   * Initialize router (required by scheduler)
   * NewsRouter is stateless, so this is a no-op
   */
  async initialize() {
    console.log('✅ [NewsRouter] Router initialized');
    return true;
  }

  /**
   * Route news item to appropriate channel
   * @param {string} newsItemId - News item ID
   * @param {number} compositeScore - Composite score (0-10)
   * @param {Object} context - Routing context
   * @returns {Object} Routing decision
   */
  async routeNewsItem(newsItemId, compositeScore, context = {}) {
    try {
      // Determine channel based on score
      const channel = this.determineChannel(compositeScore);

      // Check if this is a repeat story (fade detection)
      const fadeLevel = await this.checkFadeStatus(newsItemId, context);

      // Adjust channel if faded
      const finalChannel = this.applyFade(channel, fadeLevel);

      // Check for score upgrades (breaking development)
      const upgradeFlag = await this.detectUpgrade(newsItemId, compositeScore);

      // Store routing state
      await this.storeRoutingState(newsItemId, finalChannel, fadeLevel, upgradeFlag);

      console.log(`🔀 [Router] ${newsItemId}: Score ${compositeScore} → ${finalChannel} (fade: ${fadeLevel})`);

      return {
        channel: finalChannel,
        originalChannel: channel,
        fadeLevel,
        upgradeFlag,
        shouldPush: finalChannel !== 'suppressed'
      };

    } catch (error) {
      console.error('❌ [Router] Routing failed:', error.message);
      return {
        channel: 'digest_2h', // Default fallback
        error: error.message
      };
    }
  }

  /**
   * Determine channel based on composite score
   */
  determineChannel(score) {
    for (const rule of this.routingRules) {
      if (score >= rule.minScore) {
        return rule.channel;
      }
    }
    return 'suppressed';
  }

  /**
   * Check fade status for repeat stories
   */
  async checkFadeStatus(newsItemId, context) {
    try {
      // Check if similar stories already routed recently
      const topicHash = context.topicHash;
      if (!topicHash) return 0;

      const recentSimilar = await safeQuery(
        `SELECT fade_level FROM news_routing_state nrs
         JOIN news_items ni ON nrs.news_item_id = ni.id
         JOIN news_dedupe_cache ndc ON ni.url = ndc.url_hash
         WHERE ndc.topic_hash = $1
         AND nrs.routed_at > NOW() - INTERVAL '24 hours'
         ORDER BY nrs.routed_at DESC
         LIMIT 1`,
        [topicHash]
      );

      if (recentSimilar.rows.length > 0) {
        const previousFade = recentSimilar.rows[0].fade_level || 0;
        return Math.min(previousFade + 1, this.maxFadeLevel);
      }

      return 0;

    } catch (error) {
      console.error('❌ [Router] Fade check failed:', error.message);
      return 0;
    }
  }

  /**
   * Apply fade mechanism to channel (SIMPLIFIED for v3.0)
   * Note: With v3.0 Top-10 digest allowing repeats, fade is less critical
   */
  applyFade(channel, fadeLevel) {
    if (fadeLevel === 0) return channel;

    // NEW Simplified fade rules (only 2 channels: urgent_10, digest_2h)
    if (fadeLevel >= 5) {
      return 'suppressed'; // Too many repeats
    }

    if (fadeLevel >= 3) {
      // Downgrade urgent to digest
      if (channel === 'urgent_10') return 'digest_2h';
      if (channel === 'digest_2h') return 'suppressed';
    }

    if (fadeLevel >= 1) {
      // Mild downgrade: urgent → digest
      if (channel === 'urgent_10') return 'digest_2h';
    }

    return channel;
  }

  /**
   * Detect if this is an upgraded story (score increased)
   */
  async detectUpgrade(newsItemId, currentScore) {
    try {
      const previous = await safeQuery(
        `SELECT ns.composite_score 
         FROM news_scores ns
         WHERE ns.news_item_id = $1`,
        [newsItemId]
      );

      if (previous.rows.length > 0) {
        const previousScore = parseFloat(previous.rows[0].composite_score);
        
        // Upgrade: score increased by 2+ points
        if (currentScore - previousScore >= 2.0) {
          console.log(`⬆️  [Router] Score upgrade detected: ${previousScore} → ${currentScore}`);
          return true;
        }
      }

      return false;

    } catch (error) {
      console.error('❌ [Router] Upgrade detection failed:', error.message);
      return false;
    }
  }

  /**
   * Store routing state in database
   */
  async storeRoutingState(newsItemId, channel, fadeLevel, upgradeFlag) {
    try {
      await safeQuery(
        `INSERT INTO news_routing_state 
         (news_item_id, channel, status, fade_level, upgrade_flag)
         VALUES ($1, $2, 'pending', $3, $4)
         ON CONFLICT (news_item_id) DO UPDATE
         SET channel = EXCLUDED.channel, 
             fade_level = EXCLUDED.fade_level,
             upgrade_flag = EXCLUDED.upgrade_flag,
             last_updated = NOW()`,
        [newsItemId, channel, fadeLevel, upgradeFlag]
      );

      return true;

    } catch (error) {
      console.error('❌ [Router] Failed to store routing state:', error.message);
      return false;
    }
  }

  /**
   * Get pending items for a channel
   */
  async getPendingItems(channel, limit = 50) {
    try {
      const result = await safeQuery(
        `SELECT ni.*, ns.composite_score, nrs.fade_level, nrs.upgrade_flag
         FROM news_items ni
         JOIN news_routing_state nrs ON ni.id = nrs.news_item_id
         JOIN news_scores ns ON ni.id = ns.news_item_id
         WHERE nrs.channel = $1 AND nrs.status = 'pending'
         ORDER BY ns.composite_score DESC, ni.published_at DESC
         LIMIT $2`,
        [channel, limit]
      );

      return result.rows;

    } catch (error) {
      console.error('❌ [Router] Failed to get pending items:', error.message);
      return [];
    }
  }

  /**
   * Mark items as sent
   */
  async markAsSent(newsItemIds) {
    try {
      await safeQuery(
        `UPDATE news_routing_state 
         SET status = 'sent', last_updated = NOW()
         WHERE news_item_id = ANY($1)`,
        [newsItemIds]
      );

      console.log(`✅ [Router] Marked ${newsItemIds.length} items as sent`);
      return true;

    } catch (error) {
      console.error('❌ [Router] Failed to mark as sent:', error.message);
      return false;
    }
  }

  /**
   * Get routing statistics
   */
  async getStats() {
    try {
      const result = await safeQuery(`
        SELECT 
          channel,
          status,
          COUNT(*) as count,
          AVG(fade_level) as avg_fade,
          SUM(CASE WHEN upgrade_flag THEN 1 ELSE 0 END) as upgrades
        FROM news_routing_state
        WHERE routed_at > NOW() - INTERVAL '24 hours'
        GROUP BY channel, status
        ORDER BY channel, status
      `);

      return result.rows;

    } catch (error) {
      console.error('❌ [Router] Failed to get stats:', error.message);
      return [];
    }
  }
}

// Singleton instance
let routerInstance = null;

function getRouter() {
  if (!routerInstance) {
    routerInstance = new NewsRouter();
  }
  return routerInstance;
}

module.exports = {
  NewsRouter,
  getRouter
};
