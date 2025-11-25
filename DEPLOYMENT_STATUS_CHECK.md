# 部署状态检查指南

**创建时间:** 2025-11-15 17:15 UTC

---

## 📋 如何确认部署成功

### 1. 在Replit界面检查

**Publishing标签页 (发布标签):**
1. 点击左侧菜单的 "Publishing" 或 "发布"
2. 查看部署状态：
   - ✅ 绿色勾号 = 部署成功运行
   - 🟡 黄色圆圈 = 正在部署
   - ❌ 红色叉号 = 部署失败

**Console/Logs标签页 (控制台/日志):**
1. 点击 "Logs" 或"日志"查看实时输出
2. 应该看到以下关键信息：

```
✅ [v3-dev] Routes mounted at /v3/*
🤖 [Bot Token] Token: 7944498422...
🔧 [DEV_BOT] Starting v3-dev development bot...
🔧 [DEV_BOT] Token: 8552043622...
🚀 USIS Brain v6.0 online on port 3000
```

### 2. 测试应用是否在线

**方法1: 访问网站**
打开浏览器访问：
```
https://liqixi888.replit.app/health
```

预期响应：JSON格式的健康状态

**方法2: 测试v3-dev路由**
```
https://liqixi888.replit.app/v3/test
```

预期响应：
```json
{
  "status": "ok",
  "message": "v3-dev routes are working",
  "version": "v3-dev"
}
```

### 3. 测试Telegram Bot

**生产bot测试:**
1. 在Telegram中打开生产bot
2. 发送: `/analyze AAPL`
3. 应该收到完整的分析报告

**开发bot测试:**
1. 在Telegram搜索: `8552043622`
2. 找到开发bot并启动对话
3. 发送: `/test`
4. 应该收到：
```
✅ v3-dev Bot is working!

Version: v3-dev
Environment: Development
Isolation: Active
```

---

## 🔧 如果部署未成功

### 可能的原因：

#### 1. 部署还在进行中
**症状:** 界面显示黄色"Deploying..."  
**解决:** 等待1-2分钟，部署需要时间

#### 2. 需要手动触发部署
**症状:** 没有看到部署开始  
**解决:** 
1. 进入Publishing标签
2. 点击 "Approve and update" 或 "批准并更新"
3. 等待部署完成

#### 3. 应用启动失败
**症状:** 部署完成但应用无响应  
**解决:** 
1. 查看Logs中的错误信息
2. 检查是否有红色错误提示
3. 常见问题：
   - 端口冲突
   - 环境变量缺失
   - 模块加载错误

#### 4. Reserved VM未激活
**症状:** 应用无法持续运行  
**解决:** 
1. 确认您的Replit账户有Reserved VM权限
2. 在Publishing设置中启用Reserved VM
3. 重新部署

---

## ✅ 成功部署的标志

当您看到以下所有项目时，部署成功：

- [ ] Replit Publishing界面显示绿色勾号
- [ ] 访问 `https://liqixi888.replit.app/health` 返回JSON
- [ ] 访问 `https://liqixi888.replit.app/v3/test` 返回v3-dev状态
- [ ] 生产bot能响应 `/analyze` 命令
- [ ] 开发bot能响应 `/test` 命令
- [ ] Logs中显示两个bot的启动信息

---

## 🚨 常见错误和解决方法

### 错误: "Token collision"
**日志显示:**
```
❌ FATAL: Tokens must be different!
```

**原因:** 生产和开发bot使用了相同的token

**解决:**
1. 进入 Replit Secrets
2. 确认 `TELEGRAM_BOT_TOKEN` 和 `TELEGRAM_BOT_TOKEN_DEV` 是不同的值
3. 重新部署

### 错误: "v3 routes return 404"
**症状:** 访问 `/v3/test` 返回404

**原因:** 路由未正确挂载

**解决:**
1. 检查 `index.js` 中第6073-6080行是否存在
2. 确认 `v3_dev/routes/index.js` 文件存在
3. 重新部署

### 错误: "Dev bot not responding"
**症状:** 开发bot不回复消息

**原因:** 可能的原因：
1. `TELEGRAM_BOT_TOKEN_DEV` 未设置
2. Token格式错误
3. Bot未启动

**解决:**
1. 检查Logs中是否有 `[DEV_BOT]` 启动信息
2. 确认Secrets中有正确的dev token
3. 用 `/test` 命令测试

---

## 📞 获取帮助

如果您遇到问题，请提供以下信息：

1. **Replit Publishing界面的状态** (绿色/黄色/红色)
2. **Logs中的错误信息** (如果有红色错误)
3. **测试结果:**
   - https://liqixi888.replit.app/health 的响应
   - https://liqixi888.replit.app/v3/test 的响应
   - Telegram bot是否响应

这样我可以更准确地帮助您诊断问题。

---

**文档版本:** 1.0  
**最后更新:** 2025-11-15 17:15 UTC
