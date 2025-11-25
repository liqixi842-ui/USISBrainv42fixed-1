# USIS Brain Version Control

**Last Updated:** 2025-11-15

## 📌 Current Versions

### v2-stable (Production - FROZEN ❄️)
- **Status:** FROZEN - Production Ready
- **Deployed:** 2025-11-15
- **URL:** https://liqixi888.replit.app
- **Bot Token:** `TELEGRAM_BOT_TOKEN` (Production)
- **Tag:** `prod_bot`

**Features:**
- ✅ Multi-AI orchestration (6 models)
- ✅ News system (4,060+ articles)
- ✅ Telegram bot integration
- ✅ Chart generation (Heatmap, TradingView)
- ✅ Cost tracking ($0.37 total)
- ✅ Database (9 tables, PostgreSQL)

**⚠️ IMPORTANT:** This version is LOCKED. Do NOT modify any root-level files.

**Protected Files:**
- index.js
- multiAiProvider.js
- dataBroker.js
- symbolResolver.js
- All other root-level .js files

---

### v3-dev (Development - Active 🚀)
- **Status:** Active Development
- **Created:** 2025-11-15
- **Path:** `/v3_dev/`
- **Bot Token:** `TELEGRAM_BOT_TOKEN_DEV` (Development)
- **Tag:** `dev_bot`

**Purpose:**
- Research report system development
- New feature testing
- Experimental functionality

**Planned Development Routes (Templates Created, Not Yet Mounted):**
- `/v3/report/*` - Research report endpoints (requires Express mounting)
- `/v3/test` - Development testing (requires Express mounting)

**Status:** Route templates exist in `/v3_dev/routes/`, integration with Express pending

---

## 🔐 Environment Variable Isolation

### Production Bot (v2-stable)
```
TELEGRAM_BOT_TOKEN=<production_token>
```
- Routes all messages to v2-stable logic
- Uses production database
- Serves real users

### Development Bot (v3-dev)
```
TELEGRAM_BOT_TOKEN_DEV=<development_token>
```

⚠️ **WARNING:** Setting this variable alone does NOT activate the dev bot.  
**Required:** Code integration in `index.js` (see IMPLEMENTATION_GUIDE.md)

**After Integration:**
- Routes messages to v3-dev features only
- Can use separate test database (optional)
- For development and testing only

---

## 📋 Version Control Rules

### ✅ DO:
1. All new development in `/v3_dev/`
2. Complete code integration before using `TELEGRAM_BOT_TOKEN_DEV` (see IMPLEMENTATION_GUIDE.md)
3. Test independently before merging to v2
4. Document all changes in `/v3_dev/CHANGELOG.md`

### ❌ DON'T:
1. Modify root-level files (v2-stable)
2. Mix production and development bot tokens
3. Test new features on production bot
4. Deploy untested v3-dev code to production

---

## 🔄 Deployment Workflow

### Current Status:
- **Production:** v2-stable running at https://liqixi888.replit.app
- **Development:** v3-dev isolated in `/v3_dev/`

### Future Deployment (when v3 is ready):
1. Complete v3-dev development and testing
2. Code review and approval
3. Merge v3-dev features to v2
4. Create v2.1-stable or v3-stable
5. Deploy to production
6. Archive old version

---

## 📊 Version History

| Version | Date | Status | URL |
|---------|------|--------|-----|
| v2-stable | 2025-11-15 | FROZEN | https://liqixi888.replit.app |
| v3-dev | 2025-11-15 | Active Development | /v3_dev/ |

---

## 🛠️ Technical Implementation

### Current Status: ⚠️ FRAMEWORK READY - INTEGRATION PENDING

**What's Implemented:**
- ✅ Directory structure (`/v3_dev/`)
- ✅ Configuration files (`bot-config.js`)
- ✅ Documentation (this file + ENVIRONMENT_VARIABLES.md + ISOLATION_MECHANISM.md)
- ✅ Test route template (`/v3_dev/routes/test.js`)

**What's Pending:**
- ⏳ Dual-bot startup logic in `index.js` (not yet wired)
- ⏳ Express router mounting for `/v3/*` endpoints (not yet connected)
- ⏳ Database tagging implementation (documented but not coded)
- ⏳ Environment variable `TELEGRAM_BOT_TOKEN_DEV` (not yet created)

### Planned Bot Isolation Logic (for future implementation in index.js):
```javascript
// THIS IS NOT YET IMPLEMENTED - FOR REFERENCE ONLY
const PROD_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DEV_TOKEN = process.env.TELEGRAM_BOT_TOKEN_DEV;

// Token collision check
if (DEV_TOKEN && DEV_TOKEN === PROD_TOKEN) {
  throw new Error('❌ TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_TOKEN_DEV must be different!');
}

// Development bot (only if configured)
if (DEV_TOKEN) {
  const { Telegraf } = require('telegraf');
  const devBot = new Telegraf(DEV_TOKEN);
  const devRoutes = require('./v3_dev/routes/messageHandler');
  devBot.on('message', devRoutes);
  devBot.launch();
  console.log('✅ Development Bot (v3-dev) started');
}

// Production bot (always runs)
const prodBot = new Telegraf(PROD_TOKEN);
// ... existing v2-stable logic
```

**Next Implementation Steps:**
1. Add dual-bot startup code to `index.js`
2. Mount `/v3` router: `app.use('/v3/report', require('./v3_dev/routes/test'))`
3. Implement database tagging (if needed)
4. Create `TELEGRAM_BOT_TOKEN_DEV` environment variable

---

## 📞 Contact

For questions about version control:
- Check this file first
- Review `/v3_dev/README.md` for development guidelines
- Refer to `replit.md` for system architecture

---

**Last Review:** 2025-11-15  
**Next Review:** When v3-dev is ready for production
