#!/bin/bash
# USIS Brain v6.5.2 Production Deployment Script
# 运行环境：Replit Reserved VM

set -e  # 遇到错误立即退出

echo "🚀 USIS Brain v6.5.2 部署脚本"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 🔧 自动加载 .env 文件
if [ -f .env ]; then
  echo "📂 加载 .env 文件..."
  export $(grep -v '^#' .env | xargs)
  echo "✅ 环境变量已加载"
else
  echo "⚠️  .env 文件不存在，使用系统环境变量"
fi

# Step 1: 验证环境变量
echo ""
echo "📋 Step 1: 验证必需的环境变量..."

REQUIRED_VARS=(
  "MANAGER_BOT_TOKEN"
  "RESEARCH_BOT_TOKEN"
  "NEWS_BOT_TOKEN"
  "OWNER_TELEGRAM_ID"
)

MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    MISSING_VARS+=("$var")
    echo "❌ $var - 未设置"
  else
    # 只显示前10个字符
    VALUE="${!var}"
    echo "✅ $var - ${VALUE:0:10}..."
  fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
  echo ""
  echo "❌ 错误：以下环境变量未设置："
  printf '   - %s\n' "${MISSING_VARS[@]}"
  echo ""
  echo "请在 .env 文件或 Replit Secrets 中设置这些变量后重新运行"
  exit 1
fi

echo "✅ 所有必需的环境变量已配置"

# Step 2: 检查 Token 唯一性
echo ""
echo "🔒 Step 2: 验证 Token 唯一性..."

if [ "$MANAGER_BOT_TOKEN" == "$RESEARCH_BOT_TOKEN" ]; then
  echo "❌ 错误：MANAGER_BOT_TOKEN 和 RESEARCH_BOT_TOKEN 不能相同"
  exit 1
fi

if [ "$MANAGER_BOT_TOKEN" == "$NEWS_BOT_TOKEN" ]; then
  echo "❌ 错误：MANAGER_BOT_TOKEN 和 NEWS_BOT_TOKEN 不能相同"
  exit 1
fi

if [ "$RESEARCH_BOT_TOKEN" == "$NEWS_BOT_TOKEN" ]; then
  echo "❌ 错误：RESEARCH_BOT_TOKEN 和 NEWS_BOT_TOKEN 不能相同"
  exit 1
fi

echo "✅ 所有 Token 都是唯一的"

# Step 3: 语法检查
echo ""
echo "🔍 Step 3: 检查代码语法..."

if ! node -c index.js 2>&1; then
  echo "❌ index.js 语法错误"
  exit 1
fi

if ! node -c manager-bot.js 2>&1; then
  echo "❌ manager-bot.js 语法错误"
  exit 1
fi

echo "✅ 代码语法检查通过"

# Step 4: 显示部署信息
echo ""
echo "📊 Step 4: 部署信息"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "架构版本: v6.5.2 三机器人分工"
echo "主管机器人: @qixizhuguan_bot (MANAGER_BOT_TOKEN)"
echo "解票机器人: @qixijiepiao_bot (RESEARCH_BOT_TOKEN)"
echo "新闻机器人: @chaojilaos_bot (NEWS_BOT_TOKEN)"
echo "所有者ID: $OWNER_TELEGRAM_ID"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Step 5: 提示下一步
echo ""
echo "✅ 部署前检查完成！"
echo ""
echo "📝 下一步："
echo "1. 确认上述信息正确"
echo "2. 运行以下命令启动应用："
echo ""
echo "   source .env && nohup node index.js > logs/app.log 2>&1 &"
echo ""
echo "3. 查看启动日志："
echo "   tail -f logs/app.log | grep -E 'ManagerBot|Token Check|Architecture'"
echo ""
echo "4. 测试消息路由："
echo "   向 @qixizhuguan_bot 发送: 解票 NVDA"
echo ""
echo "🎉 准备就绪！"

