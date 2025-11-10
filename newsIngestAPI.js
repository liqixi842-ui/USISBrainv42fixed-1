/**
 * USIS News v2.0 - Ingestion API
 * 
 * Receives raw news data from N8N, processes through scoring/routing/push pipeline
 */

const { NewsDeduplicator } = require('./newsDeduplication');
const { NewsScorer } = require('./newsScoring');
const { NewsRouter } = require('./newsRouter');
const NewsPushService = require('./newsPushService');
const { safeQuery } = require('./dbUtils');

class NewsIngestAPI {
  constructor(telegramToken = null, newsChannelId = null) {
    this.deduplicator = new NewsDeduplicator();
    this.scorer = new NewsScorer();
    this.router = new NewsRouter();
    this.pushService = (telegramToken && newsChannelId) 
      ? new NewsPushService(telegramToken, newsChannelId)
      : null;
    
    console.log('🧠 [NewsIngestAPI] Initialized (push service:', this.pushService ? 'enabled' : 'disabled', ')');
  }

  /**
   * Process incoming news from N8N
   * @param {Object} newsData - Raw news data from N8N
   * @returns {Object} Processing result with HTTP status
   */
  async processNews(newsData) {
    const startTime = Date.now();
    
    try {
      // 1. Validate input
      const validation = this.validateInput(newsData);
      if (!validation.valid) {
        return { 
          ok: false, 
          error: validation.error, 
          stage: 'validation',
          httpStatus: validation.httpStatus || 400
        };
      }

      const { title, summary, url, published_at, source, tier = 4, symbols = [] } = newsData;

      console.log(`📰 [Ingest] Processing: ${title.substring(0, 50)}...`);

      // 2. Deduplication check
      const article = {
        external_id: this.generateExternalId(url, source),
        title,
        summary: summary || '',
        url,
        published_at: new Date(published_at),
        symbols: Array.isArray(symbols) ? symbols : [],
        entities: newsData.entities || {}
      };

      const dedupeResult = await this.deduplicator.checkDuplicate(article, tier);
      
      if (dedupeResult.is_duplicate) {
        console.log(`⏭️  [Ingest] Skipped duplicate: ${dedupeResult.reason}`);
        return { 
          ok: true, 
          action: 'skipped', 
          reason: dedupeResult.reason,
          elapsed_ms: Date.now() - startTime
        };
      }

      // 3. Save to database
      const newsItemId = await this.saveNewsItem(article, source, tier);
      article.id = newsItemId;

      // 4. Score the article
      const scoreResult = await this.scorer.scoreArticle(article, tier);
      await this.saveScore(newsItemId, scoreResult);

      console.log(`📊 [Ingest] Score: ${scoreResult.composite_score}/10 (${scoreResult.breakdown})`);

      // 5. Route to appropriate channel
      const channel = this.router.determineChannel(scoreResult.composite_score);
      
      if (channel === 'suppressed') {
        console.log(`🔇 [Ingest] Suppressed (score too low)`);
        return {
          ok: true,
          action: 'suppressed',
          score: scoreResult.composite_score,
          elapsed_ms: Date.now() - startTime
        };
      }

      await this.saveRoutingState(newsItemId, channel);

      // 6. Push if Fastlane (immediate push)
      if (channel === 'fastlane' && this.pushService) {
        try {
          // Prepare news item with score for push
          const newsItemWithScore = {
            ...article,
            composite_score: scoreResult.composite_score
          };
          
          const pushResult = await this.pushService.pushFastlane(newsItemWithScore);
          
          console.log(`🚀 [Ingest] Pushed to Fastlane: message_id ${pushResult.message_id}`);
          
          return {
            ok: true,
            action: 'pushed',
            channel,
            score: scoreResult.composite_score,
            message_id: pushResult.message_id,
            elapsed_ms: Date.now() - startTime
          };
        } catch (pushError) {
          console.error(`❌ [Ingest] Push failed:`, pushError.message);
          // Don't fail the whole ingestion if push fails
        }
      }

      // 7. Success - routed to digest
      return {
        ok: true,
        action: 'routed',
        channel,
        score: scoreResult.composite_score,
        elapsed_ms: Date.now() - startTime
      };

    } catch (error) {
      console.error(`❌ [NewsIngestAPI] Processing failed:`, error);
      return {
        ok: false,
        error: error.message,
        stage: 'processing',
        httpStatus: 500,
        elapsed_ms: Date.now() - startTime
      };
    }
  }

  /**
   * Validate authentication header
   * @param {string} authHeader - Authorization header value
   * @returns {boolean} True if valid
   */
  static validateAuth(authHeader, expectedSecret) {
    if (!expectedSecret) {
      // No secret configured - allow all (backward compatible)
      console.warn('⚠️  [NewsIngestAPI] No NEWS_INGESTION_SECRET configured - authentication disabled');
      return true;
    }

    if (!authHeader) {
      return false;
    }

    // Support both "Bearer <token>" and plain token
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7)
      : authHeader;

    return token === expectedSecret;
  }

  /**
   * Validate incoming news data
   */
  validateInput(data) {
    if (!data) {
      return { valid: false, error: 'Missing news data', httpStatus: 400 };
    }

    // Required fields
    const required = ['title', 'url', 'published_at', 'source'];
    for (const field of required) {
      if (!data[field]) {
        return { valid: false, error: `Missing required field: ${field}`, httpStatus: 400 };
      }
    }

    // Validate title length
    if (typeof data.title !== 'string' || data.title.length === 0 || data.title.length > 500) {
      return { valid: false, error: 'Title must be 1-500 characters', httpStatus: 400 };
    }

    // Validate URL format
    try {
      new URL(data.url);
    } catch (e) {
      return { valid: false, error: 'Invalid URL format', httpStatus: 400 };
    }

    // Validate published_at is a valid date
    const pubDate = new Date(data.published_at);
    if (isNaN(pubDate.getTime())) {
      return { valid: false, error: 'Invalid published_at date', httpStatus: 400 };
    }

    // Validate tier range
    if (data.tier !== undefined) {
      const tier = parseInt(data.tier);
      if (isNaN(tier) || tier < 1 || tier > 5) {
        return { valid: false, error: 'Tier must be integer 1-5', httpStatus: 400 };
      }
    }

    // Validate symbols array
    if (data.symbols !== undefined) {
      if (!Array.isArray(data.symbols)) {
        return { valid: false, error: 'Symbols must be an array', httpStatus: 400 };
      }
      if (data.symbols.some(s => typeof s !== 'string')) {
        return { valid: false, error: 'All symbols must be strings', httpStatus: 400 };
      }
    }

    // Validate source name
    if (typeof data.source !== 'string' || data.source.length === 0 || data.source.length > 100) {
      return { valid: false, error: 'Source must be 1-100 characters', httpStatus: 400 };
    }

    return { valid: true };
  }

  /**
   * Generate external ID for deduplication
   */
  generateExternalId(url, source) {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(url).digest('hex');
    return `${source}:${hash.substring(0, 12)}`;
  }

  /**
   * Save news item to database
   */
  async saveNewsItem(article, sourceName, tier) {
    // Get or create source ID
    const sourceResult = await safeQuery(
      `INSERT INTO news_sources (name, tier, reliability_score, enabled)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [sourceName, tier, this.getTierReliability(tier)]
    );
    const sourceId = sourceResult.rows[0].id;

    // Insert news item
    const newsId = `news_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    await safeQuery(
      `INSERT INTO news_items (id, source_id, external_id, title, summary, url, published_at, symbols, entities)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        newsId,
        sourceId,
        article.external_id,
        article.title,
        article.summary,
        article.url,
        article.published_at,
        article.symbols,
        JSON.stringify(article.entities)
      ]
    );

    return newsId;
  }

  /**
   * Save score to database
   */
  async saveScore(newsItemId, scoreResult) {
    await safeQuery(
      `INSERT INTO news_scores (
        news_item_id, freshness, source_quality, relevance, impact, 
        novelty, corroboration, attention, composite_score, scoring_details
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        newsItemId,
        scoreResult.scores.freshness,
        scoreResult.scores.source_quality,
        scoreResult.scores.relevance,
        scoreResult.scores.impact,
        scoreResult.scores.novelty,
        scoreResult.scores.corroboration,
        scoreResult.scores.attention,
        scoreResult.composite_score,
        JSON.stringify(scoreResult)
      ]
    );
  }

  /**
   * Save routing state to database
   */
  async saveRoutingState(newsItemId, channel) {
    await safeQuery(
      `INSERT INTO news_routing_state (news_item_id, channel, status)
       VALUES ($1, $2, 'pending')`,
      [newsItemId, channel]
    );
  }

  /**
   * Save push history
   */
  async savePushHistory(newsItemId, channel, pushResult) {
    await safeQuery(
      `INSERT INTO news_push_history (news_item_id, channel, message_id, outcome, error_message)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        newsItemId,
        channel,
        pushResult.message_id || null,
        pushResult.success ? 'success' : 'failed',
        pushResult.error || null
      ]
    );
  }

  /**
   * Get tier reliability score
   */
  getTierReliability(tier) {
    const reliability = {
      5: 5.0,  // Official/Regulatory
      4: 4.2,  // Premium Media
      3: 3.5,  // Industry Authorities
      2: 2.5,  // Aggregators
      1: 1.5   // Social
    };
    return reliability[tier] || 3.0;
  }
}

module.exports = { NewsIngestAPI };
