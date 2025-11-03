# Overview

USIS Brain v3 is an intelligent AI market analysis orchestration system featuring 6-model collaboration (Claude, DeepSeek, GPT-4, Gemini, Perplexity, Mistral), real-time market data integration (Finnhub, Alpha Vantage), and intelligent synthesis. The system understands natural language intent (premarket/intraday/postmarket/diagnose/news), coordinates specialized AI agents with differentiated roles, provides scene-aware content depth, and delivers dual output styles: warm conversational tone for private chats and professional team commentary for groups. Designed for deployment on Replit's Autoscale platform with minimal dependencies.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Application Framework
- **Technology**: Node.js with Express.js (v5.1.0)
- **Module System**: CommonJS (using `require()` instead of ES modules)
- **Rationale**: CommonJS ensures maximum compatibility with Replit's runtime environment and traditional Node.js tooling

## API Design
- **Pattern**: RESTful JSON API
- **Endpoints**:
  - `GET /` - Root health check (returns "OK")
  - `GET /health` - Service health monitoring with timestamp and service name
  - `POST /brain/decide` - Multi-model voting decision endpoint (v3)
  - `POST /brain/intent` - Natural language intent recognition endpoint (v3)
- **Response Structure**: Standardized format with versioning (`USIS.v3`), multilingual output, model voting details, confidence scores, and semantic tagging
- **Rationale**: Clean separation between health monitoring, decision-making, and intent parsing; structured responses enable easy integration with frontend systems and n8n workflows

## Server Configuration
- **Port Binding**: Dynamic port allocation via `process.env.PORT || 3000`
- **Host**: Binds to `0.0.0.0` for external accessibility
- **Rationale**: Replit requires dynamic port binding from environment variables; `0.0.0.0` binding allows external HTTP access through Replit's proxy system

## Current Implementation (v3 Orchestrator)
- **Status**: Production-ready with 6-AI orchestration and real-time data integration
- **Orchestration Pipeline**: Intent → Scene → Data Collection → Multi-AI Analysis → Intelligent Synthesis
- **AI Models** (6 specialized agents):
  - **Claude 3.5 Sonnet**: Technical analysis expert (indicators, price levels, trends)
  - **DeepSeek Chat**: Chinese market insights (sentiment, local news, A-share analysis)
  - **GPT-4**: Comprehensive strategy analyst (synthesis, risk assessment, recommendations)
  - **Gemini Pro**: Real-time data integration specialist (breaking news, market events)
  - **Perplexity**: Deep research and context analysis (industry trends, competitive landscape)
  - **Mistral Large**: Sentiment analysis and risk modeling (market psychology, volatility)
- **Data Empire** (Real-time market intelligence):
  - **Finnhub API**: Real-time stock quotes, company news, market sentiment analysis
  - **Alpha Vantage API**: Technical indicators, news sentiment, fundamentals
  - Parallel data collection with automatic enrichment of AI prompts
- **Intelligent Synthesis**:
  - Key point extraction from all 6 AI outputs
  - Consensus/divergence identification
  - Coherent unified report generation (not simple concatenation)
  - Dual output styles: warm teacher (private) vs professional team (group)
- **Scene-Aware Content**:
  - Premarket: Brief (~300 words) - quick scanning
  - Hot news/Intraday: Medium (~500 words) - balanced analysis
  - Postmarket/Review: Deep (~800 words) - comprehensive insights
- **Memory Layer**: User preferences for depth and tone adjustment

## Internationalization
- **Approach**: Built-in multilingual responses (Chinese `zh`, Spanish `es`, English `en`)
- **Auto-detection**: Intent endpoint automatically detects language based on character patterns
- **Rationale**: Core requirement for international market analysis; embedded in response structure rather than separate i18n layer for simplicity

## Observability
- **Logging**: Console-based request logging with emoji markers for visual parsing (🧠, 🎯, ✅, ❌)
- **Metrics**: Responses include confidence scores, model voting details, and timestamps
- **Rationale**: Simple observability suitable for development phase; console logs visible in Replit monitoring

# External Dependencies

## Runtime Dependencies
- **express**: ^5.1.0 - Web application framework providing routing, middleware, and HTTP utilities
- **node-fetch**: ^2.x - HTTP client for API calls (v2 for CommonJS compatibility)

## API Integrations (6 AI Models + 2 Data Sources)
- **Claude API** (Anthropic): `CLAUDE_API_KEY` - Technical analysis expert
  - Model: claude-3-5-sonnet-20241022
  - Role: Price levels, technical indicators, trend analysis
- **DeepSeek API**: `DEEPSEEK_API_KEY` - Chinese market specialist
  - Model: deepseek-chat
  - Role: A-share sentiment, local news, Chinese market insights
- **OpenAI API**: `OPENAI_API_KEY` - Comprehensive strategist
  - Model: gpt-4
  - Role: Risk assessment, synthesis, strategic recommendations
- **Google Gemini API**: `GEMINI_API_KEY` - Real-time data integrator
  - Model: gemini-1.5-pro
  - Role: Breaking news, market events, real-time context
- **Perplexity API**: `PERPLEXITY_API_KEY` - Deep research analyst
  - Model: llama-3.1-sonar-large-128k-online
  - Role: Industry trends, competitive landscape, context analysis
- **Mistral API**: `MISTRAL_API_KEY` - Sentiment & risk modeler
  - Model: mistral-large-latest
  - Role: Market psychology, volatility analysis, risk modeling
- **Finnhub API**: `FINNHUB_API_KEY` - Real-time market data
  - Provides: Stock quotes, company news, sentiment analysis
- **Alpha Vantage API**: `ALPHA_VANTAGE_API_KEY` - Technical data
  - Provides: Technical indicators, news sentiment, fundamentals

## Deployment Environment
- **Platform**: Replit
- **Constraints**: Must use dynamic port allocation and CommonJS module system
- **Network**: Relies on Replit's built-in HTTPS proxy for external access
- **Environment Variables**: All 8 API keys must be configured in Replit Secrets

# API Endpoints Detail

## POST /brain/decide
**Purpose**: Multi-model voting decision for market analysis

**Request**:
```json
{
  "task": "分析特斯拉股票走势"
}
```

**Response**:
```json
{
  "version": "USIS.v3",
  "task": "分析特斯拉股票走势",
  "final_text": {
    "zh": "Claude（HOLD，55%）：...\n\nDeepSeek（HOLD，55%）：...",
    "es": "Voto final: HOLD. Confianza: 55%."
  },
  "models": [
    {"name": "Claude", "output": "...", "vote": "HOLD", "confidence": 0.55},
    {"name": "DeepSeek", "output": "...", "vote": "HOLD", "confidence": 0.55}
  ],
  "decision": {
    "vote": "HOLD",
    "confidence": 0.55,
    "reasons": ["Claude: HOLD", "DeepSeek: HOLD"]
  },
  "tags": ["market/open", "vote"],
  "ts": 1761929262455
}
```

## POST /brain/intent
**Purpose**: Extract intent (mode, symbols, language) from natural language

**Request**:
```json
{
  "text": "帮我盘中看看 NVDA 和 TSLA 今天热点",
  "allow": ["premarket", "intraday", "postmarket", "diagnose", "news"],
  "lang": "zh"
}
```

**Response**:
```json
{
  "version": "USIS.v3",
  "mode": "intraday",
  "symbols": ["NVDA", "TSLA"],
  "lang": "zh",
  "echo": "帮我盘中看看 NVDA 和 TSLA 今天热点"
}
```

**Supported Modes**:
- `premarket` - Pre-market analysis (盘前)
- `intraday` - Live market analysis (盘中)
- `postmarket` - After-hours review (复盘/收盘)
- `diagnose` - Individual stock diagnosis (解票/诊股)
- `news` - News and updates (新闻/资讯)

## POST /img/imagine
**Purpose**: Generate images using Replicate's Flux Schnell model

**Request**:
```json
{
  "prompt": "A cinematic finance poster with charts",
  "ratio": "16:9"
}
```

**Response (Success)**:
```json
{
  "ok": true,
  "image_url": "https://replicate.delivery/xezq/..."
}
```

**Response (Error)**:
```json
{
  "ok": false,
  "error": "MISSING_TOKEN",
  "raw": {...}
}
```

**Features**:
- Automatic prompt cleaning (removes line breaks, tabs, excess whitespace)
- Supports aspect ratios: `16:9`, `1:1`, `9:16`, `4:3`, `3:4`
- Fast generation (~2-4 seconds)
- Comprehensive error handling with detailed error messages
- Environment variable validation on startup

**Error Codes**:
- `MISSING_TOKEN` - REPLICATE_API_TOKEN not found in environment
- `MISSING_PROMPT` - No prompt provided in request
- `REPLICATE_CREATE_FAILED` - Failed to create prediction on Replicate
- `REPLICATE_STATUS_FAILED` - Prediction failed or was canceled
- `REPLICATE_TIMEOUT` - Generation timeout (60 seconds)

## GET /img/health
**Purpose**: Check image generation service status

**Response**:
```json
{
  "provider": "replicate",
  "ok": true
}
```

## POST /brain/feed
**Purpose**: Receive market data and news from n8n workflows

**Request**:
```json
{
  "data": "any json data"
}
```

**Response**:
```json
{
  "ok": true,
  "received": {...}
}
```

## GET /social/twitter/search
**Purpose**: Search recent tweets and return top 5 by engagement score

**Request Parameters**:
- `query` (required) - Search query string
- `max_results` (optional) - Maximum results to fetch from Twitter API (default: 20)

**Example**:
```
GET /social/twitter/search?query=bitcoin&max_results=20
```

**Response (Success)**:
```json
{
  "ok": true,
  "items": [
    {
      "id": "123456789",
      "text": "Bitcoin hits new high...",
      "created_at": "2025-11-01T12:34:56.000Z",
      "score": 1250
    }
  ]
}
```

**Response (Error)**:
```json
{
  "ok": false,
  "error": "MISSING_TWITTER_BEARER",
  "raw": {...}
}
```

**Features**:
- Calls Twitter API v2 `/tweets/search/recent` endpoint
- Fetches tweet fields: `created_at`, `public_metrics`, `lang`, `author_id`, `source`
- Calculates engagement score: `retweet_count + like_count`
- Returns top 5 tweets sorted by score (descending)
- 60-second timeout for API calls
- Environment variable validation on startup

**Error Codes**:
- `MISSING_TWITTER_BEARER` - TWITTER_BEARER not found in environment
- `MISSING_QUERY_PARAMETER` - No query parameter provided
- `TWITTER_API_ERROR` - Twitter API returned an error
- `TWITTER_TIMEOUT` - Request timeout (60 seconds)

# Recent Changes

**November 3, 2025 (v3.1 - 数据帝国修复版)**:
- 🔧 **Critical Bug Fix: Symbol Auto-Extraction** (index.js L523-539)
  - Added `extractSymbols()` function to automatically extract ticker symbols from user text
  - Case-insensitive matching: "tsla" → ["TSLA"]
  - Extended blacklist to filter false positives (GDP, CPI, PM, AM, etc.)
  - Fixes market_data=null issue when symbols not explicitly provided
  - Now "盘前TSLA" automatically triggers real-time data collection
- 🔧 **News Mode Fix (Partial)** (index.js L976-1024)
  - Modified `buildGPT4Prompt()` to detect mode === 'news' 
  - GPT-4 now returns structured news list instead of investment analysis
  - Other 5 AI models still need adaptation (future work)
  - Addresses user complaints about getting analysis when asking for news
- 📝 Created comprehensive documentation:
  - TESTING_GUIDE.md - Test procedures and expected results
  - DEPLOYMENT_STATUS.md - Production deployment checklist
  - FIXES_SUMMARY.md - Detailed bug analysis and remediation

**November 3, 2025 (v3.0 Initial)**:
- 🚀 **Major upgrade: Intelligent AI Orchestrator system** (`POST /brain/orchestrate`)
- Multi-AI coordination with differentiated roles:
  - Claude: Technical analysis expert (indicators, price levels, trends)
  - DeepSeek: Chinese market insights (sentiment, local news, A-share analysis)
  - GPT-4: Comprehensive strategy analyst (synthesis, recommendations)
  - Gemini: Real-time data integration specialist (breaking news, market events)
  - Perplexity: Deep research and context analysis (industry trends, competitive landscape)
  - Mistral: Sentiment analysis and risk modeling (market psychology, volatility)
- Intelligent synthesis engine: extracts key points, identifies consensus/divergence, generates coherent unified reports (not simple concatenation)
- Dual output styles automatically switch based on chat.type:
  - Private chats: Warm teacher style with analogies and conversational tone
  - Group chats: Professional team commentary with structured format
- Scene-aware content depth:
  - Premarket: Brief (~300 words) - quick scanning
  - Hot news/Intraday: Medium (~500 words) - balanced analysis
  - Postmarket/Review: Deep (~800 words) - comprehensive insights
- DST-aware Eastern Time detection using `Intl.DateTimeFormat` for accurate market hours classification
- Memory layer with user preference application:
  - `preferred_depth` adjusts content length (brief/medium/deep)
  - `preferred_tone` affects writing style (casual/professional)
- Low-confidence intent detection with `low_confidence` flag in response
- **Data Empire Integration**: Real-time market data collection (Finnhub + Alpha Vantage)
  - Automatic data enrichment when stock symbols detected
  - Parallel data fetching: quotes, news, sentiment analysis
  - AI prompts automatically enriched with real-time market context
- Requires `OPENAI_API_KEY`, `GEMINI_API_KEY`, `PERPLEXITY_API_KEY`, `MISTRAL_API_KEY`, `FINNHUB_API_KEY`, `ALPHA_VANTAGE_API_KEY` (in addition to existing CLAUDE_API_KEY and DEEPSEEK_API_KEY)

**November 2, 2025**:
- Added `GET /social/twitter/search` endpoint for Twitter API integration
- Implements engagement-based ranking (score = retweet_count + like_count)
- Returns top 5 tweets sorted by engagement score
- Environment variable validation for TWITTER_BEARER on startup
- 60-second timeout protection for Twitter API calls
- Comprehensive error handling with detailed error codes

**November 1, 2025**:
- Fixed `/img/imagine` endpoint with comprehensive error handling
- Added environment variable validation on startup (logs token status)
- Implemented automatic prompt cleaning (removes line breaks, tabs, excess whitespace)
- Enhanced error responses with detailed error codes and raw response data
- Updated error handling to return structured responses: `{ok:false, error:"CODE", raw:{...}}`
- Improved polling mechanism with better error detection and logging
- All image generation tests passing (16:9, 1:1, 9:16 aspect ratios)

**October 31, 2025**:
- Upgraded to v3 with multi-model voting system
- Added parallel execution of Claude and DeepSeek models
- Implemented BUY/HOLD/SELL voting mechanism with confidence scores
- Added `/brain/intent` endpoint for natural language intent recognition
- Fixed stock symbol extraction regex to work with original text (not lowercased)
- Comprehensive testing across multiple scenarios (premarket, intraday, postmarket, diagnose, news)
