# USIS Brain 迁移检查清单

**日期**: _____________  
**执行人**: _____________  
**服务器**: 150.242.90.36  
**域名**: myusis.net

---

## 准备阶段

- [ ] DNS记录已配置（myusis.net → 150.242.90.36）
- [ ] 服务器SSH访问正常
- [ ] 服务器有足够磁盘空间（至少20GB）
- [ ] 获取所有必需的API Keys
- [ ] 备份现有Replit数据库

---

## 迁移阶段

### 1. 数据库导出（Replit）

- [ ] 运行 `./migration/1_export_database.sh`
- [ ] 验证备份文件大小 > 0KB
- [ ] 记录备份文件路径: `_______________________________`
- [ ] 下载备份文件到本地

### 2. 代码上传（本地 → 服务器）

- [ ] 打包项目代码（排除node_modules）
- [ ] 上传到服务器 /tmp/
- [ ] 解压到 /opt/usis-brain/
- [ ] 验证文件完整性

### 3. 自动部署（服务器）

- [ ] 运行 `sudo ./migration/3_deploy_to_server.sh`
- [ ] Node.js 20 安装成功
- [ ] PostgreSQL 15 安装成功
- [ ] 数据库创建成功
- [ ] 用户 `usis` 创建成功
- [ ] npm 依赖安装成功（无错误）
- [ ] PM2 配置成功
- [ ] 应用启动成功

**执行时间**: ___:___ - ___:___  
**耗时**: _______ 分钟

### 4. 环境变量配置

编辑 `/opt/usis-brain/.env`，填入以下变量：

#### 核心配置
- [ ] NODE_ENV=production
- [ ] PORT=3000
- [ ] REPLIT_DEPLOYMENT_URL=https://myusis.net

#### 数据库
- [ ] DATABASE_URL (已配置)

#### Telegram
- [ ] TELEGRAM_BOT_TOKEN
- [ ] TELEGRAM_BOT_TOKEN_DEV（可选）
- [ ] NEWS_CHANNEL_ID（可选）

#### AI 模型（必需）
- [ ] OPENAI_API_KEY
- [ ] ANTHROPIC_API_KEY（推荐）
- [ ] GOOGLE_AI_API_KEY（推荐）
- [ ] DEEPSEEK_API_KEY（可选）
- [ ] MISTRAL_API_KEY（可选）
- [ ] PERPLEXITY_API_KEY（可选）

#### 金融数据（必需）
- [ ] FINNHUB_API_KEY
- [ ] TWELVE_DATA_API_KEY（推荐）
- [ ] ALPHA_VANTAGE_API_KEY（可选）

#### 服务（必需）
- [ ] DOC_RAPTOR_API_KEY
- [ ] DOC_RAPTOR_TEST_MODE=false
- [ ] BROWSERLESS_API_KEY（推荐）
- [ ] SCREENSHOT_API_KEY（可选）

#### 验证
- [ ] .env 文件权限: `chmod 600 .env`
- [ ] 重启应用: `sudo -u usis pm2 restart usis-brain`
- [ ] 应用无错误启动

### 5. 数据库恢复

- [ ] 运行 `sudo -u usis ./migration/2_restore_database.sh`
- [ ] 确认恢复（输入 yes）
- [ ] 验证所有表已恢复
- [ ] 检查数据行数正常

**恢复的表** (9个):
- [ ] cost_tracking
- [ ] news_items
- [ ] news_scores
- [ ] news_dedupe_cache
- [ ] news_push_history
- [ ] news_routing_state
- [ ] news_sources
- [ ] news_analyst_notes
- [ ] user_memory

### 6. Nginx 配置

- [ ] 运行 `sudo ./migration/4_configure_nginx.sh`
- [ ] Nginx 安装成功
- [ ] 配置文件创建成功
- [ ] Nginx 测试通过 (`nginx -t`)
- [ ] Nginx 重启成功
- [ ] HTTP访问正常: `curl http://150.242.90.36/health`

### 7. HTTPS 配置

**前提检查**:
- [ ] DNS已生效: `dig myusis.net`
- [ ] 防火墙80端口开放
- [ ] 防火墙443端口开放

**执行**:
- [ ] 运行 `sudo ./migration/5_setup_https.sh`
- [ ] Certbot 安装成功
- [ ] 证书获取成功
- [ ] Nginx SSL配置成功
- [ ] 自动续期已配置
- [ ] HTTPS访问正常: `curl https://myusis.net/health`

**证书信息**:
- 颁发日期: _____________
- 过期日期: _____________
- 域名: myusis.net, www.myusis.net

### 8. 部署验证

- [ ] 运行 `./migration/6_verify_deployment.sh`
- [ ] PM2 状态正常
- [ ] PostgreSQL 状态正常
- [ ] Nginx 状态正常
- [ ] 端口3000监听正常
- [ ] 端口80监听正常
- [ ] 端口443监听正常
- [ ] /health 端点测试通过
- [ ] /v3/report/test 端点测试通过
- [ ] JSON研报生成成功
- [ ] HTML研报生成成功
- [ ] 数据库连接正常

**所有测试通过**: ✅ 是 / ❌ 否

---

## 迁移后配置

### Telegram Bot Webhook 更新

- [ ] 获取当前Webhook: `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
- [ ] 设置新Webhook: 
  ```
  curl https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://myusis.net/webhook/<TOKEN>
  ```
- [ ] 验证Webhook已更新
- [ ] 发送测试消息到Bot
- [ ] Bot响应正常

### N8N 工作流更新

- [ ] 列出所有使用旧URL的工作流: _____________
- [ ] 更新URL: `liqixi888.replit.app` → `myusis.net`
- [ ] 测试工作流执行
- [ ] 验证新闻推送正常

### 监控设置

- [ ] 配置UptimeRobot（或其他监控）
  - 监控URL: https://myusis.net/health
  - 检查间隔: 5分钟
  - 告警邮箱: _____________
- [ ] 测试告警通知

### 备份策略

- [ ] 配置每日数据库备份
  ```bash
  # 添加到 crontab
  0 2 * * * /opt/usis-brain/migration/1_export_database.sh
  ```
- [ ] 测试备份脚本
- [ ] 验证备份文件创建

---

## 回滚准备

- [ ] 记录Replit原始配置
- [ ] 保留Replit数据库备份
- [ ] 记录Replit URL: liqixi888.replit.app
- [ ] 确认Replit应用可以快速恢复

**回滚命令**（如需要）:
```bash
# 停止新服务器
sudo -u usis pm2 stop all

# 在Replit控制台点击 Resume
# 更新DNS指回Replit（如已更改）
```

---

## 性能测试

### 响应时间测试

- [ ] /health 端点: _______ ms (目标: <100ms)
- [ ] /v3/report/test 端点: _______ ms (目标: <500ms)
- [ ] JSON研报生成: _______ 秒 (目标: <30s)
- [ ] HTML研报生成: _______ 秒 (目标: <40s)
- [ ] PDF研报生成: _______ 秒 (目标: <120s)

### 并发测试（可选）

- [ ] 5个并发请求正常
- [ ] 10个并发请求正常
- [ ] 应用无崩溃
- [ ] 内存使用正常: _______ MB

---

## 安全检查

- [ ] SSH密钥登录已配置
- [ ] root密码登录已禁用
- [ ] 防火墙仅开放必要端口（22, 80, 443）
- [ ] PostgreSQL仅监听localhost
- [ ] .env文件权限正确（600）
- [ ] 敏感日志已清理
- [ ] Nginx版本号已隐藏

---

## 文档更新

- [ ] 更新团队文档（新域名）
- [ ] 更新API文档（如有）
- [ ] 通知相关人员迁移完成
- [ ] 归档迁移记录

---

## 迁移完成确认

**迁移开始时间**: ___:___  
**迁移结束时间**: ___:___  
**总耗时**: _______ 小时 _______ 分钟

**迁移状态**: 
- [ ] ✅ 完全成功
- [ ] ⚠️ 部分成功（需要后续处理）
- [ ] ❌ 失败（已回滚）

**遇到的问题**: 
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

**解决方案**: 
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

**验证签名**: 
- 执行人: _____________ 日期: _____________
- 复核人: _____________ 日期: _____________

---

## 后续优化计划

30天内完成:
- [ ] 性能监控分析
- [ ] 数据库查询优化
- [ ] PM2集群模式配置
- [ ] Nginx缓存优化
- [ ] 日志轮转配置
- [ ] 定期安全审计

---

**备注**:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
