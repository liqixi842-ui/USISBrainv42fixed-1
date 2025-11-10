/**
 * USIS News v2.0 - Deduplication Engine
 * 
 * 24-hour deduplication with URL hash + topic hash
 * Authority escalation (higher tier wins)
 */

const crypto = require('crypto');
const { safeQuery } = require('./dbUtils');

class NewsDeduplicator {
  constructor() {
    this.dedupeWindow = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Check if article is duplicate
   * @returns {Object} { isDuplicate: boolean, reason: string, existing: object|null }
   */
  async checkDuplicate(article, sourceTier) {
    const urlHash = this.hashUrl(article.url);
    const topicHash = this.hashTopic(article.title);

    try {
      // Check URL-based deduplication first (strongest signal)
      const urlCheck = await safeQuery(
        `SELECT * FROM news_dedupe_cache 
         WHERE url_hash = $1 AND first_seen_at > NOW() - INTERVAL '24 hours'`,
        [urlHash]
      );

      if (urlCheck.rows.length > 0) {
        const existing = urlCheck.rows[0];
        
        // Update seen count and timestamp
        await safeQuery(
          `UPDATE news_dedupe_cache 
           SET last_seen_at = NOW(), seen_count = seen_count + 1
           WHERE url_hash = $1`,
          [urlHash]
        );

        return {
          isDuplicate: true,
          reason: 'url_match',
          existing: existing,
          corroboration: existing.seen_count + 1
        };
      }

      // Check topic-based deduplication (semantic similarity)
      if (topicHash) {
        const topicCheck = await safeQuery(
          `SELECT * FROM news_dedupe_cache 
           WHERE topic_hash = $1 AND first_seen_at > NOW() - INTERVAL '6 hours'
           LIMIT 1`,
          [topicHash]
        );

        if (topicCheck.rows.length > 0) {
          const existing = topicCheck.rows[0];
          
          // Authority escalation: if new source has higher tier, replace
          if (sourceTier > existing.authority_level) {
            console.log(`⬆️  [Dedupe] Authority upgrade: Tier ${existing.authority_level} → ${sourceTier}`);
            
            // Update to higher authority source
            await safeQuery(
              `UPDATE news_dedupe_cache 
               SET authority_level = $1, last_seen_at = NOW(), seen_count = seen_count + 1
               WHERE topic_hash = $2`,
              [sourceTier, topicHash]
            );

            return {
              isDuplicate: false, // Allow higher authority source to proceed
              reason: 'authority_upgrade',
              existing: existing,
              upgraded: true
            };
          }

          // Lower or equal authority, mark as duplicate
          await safeQuery(
            `UPDATE news_dedupe_cache 
             SET last_seen_at = NOW(), seen_count = seen_count + 1
             WHERE topic_hash = $1`,
            [topicHash]
          );

          return {
            isDuplicate: true,
            reason: 'topic_match',
            existing: existing,
            corroboration: existing.seen_count + 1
          };
        }
      }

      // Not a duplicate, add to cache
      await this.addToCache(article.external_id, urlHash, topicHash, sourceTier);

      return {
        isDuplicate: false,
        reason: 'new_article'
      };

    } catch (error) {
      console.error('❌ [Dedupe] Check failed:', error.message);
      // On error, allow article through to avoid blocking pipeline
      return {
        isDuplicate: false,
        reason: 'dedupe_error',
        error: error.message
      };
    }
  }

  /**
   * Add article to deduplication cache
   */
  async addToCache(externalId, urlHash, topicHash, authorityLevel) {
    try {
      await safeQuery(
        `INSERT INTO news_dedupe_cache (external_id, url_hash, topic_hash, authority_level, seen_count)
         VALUES ($1, $2, $3, $4, 1)
         ON CONFLICT (external_id) DO UPDATE
         SET last_seen_at = NOW(), seen_count = news_dedupe_cache.seen_count + 1`,
        [externalId, urlHash, topicHash, authorityLevel]
      );
    } catch (error) {
      console.error('❌ [Dedupe] Failed to add to cache:', error.message);
    }
  }

  /**
   * Clean up old cache entries (run periodically)
   */
  async cleanupCache() {
    try {
      const result = await safeQuery(
        `DELETE FROM news_dedupe_cache 
         WHERE first_seen_at < NOW() - INTERVAL '24 hours'`
      );
      
      console.log(`🧹 [Dedupe] Cleaned up ${result.rowCount} old cache entries`);
      return result.rowCount;
    } catch (error) {
      console.error('❌ [Dedupe] Cleanup failed:', error.message);
      return 0;
    }
  }

  /**
   * Hash URL for deduplication
   */
  hashUrl(url) {
    // Normalize URL (remove query params, trailing slashes, etc.)
    const normalized = url.split('?')[0].replace(/\/$/, '').toLowerCase();
    return crypto.createHash('md5').update(normalized).digest('hex');
  }

  /**
   * Hash topic for semantic deduplication
   * Uses title + first 100 chars of summary
   */
  hashTopic(title, summary = '') {
    if (!title) return null;
    
    // Normalize: lowercase, remove special chars, extract key words
    const normalized = (title + ' ' + summary.substring(0, 100))
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Extract meaningful words (skip common words)
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'been', 'be', 'have', 'has', 'had']);
    const words = normalized.split(' ')
      .filter(w => w.length > 3 && !stopWords.has(w))
      .slice(0, 10); // Top 10 keywords

    if (words.length < 3) return null; // Too few keywords, can't dedupe

    // Sort words alphabetically for consistent hashing
    const keyPhrase = words.sort().join(' ');
    
    return crypto.createHash('md5').update(keyPhrase).digest('hex');
  }

  /**
   * Get corroboration count for a topic
   */
  async getCorroboration(topicHash) {
    if (!topicHash) return 0;

    try {
      const result = await safeQuery(
        `SELECT seen_count FROM news_dedupe_cache WHERE topic_hash = $1`,
        [topicHash]
      );

      return result.rows.length > 0 ? result.rows[0].seen_count : 0;
    } catch (error) {
      console.error('❌ [Dedupe] Failed to get corroboration:', error.message);
      return 0;
    }
  }
}

// Singleton instance
let deduplicatorInstance = null;

function getDeduplicator() {
  if (!deduplicatorInstance) {
    deduplicatorInstance = new NewsDeduplicator();
  }
  return deduplicatorInstance;
}

module.exports = {
  NewsDeduplicator,
  getDeduplicator
};
