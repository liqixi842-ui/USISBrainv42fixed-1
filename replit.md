# Overview
USIS Brain v6.0 is an institutional-grade Multi-AI Financial Analysis System for professional investment research. It integrates six AI models with real-time financial data to provide authoritative, data-backed investment recommendations. Key capabilities include semantic intent parsing, global stock discovery, anti-hallucination data validation, intelligent model routing, Vision AI chart analysis, and automated workflow management. The system is built for deployment on Replit's Reserved VM platform, aiming for institutional-grade analysis with multilingual support and cost optimization. The system is currently stable at `v2-stable` for production, with `v3-dev` actively under development for new features.

# User Preferences
Preferred communication style: Simple, everyday language.

# System Architecture

## Core Architecture
The v6.0 pipeline processes user input via language detection, semantic intent parsing, and symbol resolution. A Multi-Dimensional Data Broker fetches real-time financial data, feeding it to an Intelligent Model Router that selects the optimal AI model. A Compliance Guard validates the output before professional report formatting and cost tracking.

### Key Components & Logic
- **Intelligent Model Routing**: Selects AI models based on task characteristics (e.g., DeepSeek V3 for Chinese, Claude 3.5 Sonnet for long-form, Gemini 2.5 Flash for summarization, Perplexity Sonar Pro for news, default to OpenAI GPT-4o/GPT-4o-mini).
- **Intelligent Conversation System**: Manages natural dialogue, context memory, and AI-powered casual chat.
- **Intelligent Symbol Disambiguation**: Employs a 3-tier confidence algorithm for precise matching.
- **Semantic Intent Understanding**: AI-powered parsing for market states, position context, and holding intent detection.
- **Intelligent Stock Analysis System**: API-first approach querying Finnhub for dynamic exchange identification and smart exchange mapping.
- **Multi-Dimensional Data Broker with 3-Tier API Cascade**: Utilizes Finnhub (primary US) → Twelve Data (global) → Alpha Vantage (backup) with intelligent failover for over 30 exchanges.
- **ImpactRank Algorithm**: Proprietary 4-dimensional news scoring (urgency × relevance × authority × freshness).
- **Institutional Analysis Framework**: Follows a 5-section report structure with mandatory data citations and authoritative language.
- **Vision AI Integration**: Analyzes chart patterns and integrates with fundamental data.
- **Anti-Hallucination System**: Multi-layer system for data validation, forced citations, and compliance checks.
- **Cost Tracking**: Monitors costs, response times, and model usage using PostgreSQL.
- **Multilingual Intelligence**: Automatic language detection and Google Translate integration.
- **API Timeout Protection**: Implements AbortController for OpenAI and Finnhub APIs, and enhanced error catching for Telegram.
- **Ticket Formatter (v6.0)**: Unified output formatting layer for "解票" feature with standard (CN/EN) and human voice modes.

## Supervisor Bot Architecture (v7.0)
The system uses a Supervisor Bot architecture with a single-process, multi-bot design. A main Supervisor Bot routes user messages based on intent to specialized worker bots (Analysis Bot, News Bot). This unifies stock analysis functions (ticket analysis and research reports) under a single Analysis Bot.

### Architecture Flow
```
User → Supervisor Bot (TELEGRAM_BOT_TOKEN) → Routes by intent → Worker Bots reply
   ├─ Intent: STOCK_QUERY / "解票" → Analysis Bot (runTicketJob)
   ├─ Intent: RESEARCH_REPORT / "研报" → Analysis Bot (runReportJob)
   ├─ Intent: NEWS / "新闻" → News Bot
   └─ Intent: CASUAL_CHAT / HELP → Supervisor Bot handles directly
```

### Deployment Guide (Production Server)
**Prerequisites**: Ensure production bot is stopped to avoid 409 Conflict errors
```bash
# 1. Stop existing bot instance
pm2 stop usis-brain

# 2. Pull v7.0 code
cd /root/usis-brain
git pull origin main

# 3. Verify environment variables
echo $TELEGRAM_BOT_TOKEN  # Should show: 7944498422...

# 4. Start with PM2
pm2 restart usis-brain

# 5. Monitor startup logs
pm2 logs usis-brain --lines 50 | grep -E "Telegraf|Bot polling|Ready"

# Expected output:
# ✅ [Telegraf] Bot polling started successfully!
# 💬 [Telegraf] Ready to receive messages
```

**Testing Checklist**:
- [ ] No 409 Conflict error in logs
- [ ] "✅ [Telegraf] Bot polling started successfully!" appears
- [ ] Send "解票 NVDA" → AnalysisBot responds with 3 messages (CN/EN/Human)
- [ ] Send "研报 TSLA" → AnalysisBot generates institutional report
- [ ] Send casual message → SupervisorBot provides help/info

**Troubleshooting**:
- `409 Conflict`: Another bot instance is running. Stop all instances with `pm2 delete all`, then restart
- `Missing token`: Check `.env` file has `TELEGRAM_BOT_TOKEN=...`
- `OOM errors`: Reserved VM required (2GB+ RAM), standard Replit dev environment insufficient

## News System Architecture
This system provides institutional-grade news aggregation with distributed processing, automated translation, and AI commentary. It uses an "Eyes & Brain" architecture where N8N handles lightweight RSS collection, and USIS Brain performs heavy computation including translation, AI commentary, ImpactRank 2.0 scoring, deduplication, routing, and push notifications.

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
- **OpenAI API**
- **Anthropic API**
- **Google AI API**
- **DeepSeek API**
- **Mistral AI API**
- **Perplexity API**
- **Google Translate API**
- **Finnhub API**: Real-time quotes, news, symbol lookup.
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