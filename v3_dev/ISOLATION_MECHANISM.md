# v3-dev Isolation Mechanism

## 🎯 Purpose
Ensure v3-dev development work is completely isolated from v2-stable production environment, preventing any cross-contamination or disruption.

---

## 🛡️ Multi-Layer Isolation Strategy

### Layer 1: Directory Isolation
```
Root (v2-stable - FROZEN)
├── index.js               ← Production entry point
├── multiAiProvider.js     ← DO NOT MODIFY
├── dataBroker.js          ← DO NOT MODIFY
├── symbolResolver.js      ← DO NOT MODIFY
└── ... (all root files)   ← FROZEN

v3_dev/ (Development - Active)
├── routes/                ← New routes here
├── services/              ← New services here
├── utils/                 ← New utilities here
└── config/                ← New config here
```

**Rule:** NEVER modify files in root directory during v3-dev development.

---

### Layer 2: Environment Variable Isolation

#### Production (v2-stable)
```javascript
const PROD_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const prodBot = new Telegraf(PROD_TOKEN);
// Tag: prod_bot
```

#### Development (v3-dev)
```javascript
const DEV_TOKEN = process.env.TELEGRAM_BOT_TOKEN_DEV;
const devBot = new Telegraf(DEV_TOKEN);
// Tag: dev_bot
```

**Validation:**
```javascript
// Ensure tokens are different
if (PROD_TOKEN === DEV_TOKEN) {
  throw new Error('❌ Production and dev tokens must be different!');
}
```

---

### Layer 3: Bot Instance Isolation

#### Separate Telegraf Instances
```javascript
// Production Bot
const prodBot = new Telegraf(PROD_TOKEN);
prodBot.botInfo = { tag: 'prod_bot', version: 'v2-stable' };

// Development Bot
const devBot = new Telegraf(DEV_TOKEN);
devBot.botInfo = { tag: 'dev_bot', version: 'v3-dev' };
```

**Key Points:**
- Each bot has its own Telegraf instance
- Separate polling mechanisms
- No shared state or context
- Independent message queues

---

### Layer 4: Route Isolation

#### Production Routes (v2-stable)
```javascript
prodBot.on('message', async (ctx) => {
  // Load v2-stable handlers from root
  const handler = require('./messageHandler');
  await handler(ctx);
});
```

#### Development Routes (v3-dev)
```javascript
devBot.on('message', async (ctx) => {
  // Load v3-dev handlers from /v3_dev/
  const handler = require('./v3_dev/routes/messageHandler');
  await handler(ctx);
});
```

**Isolation Guarantee:**
- Different require() paths
- No shared modules (unless explicitly intended)
- Separate error handling
- Independent logging

---

### Layer 5: API Endpoint Isolation

#### Production API (v2-stable)
```
/api/analyze          ← v2-stable endpoint
/api/news             ← v2-stable endpoint
/health               ← v2-stable health check
```

#### Development API (v3-dev)
```
/v3/report/generate   ← v3-dev new endpoint
/v3/report/test       ← v3-dev test endpoint
/v3/health            ← v3-dev health check (optional)
```

**Namespace Separation:**
- v2-stable: `/api/*`
- v3-dev: `/v3/*`
- Zero overlap guaranteed

---

### Layer 6: Database Isolation (Optional)

#### Option A: Shared Database with Tagging (Proposed - Not Yet Implemented)
```javascript
// THIS IS NOT YET IMPLEMENTED - FOR REFERENCE ONLY

// v2-stable writes
INSERT INTO reports (version, ...) VALUES ('v2-stable', ...);

// v3-dev writes
INSERT INTO reports (version, ...) VALUES ('v3-dev', ...);
```

**Status:** Documented strategy, not yet coded. Implementation required if version isolation in database is needed.

#### Option B: Separate Schemas
```sql
-- Production
CREATE SCHEMA v2_stable;
-- Development
CREATE SCHEMA v3_dev;
```

#### Option C: Separate Databases (Recommended for critical testing)
```javascript
// Production
const prodDb = pgPool(process.env.DATABASE_URL);

// Development
const devDb = pgPool(process.env.DATABASE_URL_DEV); // If needed
```

**Recommended Setup:** Option A (Shared database with version tagging) - implementation pending  
**Current Reality:** No database isolation implemented yet - v2 and v3 share same DB without tagging

---

## 🔒 Isolation Verification Checklist

### Before Starting Development:
- [ ] `TELEGRAM_BOT_TOKEN` configured (production)
- [ ] `TELEGRAM_BOT_TOKEN_DEV` configured (development)
- [ ] Tokens are different (verified)
- [ ] v3_dev directory exists
- [ ] VERSION_CONTROL.md reviewed

### During Development:
- [ ] Only editing files in `/v3_dev/`
- [ ] Not modifying root-level files
- [ ] Using `/v3/*` API endpoints
- [ ] Testing with dev bot only

### After Development:
- [ ] v2-stable still works (no regression)
- [ ] Dev bot isolated (no cross-talk)
- [ ] Production users unaffected
- [ ] Ready for code review

---

## 🧪 Testing Isolation

### Test 1: Bot Independence
```bash
# Send message to Production Bot
# Expected: v2-stable response

# Send message to Development Bot
# Expected: v3-dev response (or test message)

# Result: No cross-talk
```

### Test 2: File Modification
```bash
# Edit file in /v3_dev/
# Expected: Dev bot behavior changes

# Production bot should NOT change
```

### Test 3: API Endpoints
```bash
# Call /api/analyze (v2-stable)
# Expected: Production logic

# Call /v3/report/test (v3-dev)
# Expected: Development logic

# No interference
```

### Test 4: Simultaneous Operation
```bash
# Run both bots at same time
# Send messages to both
# Expected: Both work independently
```

---

## ⚠️ Common Pitfalls to Avoid

### ❌ DON'T:
1. **Modify root files** during v3-dev work
2. **Use same bot token** for both environments
3. **Mix API namespaces** (e.g., `/api/v3/...`)
4. **Share state** between bots
5. **Test on production bot** before code review

### ✅ DO:
1. **All changes in `/v3_dev/`**
2. **Separate bot tokens**
3. **Clear namespace separation** (`/v3/*`)
4. **Independent testing**
5. **Code review before merge**

---

## 🔄 Merge Process (Future)

When v3-dev is ready for production:

1. **Freeze v3-dev development**
2. **Complete code review**
3. **Merge testing in staging**
4. **Update VERSION_CONTROL.md**
5. **Merge to root (new v3-stable)**
6. **Archive v2-stable**
7. **Create new dev branch**

**Note:** This is for future reference when v3-dev is production-ready.

---

## 📊 Isolation Status

| Layer | Status | Implementation |
|-------|--------|----------------|
| Directory | ✅ Framework Ready | `/v3_dev/` created |
| Environment | ⏳ Not Configured | Need `TELEGRAM_BOT_TOKEN_DEV` |
| Bot Instance | ⏳ Not Implemented | Code changes needed in `index.js` |
| Route | ⚠️ Template Ready | `/v3/report/test` created but not mounted |
| API Endpoint | ⚠️ Template Ready | `/v3/*` namespace defined but not served |
| Database | 📝 Documented Only | Tagging strategy documented, not coded |

**Legend:**
- ✅ Framework Ready: Structure/templates created, ready for implementation
- ⏳ Not Configured: Requires environment variable setup
- ⏳ Not Implemented: Requires code changes to activate
- ⚠️ Template Ready: Files exist but not integrated into runtime
- 📝 Documented Only: Strategy documented, implementation pending

---

## 📞 Support

Questions about isolation mechanism:
- See `VERSION_CONTROL.md` for version strategy
- See `ENVIRONMENT_VARIABLES.md` for bot setup
- See `/v3_dev/README.md` for development guide

---

**Created:** 2025-11-15  
**Status:** Active  
**Purpose:** Guide safe v3-dev development without affecting v2-stable production
