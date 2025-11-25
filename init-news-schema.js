/**
 * USIS News v2.0 - Database Schema Initialization
 * 
 * Standalone script to create news system tables
 * Run: node init-news-schema.js
 */

const { Pool } = require('pg');

async function initNewsSchema() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not configured');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🔌 Connecting to database...');
    
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected');

    console.log('\n📰 Creating USIS News System tables...');

    // Create all news tables
    await pool.query(`
      -- 新闻源配置表（5层分级：官方/一线媒体/行业权威/聚合/社交）
      CREATE TABLE IF NOT EXISTS news_sources (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        tier INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 5),
        reliability_score DECIMAL(2,1) CHECK (reliability_score BETWEEN 1.0 AND 5.0),
        fetch_config JSONB,
        rate_limit_per_hour INTEGER DEFAULT 60,
        enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      -- 新闻条目表（存储采集的新闻）
      CREATE TABLE IF NOT EXISTS news_items (
        id TEXT PRIMARY KEY,
        source_id INTEGER REFERENCES news_sources(id),
        external_id TEXT,
        title TEXT NOT NULL,
        summary TEXT,
        body TEXT,
        url TEXT NOT NULL UNIQUE,
        published_at TIMESTAMPTZ NOT NULL,
        fetched_at TIMESTAMPTZ DEFAULT NOW(),
        primary_symbol TEXT,
        symbols TEXT[],
        entities JSONB,
        region TEXT,
        lang TEXT DEFAULT 'en',
        tags JSONB DEFAULT '[]'
      );
      CREATE INDEX IF NOT EXISTS idx_news_items_published ON news_items(published_at DESC);
      CREATE INDEX IF NOT EXISTS idx_news_items_symbol ON news_items USING GIN(symbols);
      CREATE INDEX IF NOT EXISTS idx_news_items_url_hash ON news_items(MD5(url));
      CREATE INDEX IF NOT EXISTS idx_news_items_source_id ON news_items(source_id);
      
      -- 新闻评分表（ImpactRank 2.0 - 7因子评分）
      CREATE TABLE IF NOT EXISTS news_scores (
        news_item_id TEXT PRIMARY KEY REFERENCES news_items(id),
        freshness DECIMAL(3,2) CHECK (freshness BETWEEN 0 AND 1),
        source_quality DECIMAL(3,2) CHECK (source_quality BETWEEN 0 AND 1),
        relevance DECIMAL(3,2) CHECK (relevance BETWEEN 0 AND 1),
        impact DECIMAL(3,2) CHECK (impact BETWEEN 0 AND 1),
        novelty DECIMAL(3,2) CHECK (novelty BETWEEN 0 AND 1),
        corroboration DECIMAL(3,2) CHECK (corroboration BETWEEN 0 AND 1),
        attention DECIMAL(3,2) CHECK (attention BETWEEN 0 AND 1),
        composite_score DECIMAL(4,2) CHECK (composite_score BETWEEN 0 AND 10),
        scoring_details JSONB,
        scored_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_news_scores_composite ON news_scores(composite_score DESC);
      
      -- 新闻路由状态表（Fastlane/2h/4h分桶）
      CREATE TABLE IF NOT EXISTS news_routing_state (
        news_item_id TEXT PRIMARY KEY REFERENCES news_items(id),
        channel TEXT NOT NULL CHECK (channel IN ('fastlane', 'digest_2h', 'digest_4h')),
        status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'suppressed')) DEFAULT 'pending',
        routed_at TIMESTAMPTZ DEFAULT NOW(),
        fade_level INTEGER DEFAULT 0,
        upgrade_flag BOOLEAN DEFAULT false,
        last_updated TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_news_routing_channel ON news_routing_state(channel, status);
      
      -- 推送历史表（记录每条新闻的推送情况）
      CREATE TABLE IF NOT EXISTS news_push_history (
        id SERIAL PRIMARY KEY,
        news_item_id TEXT REFERENCES news_items(id),
        channel TEXT NOT NULL CHECK (channel IN ('fastlane', 'digest_2h', 'digest_4h')),
        sent_at TIMESTAMPTZ DEFAULT NOW(),
        message_id TEXT,
        outcome TEXT CHECK (outcome IN ('success', 'failed', 'throttled')),
        error_message TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_news_push_news_id ON news_push_history(news_item_id);
      CREATE INDEX IF NOT EXISTS idx_news_push_sent ON news_push_history(sent_at DESC);
      
      -- 去重缓存表（24小时去重窗口）
      CREATE TABLE IF NOT EXISTS news_dedupe_cache (
        external_id TEXT PRIMARY KEY,
        url_hash TEXT NOT NULL,
        topic_hash TEXT,
        first_seen_at TIMESTAMPTZ DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ DEFAULT NOW(),
        authority_level INTEGER DEFAULT 1,
        seen_count INTEGER DEFAULT 1
      );
      CREATE INDEX IF NOT EXISTS idx_news_dedupe_topic ON news_dedupe_cache(topic_hash);
      CREATE INDEX IF NOT EXISTS idx_news_dedupe_first_seen ON news_dedupe_cache(first_seen_at DESC);
      CREATE INDEX IF NOT EXISTS idx_news_dedupe_url_hash ON news_dedupe_cache(url_hash);
      
      -- AI分析师点评表（Claude/GPT-4o生成的专业点评）
      CREATE TABLE IF NOT EXISTS news_analyst_notes (
        id SERIAL PRIMARY KEY,
        news_item_id TEXT REFERENCES news_items(id),
        model TEXT NOT NULL,
        content_zh TEXT,
        content_en TEXT,
        action_hint TEXT,
        confidence DECIMAL(3,2),
        generated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_news_analyst_news_id ON news_analyst_notes(news_item_id);
    `);

    console.log('✅ All news tables created successfully');

    // Verify tables exist
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'news_%'
      ORDER BY table_name
    `);

    console.log('\n📋 News tables in database:');
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });

    console.log('\n🎉 News System schema initialized successfully!');

  } catch (error) {
    console.error('❌ Failed to initialize schema:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  initNewsSchema()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('💥 Schema initialization crashed:', err);
      process.exit(1);
    });
}

module.exports = { initNewsSchema };
