# Overview

USIS Brain v3 is an intelligent AI market analysis orchestration system designed for real-time market data integration and intelligent synthesis. It leverages a 6-model collaboration (Claude, DeepSeek, GPT-4, Gemini, Perplexity, Mistral) to understand natural language intent (premarket, intraday, postmarket, diagnose, news) and coordinate specialized AI agents. The system provides scene-aware content depth and delivers dual output styles: a warm conversational tone for private chats and professional team commentary for groups. It is built for deployment on Replit's Autoscale platform with minimal dependencies.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Application Framework
- **Technology**: Node.js with Express.js (v5.1.0)
- **Module System**: CommonJS
- **Rationale**: Ensures compatibility with Replit's runtime and traditional Node.js tooling.

## API Design
- **Pattern**: RESTful JSON API
- **Endpoints**:
  - `GET /` & `GET /health`: Health checks
  - `POST /brain/decide`: Multi-model voting decision endpoint
  - `POST /brain/intent`: Natural language intent recognition with intelligent heatmap detection
  - `POST /img/imagine`: Image generation
  - `GET /img/health`: Image service health check
  - `POST /brain/feed`: Market data and news ingestion
  - `GET /social/twitter/search`: Twitter search for trending topics
  - `GET /heatmap`: TradingView widget-based stock heatmap generator supporting 40+ global indices
  - `GET /heatmap/test`: Interactive dataSource parameter testing tool
  - `GET /heatmap/test-all`: Batch testing tool for multiple dataSource values
- **Response Structure**: Standardized format with versioning (`USIS.v3`), multilingual output, model voting details, confidence scores, and semantic tagging.

## Server Configuration
- **Port Binding**: Dynamic allocation via `process.env.PORT || 3000`
- **Host**: Binds to `0.0.0.0` for external accessibility.

## Current Implementation (v3 Orchestrator)
- **Orchestration Pipeline**: Intent → Scene → Data Collection → Multi-AI Analysis → Intelligent Synthesis.
- **AI Models** (6 specialized agents):
  - **Claude 3.5 Sonnet**: Technical analysis expert.
  - **DeepSeek Chat**: Chinese market insights.
  - **GPT-4**: Comprehensive strategy analyst.
  - **Gemini Pro**: Real-time data integration specialist.
  - **Perplexity**: Deep research and context analysis.
  - **Mistral Large**: Sentiment analysis and risk modeling.
- **Data Empire**: Real-time market intelligence from Finnhub and Alpha Vantage APIs, with parallel data collection and automatic prompt enrichment.
- **Intelligent Synthesis**: Key point extraction, consensus/divergence identification, coherent unified report generation, and dual output styles (warm teacher vs. professional team).
- **Scene-Aware Content**: Varied content depth based on market context (Premarket: brief, Hot news/Intraday: medium, Postmarket/Review: deep).
- **Memory Layer**: Adjusts content depth and tone based on user preferences.

## Internationalization
- **Approach**: Built-in multilingual responses (Chinese `zh`, Spanish `es`, English `en`).
- **Auto-detection**: Intent endpoint automatically detects language.

## Observability
- **Logging**: Console-based request logging with emoji markers.
- **Metrics**: Responses include confidence scores, model voting details, and timestamps.

# External Dependencies

## Runtime Dependencies
- **express**: Web application framework.
- **node-fetch**: HTTP client for API calls.

## API Integrations
- **Claude API** (Anthropic): Technical analysis.
- **DeepSeek API**: Chinese market insights.
- **OpenAI API**: Comprehensive strategy analysis.
- **Google Gemini API**: Real-time data integration.
- **Perplexity API**: Deep research and context analysis.
- **Mistral API**: Sentiment and risk modeling.
- **Finnhub API**: Real-time stock quotes, news, market sentiment.
- **Alpha Vantage API**: Technical indicators, news sentiment, fundamentals.
- **Replicate API**: For image generation (used by `/img/imagine` endpoint).
- **Twitter API v2**: For searching recent tweets (used by `/social/twitter/search` endpoint).

## Deployment Environment
- **Platform**: Replit.
- **Environment Variables**: All API keys must be configured in Replit Secrets.

# Heatmap System

## TradingView Widget Integration
The system uses official TradingView stock heatmap widgets for professional market visualization.

## Supported DataSource Values (Official)
### 🇺🇸 United States
- `SPX500`, `DJDJI`, `DJDJU`, `DJDJT`, `DJCA`
- `NASDAQ100`, `NASDAQCOMPOSITE`, `NASDAQBKX`
- `ALLUSA` (All US Stocks)

### 🇪🇺 Europe
- UK: `UK100`, `ALLUK`
- Germany: `DAX`, `TECDAX`, `MDAX`, `SDAX`, `ALLDE`
- France: `CAC40`, `SBF120`, `ALLFR`
- Spain: `IBEX35`, `BMEIS`, `BMEINDGRO15`, `BMEINDGROAS`, `BMEICC`, `ALLES`
- Belgium: `ALLBE`

### 🌏 Asia-Pacific
- Japan: `ALLJP`
- China: `ALLCN`
- Australia: `ALLAU`

### 🌎 Americas (Other)
- Brazil: `ALLBR`
- Argentina: `ALLAR`
- Canada: `ALLCA`
- Chile: `ALLCL`
- Colombia: `ALLCO`

### 🏭 Industry Indices
- `TVCRUI` (Cruise Industry)
- `TVCRUA` (Airlines & Cruise)
- `TVCRUT` (Transport & Travel)

### 💰 Cryptocurrency
- `CRYPTO` (Cryptocurrency heatmap)

## Intelligent Mapping
The system automatically maps user requests to valid dataSource values:
- User says "纳斯达克100" → `NASDAQ100`
- User says "西班牙小盘股" → `BMEIS` (BME Small Cap)
- User says "德国科技股" → `TECDAX`
- User says "加密货币" → `CRYPTO`

## N8N Integration
N8N workflow automatically detects `fetch_heatmap` action and generates screenshots without requiring manual configuration.