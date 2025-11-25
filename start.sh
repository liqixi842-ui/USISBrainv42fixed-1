#!/usr/bin/env bash
set -euo pipefail

echo "[USIS Brain] 安全重启 @$(date)"
# Git命令在生产环境不可用，已移除
# echo -n "[USIS Brain] git版本: " && git rev-parse --short HEAD

# 彻底清理旧进程
echo "🔄 清理旧进程..."
pkill -9 node 2>/dev/null || true
pkill -9 telegram 2>/dev/null || true
sleep 3

# 设置环境
export PRIMARY_MODEL=${PRIMARY_MODEL:-gpt-4o-turbo}
export ENABLE_DB=true
export ENABLE_TELEGRAM=true  
export NODE_ENV=production

echo "✅ 启动完整功能服务器..."
node index.js
