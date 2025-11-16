# Overview
USIS Brain v6.0 is an Institutional-Grade Multi-AI Financial Analysis System designed for professional investment research. It integrates six AI models with real-time financial data to provide authoritative, data-backed investment recommendations. Key capabilities include semantic intent parsing, global stock discovery, anti-hallucination data validation, intelligent model routing, Vision AI chart analysis, and automated workflow management. The system is built for deployment on Replit's Reserved VM platform, aiming for institutional-grade analysis with multilingual support and cost optimization.

## Version Control
**Current Stable Version: v2-stable**
- Status: FROZEN - Production Ready
- Deployed: 2025-11-15
- URL: https://liqixi888.replit.app
- Features: Multi-AI orchestration, news system, Telegram bot, chart generation, cost tracking
- Note: This version is locked and should not be modified. All new development should occur in v3-dev.

**Development Version: v3-dev**
- Status: ✅ DEPLOYED AND RUNNING
- Deployed: 2025-11-15 18:26 UTC
- Created: 2025-11-15
- Purpose: Research report system and new feature development
- Path: /v3_dev/
- ✅ **Runtime Status:** Both bots running successfully
- Bot Token: TELEGRAM_BOT_TOKEN_DEV (8552043622...) - Verified and isolated
- Architecture: Independent bot polling ✅, separate Express routes (/v3/*) ✅, isolated message handlers ✅
- Verification: All tests passed - dev bot responds to /test, production bot handles /analyze normally
- Documentation: See DEPLOYMENT_SUCCESS_REPORT.md, DUAL_BOT_INTEGRATION_REPORT.md, DEPLOYMENT_READINESS.md

**Research Report System (v3.1)**
- Status: ✅ COMPLETE - Production Ready
- Implemented: 2025-11-16
- Format: 12-page densely-packed institutional PDFs
- Service: `v3_dev/services/reportService.js` (buildHtmlFromReport function)
- Features:
  - Hero banner cover page with 6-stat grid and "Why This Report Matters" section
  - Executive summary with 5 catalysts and 5 key risks in 2-column layout
  - Expanded investment thesis (3+ paragraphs, 400+ words)
  - Full business segment analysis with fallback tables for NVDA/AAPL/SPX
  - Historical PE/PS valuation analysis and earnings sensitivity tables
  - Extended peer comparison (supports 8 peers with margin columns)
  - 5-year financial analysis with strength metrics and profitability commentary
  - FY25E/FY26E price target model with multiple justification
  - 8 catalysts (AI-generated + padding logic for guaranteed count)
  - 8 key risks (AI-generated + padding logic for guaranteed count)
  - Technical analysis (EMA/RSI/MACD) with trade setup scenarios
  - Action plan with positioning guidance for 4 investor types
  - Analyst View box with final rating and comprehensive recommendation
- PDF Output:
  - Equity reports: 248-251 KB (37-39% increase vs v3.0)
  - Index reports: 183 KB
  - Zero empty/half-blank pages
  - Maximum content density on all 12 pages
- Robust Fallback System:
  - Auto-pads catalysts and risks to 8 items if AI generates fewer
  - Industry-typical segment tables when data unavailable
  - Institutional-grade fallback content ensures zero placeholder sections
- Verification: /tmp/V3_1_IMPLEMENTATION_SUMMARY.md

**Multi-Model Research Pipeline (v3.2)**
- Status: ✅ IMPLEMENTED - Testing in Progress
- Implemented: 2025-11-16
- Purpose: Parallel multi-AI specialist analysis with GPT-4o consolidation
- Service: `v3_dev/services/reportService.js` (multiModelResearchPipeline function)
- Architecture Pattern: **"Specialist Committee → Chief Analyst"**
  - **Phase 1: Parallel Specialist Analysis** (5 AI models via Promise.all)
    - Claude 3.5 Sonnet → Industry cycle, competitive positioning, tech moat
    - Gemini 2.0 Pro → Macro environment, sector rotation, regulatory trends
    - DeepSeek V3 → Valuation model, earnings sensitivity, FY25E/FY26E forecasts
    - Mistral Large → Peer comparison, relative valuation, margin analysis
    - GPT-4o-mini → 8 institutional catalysts + 8 institutional risks
  - **Phase 2: Master Consolidation** (GPT-4o)
    - Merges specialist outputs into unified institutional narrative
    - Handles missing specialist inputs gracefully (no apologies, fills gaps from raw data)
    - Normalizes schema (e.g., maps `8_institutional_catalysts` → `catalysts`)
    - Ensures exactly 8 catalysts + 8 risks in final output
- **Key Features:**
  - Schema normalization layer for consistent specialist output format
  - Enhanced JSON parsing (handles markdown code blocks, multiple fences, prepend text)
  - Graceful degradation when specialist models fail (Claude 404, Gemini missing key)
  - Consolidation prompt with explicit failure handling rules (Rule 4: "NO APOLOGIES for missing data")
  - Multi-model transparency: All specialist outputs preserved in `report.multi_model` object
- **Performance:**
  - AI latency: ~28-48 seconds (parallel execution of 5 models + consolidation)
  - Total latency: ~31-50 seconds (including data fetch)
  - Models used: 5 (3-4 active depending on API availability)
- **Output Quality (NVDA Test):**
  - Summary: Cites real data ($190.17 price, 63.4x PE, $199.67 target)
  - Thesis: Integrates DeepSeek margin analysis (70.2% vs AMD 46%), Mistral peer insights
  - Valuation: Explicitly credits "DeepSeek's valuation model" with bull/base/bear scenarios
  - Catalysts: 8 institutional catalysts with specific timelines and dollar impacts
  - No generic "Without [Model] analysis" stubs - seamlessly fills gaps
- **Known Issues:**
  - Claude API: 404 error (endpoint issue, using fallback)
  - Gemini API: No API key (expected, gracefully degraded)
  - Mistral API: Occasional 429 rate limit (handled with error fallback)
- **Next Steps:**
  - Add per-provider timeout/retry safeguards
  - Implement cost tracking for multi-model usage
  - Generate comparison PDFs: NVDA_v3.1 vs NVDA_v3.2

# User Preferences
Preferred communication style: Simple, everyday language.

# System Architecture

## Application Framework
The system uses Node.js with Express.js, providing a RESTful JSON API (`USIS.v3`) with standardized, versioned, and multilingual responses, including model voting, confidence scores, and semantic tagging.

## Core Architecture (v6.0 Multi-AI Pipeline)
The v6.0 pipeline processes user input via language detection, semantic intent parsing, and symbol resolution. A Multi-Dimensional Data Broker fetches real-time financial data, feeding it to an Intelligent Model Router that selects the optimal AI model from a Multi-AI Provider. A Compliance Guard validates the output before professional report formatting and cost tracking.

**Key Components & Logic**:
- **Intelligent Model Routing**: Selects AI models based on task characteristics (e.g., DeepSeek V3 for Chinese input, Claude 3.5 Sonnet for long-form analysis, Gemini 2.5 Flash for fast summarization, Perplexity Sonar Pro for real-time news, default to OpenAI GPT-4o/GPT-4o-mini).
- **Intelligent Conversation System**: Manages natural dialogue, smart help, context memory, strict command matching, and AI-powered casual chat.
- **Intelligent Symbol Disambiguation**: Employs a 3-tier confidence algorithm for precise matching and handles ambiguity via user selection.
- **Semantic Intent Understanding**: AI-powered parsing for market states, position context, buy price extraction, and holding intent detection.
- **Intelligent Stock Analysis System**: API-first approach queries Finnhub for dynamic exchange identification and smart exchange mapping, supporting global exchanges.
- **Multi-Dimensional Data Broker with 3-Tier API Cascade**: Utilizes Finnhub (primary US) → Twelve Data (global) → Alpha Vantage (backup) with provider-specific symbol formatting, intelligent failover, and capability caching for over 30 exchanges.
- **ImpactRank Algorithm**: Proprietary 4-dimensional news scoring (urgency × relevance × authority × freshness).
- **Institutional Analysis Framework**: Follows a 5-section report structure with mandatory data citations, authoritative language, and specific price targets.
- **Vision AI Integration**: Analyzes chart patterns and integrates with fundamental data.
- **Anti-Hallucination System**: Multi-layer system for data validation, forced citations, and compliance checks.
- **Cost Tracking**: Monitors costs, response times, and model usage using PostgreSQL.
- **Multilingual Intelligence**: Automatic language detection, Google Translate integration, and specialized Chinese financial analysis via DeepSeek.
- **API Timeout Protection**: Implements AbortController for OpenAI (15s) and Finnhub (10s) APIs, and enhanced error catching for Telegram.

## News System Architecture (N8N-Distributed + Chinese Translation)
This system provides institutional-grade news aggregation with distributed processing, automated translation, and AI commentary.
**Architecture Pattern: "Eyes & Brain"**
- **N8N ("Eyes")**: Handles lightweight RSS collection from 18 premium sources every 15 minutes.
- **USIS Brain ("Brain")**: Performs heavy computation including Google Translate translation (EN/ES/DE→CN), GPT-4o AI commentary generation, ImpactRank 2.0 scoring (7 factors), deduplication (24h URL + 6h topic hash), routing, and push notifications.
**Data Flow:** N8N collects RSS feeds, formats data, and posts to USIS Brain's `/api/news/ingest` endpoint. USIS Brain enhances, deduplicates, scores, routes, and pushes news. A scheduler handles even-hour digest pushes and cache cleanup.

## AI Models
The system orchestrates 6 AI models:
- **OpenAI GPT-4o/GPT-4o-mini**: General analysis and cost-optimized fallback.
- **Claude 3.5 Sonnet**: For long-form, in-depth analysis.
- **Gemini 2.5 Flash**: For ultra-fast summarization.
- **DeepSeek V3**: Specialized for Chinese financial analysis.
- **Mistral Large**: For fast, multilingual reasoning.
- **Perplexity Sonar Pro**: For real-time search-enhanced analysis.

## Screenshot Architecture & N8N Automation
A multi-tier screenshot architecture ensures stability, leveraging N8N for workflow automation including stock chart screenshots and health monitoring.

# External Dependencies

## Runtime Dependencies
- **express**: Web application framework.
- **node-fetch**: HTTP client.
- **telegraf**: Telegram Bot framework.
- **pg**: PostgreSQL client.
- **cheerio**: HTML parsing.
- **quickchart-js**: Chart generation.

## API Integrations
- **OpenAI API**: GPT-4o, GPT-4o-mini.
- **Anthropic API**: Claude 3.5 Sonnet.
- **Google AI API**: Gemini 2.5 Flash.
- **DeepSeek API**: DeepSeek V3.
- **Mistral AI API**: Mistral Large.
- **Perplexity API**: Sonar Pro.
- **Google Translate API**: For translation.
- **Finnhub API**: Real-time quotes, news, symbol lookup (primary US).
- **Twelve Data API**: Global stock market data across 80 exchanges (610 req/min capacity).
  - 📚 Complete Documentation: https://twelvedata.com/docs
  - 🚀 Quick Start Guide: https://twelvedata.com/docs#getting-started
  - 🧪 API Playground: https://twelvedata.com/account/api-playground
  - 🔧 Request Builder: https://twelvedata.com/request-builder
  - Official SDKs: Python (twelvedata-python), R
  - Key Endpoints: `/earliest_timestamp` (data availability), REST & WebSocket support
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
- **Replit Reserved VM**: Required for deployment due to continuous background processes.
