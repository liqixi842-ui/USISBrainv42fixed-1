#!/bin/bash
# ═══════════════════════════════════════════════════════════
# USIS Brain 一键部署脚本
# 用途：在 Rocky 9 服务器上自动部署完整系统
# ═══════════════════════════════════════════════════════════

set -e  # Exit on error

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 USIS Brain 一键部署脚本"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否为 root
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}❌ 请使用 sudo 运行此脚本${NC}"
  exit 1
fi

# 配置变量
APP_DIR="/opt/usis-brain"
APP_USER="usis"
NODE_VERSION="20"

echo "📋 部署配置:"
echo "   ├─ 应用目录: $APP_DIR"
echo "   ├─ 运行用户: $APP_USER"
echo "   ├─ Node.js版本: $NODE_VERSION"
echo "   └─ 域名: myusis.net"
echo ""

# ═══════════════════════════════════════════════════════════
# 步骤 1: 系统更新和基础包安装
# ═══════════════════════════════════════════════════════════
echo -e "${GREEN}[1/8] 系统更新和基础包安装${NC}"
dnf update -y
dnf install -y git wget curl vim gcc-c++ make

# ═══════════════════════════════════════════════════════════
# 步骤 2: 安装 Node.js 20
# ═══════════════════════════════════════════════════════════
echo -e "${GREEN}[2/8] 安装 Node.js ${NODE_VERSION}${NC}"
if ! command -v node &> /dev/null; then
  curl -fsSL https://rpm.nodesource.com/setup_${NODE_VERSION}.x | bash -
  dnf install -y nodejs
fi

echo "   ✓ Node.js: $(node --version)"
echo "   ✓ npm: $(npm --version)"

# ═══════════════════════════════════════════════════════════
# 步骤 3: 安装 PostgreSQL 15
# ═══════════════════════════════════════════════════════════
echo -e "${GREEN}[3/8] 安装 PostgreSQL 15${NC}"
if ! command -v psql &> /dev/null; then
  dnf install -y postgresql15-server postgresql15-contrib
  postgresql-setup --initdb
  systemctl enable postgresql
  systemctl start postgresql
fi

echo "   ✓ PostgreSQL: $(psql --version | head -n1)"

# ═══════════════════════════════════════════════════════════
# 步骤 4: 配置数据库
# ═══════════════════════════════════════════════════════════
echo -e "${GREEN}[4/8] 配置 PostgreSQL 数据库${NC}"

# 创建数据库用户和数据库
sudo -u postgres psql <<EOF
-- 创建用户（如果不存在）
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'usis_brain') THEN
    CREATE USER usis_brain WITH PASSWORD 'change_this_password_in_production';
  END IF;
END
\$\$;

-- 创建数据库（如果不存在）
SELECT 'CREATE DATABASE usis_brain OWNER usis_brain'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'usis_brain')\gexec

-- 授权
GRANT ALL PRIVILEGES ON DATABASE usis_brain TO usis_brain;
EOF

echo "   ✓ 数据库创建完成"

# ═══════════════════════════════════════════════════════════
# 步骤 5: 创建应用用户和目录
# ═══════════════════════════════════════════════════════════
echo -e "${GREEN}[5/8] 创建应用用户和目录${NC}"

# 创建用户
if ! id "$APP_USER" &>/dev/null; then
  useradd -r -s /bin/bash -d $APP_DIR $APP_USER
  echo "   ✓ 用户 $APP_USER 已创建"
else
  echo "   ✓ 用户 $APP_USER 已存在"
fi

# 创建目录
mkdir -p $APP_DIR
chown -R $APP_USER:$APP_USER $APP_DIR

# ═══════════════════════════════════════════════════════════
# 步骤 6: 复制应用代码
# ═══════════════════════════════════════════════════════════
echo -e "${GREEN}[6/8] 部署应用代码${NC}"

# 假设当前脚本在项目根目录运行
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "   从: $SCRIPT_DIR"
echo "   到: $APP_DIR"

# 复制文件（排除node_modules和.git）
rsync -av \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'attached_assets' \
  --exclude '.cache' \
  --exclude 'migration/database_backup' \
  "$SCRIPT_DIR/" "$APP_DIR/"

chown -R $APP_USER:$APP_USER $APP_DIR

# ═══════════════════════════════════════════════════════════
# 步骤 7: 配置环境变量和安装依赖
# ═══════════════════════════════════════════════════════════
echo -e "${GREEN}[7/8] 配置环境和安装依赖${NC}"

# 提示用户配置 .env
if [ ! -f "$APP_DIR/.env" ]; then
  echo -e "${YELLOW}⚠️  请配置环境变量:${NC}"
  echo "   1. cd $APP_DIR"
  echo "   2. cp .env.example .env"
  echo "   3. nano .env  # 填入所有 API Keys"
  echo ""
  echo "   关键变量："
  echo "     - DATABASE_URL=postgresql://usis_brain:your_password@localhost:5432/usis_brain"
  echo "     - REPLIT_DEPLOYMENT_URL=https://myusis.net"
  echo "     - TELEGRAM_BOT_TOKEN=..."
  echo "     - OPENAI_API_KEY=..."
  echo "     - FINNHUB_API_KEY=..."
  echo "     - DOC_RAPTOR_API_KEY=..."
  echo ""
  
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  chown $APP_USER:$APP_USER "$APP_DIR/.env"
  
  read -p "按 Enter 继续编辑 .env 文件..." 
  sudo -u $APP_USER nano "$APP_DIR/.env"
fi

# 安装 npm 依赖
echo "   正在安装 npm 依赖..."
cd $APP_DIR
sudo -u $APP_USER npm ci --only=production

echo "   ✓ 依赖安装完成"

# ═══════════════════════════════════════════════════════════
# 步骤 8: 安装和配置 PM2
# ═══════════════════════════════════════════════════════════
echo -e "${GREEN}[8/8] 配置 PM2 进程管理${NC}"

# 全局安装 PM2
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2
fi

# 启动应用
cd $APP_DIR
sudo -u $APP_USER pm2 start index.js --name usis-brain --time
sudo -u $APP_USER pm2 save

# 设置 PM2 开机自启
env PATH=$PATH:/usr/bin pm2 startup systemd -u $APP_USER --hp $APP_DIR
systemctl enable pm2-$APP_USER

echo "   ✓ PM2 配置完成"

# ═══════════════════════════════════════════════════════════
# 完成
# ═══════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ USIS Brain 部署完成!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📊 应用状态:"
sudo -u $APP_USER pm2 status

echo ""
echo "📋 下一步操作："
echo "   1. 恢复数据库:"
echo "      cd $APP_DIR"
echo "      sudo -u $APP_USER ./migration/2_restore_database.sh"
echo ""
echo "   2. 配置 Nginx (见 migration/4_configure_nginx.sh)"
echo ""
echo "   3. 配置 HTTPS (见 migration/5_setup_https.sh)"
echo ""
echo "   4. 验证部署 (见 migration/6_verify_deployment.sh)"
echo ""
echo "📱 应用管理命令:"
echo "   sudo -u $APP_USER pm2 status         # 查看状态"
echo "   sudo -u $APP_USER pm2 logs           # 查看日志"
echo "   sudo -u $APP_USER pm2 restart all    # 重启"
echo "   sudo -u $APP_USER pm2 stop all       # 停止"
echo ""
