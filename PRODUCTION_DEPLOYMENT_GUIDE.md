# USIS Brain v6.0 生产部署指南
## myusis.net Production Configuration Guide

---

## 📋 目录
1. [环境变量配置](#1-环境变量配置)
2. [硬编码URL清单](#2-硬编码url清单)
3. [路由规范（v3 vs v5）](#3-路由规范v3-vs-v5)
4. [健康检查命令合集](#4-健康检查命令合集)
5. [N8N与Telegram接口关系图](#5-n8n与telegram接口关系图)

---

## 1. 环境变量配置

### ✅ .env 完整模板（生产服务器）

```bash
# ==========================================
# 1. 部署与域名配置
# ==========================================
REPLIT_DEPLOYMENT_URL=https://myusis.net
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# ==========================================
# 2. 数据库配置
# ==========================================
DATABASE_URL=postgresql://username:password@localhost:5432/usis_brain
ENABLE_DB=true

# ==========================================
# 3. AI模型API密钥（6个模型）
# ==========================================
# OpenAI（主力模型）
OPENAI_API_KEY=sk-proj-xxxxx

# Anthropic Claude（深度分析）
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Google Gemini（快速总结）
GOOGLE_AI_API_KEY=AIzaxxxxx

# DeepSeek（中文专用）
DEEPSEEK_API_KEY=sk-xxxxx

# Mistral（多语言推理）
MISTRAL_API_KEY=xxxxx

# Perplexity（实时搜索）
PERPLEXITY_API_KEY=pplx-xxxxx

# ==========================================
# 4. 金融数据API（3层级联）
# ==========================================
# Tier 1: Finnhub（美股主力）
FINNHUB_API_KEY=xxxxx

# Tier 2: Twelve Data（全球市场）
TWELVE_DATA_API_KEY=xxxxx

# Tier 3: Alpha Vantage（备用）
ALPHA_VANTAGE_API_KEY=xxxxx

# 宏观经济数据
FRED_API_KEY=xxxxx

# ==========================================
# 5. Telegram Bot配置
# ==========================================
# 生产Bot: @chaojilaos_bot (ID: 7944498422)
TELEGRAM_BOT_TOKEN=7944498422:xxxxx

# 开发Bot: @qixijiepiao_bot (ID: 8552043622)
TELEGRAM_BOT_TOKEN_DEV=8552043622:xxxxx

# ==========================================
# 6. PDF与截图服务
# ==========================================
# DocRaptor（PDF生成）
DOC_RAPTOR_API_KEY=yoDxGQJNb61fOC7--o0T
DOC_RAPTOR_TEST_MODE=false

# Browserless（截图主力）
BROWSERLESS_API_KEY=xxxxx

# ScreenshotAPI（截图备用）
SCREENSHOT_API_KEY=xxxxx

# ==========================================
# 7. N8N工作流集成
# ==========================================
N8N_BASE_URL=https://your-n8n.com
N8N_API_KEY=xxxxx
NEWS_INGESTION_SECRET=xxxxx
NEWS_CHANNEL_ID=-1001234567890

# ==========================================
# 8. 可选服务
# ==========================================
# Replicate（图像生成）
REPLICATE_API_TOKEN=r8_xxxxx

# Twitter API
TWITTER_BEARER_TOKEN=AAAAAAAAAxxxxx

# 系统开关
ENABLE_NEWS_SYSTEM=true
PRIMARY_MODEL=gpt-4o
```

---

## 2. 硬编码URL清单

### 🔍 需要修改的文件清单

#### **文件1: `v3_dev/services/devBotHandler.js`**
- **位置**: 第225-227行
- **当前内容**:
```javascript
const REPLIT_API_URL = process.env.REPLIT_DEPLOYMENT_URL || 
                       process.env.REPLIT_DEV_DOMAIN || 
                       'https://myusis.net';  // ✅ 已修复为 myusis.net
```
- **状态**: ✅ 已正确配置（默认值为myusis.net）
- **建议**: 保持现状，确保环境变量 `REPLIT_DEPLOYMENT_URL=https://myusis.net`

---

#### **文件2: `v3_dev/services/devBotHandler_backup.js`**
- **位置**: 第111-113行
- **当前内容**:
```javascript
const REPLIT_API_URL = process.env.REPLIT_DEPLOYMENT_URL || 
                       process.env.REPLIT_DEV_DOMAIN || 
                       'https://liqixi888.replit.app';  // ❌ 旧域名
```
- **推荐改为**:
```javascript
const REPLIT_API_URL = process.env.REPLIT_DEPLOYMENT_URL || 
                       process.env.REPLIT_DEV_DOMAIN || 
                       'https://myusis.net';  // ✅ 新域名
```
- **操作**: 修改默认值为 `myusis.net`

---

#### **文件3-N: 文档文件（仅供参考，非代码）**
以下文档文件包含旧域名示例，仅影响文档，不影响代码运行：

| 文件路径 | 类型 | 优先级 |
|---------|------|--------|
| `V4_UPGRADE_SUMMARY.md` | 文档 | 低 |
| `DEPLOYMENT_PACKAGE_READY.md` | 文档 | 中 |
| `REPLIT_SUPPORT_REQUEST.md` | 文档 | 低 |
| `N8N_MEMORY_INTEGRATION.md` | 文档 | 低 |
| `N8N_BRAIN_INTEGRATION.md` | 文档 | 中 |
| `TESTING_GUIDE.md` | 文档 | 中 |

**建议**: 批量搜索替换 `liqixi888.replit.app` → `myusis.net`

---

### 🛠️ 修复命令（服务器端）

```bash
# 1. 修复 devBotHandler_backup.js
cd /opt/usis-brain
nano v3_dev/services/devBotHandler_backup.js
# 找到第113行，将 'https://liqixi888.replit.app' 改为 'https://myusis.net'

# 2. 验证 devBotHandler.js 已正确配置
grep -n "myusis.net" v3_dev/services/devBotHandler.js
# 应该看到第227行包含 'https://myusis.net'

# 3. 批量替换文档中的旧域名（可选）
find . -name "*.md" -type f -exec sed -i 's/liqixi888\.replit\.app/myusis.net/g' {} +
find . -name "*.md" -type f -exec sed -i 's/node-js-liqixi842\.replit\.app/myusis.net/g' {} +

# 4. 重启应用
pm2 restart usis-brain
```

---

## 3. 路由规范（v3 vs v5）

### 📊 推荐路由设计

#### **v3 路由（生产稳定版）**

| 端点 | 方法 | 用途 | 服务 | 状态 |
|------|------|------|------|------|
| `GET /v3/report/test` | GET | 静态示例报告 | `v3_dev/routes/report.js` | ✅ 生产 |
| `GET /v3/report/:symbol` | GET | 动态研报生成 | `v3_dev/services/reportService.js` → `buildResearchReport()` | ✅ 生产 |
| `GET /v3/health` | GET | v3路由健康检查 | `v3_dev/routes/index.js` | ✅ 生产 |

**查询参数**:
```
?format=json|html|pdf|md
?asset_type=equity|index|etf|crypto
?brand=USIS Research
?firm=USIS Research Division
?analyst=System (USIS Brain)
```

**服务流程**:
```
v3_dev/routes/report.js 
  → buildResearchReport(symbol, asset_type, brandOptions)
    → buildHtmlFromReport(report)  # HTML格式
    → generatePdfWithDocRaptor(symbol, html)  # PDF格式
```

---

#### **v5 路由（实验版）**

**当前状态**: v5 **共享** v3 路由，通过内部逻辑区分

| 特性 | v3生产版 | v5实验版 |
|------|---------|---------|
| 路由入口 | `GET /v3/report/:symbol` | 同左（共享） |
| AI引擎 | v3.2 Multi-Model | v5.0 Advanced Writer |
| PDF模板 | 20页机构标准模板 | 多语言老师/机构人设 |
| 字体渲染 | ✅ 正常（DocRaptor UTF-8） | ⚠️ 部分乱码（调试中） |
| 对外使用 | ✅ 推荐 | ❌ 仅内测 |

**建议路由拆分（未来v5独立时）**:
```
# v3（保持不变）
GET /v3/report/:symbol?format=pdf

# v5（独立路由）
GET /v5/report/:symbol?lang=zh|en&persona=teacher|institution&format=pdf
```

---

#### **通用路由（核心API）**

| 端点 | 方法 | 用途 | 调用方 |
|------|------|------|--------|
| `GET /health` | GET | 全局健康检查 | N8N, Nginx, 监控系统 |
| `GET /version` | GET | 版本信息 | N8N, 监控 |
| `POST /brain/orchestrate` | POST | 主AI分析引擎 | N8N, Telegram Bot |
| `POST /brain/memory/clear` | POST | 清空用户记忆 | N8N Workflow |
| `GET /brain/stats` | GET | 系统统计 | N8N, 管理员 |

---

## 4. 健康检查命令合集

### 🏥 本机自检（绕过Nginx）

```bash
# === 基础健康检查 ===
curl -i http://127.0.0.1:3000/health

# 预期响应（200 OK）:
# {
#   "ok": true,
#   "status": "ok",
#   "pid": 12345,
#   "port": 3000,
#   "uptime": 3600,
#   "ts": 1700000000000,
#   "message": "HTTPS verified and healthy ✅"
# }

# === v3路由健康检查 ===
curl -i http://127.0.0.1:3000/v3/health

# 预期响应（200 OK）:
# {
#   "ok": true,
#   "message": "v3-dev routes mounted successfully"
# }

# === v3测试报告（JSON格式）===
curl -i "http://127.0.0.1:3000/v3/report/AAPL?format=json"

# 预期响应（200 OK，JSON对象）:
# {
#   "ok": true,
#   "env": "v3-dev",
#   "version": "v1",
#   "symbol": "AAPL",
#   "name": "Apple Inc.",
#   "rating": "BUY/HOLD/SELL",
#   "price": { "last": 180.5, ... },
#   "meta": { "generated_at": "2025-11-18T...", ... }
# }

# === Brain Orchestrate测试 ===
curl -X POST http://127.0.0.1:3000/brain/orchestrate \
  -H "Content-Type: application/json" \
  -d '{"text":"AAPL怎么样？","chat_type":"private","user_id":"test_user"}'

# 预期响应（200 OK）:
# {
#   "status": "ok",
#   "ok": true,
#   "final_text": "苹果公司（AAPL）...",
#   "actions": [...],
#   "symbols": ["AAPL"]
# }
```

---

### 🌐 生产域名检查（通过Nginx + HTTPS）

```bash
# === 全局健康检查 ===
curl -i https://myusis.net/health

# 预期响应:
# HTTP/2 200
# Content-Type: application/json
# {
#   "ok": true,
#   "status": "ok",
#   "message": "HTTPS verified and healthy ✅"
# }

# === v3路由健康检查 ===
curl -i https://myusis.net/v3/health

# === v3 JSON报告测试 ===
curl -i "https://myusis.net/v3/report/NVDA?format=json" | jq .

# 预期字段（JSON）:
# - ok: true
# - symbol: "NVDA"
# - name: "NVIDIA Corporation"
# - rating: "BUY" | "HOLD" | "SELL"
# - price: { last, change_abs, change_pct }
# - fundamentals: { revenue, eps, pe_ratio }
# - meta: { generated_at, model, latency_ms }

# === v3 PDF报告测试（60秒超时）===
timeout 70 curl "https://myusis.net/v3/report/NVDA?format=pdf" \
  -o /tmp/nvda_prod_test.pdf

# 验证PDF文件
ls -lh /tmp/nvda_prod_test.pdf
file /tmp/nvda_prod_test.pdf
# 预期: PDF document, 500-600 KB

# === Brain Orchestrate测试（生产环境）===
curl -X POST https://myusis.net/brain/orchestrate \
  -H "Content-Type: application/json" \
  -d '{"text":"AAPL最新分析","chat_type":"private","user_id":"prod_test"}' | jq .

# 预期字段:
# - status: "ok"
# - ok: true
# - final_text: "分析结果文本..."
# - actions: [ { name: "show_quote", symbol: "AAPL", ... } ]
# - symbols: ["AAPL"]
# - elapsed_ms: 2000-5000
```

---

### 🔍 完整系统诊断

```bash
# === 一键诊断脚本 ===
#!/bin/bash
echo "=== USIS Brain 生产环境健康检查 ==="
echo ""

echo "1. 全局健康检查..."
curl -s https://myusis.net/health | jq '.ok'

echo "2. v3路由健康检查..."
curl -s https://myusis.net/v3/health | jq '.ok'

echo "3. v3 JSON报告测试（AAPL）..."
curl -s "https://myusis.net/v3/report/AAPL?format=json" | jq '.ok, .symbol, .rating'

echo "4. Brain Orchestrate测试..."
curl -s -X POST https://myusis.net/brain/orchestrate \
  -H "Content-Type: application/json" \
  -d '{"text":"健康检查","chat_type":"private","user_id":"healthcheck"}' | jq '.ok'

echo ""
echo "=== 检查完成 ==="
```

---

## 5. N8N与Telegram接口关系图

### 🔗 N8N工作流 → USIS Brain调用清单

| N8N工作流名称 | HTTP节点 | 调用URL | 用途 | 优先级 |
|--------------|---------|---------|------|--------|
| **Telegram to Replit Brain Message Processing and Response** | `Call_Brain_Orchestrate` | `POST /brain/orchestrate` | 主分析引擎 | ⭐⭐⭐⭐⭐ |
| 同上 | `Clear_Memory_API` | `POST /brain/memory/clear` | 清空用户记忆 | ⭐⭐⭐⭐ |
| **USIS News RSS Collector v4.0** | `Ingest` | `POST /api/news/ingest` | 新闻推送 | ⭐⭐⭐ |
| **Stock Analysis Screenshot** | (通过n8nClient.js调用) | N8N API | 生成截图 | ⭐⭐ |

---

### 📋 需要修改的N8N节点清单

#### **工作流1: Telegram to Replit Brain Message Processing and Response**

**节点1: `Call_Brain_Orchestrate`**
- **当前URL**: `https://node-js-liqixi842.replit.app/brain/orchestrate`
- **修改为**: `https://myusis.net/brain/orchestrate`
- **方法**: POST
- **Body**:
```json
{
  "text": "{{ $json.message.text }}",
  "chat_type": "{{ $json.message.chat.type }}",
  "user_id": "{{ $json.message.from.id }}"
}
```

**节点2: `Clear_Memory_API`**
- **当前URL**: `https://node-js-liqixi842.replit.app/brain/memory/clear`
- **修改为**: `https://myusis.net/brain/memory/clear`
- **方法**: POST
- **Body**:
```json
{
  "user_id": "{{ $json.user_id }}"
}
```

---

#### **工作流2: USIS News RSS Collector v4.0**

**节点: `Ingest`**
- **当前URL**: `https://node-js-liqixi842.replit.app/api/news/ingest`
- **修改为**: `https://myusis.net/api/news/ingest`
- **方法**: POST
- **Headers**:
```json
{
  "X-News-Secret": "{{ $env.NEWS_INGESTION_SECRET }}"
}
```

---

### 🔄 修改优先级分级

| 优先级 | 工作流 | 影响 | 操作 |
|--------|--------|------|------|
| **P0 紧急** | Telegram Bot主流程 | 用户无法使用Bot | 立即修改 |
| **P1 高** | 新闻推送 | 新闻无法接收 | 本周修改 |
| **P2 中** | 截图生成 | 图表功能受限 | 下周修改 |
| **P3 低** | 测试/开发工作流 | 仅影响开发 | 按需修改 |

---

### 🛠️ N8N批量修改方法

#### **方法1: 通过N8N UI手动修改**
1. 登录N8N: `https://your-n8n-instance.com`
2. 打开工作流: `Telegram to Replit Brain Message Processing and Response`
3. 编辑节点 → 修改URL → 保存 → 激活

---

#### **方法2: 通过N8N API批量修改**

```bash
# 1. 获取工作流列表
curl -s -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
  "${N8N_BASE_URL}/api/v1/workflows" | jq '.data[] | {id, name}'

# 2. 下载指定工作流
WORKFLOW_ID="your_workflow_id"
curl -s -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
  "${N8N_BASE_URL}/api/v1/workflows/${WORKFLOW_ID}" > workflow_backup.json

# 3. 批量替换URL（使用sed或jq）
sed -i 's|node-js-liqixi842.replit.app|myusis.net|g' workflow_backup.json

# 4. 上传修改后的工作流
curl -X PUT \
  -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
  -H "Content-Type: application/json" \
  -d @workflow_backup.json \
  "${N8N_BASE_URL}/api/v1/workflows/${WORKFLOW_ID}"

# 5. 激活工作流
curl -X POST \
  -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
  "${N8N_BASE_URL}/api/v1/workflows/${WORKFLOW_ID}/activate"
```

---

### 📊 完整接口调用流程图

```
用户发送Telegram消息
    ↓
Telegram Bot API
    ↓
N8N: Telegram Trigger Node
    ↓
N8N: Call_Brain_Orchestrate
    ↓
POST https://myusis.net/brain/orchestrate
    {
      "text": "AAPL怎么样？",
      "chat_type": "private",
      "user_id": "123456"
    }
    ↓
USIS Brain (index.js)
    ├─ Language Detection
    ├─ Intent Parsing
    ├─ Symbol Resolution
    ├─ Multi-AI Analysis (GPT-4o/Claude/Gemini/DeepSeek)
    ├─ Action Generation
    └─ Response Formatting
    ↓
Response to N8N
    {
      "ok": true,
      "final_text": "分析结果...",
      "actions": [...]
    }
    ↓
N8N: Format Response Node
    ↓
N8N: Send Telegram Message
    ↓
用户收到回复
```

---

## 🎯 总结检查清单

### ✅ 服务器端配置
- [ ] `.env` 文件包含所有22个环境变量
- [ ] `REPLIT_DEPLOYMENT_URL=https://myusis.net`
- [ ] `DOC_RAPTOR_API_KEY` 拼写正确（第5个字符是G不是c）
- [ ] `index.js` 第1行包含 `require("dotenv").config()`
- [ ] `v3_dev/services/devBotHandler_backup.js` 默认URL改为myusis.net

### ✅ N8N工作流配置
- [ ] `Call_Brain_Orchestrate` 节点URL → `https://myusis.net/brain/orchestrate`
- [ ] `Clear_Memory_API` 节点URL → `https://myusis.net/brain/memory/clear`
- [ ] `Ingest` 节点URL → `https://myusis.net/api/news/ingest`

### ✅ 健康检查验证
- [ ] `curl https://myusis.net/health` 返回200
- [ ] `curl https://myusis.net/v3/health` 返回200
- [ ] `curl "https://myusis.net/v3/report/AAPL?format=json"` 返回完整JSON
- [ ] PDF生成测试通过（无乱码）

---

## 📞 故障排查联系点

| 服务 | 责任方 | 检查方法 |
|------|--------|---------|
| 域名解析 | DNS Provider | `nslookup myusis.net` |
| Nginx反向代理 | 服务器管理员 | `nginx -t && systemctl status nginx` |
| Node.js应用 | PM2进程管理 | `pm2 logs usis-brain --lines 50` |
| 数据库连接 | PostgreSQL | `psql $DATABASE_URL -c "SELECT NOW();"` |
| N8N工作流 | N8N管理员 | N8N UI Executions页面 |

---

**最后更新**: 2025-11-18  
**版本**: v6.0 Production  
**维护者**: USIS Team
