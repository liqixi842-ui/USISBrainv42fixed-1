#!/bin/bash

# USIS Brain v4.0 快速健康检查

echo "🏥 v4.0 健康检查..."
echo ""

# 检查服务器进程
if pgrep -f "node index.js" > /dev/null; then
    echo "✅ 服务器进程: 运行中"
else
    echo "❌ 服务器进程: 未运行"
    echo "   启动命令: node index.js &"
    exit 1
fi

# 检查端口
PORT=${PORT:-8080}
if netstat -tuln 2>/dev/null | grep ":$PORT " > /dev/null; then
    echo "✅ 端口$PORT: 监听中"
else
    echo "⚠️  端口$PORT: 未监听（可能还在启动）"
fi

# 检查API密钥
echo ""
echo "🔑 环境变量检查:"
[ -n "$OPENAI_API_KEY" ] && echo "✅ OPENAI_API_KEY: 已设置" || echo "❌ OPENAI_API_KEY: 缺失"
[ -n "$FINNHUB_API_KEY" ] && echo "✅ FINNHUB_API_KEY: 已设置" || echo "❌ FINNHUB_API_KEY: 缺失"
[ -n "$FRED_API_KEY" ] && echo "✅ FRED_API_KEY: 已设置" || echo "❌ FRED_API_KEY: 缺失"
[ -n "$DATABASE_URL" ] && echo "✅ DATABASE_URL: 已设置" || echo "❌ DATABASE_URL: 缺失"

# 检查核心文件
echo ""
echo "📁 核心文件检查:"
[ -f "index.js" ] && echo "✅ index.js" || echo "❌ index.js 缺失"
[ -f "gpt5Brain.js" ] && echo "✅ gpt5Brain.js (v4.0核心)" || echo "❌ gpt5Brain.js 缺失"
[ -f "newsBroker.js" ] && echo "✅ newsBroker.js" || echo "❌ newsBroker.js 缺失"
[ -f "dataBroker.js" ] && echo "✅ dataBroker.js" || echo "❌ dataBroker.js 缺失"

# 测试API（轻量级）
echo ""
echo "🧪 API测试（轻量级请求）..."

# 发送测试请求
PORT=${PORT:-8080}
response=$(curl -s -X POST http://localhost:${PORT}/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"text":"test","chat_type":"private","user_id":"health_check"}' \
  --max-time 30)

if echo "$response" | grep -q '"success"'; then
    echo "✅ API响应: 正常"
    
    # 提取关键指标
    if echo "$response" | grep -q 'response_time_ms'; then
        response_time=$(echo "$response" | grep -oP '"response_time_ms":\s*\K[0-9]+')
        echo "   响应时间: ${response_time}ms"
    fi
else
    echo "❌ API响应: 异常"
    echo "   响应内容: $response"
fi

echo ""
echo "================================================"
echo "健康检查完成！"
echo ""
echo "💡 下一步:"
echo "   1. 启动实时监控: ./quick_monitor.sh"
echo "   2. 发送测试请求到Telegram Bot"
echo "   3. 查看监控面板观察性能"
