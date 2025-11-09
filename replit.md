# Overview

USIS Brain v6.0 is an Institutional-Grade Multi-AI Financial Analysis System designed for professional investment research. It orchestrates 6+ AI models (OpenAI GPT-4o, Claude 3.5, Gemini 2.5, DeepSeek V3, Mistral, Perplexity) with real-time data integration from sources like Finnhub, SEC, and FRED. Key features include semantic intent parsing, global stock discovery with 150+ stocks across 10+ markets, anti-hallucination data validation, intelligent model routing for specialized analysis, fully automated N8N workflow management, Vision AI chart analysis, and authoritative, data-backed investment recommendations. The system is built for deployment on Replit's Reserved VM platform and aims to deliver institutional-grade analysis with multilingual capabilities and cost optimization.

# 🔒 **STABLE VERSION LOCKED** - 2025-11-09

## ✅ Verified Working Features
- **Individual Stock Analysis**: AAPL, TSLA with K-line charts and technical indicators
- **Market Heatmap**: S&P 500 real-time heatmap generation
- **Intelligent Conversation**: Natural language understanding and intent recognition
- **No Duplicate Responses**: Single bot instance running correctly
- **Response Time**: 20-30 seconds (acceptable for AI analysis)

## 📊 Code Quality
- **Total Lines**: 15,200 lines (cleaned from 15,682)
- **Core Files**: 27 files
- **API Endpoints**: 18 (production-ready only)
- **Cleaned**: 40 test files + 5 test endpoints + 364 redundant lines removed

## ⚠️ **DO NOT MODIFY** (Critical Components)
The following components are working correctly and should NOT be modified without thorough testing:
1. `/brain/orchestrate` endpoint (index.js lines 3924-5052)
2. AI intent parsing with timeout protection (5s for parseUserIntent, 3s for resolveSymbols)
3. Symbol resolution system (symbolResolver.js)
4. Multi-AI provider orchestration (multiAiProvider.js)
5. Semantic intent agent (semanticIntentAgent.js)
6. Data broker with 3-tier API cascade (dataBroker.js)

## 🚀 Startup Command
```bash
ENABLE_TELEGRAM=true node index.js
```

## 🔧 Latest Fixes Applied
- **2025-11-09**: Added timeout protection to AI calls to prevent "socket hang up" errors
  - `parseUserIntent`: 5-second timeout with fallback to simple extraction
  - `resolveSymbols`: 3-second timeout with graceful degradation
- **2025-11-09**: Fixed duplicate bot responses (ensured single process instance)
- **2025-11-09**: Code cleanup (removed 500 lines of test/debug code)

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Application Framework
The system is built on Node.js with Express.js, using a CommonJS module system. It provides a RESTful JSON API with standardized, versioned (`USIS.v3`), and multilingual responses, including model voting details, confidence scores, and semantic tagging.

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
A multi-tier screenshot architecture ensures stability and graceful degradation.
- **N8N Webhook Integration**: Dedicated webhook for individual stock chart screenshots via ScreenshotAPI, returning binary data for AI analysis.
- **N8N Full API Automation**: Includes automatic workflow creation/activation, 5-minute health monitoring with self-healing capabilities, and graceful degradation if N8N is unavailable.
- **Tiered Screenshot Providers**: Heatmap system uses Tier 1 (SaaS-based N8N), Tier 2 (Browserless headless Chromium), and Tier 3 (QuickChart fallback) for various screenshot needs.
- **Critical Architecture Note**: N8N webhooks do not call back to USIS Brain APIs to prevent deadlocks.

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
- **Mistral API**: For Mistral Large.
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
- **Replit Reserved VM**: Required for deployment due to continuous background processes (Telegram Bot long polling, database connection pools, N8N scheduled tasks). Cloud Run is not suitable as it scales to zero without HTTP traffic.

# Recent Changes

## 2025-11-09: Critical Production Fix
- **Fixed**: Cloud Run deployment socket hang up error (Telegram Bot now uses external URL instead of localhost in production)
- **Fixed**: Missing technical analysis in Chinese requests (added Pivot Points calculation to multiLanguageAnalyzer)
- **Fixed**: "未包含技术图表分析" warning removed from all code paths
- **Architecture**: Telegram Bot auto-detects production environment via REPLIT_DEPLOYMENT=1
- **Verified**: Test endpoint `/test/v6-1-fix` returns specific support/resistance prices
- **Status**: Ready for republish to Cloud Run

## 2025-11-09: Stability & Cleanup Update
- **Fixed**: Socket hang up errors by adding timeout protection to AI calls
- **Fixed**: Duplicate bot responses (single process management)
- **Cleaned**: Removed 40 test files, 5 test endpoints, 364 lines of redundant code
- **Verified**: All core features working (stock analysis, heatmap, conversation)
