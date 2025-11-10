# N8N新闻系统手动测试指南

## 🎯 测试目标

验证N8N → USIS Brain完整数据流：认证 → 去重 → 评分 → 路由 → Telegram推送

---

## ✅ 前置条件检查

在Replit Console运行：
```bash
echo "NEWS_INGESTION_SECRET: ${NEWS_INGESTION_SECRET:0:10}..."
echo "NEWS_CHANNEL_ID: $NEWS_CHANNEL_ID"
echo "ENABLE_NEWS_SYSTEM: $ENABLE_NEWS_SYSTEM"
```

应该显示：
- ✅ NEWS_INGESTION_SECRET: e0f45c967...
- ✅ NEWS_CHANNEL_ID: -4997808098
- ✅ ENABLE_NEWS_SYSTEM: true

---

## 📝 测试步骤

### 测试1：验证API端点可访问

在Replit Shell运行：
```bash
curl -s http://localhost:5000/health | head -20
```

**期望结果：**
```json
{
  "ok": true,
  "status": "ok",
  "database": {"healthy": true, ...}
}
```

---

### 测试2：API认证 - 无效密钥（应返回401）

```bash
curl -X POST http://localhost:5000/api/news/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid-key-12345" \
  -d '{"title":"Test","url":"https://test.com/1","summary":"Test","published_at":"2025-11-10T12:00:00Z","source":"Test","tier":4,"symbols":[]}'
```

**期望结果：**
```json
{
  "ok": false,
  "error": "Unauthorized: Missing or invalid API key",
  "stage": "authentication"
}
```
HTTP状态码：**401**

---

### 测试3：API认证 - 有效密钥（应返回200）

```bash
curl -X POST http://localhost:5000/api/news/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $NEWS_INGESTION_SECRET" \
  -d '{
    "title": "Apple Reports Record Q4 Earnings, Stock Surges 5%",
    "url": "https://test-manual.wsj.com/apple-earnings-'$(date +%s)'",
    "summary": "Apple Inc announced record quarterly earnings with revenue exceeding expectations. iPhone sales drove growth.",
    "published_at": "'$(date -Iseconds)'",
    "source": "WSJ",
    "tier": 4,
    "symbols": ["AAPL"]
  }'
```

**期望结果（高分新闻）：**
```json
{
  "ok": true,
  "action": "pushed",
  "channel": "fastlane",
  "score": 7.2,
  "message_id": "12345"
}
```

或者（低分新闻）：
```json
{
  "ok": true,
  "action": "routed",
  "channel": "digest_2h",
  "score": 5.8
}
```

---

### 测试4：URL去重（发送相同URL两次）

**第一次：**
```bash
curl -X POST http://localhost:5000/api/news/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $NEWS_INGESTION_SECRET" \
  -d '{
    "title": "Duplicate Test Article",
    "url": "https://test-duplicate.com/same-url-123",
    "summary": "This article will test deduplication.",
    "published_at": "'$(date -Iseconds)'",
    "source": "MarketWatch",
    "tier": 4,
    "symbols": []
  }'
```

**期望结果：** `"action": "routed"` 或 `"action": "pushed"`

**第二次（立即重复）：**
```bash
curl -X POST http://localhost:5000/api/news/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $NEWS_INGESTION_SECRET" \
  -d '{
    "title": "Duplicate Test Article",
    "url": "https://test-duplicate.com/same-url-123",
    "summary": "This article will test deduplication.",
    "published_at": "'$(date -Iseconds)'",
    "source": "MarketWatch",
    "tier": 4,
    "symbols": []
  }'
```

**期望结果：**
```json
{
  "ok": true,
  "action": "skipped",
  "reason": "url_duplicate_within_24h"
}
```

---

### 测试5：检查Telegram推送

**高分新闻（≥7分）应该立即推送到Telegram！**

打开您的 **全球金融新闻群**，应该看到类似消息：
```
🚨 突发快讯

Apple Reports Record Q4 Earnings, Stock Surges 5%

💡 摘要：
Apple Inc announced record quarterly earnings...

📊 评分：7.2/10
🔖 标签：AAPL
📰 来源：WSJ (Tier 4)
🔗 详情：https://test-manual.wsj.com/...
```

---

### 测试6：查看数据库记录

在Replit Shell运行：
```bash
node -e "
const { safeQuery } = require('./dbUtils');
(async () => {
  const items = await safeQuery('SELECT id, title, LEFT(url, 50) as url, fetched_at FROM news_items ORDER BY fetched_at DESC LIMIT 5');
  console.log('Recent News Items:');
  console.table(items.rows);
  
  const scores = await safeQuery('SELECT ni.title, ns.composite_score, ns.freshness, ns.source_quality FROM news_scores ns JOIN news_items ni ON ns.news_item_id = ni.id ORDER BY ns.scored_at DESC LIMIT 5');
  console.log('\nRecent Scores:');
  console.table(scores.rows);
})();
"
```

**期望结果：** 应该看到刚才测试的新闻记录和评分

---

## 📊 评分参考

新闻会根据7个因素自动评分（0-10分）：

| 分数范围 | 渠道 | 推送时间 |
|---------|------|---------|
| ≥7.0 | Fastlane | 立即推送到Telegram |
| 5.0-6.9 | 2小时摘要 | 每2小时批量推送 |
| 3.0-4.9 | 4小时摘要 | 每4小时批量推送 |
| <3.0 | 抑制 | 不推送 |

**高分关键词：**
- "breaking", "record", "surge", "plunge"
- "earnings", "revenue", "profit"
- "Fed", "rate", "regulation"
- 包含股票代码（symbols数组）

---

## 🔍 查看系统日志

在Replit Console查看实时日志：

```
📰 [Ingest] Processing: Apple Reports Record...
📊 [Ingest] Score: 7.5/10 (fresh + high-impact + corroboration)
🚀 [Ingest] Pushed to Fastlane: success (message_id: 12345)
```

或者：
```
📰 [Ingest] Processing: Minor tech update...
📊 [Ingest] Score: 4.2/10
🔀 [Router] Routed to digest_4h
```

---

## ✅ 测试完成检查清单

- [ ] API健康检查返回200
- [ ] 无效密钥返回401错误
- [ ] 有效密钥成功处理新闻
- [ ] 重复URL被正确去重
- [ ] 高分新闻（≥7分）立即推送到Telegram
- [ ] 数据库中能查到测试记录
- [ ] 日志显示评分和路由信息

---

## 🆘 常见问题

### Q: 所有请求返回401
**A:** 检查 NEWS_INGESTION_SECRET 是否正确设置：
```bash
echo $NEWS_INGESTION_SECRET | wc -c  # 应该是65字符（64位+换行）
```

### Q: 新闻没有推送到Telegram
**A:** 检查NEWS_CHANNEL_ID是否正确，Bot是否有发送消息权限

### Q: 评分太低（<3分）
**A:** 尝试添加高分关键词：earnings, breaking, surge, record等

### Q: 数据库查询报错
**A:** 确认已运行 `node init-news-schema.js` 初始化数据库

---

## 📈 下一步：N8N工作流测试

完成手动测试后，在N8N导入 `n8n-workflows/news-rss-collector.json` 并激活，N8N将每5分钟自动采集新闻并发送到此API。

详见：`n8n-workflows/README.md`
