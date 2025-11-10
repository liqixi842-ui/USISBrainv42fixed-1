/**
 * USIS News v2.0 - ImpactRank 2.0 Scoring Engine
 * 
 * 7-Factor Scoring Algorithm:
 * 1. Freshness (0-1): Time decay from publication
 * 2. Source Quality (0-1): Based on tier (Tier 5 = 1.0, Tier 1 = 0.2)
 * 3. Relevance (0-1): Symbol match + keyword matching
 * 4. Impact (0-1): Detected impact keywords (earnings, M&A, etc.)
 * 5. Novelty (0-1): How unique/new this story is
 * 6. Corroboration (0-1): How many sources confirm this
 * 7. Attention (0-1): Social signals, views (future)
 * 
 * Composite Score: Weighted sum → 0-10 scale
 */

const { safeQuery } = require('./dbUtils');

class NewsScorer {
  constructor() {
    // Context-aware weights (can be adjusted based on market hours, user holdings, etc.)
    this.defaultWeights = {
      freshness: 0.20,
      source_quality: 0.20,
      relevance: 0.15,
      impact: 0.20,
      novelty: 0.10,
      corroboration: 0.10,
      attention: 0.05
    };

    // Impact keyword patterns
    this.impactPatterns = {
      earnings: { keywords: ['earnings', 'revenue', 'profit', 'eps', 'guidance', 'beat', 'miss'], weight: 1.0 },
      merger: { keywords: ['merger', 'acquisition', 'buyout', 'takeover', 'deal'], weight: 0.95 },
      bankruptcy: { keywords: ['bankruptcy', 'chapter 11', 'insolvency', 'default'], weight: 1.0 },
      lawsuit: { keywords: ['lawsuit', 'litigation', 'settlement', 'fraud', 'investigation'], weight: 0.75 },
      product: { keywords: ['launch', 'release', 'recall', 'approval', 'fda'], weight: 0.7 },
      executive: { keywords: ['ceo', 'cfo', 'resign', 'appoint', 'hire', 'fire'], weight: 0.65 },
      dividend: { keywords: ['dividend', 'buyback', 'split', 'distribution'], weight: 0.6 },
      upgrade: { keywords: ['upgrade', 'downgrade', 'rating', 'analyst', 'target'], weight: 0.55 },
      contract: { keywords: ['contract', 'partnership', 'agreement', 'collaboration'], weight: 0.5 }
    };
  }

  /**
   * Score a news article
   * @param {Object} article - Normalized article
   * @param {number} sourceTier - Source tier (1-5)
   * @param {Object} context - Scoring context (market hours, user holdings, etc.)
   * @returns {Object} Scoring result with individual factors and composite score
   */
  async scoreArticle(article, sourceTier, context = {}) {
    const scores = {
      freshness: this.calculateFreshness(article.published_at),
      source_quality: this.calculateSourceQuality(sourceTier),
      relevance: this.calculateRelevance(article, context.symbols || []),
      impact: this.calculateImpact(article),
      novelty: await this.calculateNovelty(article),
      corroboration: context.corroboration || 0,
      attention: 0 // Placeholder for future social signals
    };

    // Adjust weights based on context
    const weights = this.getContextualWeights(context);

    // Calculate composite score (0-10 scale)
    const composite = this.calculateComposite(scores, weights);

    return {
      scores,
      composite_score: composite,
      weights_used: weights,
      scoring_details: {
        context: context,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Freshness: Time decay from publication
   * 100% fresh in first 5 minutes, decays over 24 hours
   */
  calculateFreshness(publishedAt) {
    const ageMs = Date.now() - new Date(publishedAt).getTime();
    const ageMinutes = ageMs / (1000 * 60);

    // Ultra-fresh: first 5 minutes = 1.0
    if (ageMinutes < 5) return 1.0;
    
    // Fresh: 5-60 minutes = 0.9-0.8
    if (ageMinutes < 60) return 0.9 - (ageMinutes - 5) / 550;
    
    // Recent: 1-6 hours = 0.8-0.5
    if (ageMinutes < 360) return 0.8 - (ageMinutes - 60) / 600;
    
    // Aging: 6-24 hours = 0.5-0.2
    if (ageMinutes < 1440) return 0.5 - (ageMinutes - 360) / 3600;
    
    // Stale: >24 hours = 0.1-0
    if (ageMinutes < 2880) return 0.1 - (ageMinutes - 1440) / 14400;
    
    return 0;
  }

  /**
   * Source Quality: Based on tier + reliability score
   */
  calculateSourceQuality(tier) {
    const tierScores = {
      5: 1.0,   // Official/regulatory
      4: 0.85,  // Premium media
      3: 0.65,  // Industry/aggregators
      2: 0.40,  // Social media (verified)
      1: 0.20   // Social media (unverified)
    };

    return tierScores[tier] || 0.5;
  }

  /**
   * Relevance: Symbol matching + keyword relevance
   */
  calculateRelevance(article, userSymbols = []) {
    let score = 0;

    // Symbol match bonus
    if (article.primary_symbol && userSymbols.includes(article.primary_symbol)) {
      score += 0.5; // Strong match
    } else if (article.symbols && article.symbols.some(s => userSymbols.includes(s))) {
      score += 0.3; // Partial match
    }

    // Default relevance if user has no tracked symbols
    if (userSymbols.length === 0) {
      score = 0.5; // Neutral
    }

    // Title length bonus (longer titles often more specific)
    if (article.title.length > 100) {
      score += 0.1;
    }

    // Has summary bonus
    if (article.summary && article.summary.length > 100) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Impact: Detected impact keywords
   */
  calculateImpact(article) {
    const text = `${article.title} ${article.summary || ''}`.toLowerCase();
    let maxImpact = 0;

    for (const [category, config] of Object.entries(this.impactPatterns)) {
      for (const keyword of config.keywords) {
        if (text.includes(keyword)) {
          maxImpact = Math.max(maxImpact, config.weight);
          break; // One match per category
        }
      }
    }

    return maxImpact;
  }

  /**
   * Novelty: How unique is this story?
   * Based on topic diversity and recent coverage
   */
  async calculateNovelty(article) {
    try {
      // Check if similar topics recently covered
      const recentSimilar = await safeQuery(
        `SELECT COUNT(*) as count FROM news_items
         WHERE symbols && $1
         AND published_at > NOW() - INTERVAL '6 hours'`,
        [article.symbols || []]
      );

      const similarCount = parseInt(recentSimilar.rows[0].count);

      // High novelty if few similar stories
      if (similarCount === 0) return 1.0;
      if (similarCount === 1) return 0.8;
      if (similarCount <= 3) return 0.6;
      if (similarCount <= 5) return 0.4;
      return 0.2;

    } catch (error) {
      console.error('❌ [Scoring] Novelty calculation failed:', error.message);
      return 0.5; // Default to neutral
    }
  }

  /**
   * Calculate composite score (0-10 scale)
   */
  calculateComposite(scores, weights) {
    let weighted = 0;
    
    for (const [factor, score] of Object.entries(scores)) {
      weighted += score * (weights[factor] || 0);
    }

    // Scale to 0-10
    return Math.round(weighted * 100) / 10;
  }

  /**
   * Get contextual weights based on market conditions
   */
  getContextualWeights(context = {}) {
    const weights = { ...this.defaultWeights };

    // During market hours: boost freshness and impact
    if (context.isMarketHours) {
      weights.freshness = 0.25;
      weights.impact = 0.25;
      weights.source_quality = 0.15;
    }

    // User has holdings: boost relevance
    if (context.hasHoldings) {
      weights.relevance = 0.25;
      weights.freshness = 0.20;
      weights.impact = 0.20;
    }

    // Normalize weights to sum to 1.0
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    for (const key in weights) {
      weights[key] = weights[key] / sum;
    }

    return weights;
  }

  /**
   * Store scoring results in database
   */
  async storeScore(newsItemId, scoringResult) {
    try {
      const { scores, composite_score, scoring_details } = scoringResult;

      await safeQuery(
        `INSERT INTO news_scores 
         (news_item_id, freshness, source_quality, relevance, impact, novelty, corroboration, attention, composite_score, scoring_details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (news_item_id) DO UPDATE
         SET composite_score = EXCLUDED.composite_score, scored_at = NOW()`,
        [
          newsItemId,
          scores.freshness,
          scores.source_quality,
          scores.relevance,
          scores.impact,
          scores.novelty,
          scores.corroboration,
          scores.attention,
          composite_score,
          JSON.stringify(scoring_details)
        ]
      );

      console.log(`📊 [Scoring] Stored score ${composite_score}/10 for ${newsItemId}`);
      return true;

    } catch (error) {
      console.error('❌ [Scoring] Failed to store score:', error.message);
      return false;
    }
  }
}

// Singleton instance
let scorerInstance = null;

function getScorer() {
  if (!scorerInstance) {
    scorerInstance = new NewsScorer();
  }
  return scorerInstance;
}

module.exports = {
  NewsScorer,
  getScorer
};
