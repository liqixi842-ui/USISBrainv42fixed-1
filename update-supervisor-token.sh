#!/bin/bash
# USIS Brain v7.0 - 主管Bot Token快速更新脚本
# 仅更新SUPERVISOR_BOT_TOKEN，其他Token保持不变

set -e

echo "======================================"
echo "  主管Bot Token更新脚本"
echo "======================================"
echo ""

# 检查是否在正确的目录
if [ ! -f "index.js" ]; then
    echo "❌ 错误: 请在 /opt/usis-brain 目录下运行此脚本"
    exit 1
fi

# 检查.env文件是否存在
if [ ! -f ".env" ]; then
    echo "❌ 错误: .env文件不存在，请先运行 setup-tokens.sh"
    exit 1
fi

echo "新主管Bot Token: 8301809386:AAEzjxxCq8t_FsRR1QD1kSLpozOsLTKIzA"
echo ""
read -p "确认更新? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 已取消"
    exit 1
fi

# 备份旧.env
BACKUP_FILE=".env.backup.$(date +%Y%m%d_%H%M%S)"
cp .env "$BACKUP_FILE"
echo "✅ 已备份旧配置到: $BACKUP_FILE"

# 替换主管Token（保留其他所有行）
sed -i 's/^SUPERVISOR_BOT_TOKEN=.*/SUPERVISOR_BOT_TOKEN=8301809386:AAEzjxxCq8t_FsRR1QD1kSLpozOsLTKIzA/' .env

echo "✅ 主管Token已更新"
echo ""

# 验证更新
echo "======================================"
echo "验证更新结果："
echo "======================================"
grep SUPERVISOR_BOT_TOKEN .env | sed 's/\(.\{40\}\).*/\1.../'
echo ""

# 重启bot
echo "======================================"
echo "重启Bot..."
echo "======================================"
pm2 restart usis-brain --update-env

echo ""
echo "等待3秒后查看启动日志..."
sleep 3

echo ""
echo "======================================"
echo "启动日志（最近100行）："
echo "======================================"
pm2 logs usis-brain --lines 100 --nostream | grep -E "🏗️|Bot Architecture|Telegraf|Ready|401|409|Error|error" || echo "（未发现错误关键词）"

echo ""
echo "======================================"
echo "✅ 更新完成！"
echo "======================================"
echo "测试步骤："
echo "1. 向 @qixizhuguan_bot 发送'你好'"
echo "2. 发送'解票 NVDA'测试完整流程"
echo ""
