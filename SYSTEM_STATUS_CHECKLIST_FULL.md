# 🔍 USIS Brain v7.0 系统状况完整检查清单
**检查时间**: 2025-11-25 13:20 UTC
**检查人**: Replit Agent
**Git Commit**: 6dfa110b31b9ea49c250f8e20582800d3325a03e

---

## 📋 执行摘要

### ✅ 系统可用组件
- PostgreSQL 数据库 (端口 5432)
- PM2 进程管理器 (已安装但空闲)
- n8n 集成 (外部托管: qian.app.n8n.cloud)
- Telegram Bot Token (已配置)
- 完整的部署包 (usis-brain-deploy.tar.gz, 31MB, 335文件)

### ❌ 关键缺失组件
- **主应用未运行** (index.js 未启动)
- **HTTP API 服务器下线** (端口 3000/7070 无响应)
- **Telegram Bot 离线** (无进程监听)
- **ORCHESTRATE_ENDPOINT 未配置**
- **项目结构混乱** (两套代码共存)

---

## 1️⃣ 代码版本与Git状态

### ✅ Git 仓库信息
```
分支: main
提交: 6dfa110b31b9ea49c250f8e20582800d3325a03e
最近提交:
  - 6dfa110: Add script to check n8n execution logs
  - 5939cdf: Fix screenshot generation workflow
  - 142d63d: Add new scripts to test n8n workflows
  - 1913981: Add dedicated workflow for ScreenshotAPI
  - bb17313: Add keyword shortcuts for heatmap requests
```

### ⚠️ 代码双轨问题

**发现两套不同的代码结构**：

#### 结构 A: 当前工作区 (/home/runner/workspace)
```
├── bots/                    # 8个独立bot模块
│   ├── brief-bot.js
│   ├── heatmap-bot.js
│   ├── manager-bot.js
│   ├── news-bot.js
│   ├── public-bot.js
│   ├── report-bot.js
│   ├── supervisor-bot.js
│   └── ticket-bot.js
├── gpt5Brain.js
├── check-*.js               # 各种测试脚本
└── usis-brain-deploy.tar.gz # 压缩的完整系统
```

#### 结构 B: 部署包内容 (usis-brain-deploy.tar.gz)
```
├── index.js                 # 主入口文件 ✅
├── package.json             # 依赖配置
├── daemon.sh                # 守护进程脚本
├── 40+ 核心模块:
│   ├── analysisPrompt.js
│   ├── dataBroker.js
│   ├── gpt5Brain.js
│   ├── heatmapService.js
│   ├── multiAiProvider.js
│   ├── n8nClient.js
│   ├── newsBroker.js
│   ├── symbolResolver.js
│   └── ... (30+ 更多模块)
└── config/, scripts/
```

**❗ 问题**: 当前工作区缺少 `index.js` 主入口，需要从部署包提取

---

## 2️⃣ 环境变量状态

### ✅ 已正确配置 (15项)
```bash
✅ TELEGRAM_BOT_TOKEN       = 83138937** (已设置)
✅ TELEGRAM_BOT_TOKEN_DEV   = 83138937** (已设置)
✅ N8N_BASE_URL             = https://qian.app.n8n.cloud
✅ N8N_API_KEY              = eyJhbGci** (已设置)
✅ N8N_HEATMAP_WEBHOOK      = https://qian.app.n8n.cloud/webhook/heatmap_fixed
✅ N8N_STOCK_WEBHOOK        = https://qian.app.n8n.cloud/webhook/stock_analysis_full
✅ DATABASE_URL             = (已设置)
✅ PGPORT                   = 5432
✅ PGUSER                   = (已设置)
✅ PGPASSWORD               = (已设置)
✅ PGDATABASE               = (已设置)
✅ PGHOST                   = (已设置)
✅ DOC_RAPTOR_API_KEY       = (已设置)
✅ TWELVE_DATA_API_KEY      = (已设置)
✅ REPLIT_ENVIRONMENT       = production
```

### ❌ 缺失的关键变量 (估计 10-15项)

根据 index.js 分析，以下变量**可能**需要但未设置：

```bash
❌ ORCHESTRATE_ENDPOINT      # HTTP API 基础URL (必需)
❌ PORT                       # 服务器端口 (默认3000)
❌ OPENAI_API_KEY             # GPT-4o/4o-mini (核心)
❌ ANTHROPIC_API_KEY          # Claude 3.5 Sonnet
❌ GOOGLE_AI_API_KEY          # Gemini 2.5 Flash
❌ DEEPSEEK_API_KEY           # DeepSeek V3
❌ MISTRAL_API_KEY            # Mistral Large
❌ PERPLEXITY_API_KEY         # Sonar Pro
❌ FINNHUB_API_KEY            # 股票数据主要源
❌ ALPHA_VANTAGE_API_KEY      # 股票数据备用源
❌ FRED_API_KEY               # 美联储经济数据
❌ BROWSERLESS_API_KEY        # 截图服务
❌ SCREENSHOT_API_KEY         # 备用截图服务
❌ TWITTER_API_KEY            # Twitter 搜索
❌ REPLICATE_API_KEY          # 图像生成
```

**⚠️ 无法确认**: 因为没有 `.env` 文件或 `SECRETS` 配置导出

---

## 3️⃣ 运行进程状态

### ❌ 核心服务 - 全部离线
```
❌ USIS Brain 主应用    (index.js)         状态: 未运行
❌ HTTP API 服务器      (端口 3000)        状态: 端口关闭
❌ Telegram Bot         (Telegraf)         状态: 离线
❌ 定时任务调度器       (node-cron)        状态: 未激活
```

### ⚠️ PM2 进程管理器
```bash
PM2 状态: ✅ 已安装并运行 (守护进程PID存在)
PM2 应用列表: ❌ 空 (0个应用)

当前 PM2 输出:
┌────┬────────────────────┬──────────┬──────┬───────────┬──────────┬──────────┐
│ id │ name               │ mode     │ ↺    │ status    │ cpu      │ memory   │
└────┴────────────────────┴──────────┴──────┴───────────┴──────────┴──────────┘
```

**建议**: 需要执行 `pm2 start index.js --name usis-brain`

### ✅ 后台进程（非USIS相关）
```
✅ TypeScript Language Server (多个实例)
✅ tsserver (编译服务)
```

---

## 4️⃣ HTTP 接口可达性

### ❌ 本地接口测试
```bash
测试 1: http://127.0.0.1:7070/brain/assistant
结果: ❌ Connection refused (端口未监听)

测试 2: http://127.0.0.1:3000/health
结果: ❌ Connection refused (端口未监听)

测试 3: ORCHESTRATE_ENDPOINT
结果: ❌ 环境变量未设置
```

### 📍 预期的API端点（基于 index.js 分析）
```javascript
// 健康检查
GET  /_replit_health           # Replit健康检查 (必需)
GET  /health                   # 简单健康检查
GET  /health/full              # 完整健康检查
GET  /version                  # 版本信息

// 核心分析
POST /api/analyze              # 主分析入口 (Telegram消息)
POST /brain/ping               # 心跳测试
POST /brain/feed               # 数据推送

// 新闻系统
POST /api/news/ingest          # 新闻摄入
POST /api/news/collect-rss     # RSS采集

// 报告系统
POST /api/report/company       # 公司报告生成

// 热力图
GET  /heatmap                  # 热力图生成

// 工具接口
POST /debug/symbol_resolver_test  # 符号解析测试
GET  /social/twitter/search    # Twitter搜索
POST /mj/imagine               # Midjourney图像生成

// 统计
GET  /brain/stats              # 系统统计
GET  /health/requests          # 请求统计
```

---

## 5️⃣ n8n 工作流状态

### ✅ n8n 基础配置
```
n8n 实例: ✅ 外部托管 (https://qian.app.n8n.cloud)
API Key:  ✅ 已配置
Webhook:  ✅ 已配置 (2个)
```

### ✅ 已确认工作的 Workflows

#### 1. Heatmap Screenshot (ID: GaMjrt46sxzrIEry)
```
名称: Heatmap Screenshot FIXED
Webhook: https://qian.app.n8n.cloud/webhook/heatmap_fixed
状态: ✅ 正常工作
测试: ✅ 通过 (2025-11-25)
功能: 接收任意HTTP/HTTPS URL → ScreenshotAPI截图 → 返回图片URL

测试结果示例:
输入: https://github.githubassets.com/.../GitHub-Mark.png
输出: https://s3.eu-central-2.wasabisys.com/.../github_githubassets_com...png
延迟: ~5-8秒
```

#### 2. Stock Analysis (推测)
```
Webhook: https://qian.app.n8n.cloud/webhook/stock_analysis_full
状态: ⚠️ 未测试
功能: (推测) 股票全面分析工作流
```

### ❌ n8n CLI 不可用
```
原因: n8n 托管在外部云服务，本地无CLI
替代方案: 通过 Web UI 导出 (Settings → Backup → Download)
```

---

## 6️⃣ 数据库状态

### ✅ PostgreSQL 连接信息
```
状态: ✅ 可用
主机: (Neon托管)
端口: 5432
环境变量: ✅ 全部已配置
  - DATABASE_URL
  - PGHOST
  - PGPORT  
  - PGUSER
  - PGPASSWORD
  - PGDATABASE
```

### ⚠️ 数据库 Schema - 未验证
```sql
-- 预期的表（基于代码分析）:
- conversations          # 对话历史
- cost_tracking          # 成本追踪
- news_articles          # 新闻文章
- news_routing_config    # 新闻路由配置
- (可能还有更多表)
```

**建议**: 需要运行 `psql $DATABASE_URL -c "\dt"` 查看实际schema

---

## 7️⃣ 依赖包状态

### ✅ 已安装的 npm 包 (从当前 package.json)
```json
{
  "@vitalets/google-translate-api": "^9.2.1",
  "axios": "^1.13.2",
  "cheerio": "^1.1.2",
  "dotenv": "^16.0.0",
  "express": "^5.1.0",
  "form-data": "^4.0.4",
  "node-cron": "^4.2.1",
  "node-fetch": "^2.7.0",
  "node-telegram-bot-api": "^0.64.0",
  "pdf-parse": "^1.1.1",
  "pdfkit": "^0.17.2",
  "pg": "^8.16.3",
  "quickchart-js": "^3.1.3",
  "rss-parser": "^3.13.0",
  "sharp": "^0.33.5",
  "telegraf": "^4.16.3"
}
```

### ⚠️ 部署包的依赖（可能不同）
```json
{
  "dependencies": {
    "@vitalets/google-translate-api": "^9.2.1",
    "axios": "^1.13.2",
    "cheerio": "^1.1.2",
    "express": "^5.1.0",
    "form-data": "^4.0.4",
    "node-cron": "^4.2.1",
    "node-fetch": "^2.7.0",
    "pdfkit": "^0.17.2",
    "pg": "^8.16.3",
    "quickchart-js": "^3.1.3",
    "rss-parser": "^3.13.0",
    "telegraf": "^4.16.3"
  }
}
```

**差异**: 部署包缺少 `dotenv`, `node-telegram-bot-api`, `pdf-parse`, `sharp`

---

## 8️⃣ 文件完整性检查

### ✅ 部署包内容 (335个文件)
```
核心模块 (40+个):
✅ index.js                    # 主入口
✅ package.json
✅ daemon.sh                   # 守护进程脚本
✅ analysisPrompt.js
✅ complianceGuard.js
✅ conversationAgent.js
✅ dataBroker.js
✅ dialogueManager.js
✅ gpt5Brain.js
✅ heatmapIntentParser.js
✅ heatmapService.js
✅ multiAiProvider.js          # 多AI路由
✅ multiLanguageAnalyzer.js
✅ n8nClient.js
✅ newsBroker.js
✅ responseFormatter.js
✅ semanticIntentAgent.js
✅ stockChartService.js
✅ symbolResolver.js
✅ visionAnalyzer.js
✅ (还有20+个模块)

配置文件:
✅ config/models.json
✅ pm2.ecosystem.config.js

文档 (50+个MD文件):
✅ QUICK_START.md
✅ DEPLOYMENT_READY.md
✅ ARCHITECTURE_*.md
✅ (各种指南和报告)
```

### ❌ 当前工作区缺失
```
❌ index.js                    # 主入口未提取
❌ package.json                # 依赖配置不同步
❌ 40+ 核心模块                # 全部在压缩包内
```

---

## 9️⃣ 架构一致性分析

### ⚠️ 发现的架构矛盾

#### replit.md 描述的架构
```
- 全栈 JS 应用 (Express + Vite)
- 代码在 server/ 和 client/ 目录
- 前端使用 React + shadcn/ui
- 后端使用 Drizzle ORM
```

#### 实际存在的架构
```
- Telegram Bot + Express API 后端
- ❌ 没有 server/ 目录
- ❌ 没有 client/ 目录
- ❌ 没有前端代码
- ✅ 有 bots/ 目录 (8个独立模块)
- ✅ 有完整的后端系统 (在tar.gz中)
```

**结论**: replit.md **严重过时**或**描述了错误的项目**

### 实际系统架构（基于 index.js 分析）

```
┌─────────────────────────────────────────────────┐
│          USIS Brain v6.0 架构                   │
│                                                  │
│  ┌────────────┐         ┌──────────────┐       │
│  │  Telegram  │────────▶│   index.js   │       │
│  │    Bot     │         │  (主入口)     │       │
│  └────────────┘         └──────┬───────┘       │
│                                 │               │
│                         ┌───────▼────────┐      │
│                         │  Express API   │      │
│                         │  (端口 3000)   │      │
│                         └───────┬────────┘      │
│                                 │               │
│         ┌───────────────────────┼────────────┐  │
│         │                       │            │  │
│    ┌────▼─────┐        ┌───────▼──────┐  ┌──▼──┐ │
│    │ 多AI路由  │        │  数据代理    │  │ n8n │ │
│    │(6个模型) │        │ (Finnhub等)  │  │集成 │ │
│    └────┬─────┘        └───────┬──────┘  └──┬──┘ │
│         │                      │            │  │
│    ┌────▼──────────────────────▼────────────▼──┐ │
│    │         PostgreSQL Database              │ │
│    │     (对话历史 + 成本追踪 + 新闻)          │ │
│    └──────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## 🔟 启动清单 - 需要执行的步骤

### 阶段 1: 代码准备 ✅ 可立即执行
```bash
# 1. 提取部署包到工作区
cd /home/runner/workspace
tar -xzf usis-brain-deploy.tar.gz

# 2. 验证文件完整性
ls -lah index.js package.json daemon.sh
```

### 阶段 2: 环境变量补全 ⚠️ 需要用户提供
```bash
# 必须设置的API密钥 (至少3个):
- OPENAI_API_KEY              # GPT-4o (核心)
- FINNHUB_API_KEY              # 股票数据
- ORCHESTRATE_ENDPOINT         # API基础URL

# 可选但推荐:
- ANTHROPIC_API_KEY            # Claude 3.5
- GOOGLE_AI_API_KEY            # Gemini 2.5
- DEEPSEEK_API_KEY             # DeepSeek V3
- SCREENSHOT_API_KEY           # 截图服务
```

### 阶段 3: 数据库初始化 ⚠️ 需要验证
```bash
# 检查数据库schema
psql $DATABASE_URL -c "\dt"

# 如果为空，运行初始化脚本
node init-news-schema.js  # (如果存在)
```

### 阶段 4: 服务启动 ⚠️ 等待前3步完成
```bash
# 方法 1: PM2 启动 (推荐)
pm2 start index.js --name usis-brain
pm2 logs usis-brain

# 方法 2: 直接启动
node index.js

# 方法 3: 守护进程
./daemon.sh
```

### 阶段 5: 健康检查 ⚠️ 启动后执行
```bash
# 检查 HTTP API
curl http://localhost:3000/health

# 检查完整健康
curl http://localhost:3000/health/full

# 检查版本
curl http://localhost:3000/version

# 检查 Telegram Bot
# (在 Telegram 中发送消息测试)
```

---

## 📊 优先级评分

| 任务 | 紧急度 | 影响 | 难度 | 优先级 |
|-----|-------|------|------|--------|
| 提取部署包 | 🔴 高 | 🔴 高 | 🟢 低 | **P0** |
| 设置 OPENAI_API_KEY | 🔴 高 | 🔴 高 | 🟢 低 | **P0** |
| 设置 FINNHUB_API_KEY | 🔴 高 | 🔴 高 | 🟢 低 | **P0** |
| 启动 index.js | 🔴 高 | 🔴 高 | 🟢 低 | **P0** |
| 验证数据库schema | 🟡 中 | 🔴 高 | 🟡 中 | **P1** |
| 配置其他AI API | 🟡 中 | 🟡 中 | 🟢 低 | **P2** |
| 更新 replit.md | 🟢 低 | 🟢 低 | 🟢 低 | **P3** |

---

## ✅ 下一步行动建议

### 立即可做（无需用户确认）:
1. ✅ **提取部署包到工作区**
2. ✅ **检查数据库状态**
3. ✅ **验证环境变量完整性**

### 需要用户提供:
1. ❌ **OPENAI_API_KEY** (必需)
2. ❌ **FINNHUB_API_KEY** (必需)
3. ❌ **其他 AI API 密钥** (可选)

### 启动后测试:
1. ⏸️ HTTP API 健康检查
2. ⏸️ Telegram Bot 测试
3. ⏸️ n8n 工作流集成测试
4. ⏸️ 完整的股票分析测试

---

## 📝 备注

**检查人**: Replit Agent  
**项目路径**: /home/runner/workspace  
**部署包**: usis-brain-deploy.tar.gz (31MB, 335文件)  
**当前状态**: 🔴 系统离线，需要提取并启动  
**预计修复时间**: 5-10分钟（假设API密钥已准备）

**特殊说明**:
- n8n heatmap workflow 已验证正常工作 ✅
- 当前工作区的 bots/ 目录与部署包架构不同，用途未知
- replit.md 描述的前端架构不存在，需要更新文档
