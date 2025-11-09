#!/usr/bin/env bash
set -euo pipefail

echo "🚀 USIS Brain 生产模式启动 @$(date)"

# 清理冲突进程
pkill -9 node 2>/dev/null || true
sleep 2

# 生产环境配置
export DEPLOYMENT_ENV=production
export NODE_ENV=production
export ENABLE_DB=true
export ENABLE_TELEGRAM=true
export PRIMARY_MODEL=gpt-4o-turbo

# 使用nohup确保进程持续运行
nohup node index.js > /tmp/usis_production.log 2>&1 &
echo $! > /tmp/usis.pid

sleep 5

# 验证启动
PID=$(cat /tmp/usis.pid 2>/dev/null || echo "")
if [ -n "$PID" ] && ps -p $PID > /dev/null 2>&1; then
  echo "✅ 服务器已启动 (PID: $PID)"
  echo "📝 日志位置: /tmp/usis_production.log"
  echo "🔍 查看日志: tail -f /tmp/usis_production.log"
else
  echo "❌ 启动失败"
  exit 1
fi
