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

## Supervisor Bot Architecture (v7.0) - 多Bot账号协作架构
**核心设计**：单进程，多Telegram Bot账号，各司其职。

### 架构特点
1. **单Node.js进程**：所有bot在同一个进程中运行
2. **多Telegram账号**：4个不同的bot账号，各自以自己的身份在群里说话
3. **清晰分工**：主管收消息，子bot们各自发消息
4. **无polling开销**：只有主管bot需要polling，子bot们只负责发消息

### Bot账号配置

#### 👔 主管机器人 (Supervisor Bot)
- **Token**: `SUPERVISOR_BOT_TOKEN`（如未设置，回退到 `TELEGRAM_BOT_TOKEN`）
- **职责**: 接收所有用户消息，识别意图，分配任务，发送确认消息
- **Polling**: ✅ 是（唯一需要polling的bot）

#### 🎫 解票机器人 (Ticket Bot)
- **Token**: `TICKET_BOT_TOKEN`（如未设置，回退到 `SUPERVISOR_BOT_TOKEN`）
- **职责**: 发送股票技术分析（解票）结果
- **Polling**: ❌ 否（只发消息）

#### 📝 研报机器人 (Report Bot)
- **Token**: `REPORT_BOT_TOKEN`（如未设置，回退到 `TICKET_BOT_TOKEN`）
- **职责**: 发送投资研究报告（PDF）
- **Polling**: ❌ 否（只发消息）

#### 📰 新闻机器人 (News Bot)
- **Token**: `NEWS_BOT_TOKEN`（如未设置，回退到 `SUPERVISOR_BOT_TOKEN`）
- **职责**: 发送财经新闻推送
- **Polling**: ❌ 否（只发消息）

### 消息流程示例

#### 示例1：用户请求解票 "解票 NVDA"
```
1️⃣ 用户 → 主管机器人（@supervisor_bot）："解票 NVDA"

2️⃣ 主管机器人识别意图 → 回复确认：
   "✅ 收到，我已经安排【解票机器人】帮你分析 NVDA
    模式：标准版
    稍后解票机器人会直接给你发送分析结果..."

3️⃣ 解票机器人（@ticket_bot）→ 用户（使用TICKET_BOT_TOKEN发送3条消息）：
   - 标准中文版解票
   - 英文版解票
   - 人性化解读版
```

#### 示例2：用户请求研报 "研报, NVDA, Aberdeen Investments, Anthony, 英文"
```
1️⃣ 用户 → 主管机器人（@supervisor_bot）："研报, NVDA, ..."

2️⃣ 主管机器人识别意图 → 回复确认：
   "✅ 收到，我已经安排【研报机器人】帮你生成 NVDA 的研究报告
    机构：Aberdeen Investments
    分析师：Anthony
    语言：英文
    稍后研报机器人会直接给你发送PDF报告..."

3️⃣ 研报机器人（@report_bot）→ 用户（使用REPORT_BOT_TOKEN发送PDF）：
   - 发送生成的PDF研究报告
```

#### 示例3：用户请求新闻 "新闻"
```
1️⃣ 用户 → 主管机器人（@supervisor_bot）："新闻"

2️⃣ 主管机器人识别意图 → 回复确认：
   "✅ 收到，我已经安排【新闻机器人】帮你获取今日要闻
    稍后新闻机器人会直接给你发送新闻列表..."

3️⃣ 新闻机器人（@news_bot）→ 用户（使用NEWS_BOT_TOKEN发送多条消息）：
   - 新闻列表标题
   - 新闻1
   - 新闻2
   - ...
```

#### 示例4：用户闲聊 "你好"
```
1️⃣ 用户 → 主管机器人（@supervisor_bot）："你好"

2️⃣ 主管机器人识别为闲聊 → 直接回复：
   "你好！我是USIS Brain主管机器人 👔
    我能帮你：
    • 📊 股票分析（解票 + 研报）
    • 📰 新闻推送
    输入 /help 查看详细帮助"
```

### 环境变量配置
```bash
# 必需（至少需要一个）
SUPERVISOR_BOT_TOKEN=...  # 主管机器人Token（或使用 TELEGRAM_BOT_TOKEN）
TELEGRAM_BOT_TOKEN=...    # 备用：如未设置SUPERVISOR_BOT_TOKEN，使用此Token

# 可选（各子bot专用Token，如未设置则共用主管Token）
TICKET_BOT_TOKEN=...      # 解票机器人专用Token
REPORT_BOT_TOKEN=...      # 研报机器人专用Token（如未设置，共用TICKET_BOT_TOKEN）
NEWS_BOT_TOKEN=...        # 新闻机器人专用Token
```

### Token回退机制
系统支持灵活的Token配置策略：

1. **生产环境（推荐）**：使用4个独立Token
   ```bash
   SUPERVISOR_BOT_TOKEN=token_1  # 主管
   TICKET_BOT_TOKEN=token_2      # 解票
   REPORT_BOT_TOKEN=token_3      # 研报
   NEWS_BOT_TOKEN=token_4        # 新闻
   ```

2. **测试环境（简化）**：共用单一Token
   ```bash
   TELEGRAM_BOT_TOKEN=token_1  # 所有bot共用
   ```

3. **混合模式**：部分共用
   ```bash
   SUPERVISOR_BOT_TOKEN=token_1  # 主管
   TICKET_BOT_TOKEN=token_2      # 解票 + 研报（共用）
   NEWS_BOT_TOKEN=token_3        # 新闻
   # REPORT_BOT_TOKEN未设置 → 自动使用TICKET_BOT_TOKEN
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
echo $SUPERVISOR_BOT_TOKEN    # 主管Token
echo $TICKET_BOT_TOKEN        # 解票Token
echo $REPORT_BOT_TOKEN        # 研报Token
echo $NEWS_BOT_TOKEN          # 新闻Token

# 4. Start with PM2
pm2 restart usis-brain

# 5. Monitor startup logs
pm2 logs usis-brain --lines 50 | grep -E "Bot Architecture|Telegraf|Bot polling"

# Expected output:
# 🏗️  ===== USIS Brain v7.0 多Bot账号架构 =====
# 👔 [Supervisor Bot] Token: 7944498422... (Main entry point)
# 🎫 [Ticket Bot] Token: 7944498422... (Shared/Dedicated) - 解票分析
# 📝 [Report Bot] Token: 7944498422... (Shared/Dedicated) - 研报生成
# 📰 [News Bot] Token: 7944498422... (Shared/Dedicated) - 新闻推送
# ✅ [Telegraf] Bot polling started successfully!
# 💬 [Telegraf] Ready to receive messages
```

**Testing Checklist**:
- [ ] No 409 Conflict error in logs
- [ ] "✅ [Telegraf] Bot polling started successfully!" appears
- [ ] Send "解票 NVDA" → 主管确认 + 解票机器人发送3条分析消息
- [ ] Send "研报 TSLA, ..." → 主管确认 + 研报机器人发送PDF
- [ ] Send "新闻" → 主管确认 + 新闻机器人发送新闻列表
- [ ] Send "你好" → 主管直接回复帮助信息

**Troubleshooting**:
- `409 Conflict`: Another bot instance is running. Stop with `pm2 delete all`
- `Missing token`: Set at least `TELEGRAM_BOT_TOKEN` or `SUPERVISOR_BOT_TOKEN`
- `OOM errors`: Reserved VM required (2GB+ RAM)

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