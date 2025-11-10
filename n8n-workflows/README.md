# USIS News System v2.0 - N8N 工作流配置指南

## 📋 概览

N8N作为"眼睛"负责采集新闻，USIS Brain作为"大脑"负责分析评分。

**分工：**
- **N8N**: 定时触发 → RSS采集 → 解析 → POST到USIS Brain
- **USIS Brain**: 接收 → 去重 → 评分 → 路由 → Telegram推送

---

## 🚀 快速开始

### 1. 在N8N中导入工作流

1. 登录您的N8N实例
2. 点击右上角 **Import from File**
3. 选择 `news-rss-collector.json`
4. 工作流导入成功！

### 2. 配置环境变量

在N8N设置中添加以下环境变量：

```bash
USIS_BRAIN_URL=https://your-repl-slug.replit.app
NEWS_INGESTION_SECRET=<生成一个强密码>
```

**生成SECRET：**
```bash
# 在Replit Shell中运行
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. 在USIS Brain中设置相同的SECRET

在Replit Secrets中添加：
```
NEWS_INGESTION_SECRET=<与N8N相同的密码>
```

### 4. 激活工作流

在N8N中点击工作流右上角的 **Activate** 开关。

✅ 完成！N8N现在每5分钟自动采集新闻并发送到USIS Brain。

---

## 📊 工作流说明

### 节点流程

```
Schedule (每5分钟)
  ↓
并行采集4个RSS源:
  - WSJ Markets
  - FT Companies  
  - MarketWatch
  - TechCrunch
  ↓
Merge All Feeds (合并)
  ↓
Parse RSS Items (解析XML)
  ↓
Send to USIS Brain (POST /api/news/ingest)
  ↓
Check Success (验证响应)
  ↓
Log Success / Log Error
```

### 采集源配置（Tier 4 + Tier 3）

| 源 | URL | Tier | 可靠性 |
|---|---|---|---|
| WSJ Markets | `https://feeds.a.dj.com/rss/RSSMarketsMain.xml` | 4 | 4.2 |
| FT Companies | `https://www.ft.com/companies?format=rss` | 4 | 4.2 |
| MarketWatch | `https://www.marketwatch.com/rss/topstories` | 4 | 4.2 |
| TechCrunch | `https://techcrunch.com/feed/` | 3 | 3.5 |

---

## 🔧 自定义配置

### 添加更多新闻源

1. 在N8N中复制现有的RSS节点（如"WSJ Markets RSS"）
2. 修改URL为新的RSS源
3. 添加到"Merge All Feeds"节点
4. 在解析节点中添加source名称和tier级别

**示例：添加Yahoo Finance**
```json
{
  "url": "https://finance.yahoo.com/news/rssindex",
  "source": "Yahoo Finance",
  "tier": 3
}
```

### 调整采集频率

修改"Schedule Every 5min"节点：
- 每1分钟：`minutesInterval: 1`
- 每15分钟：`minutesInterval: 15`
- 每小时：`hoursInterval: 1`

---

## 🛡️ 安全说明

### API认证

所有请求必须携带认证header：
```
Authorization: Bearer <NEWS_INGESTION_SECRET>
```

或
```
x-api-key: <NEWS_INGESTION_SECRET>
```

### 错误处理

USIS Brain返回的HTTP状态码：
- **200**: 成功
- **400**: 验证错误（缺少字段、格式错误）
- **401**: 认证失败（检查SECRET是否匹配）
- **500**: 服务器错误

---

## 📈 监控与调试

### 查看N8N执行日志

1. 在N8N工作流页面点击"Executions"
2. 查看每次执行的详细日志
3. 检查哪些新闻被成功发送，哪些失败

### 查看USIS Brain日志

在Replit Console中查看：
```
📰 [Ingest] Processing: Apple Reports Strong Q4...
📊 [Ingest] Score: 7.5/10 (fresh + high-impact)
🚀 [Ingest] Pushed to Fastlane: success
```

### 常见问题

**Q: 所有请求返回401**
A: 检查N8N和USIS Brain的`NEWS_INGESTION_SECRET`是否一致

**Q: 新闻被标记为duplicate**
A: 正常！去重系统在工作，24小时内相同URL会被跳过

**Q: Score太低被suppressed**
A: 新闻质量不够高（<3分），不会推送到Telegram

---

## 🎯 数据格式

### N8N发送的数据结构

```json
{
  "title": "Apple Reports Record Q4 Earnings",
  "url": "https://www.wsj.com/...",
  "summary": "Apple Inc announced quarterly earnings...",
  "published_at": "2025-11-10T15:30:00Z",
  "source": "WSJ",
  "tier": 4,
  "symbols": []
}
```

### USIS Brain返回的响应

**成功（Fastlane）：**
```json
{
  "ok": true,
  "action": "pushed",
  "channel": "fastlane",
  "score": 7.5,
  "message_id": "12345",
  "elapsed_ms": 234
}
```

**成功（Digest）：**
```json
{
  "ok": true,
  "action": "routed",
  "channel": "digest_2h",
  "score": 6.2,
  "elapsed_ms": 187
}
```

**跳过（重复）：**
```json
{
  "ok": true,
  "action": "skipped",
  "reason": "url_duplicate_within_24h",
  "elapsed_ms": 45
}
```

**错误：**
```json
{
  "ok": false,
  "error": "Missing required field: title",
  "stage": "validation",
  "httpStatus": 400
}
```

---

## 📚 进阶配置

### Tier 5源（官方/监管）

添加SEC和美联储RSS（需要额外配置）：

```javascript
// SEC EDGAR RSS
{
  "url": "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=&company=&dateb=&owner=include&start=0&count=40&output=atom",
  "source": "SEC EDGAR",
  "tier": 5
}

// Federal Reserve
{
  "url": "https://www.federalreserve.gov/feeds/press_all.xml",
  "source": "Federal Reserve",
  "tier": 5
}
```

### 批量处理

修改"Send to USIS Brain"节点的batching设置：
```json
{
  "batching": {
    "batch": {
      "batchSize": 10  // 每次发送10条新闻
    }
  }
}
```

---

## ✅ 验证清单

部署前检查：
- [ ] N8N工作流已导入并激活
- [ ] `USIS_BRAIN_URL`环境变量已设置
- [ ] `NEWS_INGESTION_SECRET`在N8N和USIS Brain中一致
- [ ] USIS Brain的数据库schema已初始化（`node init-news-schema.js`）
- [ ] `NEWS_CHANNEL_ID`已在Replit Secrets中配置
- [ ] 手动测试：在N8N中点击"Execute Workflow"查看是否成功

---

## 🆘 技术支持

遇到问题？检查：
1. N8N执行日志（Executions标签）
2. USIS Brain Console日志（Replit）
3. Telegram频道是否收到推送

**关键指标：**
- 采集成功率：>90%
- 去重率：20-40%（正常）
- Fastlane推送：高分新闻（≥7分）
- Digest积压：定期2h/4h发送
