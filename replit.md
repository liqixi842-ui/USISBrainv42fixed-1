# Overview

USIS Brain v4.3 is a Real-time Financial Data Brain with GPT-5 language frontend and intelligent TradingView heatmap generation. The system combines proprietary real-time data integration (Finnhub, SEC, FRED) and algorithmic scoring (ImpactRank) with GPT-5's natural language understanding and generation capabilities. It features semantic intent parsing, global stock discovery, anti-hallucination data validation, pluggable screenshot providers with automatic fallback, and delivers dual output styles: a warm conversational tone for private chats and professional commentary for groups. Designed for deployment on Replit's Autoscale platform.

**Architecture Evolution**: 
- v3.1 (multi-AI voting) → v4.0 (GPT-5 single-core generation) 
- v4.3 (Browserless/ScreenshotAPI/QuickChart three-tier screenshot system)

**Performance**: Response time ↓67% (16s→5s), Cost ↓87% ($0.06→$0.0075)
**Core IP Preserved**: ImpactRank algorithm, real-time data pipelines, Compliance Guard, pure rule-based heatmap parser

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Application Framework
- **Technology**: Node.js with Express.js
- **Module System**: CommonJS
- **API Design**: RESTful JSON API with standardized responses, versioning (`USIS.v3`), multilingual output, model voting details, confidence scores, and semantic tagging.

## Core Architecture (v4.0 Simplified Pipeline)

**v4.0 Intelligent Pipeline**:
User Input → **Semantic Intent Agent** → **Symbol Resolver** (Finnhub Lookup) → **Data Broker** (with provenance) → **GPT-5 Brain** (single-core generation) → **Compliance Guard** → Response Formatting → Cost Tracking

**Key Components**:
- **Semantic Intent Understanding**: AI-powered intent parsing (premarket/intraday/postmarket/news/diagnose)
- **Global Stock Discovery**: Finnhub Symbol Lookup API supports any company name in any language
- **Data Broker with Provenance**: Every data point tagged with source, timestamp, and freshness score (0-1)
- **ImpactRank Algorithm**: Proprietary 4-dimensional news scoring (urgency × relevance × authority × freshness)
- **GPT-5 Single-Core Generation**: Unified analysis using OpenAI GPT-5 (replaces 6-AI voting)
- **Anti-Hallucination System**: Multi-layer protection prevents AI from fabricating data:
  - Layer 1: Data validation before analysis (rejects invalid/stale data)
  - Layer 2: Forced data citation in prompts (AI must reference provided data only)
  - Layer 3: Compliance Guard validates output numbers against actual data
- **Cost Tracking**: PostgreSQL-backed monitoring of costs, response times, and model usage

**v4.0 Design Philosophy**:
- GPT-5 handles "expression layer" (language understanding + generation)
- USIS Brain handles "perception layer" (real-time data) + "reasoning layer" (proprietary algorithms)
- System positioned as "Real-time Financial Data Brain + GPT-5 Language Frontend"

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

## Heatmap System (v4.3)
**Three-Tier Screenshot Architecture**:
- **Tier 1 - Browserless** (Primary): Cloud-based headless Chromium with Puppeteer script execution. Captures TradingView heatmaps with proper localization headers and dataset URL parameters. ~10s response time.
- **Tier 2 - ScreenshotAPI** (Fallback): Direct URL screenshot service. Falls back when Browserless unavailable or rate-limited.
- **Tier 3 - QuickChart** (Final Fallback): Generates simplified treemap visualizations when all screenshot services fail.

**Pure Rule-Based Parser (v4.3)**: 
- 100% accurate intent parsing without GPT dependencies
- Supports 21 global indices (SPX500, NIKKEI225, IBEX35, etc.)
- Multi-language region detection (日本→JP/NIKKEI225, Spain→ES/IBEX35)
- Sector filtering (technology, healthcare, finance, energy, etc.)
- Three-layer anti-leakage protection for Spain/IBEX35

**Provider Module** (`screenshotProviders.js`):
- Pluggable architecture with automatic fallback
- Error handling and retry logic
- Comprehensive logging for debugging
- Environment variable based configuration

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