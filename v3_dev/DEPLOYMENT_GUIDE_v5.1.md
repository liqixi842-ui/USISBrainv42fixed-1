# USIS Brain v5.1 生产服务器部署指南
## myusis.net 部署清单

---

## 📦 v5.1 更新内容总览

本次更新包括：
1. ✅ 完整符号描述解析（支持 "Company (EXCHANGE:SYMBOL, Country)" 格式）
2. ✅ 7种行业智能分类 + AI提示词动态适配
3. ✅ 白标品牌系统（firm/brand/analyst 完全可定制）
4. ✅ 多语言架构集成
5. ✅ 专业语言优化（禁用模板化词汇）
6. ✅ 页面标题栏统一（所有20页）
7. ✅ v3-dev Bot 自然语言支持（双入口）

---

## 📋 需要同步的文件列表

### 核心服务文件（v3_dev/services/）

```bash
# v5.1 核心功能文件
v3_dev/services/reportService.js                  # 报告服务主文件
v3_dev/services/industryClassifier.js             # 行业分类器（新增）
v3_dev/services/devBotHandler.js                  # Bot处理器（新增自然语言支持）

# v5 引擎文件（v3_dev/services/v5/）
v3_dev/services/v5/reportBuilderV5.js             # v5 报告构建器
v3_dev/services/v5/writerStockV3.js               # AI内容生成（行业感知）
v3_dev/services/v5/styleEngine.js                 # 样式引擎
v3_dev/services/v5/textCleanerEngine.js           # 文本清理引擎
v3_dev/services/v5/riskCatalystEngine.js          # 风险催化剂引擎
v3_dev/services/v5/coherenceEngine.js             # 连贯性引擎
```

### 路由文件

```bash
v3_dev/routes/report.js                           # v3 报告路由
```

### 根目录文件

```bash
semanticIntentAgent.js                            # 自然语言解析器（如需更新）
index.js                                          # 主入口文件（检查是否有更新）
```

### 配置文件（可选）

```bash
v3_dev/config/bot-config.js                       # Bot配置
```

### 文档文件（可选）

```bash
v3_dev/TESTING_GUIDE.md                           # 测试指南
v3_dev/TELEGRAM_TEST_EXAMPLES.md                  # Telegram测试示例
v3_dev/DUAL_ENTRY_SUMMARY.md                      # 双入口总结
v3_dev/DEPLOYMENT_GUIDE_v5.1.md                   # 本文件
```

---

## 🚀 部署步骤

### 步骤1：备份生产服务器

在 myusis.net 服务器上执行：

```bash
# 1. 备份整个项目目录
cd /path/to/usis-brain
tar -czf ~/usis-brain-backup-$(date +%Y%m%d_%H%M%S).tar.gz .

# 2. 备份数据库（如果有重要数据）
pg_dump -U your_db_user usis_db > ~/usis_db_backup_$(date +%Y%m%d_%H%M%S).sql

# 3. 确认备份成功
ls -lh ~/*backup*
```

### 步骤2：同步文件到生产服务器

**方式A：使用 rsync（推荐）**

在 Replit 环境执行：

```bash
# 创建部署包
mkdir -p /tmp/v5.1-deployment
cp -r v3_dev/services /tmp/v5.1-deployment/
cp -r v3_dev/routes /tmp/v5.1-deployment/
cp -r v3_dev/config /tmp/v5.1-deployment/
cp semanticIntentAgent.js /tmp/v5.1-deployment/

# 打包
cd /tmp
tar -czf v5.1-deployment.tar.gz v5.1-deployment/

# 传输到生产服务器
scp v5.1-deployment.tar.gz user@myusis.net:/tmp/
```

在 myusis.net 服务器执行：

```bash
# 解压到临时目录
cd /tmp
tar -xzf v5.1-deployment.tar.gz

# 同步文件到生产目录
cd /path/to/usis-brain
cp -r /tmp/v5.1-deployment/services/* v3_dev/services/
cp -r /tmp/v5.1-deployment/routes/* v3_dev/routes/
cp -r /tmp/v5.1-deployment/config/* v3_dev/config/
cp /tmp/v5.1-deployment/semanticIntentAgent.js .

# 验证文件同步
ls -la v3_dev/services/v5/
ls -la v3_dev/services/industryClassifier.js
```

**方式B：使用 Git（如果生产服务器有Git仓库）**

```bash
# 在 Replit 提交更改
git add .
git commit -m "v5.1: Industry classification, white-label branding, natural language support"
git push origin main

# 在生产服务器拉取
cd /path/to/usis-brain
git pull origin main
```

**方式C：手动复制（小文件数量）**

使用 SFTP 或 SCP 逐个复制关键文件。

### 步骤3：检查依赖包

在生产服务器检查 `package.json` 确保所有依赖已安装：

```bash
cd /path/to/usis-brain

# 检查依赖
npm list --depth=0

# 如果缺少依赖，安装
npm install

# 特别检查以下包
npm list axios
npm list node-fetch
npm list telegraf
```

### 步骤4：环境变量配置

确保生产服务器 `.env` 文件包含以下变量：

```bash
# 在生产服务器编辑 .env
nano .env

# 必需变量（检查是否存在）
TELEGRAM_BOT_TOKEN=your_production_bot_token
TELEGRAM_BOT_TOKEN_DEV=your_dev_bot_token
OPENAI_API_KEY=sk-proj-...
DATABASE_URL=postgresql://...

# 可选变量（v5.1新增支持）
REPLIT_DEPLOYMENT_URL=http://myusis.net:3000
DOC_RAPTOR_API_KEY=your_docraptor_key
DOC_RAPTOR_TEST_MODE=false

# 保存并退出
```

### 步骤5：数据库检查

v5.1 不需要数据库迁移，但建议检查连接：

```bash
# 测试数据库连接
psql $DATABASE_URL -c "SELECT version();"

# 检查现有表
psql $DATABASE_URL -c "\dt"
```

### 步骤6：语法检查

在生产服务器验证所有 JS 文件语法：

```bash
# 检查关键文件
node -c v3_dev/services/reportService.js
node -c v3_dev/services/industryClassifier.js
node -c v3_dev/services/devBotHandler.js
node -c v3_dev/services/v5/writerStockV3.js
node -c v3_dev/services/v5/reportBuilderV5.js
node -c semanticIntentAgent.js

# 如果所有检查通过
echo "✅ All syntax checks passed"
```

### 步骤7：重启应用

**方式A：使用 PM2（推荐）**

```bash
# 重启应用
pm2 restart usis-brain

# 查看日志
pm2 logs usis-brain --lines 50

# 检查状态
pm2 status
```

**方式B：使用 systemd**

```bash
sudo systemctl restart usis-brain
sudo systemctl status usis-brain
sudo journalctl -u usis-brain -f
```

**方式C：手动重启**

```bash
# 停止现有进程
pkill -f "node.*index.js"

# 启动应用
nohup node index.js > /var/log/usis-brain.log 2>&1 &

# 检查进程
ps aux | grep "node.*index.js"
```

### 步骤8：验证部署

**8.1 检查应用启动**

```bash
# 查看日志确认启动成功
tail -f /var/log/usis-brain.log

# 应看到以下日志：
# ✅ V5 router mounted: GET /v3/report/:symbol → v5 report builder
# ✅ [v3-dev] Routes mounted at /v3/*
# 🚀 USIS Brain v6.0 online on port 3000
```

**8.2 测试 API 端点**

```bash
# 测试 v3 测试端点
curl http://localhost:3000/v3/test

# 测试报告端点（应返回 200）
curl -I "http://localhost:3000/v3/report/NVDA?format=json"
```

**8.3 测试 Telegram Bot**

在 Telegram 发送：

```
/test
```
✅ Bot 应回复在线状态

```
/help
```
✅ 应显示双入口支持说明

```
研报, NVDA, Aberdeen Investments, Anthony Venn Dutton, 英文
```
✅ 应开始生成研报（自然语言测试）

```
/report O brand=VADA firm=Aberdeen Investments analyst=Anthony Venn Dutton
```
✅ 应开始生成研报（结构化测试）

---

## 🔍 故障排查

### 问题1：模块未找到错误

```bash
Error: Cannot find module './semanticIntentAgent'
```

**解决：**
```bash
# 确认文件存在
ls -la semanticIntentAgent.js

# 检查路径
grep -r "require.*semanticIntentAgent" v3_dev/
```

### 问题2：Bot 不响应

**检查：**
```bash
# 1. Bot Token 是否正确
grep TELEGRAM_BOT_TOKEN .env

# 2. Bot 进程是否运行
ps aux | grep telegraf

# 3. 查看 Bot 日志
grep "DEV_BOT\|TG\|Bot" /var/log/usis-brain.log | tail -20
```

### 问题3：API 超时

**检查：**
```bash
# 1. OpenAI API Key
grep OPENAI_API_KEY .env

# 2. 测试 OpenAI 连接
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models | jq '.data[0]'

# 3. 检查网络
ping api.openai.com
```

### 问题4：PDF 生成失败

**检查：**
```bash
# 1. DocRaptor 配置
grep DOC_RAPTOR .env

# 2. 检查 PDFKit 依赖
npm list pdfkit

# 3. 查看报告生成日志
grep "PDF\|DocRaptor\|reportBuilder" /var/log/usis-brain.log | tail -30
```

---

## 📊 部署验证清单

部署完成后，逐项检查：

- [ ] 文件同步完成（所有 v5.1 文件已复制）
- [ ] 依赖包安装完成（`npm list` 无错误）
- [ ] 环境变量配置正确（`.env` 包含所需变量）
- [ ] 应用成功启动（日志显示 "online on port 3000"）
- [ ] v3 API 端点响应正常（`curl /v3/test` 成功）
- [ ] Telegram Bot 在线（`/test` 命令有响应）
- [ ] 自然语言命令工作（`研报, NVDA, ...` 生成报告）
- [ ] 结构化命令工作（`/report NVDA brand=...` 生成报告）
- [ ] 行业分类正确（REIT、Tech、Financial 等）
- [ ] 白标品牌显示正确（firm/brand/analyst 参数）
- [ ] PDF 生成成功（收到完整 PDF 文件）

---

## 🔄 回滚方案

如果部署出现问题，立即回滚：

### 快速回滚

```bash
# 1. 停止当前应用
pm2 stop usis-brain  # 或 sudo systemctl stop usis-brain

# 2. 恢复备份
cd /path/to/usis-brain
rm -rf v3_dev/services v3_dev/routes
tar -xzf ~/usis-brain-backup-YYYYMMDD_HHMMSS.tar.gz

# 3. 重启应用
pm2 restart usis-brain  # 或 sudo systemctl start usis-brain

# 4. 验证回滚成功
curl http://localhost:3000/health
```

### 数据库回滚（如果需要）

```bash
# 恢复数据库备份
psql -U your_db_user usis_db < ~/usis_db_backup_YYYYMMDD_HHMMSS.sql
```

---

## 📞 支持联系

部署过程中遇到问题：

1. 查看日志：`tail -f /var/log/usis-brain.log`
2. 检查进程：`pm2 status` 或 `ps aux | grep node`
3. 测试连接：`curl http://localhost:3000/v3/test`
4. 查看文档：`cat v3_dev/TESTING_GUIDE.md`

---

## 📝 部署记录

**部署日期：** _______________  
**部署人员：** _______________  
**版本号：** v5.1  
**服务器：** myusis.net  
**部署状态：** ☐ 成功 ☐ 失败 ☐ 部分成功  
**备注：** _______________________________

---

**部署完成后，请在 Telegram 测试自然语言和结构化两种命令方式！** 🚀
