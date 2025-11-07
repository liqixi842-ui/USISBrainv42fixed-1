# Overview

USIS Brain v5.0 is an Institutional-Grade Data-Driven Financial Analysis System with multi-dimensional real-time data integration and GPT-5 powered professional investment research capabilities. The system evolved from "general knowledge commentary" to "data-driven institutional analysis" with Goldman Sachs-style structured reporting framework. It combines proprietary real-time data integration (Finnhub quotes+profiles+metrics+news, SEC, FRED) and algorithmic scoring (ImpactRank) with GPT-5's natural language generation capabilities. Features include semantic intent parsing, global stock discovery, anti-hallucination data validation, pluggable screenshot providers with automatic fallback, Vision AI chart analysis, and authoritative data-backed investment recommendations. Designed for deployment on Replit's Autoscale platform.

**Architecture Evolution**: 
- v3.1 (multi-AI voting) → v4.0 (GPT-5 single-core generation) 
- v4.3 (Browserless/ScreenshotAPI/QuickChart three-tier screenshot system)
- v5.0 (Data-Driven Institutional Analysis with multi-dimensional data integration)

**v5.0 Major Upgrades**:
- Multi-dimensional data integration: company profiles, financial metrics, technical indicators
- Institutional-grade analysis framework (Executive Summary → Quantitative Data → Investment Themes → Risk Assessment → Actionable Recommendations)
- Authoritative language style with mandatory data citations
- Specific price targets and position sizing recommendations
- Deep Vision AI integration (chart patterns + fundamental data fusion)
- API call optimization (reuses existing marketData to avoid duplicates)

**Performance**: Response time ↓67% (16s→5s), Cost ↓87% ($0.06→$0.0075)
**Core IP Preserved**: ImpactRank algorithm, real-time data pipelines, Compliance Guard, pure rule-based heatmap parser

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Application Framework
- **Technology**: Node.js with Express.js
- **Module System**: CommonJS
- **API Design**: RESTful JSON API with standardized responses, versioning (`USIS.v3`), multilingual output, model voting details, confidence scores, and semantic tagging.

## Core Architecture (v5.0 Data-Driven Pipeline)

**v5.0 Institutional Analysis Pipeline**:
User Input → **Semantic Intent Agent** → **Symbol Resolver** (Finnhub Lookup) → **Multi-Dimensional Data Broker** (quotes + profiles + metrics + news) → **GPT-5 Institutional Brain** (data-driven generation) → **Compliance Guard** → Professional Report Formatting → Cost Tracking

**Key Components**:
- **Semantic Intent Understanding**: AI-powered intent parsing (premarket/intraday/postmarket/news/diagnose)
- **Global Stock Discovery**: Finnhub Symbol Lookup API supports any company name in any language
- **Multi-Dimensional Data Broker** 🆕 v5.0: Parallel fetching of:
  - Real-time quotes (price, volume, change%)
  - Company profiles (market cap, industry, IPO date)
  - Financial metrics (P/E, ROE, profit margin, revenue growth, 52-week high/low, beta)
  - News sentiment (with ImpactRank scoring)
  - Data provenance tracking + completeness scoring (0-1)
  - 120s cache TTL for all data sources
  - API call optimization (reuses existing marketData to avoid duplicates)
- **ImpactRank Algorithm**: Proprietary 4-dimensional news scoring (urgency × relevance × authority × freshness)
- **GPT-5 Institutional Brain** 🆕 v5.0: Goldman Sachs-style analysis with:
  - 500+ line structured prompt template
  - Mandatory data citations for every claim
  - Authoritative language (no defensive disclaimers)
  - Specific price targets and position sizing
  - 5-section report structure:
    1. Executive Summary (2-3 sentence authoritative judgment)
    2. Quantitative Data Analysis (metrics + context)
    3. Investment Themes (data-backed opportunities)
    4. Risk Assessment (quantified monitoring indicators)
    5. Actionable Recommendations (specific price levels + position sizing)
- **Vision AI Integration** 🆕 v5.0: Chart pattern analysis + fundamental data fusion
- **Anti-Hallucination System**: Multi-layer protection prevents AI from fabricating data:
  - Layer 1: Data validation before analysis (rejects invalid/stale data)
  - Layer 2: Forced data citation in prompts (AI must reference provided data only)
  - Layer 3: Compliance Guard validates output numbers against actual data
  - Layer 4 🆕: System prompt explicitly prohibits fabrication with specific examples
- **Cost Tracking**: PostgreSQL-backed monitoring of costs, response times, and model usage

**v5.0 Design Philosophy**:
- GPT-5 handles "expression layer" (institutional-grade language generation)
- USIS Brain handles "perception layer" (multi-dimensional real-time data) + "reasoning layer" (proprietary algorithms)
- System positioned as "Institutional-Grade Data-Driven Financial Brain + GPT-5 Language Frontend"
- Evolution from "general knowledge commentary" → "data-driven institutional analysis"

## AI Models
**v4.0**: Uses OpenAI GPT-5 as the single-core generation engine for all analysis and synthesis tasks.
**v3.1 (legacy)**: Supported 9 AI models with dynamic selection based on complexity (deprecated in v4.0).

## Data Sources
Integrates with Finnhub API, Alpha Vantage API, SEC EDGAR API, and FRED API for real-time quotes, news, market sentiment, technical indicators, financial filings, and macroeconomic data.

## Intelligence Features
- **Semantic Intent Understanding (v3.1)**: AI-powered natural language understanding replaces keyword workflows
- **Global Stock Discovery (v3.1)**: Finnhub Symbol Lookup supports any company name in any language
- **Data Provenance Tracking (v3.1)**: Every data point tagged with source, timestamp, and freshness score (0-1)
- **Anti-Hallucination System (v3.1)**: Multi-layer protection prevents AI from fabricating data:
  - Layer 1: Data validation before analysis (rejects invalid/stale data)
  - Layer 2: Forced data citation in prompts (AI must reference provided data only)
  - Layer 3: Compliance guard validates output numbers against input data
- **Intelligent Synthesis**: Extracts key points, identifies consensus/divergence, and generates unified reports
- **Dual Output Styles**: Offers a warm conversational tone for private chats and professional commentary for groups
- **Scene-Aware Content**: Adjusts content depth based on context (e.g., brief for premarket, deep for postmarket)
- **Memory Layer**: Utilizes a PostgreSQL-backed system to store user history (last 3 conversations) for personalized interactions, allowing the AI to adjust tone and depth based on past interactions. Users can clear their memory.

## Internationalization
Supports built-in multilingual responses (Chinese `zh`, Spanish `es`, English `en`) with automatic language detection.

## Observability
Provides console-based request logging with emoji markers and includes confidence scores, model voting details, and timestamps in responses.

## Heatmap System (v4.3 - n8n Style)
**Three-Tier Screenshot Architecture (n8n风格优先级)**:
- **Tier 1 - ScreenshotN8N** (Primary): n8n-style SaaS screenshot with 7-second delay + element waiting + network idle. Avoids complex DOM interactions. 3 retries with exponential backoff. ~8-10s response time.
- **Tier 2 - Browserless** (Enhancement): Cloud-based headless Chromium with A+B+C dataset switching strategy (dropdown click → search input → SPA route forcing). Used only when SaaS unavailable. DOM-level validation (label text + block count). ~10-15s response time.
- **Tier 3 - QuickChart** (Final Fallback): Generates simplified bar chart when all screenshot services fail. Returns with `validation: 'degraded'` flag.

**n8n Design Philosophy**:
- **Stability over Complexity**: Rely on long delays and browser waiting instead of DOM manipulation
- **SaaS-First**: Screenshot services handle the complexity; avoid fragile UI automation
- **Graceful Degradation**: Each tier provides progressively simpler but always-working output

**Pure Rule-Based Parser (v4.3)**: 
- 100% accurate intent parsing without GPT dependencies
- Supports 21 global indices (SPX500, NIKKEI225, IBEX35, etc.)
- Multi-language region detection (日本→JP/NIKKEI225, Spain→ES/IBEX35)
- Sector filtering (technology, healthcare, finance, energy, etc.)
- Three-layer anti-leakage protection for Spain/IBEX35

**Provider Module** (`screenshotProviders.js`):
- n8n-style smart routing with priority order
- Unified validation flags: `saas-waited`, `dom-strong`, `degraded`
- Exponential backoff retry logic (800ms × 2^n + jitter)
- Serial execution to avoid rate limiting
- Environment variable based configuration

**Recent Changes (v4.3.1)**:
- Restored n8n-style screenshot priority (SaaS → Browserless → QuickChart)
- Implemented `captureViaScreenshotN8N` with 7s delay and 3-retry logic
- Removed reliance on TradingView DOM interaction for primary path
- Added degradation markers for fallback scenarios

# External Dependencies

## Runtime Dependencies
- **express**: Web application framework
- **node-fetch**: HTTP client for API calls
- **telegraf**: Telegram Bot framework
- **pg**: PostgreSQL client
- **cheerio**: HTML parsing
- **quickchart-js**: Chart generation (fallback heatmaps)

## API Integrations
**Active (v4.3)**:
- **OpenAI API**: GPT-5 single-core generation
- **Finnhub API**: Real-time quotes, news, symbol lookup
- **FRED API**: Federal Reserve Economic Data (CPI, unemployment, GDP, interest rates)
- **SEC EDGAR API**: Company financial filings (10-K, 10-Q)
- **Browserless API**: Cloud headless browser for TradingView screenshot automation
- **ScreenshotAPI**: Fallback screenshot service
- **Telegram Bot API**: Direct bot integration for user interactions
- **Replicate API**: Image generation
- **Twitter API v2**: Recent tweet search

**Legacy (v3.1, inactive)**:
- Claude API, DeepSeek API, Gemini API, Perplexity API, Mistral API
- Alpha Vantage API (replaced by Finnhub)

## Database
- **PostgreSQL**: Used for memory management (user conversation history) and cost tracking.

## Deployment Environment
- **Replit**: Platform for deployment.