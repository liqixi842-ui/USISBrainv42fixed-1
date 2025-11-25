#!/usr/bin/env bash
# USIS Brain v6.0 - Production Deployment Script
# Reserved VM Deployment with Auto-Recovery & Health Monitoring

set -euo pipefail

echo "========================================="
echo "  USIS Brain v6.0 - Production Mode"
echo "  Reserved VM Deployment"
echo "========================================="
echo ""

# 生产环境配置
export NODE_ENV=production
export ENABLE_DB=true
export ENABLE_TELEGRAM=true
export PRIMARY_MODEL=${PRIMARY_MODEL:-gpt-4o-turbo}

# 日志配置
LOG_FILE="/tmp/usis_production.log"
PID_FILE="/tmp/usis.pid"

# 清理旧进程
echo "🔄 Cleaning up old processes..."
pkill -9 -f "node index.js" 2>/dev/null || true
rm -f "$PID_FILE"
sleep 3

# 健康检查函数
health_check() {
  local max_retries=30
  local retry=0
  
  while [ $retry -lt $max_retries ]; do
    if curl -sf http://localhost:5000/health > /dev/null 2>&1; then
      echo "✅ Health check passed"
      return 0
    fi
    echo "⏳ Waiting for application... ($((retry+1))/$max_retries)"
    sleep 2
    retry=$((retry+1))
  done
  
  echo "❌ Health check failed"
  return 1
}

# 启动主应用
start_application() {
  echo "🚀 Starting USIS Brain..."
  nohup node index.js > "$LOG_FILE" 2>&1 &
  local pid=$!
  echo $pid > "$PID_FILE"
  echo "✅ Application started (PID: $pid)"
  
  # 等待启动
  sleep 8
  
  # 健康检查
  if health_check; then
    echo ""
    echo "========================================="
    echo "  ✅ Production Server Ready"
    echo "========================================="
    echo "  • API Server: http://0.0.0.0:5000"
    echo "  • Health Check: http://0.0.0.0:5000/health"
    echo "  • Log File: $LOG_FILE"
    echo "  • Process: PID $pid"
    echo "========================================="
    return 0
  else
    echo "❌ Application failed to start properly"
    echo "📄 Last 50 lines of log:"
    tail -50 "$LOG_FILE"
    return 1
  fi
}

# 启动应用
start_application || {
  echo "❌ Initial startup failed"
  exit 1
}

# 🛡️ 进程监督循环（Reserved VM自动重启的额外保障）
echo ""
echo "🛡️  Starting process supervisor..."
echo ""

while true; do
  PID=$(cat "$PID_FILE" 2>/dev/null || echo "")
  
  # 检查进程是否存活
  if [ -z "$PID" ] || ! ps -p "$PID" > /dev/null 2>&1; then
    echo "⚠️  [$(date)] Process died, auto-restarting..."
    
    # 记录崩溃
    echo "========== CRASH LOG $(date) ==========" >> /tmp/usis_crashes.log
    tail -100 "$LOG_FILE" >> /tmp/usis_crashes.log
    
    # 重启
    start_application || {
      echo "❌ [$(date)] Restart failed, will retry in 10s..."
      sleep 10
      continue
    }
  fi
  
  # 定期健康检查
  if ! curl -sf http://localhost:5000/health > /dev/null 2>&1; then
    echo "⚠️  [$(date)] Health check failed, restarting..."
    pkill -9 -f "node index.js"
    sleep 3
    start_application || {
      echo "❌ [$(date)] Health-triggered restart failed"
    }
  fi
  
  # 30秒检查一次
  sleep 30
done
