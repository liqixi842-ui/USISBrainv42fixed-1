# v6.5.2 Critical Fix - Manual Deployment Guide

## 问题诊断
- ❌ Manager Bot 调用了 `v3_dev/services/devBotHandler.js`（开发版，重量级）
- ❌ 开发版调用 `/v3/report` API，生成完整研报（90秒超时）
- ✅ 应该调用 `index.js` 第 6345 行的正式版轻量级函数

## 修复方案：3处代码修改

### 1. 修改 handleTicketAnalysis 函数（第 6345-6353 行）

**原代码：**
```javascript
async function handleTicketAnalysis({ symbol, mode, chatId }) {
  let statusMsg = null;
  let t0 = null;
```

**修改为：**
```javascript
// v6.5.2: 支持可选的 telegramAPI 和 botToken 参数（用于 Manager Bot 集成）
async function handleTicketAnalysis({ symbol, mode, chatId, telegramAPI: customTelegramAPI, botToken: customBotToken }) {
  let statusMsg = null;
  let t0 = null;
  
  // 使用传入的 telegramAPI 或默认的全局 telegramAPI
  const api = customTelegramAPI || telegramAPI;
  const token = customBotToken || TELEGRAM_TOKEN;
```

---

### 2. 替换函数内所有 `telegramAPI` 为 `api`（第 6370-6500 行）

**批量替换：**
```bash
# 在第 6370-6500 行范围内，将所有 telegramAPI( 替换为 api(
sed -i '6370,6500s/await telegramAPI(/await api(/g' index.js

# 将图片发送的 TELEGRAM_TOKEN 改为 token（第 6410 行附近）
sed -i '6410s/TELEGRAM_TOKEN/token/g' index.js
```

**或手动修改：**
- `await telegramAPI('sendMessage', ...)` → `await api('sendMessage', ...)`
- `await telegramAPI('deleteMessage', ...)` → `await api('deleteMessage', ...)`
- `await sendDocumentBuffer(TELEGRAM_TOKEN, ...)` → `await sendDocumentBuffer(token, ...)`

---

### 3. 修改 Manager Bot Wrapper（第 7456-7488 行）

**删除这段代码：**
```javascript
const researchBotTelegramAPI = createResearchBotTelegramAPI(RESEARCH_BOT_TOKEN);

// 🔧 导入解票和研报处理函数（v3_dev版本）
const { handleTicketAnalysis: v3HandleTicketAnalysis } = require('./v3_dev/services/devBotHandler');

// 🎯 注册外部处理器：解票功能
async function handleTicketAnalysisWrapper({ symbol, mode, chatId }) {
  console.log(`\n🔀 [ManagerBot] Routing ticket analysis to Research Bot`);
  console.log(`   ├─ Symbol: ${symbol}`);
  console.log(`   ├─ Mode: ${mode}`);
  console.log(`   └─ Reply Token: RESEARCH_BOT_TOKEN (${RESEARCH_BOT_TOKEN.slice(0, 10)}...)`);
  
  // 调用 v3_dev 的完整解票功能，使用 RESEARCH_BOT_TOKEN 发送回复
  await v3HandleTicketAnalysis({
    symbol,
    mode,
    chatId,
    telegramAPI: researchBotTelegramAPI,
    botToken: RESEARCH_BOT_TOKEN
  });
}
```

**替换为：**
```javascript
const researchBotTelegramAPI = createResearchBotTelegramAPI(RESEARCH_BOT_TOKEN);

// 🎯 注册外部处理器：解票功能（v6.5.2: 使用正式版轻量级快速路径）
async function handleTicketAnalysisWrapper({ symbol, mode, chatId }) {
  console.log(`\n🔀 [ManagerBot → V3 Production] Routing ticket analysis to Research Bot`);
  console.log(`   ├─ Symbol: ${symbol}`);
  console.log(`   ├─ Mode: ${mode}`);
  console.log(`   ├─ Endpoint: generateStockChart (FAST PATH - Production)`);
  console.log(`   └─ Reply Token: RESEARCH_BOT_TOKEN (${RESEARCH_BOT_TOKEN.slice(0, 10)}...)`);
  console.log('[MANAGER → TICKET]', {
    symbol,
    mode,
    endpoint: 'generateStockChart (Production v3 - Lightweight)'
  });
  
  // ✅ 调用正式版轻量级解票功能（15-30秒，不走 v3_dev 重量级路由）
  // 使用 index.js 第 6345 行定义的正式版 handleTicketAnalysis
  await handleTicketAnalysis({
    symbol,
    mode,
    chatId,
    telegramAPI: researchBotTelegramAPI,
    botToken: RESEARCH_BOT_TOKEN
  });
}
```

---

## 快速部署

### 方法1：使用自动脚本（推荐）
```bash
chmod +x DEPLOY_v6.5.2_FIX.sh
./DEPLOY_v6.5.2_FIX.sh
```

### 方法2：手动修改
1. 备份原文件：`cp index.js index.js.backup`
2. 按照上述3处修改编辑 `index.js`
3. 重启应用：`./start.sh`

---

## 验证测试

### 1. 检查日志输出
```bash
tail -f logs/app.log | grep -E "MANAGER → TICKET|endpoint|Production"
```

在 Telegram 发送：`解票 NVDA`

**应该看到：**
```
🔀 [ManagerBot → V3 Production] Routing ticket analysis to Research Bot
   ├─ Symbol: NVDA
   ├─ Mode: 标准版
   ├─ Endpoint: generateStockChart (FAST PATH - Production)
[MANAGER → TICKET] { symbol: 'NVDA', mode: '标准版', endpoint: 'generateStockChart (Production v3 - Lightweight)' }
```

### 2. 检查性能
- ❌ 旧版：90 秒超时失败
- ✅ 新版：15-30 秒完成

### 3. 检查回复来源
- 回复应该来自 @qixijiepiao_bot (Research Bot)
- 不应该来自 @qixizhuguan_bot (Manager Bot)

---

## 回滚方案
如果出现问题：
```bash
# 恢复备份
cp index.js.backup index.js
./start.sh
```

---

## 技术说明

### 为什么之前慢？
```
Manager Bot → v3_dev/devBotHandler.js 
           → 调用 /v3/report API 
           → v3_dev/routes/report.js 
           → buildResearchReport (完整研报生成)
           → 5个 AI 章节并行生成
           → 每个章节 20-50 秒
           → 总计 90 秒超时
```

### 现在为什么快？
```
Manager Bot → index.js handleTicketAnalysis (正式版)
           → generateStockChart (轻量级)
           → TradingView 截图 + GPT-4o Vision 单次分析
           → 15-30 秒完成
```
