# USIS Brain v6.5.2 - Three-Bot Architecture Deployment Guide

## 🎯 Architecture Overview

```
User Message
    ↓
Manager Bot (@qixizhuguan_bot) - Listens to ALL messages
    ↓
Routes by command type
    ├─ "解票 SYMBOL" → Research Bot (@qixijiepiao_bot) - 15-30s analysis
    ├─ "研报, ..." → Research Bot (@qixijiepiao_bot) - 120-180s report
    └─ News delivery → News Bot (@chaojilaos_bot) - Automated only
```

## ✅ Pre-Deployment Checklist

### 1. Token Configuration (REQUIRED)
Ensure all three unique bot tokens are configured in `.env`:

```bash
MANAGER_BOT_TOKEN=8301809386:...      # @qixizhuguan_bot
RESEARCH_BOT_TOKEN=8552043622:...     # @qixijiepiao_bot
NEWS_BOT_TOKEN=7944498422:...         # @chaojilaos_bot
OWNER_TELEGRAM_ID=YOUR_USER_ID
```

**CRITICAL:** All three tokens MUST be:
- ✅ Present (not empty)
- ✅ Unique (no duplicates)
- ✅ From different bots (@BotFather)

### 2. Validation on Startup

The system will automatically validate tokens and refuse to start if:
- Any token is missing
- Any token collision is detected
- OWNER_TELEGRAM_ID is not set

Expected startup logs:
```
✅ [Token Check] All 3 bot tokens validated (unique and configured)
👔 [ManagerBot] Initializing Manager Bot (@qixizhuguan_bot)...
✅ [ManagerBot] Manager Bot started successfully
```

## 🚀 Deployment Steps

### Step 1: Verify Token Configuration
```bash
# Check that all tokens are set
grep "MANAGER_BOT_TOKEN\|RESEARCH_BOT_TOKEN\|NEWS_BOT_TOKEN" .env
```

### Step 2: Deploy to Replit Reserved VM
1. Push code to Replit
2. System will automatically restart
3. Monitor startup logs for validation messages

### Step 3: Test Message Routing

Send test messages to Manager Bot (@qixizhuguan_bot):

**Test 1: Stock Analysis (标准版)**
```
解票 NVDA
```
Expected: CN standard analysis from @qixijiepiao_bot

**Test 2: Bilingual Analysis**
```
解票 TSLA 双语
```
Expected: CN + EN analysis (2 messages) from @qixijiepiao_bot

**Test 3: Human Voice**
```
分析 AAPL 聊天版
```
Expected: Natural language analysis from @qixijiepiao_bot

**Test 4: Complete Format**
```
解票 MSFT 完整版
```
Expected: CN + EN + Human (3 messages) from @qixijiepiao_bot

**Test 5: Reserved Keyword (should reject)**
```
解票 START
```
Expected: ❌ 无法识别股票代码

### Step 4: Verify Bot Separation

- Manager Bot (@qixizhuguan_bot) receives all messages
- Research Bot (@qixijiepiao_bot) sends all analysis replies
- News Bot (@chaojilaos_bot) only sends automated news (no user interaction)
- NO duplicate responses (legacy poller disabled)

## 🔍 Troubleshooting

### Issue: Manager Bot not starting
**Cause:** Token validation failed
**Fix:** Check `.env` file and ensure all three tokens are unique and present

### Issue: Duplicate responses
**Cause:** Legacy RESEARCH_BOT poller still running
**Fix:** Verify MANAGER_BOT_TOKEN is set in `.env`

### Issue: "解票 SYMBOL 双语 聊天版" produces wrong format
**Expected:** Treated as "完整版" (CN + EN + Human)
**If wrong:** Check manager-bot.js mode parsing logic

## 📊 Success Criteria

- ✅ Manager Bot receives and routes all user messages
- ✅ Research Bot replies with correct token (@qixijiepiao_bot)
- ✅ No duplicate responses from legacy poller
- ✅ Mode parsing correctly maps to 4 formats (标准版, 双语, 聊天版, 完整版)
- ✅ Reserved keywords (START, HELP, etc.) are rejected

## 🎉 Post-Deployment

1. Monitor logs for routing messages:
   - `📨 [ManagerBot] Received: "..."`
   - `🔀 [ManagerBot] Routing ticket analysis to Research Bot`
   - `📤 [DEV_BOT] Sending message 1/X`

2. Test edge cases:
   - "解票 START" → Should reject
   - "解票 NVDA 双语 聊天版" → Should produce 完整版 (3 messages)
   - Multiple rapid requests → Should handle gracefully

3. Confirm News Bot automation continues working independently

