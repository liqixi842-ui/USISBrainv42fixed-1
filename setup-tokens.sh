#!/bin/bash
# USIS Brain v7.0 - Token配置脚本
# 安全交互式配置，不在git中存储Token

set -e

echo "======================================"
echo "  USIS Brain v7.0 Token配置脚本"
echo "======================================"
echo ""

# 检查是否在正确的目录
if [ ! -f "index.js" ]; then
    echo "❌ 错误: 请在 /opt/usis-brain 目录下运行此脚本"
    exit 1
fi

echo "请依次输入4个Bot Token："
echo ""

# 输入主管Bot Token
echo "1️⃣ 主管机器人 (@qixizhuguan_bot) Token:"
read -r SUPERVISOR_TOKEN
if [ -z "$SUPERVISOR_TOKEN" ]; then
    echo "❌ 主管Token不能为空"
    exit 1
fi

# 输入解票Bot Token
echo ""
echo "2️⃣ 解票机器人 (@qixijiepiao_bot) Token:"
read -r TICKET_TOKEN
if [ -z "$TICKET_TOKEN" ]; then
    echo "❌ 解票Token不能为空"
    exit 1
fi

# 输入研报Bot Token
echo ""
echo "3️⃣ 研报机器人 (@qixilaoshi_bot) Token:"
read -r REPORT_TOKEN
if [ -z "$REPORT_TOKEN" ]; then
    echo "❌ 研报Token不能为空"
    exit 1
fi

# 输入新闻Bot Token
echo ""
echo "4️⃣ 新闻机器人 (@chaojilaos_bot) Token:"
read -r NEWS_TOKEN
if [ -z "$NEWS_TOKEN" ]; then
    echo "❌ 新闻Token不能为空"
    exit 1
fi

echo ""
echo "======================================"
echo "Token验证（脱敏显示）："
echo "======================================"
echo "主管: ${SUPERVISOR_TOKEN:0:10}...${SUPERVISOR_TOKEN: -4}"
echo "解票: ${TICKET_TOKEN:0:10}...${TICKET_TOKEN: -4}"
echo "研报: ${REPORT_TOKEN:0:10}...${REPORT_TOKEN: -4}"
echo "新闻: ${NEWS_TOKEN:0:10}...${NEWS_TOKEN: -4}"
echo ""

read -p "确认写入.env文件? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 已取消"
    exit 1
fi

# 备份旧.env
if [ -f ".env" ]; then
    BACKUP_FILE=".env.backup.$(date +%Y%m%d_%H%M%S)"
    cp .env "$BACKUP_FILE"
    echo "✅ 已备份旧配置到: $BACKUP_FILE"
fi

# 写入新.env
cat > .env << EOF
# USIS Brain v7.0 - Telegram Bot Tokens
# 生成时间: $(date)

SUPERVISOR_BOT_TOKEN=$SUPERVISOR_TOKEN
TICKET_BOT_TOKEN=$TICKET_TOKEN
REPORT_BOT_TOKEN=$REPORT_TOKEN
NEWS_BOT_TOKEN=$NEWS_TOKEN

# 其他环境变量保持不变（如果需要，请手动添加）
EOF

echo "✅ .env文件已更新"
echo ""
echo "======================================"
echo "下一步操作："
echo "======================================"
echo "1. 重启bot: pm2 restart usis-brain --update-env"
echo "2. 查看日志: pm2 logs usis-brain --lines 50"
echo "3. 发送'你好'到 @qixizhuguan_bot 测试"
echo ""
