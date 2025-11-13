// ====== USIS Brain · v6.0（多AI模型 + 多语言分析 + 数据驱动投研） ======

// Global error handlers（不退出进程，保持应用运行）
process.on('unhandledRejection', (err) => {
  console.error('[ERROR] UnhandledRejection:', err.message);
  console.error(err.stack);
});
process.on('uncaughtException', (err) => {
  console.error('[ERROR] UncaughtException:', err.message);
  console.error(err.stack);
});

const express = require("express");
const fetch = require("node-fetch");
const { Pool } = require("pg");
const cron = require("node-cron");
// 🛡️ v6.1: Telegraf moved to conditional loading (see line ~5575)

// 🆕 ScreenshotAPI配置（自动去除前后空格）
const SCREENSHOT_API_KEY = (process.env.SCREENSHOT_API_KEY || '').trim();
if (!SCREENSHOT_API_KEY) {
  console.warn('⚠️  SCREENSHOT_API_KEY 未配置，TradingView截图将降级到QuickChart');
} else {
  console.log(`✅ ScreenshotAPI已配置 (Key长度: ${SCREENSHOT_API_KEY.length})`);
}

// 🆕 智能Orchestrator模块（v3.1）
const { parseUserIntent } = require("./semanticIntentAgent");
const { resolveSymbols } = require("./symbolResolver");
const { fetchMarketData, validateDataForAnalysis } = require("./dataBroker");
const { buildAnalysisPrompt, buildErrorResponse } = require("./analysisPrompt");
const { validateResponse, generateCorrectionSuggestion } = require("./complianceGuard");
const { fetchAndRankNews, formatNewsOutput } = require("./newsBroker");
const { formatResponse, validateOutputCompliance, extractStructuredContent } = require("./responseFormatter");
const { generateWithGPT5, wrapAsV31Synthesis } = require("./gpt5Brain"); // 🆕 v4.0: GPT-5单核引擎

// 🆕 v6.0: 多AI模型与多语言分析引擎
const MultiLanguageAnalyzer = require('./multiLanguageAnalyzer');
// 🛡️ v6.1: 懒加载多AI Provider（节省内存）
const getMultiAIProvider = () => require('./multiAiProvider').getMultiAIProvider();

// 🆕 v4.3: 智能热力图解析器
const { extractHeatmapQuery, extractHeatmapQueryRulesOnly, buildTradingViewURL, generateHeatmapSummary, generateCaption, generateDebugReport } = require("./heatmapIntentParser");
// 🛡️ v6.1: 懒加载热力图服务（节省内存）
const generateSmartHeatmap = (...args) => require("./heatmapService").generateSmartHeatmap(...args);
// 🆕 v5.0: 个股图表服务（K线图分析）
const { generateStockChart, formatStockData } = require("./stockChartService");
// 🛡️ v6.1: 懒加载N8N Client（节省内存）
const getN8NClient = () => require("./n8nClient").getN8NClient();
// 🆕 v2.0: 智能对话状态管理
const { dialogueManager } = require("./dialogueManager");
// 🆕 v6.2: 智能对话系统（处理greeting/help/casual对话）
const { handleConversation, isGreeting, isHelpRequest, isSystemCommand } = require("./conversationAgent");

const app = express();
app.set('trust proxy', 1);

// 🆕 App startup timestamp for uptime calculation
const APP_START_TIME = Date.now();

// 🆕 Simple health check endpoint (before middleware)
app.get('/health', (_req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - APP_START_TIME) / 1000);
  res.status(200).json({
    ok: true,
    status: 'ok',
    pid: process.pid,
    port: Number(process.env.PORT) || 8080,
    uptime: uptimeSeconds,
    ts: Date.now(),
    message: 'HTTPS verified and healthy ✅'
  });
});

app.use(express.json());

// 🛡️ v6.1: Feature Flags (Dev环境内存优化)
const ENABLE_DB = process.env.ENABLE_DB !== 'false'; // 默认启用
const ENABLE_TELEGRAM = process.env.ENABLE_TELEGRAM !== 'false'; // 默认启用

console.log(`🏴 Feature Flags: DB=${ENABLE_DB}, Telegram=${ENABLE_TELEGRAM}`);

// 🆕 v1.1: 增强数据库连接池管理（查询超时+生命周期钩子+健康检查）
let pool = null;
const DB_QUERY_TIMEOUT_MS = 20000; // 20秒查询超时（新闻查询优化）

function getPool() {
  if (!ENABLE_DB) {
    throw new Error('Database disabled (ENABLE_DB=false)');
  }
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL not found");
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 10, // 最大连接数
      idleTimeoutMillis: 30000, // 30秒空闲超时
      connectionTimeoutMillis: 5000 // 5秒连接超时
      // 🔧 移除statement_timeout（Neon不支持启动参数）
      // 改为在每个连接建立后设置
    });
    
    // 🆕 v1.1: 连接建立后设置statement_timeout（Neon兼容）
    pool.on('connect', (client) => {
      client.query(`SET statement_timeout = ${DB_QUERY_TIMEOUT_MS}`, (err) => {
        if (err) {
          console.error('❌ [DB Pool] 设置statement_timeout失败:', err.message);
        }
      });
    });
    
    // 错误日志
    pool.on('error', (err, client) => {
      console.error('❌ [DB Pool] 连接池错误:', err.message);
    });
    
    // 连接日志（仅开发环境）
    if (process.env.NODE_ENV !== 'production') {
      pool.on('connect', () => {
        console.log('🔌 [DB Pool] 新连接已建立');
      });
      pool.on('remove', () => {
        console.log('🔌 [DB Pool] 连接已移除');
      });
    }
    
    console.log('🔄 [LazyLoad] PostgreSQL连接池已创建（max=10, timeout=8s）');
  }
  return pool;
}

// 🆕 v1.1: 安全查询包装器（自动超时保护）
async function safeQuery(queryText, params = []) {
  if (!ENABLE_DB) {
    throw new Error('Database disabled (ENABLE_DB=false)');
  }
  
  const dbPool = getPool();
  const startTime = Date.now();
  
  try {
    const result = await dbPool.query(queryText, params);
    const duration = Date.now() - startTime;
    
    if (duration > 3000) { // 慢查询警告（3秒）
      console.warn(`⚠️  [DB] 慢查询 (${duration}ms): ${queryText.substring(0, 50)}...`);
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (error.message.includes('timeout') || error.message.includes('canceled')) {
      console.error(`⏱️  [DB] 查询超时 (${duration}ms): ${queryText.substring(0, 50)}...`);
    } else {
      console.error(`❌ [DB] 查询失败 (${duration}ms):`, error.message);
    }
    
    throw error;
  }
}

// 🆕 v1.1: 数据库健康检查（带重试）
async function checkDatabaseHealth() {
  if (!ENABLE_DB) {
    return { healthy: false, reason: 'Database disabled (ENABLE_DB=false)' };
  }
  
  const maxRetries = 3;
  const retryDelay = 1000; // 1秒
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const startTime = Date.now();
      // 🔧 使用safeQuery并确保pool已初始化
      const result = await safeQuery('SELECT NOW() as health_check_time');
      const duration = Date.now() - startTime;
      
      return {
        healthy: true,
        responseTime: duration,
        timestamp: result.rows[0].health_check_time
      };
    } catch (error) {
      console.warn(`⚠️  [DB Health] 检查失败 (尝试${i + 1}/${maxRetries}):`, error.message);
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  return { healthy: false, reason: 'Health check failed after retries' };
}

// 🆕 v1.1: 优雅关闭数据库连接池
async function shutdownDatabase() {
  if (pool) {
    console.log('🔌 [DB] 正在关闭连接池...');
    try {
      await pool.end();
      console.log('✅ [DB] 连接池已安全关闭');
    } catch (error) {
      console.error('❌ [DB] 关闭连接池失败:', error.message);
    }
  }
}

// 🆕 v1.1: SIGTERM/SIGINT生命周期钩子
process.on('SIGTERM', async () => {
  console.log('📡 收到SIGTERM信号，准备优雅关闭...');
  await shutdownDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('📡 收到SIGINT信号，准备优雅关闭...');
  await shutdownDatabase();
  process.exit(0);
});

// Initialize database table with retry logic for Neon auto-wake
async function initDatabase() {
  if (!ENABLE_DB || !process.env.DATABASE_URL) {
    console.log("ℹ️  Skipping database initialization (disabled or no URL)");
    return;
  }

  const maxRetries = 5;
  const baseDelay = 2000; // 2 seconds
  
  // 🛡️ v6.1: 使用懒加载连接池
  const dbPool = getPool();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔌 [尝试 ${attempt}/${maxRetries}] 连接数据库...`);
      
      // Step 1: Wake up the database with a simple query
      const wakeResult = await safeQuery('SELECT NOW() as wake_time');
      console.log(`✅ 数据库已唤醒！时间: ${wakeResult.rows[0].wake_time}`);
      
      // Step 2: Create tables
      await safeQuery(`
        CREATE TABLE IF NOT EXISTS user_memory (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          timestamp TIMESTAMPTZ DEFAULT NOW(),
          request_text TEXT,
          mode TEXT,
          symbols TEXT[],
          response_text TEXT,
          chat_type TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_user_memory_user_id ON user_memory(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_memory_timestamp ON user_memory(timestamp DESC);
        
        CREATE TABLE IF NOT EXISTS cost_tracking (
          id SERIAL PRIMARY KEY,
          request_id TEXT,
          user_id TEXT,
          timestamp TIMESTAMPTZ DEFAULT NOW(),
          mode TEXT,
          models JSONB,
          estimated_cost DECIMAL(10,4),
          actual_cost DECIMAL(10,4),
          response_time_ms INTEGER
        );
        
        -- 迁移：为现有表添加request_id列（如果不存在）
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='cost_tracking' AND column_name='request_id'
          ) THEN
            ALTER TABLE cost_tracking ADD COLUMN request_id TEXT;
          END IF;
        END $$;
        
        CREATE INDEX IF NOT EXISTS idx_cost_tracking_user ON cost_tracking(user_id);
        CREATE INDEX IF NOT EXISTS idx_cost_tracking_request ON cost_tracking(request_id);
        CREATE INDEX IF NOT EXISTS idx_cost_tracking_time ON cost_tracking(timestamp DESC);
        
        -- 🆕 News System Tables (USIS News v2.0)
        
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
      
      console.log("✅ 数据库初始化完成: user_memory, cost_tracking 和 USIS News 表已就绪");
      return; // Success, exit the retry loop
      
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      const errorMsg = error.message || String(error);
      
      if (errorMsg.includes('endpoint has been disabled') || errorMsg.includes('suspended')) {
        console.log(`⏳ [尝试 ${attempt}/${maxRetries}] 数据库休眠中，正在唤醒...`);
      } else {
        console.error(`❌ [尝试 ${attempt}/${maxRetries}] 数据库错误: ${errorMsg}`);
      }
      
      if (isLastAttempt) {
        console.error(`💔 数据库初始化失败（已重试${maxRetries}次）`);
        console.error(`⚠️  Brain将在无数据库模式下运行（记忆功能禁用）`);
        return;
      }
      
      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`⏱️  ${delay/1000}秒后重试...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Initialize database on startup (async, non-blocking)
initDatabase().catch(err => {
  console.error("💥 数据库初始化异常:", err.message);
});

// 🆕 v4.2: 增强统计系统（P50/P95延迟 + 缓存统计）
const stats = {
  requests: 0,
  success: 0,
  failures: 0,
  total_latency: 0,
  fallback_count: 0,
  model_usage: {}, // { 'gpt-5-mini': 5, 'gpt-4o': 2, ... }
  uptime_start: Date.now(),
  // 🆕 v4.2
  latency_history: [], // 最近100次请求延迟（用于P50/P95计算）
  cache_hits: 0,
  cache_total: 0
};

function recordRequest(success, latency_ms, model_used, fallback_used, cache_stats) {
  stats.requests++;
  if (success) {
    stats.success++;
  } else {
    stats.failures++;
  }
  stats.total_latency += latency_ms;
  if (fallback_used) {
    stats.fallback_count++;
  }
  if (model_used) {
    stats.model_usage[model_used] = (stats.model_usage[model_used] || 0) + 1;
  }
  
  // 🆕 v4.2: 记录延迟历史（滑窗最多100条）
  stats.latency_history.push(latency_ms);
  if (stats.latency_history.length > 100) {
    stats.latency_history.shift(); // 移除最旧的
  }
  
  // 🆕 v4.2: 缓存统计
  if (cache_stats) {
    stats.cache_hits += cache_stats.hits || 0;
    stats.cache_total += cache_stats.total || 0;
  }
}

// 🆕 v4.2: 计算P50/P95延迟
function calculatePercentile(values, percentile) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * percentile) - 1;
  return sorted[Math.max(0, index)];
}

// 添加请求日志中间件（用于调试Cloud Run健康检查）
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path} from ${req.ip || req.connection.remoteAddress}`);
  next();
});

const CLAUDE_KEY   = process.env.CLAUDE_API_KEY;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const MJAPI_KEY    = process.env.MJAPI_KEY;

// Image generation config
const IMAGE_PROVIDER = process.env.IMAGE_PROVIDER || "replicate";
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const MJ_RELAY_URL = process.env.MJ_RELAY_URL;

// Twitter API config
const TWITTER_BEARER = process.env.TWITTER_BEARER;

// Log token status on startup
if (REPLICATE_API_TOKEN) {
  console.log("✅ Using Replicate token:", REPLICATE_API_TOKEN.substring(0, 10) + "...");
} else {
  console.warn("⚠️  REPLICATE_API_TOKEN not found in environment");
}

if (TWITTER_BEARER) {
  console.log("✅ Twitter Bearer token configured");
} else {
  console.warn("⚠️  TWITTER_BEARER not found in environment");
}

// ---- Health
app.get("/", (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>USIS Brain v6.0 - 运行中</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      padding: 40px;
      max-width: 650px;
      width: 100%;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }
    h1 {
      margin: 0 0 10px 0;
      font-size: 2.5em;
      text-align: center;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
    }
    .status {
      display: inline-block;
      background: #10b981;
      color: white;
      padding: 5px 15px;
      border-radius: 20px;
      font-size: 0.9em;
      margin-bottom: 25px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    .info {
      background: rgba(255, 255, 255, 0.15);
      padding: 20px;
      border-radius: 12px;
      margin-bottom: 15px;
      transition: transform 0.2s;
    }
    .info:hover {
      transform: translateY(-2px);
      background: rgba(255, 255, 255, 0.2);
    }
    .info h3 {
      margin: 0 0 12px 0;
      font-size: 1.2em;
      border-bottom: 2px solid rgba(255,255,255,0.3);
      padding-bottom: 8px;
    }
    .info p {
      margin: 8px 0;
      opacity: 0.95;
      line-height: 1.5;
    }
    a {
      color: #fbbf24;
      text-decoration: none;
      font-weight: 500;
    }
    a:hover {
      text-decoration: underline;
    }
    .badge {
      display: inline-block;
      background: rgba(255,255,255,0.2);
      padding: 3px 10px;
      border-radius: 10px;
      font-size: 0.85em;
      margin: 3px 5px 3px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 USIS Brain v6.0</h1>
    <center><span class="status">✅ 服务运行中</span></center>
    
    <div class="info">
      <h3>💬 Telegram Bot 状态</h3>
      <p>✅ <strong>已激活并等待消息</strong></p>
      <p>您可以直接在Telegram中发送消息与我对话</p>
    </div>
    
    <div class="info">
      <h3>🤖 AI模型编排系统</h3>
      <p>
        <span class="badge">GPT-4o</span>
        <span class="badge">Claude 3.5</span>
        <span class="badge">Gemini 2.5</span>
      </p>
      <p>
        <span class="badge">DeepSeek V3</span>
        <span class="badge">Mistral</span>
        <span class="badge">Perplexity</span>
      </p>
    </div>
    
    <div class="info">
      <h3>📊 API端点</h3>
      <p><a href="/health" target="_blank">/health</a> - 服务健康检查</p>
      <p><a href="/brain/stats" target="_blank">/brain/stats</a> - 运行统计</p>
      <p><a href="/api/test-heatmap" target="_blank">/api/test-heatmap</a> - 市场热力图测试</p>
    </div>
    
    <div class="info">
      <h3>🔧 最近更新 (Nov 2025)</h3>
      <p>✅ 交互式符号选择（歧义股票Telegram按钮确认）</p>
      <p>✅ Finnhub免费版优化（欧洲股票ADR映射）</p>
      <p>✅ 智能API驱动的全球股票解析系统</p>
    </div>
  </div>
</body>
</html>`);
});

// 🆕 v4.2: 增强Stats端点（P50/P95延迟 + 缓存统计）
app.get("/brain/stats", (_req, res) => {
  const uptime_s = Math.floor((Date.now() - stats.uptime_start) / 1000);
  const success_rate = stats.requests > 0 ? (stats.success / stats.requests) : 0;
  const avg_latency_ms = stats.requests > 0 ? Math.floor(stats.total_latency / stats.requests) : 0;
  const fallback_rate = stats.requests > 0 ? (stats.fallback_count / stats.requests) : 0;
  
  // 🆕 v4.2: P50/P95延迟计算
  const p50_latency_ms = calculatePercentile(stats.latency_history, 0.50);
  const p95_latency_ms = calculatePercentile(stats.latency_history, 0.95);
  
  // 🆕 v4.2: 缓存命中率
  const cache_hit_rate = stats.cache_total > 0 
    ? (stats.cache_hits / stats.cache_total) 
    : 0;
  
  res.json({
    status: "ok",
    version: "v4.2",
    uptime_s,
    requests: stats.requests,
    success: stats.success,
    failures: stats.failures,
    success_rate: (success_rate * 100).toFixed(2) + '%',
    avg_latency_ms,
    fallback_count: stats.fallback_count,
    fallback_rate: (fallback_rate * 100).toFixed(2) + '%',
    model_usage: stats.model_usage,
    // 🆕 v4.2: 延迟分布
    latency: {
      avg_ms: avg_latency_ms,
      p50_ms: Math.floor(p50_latency_ms),
      p95_ms: Math.floor(p95_latency_ms),
      samples: stats.latency_history.length
    },
    // 🆕 v4.2: 缓存统计
    cache: {
      hits: stats.cache_hits,
      total: stats.cache_total,
      hit_rate: (cache_hit_rate * 100).toFixed(1) + '%'
    }
  });
});

app.get("/health", async (_req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    
    let n8nHealth;
    try {
      const n8nClient = getN8NClient();
      n8nHealth = await n8nClient.healthCheck();
    } catch (n8nError) {
      console.warn('[Health] N8N health check failed:', n8nError.message);
      n8nHealth = { healthy: false, reason: n8nError.message };
    }
    
    const isHealthy = !ENABLE_DB || dbHealth.healthy;
    
    res.status(200).json({ 
      ok: true,
      status: isHealthy ? 'ok' : 'degraded',
      ts: Date.now(),
      database: ENABLE_DB ? dbHealth : { healthy: true, reason: 'Database disabled' },
      n8n: n8nHealth
    });
  } catch (error) {
    console.error('[Health] Health check failed:', error.message);
    res.status(200).json({
      ok: true,
      status: 'degraded',
      ts: Date.now(),
      error: error.message
    });
  }
});

// 🆕 请求状态监控端点
app.get("/health/requests", (_req, res) => {
  const activeRequests = Array.from(requestTracker.entries()).map(([id, data]) => ({
    requestId: id,
    status: data.status,
    stage: data.stage,
    user_id: data.user_id,
    elapsed_ms: Date.now() - data.startTime,
    text_preview: data.text
  }));
  
  res.json({
    ok: true,
    activeRequests: activeRequests.length,
    requests: activeRequests,
    timestamp: Date.now()
  });
});

app.get("/version", (_req, res) => {
  res.json({ version: 'v4.2_fixed', status: 'stable' });
});

app.post("/brain/ping", (req, res) => {
  res.json({ status: 'ok', echo: req.body || {} });
});

// ---- Feed Receiver: 接收 n8n 发来的行情+新闻数据
app.post("/brain/feed", (req, res) => {
  try {
    console.log("📥 收到 n8n 数据:", JSON.stringify(req.body, null, 2));
    res.json({ ok: true, received: req.body });
  } catch (err) {
    console.error("❌ feed 错误:", err);
    res.json({ ok: false, error: err.message });
  }
});

// ---- 🆕 v6.3: News Ingest API - 接收N8N采集的新闻数据
const { NewsIngestAPI } = require('./newsIngestAPI');
let newsIngestAPI = null;

app.post("/api/news/ingest", async (req, res) => {
  try {
    // 1. Authentication check
    const expectedSecret = process.env.NEWS_INGESTION_SECRET;
    const authHeader = req.headers['authorization'] || req.headers['x-api-key'] || req.headers['x-news-secret'];
    
    if (!NewsIngestAPI.validateAuth(authHeader, expectedSecret)) {
      console.warn('⚠️  [NewsIngestAPI] Unauthorized request rejected');
      return res.status(401).json({
        ok: false,
        error: 'Unauthorized: Missing or invalid API key',
        stage: 'authentication'
      });
    }

    // 2. Lazy initialization
    if (!newsIngestAPI) {
      // 🆕 v6.4: 直接使用TELEGRAM_BOT_TOKEN
      const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
      const newsChannelId = process.env.NEWS_CHANNEL_ID;
      newsIngestAPI = new NewsIngestAPI(telegramToken, newsChannelId);
    }

    // 3. Process news
    const newsData = req.body;
    const result = await newsIngestAPI.processNews(newsData);

    // 4. Return with appropriate HTTP status
    const httpStatus = result.httpStatus || (result.ok ? 200 : 500);
    return res.status(httpStatus).json(result);

  } catch (err) {
    console.error("❌ [NewsIngestAPI] Error:", err);
    return res.status(500).json({
      ok: false,
      error: err.message,
      stage: 'api_error'
    });
  }
});

// ---- 🆕 v6.3: Manual RSS Collection Trigger
app.post("/api/news/collect-rss", async (req, res) => {
  try {
    // Authentication check
    const expectedSecret = process.env.NEWS_INGESTION_SECRET;
    const authHeader = req.headers['authorization'] || req.headers['x-api-key'] || req.headers['x-news-secret'];
    
    if (!NewsIngestAPI.validateAuth(authHeader, expectedSecret)) {
      return res.status(401).json({
        ok: false,
        error: 'Unauthorized: Missing or invalid API key'
      });
    }

    // Trigger RSS collection
    const RSSCollector = require('./rssCollector');
    const rssCollector = new RSSCollector();
    
    console.log('📡 [API] Manual RSS collection triggered');
    const result = await rssCollector.run();
    
    return res.status(200).json({
      ok: true,
      message: 'RSS collection completed',
      ...result
    });

  } catch (err) {
    console.error("❌ [RSS API] Error:", err);
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

// ---- Midjourney Imagine: 转发 prompt 到 Midjourney API
app.post("/mj/imagine", async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.json({ ok: false, error: "缺少 prompt 参数" });
    }

    if (!MJAPI_KEY) {
      return res.json({ ok: false, error: "MJAPI_KEY 环境变量未设置" });
    }

    console.log("🎨 Midjourney Imagine:", prompt);

    const response = await fetch("https://api.mjapi.pro/v2/imagine", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MJAPI_KEY}`
      },
      body: JSON.stringify({
        prompt: prompt,
        mode: "fast",
        ratio: "16:9"
      })
    });

    const data = await response.json();
    
    console.log("✅ Midjourney 响应:", response.status);

    res.json({ ok: true, data: data });
  } catch (err) {
    console.error("❌ Midjourney 错误:", err);
    res.json({ ok: false, error: err.message });
  }
});

// ---- Image Generation Health Check
app.get("/img/health", (_req, res) => {
  res.json({ provider: IMAGE_PROVIDER, ok: true });
});

// ---- Twitter Search: 搜索 Twitter 推文
app.get("/social/twitter/search", async (req, res) => {
  try {
    // Check TWITTER_BEARER token
    if (!TWITTER_BEARER) {
      return res.json({ ok: false, error: "MISSING_TWITTER_BEARER" });
    }

    const query = req.query.query;
    const maxResults = parseInt(req.query.max_results) || 20;

    if (!query) {
      return res.json({ ok: false, error: "MISSING_QUERY_PARAMETER" });
    }

    console.log(`🐦 Twitter search: query="${query}", max_results=${maxResults}`);

    // Build Twitter API URL with parameters
    const tweetFields = "created_at,public_metrics,lang,author_id,source";
    const apiUrl = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=${maxResults}&tweet.fields=${tweetFields}`;

    // Call Twitter API with 60s timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(apiUrl, {
      headers: {
        "Authorization": `Bearer ${TWITTER_BEARER}`,
        "Content-Type": "application/json"
      },
      signal: controller.signal
    });

    clearTimeout(timeout);

    const data = await response.json();

    // Check for API errors
    if (!response.ok || data.errors) {
      console.error("❌ Twitter API error:", JSON.stringify(data, null, 2));
      return res.json({
        ok: false,
        error: "TWITTER_API_ERROR",
        raw: data
      });
    }

    // Process tweets: calculate score and format
    const tweets = data.data || [];
    const processed = tweets.map(tweet => {
      const metrics = tweet.public_metrics || {};
      const score = (metrics.retweet_count || 0) + (metrics.like_count || 0);
      
      return {
        id: tweet.id,
        text: tweet.text,
        created_at: tweet.created_at,
        score: score
      };
    });

    // Sort by score (descending) and take top 5
    const topTweets = processed
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    console.log(`✅ Found ${tweets.length} tweets, returning top ${topTweets.length}`);

    return res.json({
      ok: true,
      items: topTweets
    });

  } catch (err) {
    console.error("❌ Twitter search error:", err);
    
    if (err.name === 'AbortError') {
      return res.json({ ok: false, error: "TWITTER_TIMEOUT" });
    }
    
    return res.json({ 
      ok: false, 
      error: err.message,
      raw: err.toString()
    });
  }
});

// ---- Heatmap Generator: 自建热力图
app.get("/heatmap", async (req, res) => {
  try {
    const market = req.query.market || 'usa';
    const index = req.query.index || '';  // 新增：支持指定具体指数
    console.log(`📊 生成热力图: market=${market}, index=${index}`);

    // 定义各市场的主要股票（使用美股ticker和ADR）
    const marketStocks = {
      usa: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'JPM', 'V', 'JNJ', 'WMT', 'PG', 'MA', 'HD', 'DIS', 'BAC', 'NFLX', 'ADBE', 'CRM'],
      spain: ['TEF', 'SAN', 'BBVA', 'IBE', 'ITX', 'REP', 'ACS', 'FER', 'ENG', 'SAB'],
      germany: ['SAP', 'SIEGY', 'BASFY', 'BAYRY', 'DDAIF', 'VOW', 'BMWYY', 'ALIZY', 'DHRTY', 'MUV2'],
      japan: ['TM', 'SONY', 'MSBHF', 'HMC', 'SMFG', 'MTU', 'FUJIY', 'NTDOY', 'HTHIY', 'PCRFY'],
      uk: ['BP', 'HSBC', 'AZN', 'SHEL', 'GSK', 'RIO', 'ULVR', 'DGE', 'RELX', 'NG'],
      hongkong: ['BABA', 'TCEHY', '0700.HK', '0005.HK', '0001.HK', '0388.HK', '0939.HK', '2318.HK', '0883.HK', '0016.HK'],
      china: ['BABA', 'JD', 'BIDU', 'PDD', 'NIO', 'XPEV', 'LI', 'TME', 'BILI', 'IQ'],
      france: ['OR', 'BNP', 'SAN', 'AIR', 'AXA', 'DANOY', 'LVMUY', 'PUGOY', 'SAFRY', 'VIVHY'],
      europe: ['ASML', 'NVO', 'LVMUY', 'SAP', 'NESN', 'OR', 'SIEGY', 'RHHBY', 'AZN', 'NOVN', 'BP', 'SHEL', 'HSBC', 'BNP', 'SAN', 'BAYRY', 'BASFY', 'VOW', 'ITX', 'REP'],
      world: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'BABA', 'TSM', 'V', 'JNJ', 'WMT', 'JPM', 'MA', 'PG', 'LVMUY', 'NVO', 'TM', 'ASML', 'NSRGY', 'SAP']
    };

    const stocks = marketStocks[market] || marketStocks.usa;
    const FINNHUB_KEY = process.env.FINNHUB_API_KEY;

    if (!FINNHUB_KEY) {
      return res.send('<h1>FINNHUB_API_KEY not configured</h1>');
    }

    // 并行获取所有股票的实时数据
    const promises = stocks.map(async (symbol) => {
      try {
        const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`);
        const data = await response.json();
        
        if (data.c && data.pc) {  // c=当前价格, pc=前收盘价
          const change = ((data.c - data.pc) / data.pc) * 100;
          return {
            symbol,
            price: data.c,
            change: change.toFixed(2),
            value: Math.abs(change)  // 用于调整方块大小
          };
        }
        return null;
      } catch (err) {
        console.error(`获取${symbol}数据失败:`, err.message);
        return null;
      }
    });

    const results = await Promise.all(promises);
    const validStocks = results.filter(item => item !== null);

    // 生成HTML热力图
    const html = generateHeatmapHTML(validStocks, market, index);
    res.send(html);

  } catch (err) {
    console.error("❌ 热力图生成错误:", err);
    res.send(`<h1>Error: ${err.message}</h1>`);
  }
});

// 🆕 生成真实的热力图图片（QuickChart + Finnhub实时数据）
async function generateHeatmapImage(exchangeName = 'US') {
  try {
    console.log(`📊 生成实时热力图: ${exchangeName}`);
    
    const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
    if (!FINNHUB_KEY) {
      console.warn('⚠️ FINNHUB_API_KEY未配置，使用模拟数据');
      return generateFallbackHeatmap(exchangeName);
    }
    
    // 主要市场股票列表
    const marketSymbols = {
      'US': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'V', 'WMT', 'UNH', 'JNJ', 'XOM', 'PG', 'MA', 'HD', 'CVX', 'LLY', 'ABBV', 'BAC'],
      'USA': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'V', 'WMT', 'UNH', 'JNJ', 'XOM', 'PG', 'MA', 'HD', 'CVX', 'LLY', 'ABBV', 'BAC'],
      'United States': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'V', 'WMT'],
      'Europe': ['ASML.AS', 'MC.PA', 'SAP', 'TTE.PA', 'NOVO-B.CO', 'SIE.DE', 'OR.PA', 'ADS.DE', 'AIR.PA'],
      'China': ['BABA', '9988.HK', 'JD', 'BIDU', 'NIO', 'XPEV', 'LI', 'PDD']
    };
    
    const symbols = marketSymbols[exchangeName] || marketSymbols['US'];
    const maxSymbols = 20; // Finnhub免费额度优化
    
    // 使用Finnhub API批量获取实时数据
    console.log(`🔄 从Finnhub获取${symbols.length}个股票的实时数据...`);
    const dataPromises = symbols.slice(0, maxSymbols).map(async (symbol) => {
      try {
        const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data && data.c && data.c > 0) {
          return {
            symbol: symbol,
            price: data.c,              // 当前价格
            change: data.dp || 0,       // 涨跌幅%
            changeValue: data.d || 0,   // 涨跌值
            high: data.h || data.c,     // 最高价
            low: data.l || data.c,      // 最低价
            volume: data.v || 1,        // 成交量（用于方块大小）
            timestamp: data.t
          };
        }
      } catch (err) {
        console.error(`获取${symbol}失败:`, err.message);
      }
      return null;
    });
    
    const results = await Promise.all(dataPromises);
    const validData = results.filter(d => d !== null);
    
    console.log(`✅ 获取到${validData.length}个有效数据`);
    
    if (validData.length === 0) {
      console.warn('⚠️ 无有效数据，使用fallback');
      return generateFallbackHeatmap(exchangeName);
    }
    
    // 按市值权重计算方块大小（简化版：使用价格*成交量）
    const maxValue = Math.max(...validData.map(d => d.price * Math.log(d.volume + 1)));
    const treeData = validData.map(d => ({
      symbol: d.symbol,
      price: d.price,
      change: d.change,
      value: (d.price * Math.log(d.volume + 1)) / maxValue * 100, // 归一化
      volume: d.volume
    }));
    
    // 动态颜色映射（基于涨跌幅）
    const getColor = (change) => {
      if (change >= 3) return '#00C853';      // 深绿 +3%以上
      if (change >= 1) return '#69F0AE';      // 中绿 +1-3%
      if (change >= 0) return '#B2FF59';      // 浅绿 0-1%
      if (change >= -1) return '#FFAB91';     // 浅红 0到-1%
      if (change >= -3) return '#FF5252';     // 中红 -1到-3%
      return '#D32F2F';                       // 深红 -3%以下
    };
    
    // QuickChart配置：使用水平条形图模拟热力图
    const sortedData = treeData.sort((a, b) => b.change - a.change); // 按涨跌幅排序
    
    const chartConfig = {
      type: 'bar',
      data: {
        labels: sortedData.map(d => `${d.symbol} $${d.price.toFixed(2)}`),
        datasets: [{
          label: '涨跌幅 %',
          data: sortedData.map(d => d.change),
          backgroundColor: sortedData.map(d => getColor(d.change)),
          borderColor: sortedData.map(d => getColor(d.change)),
          borderWidth: 1
        }]
      },
      options: {
        indexAxis: 'y', // 水平条形图
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: `${getMarketName(exchangeName)} 实时热力图 - ${new Date().toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai', hour12: false})}`,
            font: {
              size: 18,
              weight: 'bold'
            },
            color: '#1a1a1a'
          },
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.parsed.x;
                return `涨跌幅: ${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: '涨跌幅 (%)',
              font: { size: 14, weight: 'bold' }
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            }
          },
          y: {
            ticks: {
              font: {
                size: 10
              }
            },
            grid: {
              display: false
            }
          }
        }
      }
    };
    
    // 旧版 QuickChart 已移除（v4.5使用纯SaaS方案）
    throw new Error('generateHeatmapImage已废弃，请使用generateSmartHeatmap');
    
  } catch (error) {
    console.error('❌ 热力图生成失败:', error.message);
    return generateFallbackHeatmap(exchangeName);
  }
}

// 市场名称映射
function getMarketName(exchange) {
  const names = {
    'US': '美股',
    'USA': '美股',
    'United States': '美国市场',
    'Europe': '欧洲市场',
    'China': '中国市场'
  };
  return names[exchange] || exchange;
}

// Fallback热力图（模拟数据）
function generateFallbackHeatmap(exchangeName) {
  const mockData = [
    { symbol: 'AAPL', price: 178.50, change: 2.3 },
    { symbol: 'MSFT', price: 378.80, change: 1.5 },
    { symbol: 'NVDA', price: 488.50, change: 4.5 },
    { symbol: 'AMZN', price: 155.30, change: 1.2 },
    { symbol: 'TSLA', price: 245.80, change: 3.2 },
    { symbol: 'JPM', price: 156.40, change: 0.5 },
    { symbol: 'GOOGL', price: 142.20, change: -0.8 },
    { symbol: 'META', price: 378.20, change: -1.5 }
  ].sort((a, b) => b.change - a.change);
  
  const getColor = (change) => {
    if (change >= 3) return '#00C853';
    if (change >= 1) return '#69F0AE';
    if (change >= 0) return '#B2FF59';
    if (change >= -1) return '#FFAB91';
    if (change >= -3) return '#FF5252';
    return '#D32F2F';
  };
  
  const chartConfig = {
    type: 'bar',
    data: {
      labels: mockData.map(d => `${d.symbol} $${d.price.toFixed(2)}`),
      datasets: [{
        label: '涨跌幅 %',
        data: mockData.map(d => d.change),
        backgroundColor: mockData.map(d => getColor(d.change)),
        borderColor: mockData.map(d => getColor(d.change)),
        borderWidth: 1
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: `${getMarketName(exchangeName)} 热力图（演示数据）`,
          font: { size: 16, weight: 'bold' },
          color: '#1a1a1a'
        },
        legend: { display: false }
      },
      scales: {
        x: {
          title: { display: true, text: '涨跌幅 (%)' },
          grid: { color: 'rgba(0, 0, 0, 0.1)' }
        },
        y: {
          ticks: { font: { size: 10 } },
          grid: { display: false }
        }
      }
    }
  };
  
  // 旧版 QuickChart 已移除（v4.5使用纯SaaS方案）
  throw new Error('generateFallbackHeatmap已废弃');
}

// 🆕 主热力图生成函数（优先ScreenshotAPI，降级QuickChart）- 已废弃，使用generateSmartHeatmap
async function generateHeatmap({market='US', color='change', size='market_cap'} = {}) {
  const startTime = Date.now();
  console.log(`📸 生成热力图: market=${market}, color=${color}, size=${size}`);
  
  // 1️⃣ 优先方案：ScreenshotAPI 截取TradingView
  if (SCREENSHOT_API_KEY) {
    try {
      // 市场映射（复用getHeatmapUrl的逻辑）
      const marketDatasets = {
        'US': 'SPX500',
        'USA': 'SPX500',
        'United States': 'SPX500',
        'Europe': 'DAX',
        'China': 'AllCN',
        'Spain': 'IBEX35',
        'Germany': 'DAX',
        'UK': 'UK100',
        'France': 'CAC40',
        'Japan': 'AllJP'
      };
      
      const dataset = marketDatasets[market] || 'SPX500';
      const targetUrl = `https://www.tradingview.com/heatmap/stock/?color=${color}&dataset=${dataset}&group=sector&blockColor=${color}&blockSize=${size}`;
      console.log(`🌐 ScreenshotAPI: ${targetUrl} (dataset: ${dataset})`);
      
      // ScreenshotAPI使用GET请求，参数在query string (v3 endpoint)
      const params = new URLSearchParams({
        url: targetUrl,
        token: SCREENSHOT_API_KEY,
        output: 'image',
        file_type: 'png',
        wait_for_event: 'load',
        delay: 5000,
        full_page: 'false',
        width: 1200,
        height: 800,
        device_scale_factor: 2
      });
      
      const apiUrl = `https://shot.screenshotapi.net/screenshot?${params.toString()}`;
      
      // 移除timeout参数，让请求自然完成（TradingView需要约12秒）
      const response = await fetch(apiUrl, {
        method: 'GET'
      });
      
      if (response.ok) {
        const imageBuffer = await response.buffer();
        const elapsed = Date.now() - startTime;
        console.log(`✅ ScreenshotAPI成功 (${elapsed}ms, ${imageBuffer.length} bytes)`);
        
        return {
          ok: true,
          buffer: imageBuffer,  // Telegram可以直接发送buffer
          source: 'tradingview_screenshot',
          elapsed_ms: elapsed,
          caption: `📊 ${getMarketName(market)} TradingView热力图\n数据集: ${dataset}\n来源: ScreenshotAPI截图\n耗时: ${(elapsed/1000).toFixed(1)}秒`
        };
      } else {
        const errorText = await response.text();
        console.warn(`⚠️  ScreenshotAPI失败: ${response.status} - ${errorText.substring(0, 200)}`);
      }
    } catch (error) {
      console.warn(`⚠️  ScreenshotAPI错误: ${error.message}`);
    }
  }
  
  // QuickChart已移除（v4.5纯SaaS方案）
  throw new Error('热力图生成失败：ScreenshotAPI不可用且QuickChart已被移除');
}

// 🆕 获取热力图URL（用于actions生成）- 已废弃，使用generateHeatmapImage
function getHeatmapUrl(exchangeName) {
  // 交易所到TradingView dataSource的映射
  const exchangeMapping = {
    // 美国
    'US': 'SPX500',
    'USA': 'AllUSA',
    'United States': 'AllUSA',
    // 西班牙
    'Spain': 'IBEX35',
    'ES': 'IBEX35',
    // 德国
    'Germany': 'DAX',
    'DE': 'DAX',
    // 英国
    'UK': 'UK100',
    'United Kingdom': 'UK100',
    // 法国
    'France': 'CAC40',
    'FR': 'CAC40',
    // 日本
    'Japan': 'AllJP',
    'JP': 'AllJP',
    // 中国
    'China': 'AllCN',
    'CN': 'AllCN',
    'HK': 'AllCN',
    // 其他
    'Global': 'SPX500',
    'World': 'SPX500'
  };
  
  const dataSource = exchangeMapping[exchangeName] || exchangeMapping[exchangeName.toLowerCase()] || 'SPX500';
  const url = `https://www.tradingview.com/heatmap/stock/?color=change&dataset=${dataSource}&group=sector`;
  
  console.log(`📊 生成热力图URL: ${exchangeName} -> ${dataSource} -> ${url}`);
  return url;
}

// 生成热力图HTML（使用TradingView嵌入Widget）
function generateHeatmapHTML(stocks, marketName, indexName = '') {
  // TradingView 官方支持的 dataSource 完整列表
  const allIndices = {
    // 🇺🇸 美国
    'SPX500': 'S&P 500',
    'DJDJI': 'Dow Jones Industrial',
    'DJDJU': 'Dow Jones Utilities',
    'DJDJT': 'Dow Jones Transportation',
    'DJCA': 'Dow Jones Composite',
    'NASDAQ100': 'Nasdaq 100',
    'NASDAQCOMPOSITE': 'Nasdaq Composite',
    'NASDAQBKX': 'Nasdaq Bank',
    'AllUSA': 'All US Stocks',
    
    // 🇬🇧 英国
    'UK100': 'FTSE 100',
    'AllUK': 'All UK Stocks',
    
    // 🇩🇪 德国
    'DAX': 'DAX 40',
    'TECDAX': 'TecDAX',
    'MDAX': 'MDAX',
    'SDAX': 'SDAX',
    'AllDE': 'All Germany Stocks',
    
    // 🇫🇷 法国
    'CAC40': 'CAC 40',
    'SBF120': 'SBF 120',
    'AllFR': 'All France Stocks',
    
    // 🇪🇸 西班牙
    'IBEX35': 'IBEX 35',
    'BMEIS': 'BME Small Cap',
    'BMEINDGRO15': 'BME Industry Growth 15',
    'BMEINDGROAS': 'BME Industry Growth AS',
    'BMEICC': 'BME Consumer',
    'AllES': 'All Spain Stocks',
    
    // 🇧🇪 比利时
    'AllBE': 'All Belgium Stocks',
    
    // 🇯🇵 日本
    'AllJP': 'All Japan Stocks',
    
    // 🇨🇳 中国
    'AllCN': 'All China A Stocks',
    
    // 🇦🇺 澳大利亚
    'AllAU': 'All Australia Stocks',
    
    // 🌎 美洲其他
    'AllBR': 'All Brazil Stocks',
    'AllAR': 'All Argentina Stocks',
    'AllCA': 'All Canada Stocks',
    'AllCL': 'All Chile Stocks',
    'AllCO': 'All Colombia Stocks',
    
    // 🏭 行业指数
    'TVCRUI': 'Cruise Industry',
    'TVCRUA': 'Airlines & Cruise',
    'TVCRUT': 'Transport & Travel',
    
    // 💰 加密货币
    'CRYPTO': 'Cryptocurrency'
  };
  
  // 智能映射：将用户请求的指数映射到最佳的 TradingView dataSource
  const indexMapping = {
    // 美国替代名称
    'DJI': 'DJDJI',
    'DOW': 'DJDJI',
    'DOWJONES': 'DJDJI',
    'SP500': 'SPX500',
    'NASDAQ': 'NASDAQCOMPOSITE',
    'NDX': 'NASDAQ100',
    'RUSSELL2000': 'AllUSA',
    'RUSSELL1000': 'AllUSA',
    'RUSSELL3000': 'AllUSA',
    
    // 英国替代名称
    'FTSE100': 'UK100',
    'FTSE': 'UK100',
    
    // 西班牙替代名称
    'IBEX': 'IBEX35',
    'IBEXSMALLCAP': 'BMEIS',
    'IBEXMEDIUMCAP': 'IBEX35',
    
    // 其他通用映射
    'USA': 'AllUSA',
    'UK': 'AllUK',
    'GERMANY': 'AllDE',
    'FRANCE': 'AllFR',
    'SPAIN': 'AllES',
    'JAPAN': 'AllJP',
    'CHINA': 'AllCN',
    'AUSTRALIA': 'AllAU'
  };

  // 市场到可用指数的映射（用于错误提示）
  const marketIndices = {
    spain: ['IBEX35', 'BMEIS', 'BMEINDGRO15', 'BMEINDGROAS', 'BMEICC', 'AllES'],
    germany: ['DAX', 'TECDAX', 'MDAX', 'SDAX', 'AllDE'],
    uk: ['UK100', 'AllUK'],
    france: ['CAC40', 'SBF120', 'AllFR'],
    usa: ['SPX500', 'DJDJI', 'NASDAQ100', 'NASDAQCOMPOSITE', 'AllUSA'],
    japan: ['AllJP'],
    china: ['AllCN'],
    australia: ['AllAU'],
    brazil: ['AllBR'],
    canada: ['AllCA']
  };

  // 确定最终使用的dataSource
  let dataSource, title, errorMessage = null;
  
  if (indexName) {
    const upperIndex = indexName.toUpperCase();
    
    // 1. 检查是否是直接支持的值
    if (allIndices[upperIndex]) {
      dataSource = upperIndex;
      title = allIndices[dataSource];
    }
    // 2. 检查是否需要映射
    else if (indexMapping[upperIndex]) {
      dataSource = indexMapping[upperIndex];
      title = allIndices[dataSource];
    }
    // 3. 未知指数，返回错误提示
    else {
      // 尝试根据index名称猜测市场
      let guessedMarket = 'usa';
      if (/spain|ibex|bme|西班牙/i.test(indexName)) guessedMarket = 'spain';
      else if (/germany|dax|德国/i.test(indexName)) guessedMarket = 'germany';
      else if (/uk|ftse|英国/i.test(indexName)) guessedMarket = 'uk';
      else if (/france|cac|法国/i.test(indexName)) guessedMarket = 'france';
      
      const availableIndices = marketIndices[guessedMarket] || marketIndices.usa;
      errorMessage = `当前不支持指数"${indexName}"。\n\n可用指数：\n${availableIndices.map(idx => `• ${idx} - ${allIndices[idx]}`).join('\n')}`;
      
      dataSource = availableIndices[0];
      title = `Error: Unsupported Index`;
    }
  } else {
    // 没有指定index，根据market参数选择最佳指数
    // 注意：某些市场的"All"系列数据可能不完整，使用主要指数更可靠
    const marketMapping = {
      usa: 'SPX500',        // S&P 500（比AllUSA更可靠）
      spain: 'IBEX35',      // IBEX 35（西班牙主要蓝筹指数，数据最完整）
      germany: 'DAX',       // DAX 40（德国主要指数）
      uk: 'UK100',          // FTSE 100（英国主要指数）
      france: 'CAC40',      // CAC 40（法国主要指数）
      japan: 'AllJP',       // 日本全市场
      china: 'AllCN',       // 中国A股全市场
      australia: 'AllAU',   // 澳大利亚全市场
      hongkong: 'AllCN',    // 香港 → 中国A股
      belgium: 'AllBE',     // 比利时全市场
      brazil: 'AllBR',      // 巴西全市场
      argentina: 'AllAR',   // 阿根廷全市场
      canada: 'AllCA',      // 加拿大全市场
      chile: 'AllCL',       // 智利全市场
      colombia: 'AllCO',    // 哥伦比亚全市场
      europe: 'CAC40',      // 欧洲默认 → 法国CAC40
      world: 'SPX500'       // 全球 → S&P 500
    };
    
    dataSource = marketMapping[marketName];
    
    // 如果market不支持，返回错误提示
    if (!dataSource) {
      errorMessage = `当前不支持市场"${marketName}"。\n\n可用市场：\n• 美国 (usa)\n• 西班牙 (spain)\n• 德国 (germany)\n• 英国 (uk)\n• 法国 (france)\n• 日本 (japan)\n• 中国 (china)\n• 澳大利亚 (australia)\n• 巴西 (brazil)\n• 加拿大 (canada)`;
      dataSource = 'SPX500';
      title = 'Error: Unsupported Market';
    } else {
      title = allIndices[dataSource];
    }
  }
  
  // 如果有错误，返回错误页面
  if (errorMessage) {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>错误 - 不支持的市场或指数</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
    }
    .error-card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      padding: 40px;
      max-width: 600px;
      width: 100%;
    }
    h1 {
      color: #e53e3e;
      font-size: 28px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .icon {
      font-size: 36px;
    }
    .message {
      color: #2d3748;
      font-size: 16px;
      line-height: 1.8;
      white-space: pre-line;
      background: #f7fafc;
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }
    .footer {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid #e2e8f0;
      color: #718096;
      font-size: 14px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="error-card">
    <h1><span class="icon">⚠️</span> 不支持的市场或指数</h1>
    <div class="message">${errorMessage}</div>
    <div class="footer">
      <p>💡 提示：请核对指数名称后重新发送</p>
    </div>
  </div>
</body>
</html>
`;
  }

  // 直接返回嵌入TradingView Widget的HTML
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} Heatmap</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #131722;
      color: white;
      overflow: hidden;
      width: 100%;
      height: 100%;
    }
    .header {
      background: #1E222D;
      padding: 15px 20px;
      text-align: center;
      border-bottom: 1px solid #2A2E39;
      height: 60px;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 600;
      color: #D1D4DC;
      margin: 0;
      line-height: 30px;
    }
    .tradingview-widget-container {
      width: 100%;
      height: calc(100% - 60px);
    }
    .tradingview-widget-container__widget {
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title} Heatmap</h1>
  </div>
  
  <!-- TradingView Widget BEGIN -->
  <div class="tradingview-widget-container">
    <div class="tradingview-widget-container__widget"></div>
    <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js" async>
    {
      "exchanges": [],
      "dataSource": "${dataSource}",
      "grouping": "sector",
      "blockSize": "market_cap_basic",
      "blockColor": "change",
      "locale": "en",
      "symbolUrl": "",
      "colorTheme": "dark",
      "hasTopBar": false,
      "isDataSetEnabled": false,
      "isZoomEnabled": true,
      "hasSymbolTooltip": true,
      "width": "100%",
      "height": 800
    }
    </script>
  </div>
  <!-- TradingView Widget END -->
</body>
</html>
  `;
}

// ---- Helper: Poll Replicate prediction (only if needed)
async function pollReplicatePrediction(predictionId, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
    
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json"
      }
    });
    
    const data = await response.json();
    console.log(`📊 Replicate poll ${i+1}/${maxAttempts}: status=${data.status}`);
    
    if (data.status === "succeeded") {
      return { success: true, output: data.output };
    }
    
    if (data.status === "failed" || data.status === "canceled") {
      console.error("❌ Replicate polling failed:", JSON.stringify(data, null, 2));
      return { success: false, error: "REPLICATE_STATUS_FAILED", raw: data };
    }
  }
  
  return { success: false, error: "REPLICATE_TIMEOUT" };
}

// ---- Image Generation: Unified endpoint
app.post("/img/imagine", async (req, res) => {
  try {
    // 1️⃣ Check REPLICATE_API_TOKEN first
    if (!REPLICATE_API_TOKEN) {
      console.error("❌ REPLICATE_API_TOKEN missing");
      return res.json({ ok: false, error: "MISSING_TOKEN" });
    }

    // 2️⃣ Clean prompt - remove line breaks, tabs, and excessive whitespace
    const rawPrompt = req.body?.prompt || "";
    const prompt = rawPrompt.replace(/\s+/g, " ").trim();
    const ratio = req.body?.ratio || "16:9";
    
    if (!prompt) {
      return res.json({ ok: false, error: "MISSING_PROMPT" });
    }

    console.log(`🎨 Image request: provider=${IMAGE_PROVIDER}, prompt="${prompt}", ratio=${ratio}`);

    // Provider: Replicate
    if (IMAGE_PROVIDER === "replicate") {
      // 3️⃣ Create prediction
      const createResponse = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${REPLICATE_API_TOKEN}`,
          "Content-Type": "application/json",
          "Prefer": "wait"
        },
        body: JSON.stringify({
          input: {
            prompt: prompt,
            aspect_ratio: ratio,
            num_outputs: 1,
            num_inference_steps: 4,
            go_fast: true
          }
        })
      });

      const prediction = await createResponse.json();
      
      // 3️⃣ Check for errors or missing ID
      if (createResponse.status !== 201 && createResponse.status !== 200) {
        console.error("❌ Replicate create failed:", JSON.stringify(prediction, null, 2));
        return res.json({ 
          ok: false, 
          error: "REPLICATE_CREATE_FAILED",
          raw: prediction
        });
      }

      if (!prediction.id) {
        console.error("❌ No prediction ID:", JSON.stringify(prediction, null, 2));
        return res.json({ 
          ok: false, 
          error: "REPLICATE_CREATE_FAILED",
          raw: prediction
        });
      }

      // Check if we got immediate result (Prefer: wait header)
      if (prediction.status === "succeeded" && prediction.output) {
        const imageUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
        console.log(`✅ Image generated (immediate): ${imageUrl}`);
        return res.json({ ok: true, image_url: imageUrl });
      }

      // 4️⃣ Poll for result
      console.log(`⏳ Polling prediction: id=${prediction.id}`);
      const result = await pollReplicatePrediction(prediction.id);
      
      if (!result.success) {
        return res.json({ 
          ok: false, 
          error: result.error,
          raw: result.raw
        });
      }

      // 5️⃣ Success - return image URL
      const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;
      console.log(`✅ Image generated: ${imageUrl}`);
      
      return res.json({ ok: true, image_url: imageUrl });
    }

    // Provider: MJ Relay
    if (IMAGE_PROVIDER === "mjrelay") {
      if (!MJ_RELAY_URL) {
        return res.json({ ok: false, error: "MJ_RELAY_URL_MISSING" });
      }

      const response = await fetch(MJ_RELAY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, ratio })
      });

      const data = await response.json();
      const imageUrl = data.image_url || (Array.isArray(data.images) ? data.images[0] : null);

      if (!imageUrl) {
        return res.json({ ok: false, error: "MJ_RELAY_NO_IMAGE", raw: data });
      }

      console.log(`✅ MJ Relay image: ${imageUrl}`);
      return res.json({ ok: true, image_url: imageUrl });
    }

    // Unknown provider
    return res.json({ ok: false, error: `UNKNOWN_PROVIDER_${IMAGE_PROVIDER}` });

  } catch (err) {
    console.error("❌ Image generation error:", err);
    return res.json({ ok: false, error: err.message });
  }
});

// ---- 简单规则投票器：从文本里判定 BUY / HOLD / SELL
function pickVote(text = "") {
  const t = text.toLowerCase();
  const buyWords  = ["看多","乐观","上涨","买入","走强","向上","bull","optimistic","accumulate"];
  const sellWords = ["看空","悲观","下跌","卖出","走弱","向下","bear","risk off","reduce"];
  let score = 0;
  buyWords.forEach(w => { if (t.includes(w)) score += 1; });
  sellWords.forEach(w => { if (t.includes(w)) score -= 1; });
  if (score > 0)  return { vote: "BUY",  conf: Math.min(0.6 + score*0.1, 0.95) };
  if (score < 0)  return { vote: "SELL", conf: Math.min(0.6 + (-score)*0.1, 0.95) };
  return { vote: "HOLD", conf: 0.55 };
}

// ---- 多模型决策
app.post("/brain/decide", async (req, res) => {
  const { task = "未命名任务" } = req.body || {};
  console.log("🧠 任务:", task);

  // 并行调用两个模型
  const calls = [];

  // Claude
  calls.push((async () => {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": CLAUDE_KEY,
          "content-type": "application/json",
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 220,
          messages: [{ role: "user", content: `请用要点判断市场倾向（BUY/HOLD/SELL）并给出一句理由：${task}` }]
        })
      });
      const j = await r.json();
      const text = j?.content?.[0]?.text || JSON.stringify(j);
      const { vote, conf } = pickVote(text);
      return { name: "Claude", text, vote, confidence: conf };
    } catch (e) {
      console.error("Claude error:", e);
      return { name: "Claude", text: "（无响应）", vote: "HOLD", confidence: 0.4 };
    }
  })());

  // DeepSeek
  calls.push((async () => {
    try {
      const r = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DEEPSEEK_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [{ role: "user", content: `请判断 BUY/HOLD/SELL，并用一句话说明理由：${task}` }],
          max_tokens: 220
        })
      });
      const j = await r.json();
      const text = j?.choices?.[0]?.message?.content || JSON.stringify(j);
      const { vote, conf } = pickVote(text);
      return { name: "DeepSeek", text, vote, confidence: conf };
    } catch (e) {
      console.error("DeepSeek error:", e);
      return { name: "DeepSeek", text: "（无响应）", vote: "HOLD", confidence: 0.4 };
    }
  })());

  const results = await Promise.all(calls);

  // —— 投票：简单多数；平手则 HOLD
  const tally = { BUY: 0, HOLD: 0, SELL: 0 };
  results.forEach(r => { tally[r.vote] += 1; });

  let finalVote = "HOLD";
  if (tally.BUY > tally.SELL && tally.BUY >= tally.HOLD) finalVote = "BUY";
  else if (tally.SELL > tally.BUY && tally.SELL >= tally.HOLD) finalVote = "SELL";

  // 置信度：平均模型置信度 × 投票一致度
  const avgConf = results.reduce((s, r) => s + (r.confidence || 0.5), 0) / results.length;
  const agreement = Math.max(tally.BUY, tally.SELL, tally.HOLD) / results.length;
  const finalConfidence = Math.min(0.98, Number((avgConf * (0.6 + 0.4 * agreement)).toFixed(2)));

  // —— 构造输出（兼容旧字段）
  const zhLines = results.map(r => `${r.name}（${r.vote}，${Math.round((r.confidence||0)*100)}%）：${r.text}`);
  const payload = {
    version: "USIS.v3",
    task,
    final_text: {
      zh: zhLines.join("\n\n"),
      es: `Voto final: ${finalVote}. Confianza: ${Math.round(finalConfidence*100)}%.`
    },
    models: results.map(r => ({
      name: r.name,
      output: r.text,
      vote: r.vote,
      confidence: r.confidence
    })),
    decision: {
      vote: finalVote,
      confidence: finalConfidence,
      reasons: results.map(r => `${r.name}: ${r.vote}`)
    },
    tags: ["market/open","vote"],
    ts: Date.now()
  };

  res.json(payload);
});

// ---- Intent Router: 意图识别（模式 + 抽票 + 语言）
app.post("/brain/intent", async (req, res) => {
  try {
    const text = (req.body?.text || '').trim();
    const allow = Array.isArray(req.body?.allow) ? req.body.allow : ['premarket','intraday','postmarket','diagnose','news'];
    const langHint = (req.body?.lang || '').toLowerCase();

    // 1) 语言判定（轻量规则）
    let lang = 'zh';
    if (langHint) {
      lang = langHint;
    } else if (/[a-z]/i.test(text) && !/[\u4e00-\u9fa5]/.test(text)) {
      lang = 'en';
    } else if (/[áéíóúüñ¡¿]/i.test(text)) {
      lang = 'es';
    }

    // 2) 模式识别（关键词 → mode）
    const t = text.toLowerCase();
    const pick = (m) => allow.includes(m) ? m : null;

    let mode = null;
    if (!mode && /(盘启|盘前|premarket|\bpre\b)/.test(t)) mode = pick('premarket');
    if (!mode && /(盘中|intraday|live)/.test(t)) mode = pick('intraday');
    if (!mode && /(复盘|收盘|postmarket|review|after)/.test(t)) mode = pick('postmarket');
    if (!mode && /(解票|诊股|ticker|symbol)/.test(t)) mode = pick('diagnose');
    if (!mode && /(新闻|资讯|news)/.test(t)) mode = pick('news');

    // 3) 抽取股票代码（简单正则，使用原文而非小写版本）
    const sym = (text.match(/\b[A-Z]{1,5}\b/g) || [])
      .filter(s => !['US','ES','ETF','ETF?'].includes(s))
      .slice(0, 10);

    console.log(`🎯 意图: text="${text}" → mode=${mode}, symbols=${sym.join(',')}, lang=${lang}`);

    // 4) 返回结果
    return res.json({
      version: 'USIS.v3',
      mode: mode || null,
      symbols: sym,
      lang,
      echo: text
    });
  } catch (e) {
    console.error('❌ intent error:', e);
    res.status(500).json({ error: 'intent-failed' });
  }
});

// ========================================
// 🧠 AI ORCHESTRATOR - 智能协调系统
// ========================================

// Memory Layer - 简单内存存储（后续可替换为 Redis/DB）
const Memory = {
  logs: [],
  userPrefs: {},
  
  save(entry) {
    this.logs.push({ ...entry, ts: new Date().toISOString() });
    // 只保留最近 1000 条
    if (this.logs.length > 1000) this.logs = this.logs.slice(-1000);
  },
  
  recent(n = 10) {
    return this.logs.slice(-n);
  },
  
  setUserPref(userId, key, value) {
    if (!this.userPrefs[userId]) this.userPrefs[userId] = {};
    this.userPrefs[userId][key] = value;
  },
  
  getUserPref(userId, key) {
    return this.userPrefs[userId]?.[key];
  }
};

// Symbol Extraction - 从文本中提取股票代码（支持交易所后缀和中文名称）
function extractSymbols(text = "") {
  // 🇺🇸 美股中文名称映射（全球知名科技公司 + 主要蓝筹股）
  const usStockNames = {
    '苹果': 'AAPL', 'apple': 'AAPL',
    '特斯拉': 'TSLA', 'tesla': 'TSLA',
    '微软': 'MSFT', 'microsoft': 'MSFT',
    '谷歌': 'GOOGL', 'google': 'GOOGL', '字母表': 'GOOGL', 'alphabet': 'GOOGL',
    '亚马逊': 'AMZN', 'amazon': 'AMZN',
    '英伟达': 'NVDA', 'nvidia': 'NVDA',
    '脸书': 'META', 'facebook': 'META', 'meta': 'META',
    '奈飞': 'NFLX', 'netflix': 'NFLX',
    '英特尔': 'INTC', 'intel': 'INTC',
    '高通': 'QCOM', 'qualcomm': 'QCOM',
    '台积电': 'TSM', 'tsmc': 'TSM',
    '可口可乐': 'KO', 'coca cola': 'KO', 'coke': 'KO',
    '迪士尼': 'DIS', 'disney': 'DIS',
    '波音': 'BA', 'boeing': 'BA',
    '耐克': 'NKE', 'nike': 'NKE',
    '星巴克': 'SBUX', 'starbucks': 'SBUX',
    '麦当劳': 'MCD', 'mcdonalds': 'MCD',
    '通用电气': 'GE', 'ge': 'GE',
    '摩根大通': 'JPM', 'jpmorgan': 'JPM',
    '高盛': 'GS', 'goldman': 'GS',
    '辉瑞': 'PFE', 'pfizer': 'PFE',
    '强生': 'JNJ', 'johnson': 'JNJ',
    '沃尔玛': 'WMT', 'walmart': 'WMT',
    '家得宝': 'HD', 'home depot': 'HD',
    'amd': 'AMD', '超微': 'AMD',
    '埃克森': 'XOM', 'exxon': 'XOM',
    '雪佛龙': 'CVX', 'chevron': 'CVX',
    '宝洁': 'PG', 'procter': 'PG',
    '维萨': 'V', 'visa': 'V',
    '万事达': 'MA', 'mastercard': 'MA',
    '伯克希尔': 'BRK.B', 'berkshire': 'BRK.B',
    '联合健康': 'UNH', 'unitedhealth': 'UNH',
    '礼来': 'LLY', 'eli lilly': 'LLY',
    '艾伯维': 'ABBV', 'abbvie': 'ABBV',
    '美国银行': 'BAC', 'bank of america': 'BAC',
    '陶氏': 'DOW', 'dow': 'DOW', 'dow inc': 'DOW'
  };
  
  // 🇨🇳 中国概念股（美股上市 + 港股）
  const chineseStockNames = {
    // 美股ADR（默认）
    '阿里巴巴': 'BABA', 'alibaba': 'BABA',
    '京东': 'JD', 'jd': 'JD',
    '百度': 'BIDU', 'baidu': 'BIDU',
    '拼多多': 'PDD', 'pinduoduo': 'PDD',
    '蔚来': 'NIO', 'nio': 'NIO',
    '小鹏': 'XPEV', 'xpeng': 'XPEV',
    '理想': 'LI', 'li auto': 'LI',
    '网易': 'NTES', 'netease': 'NTES',
    
    // 港股（明确标识）
    '阿里港股': '9988.HK', 'alibaba hk': '9988.HK',
    '腾讯': '0700.HK', 'tencent': '0700.HK',
    '美团': '3690.HK', 'meituan': '3690.HK',
    '小米': '1810.HK', 'xiaomi': '1810.HK',
    '比亚迪': '1211.HK', 'byd': '1211.HK',
    '中国移动': '0941.HK', 'china mobile': '0941.HK',
    '工商银行': '1398.HK', 'icbc': '1398.HK',
    '建设银行': '0939.HK', 'ccb': '0939.HK',
    '中国平安': '2318.HK', 'ping an': '2318.HK'
  };
  
  // 🇪🇺 欧洲主要股票
  const europeanStockNames = {
    // 🇬🇧 英国
    '汇丰': 'HSBC', 'hsbc': 'HSBC',
    '壳牌': 'SHEL', 'shell': 'SHEL',
    '英国石油': 'BP', 'bp': 'BP',
    '阿斯利康': 'AZN', 'astrazeneca': 'AZN',
    '联合利华': 'UL', 'unilever': 'UL',
    '帝亚吉欧': 'DEO', 'diageo': 'DEO',
    
    // 🇩🇪 德国
    '西门子': 'SIEGY', 'siemens': 'SIEGY',
    'sap': 'SAP',
    '大众': 'VWAGY', 'volkswagen': 'VWAGY',
    '宝马': 'BMWYY', 'bmw': 'BMWYY',
    '戴姆勒': 'DDAIF', 'daimler': 'DDAIF',
    '拜耳': 'BAYRY', 'bayer': 'BAYRY',
    '巴斯夫': 'BASFY', 'basf': 'BASFY',
    '阿迪达斯': 'ADDYY', 'adidas': 'ADDYY',
    
    // 🇫🇷 法国
    '路威酩轩': 'LVMUY', 'lvmh': 'LVMUY',
    '欧莱雅': 'LRLCY', 'loreal': 'LRLCY',
    '道达尔': 'TTE', 'totalenergies': 'TTE',
    '赛诺菲': 'SNY', 'sanofi': 'SNY',
    '空客': 'EADSY', 'airbus': 'EADSY',
    '达能': 'DANOY', 'danone': 'DANOY',
    
    // 🇳🇱 荷兰
    'asml': 'ASML',
    '壳牌荷兰': 'SHEL', 
    '飞利浦': 'PHG', 'philips': 'PHG',
    '海因肯': 'HEINY', 'heineken': 'HEINY',
    
    // 🇨🇭 瑞士
    '雀巢': 'NSRGY', 'nestle': 'NSRGY',
    '诺华': 'NVS', 'novartis': 'NVS',
    '罗氏': 'RHHBY', 'roche': 'RHHBY',
    'abb': 'ABB',
    
    // 🇪🇸 西班牙（完整公司名称优先，避免歧义）
    'banco de sabadell sa': 'SAB.MC',   // 完整公司名 → 马德里交易所
    'banco de sabadell': 'SAB.MC',      // 西班牙Sabadell银行
    'banco santander sa': 'SAN.MC',     // 完整公司名
    'banco santander': 'SAN.MC',        // 桑坦德银行
    'banco bilbao vizcaya': 'BBVA.MC',  // BBVA完整名
    '电力公司': 'IBE.MC', 'iberdrola': 'IBE.MC',
    '西班牙电信': 'TEF.MC', 'telefonica': 'TEF.MC',
    '桑坦德': 'SAN.MC', 'santander': 'SAN.MC',
    '毕尔巴鄂': 'BBVA.MC', 'bbva': 'BBVA.MC',
    'sabadell': 'SAB.MC',               // 短名称
    'inditex': 'ITX.MC', 'zara': 'ITX.MC',
    'repsol': 'REP.MC', '雷普索尔': 'REP.MC'
  };
  
  // 🇯🇵 日本主要股票
  const japaneseStockNames = {
    '丰田': 'TM', 'toyota': 'TM',
    '索尼': 'SONY', 'sony': 'SONY',
    '本田': 'HMC', 'honda': 'HMC',
    '日产': 'NSANY', 'nissan': 'NSANY',
    '任天堂': 'NTDOY', 'nintendo': 'NTDOY',
    '软银': 'SFTBY', 'softbank': 'SFTBY',
    '三菱': 'MSBHF', 'mitsubishi': 'MSBHF',
    '日立': 'HTHIY', 'hitachi': 'HTHIY',
    '松下': 'PCRFY', 'panasonic': 'PCRFY',
    '佳能': 'CAJ', 'canon': 'CAJ',
    '东芝': 'TOSYY', 'toshiba': 'TOSYY'
  };
  
  // 🇰🇷 韩国主要股票
  const koreanStockNames = {
    '三星': 'SSNLF', 'samsung': 'SSNLF',
    '现代': 'HYMTF', 'hyundai': 'HYMTF',
    'lg': 'LPL',
    'sk海力士': 'HXSCL', 'sk hynix': 'HXSCL'
  };
  
  // 🌏 其他亚洲市场
  const otherAsianStockNames = {
    // 🇸🇬 新加坡
    'dbs': 'DBSDY', 'dbs bank': 'DBSDY',
    
    // 🇮🇳 印度
    '信实工业': 'RELIANCE.NS', 'reliance': 'RELIANCE.NS',
    'tcs': 'TCS.NS',
    'infosys': 'INFY',
    'hdfc': 'HDB'
  };
  
  // 🌎 拉美主要股票
  const latinAmericaStockNames = {
    // 🇧🇷 巴西
    '淡水河谷': 'VALE', 'vale': 'VALE',
    '巴西石油': 'PBR', 'petrobras': 'PBR',
    
    // 🇲🇽 墨西哥
    '美洲电信': 'AMX', 'america movil': 'AMX'
  };
  
  // 🌍 其他全球公司
  const globalStockNames = {
    // 🇦🇺 澳大利亚
    'bhp': 'BHP',
    '力拓': 'RIO', 'rio tinto': 'RIO',
    
    // 🇨🇦 加拿大
    '加拿大皇家银行': 'RY', 'rbc': 'RY',
    '丰业银行': 'BNS', 'scotiabank': 'BNS',
    
    // 🇿🇦 南非
    '纳斯帕斯': 'NPSNY', 'naspers': 'NPSNY'
  };
  
  // 合并所有映射
  const allStockNames = { 
    ...usStockNames, 
    ...chineseStockNames,
    ...europeanStockNames,
    ...japaneseStockNames,
    ...koreanStockNames,
    ...otherAsianStockNames,
    ...latinAmericaStockNames,
    ...globalStockNames
  };
  
  const lowerText = text.toLowerCase();
  const symbols = [];
  const matchedPositions = new Set(); // 记录已匹配的文本位置，避免重复匹配
  
  // 1. 检查中文/英文股票名称（按键长度降序排序，优先匹配更具体的名称）
  const sortedNames = Object.entries(allStockNames)
    .sort((a, b) => b[0].length - a[0].length); // 长键优先
  
  for (const [name, symbol] of sortedNames) {
    const index = lowerText.indexOf(name);
    if (index !== -1) {
      // 检查这个位置是否已经被更长的键匹配过
      const positions = Array.from({ length: name.length }, (_, i) => index + i);
      const hasOverlap = positions.some(pos => matchedPositions.has(pos));
      
      if (!hasOverlap) {
        symbols.push(symbol);
        positions.forEach(pos => matchedPositions.add(pos));
      }
    }
  }
  
  // 2. 提取带交易所后缀的符号（如 IBE.MC, AAPL, 0700.HK）
  const upperText = text.toUpperCase();
  
  // 匹配: 字母+数字组合 + 可选的.交易所后缀
  // 支持: AAPL, IBE.MC, 0700.HK, BABA, SAN.MC
  // 🆕 v1.0: 使用Unicode-aware lookarounds支持中文（"分析AAPL"）
  const symbolPattern = /(?<![A-Z0-9])([A-Z0-9]{1,5}(?:\.[A-Z]{1,3})?)(?![A-Z0-9])/gu;
  const matches = upperText.match(symbolPattern) || [];
  
  // 去重并过滤常见非股票词（扩展黑名单）
  const blacklist = [
    'US', 'USD', 'PM', 'AM', 'ET', 'PT', 'NY', 'LA', 'SF', 
    'AI', 'EV', 'IPO', 'CEO', 'CFO', 'CTO', 'API', 'URL', 'HTML',
    'GDP', 'CPI', 'PPI', 'PMI', 'FED', 'SEC', 'DOW', 'FX', 'VIX',
    'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 
    'HAS', 'HAD', 'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'DAY', 'GET',
    'NEW', 'NOW', 'OLD', 'SEE', 'TWO', 'WAY', 'WHO', 'BOY', 'DID',
    'ITS', 'LET', 'PUT', 'SAY', 'SHE', 'TOO', 'USE', 'MC', 'BCN',
    'IBEX', 'BME', 'MAD'  // 西班牙交易所/指数代码
  ];
  
  const filtered = matches.filter(s => {
    // 🔍 规则1：带交易所后缀的必须保留（如0700.HK, IBE.MC）
    if (s.includes('.')) return true;
    
    // 🔍 规则2：纯数字拒绝（防止年份2025、日期等误报）
    if (/^\d+$/.test(s)) return false;
    
    // 🔍 规则3：必须包含至少一个字母
    if (!/[A-Z]/.test(s)) return false;
    
    // 🔍 规则4：检查黑名单
    return !blacklist.includes(s);
  });
  
  // 合并所有符号并去重
  const allSymbols = [...new Set([...symbols, ...filtered])];
  
  console.log(`🔍 符号提取: "${text}" → [${allSymbols.join(', ')}]`);
  return allSymbols;
}

// 🧠 Intelligent Symbol Validation - 智能验证和修正股票符号（混合策略）
async function validateAndFixSymbols(symbols = [], contextHints = {}) {
  if (symbols.length === 0) return [];
  
  console.log(`\n🧠 [智能验证] 开始验证 ${symbols.length} 个符号...`);
  
  const validatedSymbols = [];
  const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
  
  // 🎯 Phase 1: 静态映射表（最权威、最快）
  // ⚠️ 注意：只映射**明确无歧义**的全名，短代码应该通过API查询后让用户选择
  const STATIC_SYMBOL_MAP = {
    // 西班牙主要股票（仅全名映射，ADR优先）
    'sabadell': 'BNDSY',      // Banco de Sabadell 全名 → ADR
    'santander': 'SAN',       // Banco Santander 全名 → NYSE
    'telefonica': 'TEF',      // Telefonica 全名 → NYSE
    'iberdrola': 'IBDRY',     // Iberdrola 全名 → ADR
    'repsol': 'REPYY',        // Repsol 全名 → ADR
    'inditex': 'IDEXY',       // Inditex 全名 → ADR
    // 其他明确的全名映射
    'tencent': '0700.HK',
    'alibaba': 'BABA'
    // ❌ 不再包含短代码如 sab, bbva, ibe 等 - 让API查询后用户选择
  };
  
  if (!FINNHUB_KEY) {
    console.log('⚠️  FINNHUB_API_KEY未配置，仅使用静态映射');
    return symbols.map(s => STATIC_SYMBOL_MAP[s.toLowerCase()] || s);
  }
  
  for (const symbol of symbols) {
    const lowerSymbol = symbol.toLowerCase();
    
    // 📍 优先级1：静态映射（权威源）
    if (STATIC_SYMBOL_MAP[lowerSymbol]) {
      const mapped = STATIC_SYMBOL_MAP[lowerSymbol];
      validatedSymbols.push(mapped);
      console.log(`   📚 ${symbol} → ${mapped} (静态映射)`);
      continue;
    }
    
    // 📍 优先级2：已有交易所前缀，直接通过
    if (symbol.includes('.') || symbol.includes(':')) {
      validatedSymbols.push(symbol);
      console.log(`   ✓ ${symbol} - 已含交易所后缀`);
      continue;
    }
    
    // 📍 优先级3：Finnhub API查询 + 智能评分
    try {
      const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`;
      const response = await fetch(url, { timeout: 5000 });
      
      if (!response.ok) {
        validatedSymbols.push(symbol);
        console.log(`   ⚠️  ${symbol} - API失败，保持原样`);
        continue;
      }
      
      const data = await response.json();
      const results = data.result || [];
      
      if (results.length === 0) {
        validatedSymbols.push(symbol);
        console.log(`   ⚠️  ${symbol} - 无匹配，保持原样`);
        continue;
      }
      
      // 🎯 智能评分算法
      const scored = results.map(r => {
        let score = 0;
        const sym = (r.symbol || r.displaySymbol || '').toUpperCase();
        const desc = (r.description || '').toLowerCase();
        const type = (r.type || '').toLowerCase();
        
        // ✅ 评分规则1：精确符号匹配（最高优先级）
        if (sym === symbol.toUpperCase()) score += 100;
        
        // ✅ 评分规则2：优先Common Stock
        if (type.includes('common stock')) score += 30;
        
        // ✅ 评分规则3：description包含原始查询词（词汇匹配）
        if (desc.includes(symbol.toLowerCase())) score += 20;
        
        // ✅ 评分规则4：交易所偏好（根据上下文）
        const exchange = sym.split('.')[1] || sym.split(':')[0];
        if (contextHints.preferredExchange) {
          if (exchange === contextHints.preferredExchange) score += 15;
        }
        
        // ✅ 评分规则5：符号长度偏好（短符号优先，避免奇怪的后缀）
        if (sym.length <= 6) score += 10;
        
        return { ...r, symbol: sym, score };
      });
      
      // 排序并选择最佳匹配
      scored.sort((a, b) => b.score - a.score);
      
      // 🆕 检查是否需要用户确认（多个高分候选）
      // 策略：只有在真正模糊不清时才让用户选择
      const best = scored[0];
      const secondBest = scored[1];
      
      // ✅ 精确匹配检测（最高优先级）
      const isExactMatch = best.score >= 100; // score=100表示精确符号匹配
      const hasSignificantLead = !secondBest || (best.score >= secondBest.score * 2); // 领先2倍以上
      
      // ✅ 知名股票检测（Common Stock + 高分）
      const isWellKnownStock = best.score >= 130 && best.type?.toLowerCase().includes('common stock');
      
      // 🎯 决策逻辑：
      // 1. 精确匹配 + 显著领先 → 直接使用，不询问
      // 2. 知名股票（高分Common Stock）→ 直接使用
      // 3. 多个候选分数接近 → 让用户选择
      const needsUserChoice = contextHints.interactive && 
        !isExactMatch && 
        !isWellKnownStock && 
        !hasSignificantLead && 
        scored.length >= 2;
      
      if (needsUserChoice) {
        // 🌐 全球股票支持：多API级联策略（Finnhub → Alpha Vantage）
        // 所有候选都可以尝试，由dataBroker自动降级处理
        
        // 返回特殊标记，让调用方处理用户选择
        const topCandidates = scored.slice(0, 12); // 取前12个候选
        console.log(`   ❓ ${symbol} - 发现${topCandidates.length}个模糊匹配，需要用户选择`);
        validatedSymbols.push({
          _needsChoice: true,
          originalSymbol: symbol,
          candidates: topCandidates.map(c => ({
            symbol: c.symbol,
            description: c.description,
            type: c.type,
            score: c.score
          }))
        });
        continue;
      }
      
      // ✅ 不需要用户选择，直接使用最佳匹配
      console.log(`   🎯 ${symbol} → ${best.symbol} (精确:${isExactMatch}, 知名:${isWellKnownStock}, 分数:${best.score})`);
      validatedSymbols.push(best.symbol);
      continue;
      
      
    } catch (error) {
      validatedSymbols.push(symbol);
      console.log(`   ❌ ${symbol} - 错误: ${error.message}，保持原样`);
    }
  }
  
  console.log(`✅ [智能验证] 完成: ${validatedSymbols.join(', ')}\n`);
  return validatedSymbols;
}

// Detect Actions - 检测用户需要的"器官"操作（Brain给N8N下指令）
function detectActions(text = "", symbols = []) {
  const t = text.toLowerCase();
  const actions = [];
  
  // 🎯 优先判断：个股K线图 vs 市场热力图
  const hasSymbols = symbols && symbols.length > 0;
  const explicitHeatmap = /热力图|heatmap|市场图|板块图|sector/.test(t);
  const needsChart = /图|chart|走势|k线|k-line|candlestick|图表|可视化|visual/.test(t);
  
  // 🔍 决策逻辑：
  // 1. 如果有symbols + 需要图表 + 不是明确说"热力图" → 个股K线图
  // 2. 如果明确说"热力图" → 市场热力图
  // 3. 如果没有symbols + 需要图表 → 市场热力图
  
  if (hasSymbols && needsChart && !explicitHeatmap) {
    // 个股K线图优先
    actions.push({
      type: 'fetch_symbol_chart',
      tool: 'TradingView_SymbolChart',
      symbols: symbols,
      reason: `用户要求查看${symbols.join(', ')}的K线走势图`
    });
    console.log(`📈 检测到个股图表需求: ${symbols.join(', ')}`);
    return actions;  // 直接返回，不再检测热力图
  }
  
  // 视觉需求（市场热力图/截图）
  if (explicitHeatmap || (/截图|screenshot/.test(t) && !hasSymbols)) {
    // 智能检测具体指数（优先级高于地区检测）
    let index = '';
    let indexName = '';
    
    // 🇺🇸 美国指数
    if (/纳斯达克100|nasdaq\s*100|nasdaq100|ndx/.test(t)) {
      index = 'NASDAQ100';
      indexName = 'Nasdaq 100';
    } else if (/纳斯达克综合|nasdaq\s*composite|nasdaqcomposite/.test(t)) {
      index = 'NASDAQCOMPOSITE';
      indexName = 'Nasdaq Composite';
    } else if (/纳斯达克银行|nasdaq\s*bank/.test(t)) {
      index = 'NASDAQBKX';
      indexName = 'Nasdaq Bank';
    } else if (/道琼斯工业|道指|dow\s*jones\s*industrial|djdji|dji/.test(t)) {
      index = 'DJDJI';
      indexName = '道琼斯工业指数';
    } else if (/道琼斯公用|dow\s*utilities|djdju/.test(t)) {
      index = 'DJDJU';
      indexName = '道琼斯公用事业';
    } else if (/道琼斯运输|dow\s*transport|djdjt/.test(t)) {
      index = 'DJDJT';
      indexName = '道琼斯运输';
    } else if (/道琼斯综合|dow\s*composite|djca/.test(t)) {
      index = 'DJCA';
      indexName = '道琼斯综合';
    } else if (/罗素1000|russell\s*1000/.test(t)) {
      index = 'RUSSELL1000';
      indexName = 'Russell 1000';
    } else if (/罗素2000|russell\s*2000/.test(t)) {
      index = 'RUSSELL2000';
      indexName = 'Russell 2000';
    } else if (/罗素3000|russell\s*3000/.test(t)) {
      index = 'RUSSELL3000';
      indexName = 'Russell 3000';
    } else if (/标普500|s&p\s*500|spx|sp500/.test(t)) {
      index = 'SPX500';
      indexName = 'S&P 500';
    }
    
    // 🇪🇸 西班牙指数
    if (!index && /西班牙|spain|ibex|马德里|bme/.test(t)) {
      if (/small\s*cap|小盘|小型股|bmeis/.test(t)) {
        index = 'BMEIS';
        indexName = 'BME Small Cap';
      } else if (/消费|consumer|bmeicc/.test(t)) {
        index = 'BMEICC';
        indexName = 'BME Consumer';
      } else if (/industry.*growth.*15|bmeindgro15/.test(t)) {
        index = 'BMEINDGRO15';
        indexName = 'BME Industry Growth 15';
      } else if (/industry.*growth|bmeindgroas/.test(t)) {
        index = 'BMEINDGROAS';
        indexName = 'BME Industry Growth AS';
      } else if (/ibex\s*35|ibex35/.test(t)) {
        index = 'IBEX35';
        indexName = 'IBEX 35';
      }
    }
    
    // 🇬🇧 英国指数
    if (!index && /英国|uk|britain|ftse|伦敦/.test(t)) {
      if (/ftse\s*100|uk100/.test(t)) {
        index = 'UK100';
        indexName = 'FTSE 100';
      }
    }
    
    // 🇩🇪 德国指数
    if (!index && /德国|germany|法兰克福/.test(t)) {
      if (/tecdax|科技/.test(t)) {
        index = 'TECDAX';
        indexName = 'TecDAX';
      } else if (/mdax|中盘/.test(t)) {
        index = 'MDAX';
        indexName = 'MDAX';
      } else if (/sdax|小盘/.test(t)) {
        index = 'SDAX';
        indexName = 'SDAX';
      } else if (/dax/.test(t)) {
        index = 'DAX';
        indexName = 'DAX 40';
      }
    }
    
    // 🇫🇷 法国指数
    if (!index && /法国|france|巴黎/.test(t)) {
      if (/sbf\s*120/.test(t)) {
        index = 'SBF120';
        indexName = 'SBF 120';
      } else if (/cac\s*40|cac40/.test(t)) {
        index = 'CAC40';
        indexName = 'CAC 40';
      }
    }
    
    // 🏭 行业指数
    if (!index) {
      if (/邮轮|游轮|cruise/.test(t)) {
        index = 'TVCRUI';
        indexName = 'Cruise Industry';
      } else if (/航空.*邮轮|airline.*cruise/.test(t)) {
        index = 'TVCRUA';
        indexName = 'Airlines & Cruise';
      } else if (/运输.*旅游|transport.*travel/.test(t)) {
        index = 'TVCRUT';
        indexName = 'Transport & Travel';
      }
    }
    
    // 💰 加密货币
    if (!index && /加密|crypto|比特币|btc|以太坊|eth/.test(t)) {
      index = 'CRYPTO';
      indexName = 'Cryptocurrency';
    }
    
    // 如果还没有指定指数，继续检测地区/国家
    let market = 'usa';
    let marketName = '美股市场';
    
    if (!index) {
      if (/西班牙|spain|西班牙市场|马德里/.test(t)) {
        market = 'spain';
        marketName = '西班牙市场';
      } else if (/德国|germany|法兰克福/.test(t)) {
        market = 'germany';
        marketName = '德国市场';
      } else if (/英国|uk|britain|伦敦/.test(t)) {
        market = 'uk';
        marketName = '英国市场';
      } else if (/法国|france|巴黎/.test(t)) {
        market = 'france';
        marketName = '法国市场';
      } else if (/日本|japan|nikkei|东京/.test(t)) {
        market = 'japan';
        marketName = '日本市场';
      } else if (/中国|a股|上证|深证|沪深/.test(t)) {
        market = 'china';
        marketName = '中国市场';
      } else if (/香港|hk|恒生/.test(t)) {
        market = 'hongkong';
        marketName = '香港市场';
      } else if (/澳大利亚|澳洲|australia/.test(t)) {
        market = 'australia';
        marketName = '澳大利亚市场';
      } else if (/巴西|brazil/.test(t)) {
        market = 'brazil';
        marketName = '巴西市场';
      } else if (/加拿大|canada/.test(t)) {
        market = 'canada';
        marketName = '加拿大市场';
      } else if (/欧洲|europe|eu/.test(t)) {
        market = 'europe';
        marketName = '欧洲市场';
      } else if (/全球|世界|world/.test(t)) {
        market = 'world';
        marketName = '全球市场';
      }
    }
    
    // 🏭 检测行业板块意图（11个GICS行业）
    let sector = '';
    let sectorName = '';
    
    // 能源（Energy）
    if (/能源|energy|石油|oil|天然气|natural gas|repsol|雷普索尔/.test(t)) {
      sector = 'energy';
      sectorName = '能源板块';
    }
    // 科技（Technology）
    else if (/科技|technology|tech|软件|software|半导体|semiconductor|芯片/.test(t)) {
      sector = 'technology';
      sectorName = '科技板块';
    }
    // 金融（Financials）
    else if (/金融|finance|银行|bank|保险|insurance|桑坦德|santander|bbva/.test(t)) {
      sector = 'financials';
      sectorName = '金融板块';
    }
    // 医疗（Healthcare）
    else if (/医疗|healthcare|health|医药|pharma|制药/.test(t)) {
      sector = 'healthcare';
      sectorName = '医疗板块';
    }
    // 消费（Consumer）
    else if (/消费|consumer|零售|retail/.test(t)) {
      sector = 'consumer-cyclical';
      sectorName = '消费板块';
    }
    // 工业（Industrials）
    else if (/工业|industrial|制造|manufacturing/.test(t)) {
      sector = 'industrials';
      sectorName = '工业板块';
    }
    // 房地产（Real Estate）
    else if (/房地产|real estate|地产/.test(t)) {
      sector = 'real-estate';
      sectorName = '房地产板块';
    }
    // 材料（Materials）
    else if (/材料|materials|化工|chemical/.test(t)) {
      sector = 'basic-materials';
      sectorName = '材料板块';
    }
    // 公用事业（Utilities）
    else if (/公用|utilities|电力|iberdrola|endesa/.test(t)) {
      sector = 'utilities';
      sectorName = '公用事业板块';
    }
    // 通信（Communication Services）
    else if (/通信|communication|电信|telecom|telefonica|西班牙电信/.test(t)) {
      sector = 'communication-services';
      sectorName = '通信板块';
    }
    
    // 🎯 直接使用TradingView官方热力图URL（更稳定，加载更快）
    // 将市场/指数映射到TradingView的dataSource
    const dataSourceMapping = {
      // 美国
      'usa': 'SPX500',
      'NASDAQ100': 'NASDAQ100',
      'NASDAQ': 'NASDAQCOMPOSITE',
      'DJI': 'DJDJI',
      'DOW': 'DJDJI',
      'SP500': 'SPX500',
      // 西班牙
      'spain': 'IBEX35',
      'IBEX': 'IBEX35',
      'IBEX35': 'IBEX35',
      // 德国
      'germany': 'DAX',
      'DAX': 'DAX',
      // 英国
      'uk': 'UK100',
      'FTSE': 'UK100',
      // 法国
      'france': 'CAC40',
      'CAC40': 'CAC40',
      // 其他
      'japan': 'AllJP',
      'china': 'AllCN',
      'hongkong': 'AllCN',
      'australia': 'AllAU',
      'europe': 'CAC40',
      'world': 'SPX500'
    };
    
    // 确定dataSource
    let dataSource = index ? dataSourceMapping[index.toUpperCase()] : dataSourceMapping[market];
    if (!dataSource) {
      dataSource = 'SPX500'; // 默认S&P 500
    }
    
    // 构建TradingView官方URL（支持行业筛选）
    let heatmapUrl = `https://www.tradingview.com/heatmap/stock/?color=change&dataset=${dataSource}&group=sector`;
    
    // 如果指定了行业，添加section参数
    if (sector) {
      heatmapUrl += `&section=${sector}`;
      marketName = `${marketName} - ${sectorName}`;
      console.log(`🏭 检测到行业板块: ${sectorName} (${sector})`);
    }
    
    console.log(`📊 生成TradingView官方热力图URL: ${heatmapUrl} (dataSource: ${dataSource}${sector ? `, sector: ${sector}` : ''})`);
    
    actions.push({
      type: 'fetch_heatmap',
      tool: 'A_Screenshot',
      url: heatmapUrl,
      market: marketName,
      reason: `用户要求${marketName}热力图`,
      dataSource: dataSource
    });
  }
  
  // 深度新闻需求（RSS爬取）
  if (/深度新闻|详细资讯|news detail|爬取/.test(t)) {
    actions.push({
      type: 'fetch_news_rss',
      tool: 'C_RSS_News',
      reason: '用户需要深度新闻爬取'
    });
  }
  
  // Twitter情绪需求
  if (/推特|twitter|社交|sentiment|情绪|x\.com/.test(t)) {
    actions.push({
      type: 'fetch_twitter',
      tool: 'Twitter_Search',
      reason: '用户需要社交媒体情绪'
    });
  }
  
  // 图片生成需求
  if (/生成图|画图|generate image|create chart|ai.*图/.test(t)) {
    actions.push({
      type: 'generate_image',
      tool: '/img/imagine',
      reason: '用户需要AI生成图片'
    });
  }
  
  return actions;
}

// Intent Understanding - 深度意图理解 + Action Detection
function understandIntent(text = "", mode = null, symbols = []) {
  const t = text.toLowerCase();
  
  // 如果已经指定 mode，直接使用
  if (mode && ['premarket', 'intraday', 'postmarket', 'diagnose', 'news'].includes(mode)) {
    return { 
      mode, 
      confidence: 1.0, 
      lang: 'zh',
      actions: detectActions(text, symbols) // 新增：检测需要执行的动作
    };
  }
  
  // 关键词匹配
  let detectedMode = null;
  let confidence = 0.8;
  
  // 🎯 Meta模式：关于AI本身的问题（严格匹配，避免误判市场分析）
  const hasMetaKeyword = /(你是谁|你叫什么名字|你的功能|介绍.*自己|what can you do|who are you|your capability|你的能力是|你都能做)/.test(t);
  const hasStockContext = /([A-Z]{1,5}\b|股票|盘前|盘中|盘后|分析|诊股|热力图|新闻|行情)/.test(text);
  
  if (hasMetaKeyword && !hasStockContext) {
    detectedMode = 'meta';
  } else if (/(盘前|premarket|\bpre\b|开盘前|早盘)/.test(t)) {
    detectedMode = 'premarket';
  } else if (/(盘中|intraday|live|盘面|实时|当前)/.test(t)) {
    detectedMode = 'intraday';
  } else if (/(复盘|收盘|postmarket|review|after|晚间|收市)/.test(t)) {
    detectedMode = 'postmarket';
  } else if (/(解票|诊股|ticker|symbol|分析.*股|看.*股)/.test(t)) {
    detectedMode = 'diagnose';
  } else if (/(新闻|资讯|消息|news|热点|头条)/.test(t)) {
    detectedMode = 'news';
  } else {
    // 默认根据美东时间判断（DST-aware）
    const now = new Date();
    // 使用 Intl.DateTimeFormat 获取美东时间（自动处理DST）
    const etHour = parseInt(new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      hour12: false
    }).format(now));
    
    if (etHour >= 6 && etHour < 9) detectedMode = 'premarket';      // 6am-9am ET
    else if (etHour >= 9 && etHour < 16) detectedMode = 'intraday'; // 9am-4pm ET
    else if (etHour >= 16 && etHour < 22) detectedMode = 'postmarket'; // 4pm-10pm ET
    else detectedMode = 'news';
    confidence = 0.5; // 低置信度
  }
  
  return { 
    mode: detectedMode, 
    confidence, 
    lang: 'zh',
    actions: detectActions(text, symbols) // 新增：检测需要执行的动作
  };
}

// Scene Awareness - 场景感知（判断内容长度和深度）
function analyzeScene(mode, symbols = []) {
  const scenes = {
    premarket: {
      name: '盘前资讯',
      targetLength: 300,  // 短内容
      depth: 'brief',     // 简要
      style: 'quick',     // 快速扫描
      focus: ['sentiment', 'key_news', 'major_events']
    },
    intraday: {
      name: '盘中热点',
      targetLength: 500,  // 中等长度
      depth: 'medium',    // 中等深度
      style: 'alert',     // 警觉关注
      focus: ['price_action', 'volume', 'breaking_news']
    },
    postmarket: {
      name: '晚间复盘',
      targetLength: 800,  // 长内容
      depth: 'deep',      // 深度分析
      style: 'analytical',// 分析总结
      focus: ['full_day_review', 'trend_analysis', 'strategy']
    },
    diagnose: {
      name: '个股诊断',
      targetLength: 600,  // 中长内容
      depth: 'deep',      // 深度
      style: 'focused',   // 聚焦
      focus: ['technical', 'fundamental', 'sentiment']
    },
    news: {
      name: '市场资讯',
      targetLength: 500,  // 中等
      depth: 'medium',    // 中等
      style: 'informative', // 信息性
      focus: ['events', 'impact', 'context']
    }
  };
  
  return scenes[mode] || scenes.news;
}

// ========================================
// 🚀 三级Orchestrator架构 (阶段I新增)
// ========================================

// L1: 复杂度评分器 - 评估请求的复杂度，决定使用哪个层级处理
function calculateComplexityScore(text = "", mode = "", symbols = [], userHistory = []) {
  let complexityScore = 0;
  
  // 1. 基于模式的基础分数
  const modeScores = {
    'meta': 0,        // 最简单，直接回复
    'casual': 1,      // 闲聊，轻量AI
    'news': 2,        // 新闻，中等
    'premarket': 3,   // 盘前简报
    'intraday': 4,    // 盘中分析
    'diagnose': 6,    // 个股诊断，需要深度
    'postmarket': 7   // 复盘总结，最深度
  };
  complexityScore += (modeScores[mode] || 3);
  
  // 2. 股票数量影响
  if (symbols.length >= 5) complexityScore += 3;  // 多股票对比
  else if (symbols.length >= 2) complexityScore += 2;  // 2-4只股票
  else if (symbols.length === 1) complexityScore += 1;  // 单股
  
  // 3. 文本复杂度
  const textLower = text.toLowerCase();
  const complexKeywords = [
    '策略', '对冲', '套利', '组合', 'strategy', 'hedge', 'portfolio',
    '回测', 'backtest', '量化', 'quant',
    '风险', 'risk', '波动', 'volatility',
    '为什么', 'why', '原因', 'reason', '深度', 'deep'
  ];
  const complexKeywordCount = complexKeywords.filter(k => textLower.includes(k)).length;
  complexityScore += complexKeywordCount * 2;
  
  // 4. 问题类型
  if (/如何|怎么|怎样|为什么|why|how/.test(textLower)) complexityScore += 2;  // 需要推理
  if (/对比|比较|vs|versus/.test(textLower)) complexityScore += 3;  // 需要对比分析
  
  // 5. 历史上下文依赖
  if (userHistory && userHistory.length > 0) {
    const recentModes = userHistory.map(h => h.mode);
    if (recentModes.includes('diagnose') || recentModes.includes('postmarket')) {
      complexityScore += 1;  // 用户偏好深度分析
    }
  }
  
  // 归一化到0-10
  complexityScore = Math.min(10, Math.max(0, complexityScore));
  
  // 决定层级
  let tier = 'L1';  // L1: 快速路由（GPT-4o-mini）
  if (complexityScore >= 8) tier = 'L3';  // L3: 深度推理（o1/Claude Opus）
  else if (complexityScore >= 4) tier = 'L2';  // L2: 标准分析（现有6-AI）
  
  return {
    score: complexityScore,
    tier,
    reasoning: `模式:${mode}(${modeScores[mode] || 0}分) + 股票:${symbols.length}只 + 关键词:${complexKeywordCount}个`
  };
}

// L2: 智能模型选择器 - 根据场景选择最优AI模型组合
function selectOptimalModels(complexity, mode, symbols = [], budget = 'medium') {
  // 预算配置（每次分析的目标成本）
  const budgetConfigs = {
    'low': { maxCost: 0.05, maxModels: 2 },      // $0.05 - 2个模型
    'medium': { maxCost: 0.15, maxModels: 4 },   // $0.15 - 4个模型
    'high': { maxCost: 0.30, maxModels: 6 },     // $0.30 - 6个模型
    'unlimited': { maxCost: 1.0, maxModels: 9 }  // $1.00 - 9个模型（包括o1）
  };
  
  const budgetConfig = budgetConfigs[budget] || budgetConfigs['medium'];
  
  // 模型成本估算（每次调用约1000 tokens）
  const modelCosts = {
    'gpt4o-mini': 0.0003,    // 最便宜，快速路由用
    'claude': 0.015,         // Claude 3.5 Sonnet
    'deepseek': 0.0014,      // DeepSeek Chat
    'gpt4': 0.03,            // GPT-4
    'gemini': 0.001,         // Gemini Pro (免费tier)
    'perplexity': 0.005,     // Perplexity Sonar
    'mistral': 0.007,        // Mistral Large
    'claude-opus': 0.075,    // Claude Opus (顶级)
    'o1': 0.300              // OpenAI o1 (深度推理)
  };
  
  const selectedModels = [];
  let estimatedCost = 0;
  
  // L1层：使用GPT-4o-mini快速路由（meta、casual场景）
  if (complexity.tier === 'L1') {
    selectedModels.push({ name: 'gpt4o-mini', role: 'quick_responder', cost: modelCosts['gpt4o-mini'] });
    estimatedCost += modelCosts['gpt4o-mini'];
  }
  
  // L2层：标准6-AI协同（大部分场景）
  else if (complexity.tier === 'L2') {
    // 核心模型（总是使用）
    const coreModels = ['claude', 'gpt4', 'deepseek'];
    coreModels.forEach(model => {
      selectedModels.push({ name: model, role: AI_ROLES[model]?.specialty || '分析师', cost: modelCosts[model] });
      estimatedCost += modelCosts[model];
    });
    
    // 根据场景添加专业模型
    if (mode === 'news' || mode === 'intraday') {
      selectedModels.push({ name: 'gemini', role: AI_ROLES.gemini.specialty, cost: modelCosts.gemini });
      selectedModels.push({ name: 'perplexity', role: AI_ROLES.perplexity.specialty, cost: modelCosts.perplexity });
      estimatedCost += modelCosts.gemini + modelCosts.perplexity;
    }
    
    if (mode === 'postmarket' || mode === 'diagnose') {
      selectedModels.push({ name: 'mistral', role: AI_ROLES.mistral.specialty, cost: modelCosts.mistral });
      estimatedCost += modelCosts.mistral;
    }
  }
  
  // L3层：深度推理（复杂场景）
  else if (complexity.tier === 'L3') {
    // 使用所有6个标准模型
    ['claude', 'deepseek', 'gpt4', 'gemini', 'perplexity', 'mistral'].forEach(model => {
      selectedModels.push({ name: model, role: AI_ROLES[model]?.specialty || '分析师', cost: modelCosts[model] });
      estimatedCost += modelCosts[model];
    });
    
    // 如果预算允许，添加深度推理模型
    if (budgetConfig.maxCost >= 0.3) {
      // 优先选择Claude Opus（性价比高）
      selectedModels.push({ name: 'claude-opus', role: '顶级分析师·深度推理', cost: modelCosts['claude-opus'] });
      estimatedCost += modelCosts['claude-opus'];
      
      // 如果预算充足且场景极其复杂，考虑o1
      if (budgetConfig.maxCost >= 1.0 && complexity.score >= 9) {
        selectedModels.push({ name: 'o1', role: '超级大脑·战略推理', cost: modelCosts['o1'] });
        estimatedCost += modelCosts['o1'];
      }
    }
  }
  
  return {
    models: selectedModels,
    estimatedCost: parseFloat(estimatedCost.toFixed(4)),
    tier: complexity.tier,
    budgetConfig: budgetConfig.maxCost,
    withinBudget: estimatedCost <= budgetConfig.maxCost
  };
}

// L3: 成本追踪器 - 记录每次分析的成本
async function trackCost(request_id, user_id, mode, models, actualCost, responseTime) {
  if (!ENABLE_DB) return; // 🛡️ v6.1: Skip when DB disabled
  try {
    // 插入成本记录 (表已在initDatabase中创建)
    await getPool().query(
      'INSERT INTO cost_tracking (request_id, user_id, mode, models, estimated_cost, actual_cost, response_time_ms) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [request_id, user_id || 'anonymous', mode, JSON.stringify(models), actualCost, actualCost, responseTime]
    );
    
    console.log(`💰 成本追踪 [${request_id}]: $${actualCost.toFixed(4)} (${responseTime}ms)`);
  } catch (error) {
    console.error('❌ 成本追踪失败:', error.message);
  }
}

// L3: 获取总成本 - 从数据库汇总特定请求的总成本
async function getTotalCostFromDB(requestId) {
  if (!ENABLE_DB) return 0; // 🛡️ v6.1: Return 0 when DB disabled
  try {
    const { rows } = await getPool().query(
      'SELECT COALESCE(SUM(actual_cost), 0) AS total FROM cost_tracking WHERE request_id = $1',
      [requestId]
    );
    const total = Number(rows?.[0]?.total ?? 0);
    return total;
  } catch (error) {
    console.error('❌ 获取成本失败:', error.message);
    return null;
  }
}

// --- plan step friendly mapper (i18n-ready) ---
function mapPlanSteps(rawPlan = [], lang = 'zh') {
  const L = (lang || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';

  /** 内部步骤标识 → 友好文案 */
  const dict = {
    zh: {
      understand_context: '理解上下文与意图',
      fetch_sentiment: '拉取情绪/社交数据',
      fetch_quotes: '抓取行情/财务数据',
      technical_analysis: '技术指标与形态判断',
      multi_ai_analysis: '多模型协同分析',
      synthesize: '综合结论与生成报告',
      fetch_sec_fin: 'SEC 财报检索与提取',
      fetch_macro_fred: 'FRED 宏观数据拉取',
      fetch_reddit_wsb: 'Reddit/WSB 热度分析',
      risk_assessment: '风险点与不确定性评估',
      viz_single: '单指标图表智能生成',
      fetch_news: '拉取最新资讯'
    },
    en: {
      understand_context: 'Understand context & intent',
      fetch_sentiment: 'Pull sentiment / social signals',
      fetch_quotes: 'Fetch quotes / fundamentals',
      technical_analysis: 'Technical indicators & patterns',
      multi_ai_analysis: 'Multi-model collaborative analysis',
      synthesize: 'Synthesize findings & draft report',
      fetch_sec_fin: 'SEC filings retrieval & parsing',
      fetch_macro_fred: 'FRED macro data ingestion',
      fetch_reddit_wsb: 'Reddit/WSB trend analysis',
      risk_assessment: 'Risk & uncertainty assessment',
      viz_single: 'Smart single-metric chart generation',
      fetch_news: 'Fetch latest news'
    }
  };

  const mapOne = (k) => dict[L][k] || (typeof k === 'string' ? k : JSON.stringify(k));
  // 去重 + 保序
  const seen = new Set();
  const out = [];
  for (const step of rawPlan) {
    const label = mapOne(step);
    if (!seen.has(label)) { seen.add(label); out.push(label); }
  }
  return out;
}

// Planner - 任务规划器
function planTasks(intent, scene, symbols = []) {
  const tasks = [];
  
  // 基础任务：总是需要
  tasks.push('understand_context');
  
  // 根据场景添加任务
  if (scene.focus.includes('sentiment') || scene.focus.includes('trend_analysis')) {
    tasks.push('fetch_sentiment');
  }
  
  if (scene.focus.includes('key_news') || scene.focus.includes('breaking_news') || scene.focus.includes('events')) {
    tasks.push('fetch_news');
  }
  
  if (symbols.length > 0) {
    tasks.push('fetch_quotes');
    
    if (scene.focus.includes('technical')) {
      tasks.push('technical_analysis');
    }
  }
  
  // 多 AI 分析（核心任务）
  tasks.push('multi_ai_analysis');
  
  // 智能合成
  tasks.push('synthesize');
  
  return tasks;
}

// ========================================
// Multi-AI Coordination - 多AI协调系统
// ========================================

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const PERPLEXITY_KEY = process.env.PERPLEXITY_API_KEY;
const MISTRAL_KEY = process.env.MISTRAL_API_KEY;
const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_API_KEY;

// AI Agent Roles - 每个AI的角色定位（6个分析AI）
const AI_ROLES = {
  claude: {
    name: 'Claude',
    specialty: '技术分析专家',
    focus: '技术指标、图表形态、支撑阻力位'
  },
  deepseek: {
    name: 'DeepSeek',
    specialty: '中文市场洞察',
    focus: '中文资讯解读、A股港股联动、本地化分析'
  },
  gpt4: {
    name: 'GPT-4',
    specialty: '综合策略分析师',
    focus: '宏观趋势、风险评估、投资建议'
  },
  gemini: {
    name: 'Gemini',
    specialty: '实时数据分析',
    focus: '最新资讯、实时行情、突发事件'
  },
  perplexity: {
    name: 'Perplexity',
    specialty: '深度研究专家',
    focus: '行业研究、公司基本面、长期趋势'
  },
  mistral: {
    name: 'Mistral',
    specialty: '市场情绪与风险评估',
    focus: '情绪指标、恐慌贪婪、风险预警'
  }
};

// Call Claude API
async function callClaude(prompt, maxTokens = 300) {
  try {
    if (!CLAUDE_KEY) {
      return { success: false, error: 'CLAUDE_KEY missing' };
    }
    
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": CLAUDE_KEY,
        "content-type": "application/json",
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }]
      })
    });
    
    const data = await response.json();
    const text = data?.content?.[0]?.text || '';
    
    return { success: true, text };
  } catch (err) {
    console.error('❌ Claude error:', err.message);
    return { success: false, error: err.message };
  }
}

// Call DeepSeek API
async function callDeepSeek(prompt, maxTokens = 300) {
  try {
    if (!DEEPSEEK_KEY) {
      return { success: false, error: 'DEEPSEEK_KEY missing' };
    }
    
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DEEPSEEK_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens
      })
    });
    
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || '';
    
    return { success: true, text };
  } catch (err) {
    console.error('❌ DeepSeek error:', err.message);
    return { success: false, error: err.message };
  }
}

// Call GPT-4 API
async function callGPT4(prompt, maxTokens = 400) {
  try {
    if (!OPENAI_KEY) {
      return { success: false, error: 'OPENAI_KEY missing' };
    }
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.3
      })
    });
    
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || '';
    
    return { success: true, text };
  } catch (err) {
    console.error('❌ GPT-4 error:', err.message);
    return { success: false, error: err.message };
  }
}

// Call Gemini API
async function callGemini(prompt, maxTokens = 300) {
  try {
    if (!GEMINI_KEY) {
      return { success: false, error: 'GEMINI_KEY missing' };
    }
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: 0.3
        }
      })
    });
    
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    return { success: true, text };
  } catch (err) {
    console.error('❌ Gemini error:', err.message);
    return { success: false, error: err.message };
  }
}

// Call Perplexity API
async function callPerplexity(prompt, maxTokens = 300) {
  try {
    if (!PERPLEXITY_KEY) {
      return { success: false, error: 'PERPLEXITY_KEY missing' };
    }
    
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-small-128k-online",
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.3
      })
    });
    
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || '';
    
    return { success: true, text };
  } catch (err) {
    console.error('❌ Perplexity error:', err.message);
    return { success: false, error: err.message };
  }
}

// Call Mistral API
async function callMistral(prompt, maxTokens = 300) {
  try {
    if (!MISTRAL_KEY) {
      return { success: false, error: 'MISTRAL_KEY missing' };
    }
    
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MISTRAL_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "mistral-large-latest",
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.3
      })
    });
    
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || '';
    
    return { success: true, text };
  } catch (err) {
    console.error('❌ Mistral error:', err.message);
    return { success: false, error: err.message };
  }
}

// Multi-AI Analysis - 多AI并行分析（6个AI全面协同）
async function multiAIAnalysis({ mode, scene, symbols, text, chatType, marketData, semanticIntent }) {
  console.log(`🤖 开始6个AI并行分析...`);
  
  // 🆕 v3.1: 尝试使用新的反编造Prompt构建系统
  let useNewPromptSystem = false;
  let unifiedPrompt = '';
  
  if (marketData && marketData.metadata && semanticIntent) {
    try {
      // 使用新的buildAnalysisPrompt（强制数据引用）
      unifiedPrompt = buildAnalysisPrompt({
        marketData,
        intent: semanticIntent,
        userQuery: text,
        mode,
        language: semanticIntent.language || 'zh'
      });
      useNewPromptSystem = true;
      console.log(`✅ 使用v3.1反编造Prompt系统 (${unifiedPrompt.length}字)`);
    } catch (error) {
      console.warn(`⚠️  新Prompt系统失败，降级到旧系统:`, error.message);
      useNewPromptSystem = false;
    }
  }
  
  // 降级：使用旧的Prompt构建逻辑
  if (!useNewPromptSystem) {
    console.log(`ℹ️  使用v3.0 Prompt系统（旧逻辑）`);
    
    let dataContext = '';
    let hasRealData = false;
    
    if (marketData && marketData.collected && marketData.summary) {
      dataContext = `【⚠️ 必须使用以下Finnhub实时数据，禁止编造】\n${marketData.summary}\n\n用户请求：`;
      hasRealData = true;
      console.log(`✅ 实时数据已注入AI prompt (${marketData.summary.length}字)`);
    } else if (symbols.length > 0) {
      console.error(`❌ 严重错误：有股票代码但marketData为空！`);
      dataContext = `【数据采集失败，以下分析基于历史知识，可能不准确】\n\n用户请求：`;
    } else {
      // 🔧 修复：热力图请求也需要明确指令，禁止编造数据
      const isHeatmapRequest = semanticIntent && semanticIntent.actions && semanticIntent.actions.some(a => 
        a === 'fetch_heatmap' || (a.type && a.type === 'fetch_heatmap')
      );
      
      if (isHeatmapRequest) {
        const exchangeName = semanticIntent.exchange || '全球';
        console.log(`🗺️  热力图请求，添加市场分析指令`);
        dataContext = `【用户请求${exchangeName}市场热力图】\n\n⚠️ 重要提示：\n- 你无法获取${exchangeName}市场的实时数据\n- 请提供该市场的一般性分析（不要编造具体价格或涨跌幅）\n- 重点分析市场趋势、板块轮动、投资策略等宏观话题\n- 避免提及任何具体数字（如"涨了X%"、"价格Y元"等）\n\n用户请求：`;
      } else {
        console.log(`ℹ️  无股票代码，跳过实时数据注入`);
        dataContext = '';
      }
    }
    
    const context = {
      mode,
      scene: scene.name,
      symbols: symbols.join(', ') || '无特定股票',
      request: dataContext + text,
      hasRealData
    };
    
    // 构建不同AI的prompt（旧方式）
    const prompts = {
      claude: buildClaudePrompt(context, scene),
      deepseek: buildDeepSeekPrompt(context, scene),
      gpt4: buildGPT4Prompt(context, scene, chatType),
      gemini: buildGeminiPrompt(context, scene),
      perplexity: buildPerplexityPrompt(context, scene),
      mistral: buildMistralPrompt(context, scene)
    };
    
    // 并行调用6个AI（旧方式）
    const [claudeResult, deepseekResult, gpt4Result, geminiResult, perplexityResult, mistralResult] = await Promise.all([
      callClaude(prompts.claude, scene.targetLength * 0.25),
      callDeepSeek(prompts.deepseek, scene.targetLength * 0.25),
      callGPT4(prompts.gpt4, scene.targetLength * 0.3),
      callGemini(prompts.gemini, scene.targetLength * 0.25),
      callPerplexity(prompts.perplexity, scene.targetLength * 0.25),
      callMistral(prompts.mistral, scene.targetLength * 0.25)
    ]);
    
    console.log(`  ✅ Claude: ${claudeResult.success ? '成功' : '失败'}`);
    console.log(`  ✅ DeepSeek: ${deepseekResult.success ? '成功' : '失败'}`);
    console.log(`  ✅ GPT-4: ${gpt4Result.success ? '成功' : '失败'}`);
    console.log(`  ✅ Gemini: ${geminiResult.success ? '成功' : '失败'}`);
    console.log(`  ✅ Perplexity: ${perplexityResult.success ? '成功' : '失败'}`);
    console.log(`  ✅ Mistral: ${mistralResult.success ? '成功' : '失败'}`);
    
    return {
      claude: { ...AI_ROLES.claude, ...claudeResult },
      deepseek: { ...AI_ROLES.deepseek, ...deepseekResult },
      gpt4: { ...AI_ROLES.gpt4, ...gpt4Result },
      gemini: { ...AI_ROLES.gemini, ...geminiResult },
      perplexity: { ...AI_ROLES.perplexity, ...perplexityResult },
      mistral: { ...AI_ROLES.mistral, ...mistralResult }
    };
  }
  
  // 🆕 v3.1: 使用统一的反编造Prompt
  // 所有AI都使用相同的prompt（确保数据引用一致）
  const targetLength = scene.targetLength * 0.25;
  
  const [claudeResult, deepseekResult, gpt4Result, geminiResult, perplexityResult, mistralResult] = await Promise.all([
    callClaude(unifiedPrompt, targetLength),
    callDeepSeek(unifiedPrompt, targetLength),
    callGPT4(unifiedPrompt, scene.targetLength * 0.3),
    callGemini(unifiedPrompt, targetLength),
    callPerplexity(unifiedPrompt, targetLength),
    callMistral(unifiedPrompt, targetLength)
  ]);
  
  console.log(`  ✅ Claude: ${claudeResult.success ? '成功' : '失败'}`);
  console.log(`  ✅ DeepSeek: ${deepseekResult.success ? '成功' : '失败'}`);
  console.log(`  ✅ GPT-4: ${gpt4Result.success ? '成功' : '失败'}`);
  console.log(`  ✅ Gemini: ${geminiResult.success ? '成功' : '失败'}`);
  console.log(`  ✅ Perplexity: ${perplexityResult.success ? '成功' : '失败'}`);
  console.log(`  ✅ Mistral: ${mistralResult.success ? '成功' : '失败'}`);
  
  return {
    claude: { ...AI_ROLES.claude, ...claudeResult },
    deepseek: { ...AI_ROLES.deepseek, ...deepseekResult },
    gpt4: { ...AI_ROLES.gpt4, ...gpt4Result },
    gemini: { ...AI_ROLES.gemini, ...geminiResult },
    perplexity: { ...AI_ROLES.perplexity, ...perplexityResult },
    mistral: { ...AI_ROLES.mistral, ...mistralResult }
  };
}

// Build Claude Prompt - 技术分析专家
function buildClaudePrompt(context, scene) {
  const dataWarning = context.hasRealData 
    ? '✅ 上方已提供Finnhub实时数据，第一句必须引用真实价格和涨跌幅！' 
    : '⚠️ 未提供实时数据，请基于历史知识分析并说明数据可能过时';
  
  return `你是一位技术分析专家，专注于${scene.focus.join('、')}。

${context.request}

🎯 ${dataWarning}

输出要求（${scene.targetLength/3}字左右）：
1. **开头第一句**：必须包含股票代码、当前价格、涨跌幅（从上方实时数据获取）
2. **技术面分析**：价格位置、趋势判断、成交量（2-3个要点）
3. **结论**：短期趋势预测

注意：
- 禁止编造价格数据！必须使用上方提供的真实数据
- 如果没有实时数据，必须明确说明"基于历史数据"
- 专业简洁，不要免责声明`;
}

// Build DeepSeek Prompt - 中文市场专家
function buildDeepSeekPrompt(context, scene) {
  return `你是一位中文市场分析专家，擅长解读中文资讯和本地市场情绪。

场景：${context.scene}
股票：${context.symbols}
用户请求：${context.request}

请从市场情绪和资讯角度提供${scene.targetLength/3}字左右的分析，包括：
- 市场情绪判断
- 关键资讯解读
- 风险提示

要求：
- 中文地道表达
- 关注情绪面
- 简洁有力`;
}

// Build GPT-4 Prompt - 综合策略分析师
function buildGPT4Prompt(context, scene, chatType) {
  // 新闻模式：返回新闻摘要而非投资分析
  if (context.mode === 'news') {
    return `你是一位财经新闻编辑，负责整理最新市场资讯。

股票：${context.symbols || '全市场'}
用户请求：${context.request}

请以新闻摘要形式输出，格式：
1. 【标题】新闻标题
   摘要：简短说明（20-30字）
   
2. 【标题】第二条新闻
   摘要：简短说明

要求：
- 列出3-5条最重要的新闻
- 每条新闻包含标题和简短摘要
- 优先报道重大事件、财报、政策变化
- 不要分析和建议，只报道事实
- ${chatType === 'private' ? '口语化表达' : '专业新闻语气'}`;
  }
  
  // 常规模式：投资分析
  let styleGuide = chatType === 'private' 
    ? `风格：像贴心老师一样，用"你看"、"我注意到"等口语化表达，用生活化类比解释专业概念` 
    : `风格：专业团队口吻，使用"老师团队认为"、"我们认为"，结构化输出`;
  
  if (scene.userTone === 'casual') styleGuide += `\n额外要求：使用更加轻松随意的语气`;
  else if (scene.userTone === 'professional') styleGuide += `\n额外要求：保持专业严谨的语气`;
  
  return `你是一位综合策略分析师，负责整合技术面和情绪面，给出最终建议。

场景：${context.scene}
股票：${context.symbols}
用户请求：${context.request}

${styleGuide}

🎯 数据使用要求：
- **必须引用实时价格**：开头第一句必须包含当前价格和涨跌幅
- **必须结合市场情绪**：如果有情绪数据（看多/看空百分比），必须提及
- **必须参考新闻**：如果有最新新闻，需简要概括关键信息

请提供${scene.targetLength/5}字左右的综合分析，包括：
- 开头：当前价格 + 涨跌幅（必须有）
- 整体判断（BUY/HOLD/SELL）
- 核心理由（2-3点，结合技术面+情绪面+新闻面）
- 具体建议

要求：
- ${chatType === 'private' ? '口语化、有温度' : '专业、结构化'}
- 给出明确观点
- 不要免责声明`;
}

// Build Gemini Prompt - 实时数据分析
function buildGeminiPrompt(context, scene) {
  return `你是一位实时数据分析专家，专注于最新资讯和实时行情。

场景：${context.scene}
股票：${context.symbols}
用户请求：${context.request}

请从实时数据角度提供${scene.targetLength/5}字左右的分析，包括：
- 最新市场动态
- 突发新闻影响
- 当前价格走势

要求：
- 关注实时性
- 数据准确
- 简洁有力`;
}

// Build Perplexity Prompt - 深度研究
function buildPerplexityPrompt(context, scene) {
  return `你是一位深度研究专家，专注于行业研究和公司基本面。

场景：${context.scene}
股票：${context.symbols}
用户请求：${context.request}

请从基本面角度提供${scene.targetLength/6}字左右的分析，包括：
- 公司基本面分析
- 行业趋势判断
- 长期投资价值

要求：
- 深度挖掘
- 逻辑严谨
- 不要废话`;
}

// Build Mistral Prompt - 市场情绪与风险评估
function buildMistralPrompt(context, scene) {
  return `你是一位市场情绪和风险评估专家，专注于识别市场恐慌与贪婪。

场景：${context.scene}
股票：${context.symbols}
用户请求：${context.request}

请从情绪和风险角度提供${scene.targetLength/6}字左右的分析，包括：
- 当前市场情绪判断（恐慌/中性/贪婪）
- 主要风险因素识别
- 风险等级评估

要求：
- 敏锐捕捉情绪
- 风险提示明确
- 简洁有力`;
}

// ========================================
// Data Empire - 数据帝国层
// ========================================

// Finnhub - 实时行情+新闻+情绪
async function fetchFinnhubQuote(symbol) {
  try {
    if (!FINNHUB_KEY) {
      return { success: false, error: 'FINNHUB_KEY missing' };
    }
    
    const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`);
    const data = await response.json();
    
    if (data.error || !data.c) {
      return { success: false, error: data.error || 'No data' };
    }
    
    return {
      success: true,
      symbol,
      current: data.c,
      high: data.h,
      low: data.l,
      open: data.o,
      previousClose: data.pc,
      change: data.d,
      changePercent: data.dp,
      timestamp: data.t
    };
  } catch (err) {
    console.error(`❌ Finnhub quote error (${symbol}):`, err.message);
    return { success: false, error: err.message };
  }
}

async function fetchFinnhubNews(symbol, limit = 5) {
  try {
    if (!FINNHUB_KEY) {
      return { success: false, error: 'FINNHUB_KEY missing' };
    }
    
    const to = Math.floor(Date.now() / 1000);
    const from = to - 86400 * 3; // 最近3天
    
    const response = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${FINNHUB_KEY}`
    );
    const data = await response.json();
    
    if (!Array.isArray(data)) {
      return { success: false, error: 'Invalid response' };
    }
    
    const news = data.slice(0, limit).map(item => ({
      headline: item.headline,
      summary: item.summary,
      source: item.source,
      url: item.url,
      datetime: item.datetime
    }));
    
    return { success: true, symbol, news };
  } catch (err) {
    console.error(`❌ Finnhub news error (${symbol}):`, err.message);
    return { success: false, error: err.message };
  }
}

async function fetchFinnhubSentiment(symbol) {
  try {
    if (!FINNHUB_KEY) {
      return { success: false, error: 'FINNHUB_KEY missing' };
    }
    
    const response = await fetch(
      `https://finnhub.io/api/v1/news-sentiment?symbol=${symbol}&token=${FINNHUB_KEY}`
    );
    const data = await response.json();
    
    if (data.error) {
      return { success: false, error: data.error };
    }
    
    return {
      success: true,
      symbol,
      sentiment: {
        buzz: data.buzz?.articlesInLastWeek || 0,
        positive: data.sentiment?.bullishPercent || 0,
        negative: data.sentiment?.bearishPercent || 0,
        score: data.companyNewsScore || 0
      }
    };
  } catch (err) {
    console.error(`❌ Finnhub sentiment error (${symbol}):`, err.message);
    return { success: false, error: err.message };
  }
}

// ========================================
// FRED API - 宏观经济数据
// ========================================
const FRED_BASE = 'https://api.stlouisfed.org/fred';
const FRED_KEY = process.env.FRED_API_KEY || ''; // 可先留空，部分公共系列可匿名访问

async function fetchFREDSeries(seriesId, { limit = 12 } = {}) {
  const url = new URL(`${FRED_BASE}/series/observations`);
  url.searchParams.set('series_id', seriesId);
  if (FRED_KEY) url.searchParams.set('api_key', FRED_KEY);
  url.searchParams.set('file_type', 'json');
  url.searchParams.set('sort_order', 'desc');
  url.searchParams.set('limit', String(limit));
  
  try {
    const r = await fetch(url.toString(), { timeout: 12000 });
    if (!r.ok) throw new Error(`FRED ${seriesId} HTTP ${r.status}`);
    const j = await r.json();
    const obs = (j.observations || [])
      .map(o => ({ date: o.date, value: Number(o.value || 'NaN') }))
      .filter(o => Number.isFinite(o.value));
    return { seriesId, latest: obs[0] || null, observations: obs.reverse() }; // 从旧到新
  } catch (e) {
    console.error(`❌ FRED ${seriesId} error:`, e.message);
    throw e;
  }
}

async function collectMacroData({ needMacro = false } = {}) {
  if (!needMacro) return null;
  
  console.log('📊 开始采集FRED宏观数据...');
  
  const seriesWanted = [
    'CPIAUCSL',       // CPI
    'UNRATE',         // 失业率
    'GDPC1',          // 实际GDP
    'FEDFUNDS',       // 联邦基金利率
  ];
  
  const out = {};
  for (const id of seriesWanted) {
    try {
      out[id] = await fetchFREDSeries(id, { limit: 12 });
      console.log(`  ✓ ${id}: ${out[id].latest?.value || 'N/A'}`);
    } catch (e) {
      out[id] = { seriesId: id, error: e.message };
      console.log(`  ✗ ${id}: ${e.message}`);
    }
  }
  
  return out;
}

// ========================================
// 智能可视化模块（最小版本）
// ========================================

// L2: 可视化需求判定（最小版）- 复用L1的intent
// 规则：关键词映射到单个FRED指标 → 单图；盘前/总览 → 纯文字
function detectVisualizationNeedSimple(l1Intent = {}, text = '') {
  const t = (text || '').toLowerCase();
  const mode = (l1Intent.mode || '').toLowerCase();
  
  // 关键词到FRED指标映射
  const map = [
    { test: /(cpi|通胀|物价)/, metric: 'CPIAUCSL' },
    { test: /(失业|unrate|就业)/, metric: 'UNRATE' },
    { test: /(gdp)/, metric: 'GDPC1' },
    { test: /(利率|fedfunds|联邦基金|加息|降息)/, metric: 'FEDFUNDS' },
  ];
  
  for (const m of map) {
    if (m.test.test(t) || m.test.test(mode)) {
      return { needChart: true, metrics: [m.metric], style: 'single', reason: 'rule-min' };
    }
  }
  
  // 盘前/宏观总览 → 先不画图，纯文字
  if (/premarket|宏观|总览|overview/.test(t) || /premarket/.test(mode)) {
    return { needChart: false, metrics: [], style: 'none', reason: 'overview-text' };
  }
  
  return { needChart: false, metrics: [], style: 'none', reason: 'default-text' };
}

// 最小图表生成器（single模式）
// 输入：macro为FRED拉取的market_data.macro；metric: 'CPIAUCSL'等；style: 'single'
async function generateSmartChartSingle(macro, metric) {
  const series = (macro?.[metric]?.observations || []).map(o => ({ 
    date: o.date.slice(0, 7), 
    value: o.value 
  }));
  
  if (series.length < 2) return null;

  // 旧版 QuickChart 已移除（v4.5纯SaaS方案）
  // 宏观经济图表暂不支持，仅返回文本分析
  console.warn('⚠️  宏观经济图表暂不支持（QuickChart已移除）');
  return null;
}

// ========================================
// SEC EDGAR API Integration (阶段I新增)
// ========================================

// SEC EDGAR: 查找公司CIK (Central Index Key)
let SEC_TICKER_MAP = null;  // 缓存ticker到CIK的映射
async function fetchSECCIK(ticker) {
  try {
    // 第一次调用时加载映射表
    if (!SEC_TICKER_MAP) {
      console.log('📥 下载SEC ticker映射表...');
      const response = await fetch('https://www.sec.gov/files/company_tickers.json', {
        headers: {
          'User-Agent': 'USIS Brain v5.0 replit-agent@example.com'
        }
      });
      const data = await response.json();
      
      // 转换为ticker -> CIK映射
      SEC_TICKER_MAP = {};
      Object.values(data).forEach(company => {
        SEC_TICKER_MAP[company.ticker.toUpperCase()] = String(company.cik_str).padStart(10, '0');
      });
      console.log(`✅ SEC映射表加载完成: ${Object.keys(SEC_TICKER_MAP).length} 家公司`);
    }
    
    const cik = SEC_TICKER_MAP[ticker.toUpperCase()];
    if (!cik) {
      return { success: false, error: 'CIK not found' };
    }
    
    return { success: true, ticker, cik };
  } catch (err) {
    console.error(`❌ SEC CIK查找失败 (${ticker}):`, err.message);
    return { success: false, error: err.message };
  }
}

// SEC EDGAR: 获取公司最新财报列表
async function fetchSECFilings(ticker, limit = 5) {
  try {
    const cikResult = await fetchSECCIK(ticker);
    if (!cikResult.success) {
      return { success: false, error: cikResult.error };
    }
    
    const { cik } = cikResult;
    const response = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
      headers: {
        'User-Agent': 'USIS Brain v3.1 replit-agent@example.com'
      }
    });
    
    const data = await response.json();
    const recentFilings = data.filings?.recent;
    
    if (!recentFilings) {
      return { success: false, error: 'No filings found' };
    }
    
    // 提取最近的10-K和10-Q财报
    const filings = [];
    for (let i = 0; i < recentFilings.form.length && filings.length < limit; i++) {
      const formType = recentFilings.form[i];
      if (formType === '10-K' || formType === '10-Q') {
        filings.push({
          form: formType,
          filingDate: recentFilings.filingDate[i],
          reportDate: recentFilings.reportDate[i],
          accessionNumber: recentFilings.accessionNumber[i]
        });
      }
    }
    
    return {
      success: true,
      ticker,
      company: data.name,
      cik,
      filings
    };
  } catch (err) {
    console.error(`❌ SEC财报获取失败 (${ticker}):`, err.message);
    return { success: false, error: err.message };
  }
}

// SEC EDGAR: 获取公司财务数据（简化版）
async function fetchSECFinancials(ticker) {
  try {
    const cikResult = await fetchSECCIK(ticker);
    if (!cikResult.success) {
      return { success: false, error: cikResult.error };
    }
    
    const { cik } = cikResult;
    const response = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
      headers: {
        'User-Agent': 'USIS Brain v3.1 replit-agent@example.com'
      }
    });
    
    const data = await response.json();
    const facts = data.facts?.['us-gaap'];
    
    if (!facts) {
      return { success: false, error: 'No financial facts found' };
    }
    
    // 提取关键财务指标（最近一期）
    const getLatestValue = (conceptNames) => {
      try {
        // 支持多个concept名称，按优先级尝试
        const concepts = Array.isArray(conceptNames) ? conceptNames : [conceptNames];
        
        for (const concept of concepts) {
          const usdData = facts[concept]?.units?.USD;
          if (!usdData || usdData.length === 0) continue;
          
          // 按日期排序，优先获取10-K，其次10-Q
          const sortedData = usdData
            .filter(d => d.form === '10-K' || d.form === '10-Q')
            .sort((a, b) => {
              // 优先10-K，然后按日期
              if (a.form !== b.form) {
                return a.form === '10-K' ? -1 : 1;
              }
              return new Date(b.end) - new Date(a.end);
            });
          
          if (sortedData.length > 0) {
            return {
              value: sortedData[0].val,
              period: sortedData[0].end,
              form: sortedData[0].form
            };
          }
        }
        
        return null;
      } catch (err) {
        console.error(`❌ getLatestValue error for ${conceptNames}:`, err.message);
        return null;
      }
    };
    
    // 尝试多种可能的concept名称（SEC公司使用不同的会计术语）
    const financials = {
      revenue: getLatestValue(['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet']),
      netIncome: getLatestValue(['NetIncomeLoss', 'ProfitLoss']),
      assets: getLatestValue(['Assets']),
      equity: getLatestValue(['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'])
    };
    
    // 检查是否至少有一个有效数据（检查value属性是否存在且非null）
    const hasData = Object.values(financials).some(entry => entry?.value != null);
    if (!hasData) {
      console.log(`⚠️  ${ticker}: 未找到有效财务数据`);
      return { success: false, error: 'No valid financial metrics found' };
    }
    
    return {
      success: true,
      ticker,
      cik,
      financials
    };
  } catch (err) {
    console.error(`❌ SEC财务数据获取失败 (${ticker}):`, err.message);
    return { success: false, error: err.message };
  }
}

// 智能数据采集器 - 根据symbols自动采集多源数据
async function collectMarketData(symbols = [], options = {}) {
  if (symbols.length === 0) {
    return { collected: false, reason: 'No symbols provided' };
  }
  
  // 决定是否获取SEC财报数据（仅在深度分析场景下）
  const includeSEC = options.includeSEC || 
                      options.mode === 'diagnose' || 
                      options.mode === 'postmarket' ||
                      (options.text && /(财报|基本面|10-k|10-q|营收|利润|fundamental)/i.test(options.text));
  
  console.log(`📊 开始采集数据: ${symbols.join(', ')}${includeSEC ? ' (含SEC财报)' : ''}`);
  
  const results = {
    quotes: {},
    news: {},
    sentiment: {},
    ...(includeSEC && { sec_filings: {}, sec_financials: {} })
  };
  
  // 并行采集所有symbol的数据
  await Promise.all(
    symbols.map(async (symbol) => {
      // 基础数据：总是获取
      const [quote, news, sentiment] = await Promise.all([
        fetchFinnhubQuote(symbol),
        fetchFinnhubNews(symbol, 3),
        fetchFinnhubSentiment(symbol)
      ]);
      
      if (quote.success) results.quotes[symbol] = quote;
      if (news.success) results.news[symbol] = news;
      if (sentiment.success) results.sentiment[symbol] = sentiment;
      
      // SEC数据：仅在需要时获取
      if (includeSEC) {
        const [secFilings, secFinancials] = await Promise.all([
          fetchSECFilings(symbol, 3),
          fetchSECFinancials(symbol)
        ]);
        
        if (secFilings.success) results.sec_filings[symbol] = secFilings;
        if (secFinancials.success) results.sec_financials[symbol] = secFinancials;
      }
    })
  );
  
  const dataSourcesCount = includeSEC ? 
    `quotes=${Object.keys(results.quotes).length}, news=${Object.keys(results.news).length}, sentiment=${Object.keys(results.sentiment).length}, SEC财报=${Object.keys(results.sec_filings || {}).length}` :
    `quotes=${Object.keys(results.quotes).length}, news=${Object.keys(results.news).length}, sentiment=${Object.keys(results.sentiment).length}`;
  
  console.log(`✅ 数据采集完成: ${dataSourcesCount}`);
  
  return {
    collected: true,
    data: results,
    summary: generateDataSummary(results)
  };
}

// 生成数据摘要（给AI使用）
function generateDataSummary(results) {
  const parts = [];
  
  // 行情数据
  Object.values(results.quotes).forEach(q => {
    if (q.success) {
      parts.push(`${q.symbol}: 当前$${q.current}, 涨跌${q.changePercent >= 0 ? '+' : ''}${q.changePercent.toFixed(2)}%`);
    }
  });
  
  // 新闻标题
  Object.values(results.news).forEach(n => {
    if (n.success && n.news.length > 0) {
      const headlines = n.news.slice(0, 2).map(item => item.headline).join('; ');
      parts.push(`${n.symbol}新闻: ${headlines}`);
    }
  });
  
  // 情绪数据
  Object.values(results.sentiment).forEach(s => {
    if (s.success) {
      parts.push(`${s.symbol}情绪: ${s.sentiment.positive}%看多, ${s.sentiment.negative}%看空`);
    }
  });
  
  // SEC财报数据（新增）
  if (results.sec_filings) {
    Object.values(results.sec_filings).forEach(f => {
      if (f.success && f.filings.length > 0) {
        const latest = f.filings[0];
        parts.push(`${f.ticker}最新财报: ${latest.form} (${latest.reportDate})`);
      }
    });
  }
  
  // SEC财务数据（新增）
  if (results.sec_financials) {
    Object.values(results.sec_financials).forEach(f => {
      if (f.success && f.financials) {
        const { revenue, netIncome } = f.financials;
        const revenueStr = revenue ? `营收$${(revenue.value / 1e9).toFixed(2)}B` : '';
        const incomeStr = netIncome ? `净利润$${(netIncome.value / 1e9).toFixed(2)}B` : '';
        if (revenueStr || incomeStr) {
          parts.push(`${f.ticker}财务数据: ${[revenueStr, incomeStr].filter(Boolean).join(', ')} (${revenue?.period || netIncome?.period})`);
        }
      }
    });
  }
  
  return parts.join('\n');
}

// ========================================
// Intelligent Synthesis - 智能合成系统
// ========================================

// Synthesize Multi-AI Outputs - 智能合成多个AI的输出
async function synthesizeAIOutputs(aiResults, { mode, scene, chatType, symbols, text }) {
  console.log(`🔮 开始智能合成...`);
  
  // 提取成功的AI输出（6个AI）
  const validOutputs = [];
  if (aiResults.claude.success) validOutputs.push({ name: 'Claude (技术分析)', text: aiResults.claude.text });
  if (aiResults.deepseek.success) validOutputs.push({ name: 'DeepSeek (市场洞察)', text: aiResults.deepseek.text });
  if (aiResults.gpt4.success) validOutputs.push({ name: 'GPT-4 (综合策略)', text: aiResults.gpt4.text });
  if (aiResults.gemini.success) validOutputs.push({ name: 'Gemini (实时数据)', text: aiResults.gemini.text });
  if (aiResults.perplexity.success) validOutputs.push({ name: 'Perplexity (深度研究)', text: aiResults.perplexity.text });
  if (aiResults.mistral.success) validOutputs.push({ name: 'Mistral (情绪风险)', text: aiResults.mistral.text });
  
  if (validOutputs.length === 0) {
    return {
      success: false,
      text: '抱歉，暂时无法获取分析结果，请稍后重试。'
    };
  }
  
  // 如果只有一个AI成功，直接返回
  if (validOutputs.length === 1) {
    return {
      success: true,
      text: formatSingleOutput(validOutputs[0], chatType, scene)
    };
  }
  
  // 多个AI成功：调用 GPT-4 进行智能合成
  const synthesisPrompt = buildSynthesisPrompt(validOutputs, { mode, scene, chatType, symbols, text });
  
  const synthesisResult = await callGPT4(synthesisPrompt, scene.targetLength);
  
  if (!synthesisResult.success) {
    // 合成失败，返回简单拼接
    return {
      success: true,
      text: formatMultipleOutputs(validOutputs, chatType, scene),
      fallback: true
    };
  }
  
  console.log(`✨ 合成完成`);
  
  return {
    success: true,
    text: synthesisResult.text,
    synthesized: true
  };
}

// Build Synthesis Prompt - 合成指令
function buildSynthesisPrompt(aiOutputs, { mode, scene, chatType, symbols, text }) {
  const styleGuide = chatType === 'private' 
    ? `写作风格：
- 像老师给学生讲解，用"你看"、"我注意到"等口语
- 用生活化类比解释复杂概念（如"就像菜市场抢菜，价格虚高"）
- 温和但坚定，鼓励性话语
- 适度emoji（📊💡⚠️✅等）`
    : `写作风格：
- 专业团队口吻，用"老师团队认为"、"我们认为"
- 结构化输出：标题 + 数据 + 点评 + 展望
- 正式但不僵硬
- 明确的观点和建议`;
  
  const outputsSummary = aiOutputs.map(o => `【${o.name}】\n${o.text}`).join('\n\n');
  
  return `你是USIS智能合成系统，负责整合多位专家的分析，生成连贯、专业的最终报告。

场景：${scene.name}
股票：${symbols.join(', ') || '无特定股票'}
用户请求：${text}

${styleGuide}

以下是三位专家的独立分析：

${outputsSummary}

请基于以上分析，生成一份${scene.targetLength}字左右的最终报告，要求：

1. **不是简单拼接**：提炼关键观点，识别共识和分歧
2. **连贯叙述**：像一个人在说话，不要分段罗列
3. **突出重点**：
   - ${scene.depth === 'brief' ? '快速扫描关键信息' : scene.depth === 'medium' ? '中等深度分析' : '深度剖析趋势和策略'}
   - 明确的判断（BUY/HOLD/SELL）
   - 2-3个核心理由
4. **风格一致**：${chatType === 'private' ? '口语化、有温度' : '专业、结构化'}

不要：
- 不要说"根据以上分析"、"综合来看"等套话
- 不要免责声明
- 不要机械重复专家观点

直接输出最终报告：`;
}

// Format Single Output - 单个AI输出格式化
function formatSingleOutput(output, chatType, scene) {
  if (chatType === 'private') {
    return `${output.text}\n\n💡 以上分析来自 ${output.name}`;
  } else {
    return `【${scene.name}】\n\n${output.text}\n\n━━━━━━━━━━━━━━━\n📊 ${output.name}`;
  }
}

// Format Multiple Outputs - 多个AI输出简单格式化（兜底方案）
function formatMultipleOutputs(outputs, chatType, scene) {
  if (chatType === 'private') {
    const sections = outputs.map(o => `${o.text}`).join('\n\n━━━\n\n');
    return `${sections}\n\n💡 综合了 ${outputs.length} 位专家的观点`;
  } else {
    const sections = outputs.map(o => `【${o.name}】\n${o.text}`).join('\n\n');
    return `【${scene.name}】\n\n${sections}`;
  }
}

// 🆕 请求状态跟踪器（带TTL和LRU清理）
const requestTracker = new Map();
const REQUEST_TTL_MS = 300000; // 5分钟TTL
const MAX_TRACKER_SIZE = 1000; // 最多保留1000个请求

// 定期清理过期请求（每分钟）
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [reqId, req] of requestTracker.entries()) {
    // 清理超过TTL的请求
    if (now - req.startTime > REQUEST_TTL_MS) {
      requestTracker.delete(reqId);
      cleanedCount++;
    }
  }
  
  // LRU清理：如果超过最大数量，删除最老的
  if (requestTracker.size > MAX_TRACKER_SIZE) {
    const entries = Array.from(requestTracker.entries());
    entries.sort((a, b) => a[1].startTime - b[1].startTime);
    const toDelete = entries.slice(0, requestTracker.size - MAX_TRACKER_SIZE);
    toDelete.forEach(([reqId]) => requestTracker.delete(reqId));
    cleanedCount += toDelete.length;
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 requestTracker清理: 删除${cleanedCount}个过期请求, 剩余${requestTracker.size}个`);
  }
}, 60000); // 每分钟执行一次

// ========================================
// 🧠 核心Orchestrator函数（v1.1重构）
// ========================================

/**
 * 🆕 v1.1.1: Orchestrator包装函数（供Telegram Bot等直接调用）
 * 移除HTTP自调用，直接调用核心逻辑
 * @param {Object} params - 分析参数
 * @returns {Promise<Object>} 分析结果
 */
async function invokeOrchestrator(params) {
  const started = Date.now();
  const reqId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  
  // 提取参数
  const {
    text = "default",
    user_id = "system",
    chat_type = "private",
    mode = "auto",
    budget = "low",
    symbols = [],
    lang = "zh"
  } = params;
  
  // 注册请求状态（与HTTP端点保持一致）
  requestTracker.set(reqId, {
    startTime: started,
    status: 'processing',
    stage: 'init',
    user_id,
    text: String(text).slice(0, 50)
  });
  
  try {
    // 调用核心逻辑
    const result = await runOrchestratorCore({
      reqId,
      text,
      user_id,
      chat_type,
      mode,
      budget,
      symbols,
      lang,
      userHistory: null
    });
    
    // 更新tracker状态
    if (requestTracker.has(reqId)) {
      requestTracker.set(reqId, {
        ...requestTracker.get(reqId),
        status: 'completed',
        duration: Date.now() - started
      });
    }
    
    return result;
  } catch (error) {
    // 更新tracker状态
    if (requestTracker.has(reqId)) {
      requestTracker.set(reqId, {
        ...requestTracker.get(reqId),
        status: 'error',
        error: error.message
      });
    }
    throw error;
  } finally {
    // 请求完成后清理tracker（延迟5分钟，与TTL保持一致）
    setTimeout(() => requestTracker.delete(reqId), REQUEST_TTL_MS);
  }
}

/**
 * 核心分析引擎 - 可被HTTP端点和Telegram Bot直接调用
 * @param {Object} params - 分析参数
 * @returns {Promise<Object>} 分析结果
 */
async function runOrchestratorCore(params) {
  const startTime = Date.now();
  const {
    reqId,
    text = "default",
    chat_type = "private",
    mode = null,
    symbols: providedSymbols = [],
    user_id = "system",
    lang = "zh",
    budget = "low",
    userHistory: inputUserHistory = null
  } = params;
  
  // 🆕 v4.2: 初始化debug容器（确保data_errors永远可用）
  const debugInfo = {
    data_errors: []
  };
  
  // 记录原始入参
  console.log('[orchestratorCore] inbound', { reqId, text, chat_type, user_id, mode, budget });
  
  // 🔧 安全初始化 userHistory（防止 ReferenceError）
  let userHistory = inputUserHistory || [];
  if (!Array.isArray(userHistory)) {
    userHistory = [];
    console.log(`⚠️  userHistory 格式无效，已重置为空数组`);
  }
  
  console.log(`\n🧠 [${reqId}] Orchestrator 收到请求:`);
  console.log(`   文本: "${text}"`);
  console.log(`   场景: ${chat_type}`);
  console.log(`   模式: ${mode || '自动检测'}`);
  console.log(`   预算: ${budget || '未指定（使用默认）'}`);
  
  // 🆕 v3.1: 智能意图理解（AI驱动，非关键词匹配）
  let semanticIntent = null;
  let symbols = [];
  
  try {
    // 读取用户历史（用于上下文理解）
    if (user_id && ENABLE_DB) {
      try {
        const historyResult = await getPool().query(
          'SELECT request_text, mode, symbols, response_text, timestamp FROM user_memory WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 3',
          [user_id]
        );
        userHistory = historyResult.rows;
      } catch (error) {
        console.error(`❌ 读取用户历史失败:`, error.message);
      }
    }
    
    // Step 1: AI理解用户意图（带5秒超时保护）
    semanticIntent = await Promise.race([
      parseUserIntent(text, userHistory),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Intent parsing timeout after 5s')), 5000))
    ]);
    
    // Step 2: 智能解析股票代码（带3秒超时保护）
    const resolvedSymbols = await Promise.race([
      resolveSymbols(semanticIntent),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Symbol resolution timeout after 3s')), 3000))
    ]);
    symbols = providedSymbols.length > 0 ? providedSymbols : resolvedSymbols;
    
    console.log(`🎯 意图识别: ${semanticIntent.intentType} → ${semanticIntent.mode} (置信度: ${semanticIntent.confidence.toFixed(2)})`);
    console.log(`   股票: ${symbols.join(', ') || '无'}`);
    
  } catch (error) {
    console.error(`⚠️  智能意图理解失败（${error.message}），使用降级逻辑`);
    
    // 降级：使用旧的extractSymbols和understandIntent
    const extractedSymbols = extractSymbols(text);
    // 🧠 智能验证和修正符号
    const validatedSymbols = await validateAndFixSymbols(extractedSymbols);
    symbols = providedSymbols.length > 0 ? providedSymbols : validatedSymbols;
    semanticIntent = null;
  }
  
  // 2. Intent Understanding (兼容旧系统)
  const intent = semanticIntent || understandIntent(text, mode, symbols);
  console.log(`🎯 意图模式: ${intent.mode} (置信度: ${intent.confidence})`);
  
  // 2.5. 检测到的Action指令
  if (intent.actions && intent.actions.length > 0) {
    console.log(`🎬 检测到动作指令: ${intent.actions.map(a => a.type).join(', ')}`);
  }
  
  // 2.6. 读取用户偏好
  let userPrefs = {};
  if (user_id) {
    userPrefs = Memory.userPrefs[user_id] || {};
  }
  
  // 3. Scene Awareness
  const scene = analyzeScene(intent.mode, symbols);
  
  // 应用用户偏好调整场景
  if (userPrefs.preferred_depth) {
    const depthMultipliers = { brief: 0.7, medium: 1.0, deep: 1.3 };
    scene.targetLength = Math.round(scene.targetLength * (depthMultipliers[userPrefs.preferred_depth] || 1.0));
  }
  
  if (userPrefs.preferred_tone) {
    scene.userTone = userPrefs.preferred_tone;
  }
  
  console.log(`📋 场景分析: ${scene.name} | 目标长度: ${scene.targetLength}字 | 深度: ${scene.depth}`);
  
  // 4. Planning
  const tasks = planTasks(intent, scene, symbols);
  console.log(`📝 任务规划: ${tasks.join(' → ')}`);
  
  // 5. 特殊处理：Meta问题（关于AI本身）
  if (intent.mode === 'meta') {
    console.log(`🤖 检测到Meta问题（关于AI能力），直接回复`);
    
    const metaText = `你好！我是USIS Brain v6.0，一个机构级数据驱动投资分析系统。

🧠 **我的核心能力：**
1. **实时市场分析** - 盘前、盘中、盘后全天候分析
2. **个股诊断** - 技术面 + 基本面 + 情绪面综合解读
3. **6模型协同** - Claude、GPT-4、Gemini等6个AI专家团队分析
4. **可视化热力图** - 支持40+全球指数（美股、欧洲、亚洲等）
5. **新闻追踪** - 实时抓取市场动态和公司新闻
6. **记忆学习** - 记住你的历史对话和偏好，提供个性化分析

💡 **使用示例：**
- "盘前NVDA" - 查看NVDA盘前分析
- "特斯拉热力图" - 查看特斯拉所在板块热力图
- "西班牙IBEX35热力图" - 查看西班牙市场
- "新闻资讯" - 获取最新市场动态

有什么市场问题可以随时问我！📈`;
    
    return {
      status: "ok",
      ok: true,
      final_analysis: metaText,
      final_text: metaText,
      symbols: [],
      response_time_ms: Date.now() - startTime
    };
  }
  
  // 6. Data Fetching
  let marketData = { quotes: {}, news: [], metadata: { dataQuality: { overallScore: 0 } } };
  if (symbols.length > 0 && tasks.includes('fetch_data')) {
    try {
      marketData = await fetchMarketData(symbols, ['quote', 'profile', 'metrics', 'news']);
      
      // 数据质量评估
      const qualityScore = marketData.metadata.dataQuality.overallScore || 0;
      console.log(`✅ 数据采集成功 (质量: ${(qualityScore * 100).toFixed(0)}%)`);
      
      if (qualityScore < 0.5) {
        console.warn(`⚠️  数据质量较低 (${(qualityScore * 100).toFixed(0)}%)，可能影响分析准确性`);
        debugInfo.data_errors.push(`数据质量: ${(qualityScore * 100).toFixed(0)}%`);
      }
    } catch (error) {
      console.error(`❌ 数据采集失败:`, error.message);
      debugInfo.data_errors.push(error.message);
    }
  }
  
  // 7. AI Analysis
  try {
    // 调用GPT-5单核引擎（使用HTTP端点相同的参数格式）
    console.log(`🧠 [v4.0] 使用GPT-5单核引擎生成分析...`);
    const gpt5Result = await generateWithGPT5({
      text,
      marketData,
      semanticIntent: semanticIntent,
      mode: intent.mode,
      scene,
      symbols,
      rankedNews: marketData.news || []
    });
    
    // 包装为v3.1格式
    const synthesis = wrapAsV31Synthesis(gpt5Result);
    
    const responseTime = Date.now() - startTime;
    
    console.log(`✅ [v4.0] GPT-5生成完成 (成本: $${gpt5Result.cost_usd?.toFixed(4) || '0.00'})`);
    
    // 记录统计（如果recordRequest函数存在）
    if (typeof recordRequest === 'function') {
      recordRequest(
        gpt5Result.success,
        responseTime,
        gpt5Result.debug?.model_used || gpt5Result.model,
        gpt5Result.debug?.fallback_used || false,
        { 
          hits: marketData?.metadata?.cache_hits || 0,
          total: marketData?.metadata?.cache_total || 0
        }
      );
    }
    
    // 🔧 返回Telegram Bot兼容的格式（包含final_text和final_analysis）
    return {
      status: "ok",
      ok: true,
      final_text: synthesis.text,
      final_analysis: synthesis.text,
      summary: synthesis.text,
      caption: synthesis.text,
      symbols: symbols,
      model: gpt5Result.model,
      response_time_ms: responseTime,
      ai_results: {
        model: gpt5Result.model,
        success: gpt5Result.success,
        cost_usd: gpt5Result.cost_usd,
        elapsed_ms: responseTime
      },
      synthesis: {
        success: synthesis.success,
        synthesized: synthesis.synthesized
      },
      intent: {
        mode: intent.mode,
        lang: lang,
        confidence: intent.confidence
      },
      scene: {
        name: scene.name,
        depth: scene.depth,
        targetLength: scene.targetLength
      },
      debug: gpt5Result.debug
    };
    
  } catch (error) {
    console.error('[orchestratorCore] error', error);
    
    return {
      status: 'error',
      ok: false,
      error: String(error && error.message || error),
      final_text: '⚠️ 系统临时故障，稍后再试',
      final_analysis: '⚠️ 系统临时故障，稍后再试',
      actions: [],
      symbols: [],
      response_time_ms: Date.now() - startTime
    };
  }
}

// Main Orchestrator Endpoint
app.post("/brain/orchestrate", async (req, res) => {
  const started = Date.now();
  const reqId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  
  // 🆕 注册请求状态（防御性text检查）
  const textInput = req.body?.text || "default";
  requestTracker.set(reqId, {
    startTime: started,
    status: 'processing',
    stage: 'init',
    user_id: req.body?.user_id || 'unknown',
    text: String(textInput).slice(0, 50)
  });
  
  // 🆕 确保请求完成时清理tracker（防止内存泄漏）
  const cleanupTracker = () => {
    requestTracker.delete(reqId);
  };
  
  res.on('finish', cleanupTracker);
  res.on('close', cleanupTracker);
  
  // 🆕 设置60秒超时（从15秒增加到60秒）
  req.setTimeout(60000, () => {
    console.error(`⏱️  [${reqId}] 请求超时（60秒）- 可能AI响应过慢`);
    
    // 更新tracker状态
    if (requestTracker.has(reqId)) {
      requestTracker.set(reqId, {
        ...requestTracker.get(reqId),
        status: 'timeout',
        stage: 'timeout'
      });
    }
    
    if (!res.headersSent) {
      res.status(504).json({
        status: "error",
        ok: false,
        final_analysis: "⚠️ 分析超时，请稍后重试或使用更简单的查询。",
        error: "Request timeout after 60 seconds"
      });
    }
  });
  
  try {
    const startTime = Date.now();
    
    // 🆕 v4.2: 初始化debug容器（确保data_errors永远可用）
    const debugInfo = {
      data_errors: []
    };
    
    // 1. 解析输入（带默认值兜底）
    const {
      text = "default",
      chat_type = "private",  // private | group
      mode = null,            // premarket | intraday | postmarket | diagnose | news
      symbols: providedSymbols = [],  // 股票代码（如果提供）
      user_id = "system",
      lang = "zh",
      budget = "low",          // 🆕 预算控制：low | medium | high | unlimited（N8N传入或环境变量）
      userHistory: inputUserHistory = null  // 🔧 从n8n传入的用户历史（可选）
    } = req.body || {};
    
    // 🆕 更新请求状态
    if (requestTracker.has(reqId)) {
      requestTracker.set(reqId, {
        ...requestTracker.get(reqId),
        stage: 'parsing'
      });
    }
    
    // 记录原始入参，帮助定位
    console.log('[orchestrate] inbound', { reqId, text, chat_type, user_id, mode, budget });
    
    // 🔧 安全初始化 userHistory（防止 ReferenceError）
    let userHistory = inputUserHistory || [];
    if (!Array.isArray(userHistory)) {
      userHistory = [];
      console.log(`⚠️  userHistory 格式无效，已重置为空数组`);
    }
    
    // 1.5. reqId已在函数开头生成（行3514），此处无需重复定义
    
    console.log(`\n🧠 [${reqId}] Orchestrator 收到请求:`);
    console.log(`   文本: "${text}"`);
    console.log(`   场景: ${chat_type}`);
    console.log(`   模式: ${mode || '自动检测'}`);
    console.log(`   预算: ${budget || '未指定（使用默认）'}`);
    
    // 🆕 v3.1: 智能意图理解（AI驱动，非关键词匹配）
    let semanticIntent = null;
    let symbols = [];
    
    try {
      // 读取用户历史（用于上下文理解）
      if (user_id && ENABLE_DB) {
        try {
          const historyResult = await getPool().query(
            'SELECT request_text, mode, symbols, response_text, timestamp FROM user_memory WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 3',
            [user_id]
          );
          userHistory = historyResult.rows;
        } catch (error) {
          console.error(`❌ 读取用户历史失败:`, error.message);
        }
      }
      
      // Step 1: AI理解用户意图（带5秒超时保护）
      semanticIntent = await Promise.race([
        parseUserIntent(text, userHistory),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Intent parsing timeout after 5s')), 5000))
      ]);
      
      // Step 2: 智能解析股票代码（带3秒超时保护）
      const resolvedSymbols = await Promise.race([
        resolveSymbols(semanticIntent),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Symbol resolution timeout after 3s')), 3000))
      ]);
      symbols = providedSymbols.length > 0 ? providedSymbols : resolvedSymbols;
      
      console.log(`🎯 意图识别: ${semanticIntent.intentType} → ${semanticIntent.mode} (置信度: ${semanticIntent.confidence.toFixed(2)})`);
      console.log(`   股票: ${symbols.join(', ') || '无'}`);
      
    } catch (error) {
      console.error(`⚠️  智能意图理解失败（${error.message}），使用降级逻辑`);
      
      // 降级：使用旧的extractSymbols和understandIntent
      const extractedSymbols = extractSymbols(text);
      // 🧠 智能验证和修正符号
      const validatedSymbols = await validateAndFixSymbols(extractedSymbols);
      symbols = providedSymbols.length > 0 ? providedSymbols : validatedSymbols;
      semanticIntent = null;
    }
    
    // 2. Intent Understanding (兼容旧系统)
    const intent = semanticIntent || understandIntent(text, mode, symbols);
    console.log(`🎯 意图模式: ${intent.mode} (置信度: ${intent.confidence})`);
    
    // 2.6. 检测到的Action指令
    if (intent.actions && intent.actions.length > 0) {
      console.log(`🎬 检测到动作指令: ${intent.actions.map(a => a.type).join(', ')}`);
      intent.actions.forEach(action => {
        console.log(`   → ${action.tool}: ${action.reason}`);
      });
    }
    
    // 2.5. 读取用户偏好（用户历史已在意图理解时读取）
    let userPrefs = {};
    if (user_id) {
      userPrefs = Memory.userPrefs[user_id] || {};
      console.log(`💾 用户偏好:`, Object.keys(userPrefs).length ? userPrefs : '无');
    }
    
    // 3. Scene Awareness (考虑置信度和用户偏好)
    const scene = analyzeScene(intent.mode, symbols);
    
    // 应用用户偏好调整场景
    if (userPrefs.preferred_depth) {
      const depthMultipliers = { brief: 0.7, medium: 1.0, deep: 1.3 };
      scene.targetLength = Math.round(scene.targetLength * (depthMultipliers[userPrefs.preferred_depth] || 1.0));
      console.log(`💾 应用用户偏好深度: ${userPrefs.preferred_depth}`);
    }
    
    if (userPrefs.preferred_tone) {
      scene.userTone = userPrefs.preferred_tone; // casual | professional
      console.log(`💾 应用用户偏好语气: ${userPrefs.preferred_tone}`);
    }
    
    // 如果置信度低，添加警告
    if (intent.confidence < 0.7) {
      scene.lowConfidence = true;
      console.log(`⚠️  低置信度检测，可能需要用户确认`);
    }
    
    console.log(`📋 场景分析: ${scene.name} | 目标长度: ${scene.targetLength}字 | 深度: ${scene.depth}`);
    
    // 🚀 三级Orchestrator: L1 复杂度评分
    const complexity = calculateComplexityScore(text, intent.mode, symbols, userHistory);
    console.log(`\n[L1][${reqId}] 复杂度评分:`);
    console.log(`   分数: ${complexity.score}/10`);
    console.log(`   层级: ${complexity.tier}`);
    console.log(`   推理: ${complexity.reasoning}`);
    
    // 🚀 三级Orchestrator: L2 智能模型选择
    // 优先级：req.body.budget > 环境变量 > 默认值(medium)
    const finalBudget = budget || process.env.AI_BUDGET || 'medium';
    const modelSelection = selectOptimalModels(complexity, intent.mode, symbols, finalBudget);
    console.log(`\n[L2][${reqId}] 模型选择:`);
    console.log(`   预算模式: ${finalBudget}`);
    console.log(`   选中模型: ${modelSelection.models.map(m => m.name).join(', ')}`);
    console.log(`   预估成本: $${modelSelection.estimatedCost.toFixed(4)}`);
    console.log(`   预算上限: $${modelSelection.budgetConfig}`);
    
    // 🚀 三级Orchestrator: L3 深度推理检测
    const enableDeepReasoning = complexity.tier === 'L3';
    if (enableDeepReasoning) {
      const deepModels = modelSelection.models.filter(m => m.name === 'o1' || m.name === 'claude-opus');
      console.log(`\n[L3][${reqId}] 深度推理已启用:`);
      console.log(`   触发原因: ${complexity.reasoning}`);
      console.log(`   深度模型: ${deepModels.map(m => m.name).join(', ') || '无（预算限制）'}`);
      console.log(`   推理路径: ${deepModels.length > 0 ? 'o1/Claude Opus' : '标准6-AI（预算不足启用L3）'}`);
    }
    
    // 4. Planning
    const tasks = planTasks(intent, scene, symbols);
    console.log(`📝 任务规划: ${tasks.join(' → ')}`);
    
    // 🎯 特殊处理1：Meta问题（关于AI本身）
    if (intent.mode === 'meta') {
      console.log(`🤖 检测到Meta问题（关于AI能力），直接回复`);
      
      const metaText = `你好！我是USIS Brain v5.0，一个机构级数据驱动投资分析系统。

🧠 **我的核心能力：**
1. **实时市场分析** - 盘前、盘中、盘后全天候分析
2. **个股诊断** - 技术面 + 基本面 + 情绪面综合解读
3. **6模型协同** - Claude、GPT-4、Gemini等6个AI专家团队分析
4. **可视化热力图** - 支持40+全球指数（美股、欧洲、亚洲等）
5. **新闻追踪** - 实时抓取市场动态和公司新闻
6. **记忆学习** - 记住你的历史对话和偏好，提供个性化分析

💡 **使用示例：**
- "盘前NVDA" - 查看NVDA盘前分析
- "特斯拉热力图" - 查看特斯拉所在板块热力图
- "西班牙IBEX35热力图" - 查看西班牙市场
- "新闻资讯" - 获取最新市场动态

💾 **关于学习：**
我会记住你最近的对话历史（最近3条），根据你的偏好和习惯调整分析风格。
想清空记忆？说"清空记忆"即可重新开始！

有什么市场问题可以随时问我！📈`;
      
      return res.json({
        status: "ok",
        ok: true,
        final_analysis: metaText,
        final_text: metaText,
        needs_heatmap: false,
        actions: [],
        intent: { mode: 'meta', lang: intent.lang, confidence: 1.0 },
        scene: { name: 'Meta', depth: 'simple', targetLength: 200 },
        symbols: [],
        market_data: null,
        ai_results: null,
        synthesis: { success: true, synthesized: false },
        low_confidence: false,
        chat_type,
        user_id,
        response_time_ms: Date.now() - startTime,
        debug: { note: 'Meta question - direct response' }
      });
    }
    
    // 🎯 特殊处理2：纯新闻请求（无需AI分析）
    if (intent.mode === 'news' && symbols.length === 0 && !/(分析|解读|点评)/.test(text)) {
      console.log(`📰 检测到纯新闻请求，直接返回新闻列表`);
      
      const newsPrompt = intent.actions && intent.actions.length > 0
        ? `用户需要：${intent.actions.map(a => a.reason).join('、')}`
        : '市场最新动态';
      
      const newsText = `📰 新闻资讯\n\n${newsPrompt}\n\n💡 提示：请说"分析XX新闻"或提供股票代码，我可以为您深度解读市场动态。`;
      
      return res.json({
        status: "ok",
        ok: true,
        final_analysis: newsText,
        final_text: newsText,
        needs_heatmap: false,
        actions: [
          {
            type: 'fetch_news',
            tool: 'RSS_News',
            reason: '用户需要新闻资讯'
          }
        ],
        intent: { mode: 'news', lang: intent.lang, confidence: intent.confidence },
        scene: { name: scene.name, depth: 'simple', targetLength: 100 },
        symbols: [],
        market_data: null,
        ai_results: null,
        synthesis: { success: true, synthesized: false },
        low_confidence: false,
        chat_type,
        user_id,
        response_time_ms: Date.now() - startTime,
        debug: { note: 'Pure news request - skipped AI analysis' }
      });
    }
    
    // 🎯 特殊处理3：闲聊模式检测（用简短AI回复，不调用6模型）
    const marketKeywords = ['分析', '走势', '图', 'K线', '趋势', '价格', '股票', '行情', '盘前', '盘中', '盘后', '热力图', '涨', '跌', '买', '卖', '买点', '卖点', '止损', '止盈', '复盘', '板块', 'chart', 'stock', 'market'];
    const hasMarketKeywords = marketKeywords.some(k => text.toLowerCase().includes(k));
    const isMarketMode = ['premarket', 'intraday', 'postmarket', 'diagnose', 'news', 'heatmap'].includes(intent.mode);
    const isCasualChat = !hasMarketKeywords && !isMarketMode && symbols.length === 0;
    
    if (isCasualChat) {
      console.log(`💬 检测到闲聊模式`);
      
      // 🔹 简单问候语：直接返回预设回复，不调用AI
      const simpleGreetings = /^(你好|hi|hello|嗨|hey|您好|早上好|晚上好|中午好|在吗|在不在)[\s!！?？。.]*$/i;
      if (simpleGreetings.test(text.trim())) {
        console.log(`👋 检测到简单问候，直接返回预设回复`);
        return res.json({
          status: "ok",
          ok: true,
          final_analysis: '你好！我是USIS Brain，可以帮你分析股票、查看市场热力图。试试发送"AAPL"或"美股热力图"吧！📈',
          final_text: '你好！我是USIS Brain，可以帮你分析股票、查看市场热力图。试试发送"AAPL"或"美股热力图"吧！📈',
          needs_heatmap: false,
          actions: [],
          intent: { mode: 'casual', lang: intent.lang, confidence: 1.0 },
          scene: { name: 'Greeting', depth: 'simple', targetLength: 30 },
          symbols: [],
          market_data: null,
          ai_results: null,
          synthesis: { success: true, synthesized: false },
          low_confidence: false,
          chat_type,
          user_id,
          response_time_ms: Date.now() - startTime,
          debug: { note: 'Simple greeting - preset response' }
        });
      }
      
      // 🔹 复杂闲聊：调用GPT-4简短回复
      const casualPrompt = `你是USIS Brain市场分析助手。用户正在闲聊，请用1句话简短友好回复（不超过30字）。

用户说：${text}

简短回复：`;
      
      try {
        const gptResult = await callGPT4(casualPrompt, 60); // 最多60 tokens，约120字
        
        let chatText = gptResult.success ? gptResult.text : '你好！我是市场分析助手，可以帮你分析股票、查看热力图等。有什么想了解的吗？';
        
        // 限制长度：最多240字符（约120汉字）
        if (chatText.length > 240) {
          chatText = chatText.slice(0, 240) + '...';
        }
        
        return res.json({
          status: "ok",
          ok: true,
          final_analysis: chatText,
          final_text: chatText,
          needs_heatmap: false,
          actions: [],
          intent: { mode: 'casual', lang: intent.lang, confidence: 0.9 },
          scene: { name: 'Casual', depth: 'simple', targetLength: 50 },
          symbols: [],
          market_data: null,
          ai_results: { gpt4: gptResult },
          synthesis: { success: true, synthesized: false },
          low_confidence: false,
          chat_type,
          user_id,
          response_time_ms: Date.now() - startTime,
          debug: { note: 'Casual chat - used lightweight GPT-4 response' }
        });
      } catch (error) {
        console.error('❌ 闲聊模式GPT-4调用失败:', error.message);
        // 降级到预设回复
        return res.json({
          status: "ok",
          ok: true,
          final_analysis: '你好！我是市场分析助手，可以帮你分析股票、查看热力图等。有什么想了解的吗？',
          final_text: '你好！我是市场分析助手，可以帮你分析股票、查看热力图等。有什么想了解的吗？',
          needs_heatmap: false,
          actions: [],
          intent: { mode: 'casual', lang: intent.lang, confidence: 0.9 },
          scene: { name: 'Casual', depth: 'simple', targetLength: 50 },
          symbols: [],
          market_data: null,
          ai_results: null,
          synthesis: { success: true, synthesized: false },
          low_confidence: false,
          chat_type,
          user_id,
          response_time_ms: Date.now() - startTime,
          debug: { note: 'Casual chat - fallback to preset response' }
        });
      }
    }
    
    // 4.5. 🆕 v3.1: 智能数据采集（使用DataBroker）
    let marketData = null;
    if (symbols.length > 0) {
      console.log(`📊 开始采集市场数据: ${symbols.join(', ')}`);
      
      try {
        // 使用新的DataBroker获取数据（带来源追踪和新鲜度评分）
        const dataTypes = ['quote'];
        if (intent.mode === 'news') dataTypes.push('news');
        
        marketData = await fetchMarketData(symbols, dataTypes);
        
        // 🆕 v4.2: 行情=软依赖，失败不阻断分析
        const validation = validateDataForAnalysis(marketData);
        
        if (!validation.valid) {
          console.warn(`⚠️  数据验证失败（继续分析）: ${validation.reason}`);
          debugInfo.data_errors.push({
            source: 'market_data',
            reason: validation.reason,
            symbols: symbols,
            timestamp: new Date().toISOString()
          });
          
          // 🔧 不再阻断，继续分析（允许"仅分析"模式）
          // 旧代码会return error，现在继续执行
        }
        
        // 打印数据质量信息
        console.log(`✅ 数据采集成功 (质量: ${(marketData.metadata.dataQuality.overallScore * 100).toFixed(0)}%)`);
        console.log(marketData.summary);
        
      } catch (error) {
        console.error(`❌ DataBroker失败，尝试降级到旧系统:`, error.message);
        
        // 降级：使用旧的collectMarketData
        marketData = await collectMarketData(symbols, {
          mode: intent.mode,
          text: text
        });
        
        // 旧系统验证
        if (!marketData || !marketData.collected || !marketData.summary) {
          console.error(`❌ 降级系统也失败，中止分析`);
          return res.json({
            status: "error",
            ok: false,
            final_analysis: `⚠️ 抱歉，无法获取${symbols.join('、')}的实时行情数据。请稍后重试。`,
            final_text: `⚠️ 数据采集失败`,
            needs_heatmap: false,
            actions: [],
            intent: { mode: intent.mode, lang: intent.lang, confidence: 0 },
            scene: { name: 'Error', depth: 'simple', targetLength: 0 },
            symbols,
            market_data: { error: '数据采集失败（新旧系统均失败）' },
            ai_results: null,
            synthesis: { success: false, synthesized: false },
            low_confidence: true,
            chat_type,
            user_id,
            response_time_ms: Date.now() - startTime
          });
        }
      }
    } else {
      console.log(`ℹ️  无股票代码，跳过市场数据采集`);
    }
    
    // 4.6. 宏观数据采集（FRED）
    const needMacro = (intent.mode === 'premarket') || /宏观|CPI|失业|GDP|利率|FRED|经济/i.test(text || '');
    let macroData = null;
    if (needMacro) {
      try {
        macroData = await collectMacroData({ needMacro: true });
        if (macroData) {
          tasks.push('fetch_macro_fred');
        }
      } catch (error) {
        console.error('❌ FRED宏观数据采集失败:', error.message);
        macroData = { error: error.message };
      }
    }
    
    // 4.7. 🆕 新闻采集（ImpactRank评分系统）
    let rankedNews = [];
    const needNews = intent.responseMode === 'news' || intent.responseMode === 'full_report' || 
                     intent.actions.some(a => a === 'fetch_news' || (typeof a === 'object' && a.type === 'fetch_news')) ||
                     /新闻|资讯|news|热点/.test(text || '');
    
    if (needNews) {
      try {
        console.log(`📰 启动新闻采集（ImpactRank）`);
        
        // 解析时间窗口
        const timeWindowMap = {
          '2h': 120,
          '24h': 1440,
          '7d': 10080
        };
        const timeWindowMinutes = timeWindowMap[intent.timeHorizon] || 120;
        
        const newsOptions = {
          symbols: symbols,
          region: intent.exchange || 'US',
          timeWindowMinutes: timeWindowMinutes,
          topN: 5,
          sectors: intent.sector ? [intent.sector] : []
        };
        
        rankedNews = await fetchAndRankNews(newsOptions);
        
        console.log(`✅ 新闻采集完成: ${rankedNews.length}条`);
        if (rankedNews.length > 0) {
          tasks.push('fetch_news_impactrank');
        }
      } catch (error) {
        console.error('❌ 新闻采集失败:', error.message);
        rankedNews = [];
      }
    }
    
    // 4.8. 🆕 v5.0: 个股图表生成（K线分析）
    // 🎯 v6.0统一流程：所有包含"分析"关键词的单股请求必须生成图表+视觉AI+实时数据
    let stockChartData = null;
    
    // 🔍 强制分析检测：包含这些关键词的必须生成图表
    const analysisKeywords = /分析|解析|诊断|评估|研究|技术分析|chart|analyze|diagnose|evaluate|analysis/i;
    const hasAnalysisKeyword = analysisKeywords.test(text || '');
    
    // 🎯 触发条件优化：
    // 1. 有符号 + 非casual → 生成图表
    // 2. 无符号但有分析关键词 → 尝试从公司名解析符号
    const isCasualMention = intent.mode === 'casual' || intent.confidence < 0.5;
    let needStockChart = symbols.length === 1 && !isCasualMention;
    
    // 🆕 增强逻辑：如果是明确的分析请求但没找到符号，尝试从文本中识别公司名
    if (!needStockChart && hasAnalysisKeyword && !isCasualMention && symbols.length === 0) {
      console.log(`🔍 检测到分析关键词但无符号，尝试从文本识别公司名...`);
      // 公司名可能被extractSymbols遗漏，重新检查文本
      const retrySymbols = extractSymbols(text);
      // 🧠 智能验证和修正重试的符号
      const validatedRetrySymbols = await validateAndFixSymbols(retrySymbols);
      if (validatedRetrySymbols.length === 1) {
        symbols = validatedRetrySymbols;
        needStockChart = true;
        console.log(`✅ 从文本重新识别到符号: ${symbols[0]}`);
      }
    }
    
    if (needStockChart) {
      try {
        console.log(`📈 [v5.0] 启动个股图表分析: ${symbols[0]}`);
        
        const chartResult = await generateStockChart(symbols[0], {
          interval: intent.timeHorizon === '2h' ? '5' : 'D',
          requestId: reqId
        });
        
        if (chartResult.ok) {
          stockChartData = {
            buffer: chartResult.buffer,    // 🆕 实际截图buffer（用于Telegram发送）
            chartURL: chartResult.chartURL,
            stockData: chartResult.stockData,
            chartAnalysis: chartResult.chartAnalysis,
            provider: chartResult.provider,
            elapsed_ms: chartResult.elapsed_ms
          };
          
          console.log(`✅ 个股图表生成成功 (provider: ${chartResult.provider}, ${chartResult.elapsed_ms}ms)`);
          tasks.push('generate_stock_chart');
          
          // 🆕 v5.0: 数据驱动分析（获取多维度数据）
          if (chartResult.chartAnalysis) {
            try {
              console.log(`📊 [v5.0] 启动数据驱动分析: ${symbols[0]}`);
              
              // 🎯 优化：仅获取缺失的数据（profile + metrics），复用已有的quote和news
              // 🆕 v6.2: Twelve Data仅在截图失败时调用（降级路径），避免性能开销
              const { fetchCompanyProfile, fetchStockMetrics } = require('./dataBroker');
              
              const [profileResult, metricsResult] = await Promise.all([
                fetchCompanyProfile(symbols[0]).catch(() => ({ profile: null, source: null })),
                fetchStockMetrics(symbols[0]).catch(() => ({ metrics: null, source: null }))
              ]);
              
              // 构建数据包（复用marketData中的quote和news）
              // 注意：Twelve Data技术指标在截图失败时由fallback路径提供
              const dataPackage = {
                symbol: symbols[0],
                quote: marketData.quotes[symbols[0]] || chartResult.stockData,
                profile: profileResult.profile,
                metrics: metricsResult.metrics,
                news: marketData.news || [],
                // 🆕 v6.2: 如果chartResult来自Twelve Data fallback，传递其comprehensive数据
                technical_indicators: chartResult.comprehensiveData?.technical_indicators || null,
                fundamentals: chartResult.comprehensiveData?.fundamentals || null,
                analyst_ratings: chartResult.comprehensiveData?.analyst_ratings || null,
                metadata: {
                  timestamp: Date.now(),
                  completeness: {
                    hasQuote: !!(marketData.quotes[symbols[0]] || chartResult.stockData),
                    hasProfile: !!profileResult.profile,
                    hasMetrics: !!metricsResult.metrics,
                    hasNews: marketData.news && marketData.news.length > 0,
                    completenessScore: [
                      !!(marketData.quotes[symbols[0]] || chartResult.stockData),
                      !!profileResult.profile,
                      !!metricsResult.metrics,
                      marketData.news && marketData.news.length > 0
                    ].filter(Boolean).length / 4
                  }
                }
              };
              
              console.log(`📦 数据完整度: ${(dataPackage.metadata.completeness.completenessScore * 100).toFixed(0)}%`);
              
              // 调用新版数据驱动分析
              const { generateDataDrivenStockAnalysis } = require('./gpt5Brain');
              const analysisResult = await generateDataDrivenStockAnalysis(
                dataPackage,
                chartResult.chartAnalysis,
                { mode: intent.mode, scene: scene }
              );
              
              if (analysisResult.success) {
                stockChartData.comprehensiveAnalysis = analysisResult.text;
                stockChartData.dataCompleteness = dataPackage.metadata.completeness.completenessScore;
                console.log(`✅ [v5.0] 数据驱动分析完成 (${analysisResult.model}, 成本: $${analysisResult.cost_usd?.toFixed(4) || '0.00'})`);
              }
            } catch (err) {
              console.warn(`⚠️  数据驱动分析失败: ${err.message}`);
              console.warn(`   降级：使用Vision分析作为备选`);
              stockChartData.comprehensiveAnalysis = chartResult.chartAnalysis;
            }
          }
        } else {
          console.warn(`⚠️  个股图表生成失败: ${chartResult.error || 'unknown'}`);
        }
      } catch (error) {
        console.error('❌ 个股图表生成错误:', error.message);
      }
    }
    
    // 5. 🆕 v6.0: 智能多语言分析（根据输入语言自动路由模型）
    let gpt5Result;
    
    try {
      // 检测是否为中文输入或需要多语言处理
      const isChinese = /[\u4e00-\u9fa5]/.test(text);
      
      if (isChinese && symbols.length > 0) {
        console.log(`🇨🇳 [v6.0] 检测到中文输入，启动DeepSeek多语言分析`);
        
        const multiLangAnalyzer = new MultiLanguageAnalyzer();
        const analysisResult = await multiLangAnalyzer.smartAnalyze(
          text,
          marketData,
          { mode: intent.mode, scene: scene }
        );
        
        // 转换为v5.0兼容格式
        gpt5Result = {
          success: analysisResult.success,
          text: analysisResult.text,
          model: analysisResult.model,
          usage: analysisResult.usage,
          cost_usd: analysisResult.cost_usd,
          debug: {
            language: analysisResult.language,
            modelReason: analysisResult.modelReason,
            provider: analysisResult.provider
          }
        };
        
        console.log(`✅ [v6.0] 多语言分析完成 (${analysisResult.model}, 语言: ${analysisResult.language})`);
        
      } else {
        // 非中文或无股票代码 → 使用原有GPT-5引擎
        console.log(`🧠 [v4.0] 使用GPT-5单核引擎生成分析...`);
        gpt5Result = await generateWithGPT5({
          text,
          marketData,
          semanticIntent: semanticIntent,
          mode: intent.mode,
          scene,
          symbols,
          rankedNews: rankedNews  // 传递ImpactRank排序后的新闻
        });
      }
    } catch (multiLangError) {
      console.warn(`⚠️  [v6.0] 多语言分析失败，降级到GPT-5:`, multiLangError.message);
      
      // 降级到GPT-5引擎
      gpt5Result = await generateWithGPT5({
        text,
        marketData,
        semanticIntent: semanticIntent,
        mode: intent.mode,
        scene,
        symbols,
        rankedNews: rankedNews
      });
    }
    
    // 6. 兼容v3.1格式（保持后续逻辑不变）
    const synthesis = wrapAsV31Synthesis(gpt5Result);
    
    let responseText = synthesis.text;
    
    console.log(`✅ [v4.0] GPT-5生成完成 (成本: $${gpt5Result.cost_usd?.toFixed(4) || '0.00'})`);
    
    // 🆕 v3.1: 合规守卫 - 验证AI输出的数字是否存在于数据中
    if (marketData && marketData.metadata && symbols.length > 0) {
      try {
        const validation = validateResponse(responseText, marketData);
        
        if (!validation.valid) {
          console.warn(`⚠️  合规守卫检测到可疑数字！违规数量: ${validation.violations.length}`);
          validation.violations.forEach(v => console.warn(`   - ${v}`));
          
          // 如果置信度低于60%，要求AI重新生成或添加警告
          if (validation.confidence < 0.6) {
            console.error(`❌ 数据验证失败（置信度: ${(validation.confidence * 100).toFixed(0)}%），添加警告`);
            
            const warning = `\n\n⚠️ 系统提示：以上分析中的部分数字可能不准确，建议以实时数据为准。`;
            responseText = responseText + warning;
          } else {
            console.log(`✅ 合规守卫验证通过（置信度: ${(validation.confidence * 100).toFixed(0)}%）`);
          }
        } else {
          console.log(`✅ 合规守卫验证完全通过`);
        }
      } catch (error) {
        console.error(`⚠️  合规守卫执行失败:`, error.message);
      }
    }
    const imageUrl = null; // TODO: 后续添加图表生成
    
    // 7. Save to PostgreSQL Memory
    if (user_id && ENABLE_DB) {
      try {
        await getPool().query(
          'INSERT INTO user_memory (user_id, request_text, mode, symbols, response_text, chat_type) VALUES ($1, $2, $3, $4, $5, $6)',
          [user_id, text, intent.mode, symbols, responseText, chat_type]
        );
        console.log(`💾 保存用户记忆: user_id=${user_id}, mode=${intent.mode}`);
      } catch (error) {
        console.error(`❌ 保存用户记忆失败:`, error.message);
      }
    }
    
    // 同时保存到旧Memory系统（兼容性）
    Memory.save({
      user_id,
      intent: intent.mode,
      chat_type,
      symbols,
      success: synthesis.success,
      synthesized: synthesis.synthesized,
      ok: true
    });
    
    const responseTime = Date.now() - startTime;
    console.log(`✅ 响应完成 (${responseTime}ms)\n`);
    
    // --- L2: 智能可视化决策（最小版本）---
    const l1IntentForViz = { mode: intent.mode, lang: intent.lang };
    const visualIntent = detectVisualizationNeedSimple(l1IntentForViz, text);
    
    let chartUrls = [];
    if (visualIntent.needChart && visualIntent.style === 'single' && visualIntent.metrics?.length === 1) {
      const metric = visualIntent.metrics[0];
      console.log(`📊 生成单指标图表: ${metric}`);
      try {
        const url = await generateSmartChartSingle(macroData, metric);
        if (url) {
          chartUrls.push({ metric, url });
          console.log(`✅ 图表生成成功: ${url.slice(0, 60)}...`);
        }
      } catch (e) {
        console.error(`❌ 图表生成失败 (${metric}):`, e.message);
      }
    } else if (visualIntent.needChart) {
      console.log(`ℹ️ 可视化意图检测到但暂不支持: style=${visualIntent.style}`);
    } else {
      console.log(`ℹ️ 无需图表 (reason: ${visualIntent.reason})`);
    }
    
    // --- Response Mapper (v2): standardize orchestrator output ---
    // 注：reqId已在函数开始时定义

    // L1
    const l1_intent = intent;
    const l1_score = complexity.score;

    // L2
    let l2_plan = tasks;  // 任务分解（内部标识）
    
    // 将可视化计划写入L2 plan
    if (chartUrls.length > 0) {
      l2_plan.push('viz_single');
    }
    const userLang = intent.lang || 'zh';
    const l2_plan_friendly = mapPlanSteps(l2_plan, userLang);  // 友好文案
    const l2_models = modelSelection.models;
    const l2_budget = modelSelection.budgetConfig;

    // L3
    const l3_triggered = complexity.tier === 'L3';
    const l3_models = l3_triggered 
      ? modelSelection.models.filter(m => m.name === 'o1' || m.name === 'claude-opus').map(m => m.name)
      : [];
    const l3_reason = l3_triggered ? complexity.reasoning : null;

    // 🚀 三级Orchestrator: 成本追踪（同步，确保数据库有记录）
    try {
      await trackCost(
        reqId,
        user_id, 
        intent.mode, 
        modelSelection.models, 
        modelSelection.estimatedCost, 
        responseTime
      );
    } catch (err) {
      console.error('成本追踪失败:', err.message);
    }

    // Cost
    const estCost = modelSelection.estimatedCost;
    let totalCost = null;
    try {
      totalCost = await getTotalCostFromDB(reqId);
    } catch(_) {}

    // SEC 财报
    const sec_financials = marketData?.data?.sec_financials || null;

    // 🆕 使用responseFormatter根据responseMode格式化输出
    let finalSummary = responseText;
    let formattedNewsData = null;
    let analysisData = null;
    let adviceData = null;
    
    try {
      // 准备数据
      formattedNewsData = rankedNews.length > 0 ? formatNewsOutput(rankedNews) : [];
      
      // 从AI生成的文本中提取结构化内容
      const extractedContent = extractStructuredContent(responseText, intent.responseMode);
      
      analysisData = {
        summary: extractedContent.summary || responseText.substring(0, 200),
        scenarios: extractedContent.scenarios,
        technical: extractedContent.technical,
        fundamental: extractedContent.fundamental
      };
      
      adviceData = {
        positioning: extractedContent.positioning,
        risk_controls: extractedContent.risk_controls,
        watchlist: extractedContent.watchlist || symbols,
        triggers: extractedContent.triggers
      };
      
      // 根据responseMode格式化
      if (intent.responseMode && intent.responseMode !== 'full_report') {
        console.log(`📝 使用responseFormatter格式化输出 (模式: ${intent.responseMode})`);
        
        finalSummary = formatResponse(intent.responseMode, {
          news: formattedNewsData,
          analysis: analysisData,
          advice: adviceData,
          symbols: symbols,
          lang: intent.lang || 'zh'
        });
        
        // 验证输出合规性
        const compliance = validateOutputCompliance(intent.responseMode, finalSummary);
        if (!compliance.compliant) {
          console.warn(`⚠️  输出合规性检查失败:`, compliance.violations);
        } else {
          console.log(`✅ 输出合规性检查通过 (${intent.responseMode})`);
        }
      } else {
        // full_report模式：使用AI生成的完整文本
        console.log(`📝 使用完整报告模式`);
      }
      
    } catch (error) {
      console.error(`❌ responseFormatter失败:`, error.message);
      // 降级：使用原始AI文本
      finalSummary = responseText;
    }

    // 归一化 actions - 转换字符串数组为对象数组
    const rawActions = intent.actions || [];
    const actions_v2 = [];
    
    // 将semanticIntent的字符串actions转换为对象格式
    for (const action of rawActions) {
      if (typeof action === 'string') {
        // 字符串格式：转换为对象
        if (action === 'fetch_heatmap') {
          const exchangeName = intent.exchange || 'US';
          console.log(`📊 生成真实热力图图片: ${exchangeName}`);
          try {
            const heatmapUrl = await generateHeatmapImage(exchangeName); // 🆕 生成真实热力图PNG
            actions_v2.push({
              type: 'fetch_heatmap',
              exchange: exchangeName,
              url: heatmapUrl,
              reason: `用户请求${exchangeName}市场热力图`
            });
            console.log(`✅ 热力图URL生成成功: ${heatmapUrl.substring(0, 80)}...`);
          } catch (heatmapError) {
            console.error(`❌ 热力图生成失败:`, heatmapError.message);
            // 降级：不添加热力图action
          }
        } else if (action === 'fetch_quotes') {
          actions_v2.push({
            type: 'fetch_quotes',
            symbols: symbols,
            reason: '获取股票实时报价'
          });
        } else if (action === 'fetch_news') {
          actions_v2.push({
            type: 'fetch_news',
            symbols: symbols,
            reason: '获取相关新闻'
          });
        } else {
          // 其他未知action，保持原样
          actions_v2.push({ type: action });
        }
      } else if (typeof action === 'object' && action.type) {
        // 已经是对象格式，直接使用
        actions_v2.push(action);
      }
    }
    
    // 将图表动作写入actions（供N8N消费 - 脑体分离）
    for (const { metric, url } of chartUrls) {
      actions_v2.push({
        type: 'send_chart',
        metric,
        url,
        caption: `📈 ${metric} 最近走势（智能生成）`
      });
    }
    
    // 🆕 v5.0: 个股图表action
    if (stockChartData && stockChartData.chartURL) {
      actions_v2.push({
        type: 'send_stock_chart',
        symbol: symbols[0],
        chartURL: stockChartData.chartURL,
        provider: stockChartData.provider,
        caption: stockChartData.comprehensiveAnalysis 
          ? `📈 ${symbols[0]} K线技术分析\n\n${stockChartData.comprehensiveAnalysis.substring(0, 800)}...`
          : stockChartData.chartAnalysis || `${symbols[0]} K线走势图`
      });
      console.log(`✅ 个股图表action已添加 (provider: ${stockChartData.provider})`);
    }
    
    console.log(`🎬 最终actions数组:`, JSON.stringify(actions_v2, null, 2));

    // v2 标准响应（符合GPT v3.1 MVP Schema）
    const responseV2 = {
      ok: true,
      status: "ok",  // N8N workflow需要此字段
      model: gpt5Result.model,  // 🆕 v4.0: 顶层model字段（便于n8n观测）
      requestId: reqId,
      
      // 🆕 v3.1 MVP核心字段
      parse: {
        symbols: symbols.map(s => ({ resolved: s })),
        disambiguation: false,
        exchange: intent.exchange,
        sector: intent.sector
      },
      news: formattedNewsData || [],
      analysis: analysisData || {},
      advice: adviceData || {},
      
      // 三层架构信息
      levels: {
        l1: { intent: l1_intent, score: l1_score, router: 'gpt-4o-mini' },
        l2: { 
          plan: l2_plan_friendly, 
          modelsSelected: l2_models, 
          budget: l2_budget,
          visualIntent  // 可视化意图（调试用）
        },
        l3: { triggered: l3_triggered, models: l3_models, reason: l3_reason }
      },
      cost: {
        estimated: estCost,
        total: totalCost
      },
      market_data: {
        sec_financials,
        macro: macroData,
        collected: marketData?.collected,
        summary: marketData?.summary,
        data: marketData?.data
      },
      summary: finalSummary,
      caption: finalSummary,
      actions: actions_v2,
      
      // 🆕 v5.0: 个股图表数据
      stock_chart: stockChartData,
      
      media: {
        charts: chartUrls  // 图表URL列表（可选兼容字段）
      },
      
      // 兼容老字段
      final_analysis: responseText,
      final_text: responseText,
      image_url: imageUrl,
      needs_heatmap: intent.actions ? intent.actions.some(a => 
        (typeof a === 'string' && a === 'fetch_heatmap') || 
        (typeof a === 'object' && a.type === 'fetch_heatmap')
      ) : false,
      intent: {
        mode: intent.mode,
        lang: intent.lang,
        confidence: intent.confidence
      },
      scene: {
        name: scene.name,
        depth: scene.depth,
        targetLength: scene.targetLength
      },
      symbols,
      ai_results: {  // 🆕 v4.0: GPT-5单核结果（兼容格式）
        model: gpt5Result.model,
        success: gpt5Result.success,
        cost_usd: gpt5Result.cost_usd,
        elapsed_ms: gpt5Result.elapsed_ms
      },
      synthesis: {
        success: synthesis.success,
        synthesized: synthesis.synthesized
      },
      low_confidence: intent.confidence < 0.7,
      chat_type,
      user_id,
      response_time_ms: responseTime,
      
      // Debug信息（三层架构可视化）
      debug: {
        requestId: reqId,
        style: chat_type === 'private' ? 'teacher_personal' : 'team_professional',
        tasks,
        user_prefs: userPrefs,
        // 🆕 v4.1: SmartBrain debug信息
        model_used: gpt5Result.debug?.model_used || gpt5Result.model,
        fallback_used: gpt5Result.debug?.fallback_used || false,
        latency_ms: responseTime,
        call_latency_ms: gpt5Result.debug?.call_latency_ms || gpt5Result.elapsed_ms,
        attempts: gpt5Result.debug?.attempts || 1,
        // 🆕 v4.2: 数据源timing信息
        sources_timing: marketData?.metadata?.timings || {},
        cache_hit: marketData?.metadata?.cache_hits > 0 ? true : false,
        cache_hit_rate: marketData?.metadata?.cache_total > 0 
          ? `${(marketData.metadata.cache_hits / marketData.metadata.cache_total * 100).toFixed(1)}%`
          : 'N/A',
        // 🆕 v4.1: error_history (如果有降级)
        ...(gpt5Result.debug?.error_history && { error_history: gpt5Result.debug.error_history }),
        // 🆕 v4.2: data_errors (数据采集错误)
        ...(debugInfo.data_errors.length > 0 && { data_errors: debugInfo.data_errors }),
        // L1层：复杂度评分
        l1_complexity: {
          score: complexity.score,
          tier: complexity.tier,
          reasoning: complexity.reasoning
        },
        // L2层：模型选择
        l2_model_selection: {
          budget: finalBudget,
          budget_limit: modelSelection.budgetConfig,
          models_chosen: modelSelection.models.map(m => ({ name: m.name, role: m.role })),
          estimated_cost: modelSelection.estimatedCost,
          tier: modelSelection.tier
        },
        // L3层：深度推理
        l3_deep_reasoning: {
          enabled: enableDeepReasoning,
          reason: enableDeepReasoning ? complexity.reasoning : null,
          deep_models: enableDeepReasoning 
            ? modelSelection.models.filter(m => m.name === 'o1' || m.name === 'claude-opus').map(m => m.name)
            : []
        }
      }
    };
    
    // 🆕 v4.2: 记录统计（含缓存信息）
    recordRequest(
      gpt5Result.success,
      responseTime,
      gpt5Result.debug?.model_used || gpt5Result.model,
      gpt5Result.debug?.fallback_used || false,
      { 
        hits: marketData?.metadata?.cache_hits || 0,
        total: marketData?.metadata?.cache_total || 0
      }
    );
    
    // 🆕 更新请求跟踪器状态（完成）
    if (requestTracker.has(reqId)) {
      requestTracker.set(reqId, {
        ...requestTracker.get(reqId),
        status: 'completed',
        stage: 'done',
        completedAt: Date.now()
      });
    }
    
    // 8. Response
    // 注：cleanup由res.on('finish')自动处理，无需手动清理
    return res.json(responseV2);
    
  } catch (err) {
    console.error('[orchestrate] error', err);
    Memory.save({ error: String(err), ok: false });
    
    // 🆕 错误时更新请求跟踪器状态
    if (reqId && requestTracker.has(reqId)) {
      requestTracker.set(reqId, {
        ...requestTracker.get(reqId),
        status: 'error',
        stage: 'failed',
        error: err.message
      });
    }
    // 注：cleanup由res.on('finish')自动处理
    
    // 永不抛出，让 n8n 的 Normalize_Brain_Response / IF_ErrorCheck 有稳定语义
    return res.status(200).json({
      status: 'error',
      ok: false,
      error: String(err && err.message || err),
      final_text: '⚠️ 系统临时故障，稍后再试',
      final_analysis: '⚠️ 系统临时故障，稍后再试',
      actions: [],
      symbols: [],
      elapsed_ms: Date.now() - started
    });
  }
});

// Memory API - 查看系统记忆
app.get("/brain/memory", (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  return res.json({
    recent_logs: Memory.recent(limit),
    user_prefs: Memory.userPrefs
  });
});

// Memory Clear API - 清空用户历史记忆
app.post("/brain/memory/clear", async (req, res) => {
  try {
    const { user_id } = req.body;
    
    if (!user_id) {
      return res.status(400).json({
        ok: false,
        error: "user_id is required"
      });
    }
    
    // 从PostgreSQL删除用户历史
    if (!ENABLE_DB) {
      return res.status(503).json({ error: "Database disabled" });
    }
    const result = await getPool().query(
      'DELETE FROM user_memory WHERE user_id = $1',
      [user_id]
    );
    
    console.log(`🗑️  清空用户记忆: user_id=${user_id}, 删除${result.rowCount}条记录`);
    
    // 同时清空内存中的用户偏好（兼容性）
    if (Memory.userPrefs[user_id]) {
      delete Memory.userPrefs[user_id];
    }
    
    return res.json({
      ok: true,
      message: `已清空用户 ${user_id} 的历史记忆`,
      deleted_count: result.rowCount
    });
    
  } catch (error) {
    console.error(`❌ 清空记忆失败:`, error.message);
    return res.status(500).json({
      ok: false,
      error: "clear_memory_failed",
      detail: error.message
    });
  }
});

// ====== 🆕 v6.0: n8n专用API（纯分析，不截图） ======
app.post("/brain/analyze_no_screenshot", async (req, res) => {
  const startTime = Date.now();
  
  try {
    const {
      text = "",
      symbols: providedSymbols = [],
      mode = "intraday",
      lang = "zh",
      user_id = "n8n_user",
      chart_url = null  // n8n传入的截图URL（可选）
    } = req.body || {};
    
    console.log(`\n🔵 [n8n API] 收到纯分析请求: "${text}"`);
    console.log(`   符号: ${providedSymbols.join(', ') || '无'}`);
    console.log(`   语言: ${lang}`);
    
    // 1. 智能意图理解
    let symbols = providedSymbols;
    if (symbols.length === 0 && text) {
      try {
        const semanticIntent = await parseUserIntent(text, []);
        const resolvedSymbols = await resolveSymbols(semanticIntent);
        symbols = resolvedSymbols;
        console.log(`🎯 智能识别股票: ${symbols.join(', ')}`);
      } catch (err) {
        console.warn(`⚠️  意图解析失败，使用简单提取`);
        const { extractSymbols } = require('./utils');
        symbols = extractSymbols(text);
      }
    }
    
    // 2. 获取市场数据（如果有股票代码）
    let marketData = { quotes: {}, news: [], metadata: { dataQuality: { overallScore: 0 } } };
    if (symbols.length > 0) {
      try {
        marketData = await fetchMarketData(symbols, ['quote', 'profile', 'metrics', 'news']);
        console.log(`✅ 数据采集成功 (质量: ${(marketData.metadata.dataQuality.overallScore * 100).toFixed(0)}%)`);
      } catch (err) {
        console.error(`❌ 数据采集失败:`, err.message);
      }
    }
    
    // 3. v6.0多语言AI分析
    let analysisResult;
    const isChinese = /[\u4e00-\u9fa5]/.test(text);
    
    if (isChinese && symbols.length > 0) {
      console.log(`🇨🇳 [v6.0] 中文输入 → DeepSeek分析`);
      const MultiLanguageAnalyzer = require('./multiLanguageAnalyzer');
      const analyzer = new MultiLanguageAnalyzer();
      analysisResult = await analyzer.smartAnalyze(text, marketData, { mode, scene: 'private' });
    } else {
      console.log(`🧠 [v6.0] 英文输入 → GPT-4o分析`);
      analysisResult = await generateWithGPT5({
        text,
        marketData,
        semanticIntent: { mode, lang, intentType: 'analysis' },
        mode,
        scene: 'private',
        symbols
      });
    }
    
    // 4. 组合结果
    const response = {
      success: true,
      final_text: analysisResult.text,
      symbols: symbols,
      ai_model: analysisResult.model,
      language: isChinese ? 'zh' : 'en',
      cost_usd: analysisResult.cost_usd || 0,
      chart_url: chart_url,  // 回传n8n提供的截图URL
      market_data: marketData,
      response_time_ms: Date.now() - startTime
    };
    
    console.log(`✅ [n8n API] 分析完成 (${response.ai_model}, ${response.response_time_ms}ms, $${response.cost_usd.toFixed(4)})`);
    res.json(response);
    
  } catch (error) {
    console.error(`❌ [n8n API] 错误:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      final_text: "分析失败，请稍后重试"
    });
  }
});

console.log("🔍 ENV PORT =", process.env.PORT);
const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 USIS Brain v6.0 online on port ${PORT} 🆕 [Multi-AI + n8n Integration]`);
  console.log(`📍 Listening on 0.0.0.0:${PORT}`);
  console.log(`🔗 Health check available at http://0.0.0.0:${PORT}/health`);
  console.log(`🧪 Heatmap test available at http://0.0.0.0:${PORT}/api/test-heatmap`);
  console.log(`🔵 n8n API available at http://0.0.0.0:${PORT}/brain/analyze_no_screenshot`);
  
  // 🛡️ v6.1: N8N监控已禁用（节省内存 ~200MB）
  console.log('⚠️  N8N监控已禁用以节省内存');
});

// ====== Telegram Bot v5.0 (手动轮询 - Replit兼容) ======
// 🆕 v6.4: 直接使用TELEGRAM_BOT_TOKEN（Publishing已删除TEST token）
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

console.log(`🤖 [Bot Token] Token: ${TELEGRAM_TOKEN ? TELEGRAM_TOKEN.slice(0, 10) + '...' : 'MISSING'}`);

// 🆕 v1.1: PID文件锁机制（防止重复启动Bot）
const fs = require('fs');
const path = require('path');
const BOT_PID_FILE = path.join(__dirname, '.telegram_bot.pid');
const SKIP_BOT_LOCK = process.env.SKIP_BOT_LOCK === 'true'; // 开发环境bypass

function acquireBotLock() {
  if (SKIP_BOT_LOCK) {
    console.log('🔓 [Bot Lock] 跳过锁检查（SKIP_BOT_LOCK=true）');
    return true;
  }
  
  // 检查锁文件是否存在
  if (fs.existsSync(BOT_PID_FILE)) {
    try {
      const oldPid = parseInt(fs.readFileSync(BOT_PID_FILE, 'utf8').trim());
      
      // 检查该进程是否仍在运行
      try {
        process.kill(oldPid, 0); // 发送0信号检查进程存在性
        console.error(`🔒 [Bot Lock] Telegram Bot已在运行（PID: ${oldPid}）`);
        console.error(`⚠️  如果确定没有重复实例，请删除 ${BOT_PID_FILE}`);
        return false;
      } catch (e) {
        // 进程不存在，删除过期锁文件
        console.log(`🧹 [Bot Lock] 清理过期锁文件（PID ${oldPid} 已不存在）`);
        fs.unlinkSync(BOT_PID_FILE);
      }
    } catch (e) {
      console.warn(`⚠️  [Bot Lock] 读取锁文件失败:`, e.message);
      fs.unlinkSync(BOT_PID_FILE);
    }
  }
  
  // 创建新锁文件
  try {
    fs.writeFileSync(BOT_PID_FILE, String(process.pid));
    console.log(`🔒 [Bot Lock] 已获取Bot锁（PID: ${process.pid}）`);
    return true;
  } catch (e) {
    console.error(`❌ [Bot Lock] 创建锁文件失败:`, e.message);
    return false;
  }
}

function releaseBotLock() {
  if (fs.existsSync(BOT_PID_FILE)) {
    try {
      fs.unlinkSync(BOT_PID_FILE);
      console.log(`🔓 [Bot Lock] 已释放Bot锁`);
    } catch (e) {
      console.error(`⚠️  [Bot Lock] 释放锁失败:`, e.message);
    }
  }
}

// 🆕 v1.1: 进程退出时释放Bot锁
process.on('exit', () => {
  releaseBotLock();
});

// 🔒 安全阀：检查Token状态，防止冲突
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TOKEN_IS_SAFE = BOT_TOKEN && 
                      BOT_TOKEN !== 'ROTATING' && 
                      BOT_TOKEN.length > 10 &&
                      BOT_TOKEN !== 'undefined' &&
                      BOT_TOKEN !== 'null';

if (!TOKEN_IS_SAFE) {
  console.log('🛡️  [SAFE MODE] Telegram bot disabled (no token or rotating)');
  console.log('📋 [SAFE MODE] Token状态:', {
    exists: !!BOT_TOKEN,
    value: BOT_TOKEN?.substring(0, 10) + '...' || 'undefined',
    isRotating: BOT_TOKEN === 'ROTATING'
  });
  console.log('💡 [SAFE MODE] 设置有效的TELEGRAM_BOT_TOKEN后重启应用');
} else if (ENABLE_TELEGRAM && TELEGRAM_TOKEN) {
  // 🆕 v1.1: 获取Bot锁（防止重复启动）
  if (!acquireBotLock()) {
    console.error('❌ 无法启动Telegram Bot: 已有实例在运行');
    console.error('💡 提示: 设置环境变量 SKIP_BOT_LOCK=true 可跳过锁检查');
  } else {
    // 🛡️ v6.1: 懒加载Telegraf（节省~200MB内存）
    const { Telegraf } = require('telegraf');
    const https = require('https');
    const FormData = require('form-data');
    
    console.log('🤖 启动 Telegram Bot (Manual Polling)...');
  
  // ===== Telegram Document Sender (safe multipart) =====
  async function sendDocumentBuffer(token, chatId, buffer, filename, caption = '') {
    if (!Buffer.isBuffer(buffer)) {
      throw new Error('sendDocumentBuffer: buffer must be a Buffer');
    }
    if (buffer.length > 45 * 1024 * 1024) {
      throw new Error(`file too large: ${(buffer.length/1024/1024).toFixed(2)}MB`);
    }

    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('caption', caption.slice(0, 1000));
    form.append('document', buffer, { filename: filename || 'heatmap.png', contentType: 'image/png' });

    console.log(`[TG] sendDocument: ${filename}, ${(buffer.length/1024).toFixed(2)}KB`);
    
    // 使用AbortController实现超时（node-fetch v2兼容）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);
    
    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      headers: form.getHeaders(),
      body: form,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    const text = await res.text();
    console.log('[TG] sendDocument status:', res.status, 'len:', text.length);
    
    if (!res.ok) {
      throw new Error(`sendDocument failed ${res.status}: ${text}`);
    }
    
    try {
      const json = JSON.parse(text);
      if (!json.ok) throw new Error(json.description || 'telegram ok=false');
      return json;
    } catch (e) {
      throw new Error(`sendDocument non-json: ${text.slice(0, 200)}`);
    }
  }
  
  // 🆕 v3.2: 临时缓存用户的持仓信息（用于callback恢复）
  const userPositionContextCache = new Map(); // key: userId, value: {positionContext, timestamp}
  
  // Telegram API 调用
  function telegramAPI(method, params = {}, timeout = 35000) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(params);
      const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${TELEGRAM_TOKEN}/${method}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data, 'utf8')
        },
        timeout
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(body);
            if (!result.ok) {
              reject(new Error(result.description || 'API call failed'));
            } else {
              resolve(result);
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Timeout for ${method}`));
      });

      req.write(data);
      req.end();
    });
  }
  
  // 消息处理函数
  async function handleTelegramMessage(message) {
    const chatId = message.chat.id;
    let text = message.text || '';
    const userId = message.from.id;
    
    // 🔧 修复群组消息：移除@mention前缀
    const isGroupChat = message.chat.type === 'group' || message.chat.type === 'supergroup';
    if (isGroupChat && text.startsWith('@')) {
      // 移除 "@botname " 前缀，保留用户实际输入
      text = text.replace(/^@\w+\s*/i, '').trim();
      console.log(`\n📨 [TG] 群组消息 from ${userId}: "${message.text}" → 清理后: "${text}"`);
    } else {
      console.log(`\n📨 [TG] Message from ${userId}: "${text}"`);
    }
    
    try {
      // 🆕 v6.2: 优先检测对话类意图（greeting/help/casual）
      if (isGreeting(text) || isHelpRequest(text) || isSystemCommand(text)) {
        console.log('💬 检测到对话类意图，路由到对话系统');
        
        // 获取用户历史（用于个性化对话）
        let userHistory = [];
        if (ENABLE_DB) {
          try {
            const result = await safeQuery(
              'SELECT * FROM user_memory WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 5',
              [`tg_${userId}`]
            );
            userHistory = result.rows;
          } catch (dbError) {
            console.log('⚠️  数据库查询失败，使用空历史:', dbError.message);
          }
        }
        
        // 调用对话系统
        let intentType = 'casual';
        if (isGreeting(text)) intentType = 'greeting';
        else if (isHelpRequest(text)) intentType = 'help';
        else if (isSystemCommand(text)) intentType = 'meta';
        
        const conversationResponse = await handleConversation(text, intentType, userHistory);
        
        // 处理系统命令（清除记忆）
        if (conversationResponse.type === 'system' && conversationResponse.action === 'clear_memory') {
          if (ENABLE_DB) {
            try {
              await safeQuery('DELETE FROM user_memory WHERE user_id = $1', [`tg_${userId}`]);
              console.log(`✅ 已清除用户 ${userId} 的记忆`);
            } catch (dbError) {
              console.log('⚠️  清除记忆失败:', dbError.message);
            }
          }
        }
        
        // 发送响应
        let responseText = conversationResponse.text;
        if (conversationResponse.suggestions && conversationResponse.suggestions.length > 0) {
          responseText += `\n\n💡 **建议尝试**：\n${conversationResponse.suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
        }
        
        await telegramAPI('sendMessage', { 
          chat_id: chatId, 
          text: responseText,
          parse_mode: 'Markdown'
        });
        
        console.log('✅ 对话响应已发送');
        return; // 不继续执行分析流程
      }
      
      const isHeatmap = text.includes('热力图') || text.toLowerCase().includes('heatmap');
      
      // 🆕 v1.0: 检测个股分析请求（扩展逻辑：单独股票代码也算）
      const stockKeywords = ['解析', '分析', '走势', 'K线', 'chart', '图表'];
      const hasStockKeyword = stockKeywords.some(kw => text.includes(kw));
      const symbols = extractSymbols(text);
      // 修复：单独的股票代码（如"AAPL"）也应该走股票分析路径，避免HTTP调用
      const isStockAnalysis = symbols.length > 0 && !isHeatmap;
      
      if (isHeatmap) {
        console.log('🎨 热力图请求');
        await telegramAPI('sendMessage', { chat_id: chatId, text: '🎨 正在生成热力图...' });
        
        const result = await generateSmartHeatmap(text);
        
        if (result.buffer) {
          // 使用安全的 sendDocumentBuffer (form-data自动处理Content-Length)
          await sendDocumentBuffer(TELEGRAM_TOKEN, chatId, result.buffer, 'heatmap.png', result.caption || '');
          
          if (result.summary) {
            await telegramAPI('sendMessage', { chat_id: chatId, text: result.summary.slice(0, 4000) });
          }
          console.log('✅ 热力图已发送');
        }
      } else if (isStockAnalysis) {
        // 🧠 个股分析（大脑）→ 📸 调用n8n截图（眼睛）→ 📊 AI分析
        console.log(`📈 个股分析请求: ${symbols.join(', ')}`);
        
        // 🆕 v3.2: 解析意图以获取持仓信息 + v6.2: 使用symbolResolver
        let positionContext = null;
        let semanticIntent = null;
        let resolvedSymbols = [];
        
        try {
          semanticIntent = await parseUserIntent(text, []);
          positionContext = semanticIntent.positionContext || null;
          if (positionContext && positionContext.buyPrice) {
            console.log(`💼 检测到持仓信息: 买入成本 $${positionContext.buyPrice}`);
            
            // 🆕 缓存持仓信息（5分钟有效期）用于callback恢复
            userPositionContextCache.set(userId, {
              positionContext: positionContext,
              timestamp: Date.now()
            });
            console.log(`💾 已缓存用户${userId}的持仓信息`);
          }
          
          // 🆕 v6.2: 使用统一的symbolResolver（支持交易所消歧）
          resolvedSymbols = await resolveSymbols(semanticIntent);
          console.log(`✅ [Telegram] Symbol Resolver结果: [${resolvedSymbols.join(', ')}]`);
          
          // 如果symbolResolver返回空数组，降级到旧逻辑
          if (resolvedSymbols.length === 0) {
            console.log(`⚠️ Symbol Resolver未找到匹配，降级到validateAndFixSymbols`);
            resolvedSymbols = await validateAndFixSymbols(symbols, { interactive: true });
          }
        } catch (intentError) {
          console.log(`⚠️ 意图解析失败，降级到旧逻辑: ${intentError.message}`);
          // 降级：使用旧的validateAndFixSymbols
          resolvedSymbols = await validateAndFixSymbols(symbols, { interactive: true });
        }
        
        const validatedSymbols = resolvedSymbols;
        
        // 🆕 检测是否需要用户选择
        if (validatedSymbols[0] && validatedSymbols[0]._needsChoice) {
          const choice = validatedSymbols[0];
          console.log(`🎯 需要用户选择: ${choice.originalSymbol} 有 ${choice.candidates.length} 个匹配`);
          
          // 创建Inline Keyboard（最多12个按钮，每行2个）
          const keyboard = [];
          for (let i = 0; i < Math.min(choice.candidates.length, 12); i += 2) {
            const row = [];
            const c1 = choice.candidates[i];
            row.push({
              text: `${c1.symbol} - ${c1.description.slice(0, 30)}`,
              callback_data: `stock:${c1.symbol}`
            });
            
            if (i + 1 < choice.candidates.length) {
              const c2 = choice.candidates[i + 1];
              row.push({
                text: `${c2.symbol} - ${c2.description.slice(0, 30)}`,
                callback_data: `stock:${c2.symbol}`
              });
            }
            keyboard.push(row);
          }
          
          await telegramAPI('sendMessage', {
            chat_id: chatId,
            text: `❓ 找到 "${choice.originalSymbol}" 的 ${choice.candidates.length} 个匹配项，请选择您要分析的股票：`,
            reply_markup: {
              inline_keyboard: keyboard
            }
          });
          
          return; // 等待用户选择，不继续执行
        }
        
        // 正常流程：继续分析
        const finalSymbol = validatedSymbols[0];
        
        // 🆕 发送进度提示（告知用户预期等待时间）
        const progressMsg = await telegramAPI('sendMessage', { 
          chat_id: chatId, 
          text: `🔄 正在生成 ${finalSymbol} K线图表，这可能需要15-30秒...\n\n📸 步骤1: 截取TradingView图表\n🤖 步骤2: GPT-4o Vision技术分析\n⏳ 请稍候...` 
        });
        
        try {
          const result = await generateStockChart(finalSymbol, {
            interval: 'D',
            userText: text,
            positionContext: positionContext  // 🆕 v3.2: 传递持仓信息
          });
          
          // 🆕 删除进度提示消息（成功后清理）
          try {
            await telegramAPI('deleteMessage', { 
              chat_id: chatId, 
              message_id: progressMsg.result.message_id 
            });
          } catch (delError) {
            console.log('⚠️  无法删除进度消息（可能已过期）');
          }
          
          // 🆕 v6.2: 检查success字段，支持降级分析
          if (result.success && result.buffer) {
            // 成功：发送K线截图 + AI分析
            await sendDocumentBuffer(
              TELEGRAM_TOKEN, 
              chatId, 
              result.buffer, 
              `${symbols[0]}_chart.png`, 
              result.caption || '📊 K线图'
            );
            console.log('✅ K线图已发送');
            
            // 发送AI分析
            if (result.comprehensiveAnalysis || result.chartAnalysis) {
              const analysisText = result.comprehensiveAnalysis || result.chartAnalysis;
              await telegramAPI('sendMessage', { 
                chat_id: chatId, 
                text: analysisText.slice(0, 4000) 
              });
              console.log('✅ AI分析已发送');
            }
          } else if (!result.success && result.chartAnalysis) {
            // 降级：只有基础分析（screenshot失败）
            console.log('⚠️  图表生成失败，使用降级分析');
            await telegramAPI('sendMessage', { 
              chat_id: chatId, 
              text: `⚠️ TradingView图表暂时无法生成，为您提供基础分析：\n\n${result.chartAnalysis.slice(0, 4000)}` 
            });
            console.log('✅ 降级分析已发送');
          } else {
            // 完全失败：无图表也无分析
            throw new Error('图表和分析均失败');
          }
        } catch (stockError) {
          // 🆕 失败时也删除进度消息
          try {
            await telegramAPI('deleteMessage', { 
              chat_id: chatId, 
              message_id: progressMsg.result.message_id 
            });
          } catch (delError) {
            console.log('⚠️  无法删除进度消息');
          }
          
          // 发送友好的错误提示
          await telegramAPI('sendMessage', { 
            chat_id: chatId, 
            text: `⚠️ ${symbols[0]} 图表生成失败\n\n原因: ${stockError.message}\n\n💡 建议: 请稍后重试或尝试其他股票` 
          });
          throw stockError;
        }
      } else {
        console.log('🧠 常规分析');
        await telegramAPI('sendMessage', { chat_id: chatId, text: '🧠 正在分析...' });
        
        // 🆕 v1.1.1: 移除HTTP自调用，直接调用核心逻辑（带超时保护）
        let data = null;
        let retryCount = 0;
        const maxRetries = 1; // 最多重试1次
        const ANALYSIS_TIMEOUT_MS = 60000; // 🔧 增加到60秒（支持复杂分析）
        
        while (retryCount <= maxRetries) {
          // 🔧 创建timeout timer（确保总是被清理）
          let timeoutId = null;
          
          try {
            console.log(`🔄 [尝试${retryCount + 1}/${maxRetries + 1}] 调用invokeOrchestrator (超时${ANALYSIS_TIMEOUT_MS/1000}s)...`);
            
            // 🔧 使用Promise.race实现超时保护（确保清理timer）
            data = await Promise.race([
              invokeOrchestrator({
                text,
                user_id: `tg_${userId}`,
                chat_type: message.chat.type,
                mode: 'auto',
                budget: 'low',
                symbols: [],
                lang: 'zh'
              }),
              new Promise((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error(`Orchestrator timeout after ${ANALYSIS_TIMEOUT_MS/1000}s`)), ANALYSIS_TIMEOUT_MS);
              })
            ]);
            
            console.log('✅ invokeOrchestrator调用成功');
            break; // 成功，跳出循环
            
          } catch (fetchError) {
            retryCount++;
            
            if (retryCount > maxRetries) {
              // 超过重试次数，立即抛出错误（不执行backoff）
              console.error(`❌ invokeOrchestrator调用失败（${maxRetries + 1}次尝试）:`, fetchError.message);
              throw new Error(`分析请求失败: ${fetchError.message}`);
            }
            
            // 指数退避后重试
            const backoffMs = 100 * Math.pow(2, retryCount - 1);
            console.warn(`⚠️  invokeOrchestrator调用失败，${backoffMs}ms后重试...`);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
          } finally {
            // 🔧 确保总是清理timeout（防止unhandledRejection）
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
          }
        }
        
        // 处理返回的数据
        if (!data) {
          throw new Error('invokeOrchestrator未返回数据');
        }
        
        try {
          // 🆕 v5.0: 检查是否有个股图表需要发送
          if (data.stock_chart && data.stock_chart.buffer) {
            console.log('📈 检测到个股图表，准备发送buffer...');
            try {
              // 重建Buffer（处理JSON序列化: {type:'Buffer', data:[...]}）
              let chartBuffer;
              if (data.stock_chart.buffer.type === 'Buffer' && Array.isArray(data.stock_chart.buffer.data)) {
                chartBuffer = Buffer.from(data.stock_chart.buffer.data);
              } else if (Buffer.isBuffer(data.stock_chart.buffer)) {
                chartBuffer = data.stock_chart.buffer;
              } else {
                throw new Error('Invalid buffer format');
              }
              
              // 发送图表截图
              await sendDocumentBuffer(
                TELEGRAM_TOKEN, 
                chatId, 
                chartBuffer,
                `${data.symbols?.[0] || 'stock'}_chart.png`,
                data.stock_chart.comprehensiveAnalysis || data.stock_chart.chartAnalysis || '个股K线分析'
              );
              console.log('✅ 个股图表已发送');
            } catch (chartError) {
              console.error('❌ 发送个股图表失败:', chartError.message);
              // 降级：仅发送文本分析
            }
          }
          
          // 发送文本分析
          await telegramAPI('sendMessage', { 
            chat_id: chatId, 
            text: data.final_text || data.final_analysis || '分析完成' 
          });
          console.log('✅ 分析结果已发送');
        } catch (sendError) {
          console.error('❌ 发送结果失败:', sendError.message);
          throw sendError;
        }
      }
    } catch (error) {
      console.error('[TG] Error:', error.message);
      try {
        await telegramAPI('sendMessage', { 
          chat_id: chatId, 
          text: `⚠️ 处理失败: ${error.message}` 
        });
      } catch (e) {
        console.error('[TG] Failed to send error message:', e.message);
      }
    }
  }
  
  // 🆕 处理用户点击按钮（Callback Query）
  async function handleCallbackQuery(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data; // 格式: "stock:SAB.MC"
    const userId = callbackQuery.from.id;
    
    console.log(`\n🔘 [TG] Callback from ${userId}: "${data}"`);
    
    try {
      // 确认收到点击（移除按钮上的loading状态）
      await telegramAPI('answerCallbackQuery', { 
        callback_query_id: callbackQuery.id,
        text: '✅ 已选择'
      });
      
      // 解析callback_data
      if (data.startsWith('stock:')) {
        const selectedSymbol = data.substring(6); // 移除"stock:"前缀
        console.log(`📊 用户选择股票: ${selectedSymbol}`);
        
        // 更新原消息，显示用户选择
        await telegramAPI('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: `✅ 已选择: ${selectedSymbol}\n\n🔄 正在生成K线图表...`
        });
        
        // 执行股票分析
        try {
          const progressMsg = await telegramAPI('sendMessage', { 
            chat_id: chatId, 
            text: `🔄 正在生成 ${selectedSymbol} K线图表，这可能需要15-30秒...\n\n📸 步骤1: 截取TradingView图表\n🤖 步骤2: GPT-4o Vision技术分析\n⏳ 请稍候...` 
          });
          
          // 🆕 v3.2: 从缓存中恢复持仓信息
          let positionContext = null;
          const cached = userPositionContextCache.get(userId);
          if (cached && (Date.now() - cached.timestamp) < 5 * 60 * 1000) {
            // 5分钟内有效
            positionContext = cached.positionContext;
            console.log(`💼 从缓存恢复持仓信息: 买入成本 $${positionContext.buyPrice}`);
          } else {
            console.log(`⚠️ 缓存已过期或不存在，使用通用分析`);
          }
          
          const result = await generateStockChart(selectedSymbol, {
            interval: 'D',
            userText: `解析${selectedSymbol}`,
            positionContext: positionContext  // 🆕 v3.2: 从缓存恢复持仓信息
          });
          
          // 删除进度消息
          try {
            await telegramAPI('deleteMessage', { 
              chat_id: chatId, 
              message_id: progressMsg.result.message_id 
            });
          } catch (e) {
            console.log('⚠️  无法删除进度消息');
          }
          
          if (result.buffer) {
            // 发送K线截图
            await sendDocumentBuffer(
              TELEGRAM_TOKEN, 
              chatId, 
              result.buffer, 
              `${selectedSymbol}_chart.png`, 
              result.caption || '📊 K线图'
            );
            console.log('✅ K线图已发送');
            
            // 发送AI分析
            if (result.comprehensiveAnalysis || result.chartAnalysis) {
              const analysisText = result.comprehensiveAnalysis || result.chartAnalysis;
              await telegramAPI('sendMessage', { 
                chat_id: chatId, 
                text: analysisText.slice(0, 4000) 
              });
              console.log('✅ AI分析已发送');
            }
          }
        } catch (stockError) {
          console.error('❌ 股票分析失败:', stockError.message);
          await telegramAPI('sendMessage', { 
            chat_id: chatId, 
            text: `⚠️ ${selectedSymbol} 分析失败\n\n原因: ${stockError.message}\n\n💡 建议: 请稍后重试` 
          });
        }
      }
    } catch (error) {
      console.error('[TG] Callback error:', error.message);
      await telegramAPI('sendMessage', { 
        chat_id: chatId, 
        text: `⚠️ 处理失败: ${error.message}` 
      });
    }
  }
  
  // 轮询循环
  let offset = 0;
  let polling = false;
  let shouldStop = false; // 优雅关闭标志
  
  async function pollTelegram() {
    if (shouldStop) {
      console.log('🛑 [TG] Polling stopped gracefully');
      return;
    }
    if (polling) return;
    polling = true;
    
    try {
      const result = await telegramAPI('getUpdates', { offset, timeout: 25 }, 35000);
      
      if (result.result && result.result.length > 0) {
        console.log(`📬 [TG] Got ${result.result.length} updates`);
        
        for (const update of result.result) {
          offset = update.update_id + 1;
          
          // 处理普通消息
          if (update.message && update.message.text) {
            await handleTelegramMessage(update.message);
          }
          
          // 🆕 处理按钮点击（callback_query）
          if (update.callback_query) {
            await handleCallbackQuery(update.callback_query);
          }
        }
      }
    } catch (e) {
      console.error('[TG] Poll error:', e.message);
    } finally {
      polling = false;
      setTimeout(pollTelegram, 1000);
    }
  }
  
  // 延迟2秒启动轮询（让Express服务器先启动）
  setTimeout(async () => {
    try {
      // 🔧 修复冲突：启动前强制删除Webhook（确保使用长轮询）
      console.log('🔄 [TG] Deleting webhook before starting polling...');
      const deleteResult = await telegramAPI('deleteWebhook', { drop_pending_updates: true }, 10000);
      if (deleteResult.ok) {
        console.log('✅ [TG] Webhook deleted successfully');
      } else {
        console.warn('⚠️  [TG] Webhook delete warning:', deleteResult);
      }
    } catch (deleteError) {
      console.error('⚠️  [TG] Failed to delete webhook:', deleteError.message);
      // 继续启动，因为webhook可能本来就不存在
    }
    
    console.log('✅ Telegram Bot 已启动（手动轮询）');
    console.log('💬 现在可以在 Telegram 里直接发消息了');
    
    // 🛡️ 添加额外的错误保护，防止轮询失败导致进程退出
    try {
      pollTelegram().catch(err => {
        console.error('[TG] Poll startup error:', err.message);
        // 重试
        setTimeout(pollTelegram, 5000);
      });
    } catch (syncError) {
      console.error('[TG] Poll sync error:', syncError.message);
      // 重试
      setTimeout(pollTelegram, 5000);
    }
  }, 2000);
  
  // 🛡️ 优雅关闭：停止轮询
  const originalSIGTERM = process.listeners('SIGTERM')[0];
  const originalSIGINT = process.listeners('SIGINT')[0];
  
  process.removeAllListeners('SIGTERM');
  process.removeAllListeners('SIGINT');
  
  process.on('SIGTERM', async () => {
    console.log('📡 [TG] Stopping bot polling...');
    shouldStop = true;
    releaseBotLock();
    if (originalSIGTERM) await originalSIGTERM();
  });
  
  process.on('SIGINT', async () => {
    console.log('📡 [TG] Stopping bot polling...');
    shouldStop = true;
    releaseBotLock();
    if (originalSIGINT) await originalSIGINT();
  });
  
  } // 🆕 v1.1: 闭合acquireBotLock的else块
} else {
  console.log('⚠️  未配置 TELEGRAM_BOT_TOKEN');
}

// 🆕 USIS News v2.0 - 新闻系统启动
const ENABLE_NEWS_SYSTEM = process.env.ENABLE_NEWS_SYSTEM === 'true';
const NEWS_CHANNEL_ID = process.env.NEWS_CHANNEL_ID; // Telegram频道ID用于推送新闻

if (ENABLE_NEWS_SYSTEM && ENABLE_DB) {
  console.log('\n📰 [USIS News v2.0] 正在启动新闻系统...');
  
  const { getScheduler } = require('./scheduler/newsScheduler');
  
  const newsScheduler = getScheduler({
    enabled: true,
    telegramToken: TELEGRAM_TOKEN,
    newsChannelId: NEWS_CHANNEL_ID
  });
  
  // 延迟5秒启动（确保数据库和Telegram都已就绪）
  setTimeout(async () => {
    try {
      await newsScheduler.start();
      console.log('✅ [USIS News v2.0] 新闻系统已启动');
      
      // 输出状态
      const status = await newsScheduler.getStatus();
      console.log('📊 [USIS News v2.0] 状态:', JSON.stringify(status, null, 2));
    } catch (error) {
      console.error('❌ [USIS News v2.0] 启动失败:', error.message);
    }
  }, 5000);
  
  // 🆕 v6.3: 内置RSS采集器（替代N8N）
  const RSSCollector = require('./rssCollector');
  const rssCollector = new RSSCollector();
  
  // 延迟10秒后首次执行
  setTimeout(() => {
    console.log('\n🚀 [RSS] Starting first collection...');
    rssCollector.run().catch(err => {
      console.error('❌ [RSS] First run failed:', err.message);
    });
  }, 10000);
  
  // 设置定时任务：每5分钟采集一次
  const rssTask = cron.schedule('*/5 * * * *', () => {
    console.log('\n⏰ [RSS] Scheduled collection triggered');
    rssCollector.run().catch(err => {
      console.error('❌ [RSS] Scheduled run failed:', err.message);
    });
  });
  
  console.log('📡 [RSS] Auto-collection scheduled every 5 minutes');
  
  // 优雅关闭
  process.on('SIGTERM', async () => {
    console.log('📰 [USIS News v2.0] 正在关闭...');
    newsScheduler.stop();
    rssTask.stop();
    console.log('📡 [RSS] Auto-collection stopped');
  });
  
} else if (ENABLE_NEWS_SYSTEM && !ENABLE_DB) {
  console.warn('⚠️  [USIS News v2.0] 需要数据库支持，但数据库已禁用');
} else {
  console.log('ℹ️  [USIS News v2.0] 已禁用 (设置 ENABLE_NEWS_SYSTEM=true 启用)');
}
