#!/bin/bash
# USIS Brain v5.1 快速部署脚本
# 用于将 v5.1 更新同步到生产服务器 myusis.net

set -e  # 遇到错误立即退出

echo "🚀 USIS Brain v5.1 部署脚本"
echo "=================================="
echo ""

# 配置变量（请根据实际情况修改）
PRODUCTION_SERVER="myusis.net"
PRODUCTION_USER="your_username"
PRODUCTION_PATH="/path/to/usis-brain"
DEPLOYMENT_DIR="/tmp/v5.1-deployment"

echo "📋 部署配置："
echo "  服务器: $PRODUCTION_SERVER"
echo "  用户: $PRODUCTION_USER"
echo "  路径: $PRODUCTION_PATH"
echo ""

# 步骤1：创建部署包
echo "📦 步骤1: 创建部署包..."
rm -rf $DEPLOYMENT_DIR
mkdir -p $DEPLOYMENT_DIR/v3_dev

# 复制核心文件
echo "  复制 v3_dev/services..."
cp -r v3_dev/services $DEPLOYMENT_DIR/v3_dev/

echo "  复制 v3_dev/routes..."
cp -r v3_dev/routes $DEPLOYMENT_DIR/v3_dev/

echo "  复制 v3_dev/config..."
cp -r v3_dev/config $DEPLOYMENT_DIR/v3_dev/ 2>/dev/null || echo "  (config 目录不存在，跳过)"

echo "  复制 semanticIntentAgent.js..."
cp semanticIntentAgent.js $DEPLOYMENT_DIR/

# 复制文档（可选）
echo "  复制文档文件..."
cp v3_dev/TESTING_GUIDE.md $DEPLOYMENT_DIR/v3_dev/ 2>/dev/null || true
cp v3_dev/TELEGRAM_TEST_EXAMPLES.md $DEPLOYMENT_DIR/v3_dev/ 2>/dev/null || true
cp v3_dev/DUAL_ENTRY_SUMMARY.md $DEPLOYMENT_DIR/v3_dev/ 2>/dev/null || true
cp v3_dev/DEPLOYMENT_GUIDE_v5.1.md $DEPLOYMENT_DIR/v3_dev/ 2>/dev/null || true

# 创建文件清单
echo "  创建文件清单..."
find $DEPLOYMENT_DIR -type f > $DEPLOYMENT_DIR/FILE_LIST.txt
echo "  ✅ 部署包创建完成: $(cat $DEPLOYMENT_DIR/FILE_LIST.txt | wc -l) 个文件"
echo ""

# 步骤2：打包
echo "📦 步骤2: 打包文件..."
cd /tmp
tar -czf v5.1-deployment.tar.gz v5.1-deployment/
PACKAGE_SIZE=$(du -h v5.1-deployment.tar.gz | cut -f1)
echo "  ✅ 打包完成: v5.1-deployment.tar.gz ($PACKAGE_SIZE)"
echo ""

# 步骤3：传输到生产服务器
echo "📤 步骤3: 传输到生产服务器..."
echo "  目标: $PRODUCTION_USER@$PRODUCTION_SERVER:/tmp/"
echo ""
echo "⚠️  请确认您有 SSH 访问权限"
echo "  执行以下命令手动传输："
echo ""
echo "  scp /tmp/v5.1-deployment.tar.gz $PRODUCTION_USER@$PRODUCTION_SERVER:/tmp/"
echo ""
read -p "是否现在传输? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]
then
    scp /tmp/v5.1-deployment.tar.gz $PRODUCTION_USER@$PRODUCTION_SERVER:/tmp/
    echo "  ✅ 传输完成"
else
    echo "  ⏭️  跳过传输，请手动执行"
fi
echo ""

# 步骤4：生成远程部署脚本
echo "📝 步骤4: 生成远程部署脚本..."
cat > /tmp/remote-deploy.sh << 'EOF'
#!/bin/bash
# 在生产服务器上执行的部署脚本

set -e

PRODUCTION_PATH="/path/to/usis-brain"  # 请修改为实际路径
BACKUP_DIR="$HOME/usis-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "🔄 开始部署 v5.1..."
echo ""

# 1. 创建备份
echo "📦 创建备份..."
mkdir -p $BACKUP_DIR
cd $PRODUCTION_PATH
tar -czf $BACKUP_DIR/usis-brain-backup-$TIMESTAMP.tar.gz \
    v3_dev/services v3_dev/routes v3_dev/config semanticIntentAgent.js 2>/dev/null || true
echo "  ✅ 备份已保存: $BACKUP_DIR/usis-brain-backup-$TIMESTAMP.tar.gz"
echo ""

# 2. 解压新文件
echo "📂 解压部署包..."
cd /tmp
tar -xzf v5.1-deployment.tar.gz
echo "  ✅ 解压完成"
echo ""

# 3. 同步文件
echo "🔄 同步文件到生产目录..."
cd $PRODUCTION_PATH

# 复制服务文件
cp -r /tmp/v5.1-deployment/v3_dev/services/* v3_dev/services/
echo "  ✅ 同步 v3_dev/services/"

# 复制路由文件
cp -r /tmp/v5.1-deployment/v3_dev/routes/* v3_dev/routes/
echo "  ✅ 同步 v3_dev/routes/"

# 复制配置文件
if [ -d /tmp/v5.1-deployment/v3_dev/config ]; then
    cp -r /tmp/v5.1-deployment/v3_dev/config/* v3_dev/config/ 2>/dev/null || true
    echo "  ✅ 同步 v3_dev/config/"
fi

# 复制根目录文件
cp /tmp/v5.1-deployment/semanticIntentAgent.js .
echo "  ✅ 同步 semanticIntentAgent.js"
echo ""

# 4. 验证语法
echo "🔍 验证文件语法..."
node -c v3_dev/services/reportService.js && echo "  ✅ reportService.js"
node -c v3_dev/services/industryClassifier.js && echo "  ✅ industryClassifier.js"
node -c v3_dev/services/devBotHandler.js && echo "  ✅ devBotHandler.js"
node -c v3_dev/services/v5/writerStockV3.js && echo "  ✅ writerStockV3.js"
node -c v3_dev/services/v5/reportBuilderV5.js && echo "  ✅ reportBuilderV5.js"
node -c semanticIntentAgent.js && echo "  ✅ semanticIntentAgent.js"
echo ""

# 5. 重启应用
echo "🔄 重启应用..."
if command -v pm2 &> /dev/null; then
    pm2 restart usis-brain || pm2 start index.js --name usis-brain
    echo "  ✅ PM2 重启完成"
elif command -v systemctl &> /dev/null; then
    sudo systemctl restart usis-brain
    echo "  ✅ systemd 重启完成"
else
    echo "  ⚠️  请手动重启应用"
fi
echo ""

# 6. 验证部署
echo "✅ 验证部署..."
sleep 3
curl -s http://localhost:3000/v3/test > /dev/null && echo "  ✅ API 端点正常" || echo "  ❌ API 端点异常"
echo ""

echo "🎉 部署完成！"
echo ""
echo "📋 接下来："
echo "  1. 检查日志: tail -f /var/log/usis-brain.log"
echo "  2. 测试 Bot: 在 Telegram 发送 /help"
echo "  3. 测试自然语言: 研报, NVDA, Aberdeen Investments, Anthony Venn Dutton, 英文"
echo "  4. 测试结构化: /report NVDA brand=VADA firm=Aberdeen Investments analyst=Anthony Venn Dutton"
echo ""
echo "如需回滚："
echo "  cd $PRODUCTION_PATH"
echo "  tar -xzf $BACKUP_DIR/usis-brain-backup-$TIMESTAMP.tar.gz"
echo "  pm2 restart usis-brain  # 或 sudo systemctl restart usis-brain"
EOF

chmod +x /tmp/remote-deploy.sh
echo "  ✅ 远程部署脚本已生成: /tmp/remote-deploy.sh"
echo ""

# 步骤5：显示后续操作
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 后续操作指南"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1️⃣ 传输远程部署脚本到服务器："
echo "   scp /tmp/remote-deploy.sh $PRODUCTION_USER@$PRODUCTION_SERVER:/tmp/"
echo ""
echo "2️⃣ SSH 登录到生产服务器："
echo "   ssh $PRODUCTION_USER@$PRODUCTION_SERVER"
echo ""
echo "3️⃣ 在服务器上执行部署脚本："
echo "   # 修改脚本中的 PRODUCTION_PATH"
echo "   nano /tmp/remote-deploy.sh"
echo "   "
echo "   # 执行部署"
echo "   bash /tmp/remote-deploy.sh"
echo ""
echo "4️⃣ 验证部署："
echo "   curl http://localhost:3000/v3/test"
echo "   tail -f /var/log/usis-brain.log"
echo ""
echo "5️⃣ 在 Telegram 测试："
echo "   /help"
echo "   研报, NVDA, Aberdeen Investments, Anthony Venn Dutton, 英文"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ 本地准备工作完成！"
echo ""
