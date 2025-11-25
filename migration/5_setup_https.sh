#!/bin/bash
# ═══════════════════════════════════════════════════════════
# USIS Brain HTTPS 配置脚本
# 用途：使用 Certbot 配置 Let's Encrypt SSL 证书
# ═══════════════════════════════════════════════════════════

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔒 配置 HTTPS (Let's Encrypt)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 检查是否为 root
if [ "$EUID" -ne 0 ]; then 
  echo "❌ 请使用 sudo 运行此脚本"
  exit 1
fi

DOMAIN="myusis.net"
EMAIL="admin@${DOMAIN}"  # 修改为您的邮箱

echo "📋 SSL 配置信息:"
echo "   ├─ 域名: $DOMAIN"
echo "   └─ 邮箱: $EMAIL"
echo ""

# 安装 Certbot
echo "[1/3] 安装 Certbot"
dnf install -y certbot python3-certbot-nginx

# 验证 DNS 已正确指向
echo ""
echo "[2/3] DNS 检查"
echo "⚠️  请确保以下 DNS 记录已设置:"
echo "   A    myusis.net    →  150.242.90.36"
echo "   A    www.myusis.net →  150.242.90.36"
echo ""

read -p "DNS 已配置完成? (yes/no): " DNS_READY
if [ "$DNS_READY" != "yes" ]; then
  echo "❌ 请先配置 DNS 记录后再运行此脚本"
  exit 0
fi

# 获取证书
echo ""
echo "[3/3] 获取 SSL 证书"
echo "⚠️  Certbot 将自动配置 Nginx"
echo ""

certbot --nginx \
  -d $DOMAIN \
  -d www.$DOMAIN \
  --non-interactive \
  --agree-tos \
  --email $EMAIL \
  --redirect

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ HTTPS 配置成功!"
  echo ""
  
  # 显示证书信息
  certbot certificates
  
  echo ""
  echo "📋 证书自动续期:"
  echo "   Certbot 已配置自动续期，每天检查2次"
  echo ""
  echo "   手动测试续期:"
  echo "   sudo certbot renew --dry-run"
  echo ""
  echo "📊 Nginx 配置已更新:"
  cat /etc/nginx/conf.d/usis-brain.conf
  echo ""
  echo "🌐 访问测试:"
  echo "   https://myusis.net/health"
  echo "   https://myusis.net/v3/report/test"
  echo ""
else
  echo "❌ HTTPS 配置失败"
  echo "   请检查:"
  echo "   1. DNS 记录是否正确"
  echo "   2. 防火墙是否开放 80/443 端口"
  echo "   3. Nginx 是否正常运行"
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
