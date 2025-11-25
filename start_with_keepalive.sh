#!/usr/bin/env bash
set -euo pipefail

echo "🚀 USIS Brain 启动（含Keep-Alive机制）@$(date)"

# 清理冲突进程
pkill -9 node 2>/dev/null || true
sleep 2

# 环境配置
export DEPLOYMENT_ENV=development
export NODE_ENV=development
export ENABLE_DB=true
export ENABLE_TELEGRAM=true
export PRIMARY_MODEL=gpt-4o-turbo

# 启动Node.js服务器
node index.js > /tmp/usis_keepalive.log 2>&1 &
NODE_PID=$!
echo $NODE_PID > /tmp/usis_node.pid

echo "✅ Node.js服务器已启动 (PID: $NODE_PID)"
sleep 5

# 验证启动成功
if ! ps -p $NODE_PID > /dev/null 2>&1; then
  echo "❌ Node.js启动失败"
  tail -20 /tmp/usis_keepalive.log
  exit 1
fi

# 启动Keep-Alive定时器（每25秒ping一次health端点）
echo "🔄 启动Keep-Alive定时器..."
while true; do
  sleep 25
  
  # 检查Node进程是否还在运行
  if ! ps -p $NODE_PID > /dev/null 2>&1; then
    echo "❌ Node.js进程已退出，尝试重启..."
    node index.js >> /tmp/usis_keepalive.log 2>&1 &
    NODE_PID=$!
    echo $NODE_PID > /tmp/usis_node.pid
    sleep 5
    continue
  fi
  
  # 发送健康检查请求
  if curl -s -m 5 http://localhost:5000/health > /dev/null 2>&1; then
    echo "[$(date +%H:%M:%S)] ✅ Health check OK"
  else
    echo "[$(date +%H:%M:%S)] ⚠️  Health check failed"
  fi
done
