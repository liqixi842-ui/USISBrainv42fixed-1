# 🚀 v5.1 生产服务器部署 - 快速开始

## 📋 准备工作（5分钟）

### 方式1：自动化部署（推荐）

```bash
# 在 Replit 执行
bash v3_dev/QUICK_DEPLOY.sh
```

脚本会自动：
1. ✅ 创建部署包
2. ✅ 打包所有文件
3. ✅ 生成远程部署脚本
4. ✅ 提示下一步操作

### 方式2：手动部署

**步骤1：下载文件清单**
```bash
cat v3_dev/FILES_TO_SYNC.txt
```

**步骤2：创建部署包**
```bash
# 创建临时目录
mkdir -p /tmp/v5.1-deployment/v3_dev

# 复制文件
cp -r v3_dev/services /tmp/v5.1-deployment/v3_dev/
cp -r v3_dev/routes /tmp/v5.1-deployment/v3_dev/
cp semanticIntentAgent.js /tmp/v5.1-deployment/

# 打包
cd /tmp
tar -czf v5.1-deployment.tar.gz v5.1-deployment/
```

**步骤3：传输到生产服务器**
```bash
scp /tmp/v5.1-deployment.tar.gz user@myusis.net:/tmp/
```

---

## 🔧 在生产服务器上部署（10分钟）

### 1. 备份现有系统

```bash
cd /path/to/usis-brain
tar -czf ~/usis-backup-$(date +%Y%m%d_%H%M%S).tar.gz .
```

### 2. 解压并同步文件

```bash
cd /tmp
tar -xzf v5.1-deployment.tar.gz

cd /path/to/usis-brain
cp -r /tmp/v5.1-deployment/v3_dev/services/* v3_dev/services/
cp -r /tmp/v5.1-deployment/v3_dev/routes/* v3_dev/routes/
cp /tmp/v5.1-deployment/semanticIntentAgent.js .
```

### 3. 检查语法

```bash
node -c v3_dev/services/reportService.js
node -c v3_dev/services/industryClassifier.js
node -c v3_dev/services/devBotHandler.js
node -c semanticIntentAgent.js
```

### 4. 重启应用

```bash
# 使用 PM2
pm2 restart usis-brain

# 或使用 systemd
sudo systemctl restart usis-brain
```

### 5. 验证部署

```bash
# 测试 API
curl http://localhost:3000/v3/test

# 查看日志
tail -f /var/log/usis-brain.log
```

---

## ✅ 验证功能（5分钟）

### 在 Telegram 测试

**1. 基础测试**
```
/help
```
✅ 应显示双入口支持说明

**2. 自然语言测试**
```
研报, NVDA, Aberdeen Investments, Anthony Venn Dutton, 英文
```
✅ 应开始生成研报

**3. 结构化命令测试**
```
/report O brand=VADA firm=Aberdeen Investments analyst=Anthony Venn Dutton
```
✅ 应开始生成研报，PDF显示 brand 参数

---

## 📖 详细文档

| 文档 | 用途 |
|------|------|
| `DEPLOYMENT_GUIDE_v5.1.md` | 完整部署指南（含故障排查） |
| `QUICK_DEPLOY.sh` | 自动化部署脚本 |
| `FILES_TO_SYNC.txt` | 文件同步清单 |
| `TESTING_GUIDE.md` | 功能测试指南 |
| `TELEGRAM_TEST_EXAMPLES.md` | Telegram 测试示例 |
| `DUAL_ENTRY_SUMMARY.md` | 双入口技术总结 |

---

## 🆘 遇到问题？

**应用无法启动**
```bash
# 查看详细错误
tail -100 /var/log/usis-brain.log
```

**Bot 不响应**
```bash
# 检查 Bot Token
grep TELEGRAM_BOT_TOKEN .env

# 检查进程
ps aux | grep telegraf
```

**API 超时**
```bash
# 检查 OpenAI Key
grep OPENAI_API_KEY .env

# 测试连接
curl https://api.openai.com/v1/models
```

**需要回滚**
```bash
cd /path/to/usis-brain
tar -xzf ~/usis-backup-YYYYMMDD_HHMMSS.tar.gz
pm2 restart usis-brain
```

---

## 🎯 部署检查清单

- [ ] 备份完成
- [ ] 文件同步完成
- [ ] 语法检查通过
- [ ] 应用重启成功
- [ ] API 端点响应
- [ ] Telegram Bot 在线
- [ ] 自然语言命令工作
- [ ] 结构化命令工作
- [ ] PDF 生成成功

---

**部署完成后，请立即测试 Telegram Bot 以确保所有功能正常！** 🚀
