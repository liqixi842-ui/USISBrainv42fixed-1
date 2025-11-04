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

# Permission System (2025-11-04)

## Architecture Decision
**权限管理由Brain API统一处理，N8N不做权限判断。**

### Rationale
- Brain是决策中心，权限应该是核心能力的一部分
- N8N数据流复杂（6-8个节点），变量传递不可靠，导致 "chat not found" 等错误
- 集中式权限管理便于审计、黑名单、限流等扩展

## API Endpoint

### POST /brain/permission
检查用户权限并处理管理员命令。

**Request:**
```json
{
  "text": "用户消息",
  "user_id": "telegram_user_id",
  "chat_id": "telegram_chat_id"
}
```

**Response (允许):**
```json
{
  "allowed": true,
  "role": "admin|whitelist"
}
```

**Response (拒绝):**
```json
{
  "allowed": false,
  "role": "none",
  "message": "⚠️ 抱歉，你没有使用权限。请联系管理员。"
}
```

**Response (管理命令):**
```json
{
  "allowed": true,
  "role": "admin",
  "tip": "✅ 已授权用户：123456\n\n当前白名单人数：5"
}
```

## Admin Commands
- `/auth <user_id>` - 授权用户（管理员专用）
- `/unauth <user_id>` - 取消授权（管理员专用）
- `/listauth` - 查看白名单（管理员专用）

## N8N Integration
N8N工作流简化为：
1. `Telegram_Trigger` - 接收消息
2. `HTTP Request` - POST /brain/permission
3. `IF (allowed)` - 判断权限
   - True → 调用 /brain/orchestrate 执行业务逻辑
   - False → 发送 message 字段给用户

## Implementation
- 白名单存储：`global.__WL__` (内存Set，重启丢失)
- 管理员ID：`7561303850`（硬编码）
- 未来可迁移到PostgreSQL持久化

---

# Recent Fixes (2025-11-03)

## Critical Issues Resolved

### 1. News Intent Recognition Enhancement
**Problem**: Users requesting "新闻资讯" received lengthy AI analysis instead of news list.
**Fix**: Added fast-path response for pure news requests without stock symbols. System now returns concise news prompt and skips 6-AI orchestration for efficiency.
- Location: `index.js` line 2127-2157
- Trigger: `mode='news'` + no symbols + no analysis keywords

### 2. Individual Stock Analysis Data Enhancement
**Problem**: Stock analysis responses lacked concrete data (prices, percentages, news).
**Fix**: Enhanced AI prompts to mandate usage of real-time market data:
- **Claude Prompt** (line 1567-1594): Requires explicit price + change% in first sentence, technical indicators with numbers
- **GPT-4 Prompt** (line 1615-1670): Requires real-time price, sentiment percentages, news integration
- **Data Flow**: `collectMarketData()` → `generateDataSummary()` → enriched AI prompts → data-driven analysis

### 3. Meta Intent Detection (AI Self-Awareness)
**Problem**: Users asking "你可以学习吗" received market analysis instead of capability information.
**Fix**: Added `meta` intent mode with strict detection logic:
- Detects self-referential questions: "你是谁", "你的功能", "what can you do"
- **Critical safeguard**: Excludes if stock symbols or market keywords present (prevents hijacking "你能分析NVDA吗")
- Location: `index.js` line 1172-1177 (detection), line 2088-2125 (fast-path response)
- Returns friendly capability overview without triggering AI orchestration

### 4. Message Duplication Issue (N8N-side)
**Problem**: Users reported duplicate messages (3x text, 2x text+image).
**Diagnosis**: Brain API returns single `final_analysis` correctly. Issue is in N8N workflow configuration.
**Action Required**: Check N8N workflow:
- Verify `IF_Send_Photo` logic is mutually exclusive
- Ensure `Send_With_Photo` and `Send_Text_Only` nodes don't both trigger
- Look for duplicate Telegram send nodes in workflow

## Intent Modes Supported
- `premarket`: Morning pre-market analysis
- `intraday`: Live market tracking
- `postmarket`: After-hours review
- `diagnose`: Individual stock deep-dive
- `news`: Market news aggregation
- **`meta`**: Questions about AI capabilities
- **`casual`** (new): Casual chat mode - uses lightweight GPT-4 response (1-3 sentences, max 120 chars) to avoid 6-AI orchestration cost

---

# PostgreSQL Memory System (2025-11-03)

## Architecture Decision
**Memory is managed 100% by Brain (Replit), not N8N.**

### Rationale
- Brain is the thinking center, memory should be part of its core capability
- Single source of truth: PostgreSQL database persists across Replit restarts
- N8N remains a pure executor organ, only forwards `user_id` without managing memory
- No data synchronization issues between Brain internal state and external systems

## Implementation

### Database Schema
```sql
CREATE TABLE user_memory (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  request_text TEXT,
  mode TEXT,
  symbols TEXT[],
  response_text TEXT,
  chat_type TEXT
);
CREATE INDEX idx_user_memory_user_id ON user_memory(user_id);
CREATE INDEX idx_user_memory_timestamp ON user_memory(timestamp DESC);
```

### API Endpoints
- **POST /brain/orchestrate**: Automatically reads last 3 user memories before AI analysis, saves new conversation after response
- **POST /brain/memory/clear**: Clears all history for a specific user_id
- **GET /brain/memory**: Views system memory (legacy internal state)

### Memory Flow
```
User Request (with user_id)
    ↓
Brain reads last 3 conversations from PostgreSQL
    ↓
AI analysis (with historical context)
    ↓
Brain saves new conversation to PostgreSQL
    ↓
Response to user
```

### N8N Integration
N8N only needs to pass `user_id` in the request body:
```json
{
  "text": "user's message",
  "chat_type": "private|group",
  "user_id": "telegram_user_id"
}
```

N8N can trigger memory clearing:
```
POST /brain/memory/clear
{
  "user_id": "telegram_user_id"
}
```

## User Experience
- **Learning**: Brain remembers last 3 conversations per user
- **Personalization**: Adjusts analysis style based on user history
- **Privacy**: Users can say "清空记忆" to clear their history
- **Persistence**: Memory survives Replit restarts (PostgreSQL backed)

## Technical Notes
- Database connection uses `pg` driver with connection pooling
- All queries use parameterized statements (SQL injection safe)
- Graceful degradation: If database query fails, continues with empty history
- DATABASE_URL environment variable required for persistence