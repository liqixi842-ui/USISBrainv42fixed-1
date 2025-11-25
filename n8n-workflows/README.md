# USIS News v2.0 - N8N Workflow Configuration

## Overview
N8N handles lightweight RSS ingestion ("eyes"), USIS Brain handles heavy computation ("brain").

---

## 📁 Workflow Files

### v2.0 (Current - 4 Sources)
**File:** `news-rss-collector.json`

**Sources:**
1. **WSJ Markets** - Tier 4 (Premium US financial news)
2. **Financial Times** - Tier 4 (Premium UK/global financial news)
3. **MarketWatch** - Tier 4 (US markets)
4. **TechCrunch** - Tier 3 (Tech industry news)

**Coverage:** US markets, global tech

---

### v3.0 (Global Edition - 10 Sources) ⭐ RECOMMENDED
**File:** `news-rss-collector-v3-global.json`

**Sources:**

| Region | Source | Tier | Focus |
|--------|--------|------|-------|
| 🇺🇸 US | WSJ Markets | 4 | US stocks, Fed policy |
| 🇬🇧 UK | Financial Times | 4 | Global finance, LSE |
| 🇺🇸 US | MarketWatch | 4 | US markets |
| 🇺🇸 US | TechCrunch | 3 | Tech industry |
| 🇪🇸 **Spain** | **El Economista** | 4 | **IBEX 35, Spanish economy** |
| 🇪🇸 **Spain** | **Expansión** | 4 | **Spanish business, markets** |
| 🇩🇪 Germany | Börse Frankfurt | 4 | DAX, German stocks |
| 🇪🇺 Europe | European Financial Review | 3 | EU banking, finance |
| 🌍 Global | Investing.com | 3 | Multi-market coverage |
| 🇪🇺 **Regulatory** | **ECB Press Releases** | **5** | **Monetary policy (Tier 5!)** |

**Coverage:** US + Europe + Spain + Regulatory

**Spanish Market Coverage:** ✅ IBEX 35, Spanish banks (BBVA, Santander), Spanish economy

---

## 🚀 Setup Instructions

### 1. Import Workflow to N8N

**For v3.0 Global Edition:**
```bash
# In your N8N instance:
# 1. Go to Workflows → Import from File
# 2. Select: news-rss-collector-v3-global.json
# 3. Click "Import"
```

### 2. Configure Environment Variables

**In N8N Settings → Environment Variables:**
```bash
USIS_BRAIN_URL=https://your-replit-url.repl.co
NEWS_INGESTION_SECRET=<same-as-USIS-Brain>
```

**In USIS Brain (.env or Secrets):**
```bash
NEWS_INGESTION_SECRET=<generate-random-secret>
NEWS_CHANNEL_ID=-4997808098
ENABLE_NEWS_SYSTEM=true
```

### 3. Activate Workflow

1. Open imported workflow in N8N
2. Click **"Active"** toggle (top-right)
3. Workflow will run every 5 minutes automatically

---

## 🔍 How It Works

### Architecture: "Eyes & Brain"

```
N8N Workflow (every 5min)
  ↓
Parallel RSS Fetch (10 sources)
  ↓
Attach Metadata (source name + tier)
  ↓
Merge (append mode - prevents article loss)
  ↓
Format for API (strip HTML, extract summary)
  ↓
POST /api/news/ingest (authenticated)
  ↓
USIS Brain
  ↓ Deduplication (24h URL + 6h topic)
  ↓ ImpactRank 2.0 Scoring (7 factors)
  ↓ Routing (fastlane/2h/4h digest)
  ↓ Fastlane Push (if score ≥7)
  ↓
Telegram Delivery
```

### RSS Collection Details

**Parallel Processing:**
- All 10 sources fetched simultaneously
- Each source gets metadata tag (source name + tier)
- Append-mode merge prevents article loss

**Data Transformation:**
```javascript
{
  title: "Breaking News...",
  url: "https://...",
  summary: "Stripped HTML content (max 500 chars)",
  published_at: "2025-11-10T12:00:00Z",
  source: "El Economista",
  tier: 4,
  symbols: [] // Extracted by USIS Brain
}
```

**Error Handling:**
- Individual source failures don't break workflow
- N8N retries failed requests automatically
- USIS Brain validates tier bounds (1-5)

---

## 📊 Source Tier System

| Tier | Authority | Examples | Impact on Score |
|------|-----------|----------|-----------------|
| 5 | Official/Regulatory | ECB, Fed, SEC | Source Quality: 1.0 |
| 4 | Premium Media | WSJ, FT, El Economista | Source Quality: 0.85 |
| 3 | Industry/Aggregators | TechCrunch, Investing.com | Source Quality: 0.65 |
| 2 | Verified Social | Twitter Blue | Source Quality: 0.40 |
| 1 | Unverified | Social media | Source Quality: 0.20 |

**Note:** ECB press releases are Tier 5 (highest authority for EU monetary policy)

---

## 🇪🇸 Spanish Market Coverage

### Sources Added in v3.0

1. **El Economista** (`eleconomista.es/rss/rss-mercados.xml`)
   - IBEX 35 stocks
   - Spanish banking (BBVA, Santander)
   - Spanish economy news

2. **Expansión** (`expansion.com/rss/portada.xml`)
   - Business news
   - Corporate earnings
   - Spanish company analysis

### Symbols Covered
- **IBEX 35 Components:** TEF, SAN, BBVA, IBE, REP, ITX, etc.
- **Banks:** Santander (SAN), BBVA (BBVA), CaixaBank (CABK)
- **Energy:** Repsol (REP), Iberdrola (IBE)
- **Telecom:** Telefónica (TEF)
- **Retail:** Inditex (ITX)

---

## 🛠️ Troubleshooting

### Workflow Not Running

**Check:**
1. Workflow is "Active" (toggle in top-right)
2. Schedule trigger shows green checkmark
3. N8N has internet access to fetch RSS feeds

**Test Manually:**
```
1. Open workflow in N8N
2. Click "Execute Workflow" button
3. Check execution log for errors
```

### USIS Brain Not Receiving News

**Check:**
1. Environment variables set correctly in N8N
2. `USIS_BRAIN_URL` is accessible from N8N
3. `NEWS_INGESTION_SECRET` matches on both sides

**Test Authentication:**
```bash
curl -X POST https://your-repl.co/api/news/ingest \
  -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"title":"test","url":"https://test.com","summary":"test","published_at":"2025-11-10T12:00:00Z","source":"Test","tier":4,"symbols":[]}'
```

Expected response: `{"ok":true,"action":"..."}`

### RSS Feed Not Working

**Common Issues:**
- **El Economista/Expansión:** May require specific RSS path (check website)
- **Paywalls:** FT may block some articles
- **Rate Limits:** N8N's 5min interval is safe for all sources

**Alternative Spanish Sources:**
- BME (Spanish Exchange): `bolsasymercados.es/bme-exchange/en/RSS`
- Investing.com Spanish: `es.investing.com/webmaster-tools/rss`
- Estrategias de Inversión: `estrategiasdeinversion.com/corporativo/rss`

---

## 📝 Maintenance

### Weekly Tasks
- Check N8N execution log for failed RSS fetches
- Monitor USIS Brain logs for authentication errors
- Review fastlane push rate (should be ~5-15% of total articles)

### Monthly Tasks
- Update RSS feed URLs if sources change
- Review source tier assignments based on quality
- Prune old workflow executions in N8N

---

Last Updated: 2025-11-10
Version: 3.0 Global Edition
