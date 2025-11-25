# v3-dev Implementation Guide

**Status:** Framework Established - Code Integration Pending  
**Created:** 2025-11-15  
**Last Updated:** 2025-11-15

---

## 🎯 Current State

### ✅ What's Complete:
1. **Directory Structure:** `/v3_dev/` with subdirectories (routes, services, utils, config)
2. **Documentation:** VERSION_CONTROL.md, ENVIRONMENT_VARIABLES.md, ISOLATION_MECHANISM.md, README.md
3. **Configuration:** bot-config.js with dual-bot settings
4. **Templates:** Sample route (`routes/test.js`)
5. **Changelog:** CHANGELOG.md for tracking changes

### ⏳ What's Pending:
1. **index.js Integration:** Dual-bot startup code
2. **Express Routing:** Mount `/v3/*` endpoints
3. **Environment Setup:** Create `TELEGRAM_BOT_TOKEN_DEV`
4. **Database Tagging:** (if needed) Implement version tags

---

## 📋 Implementation Checklist

### Phase 1: Environment Setup
- [ ] Create new Telegram bot via @BotFather
- [ ] Copy bot token
- [ ] Add `TELEGRAM_BOT_TOKEN_DEV` to Replit Secrets
- [ ] Verify token is different from production

### Phase 2: Code Integration (index.js)
- [ ] Import v3_dev configuration
- [ ] Add token collision check
- [ ] Implement conditional dev bot instantiation
- [ ] Add dev bot message handlers
- [ ] Add error handling for dev bot
- [ ] Add logging for dual-bot status

### Phase 3: Express Routing
- [ ] Mount `/v3/report` router
- [ ] Test `/v3/report/test` endpoint
- [ ] Add error handling for v3 routes
- [ ] Update health check to include v3 status

### Phase 4: Testing
- [ ] Send message to production bot (verify v2-stable works)
- [ ] Send message to development bot (verify v3-dev works)
- [ ] Verify no cross-talk between bots
- [ ] Test API endpoints (`/v3/report/test`)
- [ ] Check logs for both bot instances

### Phase 5: Documentation Update
- [ ] Update VERSION_CONTROL.md status from "pending" to "active"
- [ ] Update ISOLATION_MECHANISM.md with actual implementation details
- [ ] Add screenshots or examples
- [ ] Update replit.md with v3-dev status

---

## 🔧 Code Changes Required

### 1. index.js - Dual Bot Startup (Lines ~6150-6200)

**Current Code:**
```javascript
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.log('⚠️  未配置 TELEGRAM_BOT_TOKEN');
  // Safe mode
} else {
  const { Telegraf } = require('telegraf');
  const bot = new Telegraf(BOT_TOKEN);
  // ... bot setup
}
```

**Required Changes:**
```javascript
const PROD_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DEV_TOKEN = process.env.TELEGRAM_BOT_TOKEN_DEV;

// Token collision check
if (DEV_TOKEN && DEV_TOKEN === PROD_TOKEN) {
  console.error('❌ ERROR: TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_TOKEN_DEV must be different!');
  process.exit(1);
}

// Production bot (existing logic)
if (!PROD_TOKEN) {
  console.log('⚠️  未配置 TELEGRAM_BOT_TOKEN');
  // Safe mode
} else {
  const { Telegraf } = require('telegraf');
  const prodBot = new Telegraf(PROD_TOKEN);
  prodBot.tag = 'prod_bot'; // For logging
  // ... existing bot setup for prodBot
  console.log('✅ Production Bot (v2-stable) started');
}

// Development bot (new logic)
if (DEV_TOKEN) {
  const { Telegraf } = require('telegraf');
  const devBot = new Telegraf(DEV_TOKEN);
  devBot.tag = 'dev_bot'; // For logging
  
  // v3-dev message handler
  devBot.on('message', async (ctx) => {
    try {
      const message = ctx.message.text || '';
      await ctx.reply(`🚧 v3-dev Bot Response:\n\nYou sent: ${message}\n\nStatus: Development mode\nVersion: v3-dev\nIsolation: Active`);
    } catch (error) {
      console.error('[dev_bot] Error:', error);
      await ctx.reply('❌ v3-dev error occurred');
    }
  });
  
  devBot.launch();
  console.log('✅ Development Bot (v3-dev) started');
}
```

---

### 2. index.js - Express Router Mounting (Lines ~6000-6100)

**Add after existing route definitions:**
```javascript
// v3-dev routes (only load if dev bot is configured)
if (process.env.TELEGRAM_BOT_TOKEN_DEV) {
  try {
    const v3TestRouter = require('./v3_dev/routes/test');
    app.use('/v3/report', v3TestRouter);
    console.log('✅ v3-dev routes mounted at /v3/report/*');
  } catch (error) {
    console.error('⚠️  Failed to load v3-dev routes:', error.message);
  }
}
```

---

### 3. Database Tagging (Optional - If Needed)

**Example: Tag records with version**
```javascript
// When inserting data
await db.insert(reports).values({
  content: '...',
  version: 'v3-dev', // or 'v2-stable'
  createdAt: new Date()
});

// When querying
const v3Reports = await db.select()
  .from(reports)
  .where(eq(reports.version, 'v3-dev'));
```

---

## 🧪 Testing Steps

### Step 1: Verify Environment
```bash
# In Replit shell
echo "Prod Token: ${TELEGRAM_BOT_TOKEN:0:15}..."
echo "Dev Token: ${TELEGRAM_BOT_TOKEN_DEV:0:15}..."
```

Expected:
```
Prod Token: 7944498422:AAH...
Dev Token: 1234567890:ABCd...  (different from prod)
```

### Step 2: Check Logs
Look for:
```
✅ Production Bot (v2-stable) started
✅ Development Bot (v3-dev) started
✅ v3-dev routes mounted at /v3/report/*
```

### Step 3: Test Production Bot
1. Open production bot in Telegram
2. Send: `/analyze AAPL`
3. Expected: v2-stable analysis response

### Step 4: Test Development Bot
1. Open development bot in Telegram
2. Send: `Hello dev bot`
3. Expected: "🚧 v3-dev Bot Response..." message

### Step 5: Test API Endpoint
```bash
curl https://liqixi888.replit.app/v3/report/test
```

Expected:
```json
{
  "status": "ok",
  "message": "v3-dev is working",
  "version": "v3-dev",
  "timestamp": "2025-11-15T...",
  "environment": "development"
}
```

### Step 6: Verify Isolation
- Send message to prod bot → Should NOT appear in dev bot
- Send message to dev bot → Should NOT appear in prod bot
- Both bots respond independently

---

## ⚠️ Common Issues & Solutions

### Issue 1: Dev bot not starting
**Symptom:** Only production bot starts, dev bot missing from logs

**Solution:**
- Check `TELEGRAM_BOT_TOKEN_DEV` is set
- Verify tokens are different
- Check index.js has dev bot startup code

### Issue 2: 404 on `/v3/report/test`
**Symptom:** `Cannot GET /v3/report/test`

**Solution:**
- Verify router mounting code in index.js
- Check `require('./v3_dev/routes/test')` path is correct
- Restart application after code changes

### Issue 3: Both bots respond the same
**Symptom:** Dev bot gives v2-stable responses

**Solution:**
- Tokens are probably the same
- Verify `TELEGRAM_BOT_TOKEN !== TELEGRAM_BOT_TOKEN_DEV`
- Add token collision check

---

## 📊 Success Criteria

### Phase 1 Complete:
- [x] Framework directory created
- [x] Documentation written
- [x] Configuration files ready
- [x] Templates available

### Phase 2 Complete (Pending):
- [ ] `TELEGRAM_BOT_TOKEN_DEV` configured
- [ ] Dual-bot code in index.js
- [ ] `/v3/*` routes mounted
- [ ] Both bots responding independently

### Phase 3 Complete (Future):
- [ ] Research report features developed
- [ ] v3-dev tested and stable
- [ ] Ready to merge to v2 (or create v3-stable)

---

## 🚀 Next Actions

**Immediate (Ready to implement):**
1. Create development bot token
2. Add to Replit Secrets
3. Implement dual-bot code in index.js
4. Mount Express routers
5. Test both bots

**Short-term (After integration):**
1. Develop research report features
2. Add more v3-dev routes
3. Test with real data
4. Refine isolation strategy

**Long-term (Before production):**
1. Complete v3-dev features
2. Comprehensive testing
3. Code review
4. Merge to production
5. Archive v2-stable

---

## 📞 Support

For implementation help:
- **Framework Setup:** See this file
- **Environment Variables:** See `ENVIRONMENT_VARIABLES.md`
- **Isolation Strategy:** See `ISOLATION_MECHANISM.md`
- **Version Control:** See `VERSION_CONTROL.md`

---

**Last Updated:** 2025-11-15  
**Status:** Framework ready, code integration pending  
**Next Review:** After code implementation
