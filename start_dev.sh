#!/usr/bin/env bash
set -euo pipefail

echo "🚀 USIS Brain 开发环境启动 @$(date)"
echo "📍 环境: DEVELOPMENT (Workspace)"

# 清理冲突进程
pkill -9 node 2>/dev/null || true
sleep 2

# 开发环境专属配置
export DEPLOYMENT_ENV=development
export NODE_ENV=development
export ENABLE_DB=true
export ENABLE_TELEGRAM=true
export PRIMARY_MODEL=gpt-4o-turbo

# 验证端口可用性
if netstat -tln 2>/dev/null | grep :5000; then
  echo "❌ 端口5000被占用，强制清理..."
  fuser -k 5000/tcp 2>/dev/null || true
  sleep 2
fi

echo "✅ 启动开发环境服务器..."
exec node index.js
