# Overview

USIS Brain v3.1 is an intelligent AI market analysis orchestration system with a three-tier architecture for real-time market data integration and synthesis. It features an advanced orchestrator that evaluates request complexity and dynamically selects optimal AI model combinations for cost efficiency, leveraging up to 9 AI models. The system understands natural language intent (premarket, intraday, postmarket, diagnose, news, meta, casual) and coordinates specialized AI agents, providing scene-aware content depth, intelligent cost tracking, and delivering dual output styles: a warm conversational tone for private chats and professional team commentary for groups. It is designed for deployment on Replit's Autoscale platform.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Application Framework
- **Technology**: Node.js with Express.js
- **Module System**: CommonJS
- **API Design**: RESTful JSON API with standardized responses, versioning (`USIS.v3`), multilingual output, model voting details, confidence scores, and semantic tagging.

## Core Architecture (v3.1 Three-Tier Orchestrator)

### L1: Complexity Scorer & Intent Router
- Evaluates request complexity (0-10 scale) based on mode, symbols count, text complexity, question type, and user history.
- Routes simple requests to lightweight AI models for rapid responses.

### L2: Intelligent Model Selector
- Dynamically selects optimal AI model combinations based on request complexity and budget constraints.
- Supports various budget modes (low, medium, high, unlimited) and scenario-based model selection.

### L3: Cost Tracker & Performance Monitor
- Tracks user, models used, estimated/actual cost, and response time in a PostgreSQL database for cost analysis and optimization.

## Orchestration Pipeline
Intent → Complexity Scoring → Model Selection → Scene → Data Collection → Multi-AI Analysis → Intelligent Synthesis → Cost Tracking

## AI Models
The system dynamically selects from up to 9 AI models including GPT-4o-mini, Claude 3.5 Sonnet, DeepSeek Chat, GPT-4, Gemini Pro, Perplexity Sonar, Mistral Large, Claude Opus, and OpenAI o1, based on complexity and cost.

## Data Sources
Integrates with Finnhub API, Alpha Vantage API, SEC EDGAR API, and FRED API for real-time quotes, news, market sentiment, technical indicators, financial filings, and macroeconomic data.

## Intelligence Features
- **Intelligent Synthesis**: Extracts key points, identifies consensus/divergence, and generates unified reports.
- **Dual Output Styles**: Offers a warm conversational tone for private chats and professional commentary for groups.
- **Scene-Aware Content**: Adjusts content depth based on context (e.g., brief for premarket, deep for postmarket).
- **Memory Layer**: Utilizes a PostgreSQL-backed system to store user history (last 3 conversations) for personalized interactions, allowing the AI to adjust tone and depth based on past interactions. Users can clear their memory.

## Internationalization
Supports built-in multilingual responses (Chinese `zh`, Spanish `es`, English `en`) with automatic language detection.

## Observability
Provides console-based request logging with emoji markers and includes confidence scores, model voting details, and timestamps in responses.

## Heatmap System
Integrates official TradingView stock heatmap widgets, supporting numerous global indices and cryptocurrencies. It intelligently maps user requests to appropriate data sources.

# External Dependencies

## Runtime Dependencies
- **express**: Web application framework.
- **node-fetch**: HTTP client for API calls.

## API Integrations
- **Claude API** (Anthropic)
- **DeepSeek API**
- **OpenAI API**
- **Google Gemini API**
- **Perplexity API**
- **Mistral API**
- **Finnhub API**
- **Alpha Vantage API**
- **FRED API** ✅: Federal Reserve Economic Data (CPI, unemployment, GDP, interest rates).
- **SEC EDGAR API** ✅: Company financial filings (10-K, 10-Q).
- **Replicate API**: For image generation.
- **Twitter API v2**: For searching recent tweets.

## Database
- **PostgreSQL**: Used for memory management (user conversation history) and cost tracking.

## Deployment Environment
- **Replit**: Platform for deployment.