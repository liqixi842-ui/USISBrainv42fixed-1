# Overview
USIS Brain v6.0 is an Institutional-Grade Multi-AI Financial Analysis System designed for professional investment research. It orchestrates over six AI models with real-time data integration from various financial sources. Its purpose is to provide authoritative, data-backed investment recommendations through features like semantic intent parsing, global stock discovery, anti-hallucination data validation, intelligent model routing, Vision AI chart analysis, and automated workflow management. The system is built for deployment on Replit's Reserved VM platform, aiming to deliver institutional-grade analysis with multilingual capabilities and cost optimization.

# Recent Changes
- **2025-11-10**: **USIS News System v2.0 COMPLETED** - Implemented complete institutional-grade news aggregation system with 5-tier source architecture (Tier 5 regulatory down to Tier 1 social), ImpactRank 2.0 7-factor scoring algorithm, intelligent deduplication with authority escalation, score-based routing (Fastlane/2h/4h digests), and Telegram push service. Database schema includes 7 tables (news_sources, news_items, news_scores, news_routing_state, news_push_history, news_dedupe_cache, news_analyst_notes). System validated with end-to-end tests covering RSS fetching, multi-tier adapters, deduplication, scoring, and routing. Ready for production deployment with ENABLE_NEWS_SYSTEM=true flag.
- **2025-11-10**: Fixed screenshot timeout issue causing chart analysis failures. Increased SCREENSHOT_TIMEOUT from 15s to 30s and TOTAL_TIMEOUT from 55s to 75s to accommodate N8N's average 14.6s response time with safety margin.

# User Preferences
Preferred communication style: Simple, everyday language.

# System Architecture

## Application Framework
The system is built on Node.js with Express.js, offering a RESTful JSON API with standardized, versioned (`USIS.v3`), and multilingual responses, including model voting details, confidence scores, and semantic tagging.

## News System v2.0 Architecture
Institutional-grade news aggregation with 5-tier source hierarchy, ImpactRank 2.0 scoring, and intelligent routing:

**Components:**
- **News Ingestion Pipeline**: Multi-tier orchestrator with adapter pattern (Tier 5 regulatory → Tier 4 premium media → Tier 3 industry/aggregators). RSS-first approach with parallel fetching via Promise.allSettled.
- **Deduplication Engine**: 24h URL hash + 6h topic hash window with authority escalation (higher tier wins) and corroboration tracking.
- **ImpactRank 2.0 Scoring**: 7-factor algorithm (freshness, source_quality, relevance, impact, novelty, corroboration, attention) with context-aware weights. Composite score 0-10 scale.
- **Routing Engine**: Score-based channel assignment (≥7→Fastlane instant, 5-6.9→2h digest, 3-4.9→4h digest, <3→suppressed) with fade mechanism for repeat stories.
- **Push Service**: Telegram delivery with retry logic, Markdown formatting, and push history tracking.
- **Scheduler**: setInterval-based orchestration with graceful shutdown via SIGTERM handler.

**Database Schema (7 tables):**
- news_sources: Source configuration with tier, reliability_score, rate_limit
- news_items: Articles with symbols array, entities JSONB, GIN indexes
- news_scores: 7-factor scores + composite_score with DECIMAL precision
- news_routing_state: Channel assignment with fade_level, upgrade_flag
- news_push_history: Delivery tracking with outcome enum
- news_dedupe_cache: 24h deduplication with url_hash, topic_hash
- news_analyst_notes: AI commentary (future: Claude/GPT-4o)

**Control:** ENABLE_NEWS_SYSTEM=true, NEWS_CHANNEL_ID environment variables

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