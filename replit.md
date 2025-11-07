# Overview

USIS Brain v6.0 is an Institutional-Grade Multi-AI Financial Analysis System designed for professional investment research. It orchestrates 6+ AI models (OpenAI GPT-4o, Claude 3.5, Gemini 2.5, DeepSeek V3, Mistral, Perplexity) with real-time data integration from sources like Finnhub, SEC, and FRED. Key features include semantic intent parsing, **global stock discovery with 150+ stocks across 10+ markets**, anti-hallucination data validation, intelligent model routing for specialized analysis (e.g., Chinese financial analysis via DeepSeek), **fully automated N8N workflow management**, Vision AI chart analysis, and authoritative, data-backed investment recommendations. The system is built for deployment on Replit's Autoscale platform and aims to deliver institutional-grade analysis with multilingual capabilities and cost optimization.

## Recent Updates (Nov 2025)
- ✅ **TRUE Global Stock Support via Multi-API Cascade** (Nov 7, 2025):
    - **Provider-Specific Symbol Conversion**: Intelligent format adaptation for each API (Finnhub uses exchange prefixes like `BME:GRF`, Alpha Vantage uses suffixes like `GRF.MC`)
    - **30+ Exchange Coverage**: Comprehensive mapping for Europe (BME, EPA, LSE, FRA, MIL, etc.), Asia-Pacific (SSE, SZSE, HKEX, TSE, SGX, etc.), and North America (TSX, TSXV, NYSE, NASDAQ, OTC)
    - **Automatic Failover**: When Finnhub returns `c===0` (unsupported stock), system automatically cascades to Alpha Vantage with correct symbol format
    - **No Hardcoded Limitations**: All global stocks can be analyzed dynamically without whitelists or blacklists
- ✅ **Smart Interactive Symbol Selection**: When ambiguous symbols detected (e.g., SAB), system returns all valid options via Telegram inline keyboard for user selection
    - API-driven candidate discovery (no static mappings for short codes)
    - Multi-market support (European, Asian, OTC, ADR all available)
    - Smart scoring algorithm prioritizes exact matches and Common Stock types
- ✅ **Intelligent Stock Analysis (Not Workflow Nodes)**: Removed hardcoded stock lists; system now queries Finnhub API in real-time to identify any stock's exchange (CVX→"NEW YORK STOCK EXCHANGE"→NYSE:CVX), making it a true intelligent analyst instead of a rule-based workflow executor
- ✅ **Global Stock Coverage Expansion**: Extended from 44 to 150+ stocks across Americas, Europe, Asia-Pacific, and emerging markets
- ✅ **N8N Full API Automation**: Implemented automatic workflow creation, health monitoring (5-min intervals), and self-healing capabilities
- ✅ **Symbol Disambiguation Algorithm**: Longest-match-first strategy prevents conflicts between dual-listed stocks (e.g., BABA vs 9988.HK)

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Application Framework
The system is built on Node.js with Express.js, using a CommonJS module system. It provides a RESTful JSON API with standardized, versioned (`USIS.v3`), and multilingual responses, including model voting details, confidence scores, and semantic tagging.

## Core Architecture (v6.0 Multi-AI Pipeline)
The v6.0 pipeline processes user input through language detection, semantic intent parsing, and symbol resolution. A Multi-Dimensional Data Broker fetches real-time financial data, which then feeds into an Intelligent Model Router. This router selects the optimal AI model from a Multi-AI Provider, after which a Compliance Guard validates the output before professional report formatting and cost tracking.

**Key Components & Logic**:
- **Intelligent Model Routing**: Selects AI models based on task characteristics:
    - Chinese input + stock symbols → DeepSeek V3
    - Long-form depth analysis → Claude 3.5 Sonnet
    - Fast summarization → Gemini 2.5 Flash
    - Real-time news → Perplexity Sonar Pro
    - Default/fallback → OpenAI GPT-4o/GPT-4o-mini
- **Semantic Intent Understanding**: AI-powered parsing for various market states (premarket, intraday, news).
- **Intelligent Stock Analysis System**: 
    - **API-First Approach**: Queries Finnhub `/stock/profile2` endpoint to dynamically identify exchange for any stock symbol
    - **Smart Exchange Mapping**: Keyword-based mapping (e.g., "NEW YORK STOCK EXCHANGE" → NYSE, "NASDAQ NMS" → NASDAQ) supports global exchanges (HKEX, TSE, LSE, XETRA, TSX, etc.)
    - **Graceful Degradation**: Falls back to default values if API query fails
    - **Zero Hardcoding**: No predefined stock lists; handles any symbol including newly IPO'd companies
- **Global Stock Discovery (Legacy)**: Multi-language stock symbol resolution with 150+ global stocks:
    - **Americas**: 40 US stocks (AAPL, TSLA, NVDA, etc.) + 3 Latin America (VALE, PBR, AMX)
    - **Europe**: 26 stocks across UK (HSBC, BP), Germany (SIEGY, SAP), France (LVMUY, TTE), Netherlands (ASML, PHG), Switzerland (NSRGY, NVS), Spain (IBE.MC, TEF.MC)
    - **Asia-Pacific**: 11 Japan (TM, SONY), 4 Korea (SSNLF, HYMTF), 17 China/HK (BABA, 0700.HK), 4 other (INFY, DBSDY)
    - **Other**: 5 global stocks (BHP, RIO, RY, BNS, NPSNY)
    - **Disambiguation**: Longest-match-first algorithm resolves dual-listed stocks (e.g., '阿里巴巴'→BABA, '阿里港股'→9988.HK)
- **Multi-Dimensional Data Broker with Multi-API Cascade**: 
    - **Dual-Provider Architecture**: Finnhub (primary) → Alpha Vantage (fallback) for true global coverage
    - **Provider-Specific Symbol Format**: Automatically converts symbols for each API (e.g., `BME:GRF` for Finnhub, `GRF.MC` for Alpha Vantage)
    - **Smart Failover**: Detects Finnhub limitations (`c===0`) and automatically cascades to Alpha Vantage
    - **30+ Exchange Support**: Europe (BME, EPA, LSE, FRA, etc.), Asia-Pacific (SSE, SZSE, HKEX, TSE, SGX, etc.), North America (TSX, TSXV, NYSE, NASDAQ, OTC)
    - **120s Cache TTL**: Optimized API call efficiency with data provenance and completeness scoring
- **ImpactRank Algorithm**: Proprietary 4-dimensional news scoring (urgency × relevance × authority × freshness).
- **Institutional Analysis Framework**: Follows a 5-section report structure (Executive Summary, Quantitative Data, Investment Themes, Risk Assessment, Actionable Recommendations) with mandatory data citations, authoritative language, and specific price targets.
- **Vision AI Integration**: Analyzes chart patterns and fuses with fundamental data.
- **Anti-Hallucination System**: A multi-layer system to prevent AI from fabricating data, involving data validation, forced citations, and compliance checks.
- **Cost Tracking**: Monitors costs, response times, and model usage using PostgreSQL.
- **Multilingual Intelligence**: Automatic language detection, DeepL integration for translation, and specialized Chinese financial analysis via DeepSeek.

## AI Models
The system orchestrates 6 AI models:
- **OpenAI GPT-4o/GPT-4o-mini**: General analysis and cost-optimized fallback.
- **Claude 3.5 Sonnet**: For long-form, in-depth analysis.
- **Gemini 2.5 Flash**: For ultra-fast summarization.
- **DeepSeek V3**: Specialized for Chinese financial analysis.
- **Mistral Large**: For fast, multilingual reasoning.
- **Perplexity Sonar Pro**: For real-time search-enhanced analysis.

## Screenshot Architecture & N8N Automation
A multi-tier screenshot architecture ensures stability and graceful degradation:
- **N8N Webhook Integration**: Dedicated stock_analysis_full webhook endpoint for individual stock chart screenshots. N8N only handles screenshot capture via ScreenshotAPI and returns binary data; AI analysis is performed by USIS Brain after receiving the screenshot to avoid circular dependencies and deadlocks.
- **N8N Full API Automation** (n8nClient.js, n8nMonitor.js):
    - Automatic workflow creation/activation on startup
    - Health monitoring every 5 minutes (success rate calculation)
    - Self-healing: Auto-restart after 3 consecutive failures (<50% success rate)
    - Graceful degradation: N8N unavailability doesn't block main service
    - /health endpoint includes N8N status with 30s cache
- **Heatmap System - Tier 1 (Primary)**: SaaS-based N8N screenshot with delays and element waiting for market heatmaps.
- **Tier 2 - Browserless (Enhancement)**: Cloud-based headless Chromium for complex UI interactions.
- **Tier 3 - QuickChart (Fallback)**: Generates simplified bar charts when other services fail.
A pure rule-based parser supports 21 global indices with multi-language region detection and sector filtering.

**Critical Architecture Note**: The stock screenshot workflow is intentionally simplified to prevent deadlocks. N8N webhooks must NOT call back to USIS Brain APIs during execution, as USIS Brain is waiting for the webhook response, creating a circular wait condition.

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
- **Finnhub API**: Real-time quotes, news, and symbol lookup.
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
- **Replit**: Platform for deployment.