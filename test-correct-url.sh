#!/bin/bash

export N8N_HEATMAP_WEBHOOK="https://qian.app.n8n.cloud/webhook/heatmap_fixed"

echo "╔═══════════════════════════════════════════════════════╗"
echo "║  🧪 正确测试：使用真实 TradingView URL              ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# 测试 1: 纳指 NAS100
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 测试 1: 纳指 NAS100"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

RESPONSE=$(curl -s -X POST "$N8N_HEATMAP_WEBHOOK" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.tradingview.com/heatmap/stock/?dataset=NAS100&color=change&group=sector&blockSize=market_cap_basic&blockColor=change"}' \
  --max-time 45)

echo "📥 响应长度: ${#RESPONSE} 字节"

if [ ${#RESPONSE} -gt 100 ]; then
  echo "✅ 测试成功！"
  echo ""
  echo "📊 响应预览:"
  echo "$RESPONSE" | head -c 300
  echo "..."
  echo ""
  
  # 提取 screenshot URL
  SCREENSHOT_URL=$(echo "$RESPONSE" | grep -o '"screenshot":"[^"]*"' | cut -d'"' -f4)
  if [ -n "$SCREENSHOT_URL" ]; then
    echo "🎉 成功获取截图 URL:"
    echo "   $SCREENSHOT_URL"
  fi
else
  echo "❌ 响应为空或太短"
  echo "响应内容: $RESPONSE"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 测试 2: 道指 DJI
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 测试 2: 道指 DJI"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

RESPONSE2=$(curl -s -X POST "$N8N_HEATMAP_WEBHOOK" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.tradingview.com/heatmap/stock/?dataset=DJI&color=change&group=sector&blockSize=market_cap_basic&blockColor=change"}' \
  --max-time 45)

echo "📥 响应长度: ${#RESPONSE2} 字节"

if [ ${#RESPONSE2} -gt 100 ]; then
  echo "✅ 测试成功！"
  
  SCREENSHOT_URL2=$(echo "$RESPONSE2" | grep -o '"screenshot":"[^"]*"' | cut -d'"' -f4)
  if [ -n "$SCREENSHOT_URL2" ]; then
    echo "🎉 成功获取截图 URL:"
    echo "   $SCREENSHOT_URL2"
  fi
else
  echo "❌ 响应为空或太短"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 测试完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
