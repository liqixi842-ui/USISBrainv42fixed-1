#!/bin/bash
# 自动导出环境变量到服务器格式

cat << 'EOF'
# ========================================
# USIS Brain 生产环境配置
# ========================================

# 数据库配置（服务器本地数据库）
DATABASE_URL=postgresql://usis_brain:USISBrain2024!@localhost:5432/usis_brain

# 部署域名
REPLIT_DEPLOYMENT_URL=https://myusis.net

# Telegram Bot
EOF

echo "TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN_DEV}"

cat << 'EOF'

# OpenAI API
EOF

echo "OPENAI_API_KEY=${OPENAI_API_KEY}"

cat << 'EOF'

# 金融数据API
EOF

echo "FINNHUB_API_KEY=${FINNHUB_API_KEY}"
echo "TWELVE_DATA_API_KEY=${TWELVE_DATA_API_KEY}"

cat << 'EOF'

# PDF生成
EOF

echo "DOC_RAPTOR_API_KEY=${DOC_RAPTOR_API_KEY}"
echo "DOC_RAPTOR_TEST_MODE=${DOC_RAPTOR_TEST_MODE}"

cat << 'EOF'

# Neon数据库（备份）
EOF

echo "NEON_API_KEY=${NEON_API_KEY}"

cat << 'EOF'

# n8n Screenshot Webhook
N8N_HEATMAP_WEBHOOK=https://qian.app.n8n.cloud/webhook/capture_heatmap
BOT_TOKEN_ROTATING=true

# Node环境
NODE_ENV=production
EOF
