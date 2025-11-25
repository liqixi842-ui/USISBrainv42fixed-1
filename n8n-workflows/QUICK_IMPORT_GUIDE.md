# N8N Workflow v4.0 快速导入指南

## 📦 文件信息

**文件名**: `news-rss-collector-v4-global-premium.json`  
**节点总数**: 39个  
**新闻源**: 18个  
**更新频率**: 每5分钟  

---

## 🚀 快速导入步骤（3步完成）

### 步骤1：设置环境变量

在N8N中设置以下环境变量（Settings → Variables）：

```bash
# USIS Brain API地址
REPL_URL=https://your-replit-url.replit.dev

# 新闻摄取密钥（与USIS Brain的NEWS_INGESTION_SECRET保持一致）
NEWS_INGESTION_SECRET=your-secret-key-here
```

> ⚠️ **重要**：`NEWS_INGESTION_SECRET` 必须与USIS Brain中设置的密钥完全一致！

---

### 步骤2：导入Workflow

1. **打开N8N控制台**
   - 登录您的N8N实例
   - 点击左侧导航栏的 **"Workflows"**

2. **导入JSON文件**
   - 点击右上角 **"Import from File"** 或 **"Import from URL"**
   - 选择文件：`news-rss-collector-v4-global-premium.json`
   - 点击 **"Import"**

3. **验证导入**
   - 确认workflow名称：**"USIS News RSS Collector v4.0 - Global Premium Edition"**
   - 检查节点数量：**39个节点**（18个RSS + 18个Metadata + 3个系统节点）

---

### 步骤3：激活Workflow

1. **保存Workflow**
   - 点击右上角 **"Save"** 按钮

2. **激活定时任务**
   - 点击右上角的 **"Inactive"** 开关
   - 状态变为 **"Active"**（绿色）

3. **手动测试（可选）**
   - 点击 **"Execute Workflow"** 按钮
   - 查看执行日志，确认无错误
   - 检查USIS Brain日志，确认收到新闻数据

---

## ✅ 验证清单

导入后，请检查以下内容：

- [ ] **环境变量已设置**（REPL_URL, NEWS_INGESTION_SECRET）
- [ ] **Workflow已导入**（39个节点）
- [ ] **所有18个RSS源都存在**
  - [ ] WSJ, Financial Times, MarketWatch, TechCrunch
  - [ ] El Economista, Expansión（西班牙）
  - [ ] Globe and Mail, Financial Post（加拿大）
  - [ ] Börse Frankfurt（德国）
  - [ ] European Financial Review, ECB（欧洲）
  - [ ] Reuters (x2), Bloomberg, Investing.com, Seeking Alpha, Yahoo Finance
- [ ] **Merge节点配置正确**（Mode: Append）
- [ ] **HTTP Request节点配置正确**（POST到 /api/news/ingest）
- [ ] **Workflow已激活**（状态：Active）
- [ ] **手动测试成功**（执行无错误）
- [ ] **USIS Brain收到新闻**（检查日志）

---

## 🔍 18个新闻源列表

| # | 新闻源 | 地区 | Tier | RSS URL |
|---|--------|------|------|---------|
| 1 | WSJ | 美国 | 4 | `feeds.a.dj.com/rss/RSSMarketsMain.xml` |
| 2 | Financial Times | 欧洲 | 4 | `www.ft.com/companies?format=rss` |
| 3 | MarketWatch | 美国 | 4 | `www.marketwatch.com/rss/topstories` |
| 4 | TechCrunch | 全球 | 3 | `techcrunch.com/feed/` |
| 5 | El Economista | 西班牙 | 4 | `www.eleconomista.es/rss/rss-mercados.xml` |
| 6 | Expansión | 西班牙 | 4 | `www.expansion.com/rss/portada.xml` |
| 7 | Börse Frankfurt | 德国 | 4 | `www.boerse-frankfurt.de/en/rss` |
| 8 | European Financial Review | 欧洲 | 3 | `europeanfinancialreview.com/feed/` |
| 9 | Investing.com | 全球 | 3 | `www.investing.com/rss/news.rss` |
| 10 | ECB | 欧洲 | 5 | `www.ecb.europa.eu/rss/press.html` |
| 11 | Globe and Mail | 加拿大 | 4 | `theglobeandmail.com/.../business/` |
| 12 | Financial Post | 加拿大 | 4 | `financialpost.com/category/news/feed` |
| 13 | Reuters Business | 全球 | 4 | `feeds.reuters.com/reuters/businessNews` |
| 14 | Reuters Markets | 全球 | 4 | `feeds.reuters.com/reuters/markets` |
| 15 | Bloomberg | 全球 | 4 | `feeds.bloomberg.com/business/news.rss` |
| 16 | CNBC | 美国 | 4 | `www.cnbc.com/id/100003114/device/rss/rss.html` |
| 17 | Seeking Alpha | 全球 | 3 | `seekingalpha.com/feed.xml` |
| 18 | Yahoo Finance | 美国 | 3 | `finance.yahoo.com/news/rssindex` |

---

## 🛠️ Workflow架构

```
Schedule Trigger (每5分钟)
    ↓
    ├─ WSJ RSS → Add WSJ Metadata ──┐
    ├─ FT RSS → Add FT Metadata ────┤
    ├─ MarketWatch RSS → Metadata ──┤
    ├─ TechCrunch RSS → Metadata ───┤
    ├─ El Economista RSS → Metadata ┤
    ├─ Expansión RSS → Metadata ────┤
    ├─ Börse Frankfurt RSS → Meta ──┤
    ├─ EFR RSS → Metadata ──────────┤
    ├─ Investing.com RSS → Metadata ┤
    ├─ ECB RSS → Metadata ──────────┤
    ├─ Globe & Mail RSS → Metadata ─┤
    ├─ Financial Post RSS → Meta ───┤
    ├─ Reuters Biz RSS → Metadata ──┤
    ├─ Reuters Mkt RSS → Metadata ──┤
    ├─ Bloomberg RSS → Metadata ────┤
    ├─ CNBC RSS → Metadata ─────────┤
    ├─ Seeking Alpha RSS → Meta ────┤
    └─ Yahoo Finance RSS → Metadata ┘
                    ↓
              Merge All Feeds (Append Mode)
                    ↓
              Format for API
                    ↓
          POST to USIS Brain (/api/news/ingest)
          (Headers: X-News-Secret: {{NEWS_INGESTION_SECRET}})
```

---

## 🔧 常见问题排查

### 问题1：导入后节点数量不对
**解决方案**：
- 删除workflow，重新导入JSON文件
- 确保使用最新的 `news-rss-collector-v4-global-premium.json`

### 问题2：执行报错 "Missing environment variable"
**解决方案**：
- 检查N8N环境变量配置（Settings → Variables）
- 确保 `REPL_URL` 和 `NEWS_INGESTION_SECRET` 已设置

### 问题3：USIS Brain未收到新闻
**解决方案**：
- 检查USIS Brain日志：`grep "News/Ingest" /tmp/logs/*`
- 验证 `NEWS_INGESTION_SECRET` 在N8N和USIS Brain中是否一致
- 检查 `REPL_URL` 是否正确（应该是你的Replit URL）

### 问题4：某些RSS源无法获取
**解决方案**：
- 某些RSS源可能有地区限制或需要VPN
- 暂时禁用问题源，稍后重试
- 检查RSS URL是否仍然有效

---

## 📊 预期效果

### 每日新闻量
- **采集**: ~3,000-5,000 篇/天
- **去重后**: ~400-700 篇/天
- **Fastlane推送**: ~60-120 条（评分≥7）
- **2h摘要**: ~80-150 条
- **4h摘要**: ~50-100 条

### 地区分布
- 全球：40%
- 美国：30%
- 欧洲（含西班牙、德国）：20%
- 加拿大：10%

### Hashtag示例
```
#评分8分 #西班牙 #财报 #ElEconomista
#评分9分 #美国 #货币政策 #WSJ
#评分7分 #加拿大 #能源 #FinancialPost
#评分8分 #全球 #并购 #Bloomberg
```

---

## 🎯 下一步

导入成功后：

1. **监控执行日志**（前24小时）
   - 检查N8N执行历史
   - 确认无错误

2. **验证USIS Brain**
   - 检查新闻是否正确摄取
   - 验证hashtag是否正确生成

3. **测试Telegram推送**
   - 等待Fastlane推送（评分≥7的新闻）
   - 验证地区标签（#西班牙、#加拿大等）

4. **优化（可选）**
   - 根据实际新闻量调整更新频率
   - 添加更多新闻源（参考 `news-sources-config.json`）

---

**文件位置**: `n8n-workflows/news-rss-collector-v4-global-premium.json`  
**版本**: v4.0 Global Premium Edition  
**最后更新**: 2025-11-10  
**状态**: ✅ Ready for Import
