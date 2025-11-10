# USIS News v4.0 - Global Premium Edition 新闻源配置指南

## 📊 总览

**版本**: v4.0 Global Premium Edition  
**新闻源总数**: 18个  
**覆盖地区**: 美国、加拿大、西班牙、德国、欧洲、全球  
**更新频率**: 每5分钟  

---

## 🌍 新闻源分布

### 地区覆盖

| 地区 | 数量 | 新闻源 |
|------|------|--------|
| 🌍 全球 | 6 | Reuters (x2), Bloomberg, Investing.com, TechCrunch, Seeking Alpha, Yahoo Finance |
| 🇺🇸 美国 | 4 | WSJ, MarketWatch, CNBC, Yahoo Finance |
| 🇪🇺 欧洲 | 3 | Financial Times, European Financial Review, ECB |
| 🇪🇸 西班牙 | 2 | El Economista, Expansión |
| 🇨🇦 加拿大 | 2 | Globe and Mail, Financial Post |
| 🇩🇪 德国 | 1 | Börse Frankfurt |

### Tier分布

| Tier | 数量 | 权威性 | 新闻源 |
|------|------|--------|--------|
| 5 | 1 | 官方/监管 | ECB |
| 4 | 12 | 顶级媒体 | WSJ, FT, MarketWatch, El Economista, Expansión, Börse Frankfurt, Globe and Mail, Financial Post, Reuters (x2), Bloomberg, CNBC |
| 3 | 5 | 行业媒体 | TechCrunch, European Financial Review, Investing.com, Seeking Alpha, Yahoo Finance |

---

## 📋 完整新闻源列表

### 1. WSJ Markets (美国, Tier 4)
- **URL**: `https://feeds.a.dj.com/rss/RSSMarketsMain.xml`
- **覆盖**: 美国股市、美联储政策、标普500
- **语言**: English

### 2. Financial Times (欧洲, Tier 4)
- **URL**: `https://www.ft.com/companies?format=rss`
- **覆盖**: 全球金融、伦敦证交所、欧洲市场
- **语言**: English

### 3. MarketWatch (美国, Tier 4)
- **URL**: `https://www.marketwatch.com/rss/topstories`
- **覆盖**: 美国股市、投资建议
- **语言**: English

### 4. TechCrunch (全球, Tier 3)
- **URL**: `https://techcrunch.com/feed/`
- **覆盖**: 科技创业、风险投资
- **语言**: English

### 5. El Economista (西班牙, Tier 4) ⭐
- **URL**: `https://www.eleconomista.es/rss/rss-mercados.xml`
- **覆盖**: IBEX 35, 西班牙经济, 西班牙银行
- **语言**: Spanish

### 6. Expansión (西班牙, Tier 4) ⭐
- **URL**: `https://www.expansion.com/rss/portada.xml`
- **覆盖**: 西班牙企业, 市场分析
- **语言**: Spanish

### 7. Börse Frankfurt (德国, Tier 4)
- **URL**: `https://www.boerse-frankfurt.de/en/rss`
- **覆盖**: DAX, 德国股市
- **语言**: English/German

### 8. European Financial Review (欧洲, Tier 3)
- **URL**: `https://europeanfinancialreview.com/feed/`
- **覆盖**: 欧盟银行、金融政策
- **语言**: English

### 9. Investing.com (全球, Tier 3)
- **URL**: `https://www.investing.com/rss/news.rss`
- **覆盖**: 多市场实时行情
- **语言**: English

### 10. ECB Press Releases (欧洲, Tier 5) 🏛️
- **URL**: `https://www.ecb.europa.eu/rss/press.html`
- **覆盖**: 欧洲央行货币政策（最高权威）
- **语言**: English

### 11. Globe and Mail (加拿大, Tier 4) ⭐
- **URL**: `https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/business/`
- **覆盖**: 加拿大商业、TSX股市
- **语言**: English

### 12. Financial Post (加拿大, Tier 4) ⭐
- **URL**: `https://financialpost.com/category/news/feed`
- **覆盖**: 加拿大经济、能源行业
- **语言**: English

### 13. Reuters Business (全球, Tier 4)
- **URL**: `http://feeds.reuters.com/reuters/businessNews`
- **覆盖**: 全球商业新闻
- **语言**: English

### 14. Reuters Markets (全球, Tier 4)
- **URL**: `http://feeds.reuters.com/reuters/markets`
- **覆盖**: 全球金融市场
- **语言**: English

### 15. Bloomberg Business (全球, Tier 4)
- **URL**: `https://feeds.bloomberg.com/business/news.rss`
- **覆盖**: 全球经济、市场分析
- **语言**: English

### 16. CNBC Top News (美国, Tier 4)
- **URL**: `https://www.cnbc.com/id/100003114/device/rss/rss.html`
- **覆盖**: 美国股市、财经新闻
- **语言**: English

### 17. Seeking Alpha (全球, Tier 3)
- **URL**: `https://seekingalpha.com/feed.xml`
- **覆盖**: 投资分析、股票研究
- **语言**: English

### 18. Yahoo Finance (美国, Tier 3)
- **URL**: `https://finance.yahoo.com/news/rssindex`
- **覆盖**: 美国股市、个人理财
- **语言**: English

---

## 🏷️ 新版Hashtag系统

### 标签结构（3层）

每条新闻自动生成以下标签：

```
#评分X分 #地区 #事件类型 #来源

示例：
#评分8分 #西班牙 #财报 #并购 #ElEconomista
```

### 1. 评分标签
- `#评分7分` - 7.0-7.9分
- `#评分8分` - 8.0-8.9分
- `#评分9分` - 9.0-10.0分
- `#突发` - ≥7分
- `#重要` - 5-6.9分
- `#极端重要` - ≥9分

### 2. 地区标签（中文）
- `#美国` - WSJ, MarketWatch, CNBC, Yahoo Finance
- `#加拿大` - Globe and Mail, Financial Post
- `#西班牙` - El Economista, Expansión
- `#德国` - Börse Frankfurt
- `#欧洲` - FT, ECB, European Financial Review
- `#英国` - FT相关新闻
- `#全球` - Reuters, Bloomberg, Investing.com, TechCrunch
- `#中国` - 内容包含China/Beijing
- `#日本` - 内容包含Japan/Tokyo

### 3. 事件分类标签
- `#财报` - 季度财报、业绩指引
- `#并购` - 收购、合并、重组
- `#货币政策` - 美联储、欧洲央行、利率
- `#IPO` - 上市、首次公开募股
- `#法律` - 诉讼、监管调查
- `#高管` - CEO/CFO变动
- `#危机` - 破产、倒闭
- `#回购` - 股票回购计划
- `#分红` - 派息公告
- `#分析师` - 评级上调/下调
- `#监管` - 政策法规
- `#产品` - 新品发布
- `#科技` - AI、技术创新
- `#市场波动` - 暴涨、暴跌

---

## 🔍 Telegram搜索示例

### 按地区搜索
```
#西班牙 - 所有西班牙新闻
#加拿大 - 所有加拿大新闻
#美国 - 所有美国新闻
```

### 按评分搜索
```
#评分8分 - 8.0-8.9分新闻
#评分9分 - 9.0-10.0分新闻
#突发 - 所有≥7分突发新闻
```

### 按事件搜索
```
#货币政策 - 美联储、欧洲央行新闻
#财报 - 所有季度财报
#并购 - 收购并购新闻
```

### 组合搜索
```
#西班牙 #财报 - 西班牙公司财报
#加拿大 #能源 - 加拿大能源新闻
#评分8分 #货币政策 - 高分货币政策新闻
```

---

## 🚀 在N8N中部署

### 方式1：自动导入（推荐）

**准备中**：完整的18源N8N workflow JSON文件  
文件名：`news-rss-collector-v4-global-premium.json`

### 方式2：手动配置

1. **导入v3.0作为基础**
   - 使用 `news-rss-collector-v3-global.json`（10源）

2. **添加8个新源**
   - Globe and Mail (加拿大)
   - Financial Post (加拿大)
   - Reuters Business (全球)
   - Reuters Markets (全球)
   - Bloomberg Business (全球)
   - CNBC Top News (美国)
   - Seeking Alpha (全球)
   - Yahoo Finance (美国)

3. **节点配置步骤**
   对于每个新源：
   ```
   a. 复制现有RSS节点
   b. 修改URL为新源URL
   c. 添加Code节点设置metadata:
      {
        source: "Source Name",
        tier: X
      }
   d. 连接到"Merge All Feeds"节点
   ```

---

## 📈 预期效果

### 每日新闻量
- **采集**: ~3,000-5,000 篇
- **去重后**: ~400-700 篇
- **Fastlane推送**: ~60-120 条（评分≥7）
- **2h摘要**: ~80-150 条
- **4h摘要**: ~50-100 条

### 地区分布
- 全球新闻：40%
- 美国：30%
- 欧洲（含西班牙、德国）：20%
- 加拿大：10%

### 语言分布
- 英语：85%
- 西班牙语：10%
- 德语/其他：5%

---

## 🔧 未来扩展

### 添加新源的步骤

1. **编辑配置文件** (`news-sources-config.json`)
   ```json
   {
     "id": "unique-id",
     "name": "Source Name",
     "url": "RSS URL",
     "region": "地区（中文）",
     "tier": 4,
     "reliability": 4.0,
     "update_frequency": "5min",
     "language": "en"
   }
   ```

2. **更新N8N Workflow**
   - 添加RSS节点
   - 添加Metadata节点
   - 连接到Merge节点

3. **重启服务**
   - 重启USIS Brain
   - 重启N8N workflow

4. **验证**
   - 检查新闻是否采集成功
   - 验证hashtag地区标签是否正确

### 推荐新源候选

**亚洲市场：**
- Nikkei Asia (日本)
- South China Morning Post (香港)
- Straits Times (新加坡)

**拉美市场：**
- Valor Econômico (巴西)
- El Financiero (墨西哥)

**官方/监管：**
- Federal Reserve (美联储)
- SEC (美国证监会)
- Bank of Canada (加拿大央行)

---

## ✅ 部署检查清单

- [ ] `news-sources-config.json` 已创建
- [ ] `newsPushService.js` hashtag系统已优化
- [ ] N8N workflow 已导入/配置（18源）
- [ ] 环境变量已设置（NEWS_INGESTION_SECRET）
- [ ] USIS Brain已重启
- [ ] N8N workflow已激活
- [ ] 测试推送成功（验证hashtag）
- [ ] Telegram搜索功能正常（#西班牙、#加拿大）

---

**最后更新**: 2025-11-10  
**版本**: v4.0 Global Premium Edition  
**状态**: ✅ Ready for Deployment
