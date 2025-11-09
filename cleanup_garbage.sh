#!/bin/bash
# USIS Brain v6.0 - 垃圾代码清理脚本

echo "🗑️  开始清理核心代码中的垃圾..."
echo ""

BACKUP_DIR="./backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📦 步骤1: 备份原始文件..."
cp index.js "$BACKUP_DIR/index.js.bak"
cp screenshotProviders.v4.5.backup.js "$BACKUP_DIR/" 2>/dev/null || true

echo "🗑️  步骤2: 删除备份文件..."
if [ -f "screenshotProviders.v4.5.backup.js" ]; then
  rm screenshotProviders.v4.5.backup.js
  echo "  ✅ 已删除: screenshotProviders.v4.5.backup.js"
else
  echo "  ⏭️  跳过: 文件不存在"
fi

echo ""
echo "🧹 步骤3: 清理index.js中的测试端点..."
echo "  ℹ️  需要手动删除以下代码块："
echo ""
echo "  1️⃣  行 475-563:   /selftest/orchestrate"
echo "  2️⃣  行 5201-5259: /heatmap/test-all"
echo "  3️⃣  行 5262-5367: /heatmap/test"
echo "  4️⃣  行 5371-5424: /api/test-stock-chart"
echo "  5️⃣  行 5426-5468: /api/test-heatmap"
echo ""
echo "⚠️  这些端点包含HTML页面，需要精确删除"
echo "💡 建议: 让Replit Agent帮你删除这些代码块"
echo ""

echo "✅ 清理完成！"
echo ""
echo "📁 备份位置: $BACKUP_DIR"
echo "📊 预计节省: ~500行代码 + 2.8K文件"
