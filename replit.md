# Overview
USIS Brain v7.7 is an institutional-grade Multi-AI Financial Analysis System designed for professional investment research. It integrates six AI models with real-time financial data to provide authoritative, data-backed investment recommendations. Key capabilities include semantic intent parsing, global stock discovery, anti-hallucination data validation, intelligent model routing, Vision AI chart analysis, and automated workflow management. The system aims to provide institutional-grade analysis with multilingual support and cost optimization.

# User Preferences
Preferred communication style: Simple, everyday language.

# System Architecture

## Application Framework
The system uses Node.js with Express.js, providing a RESTful JSON API (`USIS.v3`) with standardized, versioned, and multilingual responses, including model voting, confidence scores, and semantic tagging.

## Core Architecture
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
- **Ticket Formatter**: Unified output formatting layer for "解票" feature with standard (CN/EN) and human voice modes, supporting bilingual and complete output combinations.
- **News System Architecture**: Provides institutional-grade news aggregation with distributed processing, automated translation, and AI commentary. Uses an "Eyes & Brain" architecture where N8N handles lightweight RSS collection, and USIS Brain performs heavy computation including translation, AI commentary generation, ImpactRank 2.0 scoring, deduplication, routing, and push notifications.
- **PDF Renderer**: Uses `services/puppeteerPdfRenderer.js` for watermark-free PDF generation with `v3_dev`'s `buildResearchReport` + `buildHtmlFromReport` for a complete 20-page institutional layout. Includes dynamic Chromium detection and fallback safety to PDFKit.
- **V6 Renderer Refactor**: New modular `services/v6Renderer.js` with 20 dedicated page renderers matching v3_dev structure and a `buildV6ReportData` schema for data normalization. Implements an exact V6 20-page layout with specific page components like an 8-Card KPI Grid and Valuation Framework Waterfall.
- **Multi-Language Output System**: Supports Spanish, Chinese, and English language formatting with flexible language mode parsing and automatic exchange detection. AI-first architecture with structured command parsing and AI semantic understanding as fallback.
- **V7.7 Research Report Pipeline**: 8-stage modular pipeline (Fetch → Validate → CollectCharts → GenerateCharts → Render → Enhance → Normalize → QA) with:
  - **Data Engine**: Retry logic (exponential backoff, 3 attempts), data validation with completeness scoring, 90-day price coverage and 5-year revenue/EPS requirements.
  - **Chart Engine**: 8 chart types including RSI (14-period) and MACD (12/26/9) with QuickChart API integration and null-URL filtering.
  - **QA Gate**: Final QA pass with auto-fix for undefined placeholders (replaced with company name), numeric overflow limiting (1-2 decimals), duplicate token removal, broken sentence repair, and chart availability validation before PDF export.

## AI Models
The system orchestrates 6 AI models:
- **OpenAI GPT-4o/GPT-4o-mini**: General analysis and cost-optimized fallback.
- **Claude 3.5 Sonnet**: For long-form, in-depth analysis.
- **Gemini 2.5 Flash**: For ultra-fast summarization.
- **DeepSeek V3**: Specialized for Chinese financial analysis.
- **Mistral Large**: For fast, multilingual reasoning.
- **Perplexity Sonar Pro**: For real-time search-enhanced analysis.

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