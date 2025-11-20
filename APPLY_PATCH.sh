#!/bin/bash
# v6.5.2 Critical Fix - 应用补丁

set -e

echo "🔧 v6.5.2 Critical Fix - 解票功能路由修复"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 检查文件是否存在
if [ ! -f "v6.5.2_fix.patch" ]; then
    echo "❌ 错误: v6.5.2_fix.patch 文件不存在"
    echo "请先从 Replit 下载 v6.5.2_fix.patch 文件到当前目录"
    exit 1
fi

# 备份原文件
echo "📦 备份原文件..."
cp index.js index.js.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ 备份完成: index.js.backup.$(date +%Y%m%d_%H%M%S)"

# 应用补丁
echo ""
echo "🔧 应用补丁..."
if patch -p1 < v6.5.2_fix.patch; then
    echo "✅ 补丁应用成功！"
else
    echo "❌ 补丁应用失败！正在恢复备份..."
    cp index.js.backup.* index.js
    echo "已恢复原文件"
    exit 1
fi

# 重启应用
echo ""
echo "🔄 重启应用..."
pkill -f "node index.js" || echo "   (没有旧进程在运行)"
sleep 2

nohup node index.js > logs/app.log 2>&1 &
NEW_PID=$!

echo "✅ 应用已重启 (PID: $NEW_PID)"
echo ""
echo "⏳ 等待 5 秒..."
sleep 5

echo ""
echo "📋 启动日志检查："
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
tail -30 logs/app.log | grep -E "ManagerBot|V3 Production|Token Check|online" || tail -30 logs/app.log

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ 部署完成！"
echo ""
echo "🧪 测试步骤："
echo "1. 在 Telegram 给 @qixizhuguan_bot 发送: 解票 NVDA"
echo "2. 立即运行: tail -f logs/app.log | grep 'MANAGER → TICKET'"
echo "3. 检查日志中的 endpoint 字段应该显示:"
echo "   endpoint: 'generateStockChart (Production v3 - Lightweight)'"
echo ""
echo "📊 预期结果："
echo "• 不再出现 90 秒超时"
echo "• 15-30 秒内收到 NVDA 技术分析"
echo "• 回复来自 @qixijiepiao_bot (Research Bot)"
