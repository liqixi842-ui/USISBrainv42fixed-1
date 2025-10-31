# Overview

USIS Brain v3 is a minimal multi-model AI decision-making API service that integrates Claude (Anthropic) and DeepSeek models to provide market analysis with voting-based consensus. The service processes natural language requests and returns structured decisions (BUY/HOLD/SELL) with confidence scores, intent recognition, and multilingual support (Chinese, Spanish, English). Designed for deployment on Replit's platform with minimal dependencies.

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

## Current Implementation (v3)
- **Status**: Production-ready with real AI model integration
- **Decision Logic**: Parallel execution of Claude Haiku and DeepSeek models with voting-based consensus
- **Voting Mechanism**: 
  - Each model analyzes the task and votes BUY/HOLD/SELL
  - Final decision uses majority voting (ties default to HOLD)
  - Confidence score calculated from model agreement and individual confidence levels
- **Intent Recognition**: Keyword-based NLP to extract mode (premarket/intraday/postmarket/diagnose/news), stock symbols, and language from natural text
- **Models**:
  - Claude 3 Haiku (claude-3-haiku-20240307) - Fast, cost-effective analysis
  - DeepSeek Chat (deepseek-chat) - Chinese language optimization

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
- **node-fetch**: ^2.x - HTTP client for API calls to Claude and DeepSeek (v2 for CommonJS compatibility)

## API Integrations
- **Claude API** (Anthropic): Requires `CLAUDE_API_KEY` environment variable
  - Endpoint: https://api.anthropic.com/v1/messages
  - Model: claude-3-haiku-20240307
  - Used for market analysis and decision recommendations
- **DeepSeek API**: Requires `DEEPSEEK_API_KEY` environment variable
  - Endpoint: https://api.deepseek.com/v1/chat/completions
  - Model: deepseek-chat
  - Optimized for Chinese language analysis

## Deployment Environment
- **Platform**: Replit
- **Constraints**: Must use dynamic port allocation and CommonJS module system
- **Network**: Relies on Replit's built-in HTTPS proxy for external access
- **Environment Variables**: CLAUDE_API_KEY and DEEPSEEK_API_KEY must be configured in Replit Secrets

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

# Recent Changes

**October 31, 2025**:
- Upgraded to v3 with multi-model voting system
- Added parallel execution of Claude and DeepSeek models
- Implemented BUY/HOLD/SELL voting mechanism with confidence scores
- Added `/brain/intent` endpoint for natural language intent recognition
- Fixed stock symbol extraction regex to work with original text (not lowercased)
- Comprehensive testing across multiple scenarios (premarket, intraday, postmarket, diagnose, news)
