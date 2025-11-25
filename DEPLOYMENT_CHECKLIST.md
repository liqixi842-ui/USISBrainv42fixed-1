# N8N新闻系统部署检查清单

## ✅ 部署前准备

### 1. 生成安全密钥

在Replit Shell中运行以下命令生成随机密钥：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

复制生成的密钥（64位十六进制字符串）。

### 2. 配置Replit Secrets

在Replit左侧面板 → **Tools** → **Secrets** 中添加以下环境变量：

| 变量名 | 说明 | 示例值 |
|-------|------|--------|
| `NEWS_INGESTION_SECRET` | N8N认证密钥（必需） | 刚才生成的64位字符串 |
| `NEWS_CHANNEL_ID` | Telegram频道ID（可选，用于推送） | `-1001234567890` |
| `ENABLE_NEWS_SYSTEM` | 启用新闻系统 | `true` |

**重要：** NEWS_INGESTION_SECRET必须与N8N中配置的完全一致！

### 3. 初始化数据库

如果还没运行过，执行：

```bash
node init-news-schema.js
```

### 4. 配置N8N

在N8N实例的环境变量中添加：

```bash
NEWS_INGESTION_SECRET=<与Replit相同的密钥>
REPL_URL=https://your-repl-slug.replit.app
```

### 5. 运行端到端测试

配置完成后，运行测试验证：

```bash
node test-n8n-integration.js
```

## 📊 测试内容

测试将验证以下功能：

1. ✅ API认证机制（401/200响应）
2. ✅ 完整处理流程（去重→评分→路由→推送）
3. ✅ URL去重（24小时窗口）
4. ✅ 数据库存储（7个表）
5. ✅ 批量处理（模拟N8N每5分钟~70篇新闻）

## 🚀 激活系统

测试通过后：

1. **N8N**: 在工作流页面点击 **Activate** 开关
2. **Replit**: 重启应用以加载新的环境变量
3. **监控**: 查看N8N的Executions和Replit Console日志

## 🔍 验证运行状态

### 检查N8N工作流
- 在N8N查看"Executions"标签
- 应该看到每5分钟自动执行一次
- 成功的执行显示绿色勾号

### 检查USIS Brain日志
在Replit Console应该看到：
```
📰 [Ingest] Processing: Apple Reports...
📊 [Ingest] Score: 7.5/10
🚀 [Ingest] Pushed to Fastlane: success
```

### 检查Telegram频道
- Fastlane新闻（≥7分）立即推送
- 2小时摘要每2小时推送
- 4小时摘要每4小时推送

## ⚠️ 常见问题

### 所有请求返回401
**原因：** NEWS_INGESTION_SECRET不匹配  
**解决：** 检查N8N和Replit的密钥是否完全一致

### 新闻被标记为duplicate
**正常！** 去重系统正在工作，24小时内相同URL会跳过

### Score太低被suppressed
**正常！** 低质量新闻（<3分）不会推送

## 📈 性能指标

正常运行状态：
- **采集成功率**: >90%
- **去重率**: 20-40%（正常范围）
- **Fastlane推送**: 高分新闻（≥7分）立即发送
- **Digest积压**: 定期2h/4h清空

## 🆘 需要帮助？

查看详细文档：
- N8N工作流配置：`n8n-workflows/README.md`
- 系统架构：`replit.md`
- API文档：`newsIngestAPI.js`（代码注释）
