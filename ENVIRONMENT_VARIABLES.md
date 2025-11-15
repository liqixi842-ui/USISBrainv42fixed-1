# Environment Variables Configuration

## 🔐 Telegram Bot Tokens (Dual Bot Setup)

### Production Bot (v2-stable)
```bash
TELEGRAM_BOT_TOKEN=<your_production_bot_token>
```
- **Purpose:** Production bot for real users
- **Version:** v2-stable
- **Tag:** `prod_bot`
- **Routes:** Root-level routes (index.js)
- **Status:** ✅ Currently configured

### Development Bot (v3-dev)
```bash
TELEGRAM_BOT_TOKEN_DEV=<your_development_bot_token>
```
- **Purpose:** Development bot for testing
- **Version:** v3-dev
- **Tag:** `dev_bot`
- **Routes:** `/v3_dev/routes/*`
- **Status:** ❌ NOT configured (need to add)

---

## 📋 Setup Instructions

### Step 1: Create Development Bot

1. Open Telegram and find `@BotFather`
2. Send `/newbot` command
3. Follow prompts to create a new bot
4. Name it something like "USIS Brain Dev Bot"
5. Copy the bot token

### Step 2: Add Environment Variable

#### Option A: Using Replit Secrets UI
1. Open "Secrets" tab (🔐 icon)
2. Click "New Secret"
3. Key: `TELEGRAM_BOT_TOKEN_DEV`
4. Value: `<paste_your_dev_bot_token>`
5. Click "Add secret"

#### Option B: Using .env file (local development)
```bash
# Add to .env file
TELEGRAM_BOT_TOKEN_DEV=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
```

### Step 3: Code Integration Required (Not Automatic)
⚠️ **Important:** Setting `TELEGRAM_BOT_TOKEN_DEV` alone will NOT start a second bot.

**Required Actions:**
1. Implement dual-bot startup code in `index.js` (see `/v3_dev/IMPLEMENTATION_GUIDE.md`)
2. Mount `/v3/*` Express routes
3. Restart application

**After code integration:**
- Application will detect both tokens
- Both bots will start automatically
- They will be isolated from each other

**Current Status:** Framework ready, code integration pending

---

## 🔍 Verification

### Check Current Configuration
```bash
# In Replit shell or terminal
echo "Production Token: ${TELEGRAM_BOT_TOKEN:0:10}..."
echo "Development Token: ${TELEGRAM_BOT_TOKEN_DEV:0:10}..."
```

### Expected Output (when both configured):
```
Production Token: 7944498422...
Development Token: 1234567890...
```

**Note:** Dual-bot startup code is not yet implemented in `index.js`. Setting `TELEGRAM_BOT_TOKEN_DEV` alone won't launch a second bot until integration code is added.

---

## 🛡️ Security Best Practices

### ✅ DO:
1. Keep bot tokens in Secrets (never in code)
2. Use different tokens for prod and dev
3. Revoke and regenerate if exposed
4. Never commit tokens to git

### ❌ DON'T:
1. Share bot tokens publicly
2. Use same token for both environments
3. Store tokens in code files
4. Log full token values

---

## 📊 Environment Variable List

### Required (Already Configured):
- `TELEGRAM_BOT_TOKEN` - Production bot
- `OPENAI_API_KEY` - OpenAI API
- `ANTHROPIC_API_KEY` - Claude API
- `GEMINI_API_KEY` - Gemini API
- `DEEPSEEK_API_KEY` - DeepSeek API
- `MISTRAL_API_KEY` - Mistral API
- `PERPLEXITY_API_KEY` - Perplexity API
- `FINNHUB_API_KEY` - Finnhub API
- `TWELVE_DATA_API_KEY` - Twelve Data API
- `ALPHA_VANTAGE_API_KEY` - Alpha Vantage API
- `DATABASE_URL` - PostgreSQL connection

### Optional (for v3-dev):
- `TELEGRAM_BOT_TOKEN_DEV` - Development bot ⚠️ **Need to add**

---

## 🔄 Bot Isolation Mechanism

### How Isolation Will Work (After Implementation):

```javascript
// THIS IS NOT YET IMPLEMENTED IN index.js - FOR REFERENCE ONLY
const PROD_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DEV_TOKEN = process.env.TELEGRAM_BOT_TOKEN_DEV;

// Production Bot (always runs)
if (PROD_TOKEN) {
  const prodBot = new Telegraf(PROD_TOKEN);
  prodBot.on('message', handleV2StableRoutes);
  prodBot.launch();
  console.log('✅ Production Bot (v2-stable) started');
}

// Development Bot (only if configured and different token)
if (DEV_TOKEN && DEV_TOKEN !== PROD_TOKEN) {
  const devBot = new Telegraf(DEV_TOKEN);
  devBot.on('message', handleV3DevRoutes);
  devBot.launch();
  console.log('✅ Development Bot (v3-dev) started');
}
```

**Current Status:** Code shown above is NOT yet in `index.js`. See `/v3_dev/IMPLEMENTATION_GUIDE.md` for implementation steps.

### Isolation Features:
1. **Separate Polling:** Each bot has its own polling instance
2. **Separate Handlers:** Different message handlers
3. **No Cross-Talk:** Messages to one bot don't affect the other
4. **Independent State:** Each bot maintains its own state

---

## 🧪 Testing

### Test Production Bot:
1. Open your production bot in Telegram
2. Send a test message
3. Should get v2-stable response

### Test Development Bot:
1. Open your development bot in Telegram
2. Send a test message
3. Should get v3-dev response

### Verify Isolation:
- Messages to prod bot should NOT appear in dev bot
- Messages to dev bot should NOT appear in prod bot
- Both can run simultaneously

---

## 📞 Support

If you need help setting up the development bot:
1. Check this file first
2. Review `/v3_dev/README.md`
3. See `VERSION_CONTROL.md` for version isolation details

---

**Last Updated:** 2025-11-15  
**Next Update:** When adding new environment variables
