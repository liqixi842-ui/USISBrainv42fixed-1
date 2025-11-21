#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# USIS Brain v7.0 - 诊断并修复金融数据 API Keys
# ═══════════════════════════════════════════════════════════════

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 步骤 1: 检查当前 PM2 环境变量"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd /opt/usis-brain

# 检查 PM2 环境中是否有这些 keys
echo ""
echo "📊 当前 PM2 进程的环境变量状态："
pm2 env 0 2>/dev/null | grep -E "FINNHUB_API_KEY|TWELVE_DATA_API_KEY|ALPHA_VANTAGE_API_KEY|FRED_API_KEY" || echo "   ❌ 未找到任何金融 API Keys"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 步骤 2: 检查 .env 文件"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f .env ]; then
  echo ""
  echo "📄 .env 文件中的金融 API Keys："
  grep -E "FINNHUB|TWELVE_DATA|ALPHA_VANTAGE|FRED" .env | sed 's/=.*/=***HIDDEN***/' || echo "   ❌ .env 中未找到金融 API Keys"
else
  echo "   ❌ .env 文件不存在！"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 步骤 3: 检查系统环境变量（bash）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "📊 系统环境变量状态："
env | grep -E "FINNHUB_API_KEY|TWELVE_DATA_API_KEY|ALPHA_VANTAGE_API_KEY|FRED_API_KEY" | sed 's/=.*/=***HIDDEN***/' || echo "   ❌ 系统环境变量中未找到金融 API Keys"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 步骤 4: 修复方案"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 检查是否需要修复
NEEDS_FIX=false

if ! pm2 env 0 2>/dev/null | grep -q "FINNHUB_API_KEY="; then
  echo "   ❌ PM2 环境缺少 FINNHUB_API_KEY"
  NEEDS_FIX=true
fi

if ! pm2 env 0 2>/dev/null | grep -q "TWELVE_DATA_API_KEY="; then
  echo "   ❌ PM2 环境缺少 TWELVE_DATA_API_KEY"
  NEEDS_FIX=true
fi

if ! pm2 env 0 2>/dev/null | grep -q "ALPHA_VANTAGE_API_KEY="; then
  echo "   ❌ PM2 环境缺少 ALPHA_VANTAGE_API_KEY"
  NEEDS_FIX=true
fi

if [ "$NEEDS_FIX" = false ]; then
  echo ""
  echo "✅ 所有必需的 API Keys 已在 PM2 环境中！"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔍 步骤 5: 检查 FinancialDataBroker 日志"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "查看最近的日志，确认数据源状态："
  pm2 logs usis-brain --lines 50 --nostream | grep -E "FinancialDataBroker|Initialized with provider" | tail -5
  echo ""
  echo "如果看到 'provider: unavailable'，则说明 PM2 没有正确加载环境变量。"
  echo "建议执行: pm2 restart usis-brain --update-env"
  exit 0
fi

echo ""
echo "⚠️  检测到 API Keys 缺失，开始修复..."

# 检查 .env 文件中是否有错误的 key 名称
if [ -f .env ]; then
  echo ""
  echo "🔍 检查 .env 文件中是否有命名错误的 keys..."
  
  # 检查是否有 FINNHUB_KEY (错误) 而不是 FINNHUB_API_KEY (正确)
  if grep -q "^FINNHUB_KEY=" .env && ! grep -q "^FINNHUB_API_KEY=" .env; then
    echo "   ⚠️  发现错误: .env 中使用 FINNHUB_KEY，应该是 FINNHUB_API_KEY"
    echo "   正在修复..."
    sed -i 's/^FINNHUB_KEY=/FINNHUB_API_KEY=/' .env
    echo "   ✅ 已修正为 FINNHUB_API_KEY"
  fi
  
  # 检查是否有 ALPHA_VANTAGE_KEY (错误) 而不是 ALPHA_VANTAGE_API_KEY (正确)
  if grep -q "^ALPHA_VANTAGE_KEY=" .env && ! grep -q "^ALPHA_VANTAGE_API_KEY=" .env; then
    echo "   ⚠️  发现错误: .env 中使用 ALPHA_VANTAGE_KEY，应该是 ALPHA_VANTAGE_API_KEY"
    echo "   正在修复..."
    sed -i 's/^ALPHA_VANTAGE_KEY=/ALPHA_VANTAGE_API_KEY=/' .env
    echo "   ✅ 已修正为 ALPHA_VANTAGE_API_KEY"
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 步骤 5: 重启 PM2 并更新环境变量"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

pm2 restart usis-brain --update-env

echo ""
echo "⏳ 等待 5 秒让服务启动..."
sleep 5

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 步骤 6: 验证修复结果"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "📊 重启后的 PM2 环境变量："
pm2 env 0 2>/dev/null | grep -E "FINNHUB_API_KEY|TWELVE_DATA_API_KEY|ALPHA_VANTAGE_API_KEY" | sed 's/=.*/=***HIDDEN***/'

echo ""
echo "📊 FinancialDataBroker 初始化日志："
pm2 logs usis-brain --lines 100 --nostream | grep -E "FinancialDataBroker.*Initialized with provider" | tail -1

# 检查是否成功
if pm2 logs usis-brain --lines 100 --nostream | grep -q "Initialized with provider: finnhub"; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🎉 修复成功！"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "✅ FinancialDataBroker 现在使用: Finnhub (实时数据)"
  echo "✅ buildResearchReport() 将使用完整 v6 逻辑"
  echo "✅ 解票/研报/新闻功能已恢复真实价格和指标"
  echo ""
  echo "🧪 建议测试："
  echo "   在 Telegram 发送: 解票 NVDA 完整版"
  echo "   应该看到真实价格、support/resistance、完整 6 段分析"
  echo ""
elif pm2 logs usis-brain --lines 100 --nostream | grep -q "Initialized with provider: twelve_data"; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🎉 修复成功！"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "✅ FinancialDataBroker 现在使用: Twelve Data (实时数据)"
  echo "✅ buildResearchReport() 将使用完整 v6 逻辑"
  echo "✅ 解票/研报/新闻功能已恢复真实价格和指标"
  echo ""
elif pm2 logs usis-brain --lines 100 --nostream | grep -q "Initialized with provider: unavailable"; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "❌ 修复失败！"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "⚠️  FinancialDataBroker 仍然显示: unavailable"
  echo ""
  echo "可能原因："
  echo "1. .env 文件中 API Keys 的值为空"
  echo "2. PM2 没有正确加载 .env 文件"
  echo "3. API Keys 存储在其他位置（如 ~/.bashrc）"
  echo ""
  echo "建议手动检查："
  echo "   cat .env | grep FINNHUB"
  echo "   cat .env | grep TWELVE_DATA"
  echo ""
  echo "如果 .env 中的值确实为空，需要手动填写 API Keys。"
  echo ""
else
  echo ""
  echo "⚠️  无法确定 FinancialDataBroker 状态"
  echo "请手动查看日志: pm2 logs usis-brain --lines 50"
  echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 诊断完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
