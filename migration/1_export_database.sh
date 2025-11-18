#!/bin/bash
# ═══════════════════════════════════════════════════════════
# USIS Brain 数据库导出脚本
# 用途：从 Replit/Neon 导出完整数据库
# ═══════════════════════════════════════════════════════════

set -e  # Exit on error

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 USIS Brain 数据库导出"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 检查环境变量
if [ -z "$DATABASE_URL" ]; then
  echo "❌ 错误: DATABASE_URL 环境变量未设置"
  echo "   请在 .env 文件中设置或导出："
  echo "   export DATABASE_URL='postgresql://...'"
  exit 1
fi

# 创建备份目录
BACKUP_DIR="./migration/database_backup"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/usis_brain_${TIMESTAMP}.sql"

echo "📊 数据库信息:"
echo "   ├─ 来源: $DATABASE_URL" | sed 's/:[^:]*@/:****@/'
echo "   ├─ 目标文件: $BACKUP_FILE"
echo "   └─ 时间戳: $TIMESTAMP"
echo ""

# 导出数据库结构和数据
echo "🔄 正在导出数据库..."
pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  --verbose \
  > "$BACKUP_FILE" 2>&1

if [ $? -eq 0 ]; then
  FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo ""
  echo "✅ 数据库导出成功!"
  echo "   ├─ 文件: $BACKUP_FILE"
  echo "   ├─ 大小: $FILE_SIZE"
  echo "   └─ 包含表:"
  
  # 列出所有表
  psql "$DATABASE_URL" -t -c "\dt" | grep public | awk '{print "      - " $3}'
  
  echo ""
  echo "📋 下一步："
  echo "   1. 将此文件复制到新服务器"
  echo "   2. 在新服务器上运行: ./migration/2_restore_database.sh"
  echo ""
else
  echo "❌ 数据库导出失败"
  exit 1
fi

# 创建最新备份的符号链接
ln -sf "$(basename "$BACKUP_FILE")" "${BACKUP_DIR}/latest.sql"
echo "🔗 已创建符号链接: ${BACKUP_DIR}/latest.sql"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
