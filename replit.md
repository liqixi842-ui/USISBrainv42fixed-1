# Overview
USIS Brain v6.0 is an institutional-grade Multi-AI Financial Analysis System designed for professional investment research. It integrates six AI models with real-time financial data to provide authoritative, data-backed investment recommendations. Key capabilities include semantic intent parsing, global stock discovery, anti-hallucination data validation, intelligent model routing, Vision AI chart analysis, and automated workflow management. The system is built for deployment on Replit's Reserved VM platform, aiming for institutional-grade analysis with multilingual support and cost optimization.

The system is currently stable at `v2-stable` for production, with `v3-dev` actively under development for new features like a comprehensive research report system (v3.1), a multi-model research pipeline (v3.2), and a professional correction layer (v4.0) to refine AI-generated text.

## Recent Changes (Jan 20, 2025)

### v7.0 Direct V6 Engine Integration for Ticket Analysis
**Status**: ✅ Fully Implemented, Ready for Testing

**Critical Architecture Change**: V7 解票功能 now directly calls V6's complete `buildResearchReport()` engine instead of making HTTP API calls. This ensures the full data pipeline is utilized.

**Before (V6.5.2)**:
```
handleTicketAnalysis → HTTP GET /v3/report/{symbol}?format=json → ticketFormatter
```

**After (V7.0)**:
```
handleTicketAnalysis → buildResearchReport() → FinancialDataBroker 
                     → Finnhub/Twelve/Alpha (3-tier cascade)
                     → HistoryChartEngine (5Y charts)
                     → TechnicalEngine (indicators)
                     → ticketFormatter (6-section output)
```

**Key Benefits**:
1. **Complete Data Pipeline**: Now uses FinancialDataBroker's 3-tier API cascade (Finnhub → Twelve Data → Alpha Vantage)
2. **Real-Time Financial Data**: Direct access to quote, metrics, financials, 5Y history
3. **Technical Analysis**: Full TechnicalEngine indicators calculation
4. **Chart Generation**: HistoryChartEngine generates 5-year revenue/EPS trends
5. **No HTTP Overhead**: Eliminates API call latency and timeout risks

**V6 Core Engine Components Now Used**:
- ✅ Phase 1: FinancialDataBroker.getAll() - Multi-source data aggregation
- ✅ Phase 2: multiModelResearchPipeline() - 6 AI models analysis
- ✅ Phase 2.5: HistoryChartEngine.generateAllCharts() - Historical charts
- ✅ Phase 2.6: TechnicalEngine.generateTechnicalIndicatorsData() - Tech indicators
- ✅ Phase 3: Report assembly with complete ResearchReport v3.2 schema

**Files Modified**:
- `v3_dev/services/devBotHandler.js` - Refactored handleTicketAnalysis() to call buildResearchReport() directly

**Output Modes** (unchanged):
- `解票 NVDA` - Standard CN
- `解票 NVDA 双语` - CN + EN
- `解票 NVDA 聊天版` - Human voice
- `解票 NVDA 完整版` - All formats

---

### v6.5.2 Three-Bot Architecture - Manager Bot Message Routing
**Status**: ✅ Fully Implemented, Production Deployed

**Critical Architecture Change**: Implemented strict three-bot separation with centralized message routing to eliminate duplicate responses and enforce bot specialization.

**Architecture**:
```
User → Manager Bot (@qixizhuguan_bot) → Routes by command → Specialized Bot replies
   ├─ "解票 SYMBOL" → Research Bot (@qixijiepiao_bot)
   ├─ "研报, ..." → Research Bot (@qixijiepiao_bot)
   └─ News delivery → News Bot (@chaojilaos_bot) (automated only)
```

**Key Changes**:
1. **Manager Bot (NEW)**: Central message router listening to ALL user messages
   - Intelligent command detection with regex pattern matching
   - Safe stock symbol extraction with keyword blacklist (START, HELP, etc.)
   - Mode parsing: maps user input to exact formats (标准版, 双语, 聊天版, 完整版)
   - Routes to specialized bots via external handler registration

2. **Token Separation**: Each bot uses dedicated Telegram token
   - MANAGER_BOT_TOKEN (@qixizhuguan_bot) - listens only
   - RESEARCH_BOT_TOKEN (@qixijiepiao_bot) - replies only
   - NEWS_BOT_TOKEN (@chaojilaos_bot) - automated news only
   - Startup validation ensures all tokens are present and unique

3. **Legacy Poller Disabled**: Old RESEARCH_BOT direct polling disabled when Manager Bot is active
   - Prevents duplicate responses
   - Single entry point for all user interactions

**Files Created**:
- `manager-bot.js` - Manager Bot class with message routing logic
- `bots_registry.json` - Bot metadata registry
- `DEPLOYMENT_v6.5.2.md` - Deployment guide and testing procedures

**Files Modified**:
- `index.js` - Added Manager Bot startup, token validation, legacy poller gating
- `v3_dev/services/devBotHandler.js` - Exported handleTicketAnalysis for routing integration

**Architect Reviews**: 3 reviews passed
- ✅ extractStockSymbol keyword filtering
- ✅ Token separation and validation
- ✅ Mode parsing alignment with handleTicketAnalysis

---

### v6.0 Ticket Formatter - 解票功能统一输出层
**Status**: ✅ Fully Implemented, Ready for Testing

**New Feature**: Unified output formatting layer for "解票/股票分析" (ticket analysis) with three professional output formats:
1. **Standard CN/EN**: 6-section technical analysis (Trend/Levels/Patterns/Indicators/Signals/Risks)
2. **Human Voice**: Natural trader talk style, avoiding AI-like language

**Output Modes**:
- Standard: Single language (CN or EN)
- Bilingual: CN + EN (2 messages)
- Human: Conversational style (CN or EN)
- Complete: CN + EN + Human (3 messages)

**Key Features**:
- ✅ Asset-type aware (equity/index/etf/crypto)
- ✅ Short sentences, NO long paragraphs
- ✅ Smart fallback for missing data (never shows "Analysis not available")
- ✅ Telegram character limit protection (<2500 chars)
- ✅ Multi-message sequential delivery with rate limiting

**Telegram Commands**:
- `解票 NVDA` - Standard CN
- `解票 NVDA 双语` - CN + EN
- `解票 NVDA 聊天版` - Human voice
- `解票 NVDA 完整版` - All formats

**Files Created**:
- `v3_dev/services/v5/ticketFormatter.js` - Core formatter module
- `v3_dev/V6.0_TICKET_FORMATTER.md` - Complete documentation

**Files Modified**:
- `v3_dev/services/devBotHandler.js` - Added handleTicketAnalysis() and command routing

---

### v5.2 Critical Fix - Eliminated "Analysis not available." Bug
**Status**: ✅ Architect-Approved, Production Ready

**Problem Fixed**: AI generation failures previously caused empty content sections showing "Analysis not available." in Investment Thesis, Company Overview, Industry Trends, and Macro Environment sections.

**Solution Implemented**: Three-layer content protection system:
1. Primary AI generation with institutional prompts
2. Retry with exponential backoff
3. **NEW**: Data-driven fallback generation using real report data

**All 5 sections now guaranteed to display substantive content (400-1000+ chars) even when AI fails:**
- Investment Thesis: Uses actual report.rating, revenue, margins, price targets
- Company Overview: Business model, segment breakdown, operational metrics
- Valuation Analysis: Multiple-based framework with conditional data display
- Industry Trends: Industry structure, competition, regulatory outlook
- Macro Environment: Fed policy, FX, fiscal developments, technicals

**Key Improvements:**
- ✅ Fixed hardcoded "BUY rating" bug - now uses actual report.rating
- ✅ Fixed misleading "$0" displays - conditional logic omits missing metrics
- ✅ Added analyst voice attributions (2-4 per section)
- ✅ Removed prohibited words (compelling, attractive, supportive)
- ✅ All fallbacks use institutional sell-side language

**Files Modified**: `v3_dev/services/v5/writerStockV3.js`, `v3_dev/V5.2_CRITICAL_FIX.md`

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
- **🆕 Ticket Formatter (v6.0)**: Unified output formatting layer for "解票" feature with standard (CN/EN) and human voice modes, supporting bilingual and complete output combinations.

## News System Architecture (N8N-Distributed + Chinese Translation)
This system provides institutional-grade news aggregation with distributed processing, automated translation, and AI commentary. It uses an "Eyes & Brain" architecture where N8N handles lightweight RSS collection, and USIS Brain performs heavy computation including translation, AI commentary generation, ImpactRank 2.0 scoring, deduplication, routing, and push notifications.

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
- **Replit Reserved VM**: Required for deployment due to continuous background processes.