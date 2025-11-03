# 🧪 N8N 连接测试指南

## 📍 服务器地址

**Replit公网URL**: `https://node-js-liqixi842.replit.app`

## ✅ 测试步骤

### 1️⃣ 测试健康检查（最简单）

在n8n中创建一个HTTP Request节点：

```
Method: GET
URL: https://node-js-liqixi842.replit.app/health
```

**预期响应**:
```json
{
  "ok": true,
  "service": "USIS Brain",
  "ts": 1762130705317
}
```

---

### 2️⃣ 测试意图识别

创建HTTP Request节点：

```
Method: POST
URL: https://node-js-liqixi842.replit.app/brain/intent

Headers:
  Content-Type: application/json

Body (JSON):
{
  "text": "盘前看看TSLA"
}
```

**预期响应**:
```json
{
  "version": "USIS.v3",
  "mode": "premarket",
  "symbols": ["TSLA"],
  "lang": "zh",
  "echo": "盘前看看TSLA"
}
```

---

### 3️⃣ 测试完整AI编排系统 ⭐️

创建HTTP Request节点：

```
Method: POST
URL: https://node-js-liqixi842.replit.app/brain/orchestrate

Headers:
  Content-Type: application/json

Body (JSON):
{
  "text": "盘前NVDA",
  "chat_type": "private",
  "user_id": "test_n8n_001"
}

Options:
  Timeout: 90000 (90秒 - 因为要调用6个AI)
```

**预期响应字段**:
```json
{
  "ok": true,
  "final_analysis": "完整的中文分析报告...",
  "intent": {
    "mode": "premarket",
    "lang": "zh",
    "confidence": 0.95
  },
  "scene": {
    "name": "盘前资讯",
    "depth": "brief",
    "targetLength": 300
  },
  "symbols": ["NVDA"],
  "market_data": {
    "collected": true,
    "summary": "..."
  },
  "ai_results": {
    "claude": { "success": true, "output": "..." },
    "deepseek": { "success": true, "output": "..." },
    "gpt4": { "success": true, "output": "..." },
    "gemini": { "success": true, "output": "..." },
    "perplexity": { "success": true, "output": "..." },
    "mistral": { "success": true, "output": "..." }
  },
  "response_time_ms": 13420
}
```

---

## 🎯 在N8N中使用

### 最简单的Telegram集成

**节点配置**:

1. **Telegram Trigger** - 接收消息
2. **HTTP Request** - 调用USIS Brain
   ```
   Method: POST
   URL: https://node-js-liqixi842.replit.app/brain/orchestrate
   Body:
   {
     "text": "{{ $json.message.text }}",
     "chat_type": "{{ $json.message.chat.type === 'private' ? 'private' : 'group' }}",
     "user_id": "{{ $json.message.from.id }}"
   }
   Timeout: 90000
   ```
3. **Telegram Send** - 发送分析结果
   ```
   Message: {{ $json.final_analysis }}
   ```

---

## 🔧 常见问题

### Q: 请求超时？
A: 设置timeout至少60秒（6个AI并行需要时间）

### Q: 想要更快的响应？
A: 目前用`/brain/intent`预先识别，但完整分析需要等6个AI

### Q: 如何区分私聊和群聊？
A: 设置`chat_type`为`private`或`group`，系统会自动切换输出风格

---

## 📊 测试检查清单

- [ ] 健康检查成功返回
- [ ] 意图识别正确提取股票代码
- [ ] 完整编排返回分析报告
- [ ] 响应时间在15秒以内
- [ ] 6个AI全部成功返回

---

**准备好了就开始测试吧！有问题随时告诉我** ✨
