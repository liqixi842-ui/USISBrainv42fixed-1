#!/bin/bash
# ═══════════════════════════════════════════════════════════
# USIS Brain Nginx 配置脚本
# 用途：配置 Nginx 反向代理
# ═══════════════════════════════════════════════════════════

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 配置 Nginx 反向代理"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 检查是否为 root
if [ "$EUID" -ne 0 ]; then 
  echo "❌ 请使用 sudo 运行此脚本"
  exit 1
fi

# 安装 Nginx
echo "[1/3] 安装 Nginx"
dnf install -y nginx

# 创建 Nginx 配置
echo "[2/3] 创建配置文件"

cat > /etc/nginx/conf.d/usis-brain.conf <<'EOF'
# USIS Brain - myusis.net
# Nginx 反向代理配置

upstream usis_brain_backend {
    server 127.0.0.1:3000 fail_timeout=0;
}

server {
    listen 80;
    listen [::]:80;
    server_name myusis.net www.myusis.net;

    # 日志
    access_log /var/log/nginx/usis-brain-access.log;
    error_log /var/log/nginx/usis-brain-error.log;

    # 客户端上传大小限制（PDF生成可能需要）
    client_max_body_size 50M;

    # 根路径代理到 Node.js
    location / {
        proxy_pass http://usis_brain_backend;
        proxy_http_version 1.1;
        
        # 代理头
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 缓存控制
        proxy_cache_bypass $http_upgrade;
        
        # 超时设置（研报生成可能需要较长时间）
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # 健康检查端点（不记录日志）
    location /health {
        proxy_pass http://usis_brain_backend;
        access_log off;
    }

    # 静态文件缓存（如果有）
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg)$ {
        proxy_pass http://usis_brain_backend;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

echo "   ✓ 配置文件已创建: /etc/nginx/conf.d/usis-brain.conf"

# 测试配置
echo "[3/3] 测试 Nginx 配置"
nginx -t

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Nginx 配置成功!"
  echo ""
  
  # 启动 Nginx
  systemctl enable nginx
  systemctl restart nginx
  
  echo "📊 Nginx 状态:"
  systemctl status nginx --no-pager -l
  
  echo ""
  echo "📋 下一步："
  echo "   运行 HTTPS 配置脚本:"
  echo "   sudo ./migration/5_setup_https.sh"
  echo ""
else
  echo "❌ Nginx 配置测试失败"
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
