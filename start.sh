#!/bin/bash
# USIS Brain v6.5.2 一键启动脚本

set -e

echo "🚀 USIS Brain v6.5.2 一键启动"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. 创建日志目录
mkdir -p logs

# 2. 加载环境变量
if [ -f .env ]; then
  echo "📂 加载环境变量..."
  export $(grep -v '^#' .env | xargs)
fi

# 3. 停止旧进程
echo "🛑 停止旧进程..."
pkill -f "node index.js" || echo "   (没有旧进程在运行)"
sleep 2

# 4. 启动新进程
echo "▶️  启动应用..."
nohup node index.js > logs/app.log 2>&1 &
NEW_PID=$!

echo "✅ 应用已启动 (PID: $NEW_PID)"
echo ""
echo "⏳ 等待5秒让应用初始化..."
sleep 5

# 5. 检查启动状态
echo ""
echo "📋 启动日志（最近30行）："
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
tail -30 logs/app.log | grep -E "ManagerBot|Token Check|Architecture|online" || tail -30 logs/app.log

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ 部署完成！"
echo ""
echo "📝 验证步骤："
echo "1. 检查上方日志是否有错误"
echo "2. 在 Telegram 给 @qixizhuguan_bot 发送: /start"
echo "3. 测试解票功能: 解票 NVDA"
echo ""
echo "🔍 实时查看日志："
echo "   tail -f logs/app.log"
echo ""
echo "🛑 停止应用："
echo "   pkill -f 'node index.js'"

