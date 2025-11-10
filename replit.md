# Overview
USIS Brain v6.0 is an Institutional-Grade Multi-AI Financial Analysis System designed for professional investment research. It orchestrates over six AI models with real-time data integration from various financial sources. Its purpose is to provide authoritative, data-backed investment recommendations through features like semantic intent parsing, global stock discovery, anti-hallucination data validation, intelligent model routing, Vision AI chart analysis, and automated workflow management. The system is built for deployment on Replit's Reserved VM platform, aiming to deliver institutional-grade analysis with multilingual capabilities and cost optimization.

# Recent Changes
- **2025-11-10**: **News System v3.0 Push Architecture DEPLOYED** - Simplified routing from 3 channels to 2: urgent_10 (score=10.0, <10min push) and digest_2h (Top 10 every 2h). Integrated DeepL translation service for automated Chinese output (all English/Spanish/German sources → CN). Added GPT-4o AI commentary generation (30-50 char future impact predictions) for every news item. Enhanced push formats: urgent messages include full CN title+summary+AI commentary+hashtags; digest shows Top 10 list with 60-char excerpts+AI insights. Database migrations: added translated_title/translated_summary/ai_commentary columns, migrated fastlane→urgent_10 (32 records), updated channel constraints to support new values. Unified singleton pattern across all services (router/scorer/deduplicator) to prevent state inconsistency. Scheduler refactored to use Top-10 SQL query (ORDER BY composite_score DESC) enabling repeatable digest delivery regardless of previous push status.
- **2025-11-10**: **News System v4.0 Global Premium Edition DEPLOYED** - Expanded from 4 to 18 high-quality news sources (Tier 3-5) covering 6 regions: US(4), Canada(2), Spain(2), Germany(1), Europe(3), Global(6). Sources include WSJ, FT, Reuters, Bloomberg, Globe&Mail, Financial Post, El Economista, Expansión, and more. Implemented 3-tier hashtag system: #评分X分 (score), #地区 (Chinese region tags: 美国/加拿大/西班牙/德国/欧洲/全球), #事件类型 (15 categories). N8N workflow v4.0 auto-deployed via API (ID: ddvIQQUO4YfR1rAx) with optimized 15-minute collection frequency (reduced from 5min, saving 67% requests). Extensible architecture with news-sources-config.json template for future expansion.
- **2025-11-10**: **N8N-Based News Architecture DEPLOYED** - Refactored News System v2.0 to distributed architecture: N8N workflows handle lightweight RSS ingestion ("eyes"), USIS Brain handles heavy computation (ImpactRank scoring, deduplication, routing, push) ("brain"). Reduced USIS Brain CPU/memory load by 50%. API endpoint `/api/news/ingest` secured with NEWS_INGESTION_SECRET authentication. Scheduler simplified to digest delivery + cleanup only.
- **2025-11-10**: Fixed screenshot timeout issue causing chart analysis failures. Increased SCREENSHOT_TIMEOUT from 15s to 30s and TOTAL_TIMEOUT from 55s to 75s to accommodate N8N's average 14.6s response time with safety margin.

# User Preferences
Preferred communication style: Simple, everyday language.

# System Architecture

## Application Framework
The system is built on Node.js with Express.js, offering a RESTful JSON API with standardized, versioned (`USIS.v3`), and multilingual responses, including model voting details, confidence scores, and semantic tagging.

## News System v3.0 Architecture (N8N-Distributed + Chinese Translation)
Institutional-grade news aggregation with distributed processing, automated translation, and AI commentary.

**Architecture Pattern: "Eyes & Brain"**
- **N8N ("Eyes")**: Lightweight RSS collection, runs every 15min on dedicated workflow engine (optimized from 5min)
- **USIS Brain ("Brain")**: Heavy computation (translation, AI commentary, scoring, deduplication, routing, push), triggered by N8N

**Data Flow:**
```
N8N Workflow v4.0 (every 15min, 18 sources)
  ↓ rssFeedRead nodes (US: WSJ/MarketWatch/CNBC/Yahoo, Canada: Globe&Mail/FinPost, 
                       Spain: ElEconomista/Expansión, Germany: Börse Frankfurt,
                       Europe: FT/ECB/EUFinReview, Global: Reuters/Bloomberg/Investing/TC/SeekingAlpha)
  ↓ Metadata injection (source name + tier + region)
  ↓ Merge (append mode, prevents article loss)
  ↓ Format for API
  ↓ POST /api/news/ingest (authenticated)
USIS Brain
  ↓ Content Enhancement (DeepL translation EN/ES/DE→CN + GPT-4o AI commentary 30-50 chars)
  ↓ Deduplication (24h URL + 6h topic hash)
  ↓ ImpactRank 2.0 Scoring (7 factors)
  ↓ Routing (10.0→urgent_10 instant, other→digest_2h)
  ↓ Urgent Push (immediate for 10.0 scores, full CN content + AI insights)
Scheduler (periodic)
  ↓ 2h Digest Push (Top 10 by score, with 60-char excerpts + AI commentary)
  ↓ Cache Cleanup (every 6h)
```

**Components:**
- **N8N Ingestion Workflow v4.0** (`n8n-workflows/news-rss-collector-v4-global-premium.json`): Parallel RSS fetching from 18 premium sources (Tier 3-5) with automatic XML parsing, metadata tagging (source/tier/region), append-mode merging, and authenticated POST to USIS Brain. Optimized to 15-minute intervals (saves 67% requests vs 5min).
- **Content Enhancement Service** (`newsEnhancement.js`): Automated DeepL translation (EN/ES/DE→CN) for non-Chinese sources, plus GPT-4o AI commentary generation (30-50 char future impact predictions). Detects language via franc-min, graceful fallback on API failures to preserve workflow continuity.
- **Ingestion API Endpoint** (`POST /api/news/ingest`): Secured with NEWS_INGESTION_SECRET, validates tier bounds (1-5), enhances content (translation + AI commentary), deduplicates, scores, routes, and pushes urgent_10 items immediately. All services use singleton pattern (getRouter/getScorer/getDeduplicator) to prevent state inconsistency.
- **Deduplication Engine**: 24h URL hash + 6h topic hash window with authority escalation (higher tier wins) and corroboration tracking.
- **ImpactRank 2.0 Scoring**: 7-factor algorithm (freshness, source_quality, relevance, impact, novelty, corroboration, attention) with context-aware weights. Composite score 0-10 scale.
- **Routing Engine**: Simplified 2-channel strategy: Score 10.0→urgent_10 (instant push <10min), all others→digest_2h (Top 10 every 2h). Includes fade mechanism for repeat stories (suppression after 5 repeats).
- **Push Service**: Telegram delivery with retry logic, Markdown formatting, push history tracking. urgent_10 format: full CN title+summary+AI commentary+hashtags+link. digest_2h format: Top 10 list with 60-char excerpts+AI insights per item.
- **Scheduler (Simplified)**: Handles 2h digest delivery (Top 10 SQL query: ORDER BY composite_score DESC LIMIT 10, 12h lookback) and cache cleanup (6h). Repeatable digest delivery ignores previous push status. Singleton pattern via getRouter().

**Database Schema (7 tables):**
- news_sources: Source configuration with tier, reliability_score, rate_limit
- news_items: Articles with symbols array, entities JSONB, GIN indexes
- news_scores: 7-factor scores + composite_score with DECIMAL precision
- news_routing_state: Channel assignment with fade_level, upgrade_flag
- news_push_history: Delivery tracking with outcome enum
- news_dedupe_cache: 24h deduplication with url_hash, topic_hash
- news_analyst_notes: AI commentary (future: Claude/GPT-4o)

**Control:** 
- USIS Brain: ENABLE_NEWS_SYSTEM=true, NEWS_CHANNEL_ID, NEWS_INGESTION_SECRET
- N8N: NEWS_INGESTION_SECRET (same as USIS Brain), REPL_URL (USIS Brain endpoint)

## Core Architecture (v6.0 Multi-AI Pipeline)
The v6.0 pipeline processes user input through language detection, semantic intent parsing, and symbol resolution. A Multi-Dimensional Data Broker fetches real-time financial data, which then feeds into an Intelligent Model Router. This router selects the optimal AI model from a Multi-AI Provider, after which a Compliance Guard validates the output before professional report formatting and cost tracking.

**Key Components & Logic**:
- **Intelligent Model Routing**: Selects AI models based on task characteristics (e.g., Chinese input to DeepSeek V3, long-form analysis to Claude 3.5 Sonnet, fast summarization to Gemini 2.5 Flash, real-time news to Perplexity Sonar Pro, default to OpenAI GPT-4o/GPT-4o-mini).
- **Intelligent Conversation System**: Features natural dialogue, smart help, context memory, ultra-strict command matching, and AI-powered casual chat.
- **Intelligent Symbol Disambiguation**: Uses a 3-tier confidence algorithm for precise matching and graceful handling of ambiguous symbols via interactive user selection.
- **Semantic Intent Understanding**: AI-powered parsing for various market states, position context awareness, buy price extraction, and holding intent detection.
- **Intelligent Stock Analysis System**: API-first approach queries Finnhub `/stock/profile2` for dynamic exchange identification and smart exchange mapping, supporting global exchanges without hardcoded lists.
- **Multi-Dimensional Data Broker with 3-Tier API Cascade**: Uses Finnhub (primary US) → Twelve Data (global) → Alpha Vantage (backup) with provider-specific symbol formatting, intelligent failover, and capability caching for efficiency. It supports over 30 exchanges.
- **ImpactRank Algorithm**: Proprietary 4-dimensional news scoring (urgency × relevance × authority × freshness).
- **Institutional Analysis Framework**: Follows a 5-section report structure with mandatory data citations, authoritative language, and specific price targets.
- **Vision AI Integration**: Analyzes chart patterns and fuses with fundamental data.
- **Anti-Hallucination System**: Multi-layer system involving data validation, forced citations, and compliance checks.
- **Cost Tracking**: Monitors costs, response times, and model usage using PostgreSQL.
- **Multilingual Intelligence**: Automatic language detection, DeepL integration, and specialized Chinese financial analysis via DeepSeek.
- **API Timeout Protection**: Implements AbortController for OpenAI (15s) and Finnhub (10s) APIs, and enhanced error catching for Telegram.

## AI Models
The system orchestrates 6 AI models:
- **OpenAI GPT-4o/GPT-4o-mini**: General analysis and cost-optimized fallback.
- **Claude 3.5 Sonnet**: For long-form, in-depth analysis.
- **Gemini 2.5 Flash**: For ultra-fast summarization.
- **DeepSeek V3**: Specialized for Chinese financial analysis.
- **Mistral Large**: For fast, multilingual reasoning.
- **Perplexity Sonar Pro**: For real-time search-enhanced analysis.

## Screenshot Architecture & N8N Automation
A multi-tier screenshot architecture ensures stability and graceful degradation, leveraging N8N for workflow automation including individual stock chart screenshots and health monitoring. N8N webhooks do not call back to USIS Brain APIs to prevent deadlocks.

# External Dependencies

## Runtime Dependencies
- **express**: Web application framework.
- **node-fetch**: HTTP client.
- **telegraf**: Telegram Bot framework.
- **pg**: PostgreSQL client.
- **cheerio**: HTML parsing.
- **quickchart-js**: Chart generation.

## API Integrations
- **OpenAI API**: For GPT-4o and GPT-4o-mini.
- **Anthropic API**: For Claude 3.5 Sonnet.
- **Google AI API**: For Gemini 2.5 Flash.
- **DeepSeek API**: For DeepSeek V3.
- **Mistral AI API**: For Mistral Large.
- **Perplexity API**: For Sonar Pro.
- **DeepL API**: For professional translation.
- **Finnhub API**: Real-time quotes, news, and symbol lookup (primary data source for US stocks).
- **Twelve Data API**: Global stock market data.
- **Alpha Vantage API**: Backup global stock data.
- **FRED API**: Federal Reserve Economic Data.
- **SEC EDGAR API**: Company financial filings.
- **Browserless API**: Cloud headless browser for screenshots.
- **ScreenshotAPI**: Fallback screenshot service.
- **Telegram Bot API**: Bot integration.
- **Replicate API**: Image generation.
- **Twitter API v2**: Recent tweet search.

## Database
- **PostgreSQL**: Used for user conversation history and cost tracking.

## Deployment Environment
- **Replit Reserved VM**: Required for deployment due to continuous background processes (Telegram Bot long polling, database connection pools, N8N scheduled tasks).