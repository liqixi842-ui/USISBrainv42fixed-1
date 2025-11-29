# Overview
USIS Brain v7.5 is an institutional-grade Multi-AI Financial Analysis System designed for professional investment research. It integrates six AI models with real-time financial data to provide authoritative, data-backed investment recommendations. Key capabilities include semantic intent parsing, global stock discovery, anti-hallucination data validation, intelligent model routing, Vision AI chart analysis, and automated workflow management. The system aims to provide institutional-grade analysis with multilingual support and cost optimization.

# Recent Changes (v7.5 - November 2025)
- **Morgan Stanley Format Overhaul**: Investment Thesis restructured to 400-500 word bullet-point format (down from 600-700), matching institutional sell-side standards
- **Strict 3-Item Catalyst/Risk Limits**: All upstream processors (riskCatalystEngine, riskCatalystCleaner, reportService) now enforce maxItems=3 with no auto-fill padding
- **Enhanced Duplicate Detection**: Pattern `\b(\w+)\s+\1\b` catches all word lengths including short words like "we we"
- **Academic Phrase Control**: limitAcademicPhrases() now enforced in both cleanText and cleanTextLight paths (max 3 occurrences of "we believe", "going forward")
- **Company Overview Redesigned**: Data-driven bullet structure focusing on segments, TAM, growth drivers instead of Wikipedia-style history
- **Industry Analysis Bullets**: Prompts require specific data (TAM CAGR, capex) in bullet format
- **Page 10 Risk Table**: Probability/Impact/Horizon table format with color-coded badges
- **Valuation Enhanced (Page 5)**: Added 5Y percentile calculation, PEG ratio, Growth-Valuation Assessment, Rate Sensitivity Analysis table with stock duration sensitivity
- **Financial Health Enhanced (Page 7)**: Added FCF Conversion rate, Capital Structure & Allocation table (Debt/Equity, Interest Coverage, Capex Intensity, Capital Return Policy) with safe null guards
- **Technical Analysis Enhanced (Page 11)**: Technical Summary table with Trend Bias, Momentum, Volatility, 52W Position columns; Key Technical Levels table with support/resistance
- **Trade Setup Enhanced (Page 11)**: Breakout/Pullback/Mean Reversion scenarios with R/R ratio calculation, Trigger Signals, Time Windows
- **Action Plan Enhanced (Page 12)**: Conviction/Timing/Why Now summary table at top; all fallbacks pass through cleanText+limitAnalystMentions pipeline
- **Peer Comparison Fixed**: Uses aggregate peer average for premium/discount calculation instead of just first peer

# Previous Changes (v7.4.1 - November 2025)
- **Page 6-9 Duplicate Content Fix**: Each page (Valuation Snapshot, Framework, Peer Comparison, Financial Health) now generates unique data-driven commentary with null guards
- **Duplicate Word Detection Stabilized**: Fixed infinite loop issue with 3-pass cap and safe patterns only
- **Analyst Mention Limiter**: limitAnalystMentions() wired into thesis generation, limits to max 3 mentions replacing extras with "our team"
- **Conservative Catalyst/Risk Phrasing**: Exaggerated projections replaced (not deleted) with professional wording (e.g., "15-20% growth" → "potential expansion")
- **Business Overview Restored**: Full company_overview narrative preserved when available, structured segment table added

# Previous Changes (v7.4 - November 2025)
- **Report Quality Improvements**: Major text quality enhancements addressing AI-generated content issues
- **textCleanerEngine v2.0**: Enhanced duplicate word detection, 20+ AI cliché removals, paragraph length control (max 180 words), cross-paragraph deduplication
- **Concise Prompts**: Thesis reduced from 900-1000 to 600-700 words, valuation from 700 to 450-500 words, with strict anti-duplication rules
- **Cross-Field Deduplication**: New function prevents same content appearing in multiple report sections (thesis, valuation, macro)
- **Improved Catalysts/Risks**: Prompts now prohibit dollar amounts/percentage projections, shorter bullet points (30-50 words)
- **Sell-Side Style Rules**: Enforced professional tone, limited analyst mentions (max 3), prohibited filler phrases

# Previous Changes (v7.3 - November 2025)
- **Puppeteer PDF Renderer**: New `services/puppeteerPdfRenderer.js` replaces DocRaptor for watermark-free PDF generation
- **V3_dev HTML Template Integration**: Uses v3_dev's `buildResearchReport` + `buildHtmlFromReport` for complete 20-page institutional layout
- **Dynamic Chromium Detection**: `findChromiumPath()` auto-detects Chromium via PATH, env var, or Nix store fallback
- **Fallback Safety**: phase6Enhancer falls back to PDFKit renderer if Puppeteer fails, ensuring report generation continuity
- **Test Verified**: Successfully generates 806KB, 20-page institutional PDFs for stock analysis

# Previous Changes (v7.2 - November 2025)
- **V6 Renderer Refactor Complete**: New modular `services/v6Renderer.js` with 20 dedicated page renderers matching v3_dev structure
- **buildV6ReportData Schema**: Complete V6 data normalization including kpi (16 metrics), consensus block, valuation_framework with drivers, glossary, rating_definitions, analyst_view
- **Exact V6 20-Page Layout**: Cover → Key Takeaways+KPI → Investment Thesis → Segments → Industry/Macro → Valuation Snapshot → Valuation Framework → Peers → Financials → Financial Trends → Catalysts → Risks → Technical Analysis → Strategy → Detailed Metrics → Methodology → Disclosures → Glossary → Rating Definitions → Analyst View
- **Page Controller Flow**: renderPage() helper ensures renderInstitutionalHeader and renderPageFooter on pages 2-20
- **8-Card KPI Grid**: Page 2 renders 2x4 KPI cards (PE TTM/Fwd, P/S, P/B, EV/EBITDA, Div Yield, ROE, Beta) plus consensus quick stats
- **Valuation Framework Waterfall**: Page 7 includes value drivers table with impact indicators
- **Complete Appendices**: Pages 15-20 render detailed metrics, methodology, disclosures, glossary entries, rating definitions with color coding, and analyst certification
- **Assets Wiring**: klineChart and financialCharts properly passed through renderV6InstitutionalPdf to page renderers
- **Custom Firm/Analyst Names**: `研报PDF SYMBOL, FirmName, AnalystName, language` command supports custom branding
- **Default Branding**: Falls back to "USIS Research" and "USIS Brain v7.0 Multi-AI System" when not specified

# Previous Changes (v7.1 - November 2025)
- **Multi-Language Output System**: Added Spanish language formatter (formatTicketStandardES) alongside Chinese and English
- **Flexible Language Mode Parsing**: parseLanguageMode() supports natural language inputs like "双语", "中文和西语", "三语"
- **Exchange-Prefix Handling**: STEP 1.5 parses "西班牙col" → "BME:COL" with automatic exchange detection
- **Command Normalization**: STEP 0 normalizes connected commands ("解票AAPL" → "解票 AAPL")
- **AI-First Architecture Restored**: Structured command parsing runs first, AI semantic understanding as fallback only

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