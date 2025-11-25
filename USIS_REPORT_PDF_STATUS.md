# USIS Research Report & PDF System - Status Report

**Analysis Date:** 2025-11-16  
**Analyst:** Lead Engineer - Codebase Diagnostic  
**Status:** ✅ PRODUCTION-READY SYSTEM EXISTS

---

## Overview

The USIS project **has a fully operational, production-ready research report system** located in the `v3_dev/` directory. This system generates institutional-grade equity research reports (comparable to Morgan Stanley/Goldman Sachs quality) for any symbol (equities, indices, ETFs, crypto). 

**Key Capabilities:**
- ✅ Multi-format output: JSON, HTML, PDF, Markdown
- ✅ HTTP API endpoints: `GET /v3/report/:symbol?format={json|html|pdf|md}`
- ✅ Telegram bot integration: `/report SYMBOL` command
- ✅ External PDF generation via DocRaptor API (cloud-based)
- ✅ Local PDFKit library installed but **deprecated** (migrated to external service)
- ✅ v4.0 Professional Correction Layer (removes AI hallucinations, enforces institutional tone)
- ✅ v3.2 Multi-Model AI Pipeline (6 AI models: GPT-4o, Claude 3.5, Gemini 2.5, DeepSeek V3, Mistral Large, Perplexity Sonar Pro)

**System Maturity:** Production-grade (v3-dev-v4.0), actively maintained, fully documented

---

## PDF / Document Libraries

| Library | Version | Status | Usage | File Paths |
|---------|---------|--------|-------|-----------|
| **pdfkit** | 0.17.2 | ⚠️ DEPRECATED | Previously used for local PDF generation, now replaced by external DocRaptor API | - `package.json` line 17<br>- **NOT used** in `v3_dev/services/reportService.js` (line 29-31: "PDFKit 已移除") |
| **@react-pdf/renderer** | ❌ Not installed | N/A | N/A | N/A |
| **jspdf** | ❌ Not installed | N/A | N/A | N/A |
| **puppeteer** | ❌ Not installed | N/A | N/A | N/A |
| **playwright** | ❌ Not installed | N/A | N/A | N/A |
| **html-pdf** | ❌ Not installed | N/A | N/A | N/A |
| **docx** | ❌ Not installed | N/A | N/A | N/A |

**External Service (Primary):**
- **DocRaptor API**: Cloud-based HTML-to-PDF conversion service
  - URL: `https://docraptor.com/docs/api`
  - Used in: `v3_dev/services/reportService.js` (function `generatePdfWithDocRaptor`, lines 2740-2787)
  - Authentication: API key via `DOC_RAPTOR_API_KEY` environment variable

---

## Existing Report / Export Endpoints

| HTTP Method + Path | Format | Handler Function | File Path | Description |
|-------------------|--------|------------------|-----------|-------------|
| `GET /v3/report/test` | JSON | `router.get('/test')` | `v3_dev/routes/report.js:34` | Static mock report for testing |
| `GET /v3/report/:symbol` | JSON (default) | `router.get('/:symbol')` | `v3_dev/routes/report.js:65` | Full institutional research report in JSON |
| `GET /v3/report/:symbol?format=html` | HTML | `router.get('/:symbol')` | `v3_dev/routes/report.js:106-114` | HTML document (inline rendering) |
| `GET /v3/report/:symbol?format=pdf` | PDF | `router.get('/:symbol')` | `v3_dev/routes/report.js:116-148` | PDF binary via DocRaptor |
| `GET /v3/report/:symbol?format=md` | Markdown | `router.get('/:symbol')` | `v3_dev/routes/report.js:150-186` | Markdown document |

**Telegram Bot Command:**
- **Command:** `/report [SYMBOL]` (e.g., `/report NVDA`)
- **Handler:** `v3_dev/services/devBotHandler.js` (lines 190-300)
- **Output:** Sends PDF file directly to Telegram chat (uses DocRaptor API)
- **Fallback:** If PDF generation fails, sends JSON data as text

---

## Existing Templates or Report Modules

### 1. **Main Report Engine** (`v3_dev/services/reportService.js` - 4,821 lines)
   - **Purpose:** Institutional-grade research report generation engine
   - **Key Functions:**
     - `buildResearchReport(symbol, asset_type)` - Master orchestrator (lines 375-541)
     - `buildHtmlFromReport(report)` - Converts ResearchReport schema to HTML (line 3824)
     - `generatePdfWithDocRaptor(symbol, htmlContent)` - HTML → PDF via DocRaptor (lines 2740-2787)
     - `buildFinalInstitutionalHtml(report)` - Final Template v1.0: 20-page professional PDF (lines 3773-3817)
     - `refineNarrativeText(report)` - v4.0 Taste + Truth correction layer (lines 51-358)
   - **Features:**
     - PE × EPS valuation model (not simple percentage-based)
     - 5-year financial history + 2-year forecasts
     - Peer comparison with industry context
     - Segment analysis, macro trends, technical view
     - Fixed 20-page layout (renderPage1 through renderPage20)
   - **Output Schema:** ResearchReport v2.0 (documented in file header)

### 2. **Report HTTP Routes** (`v3_dev/routes/report.js` - 213 lines)
   - **Purpose:** Express router handling all report HTTP endpoints
   - **Routes:**
     - `GET /test` - Mock report for testing
     - `GET /:symbol` - Main report endpoint with multi-format support
   - **Flow:**
     1. Validate symbol → 2. Generate ResearchReport v1 → 3. Format output (JSON/HTML/PDF/Markdown)

### 3. **Report Route Index** (`v3_dev/routes/index.js` - 38 lines)
   - **Purpose:** Central router that mounts all v3-dev routes
   - **Mounts:**
     - `/report` → `reportRouter` (from `./report.js`)
     - `/test` → Test endpoints
     - `/health` → Health check

### 4. **Dev Bot Handler** (`v3_dev/services/devBotHandler.js` - 431 lines)
   - **Purpose:** Telegram bot command handler for v3-dev environment
   - **Commands:**
     - `/report [SYMBOL]` - Generates and sends PDF research report (lines 190-300)
   - **Integration:** Calls `buildResearchReport()` → `generatePdfWithDocRaptor()` → Telegram sendDocument

### 5. **HTML Template Components** (within `reportService.js`)
   - **TEMPLATE_CSS:** Professional styling (lines 2798-3083) - Institutional color scheme, print-optimized layout
   - **renderPage1-20:** Individual page render functions for 20-page fixed layout
     - Page 1: Cover page (lines 3090-3114)
     - Page 2: Key takeaways + metrics (lines 3116-3154)
     - Page 3: Investment thesis (lines 3156-3197)
     - Page 4: Business segments (lines 3199-3242)
     - Page 5: Industry & macro environment (lines 3244-3271)
     - Page 6-20: Valuation, financials, catalysts, risks, technical view, etc.

### 6. **Legacy Report Service** (`reportService.js` - root directory, 1,143 lines)
   - **Status:** ⚠️ LEGACY (v2-stable production bot uses this)
   - **Purpose:** Older report generation for v2-stable bot
   - **Key Functions:**
     - `buildSimpleReport()` - Basic report structure
     - `generateHTMLReport()` - HTML output
     - `generateMarkdownReport()` - Markdown output
   - **Note:** This is the **production v2-stable** version; `v3_dev/` is the upgraded system

### 7. **Test Files**
   - `test_report_service.js` - Tests legacy reportService.js
   - `test_nvda_report.js` - Tests NVDA report generation
   - `v3_dev/test_final_template.js` - Tests Final Template v1.0 with DocRaptor
   - `v3_dev/test_v4_correction.js` - Tests v4.0 correction layer
   - `v3_dev/test_v3.2_multimodel.js` - Tests v3.2 multi-model AI pipeline

---

## AI Analysis Modules Potentially Reusable for Reports

These modules generate long-form analysis and can feed content into research reports:

| Module | File Path | Output | Potential Use in Reports |
|--------|-----------|--------|--------------------------|
| **Multi-AI Provider** | `multiAiProvider.js` (632 lines) | Orchestrates 6 AI models (GPT-4o, Claude, Gemini, DeepSeek, Mistral, Perplexity) for parallel analysis | ✅ **Already integrated** in v3.2 pipeline (v3_dev/services/reportService.js) |
| **GPT-5 Brain** | `gpt5Brain.js` (233 lines) | Single-model deep analysis using GPT-4o/GPT-4o-mini | ✅ **Already used** as fallback in v3_dev |
| **Semantic Intent Agent** | `semanticIntentAgent.js` (404 lines) | Parses user intent, extracts symbols, detects market states | Could be used for automated report triggering |
| **Data Broker** | `dataBroker.js` (1,538 lines) | Fetches real-time market data (Finnhub, Twelve Data, Alpha Vantage) | ✅ **Already integrated** in report generation |
| **News Broker** | `newsBroker.js` (392 lines) | Aggregates and ranks news using ImpactRank algorithm | Could add news section to reports |
| **Professional Reporter** | `professionalReporter.js` (267 lines) | Formats analysis into professional sell-side language | ✅ **Replaced by v4.0 correction layer** (newer implementation) |
| **Vision Analyzer** | `visionAnalyzer.js` (184 lines) | Analyzes chart patterns using GPT-4 Vision | Could add chart analysis section |
| **Multi-Language Analyzer** | `multiLanguageAnalyzer.js` (266 lines) | Handles Chinese financial analysis (DeepSeek V3) | ✅ **Already integrated** for multilingual reports |

---

## Config / Env Related to Reports/PDF

### Environment Variables Used

| Variable | Purpose | Used In | Required? | Default/Fallback |
|----------|---------|---------|-----------|------------------|
| `OPENAI_API_KEY` | GPT-4o/GPT-4o-mini API access | `v3_dev/services/reportService.js:19` | ✅ Yes (for AI analysis) | Falls back to mock data if missing |
| `DOC_RAPTOR_API_KEY` | DocRaptor PDF generation | `v3_dev/services/reportService.js:2741` | ⚠️ Required for PDF format | Empty string if missing (PDF generation fails) |
| `DOC_RAPTOR_TEST_MODE` | Use DocRaptor test mode (free, watermarked) | `v3_dev/services/reportService.js:2742` | No | `false` (production mode) |
| `FINNHUB_API_KEY` | Real-time market data | `v3_dev/services/reportService.js:20` | Recommended | Degrades to fallback if missing |
| `TWELVE_DATA_API_KEY` | Global stock market data | `v3_dev/services/reportService.js:21` | Recommended | Degrades to fallback if missing |
| `ANTHROPIC_API_KEY` | Claude 3.5 Sonnet | `v3_dev/services/reportService.js:24` | No (optional AI model) | Skipped if missing |
| `GOOGLE_AI_API_KEY` | Gemini 2.5 Flash | `v3_dev/services/reportService.js:25` | No (optional AI model) | Skipped if missing |
| `DEEPSEEK_API_KEY` | DeepSeek V3 (Chinese analysis) | `v3_dev/services/reportService.js:26` | No (optional AI model) | Skipped if missing |
| `MISTRAL_API_KEY` | Mistral Large | `v3_dev/services/reportService.js:27` | No (optional AI model) | Skipped if missing |

### Config Files

- **None specific to reports/PDF** - All configuration is done via environment variables
- **Secrets managed via Replit Secrets** (as documented in `replit.md`)

---

## Current Gaps / Open Questions

### ✅ **NO CRITICAL GAPS - SYSTEM IS PRODUCTION-READY**

The v3-dev report system is fully functional and production-ready. However, here are some **optional enhancements** that could be considered:

#### 1. **DocRaptor Dependency** (Low Priority)
   - **Gap:** PDF generation requires external DocRaptor API (paid service after 100 free docs/month)
   - **Alternatives:**
     - **Option A:** Reinstate PDFKit (local generation, no API cost)
       - **Challenge:** Chinese font encoding issues (previously removed for this reason)
       - **Documented in:** `v3_dev/PDF_MIGRATION_REPORT.md`
     - **Option B:** Use Puppeteer/Playwright (headless browser)
       - **Challenge:** High memory usage on Replit Reserved VM
     - **Option C:** Keep DocRaptor (current solution)
       - **Pros:** Reliable, high-quality PDF, handles Chinese fonts
       - **Cons:** API cost (~$100/month for 500 docs)

#### 2. **PDF Generation Fallback** (Low Priority)
   - **Gap:** If DocRaptor API is down or key missing, PDF format returns 503 error
   - **Current Behavior:** Suggests user try `?format=html` instead
   - **Enhancement:** Auto-fallback to HTML → send as attachment with `.html` extension
   - **Impact:** Improves user experience when DocRaptor unavailable

#### 3. **Report Caching** (Optional Performance Optimization)
   - **Gap:** Every request regenerates full report (35-40s latency)
   - **Enhancement:** Cache reports for 5-10 minutes (Redis or in-memory)
   - **Impact:** Reduces AI API costs, improves response time for repeated requests
   - **Complexity:** Medium (cache invalidation, TTL management)

#### 4. **Batch Report Generation** (Feature Request)
   - **Gap:** No endpoint for generating multiple reports in one request
   - **Enhancement:** `POST /v3/report/batch` with array of symbols
   - **Use Case:** Portfolio analysis (e.g., generate reports for all S&P 500 stocks)
   - **Complexity:** High (async job queue, progress tracking)

#### 5. **PDF Customization Options** (Feature Request)
   - **Gap:** PDF layout is fixed (20 pages), no customization
   - **Enhancement:** Query params like `?pages=summary,valuation,risks` (select sections)
   - **Use Case:** Lightweight reports for quick analysis
   - **Complexity:** Medium (conditional page rendering)

---

## Backend Framework and Routing Structure

### Framework
- **Express.js 5.1.0** (latest stable)
- **Entry Point:** `index.js` (line 65: `const app = express()`)

### Routing Structure

```
index.js (main app)
  └─ app.use('/v3', v3Routes)  [line 6073]
      │
      └─ v3_dev/routes/index.js (central router)
          ├─ router.get('/test')  → Test endpoint
          ├─ router.get('/health') → Health check
          └─ router.use('/report', reportRouter)  [line 31]
              │
              └─ v3_dev/routes/report.js (report endpoints)
                  ├─ GET /v3/report/test → Mock report
                  └─ GET /v3/report/:symbol → Real report (multi-format)
```

### Route Registration Flow

1. **Main App** (`index.js:6073`):
   ```javascript
   app.use('/v3', v3Routes);
   ```

2. **v3-dev Router** (`v3_dev/routes/index.js:31`):
   ```javascript
   router.use('/report', reportRouter);
   ```

3. **Report Router** (`v3_dev/routes/report.js:65`):
   ```javascript
   router.get('/:symbol', async (req, res) => { ... });
   ```

**Full URL Pattern:** `https://[domain]/v3/report/:symbol?format={json|html|pdf|md}&asset_type={equity|index|etf|crypto}`

---

## System Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER REQUEST                               │
│  GET /v3/report/NVDA?format=pdf                                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│               v3_dev/routes/report.js                          │
│  - Validate symbol                                             │
│  - Normalize asset_type                                        │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│          v3_dev/services/reportService.js                      │
│  buildResearchReport(symbol, asset_type)                       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Phase 1: Data Collection                                 │  │
│  │  - fetchComprehensiveData() → Finnhub, Twelve Data      │  │
│  │  - Real-time quotes, fundamentals, peers, news          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Phase 2: v3.2 Multi-Model AI Analysis                   │  │
│  │  - Parallel execution of 6 AI models                    │  │
│  │  - GPT-4o: Summary, valuation                           │  │
│  │  - Claude 3.5: Thesis, industry analysis                │  │
│  │  - Gemini 2.5: Fast summarization                       │  │
│  │  - DeepSeek V3: Chinese financial analysis              │  │
│  │  - Mistral Large: Peer comparison                       │  │
│  │  - Perplexity Sonar Pro: Real-time news analysis        │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Phase 3: Consolidation                                  │  │
│  │  - Merge multi-model outputs into ResearchReport v2.0   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Phase 4: v4.0 Taste + Truth Correction                  │  │
│  │  - refineNarrativeText(report)                          │  │
│  │  - Remove AI hallucinations (ARM acquisition, etc.)     │  │
│  │  - Replace generic words (huge → meaningful)            │  │
│  │  - Remove fabricated dates (Q2 2024 → recent quarters) │  │
│  │  - Enforce institutional tone                           │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ✅ Returns: ResearchReport v4.0 (JSON object)                 │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                   FORMAT HANDLING                               │
│  (back in v3_dev/routes/report.js)                            │
│                                                                 │
│  if (format === 'json')    → Return ResearchReport JSON        │
│  if (format === 'html')    → buildHtmlFromReport(report)      │
│  if (format === 'pdf')     → buildHtmlFromReport(report)      │
│                              → generatePdfWithDocRaptor()      │
│  if (format === 'md')      → generateMarkdownReport()         │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              EXTERNAL SERVICE (PDF only)                        │
│                                                                 │
│  DocRaptor API (https://docraptor.com/docs/api)               │
│  - Input: HTML document                                        │
│  - Output: PDF binary                                          │
│  - Features: Chinese font support, print optimization          │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                   RESPONSE TO USER                              │
│  - JSON: ResearchReport v4.0 schema                            │
│  - HTML: Inline rendering (browser displays directly)          │
│  - PDF: Binary download (Content-Type: application/pdf)        │
│  - Markdown: Text download (.md file)                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Documentation Files

The v3-dev system is extremely well-documented:

1. **`v3_dev/README.md`** - Overview of v3-dev system
2. **`v3_dev/STATUS.md`** - Current development status
3. **`v3_dev/CHANGELOG.md`** - Version history
4. **`v3_dev/PDF_MIGRATION_REPORT.md`** - PDFKit → DocRaptor migration details
5. **`v3_dev/IMPLEMENTATION_GUIDE.md`** - How to implement v3-dev features
6. **`v3_dev/ISOLATION_MECHANISM.md`** - How v3-dev coexists with v2-stable
7. **`v3_dev/DIAGNOSTIC_ANSWERS.md`** - v4.0 correction layer diagnostic
8. **`v3_dev/TEST_RESULTS.md`** - Test coverage and results
9. **`replit.md`** - Main project documentation (includes v3-dev architecture)

---

## Test Coverage

### Automated Tests
- ✅ `v3_dev/test_v3.2_multimodel.js` - Tests multi-model AI pipeline
- ✅ `v3_dev/test_v4_correction.js` - Tests v4.0 correction layer
- ✅ `v3_dev/test_final_template.js` - Tests Final Template v1.0 + DocRaptor
- ✅ `v3_dev/test_quick_nvda.js` - Quick NVDA report generation
- ✅ `v3_dev/test_aapl_v3.2.js` - AAPL report generation
- ✅ `v3_dev/test_spx_v3.2.js` - SPX (index) report generation
- ✅ `test_report_service.js` - Tests legacy reportService.js
- ✅ `test_nvda_report.js` - Tests NVDA report

### Manual Test Guide
- **File:** `v3_dev/REPORT_FEATURE_V1_TESTING.md`
- **Covers:** HTTP endpoint testing, Telegram bot testing, error handling

---

## Production Deployment Status

### v2-stable (Production)
- **Location:** Root directory (`reportService.js`, etc.)
- **Bot:** Production Telegram bot uses this
- **Status:** ✅ Stable, in production

### v3-dev (Staging/Next-Gen)
- **Location:** `v3_dev/` directory
- **Bot:** Dev Telegram bot uses this (`/report` command)
- **Status:** ✅ Ready for production promotion
- **HTTP Endpoint:** `GET /v3/report/:symbol` (live on server)

### Isolation Mechanism
- **Documented in:** `v3_dev/ISOLATION_MECHANISM.md`
- **Strategy:** Separate directories, separate routes, separate bots
- **Benefit:** v3-dev can be tested in production without affecting v2-stable

---

## Recommendations

### For Immediate Use
1. **Use v3-dev system** - It's production-ready and superior to v2-stable
2. **Ensure `DOC_RAPTOR_API_KEY` is set** for PDF generation
3. **Test endpoint:** `GET /v3/report/NVDA?format=json` (should work immediately)

### For Production Deployment
1. **No gaps** - System is ready as-is
2. **Optional:** Set up report caching (Redis) for performance
3. **Optional:** Implement auto-fallback for PDF (HTML attachment if DocRaptor fails)

### For Cost Optimization
1. **DocRaptor costs ~$100/month for 500 reports** (after 100 free docs)
2. **Alternative:** Evaluate Puppeteer/Playwright for local PDF generation
   - **Pros:** No API cost
   - **Cons:** Higher memory usage, requires headless browser setup

---

## Conclusion

The USIS project has a **sophisticated, production-ready research report system** with:
- ✅ Institutional-grade content (v4.0 correction layer)
- ✅ Multi-AI model analysis (v3.2 pipeline)
- ✅ Multiple output formats (JSON, HTML, PDF, Markdown)
- ✅ HTTP API + Telegram bot integration
- ✅ Comprehensive documentation
- ✅ Test coverage

**There are no critical gaps.** The system is ready for production use. The only dependency is the DocRaptor API for PDF generation, which is optional (HTML/JSON/Markdown formats work without it).
