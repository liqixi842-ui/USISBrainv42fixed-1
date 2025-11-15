# USIS Brain v3-dev Development Branch

**Status:** Active Development  
**Created:** 2025-11-15  
**Purpose:** Research Report System and New Feature Development

## ⚠️ Important Rules

1. **DO NOT** modify any files in the root directory (v2-stable)
2. All new development happens here in `/v3_dev/`
3. Uses separate Telegram Bot token (`TELEGRAM_BOT_TOKEN_DEV`)
4. Isolated from production environment

## 🚧 Current Status: FRAMEWORK ESTABLISHED

**What's Ready:**
- ✅ Directory structure and templates
- ✅ Configuration files (`config/bot-config.js`)
- ✅ Documentation (README, ISOLATION_MECHANISM, CHANGELOG)
- ✅ Sample route (`routes/test.js`)

**What's Pending:**
- ⏳ Integration with `index.js` (dual-bot startup)
- ⏳ Router mounting (Express `/v3/*` endpoints)
- ⏳ Environment variable `TELEGRAM_BOT_TOKEN_DEV`
- ⏳ Actual bot instance creation

## Directory Structure

```
v3_dev/
├── routes/          # v3 API routes (e.g., /v3/report/*)
├── services/        # Business logic for new features
├── utils/           # Utility functions
├── config/          # Configuration files
└── README.md        # This file
```

## Development Bot Configuration

- Environment Variable: `TELEGRAM_BOT_TOKEN_DEV`
- Tag: `dev_bot`
- Target: v3-dev features only
- Isolated from production bot

## Getting Started

1. Set up environment variable: `TELEGRAM_BOT_TOKEN_DEV`
2. Create your routes in `/v3_dev/routes/`
3. Test independently without affecting v2-stable

## Version Isolation

- v2-stable (Production): Uses `TELEGRAM_BOT_TOKEN`
- v3-dev (Development): Uses `TELEGRAM_BOT_TOKEN_DEV`
- Both can run simultaneously without interference
