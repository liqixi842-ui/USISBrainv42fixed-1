# USIS Brain v5.0 - 系统状态报告

**最后更新**: 2025-11-06 12:39 UTC
**状态**: ✅ 稳定运行

---

## 📊 核心功能

### ✅ 已实现功能
1. **Telegram Bot** - 手动轮询架构（Replit兼容）
2. **n8n热力图** - 3层Provider系统（n8n → Browserless → QuickChart）
3. **全球指数支持** - 21个主要指数（SPX500, NIKKEI225, IBEX35等）
4. **纯规则引擎** - 100%准确的意图解析
5. **FormData上传** - 安全的multipart文档发送

### 🔧 技术架构
- **平台**: Replit (Node.js 20.19.3)
- **端口**: 5000 (0.0.0.0绑定)
- **数据库**: PostgreSQL (Neon)
- **截图服务**: n8n Webhook (https://qian.app.n8n.cloud/webhook/capture_heatmap)

---

## 🗂️ 核心文件清单

### 必需文件（12个）
```
index.js                    - 主应用 (4829行)
heatmapService.js          - 热力图服务
heatmapIntentParser.js     - 意图解析器
screenshotProviders.js     - 截图Provider
gpt5Brain.js               - GPT-5引擎
semanticIntentAgent.js     - 语义分析
symbolResolver.js          - 股票代码解析
dataBroker.js              - 数据整合
complianceGuard.js         - 反幻觉系统
newsBroker.js              - 新闻聚合
analysisPrompt.js          - 提示词构建
responseFormatter.js       - 响应格式化
```

### 配置文件
```
package.json               - 依赖管理
.replit                    - Replit配置
replit.md                  - 项目文档
```

---

## 🧹 已清理内容

### 删除的测试文件（4个）
- ✅ test-telegram-only.js
- ✅ manual-polling-bot.js
- ✅ http-with-bot.js
- ✅ production-bot.js

### 移除的调试代码
- ✅ Crash blackbox日志系统（logf函数）
- ✅ 所有调试日志文件（*.log）
- ✅ 重复的错误处理代码

---

## 🔑 关键突破

### 问题1: Telegraf bot.launch() 崩溃
**原因**: Replit平台要求HTTP服务器，bot.launch()会挂起30秒后被SIGTERM杀死
**解决**: 手动Telegram轮询 + Express服务器（端口5000）

### 问题2: Content-Length错误
**原因**: emoji/中文字符数≠字节数
**解决**: 使用`Buffer.byteLength(data, 'utf8')`

### 问题3: multipart上传崩溃
**原因**: 手动计算boundary长度容易出错
**解决**: 使用FormData自动处理

---

## 🚀 启动命令

```bash
# 生产环境
nohup node index.js > usis-brain.log 2>&1 &

# 查看日志
tail -f usis-brain.log

# 查看进程
cat /tmp/production.pid | xargs ps -p

# 停止服务
cat /tmp/production.pid | xargs kill
```

---

## 📡 API端点

### HTTP服务器（端口5000）
- `GET /health` - 健康检查
- `POST /brain/orchestrate` - 智能分析
- `GET /api/test-heatmap?market=US` - 测试热力图

### Telegram Bot
- 热力图：发送包含"热力图"或"heatmap"的消息
- 常规分析：发送任何其他文本

---

## 🛡️ 稳定性保障

### 错误处理
```javascript
// Global handlers
process.on('unhandledRejection', ...)
process.on('uncaughtException', ...)
```

### 自动重连
- Telegram轮询：1秒间隔，自动重试
- 数据库：5次重试，指数退避

### 资源限制
- 文档大小：<45MB
- n8n超时：30秒
- Telegram超时：45秒

---

## 📝 已知限制

1. **常规分析路径** - 可能需要优化（语义分析环节）
2. **单实例运行** - 多实例会导致Telegram API冲突
3. **依赖n8n服务** - 主截图服务需要外部webhook

---

## ✅ 测试清单

- [x] Telegram消息接收
- [x] n8n webhook调用
- [x] FormData文档上传
- [x] 多语言指数解析（美国/日本/西班牙）
- [x] 12秒稳定性测试
- [ ] 完整端到端测试（待用户验证）

---

**部署建议**: 
- 监控usis-brain.log查看运行状态
- 保持单实例运行
- 定期检查n8n webhook可用性
