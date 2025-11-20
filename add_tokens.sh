#!/bin/bash
# 添加缺失的 Token 到 .env 文件

echo "📝 添加缺失的 Bot Tokens 到 .env 文件..."

# 检查是否已存在
if grep -q "RESEARCH_BOT_TOKEN" .env 2>/dev/null; then
  echo "⚠️  RESEARCH_BOT_TOKEN 已存在，跳过"
else
  echo "" >> .env
  echo "# Research Bot Token (解票研报机器人 @qixijiepiao_bot)" >> .env
  echo "RESEARCH_BOT_TOKEN=8552043622:AAECkKdaZzONEBZEAT0bjT-9vO5wLPvsPZ4" >> .env
  echo "✅ 已添加 RESEARCH_BOT_TOKEN"
fi

if grep -q "NEWS_BOT_TOKEN" .env 2>/dev/null; then
  echo "⚠️  NEWS_BOT_TOKEN 已存在，跳过"
else
  echo "" >> .env
  echo "# News Bot Token (新闻资讯机器人 @chaojilaos_bot)" >> .env
  echo "NEWS_BOT_TOKEN=7944498422:AAEqKH_QGrWn9xX0v8x3T75SJqq0hXc6Nuc" >> .env
  echo "✅ 已添加 NEWS_BOT_TOKEN"
fi

echo ""
echo "✅ 完成！当前 .env 配置："
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
grep -E "MANAGER_BOT_TOKEN|RESEARCH_BOT_TOKEN|NEWS_BOT_TOKEN|OWNER_TELEGRAM_ID" .env | sed 's/=\(.\{10\}\).*/=\1.../'
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

