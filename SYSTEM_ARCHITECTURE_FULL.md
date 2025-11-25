# USIS Brain v7.0 完整系统架构文档

> 本文档供 AI 系统（如 GPT、Claude）阅读，包含完整技术细节。
> 最后更新: 2025-01-27

---

## 1. 系统概述

**USIS Brain v7.0** 是一个机构级多AI股票分析系统，通过 Telegram 机器人 `@qixiceshi_bot` 提供服务。

### 1.1 核心特性
- **单机器人多模块架构**: 一个 Telegram Bot 入口，8个专业化处理模块
- **双语言命令支持**: 同时支持中文（`解票 NVDA`）和英文（`/ticket NVDA`）
- **NL-1 逗号协议**: 支持 `研报, AAPL, cn` 格式的简化命令
- **NL-2 自然语言热力图**: 支持 "看看科技股热力图" 等自然语言查询
- **多AI模型智能路由**: GPT-5 Mini → GPT-4o → GPT-4o-mini 自动降级
- **n8n 工作流集成**: 通过 n8n 实现 TradingView 热力图截图
- **PostgreSQL 持久化**: 用户记忆、成本追踪、新闻系统

---

## 2. 系统架构

### 2.1 架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        USIS Brain v7.0 系统架构                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   用户 Telegram                                                          │
│        │                                                                 │
│        ▼                                                                 │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    @qixiceshi_bot (机器人一代)                    │   │
│   │                        Telegram Bot API                          │   │
│   │                        (Polling Mode)                            │   │
│   └───────────────────────────┬─────────────────────────────────────┘   │
│                               │                                          │
│                               ▼                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                        index.js (主入口)                         │   │
│   │                   node-telegram-bot-api 初始化                   │   │
│   │                         消息监听器                               │   │
│   └───────────────────────────┬─────────────────────────────────────┘   │
│                               │                                          │
│                               ▼                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                   manager-bot.js (核心路由器)                    │   │
│   │                                                                  │   │
│   │  功能:                                                           │   │
│   │  • parseCommand() - 命令解析（中英文）                           │   │
│   │  • NL-1 逗号协议检测 (研报, AAPL, cn)                           │   │
│   │  • NL-2 热力图触发检测 (包含"热力图")                           │   │
│   │  • 路由分发到专业化 Bot                                          │   │
│   └───────────────────────────┬─────────────────────────────────────┘   │
│                               │                                          │
│       ┌───────────────────────┼───────────────────────────┐              │
│       │           │           │           │           │   │              │
│       ▼           ▼           ▼           ▼           ▼   ▼              │
│   ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐          │
│   │Ticket │ │Report │ │ News  │ │Heatmap│ │ Brief │ │Public │          │
│   │ Bot   │ │  Bot  │ │  Bot  │ │  Bot  │ │  Bot  │ │  Bot  │          │
│   │ 解票  │ │ 研报  │ │ 新闻  │ │热力图 │ │ 简报  │ │ 帮助  │          │
│   └───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘ └───────┘          │
│       │         │         │         │         │                          │
│       │         │         │         │         │         ┌───────┐       │
│       │         │         │         │         │         │Supervi│       │
│       │         │         │         │         │         │sor Bot│       │
│       │         │         │         │         │         │ 管理员│       │
│       │         │         │         │         │         └───────┘       │
│       │         │         │         │         │                          │
│       └─────────┴─────────┴─────────┴─────────┘                          │
│                           │                                              │
│                           ▼                                              │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                      核心服务层                                   │   │
│   ├─────────────────────────────────────────────────────────────────┤   │
│   │  gpt5Brain.js       - AI模型调用（自动降级链）                   │   │
│   │  dataBroker.js      - 金融数据获取（Finnhub/TwelveData/Alpha）   │   │
│   │  stockChartService.js - K线图生成 + Vision AI 分析              │   │
│   │  heatmapService.js  - 热力图生成 + Vision AI 分析               │   │
│   │  n8nClient.js       - n8n 工作流 API 客户端                     │   │
│   │  semanticIntentAgent.js - AI 语义意图解析                       │   │
│   │  heatmapIntentParser.js - 热力图自然语言解析                    │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                      外部服务层                                   │   │
│   ├─────────────────────────────────────────────────────────────────┤   │
│   │  OpenAI API         - GPT-5 Mini / GPT-4o / GPT-4o-mini         │   │
│   │  Finnhub API        - 美股实时行情（主要）                       │   │
│   │  Twelve Data API    - 全球市场数据（补充）                       │   │
│   │  Alpha Vantage API  - 备用数据源                                 │   │
│   │  n8n Workflow       - TradingView 截图自动化                     │   │
│   │  ScreenshotAPI      - 网页截图服务（n8n调用）                    │   │
│   │  PostgreSQL (Neon)  - 数据持久化                                 │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 消息处理流程

```
1. 用户发送消息: "解票 AAPL" 或 "热力图 纳指"
           │
           ▼
2. Telegram API 推送到 Bot (Polling 模式, 300ms 间隔)
           │
           ▼
3. index.js 接收消息, 调用 parseCommand(message)
           │
           ▼
4. manager-bot.js 解析命令:
   ├── 检测 NL-2 热力图触发词 ("热力图" 关键词)
   ├── 检测 NL-1 逗号协议 ("研报, AAPL, cn")
   └── 标准命令解析 (中英文映射)
           │
           ▼
5. 路由到对应 Bot 模块:
   • cmd='ticket'  → ticket-bot.js
   • cmd='report'  → report-bot.js
   • cmd='news'    → news-bot.js
   • cmd='heatmap' → heatmap-bot.js
   • cmd='brief'   → brief-bot.js
   • cmd='public'  → public-bot.js (默认)
           │
           ▼
6. Bot 模块处理:
   ├── 调用核心服务 (dataBroker, gpt5Brain, etc.)
   ├── 生成图表/分析
   └── 格式化输出
           │
           ▼
7. 通过 bot.sendMessage() / bot.sendPhoto() 返回用户
```

---

## 3. Bot 模块详解

### 3.1 模块清单

| 文件 | 功能 | 触发命令 | 响应时间 |
|------|------|---------|---------|
| `manager-bot.js` | 核心路由器 | 所有消息 | <10ms |
| `ticket-bot.js` | 解票分析 | `解票 NVDA`, `/ticket NVDA` | 30-60s |
| `report-bot.js` | 研报生成 | `研报 AAPL`, `/report AAPL`, `/reportpdf AAPL` | 60-120s |
| `news-bot.js` | 新闻查询 | `新闻 TSLA`, `/news TSLA` | 15-30s |
| `heatmap-bot.js` | 热力图 | `热力图`, `热力图 纳指`, `看看科技股热力图` | 5-15s |
| `brief-bot.js` | 极简研报 | `简报 NVDA`, `/brief NVDA` | 20-40s |
| `public-bot.js` | 帮助/通用 | `/help`, `/start`, 非命令消息 | <100ms |
| `supervisor-bot.js` | 系统管理 | `/status`, `/admin`, `/bots` | <100ms |

### 3.2 各模块详细说明

#### 3.2.1 manager-bot.js (核心路由器)

**位置**: `bots/manager-bot.js`

**职责**:
- 接收所有 Telegram 消息
- 解析命令和参数
- 路由到专业化 Bot

**命令解析逻辑**:
```javascript
function parseCommand(message) {
  const text = (message.text || '').trim();
  
  // 1. NL-2 热力图触发检测
  if (text.includes('热力图')) {
    return { cmd: 'heatmap', args: [], flags: {} };
  }
  
  // 2. NL-1 逗号协议检测 (研报, AAPL, cn)
  if (text.includes('研报') && text.includes(',')) {
    const parsed = parseResearchReportCommand(text);
    return { cmd: 'report', args: [parsed.symbol, parsed.lang], flags: {} };
  }
  
  // 3. 标准命令映射
  const commandMap = {
    '/ticket': 'ticket', '解票': 'ticket',
    '/report': 'report', '研报': 'report',
    '/news': 'news', '新闻': 'news',
    '/heatmap': 'heatmap', '热力图': 'heatmap',
    '/brief': 'brief', '简报': 'brief',
    '/help': 'help', '/start': 'help',
    '/admin': 'supervisor', '/status': 'supervisor'
  };
  
  // 默认: public
  return { cmd: 'public', args: [text], flags: {} };
}
```

#### 3.2.2 ticket-bot.js (解票分析)

**位置**: `bots/ticket-bot.js`

**功能**:
- 快速技术分析 (30-60秒响应)
- TradingView K线图截图
- GPT-4o Vision 图表分析
- 多语言输出 (标准版/双语/聊天版/完整版)

**核心流程**:
```
1. 解析参数 (symbol, mode)
2. 发送状态消息 "正在生成图表..."
3. 调用 generateStockChart(symbol) 生成K线图
   ├── stockChartService.js
   ├── screenshotProviders.js (N8N → Browserless fallback)
   └── visionAnalyzer.js (GPT-4o Vision)
4. 格式化输出 (lightweightTicketFormatter)
5. 发送图片 + 文字分析
```

**输出模式**:
- `标准版`: 中文技术分析
- `双语`: 中文 + 英文
- `聊天版`: 老交易员口吻
- `完整版`: 3条消息全输出

#### 3.2.3 report-bot.js (研报生成)

**位置**: `bots/report-bot.js`

**功能**:
- 机构级 6 节投资研报
- 文本版 (`/report`) 和 PDF 版 (`/reportpdf`)
- 多语言支持 (en/zh/es)
- Premium 模式 (DocRaptor PDF)

**研报结构**:
1. Executive Summary (执行摘要)
2. Investment Thesis (投资逻辑)
3. Valuation (估值分析)
4. Industry Analysis (行业分析)
5. Catalysts (催化剂)
6. Key Risks (关键风险)

**命令格式**:
```
/report NVDA           - 英文文本版
/report NVDA zh        - 中文文本版
/reportpdf NVDA        - 基础 PDF
/reportpdf pro NVDA    - Premium PDF (DocRaptor)
/reportpdf NVDA pro zh - Premium 中文 PDF
研报, AAPL, cn         - NL-1 逗号协议
```

#### 3.2.4 heatmap-bot.js (热力图)

**位置**: `bots/heatmap-bot.js`

**功能**:
- 全球市场热力图 (SP500/NASDAQ/DAX/IBEX等)
- TradingView 实时截图 (通过 n8n 工作流)
- 自然语言解析 (NL-2)
- Vision AI 分析

**支持的市场**:
```
美股: sp500, nasdaq, dow
欧洲: spain/ibex, germany/dax, uk/ftse, france/cac
亚洲: china, japan, hk/香港
其他: crypto
```

**NL-2 关键词短路**:
```javascript
// 优先级最高的关键词匹配
if (/纳指|纳斯达克|nasdaq|nas100|qqq/i.test(text)) → nasdaq
if (/标普|sp500|spx|s&p/i.test(text)) → sp500
if (/西班牙|spain|ibex/i.test(text)) → spain
if (/道指|道琼斯|dow|djia/i.test(text)) → dow
if (/香港|港股|恒生|hk|hsi/i.test(text)) → hk
```

**n8n 工作流**:
- 工作流 ID: `GaMjrt46sxzrIEry`
- 使用 ScreenshotAPI 截取 TradingView 热力图
- 关键约束: n8n 环境禁止访问环境变量，API Key 必须硬编码

#### 3.2.5 news-bot.js (新闻)

**位置**: `bots/news-bot.js`

**功能**:
- 股票新闻聚合 (Finnhub → Alpha Vantage 级联)
- ImpactRank 2.0 智能评分
- Phase 2 统一输出格式
- 自动翻译 (Google Translate)

**输出格式 (Phase 2)**:
```json
{
  "headline": "标题",
  "summaryShort": "100-150字摘要",
  "summaryLong": "300-500字摘要",
  "impact": {
    "score": 8.5,
    "label": "High Impact",
    "emoji": "🔥",
    "reason": "评分理由"
  },
  "source": "来源",
  "publishedAt": "ISO8601时间",
  "publishedAgo": "2小时前"
}
```

#### 3.2.6 brief-bot.js (极简研报)

**位置**: `bots/brief-bot.js`

**功能**:
- 快速研报 (不超过1500字)
- 3个核心部分: 摘要/投资论点/关键风险
- 多语言 (en/zh/es)
- 纯文本输出

#### 3.2.7 public-bot.js (公共消息)

**位置**: `bots/public-bot.js`

**功能**:
- 帮助菜单 (/help)
- 问候响应 (hi, hello, 你好)
- 未识别命令的友好提示

#### 3.2.8 supervisor-bot.js (管理员)

**位置**: `bots/supervisor-bot.js`

**功能**:
- 系统状态查询 (/status)
- Bot 模块列表 (/bots)
- 错误日志查询 (/errors)
- 权限控制 (仅 OWNER_ID)

---

## 4. 核心服务

### 4.1 gpt5Brain.js (AI 主脑)

**功能**: 智能模型调用，自动降级链

**模型降级链**:
```
GPT-5 Mini → GPT-4o → GPT-4o-mini
```

**核心函数**:
```javascript
async function callModelWithFallback({ systemPrompt, userPrompt, requestStartTime })
```

**特性**:
- 自动超时保护 (15s/30s/45s)
- 失败自动切换下一模型
- 成本追踪
- 错误历史记录

### 4.2 dataBroker.js (数据代理)

**功能**: 中心化金融数据获取

**数据源优先级**:
```
Finnhub (美股主要) → Twelve Data (全球) → Alpha Vantage (备用)
```

**特性**:
- 并行数据获取
- 软超时 (7秒)
- 内存缓存 (120秒 TTL)
- 数据来源追踪
- 反编造机制

**核心函数**:
```javascript
async function fetchMarketData(symbols, dataTypes = ['quote'])
async function fetchQuotes(symbols)
async function fetchNews(symbol)
async function fetchCompanyProfile(symbol)
```

### 4.3 stockChartService.js (K线图服务)

**功能**: 个股技术图表生成

**流程**:
```
1. 规范化股票代码
2. 识别交易所 (Finnhub API)
3. 构建 TradingView URL
4. 截图 (N8N → Browserless fallback)
5. Vision AI 分析 (GPT-4o)
6. 返回图片 + 分析
```

**超时配置**:
- DATA_FETCH: 10s
- SCREENSHOT: 30s
- VISION_AI: 20s
- TOTAL: 75s

### 4.4 heatmapService.js (热力图服务)

**功能**: 市场热力图生成

**流程**:
```
1. 解析用户查询 (heatmapIntentParser)
2. 构建 TradingView 热力图 URL
3. 调用 screenshotProviders 截图
4. Vision AI 分析 (可选)
5. 生成市场分析文本
```

### 4.5 heatmapIntentParser.js (热力图意图解析)

**功能**: 自然语言 → 结构化热力图查询

**两层解析**:
1. **规则引擎** (`extractHeatmapQueryRulesOnly`): 纯正则，100%准确
2. **LLM 解析** (`extractHeatmapQuery`): GPT-5 自然语言理解

**输出结构**:
```json
{
  "region": "US",
  "index": "SPX500",
  "sector": "technology",
  "confidence": 0.95,
  "rationale": "用户提到美股的科技股"
}
```

**防串台机制**:
- 西班牙关键词 → 强制 ES/IBEX35
- 地区/指数一致性校验

### 4.6 n8nClient.js (n8n API 客户端)

**功能**: n8n 工作流管理

**核心方法**:
```javascript
async healthCheck()           // 健康检查
async getWorkflows()          // 获取工作流列表
async executeWorkflow(id, data) // 执行工作流
async getExecutions(id, limit)  // 获取执行历史
```

**关键约束**:
- n8n 启用了 `N8N_BLOCK_ENV_ACCESS_IN_NODE`
- 所有 API Key 必须在工作流中硬编码，不能使用环境变量

### 4.7 semanticIntentAgent.js (语义意图代理)

**功能**: AI 驱动的用户意图理解

**快速检测**:
- 研报命令 → `RESEARCH_REPORT_V5`
- 纯新闻命令 → `NEWS`
- 其他 → 调用 GPT-4o-mini 解析

**输出结构**:
```json
{
  "intentType": "STOCK_ANALYSIS",
  "entities": [{"type": "symbol", "value": "NVDA"}],
  "mode": "analysis",
  "confidence": 0.95,
  "reasoning": "用户请求分析NVDA股票"
}
```

---

## 5. 数据库

### 5.1 PostgreSQL (Neon)

**连接**: 通过 `DATABASE_URL` 环境变量

### 5.2 表结构

| 表名 | 用途 |
|------|------|
| `user_memory` | 用户对话记忆 |
| `cost_tracking` | API 成本追踪 |
| `news_items` | 新闻条目 |
| `news_sources` | 新闻来源 |
| `news_scores` | 新闻评分 (ImpactRank) |
| `news_routing_state` | 新闻路由状态 |
| `news_push_history` | 新闻推送历史 |
| `news_dedupe_cache` | 新闻去重缓存 |
| `news_analyst_notes` | 分析师备注 |

---

## 6. 环境变量

### 6.1 必需变量

| 变量名 | 用途 |
|--------|------|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token (生产环境) |
| `TELEGRAM_BOT_TOKEN_DEV` | Telegram Bot Token (开发环境) |
| `OPENAI_API_KEY` | OpenAI API Key |
| `DATABASE_URL` | PostgreSQL 连接字符串 |
| `FINNHUB_API_KEY` | Finnhub 金融数据 API |

### 6.2 可选变量

| 变量名 | 用途 | 默认值 |
|--------|------|--------|
| `OWNER_ID` | 管理员 Telegram ID | - |
| `TWELVE_DATA_API_KEY` | Twelve Data API | - |
| `ALPHA_VANTAGE_API_KEY` | Alpha Vantage API | - |
| `N8N_BASE_URL` | n8n 服务地址 | - |
| `N8N_API_KEY` | n8n API Key | - |
| `SCREENSHOT_API_KEY` | ScreenshotAPI Key | - |
| `BROWSERLESS_API_KEY` | Browserless API Key | - |
| `DOC_RAPTOR_API_KEY` | DocRaptor PDF API | - |
| `PRIMARY_MODEL` | 主脑模型覆盖 | gpt-5-mini |
| `CACHE_TTL` | 缓存过期时间(秒) | 120 |
| `SLOW_SOURCE_TIMEOUT_MS` | 慢数据源超时 | 7000 |

---

## 7. 文件结构

```
usis-brain/
├── index.js                    # 主入口
├── package.json                # 依赖配置
├── pm2.ecosystem.config.js     # PM2 配置
│
├── bots/                       # Bot 模块目录
│   ├── manager-bot.js          # 核心路由器
│   ├── ticket-bot.js           # 解票分析
│   ├── report-bot.js           # 研报生成
│   ├── news-bot.js             # 新闻查询
│   ├── heatmap-bot.js          # 热力图
│   ├── brief-bot.js            # 极简研报
│   ├── public-bot.js           # 公共消息
│   └── supervisor-bot.js       # 系统管理
│
├── gpt5Brain.js                # AI 主脑
├── dataBroker.js               # 数据代理
├── stockChartService.js        # K线图服务
├── heatmapService.js           # 热力图服务
├── heatmapIntentParser.js      # 热力图意图解析
├── n8nClient.js                # n8n 客户端
├── semanticIntentAgent.js      # 语义意图代理
├── screenshotProviders.js      # 截图服务
├── visionAnalyzer.js           # Vision AI
│
├── services/                   # 服务目录
│   ├── reportTextService.js    # 文本研报
│   ├── reportPdfService.js     # PDF 研报
│   ├── reportPremiumService.js # Premium PDF
│   ├── newsQueryService.js     # 新闻查询
│   ├── newsOutputFormatter.js  # 新闻格式化
│   └── ...
│
├── utils/                      # 工具目录
│   ├── asyncTools.js           # 异步工具
│   ├── telegramPdf.js          # Telegram PDF 发送
│   └── ...
│
└── v3_dev/                     # v3 遗留代码
    └── services/
        └── lightweightTicketFormatter.js  # 解票格式化器
```

---

## 8. 运行方式

### 8.1 直接运行
```bash
node index.js
```

### 8.2 PM2 托管
```bash
pm2 start pm2.ecosystem.config.js
pm2 logs usis-brain
pm2 restart usis-brain
```

### 8.3 PM2 配置
```javascript
// pm2.ecosystem.config.js
module.exports = {
  apps: [{
    name: 'usis-brain',
    script: './index.js',
    instances: 1,
    max_memory_restart: '2G',
    autorestart: true,
    max_restarts: 10,
    watch: false
  }]
};
```

---

## 9. 依赖列表

```json
{
  "node-telegram-bot-api": "^0.66.0",  // Telegram Bot
  "telegraf": "^4.16.3",               // Telegram 框架 (备用)
  "node-fetch": "^2.7.0",              // HTTP 请求
  "express": "^5.1.0",                 // Web 框架 (可选 API)
  "pg": "^8.16.3",                     // PostgreSQL
  "pdfkit": "^0.17.2",                 // PDF 生成
  "sharp": "^0.34.5",                  // 图片处理
  "cheerio": "^1.1.2",                 // HTML 解析
  "rss-parser": "^3.13.0",             // RSS 解析
  "quickchart-js": "^3.1.3",           // 图表生成
  "@vitalets/google-translate-api": "^9.2.1"  // 翻译
}
```

---

## 10. 命令参考

### 10.1 用户命令

| 命令 | 示例 | 说明 |
|------|------|------|
| 解票 | `解票 NVDA` | 技术分析 |
| 解票 双语 | `解票 NVDA 双语` | 中英文分析 |
| 解票 聊天版 | `解票 NVDA 聊天版` | 交易员口吻 |
| 研报 | `研报 AAPL` | 文本研报 |
| 研报 逗号协议 | `研报, AAPL, cn` | NL-1 格式 |
| 研报PDF | `/reportpdf NVDA` | PDF 研报 |
| 研报PDF Pro | `/reportpdf pro NVDA zh` | Premium 中文 |
| 新闻 | `新闻 TSLA` | 新闻查询 |
| 热力图 | `热力图` | 默认 SP500 |
| 热力图 指定 | `热力图 纳指` | 纳斯达克 |
| 热力图 自然语言 | `看看科技股热力图` | NL-2 |
| 简报 | `简报 MSFT` | 极简研报 |
| 帮助 | `/help` | 使用说明 |

### 10.2 管理员命令

| 命令 | 说明 |
|------|------|
| `/status` | 系统状态 |
| `/bots` | Bot 模块列表 |
| `/errors` | 错误日志 |
| `/ping` | 心跳检测 |

---

## 11. 重要约束

### 11.1 n8n 约束
- n8n 启用了 `N8N_BLOCK_ENV_ACCESS_IN_NODE`
- 工作流中无法访问环境变量
- API Key 必须硬编码在工作流节点中

### 11.2 ScreenshotAPI 约束
- 只接受公网 HTTP/HTTPS URL
- 不支持本地路径、file:// 协议
- 不支持 localhost

### 11.3 Replit 约束
- `/mnt/data` 不存在（只读文件系统）
- 临时文件使用 `/tmp`
- transfer.sh 被屏蔽

### 11.4 Telegram 约束
- 单条消息最大 4096 字符
- 需要分页发送长内容
- 图片需 Buffer 或 URL

---

## 12. 故障排除

### 12.1 热力图失败
1. 检查 n8n 工作流状态
2. 确认 ScreenshotAPI Key 已硬编码
3. 查看 n8n 执行日志

### 12.2 解票超时
1. 检查 Finnhub API 配额
2. 确认 Browserless 服务可用
3. 查看 Vision AI 响应

### 12.3 研报失败
1. 检查 OpenAI API Key
2. 确认模型配额
3. 查看错误日志

---

## 13. 版本历史

| 版本 | 更新内容 |
|------|---------|
| v7.0 | 多Bot架构、单入口多模块 |
| v6.0 | Vision AI、增强数据 |
| v5.0 | NL-1 逗号协议 |
| v4.x | 智能降级、反编造 |

---

*文档生成时间: 2025-01-27*
*USIS Brain v7.0 - 机构级多AI股票分析系统*
