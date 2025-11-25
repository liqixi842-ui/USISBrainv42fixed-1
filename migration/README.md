# USIS Brain 服务器迁移指南

**目标服务器**: 150.242.90.36 (Rocky 9)  
**生产域名**: https://myusis.net  
**迁移日期**: 2025-11-18

---

## 📋 迁移步骤概览

```
1. 导出数据库          (在 Replit 上运行)
2. 上传代码到服务器    (从本地上传)
3. 一键部署应用        (在服务器上运行)
4. 恢复数据库          (在服务器上运行)
5. 配置 Nginx          (在服务器上运行)
6. 配置 HTTPS          (在服务器上运行)
7. 验证部署            (在服务器上运行)
```

---

## 🚀 快速开始（5分钟版）

### 在 Replit 上（导出数据库）
```bash
cd /home/runner/USIS_Brain
chmod +x migration/*.sh
./migration/1_export_database.sh
```

### 在本地（打包上传）
```bash
# 下载完整项目（包括数据库备份）
# 然后上传到服务器

scp -r ./USIS_Brain root@150.242.90.36:/tmp/
```

### 在服务器上（自动部署）
```bash
# 1. 解压并部署
cd /tmp/USIS_Brain
chmod +x migration/*.sh

# 2. 一键部署（自动安装所有依赖）
sudo ./migration/3_deploy_to_server.sh

# 3. 恢复数据库
cd /opt/usis-brain
sudo -u usis ./migration/2_restore_database.sh

# 4. 配置 Nginx
sudo ./migration/4_configure_nginx.sh

# 5. 配置 HTTPS
sudo ./migration/5_setup_https.sh

# 6. 验证部署
./migration/6_verify_deployment.sh
```

完成！访问 https://myusis.net/health

---

## 📖 详细步骤

### 步骤 1: 导出 Replit 数据库

**位置**: Replit Shell  
**脚本**: `migration/1_export_database.sh`

```bash
cd /home/runner/USIS_Brain
chmod +x migration/1_export_database.sh
./migration/1_export_database.sh
```

**输出**: `migration/database_backup/usis_brain_YYYYMMDD_HHMMSS.sql`

**包含的表**:
- `cost_tracking` - 成本跟踪
- `news_items` - 新闻条目
- `news_scores` - 新闻评分
- `news_dedupe_cache` - 去重缓存
- `news_push_history` - 推送历史
- `news_routing_state` - 路由状态
- `news_sources` - 新闻源
- `news_analyst_notes` - 分析师笔记
- `user_memory` - 用户记忆

---

### 步骤 2: 上传代码到服务器

**方法 A: SCP（推荐）**
```bash
# 从本地上传
cd /path/to/USIS_Brain
tar czf usis-brain.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='attached_assets' \
  --exclude='.cache' \
  .

scp usis-brain.tar.gz root@150.242.90.36:/tmp/

# 在服务器上解压
ssh root@150.242.90.36
cd /tmp
tar xzf usis-brain.tar.gz -C /opt/
mv /opt/USIS_Brain /opt/usis-brain
```

**方法 B: Git Clone**
```bash
ssh root@150.242.90.36
cd /opt
git clone https://github.com/your-repo/usis-brain.git
cd usis-brain
```

---

### 步骤 3: 一键部署应用

**位置**: 服务器 SSH  
**脚本**: `migration/3_deploy_to_server.sh`

```bash
cd /opt/usis-brain
chmod +x migration/*.sh
sudo ./migration/3_deploy_to_server.sh
```

**此脚本将自动**:
- ✅ 更新系统包
- ✅ 安装 Node.js 20
- ✅ 安装 PostgreSQL 15
- ✅ 创建数据库和用户
- ✅ 创建应用用户 `usis`
- ✅ 安装 npm 依赖
- ✅ 配置 PM2 进程管理
- ✅ 设置开机自启

**交互环节**:
1. 编辑 `.env` 文件（填入所有 API Keys）
2. 确认配置正确

**耗时**: 约 5-10 分钟

---

### 步骤 4: 恢复数据库

**位置**: 服务器 SSH  
**脚本**: `migration/2_restore_database.sh`

```bash
cd /opt/usis-brain
sudo -u usis ./migration/2_restore_database.sh
```

**或手动指定备份文件**:
```bash
sudo -u usis ./migration/2_restore_database.sh \
  migration/database_backup/usis_brain_20251118_120000.sql
```

**验证数据库**:
```bash
source .env
psql $DATABASE_URL -c "\dt"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM news_items;"
```

---

### 步骤 5: 配置 Nginx

**位置**: 服务器 SSH  
**脚本**: `migration/4_configure_nginx.sh`

```bash
cd /opt/usis-brain
sudo ./migration/4_configure_nginx.sh
```

**此脚本将**:
- ✅ 安装 Nginx
- ✅ 创建反向代理配置
- ✅ 配置超时（300秒，适应研报生成）
- ✅ 启动 Nginx

**测试 HTTP 访问**:
```bash
curl http://150.242.90.36/health
curl http://myusis.net/health  # 需要 DNS 已配置
```

---

### 步骤 6: 配置 HTTPS

**位置**: 服务器 SSH  
**脚本**: `migration/5_setup_https.sh`

**前提条件**:
- ✅ DNS 已配置：`myusis.net` A记录 → `150.242.90.36`
- ✅ 防火墙开放 80, 443 端口

```bash
# 开放防火墙端口（如需要）
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload

# 运行 HTTPS 配置
cd /opt/usis-brain
sudo ./migration/5_setup_https.sh
```

**此脚本将**:
- ✅ 安装 Certbot
- ✅ 验证 DNS
- ✅ 获取 Let's Encrypt 证书
- ✅ 自动配置 Nginx SSL
- ✅ 设置自动续期

**测试 HTTPS 访问**:
```bash
curl https://myusis.net/health
```

---

### 步骤 7: 验证部署

**位置**: 服务器 SSH  
**脚本**: `migration/6_verify_deployment.sh`

```bash
cd /opt/usis-brain
./migration/6_verify_deployment.sh
```

**验证内容**:
- ✅ PM2 状态
- ✅ PostgreSQL 状态
- ✅ Nginx 状态
- ✅ 端口监听（3000, 80, 443）
- ✅ HTTP 端点测试
- ✅ 研报生成测试（JSON, HTML）
- ✅ 数据库连接测试

**成功标志**:
```
✅ 所有测试通过!
🎉 USIS Brain 部署成功!
```

---

## 🔧 环境变量配置

### 必需配置

在 `/opt/usis-brain/.env` 中配置以下变量：

```bash
# 核心配置
NODE_ENV=production
REPLIT_DEPLOYMENT_URL=https://myusis.net

# 数据库
DATABASE_URL=postgresql://usis_brain:YOUR_PASSWORD@localhost:5432/usis_brain

# Telegram
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN

# AI 模型（至少配置 OpenAI）
OPENAI_API_KEY=sk-proj-xxxxx

# 金融数据（至少配置 Finnhub）
FINNHUB_API_KEY=xxxxx

# PDF 生成
DOC_RAPTOR_API_KEY=xxxxx
DOC_RAPTOR_TEST_MODE=false
```

参考 `migration/.env.production.template` 获取完整配置清单。

---

## 📱 应用管理

### PM2 命令
```bash
# 查看状态
sudo -u usis pm2 status

# 查看日志
sudo -u usis pm2 logs usis-brain

# 重启应用
sudo -u usis pm2 restart usis-brain

# 停止应用
sudo -u usis pm2 stop usis-brain

# 启动应用
sudo -u usis pm2 start usis-brain
```

### 系统服务
```bash
# Nginx
sudo systemctl status nginx
sudo systemctl restart nginx

# PostgreSQL
sudo systemctl status postgresql
sudo systemctl restart postgresql

# PM2 (开机自启)
sudo systemctl status pm2-usis
```

### 日志位置
```bash
# 应用日志
/opt/usis-brain/.pm2/logs/usis-brain-out.log
/opt/usis-brain/.pm2/logs/usis-brain-error.log

# Nginx 日志
/var/log/nginx/usis-brain-access.log
/var/log/nginx/usis-brain-error.log

# PostgreSQL 日志
/var/lib/pgsql/data/log/
```

---

## 🛡️ 安全检查清单

- [ ] `.env` 文件权限: `chmod 600 .env`
- [ ] 数据库密码已更改（不使用默认密码）
- [ ] 防火墙仅开放必要端口（80, 443, 22）
- [ ] SSH 密钥登录（禁用密码登录）
- [ ] PostgreSQL 仅监听 localhost
- [ ] Nginx 隐藏版本号
- [ ] SSL 证书自动续期已配置
- [ ] 定期备份数据库

---

## 🔄 回滚计划

如果部署失败，可以快速回滚：

```bash
# 1. 停止新服务器
sudo -u usis pm2 stop all

# 2. 重新启用 Replit
# 在 Replit 控制台点击 "Resume"

# 3. 更新 DNS（如已更改）
# 将 A 记录指回 Replit IP
```

---

## 📞 故障排查

### 问题：应用无法启动
```bash
# 检查日志
sudo -u usis pm2 logs

# 检查环境变量
cat /opt/usis-brain/.env | grep -v "^#" | grep -v "^$"

# 手动启动测试
cd /opt/usis-brain
node index.js
```

### 问题：数据库连接失败
```bash
# 测试连接
psql postgresql://usis_brain:password@localhost:5432/usis_brain

# 检查 PostgreSQL 状态
sudo systemctl status postgresql

# 查看 PostgreSQL 日志
sudo tail -f /var/lib/pgsql/data/log/postgresql-*.log
```

### 问题：Nginx 502 Bad Gateway
```bash
# 检查 Node.js 是否运行
sudo -u usis pm2 status

# 检查端口监听
netstat -tuln | grep 3000

# 测试本地连接
curl http://localhost:3000/health
```

### 问题：SSL 证书获取失败
```bash
# 检查 DNS
dig myusis.net

# 测试 HTTP 访问
curl -I http://myusis.net

# 手动获取证书
sudo certbot --nginx -d myusis.net --dry-run
```

---

## 📊 性能优化建议

### 数据库优化
```sql
-- 定期清理旧数据
DELETE FROM news_items WHERE created_at < NOW() - INTERVAL '90 days';

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_news_items_created_at ON news_items(created_at);

-- 分析表
ANALYZE news_items;
```

### PM2 优化
```bash
# 使用集群模式（多核CPU）
sudo -u usis pm2 delete usis-brain
sudo -u usis pm2 start index.js -i max --name usis-brain
```

### Nginx 优化
```nginx
# 添加缓存（在 /etc/nginx/conf.d/usis-brain.conf）
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=1g inactive=60m;

location /v3/report/ {
    proxy_cache api_cache;
    proxy_cache_valid 200 10m;
    proxy_cache_key "$scheme$request_method$host$request_uri";
    # ... 其他配置
}
```

---

## 📚 相关文档

- [项目概览](../replit.md)
- [环境变量模板](../.env.example)
- [PM2 配置](../pm2.ecosystem.config.js)
- [Nginx 配置示例](../nginx.conf.example)

---

## ✅ 迁移完成后

1. **更新 Telegram Bot Webhook**（如使用）:
   ```bash
   curl https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook?url=https://myusis.net/webhook/<YOUR_TOKEN>
   ```

2. **更新 N8N 工作流**:
   - 将所有 `liqixi888.replit.app` 替换为 `myusis.net`

3. **通知团队**:
   - 新生产域名: https://myusis.net
   - API 端点不变
   - Replit 仅用于开发测试

4. **监控运行**:
   - 设置监控告警（如 UptimeRobot）
   - 定期检查 PM2 日志
   - 每周备份数据库

---

## 🎉 完成！

您已成功将 USIS Brain 从 Replit 迁移到自有服务器！

**新生产环境**:
- 🌐 域名: https://myusis.net
- 🖥️ 服务器: 150.242.90.36 (Rocky 9)
- 📦 进程管理: PM2
- 🔒 HTTPS: Let's Encrypt
- 💾 数据库: PostgreSQL 15

**Replit 角色**:
- 保留域名: liqixi888.replit.app
- 用途: 开发测试环境
- 不再用于生产流量
