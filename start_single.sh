#!/usr/bin/env bash
set -euo pipefail

echo "[USIS Brain] 单实例安全启动 @$(date)"

# 彻底清理所有可能的冲突进程
echo "🔄 清理所有Node和Bot进程..."
pkill -9 node 2>/dev/null || true
pkill -9 telegram 2>/dev/null || true
pkill -9 bot 2>/dev/null || true
fuser -k 5000/tcp 2>/dev/null || true

# 等待确保进程完全退出
sleep 5

# 设置环境变量
export ENABLE_DB=true
export ENABLE_TELEGRAM=true
export NODE_ENV=production
export PRIMARY_MODEL=gpt-4o-turbo

# 验证端口是否空闲
if netstat -tln 2>/dev/null | grep :5000; then
  echo "❌ 端口5000仍被占用，强制清理..."
  fuser -k 5000/tcp 2>/dev/null || true
  sleep 2
fi

echo "✅ 启动单实例服务器..."
exec node index.js
