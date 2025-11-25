#!/bin/bash
# ═══════════════════════════════════════════════════════════
# USIS Brain 数据库恢复脚本
# 用途：在新服务器上恢复数据库
# ═══════════════════════════════════════════════════════════

set -e  # Exit on error

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 USIS Brain 数据库恢复"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 检查环境变量
if [ -z "$DATABASE_URL" ]; then
  echo "❌ 错误: DATABASE_URL 环境变量未设置"
  echo "   请在新服务器的 .env 文件中设置或导出："
  echo "   export DATABASE_URL='postgresql://user:pass@localhost:5432/usis_brain'"
  exit 1
fi

# 查找最新的备份文件
BACKUP_DIR="./migration/database_backup"
if [ -f "${BACKUP_DIR}/latest.sql" ]; then
  BACKUP_FILE=$(readlink -f "${BACKUP_DIR}/latest.sql")
elif [ -f "$1" ]; then
  BACKUP_FILE="$1"
else
  echo "❌ 错误: 找不到数据库备份文件"
  echo "   用法: $0 [backup_file.sql]"
  echo "   或将备份文件放在: ${BACKUP_DIR}/latest.sql"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ 错误: 文件不存在: $BACKUP_FILE"
  exit 1
fi

echo "📊 恢复信息:"
echo "   ├─ 备份文件: $BACKUP_FILE"
echo "   ├─ 目标数据库: $DATABASE_URL" | sed 's/:[^:]*@/:****@/'
echo "   └─ 文件大小: $(du -h "$BACKUP_FILE" | cut -f1)"
echo ""

# 确认操作
read -p "⚠️  这将覆盖目标数据库的所有数据。是否继续? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "❌ 操作已取消"
  exit 0
fi

echo ""
echo "🔄 正在恢复数据库..."

# 恢复数据库
psql "$DATABASE_URL" < "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ 数据库恢复成功!"
  echo ""
  echo "📊 验证恢复的表:"
  psql "$DATABASE_URL" -c "\dt"
  echo ""
  echo "📋 数据统计:"
  
  # 显示每个表的行数
  psql "$DATABASE_URL" -t -c "
    SELECT 
      schemaname || '.' || tablename AS table_name,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
  "
  
  echo ""
  echo "✅ 数据库迁移完成!"
  echo ""
else
  echo "❌ 数据库恢复失败"
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
