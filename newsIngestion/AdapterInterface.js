/**
 * USIS News v2.0 - Adapter Interface
 * 
 * Defines contract for all tier-specific news adapters
 * Each adapter implements fetchBatch() and declares metadata
 */

class NewsAdapter {
  constructor(config) {
    this.tier = config.tier; // 1-5
    this.name = config.name;
    this.reliabilityScore = config.reliabilityScore; // 1.0-5.0
    this.rateLimitPerHour = config.rateLimitPerHour;
    this.fetchInterval = config.fetchInterval; // in minutes
    this.costPerRequest = config.costPerRequest || 0; // USD
    this.enabled = config.enabled !== false;
  }

  /**
   * Fetch news batch from this source
   * @param {Object} options
   * @param {Date} options.since - Start time
   * @param {Date} options.until - End time (optional)
   * @param {number} options.limit - Max items to fetch
   * @returns {Promise<{ok: Article[], errors: Error[]}>}
   */
  async fetchBatch({ since, until, limit = 100 }) {
    throw new Error('fetchBatch() must be implemented by subclass');
  }

  /**
   * Validate adapter configuration
   */
  validate() {
    if (!this.tier || this.tier < 1 || this.tier > 5) {
      throw new Error(`Invalid tier: ${this.tier}`);
    }
    if (!this.name) {
      throw new Error('Adapter name is required');
    }
    return true;
  }

  /**
   * Get source metadata for DB storage
   */
  getSourceMetadata() {
    return {
      name: this.name,
      tier: this.tier,
      reliability_score: this.reliabilityScore,
      rate_limit_per_hour: this.rateLimitPerHour,
      fetch_config: {
        interval: this.fetchInterval,
        cost_per_request: this.costPerRequest
      },
      enabled: this.enabled
    };
  }
}

/**
 * Normalized article format (output from all adapters)
 */
class NormalizedArticle {
  constructor(data) {
    this.external_id = data.external_id; // Source-specific ID
    this.title = data.title;
    this.summary = data.summary || null;
    this.body = data.body || null;
    this.url = data.url;
    this.published_at = new Date(data.published_at);
    this.primary_symbol = data.primary_symbol || null; // Main ticker
    this.symbols = data.symbols || []; // All mentioned tickers
    this.entities = data.entities || {}; // {companies: [], people: [], ...}
    this.region = data.region || 'US'; // US, CN, EU, etc.
    this.lang = data.lang || 'en';
    this.tags = data.tags || [];
    this.raw_data = data.raw_data || {}; // Preserve original data
  }

  /**
   * Validate article has required fields
   */
  validate() {
    if (!this.external_id) throw new Error('external_id is required');
    if (!this.title) throw new Error('title is required');
    if (!this.url) throw new Error('url is required');
    if (!this.published_at || isNaN(this.published_at.getTime())) {
      throw new Error('valid published_at is required');
    }
    return true;
  }

  /**
   * Generate unique ID for deduplication
   */
  generateId() {
    return `${this.external_id}_${Date.now()}`;
  }
}

module.exports = {
  NewsAdapter,
  NormalizedArticle
};
