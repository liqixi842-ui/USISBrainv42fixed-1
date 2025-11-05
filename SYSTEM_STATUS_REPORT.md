# USIS Brain v4.0 系统状态报告

📅 生成时间：2025-11-05  
🎯 目的：确保后端、N8N、用户三方信息对称

---

## 🏗️ 系统架构概览

### 三层架构
```
┌─────────────┐
│   Telegram  │ 用户发送消息
└──────┬──────┘
       │
       ▼
┌─────────────┐
│     N8N     │ 工作流编排层
│  Workflow   │ - 接收Telegram消息
│             │ - 调用USIS Brain API
│             │ - 发送响应回Telegram
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ USIS Brain  │ AI分析引擎（Replit后端）
│   v4.0      │ - 实时数据获取
│ (GPT-5单核) │ - GPT-5深度推理
│             │ - 结构化输出
└─────────────┘
```

---

## 📡 N8N ↔ Replit 数据交互

### N8N → Replit（请求）

**Endpoint**: `POST https://node-js-liqixi842.replit.app/brain/orchestrate`

**请求体**:
```json
{
  "text": "{{ $json.message.text }}",           // Telegram消息文本
  "chat_type": "private",                      // private | group
  "user_id": "{{ $json.message.from.id }}",   // Telegram用户ID
  "budget": "low"                              // 可选：low | medium | high
}
```

**超时设置**: 90秒（因为GPT-5推理需要30-40秒）

---

### Replit → N8N（响应）

**响应结构**:
```json
{
  "status": "ok",
  "request_id": "1762355420-abc123",
  "model": "gpt-5-mini",
  
  "final_text": "这是GPT-5生成的完整分析内容...",  // ⚠️ 现在限制800字
  
  "ai_results": {
    "success": true,
    "model": "gpt-5-mini",
    "text": "分析内容",
    "elapsed_ms": 39054,
    "usage": {
      "prompt_tokens": 2500,
      "completion_tokens": 1200,
      "total_tokens": 3700
    }
  },
  
  "needs_heatmap": true,                        // 是否需要热力图
  "heatmap_widget": "https://...",              // TradingView热力图URL
  
  "symbols": ["AAPL", "TSLA"],                  // 识别的股票代码
  "intent": {
    "mode": "intraday",
    "intentType": "market_analysis",
    "confidence": 0.95
  },
  
  "response_time_ms": 40299
}
```

---

## 🔄 N8N工作流处理逻辑

### 当前N8N节点流程（推测）

```
1. Telegram_Trigger
   ↓ 接收用户消息
   
2. Call_Brain_Orchestrate (HTTP Request)
   ↓ POST到/brain/orchestrate
   
3. Parse_Brain_Response (Code节点)
   ↓ 解析响应JSON
   
4. IF节点：检查 needs_heatmap
   ├─ TRUE → Send_Photo (发送热力图)
   └─ FALSE → 跳过
   
5. Send_Text_Message (Telegram)
   ↓ 发送 final_text
   
   ⚠️ 问题：如果final_text作为photo caption发送，
      会触发"message caption is too long"错误
```

---

## 🚨 已解决的Telegram限制问题

### 问题描述
- Telegram图片caption限制：**1024字符**
- GPT-5生成内容：**2000+字符**（太详细）
- 错误：`Bad Request: message caption is too long`

### ✅ 解决方案（后端修改）

**文件**: `gpt5Brain.js`  
**修改**: 在GPT-5的system prompt中添加字数限制

```javascript
systemPrompt = `你是专业市场分析师。严格遵守以下规则：
1. 只使用提供的实时数据，禁止编造数字
2. 如果数据不足，明确说明而不是猜测
3. 保持自然语气，避免机器式复述
4. 进行深度推理：分析趋势、风险、机会，而不是简单复述数据
5. 🔴 **字数限制**：回复必须控制在800字以内（简洁、精准、有洞察力）`;
```

**效果**:
- GPT-5现在生成≤800字的回复
- 远低于1024字符限制
- N8N **不需要修改**，照常工作

---

## 🧠 GPT-5单核引擎配置

### API参数（v4.0）

```javascript
{
  model: 'gpt-5-mini',              // ✅ 正式模型名（API名）
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ],
  max_completion_tokens: 4000,      // ⚠️ 不是max_tokens！
  // ❌ 不支持：temperature, presence_penalty, frequency_penalty
}
```

### 性能指标

| 指标 | v3.1（6AI投票） | v4.0（GPT-5单核） |
|------|----------------|-------------------|
| 响应时间 | 16秒 | 40秒 |
| Token消耗 | ~8000 | ~3700 |
| 成本估算 | $0.06 | $0.0075 |
| 分析质量 | 多样化 | 深度推理 |

---

## 📊 数据流时序图

```
用户: "西班牙热力图 盘中分析一下"
  │
  ▼
Telegram → N8N Trigger
  │
  ▼
N8N: HTTP Request
  POST /brain/orchestrate
  Body: { text: "西班牙...", chat_type: "private", user_id: "123" }
  │
  ▼
Replit Backend (index.js)
  ├─ Step 1: parseUserIntent() → 识别意图
  ├─ Step 2: resolveSymbols() → 无股票代码
  ├─ Step 3: fetchMarketData() → 获取实时数据（如有）
  ├─ Step 4: fetchAndRankNews() → ImpactRank新闻
  └─ Step 5: generateWithGPT5() → GPT-5生成分析
  │
  ▼
GPT-5 API (OpenAI)
  ├─ 推理时间：30-40秒
  ├─ 隐藏推理tokens：~300-400
  └─ 输出：800字分析
  │
  ▼
Replit Backend → 返回JSON
  {
    final_text: "我这里没有看到...",  // ✅ 800字以内
    needs_heatmap: true,
    heatmap_widget: "https://..."
  }
  │
  ▼
N8N: Parse_Brain_Response
  ├─ 提取 final_text
  └─ 提取 heatmap_widget
  │
  ▼
N8N: Send_Photo (如果有heatmap)
  photo: heatmap_widget
  caption: 空或简短标题
  │
  ▼
N8N: Send_Text_Message
  text: final_text  // ✅ 不再超过1024字符
  │
  ▼
Telegram → 用户收到回复
```

---

## 🔑 关键配置

### 环境变量（Replit）
```bash
OPENAI_API_KEY=sk-proj-...     # GPT-5访问密钥
DATABASE_URL=postgres://...    # PostgreSQL数据库
FINNHUB_API_KEY=...           # 实时数据
FRED_API_KEY=...              # 宏观数据
REPLICATE_API_TOKEN=...       # 图片生成
```

### 超时配置
- **N8N HTTP Request超时**: 90秒
- **GPT-5 API超时**: 90秒
- **实际响应时间**: 40秒左右

---

## 📈 v3.1 → v4.0 架构演进

### v3.1（多AI投票）
```
用户问题 → 6个AI并行分析 → 投票合成 → 返回结果
          ├─ GPT-4
          ├─ Claude
          ├─ DeepSeek
          ├─ Gemini
          ├─ Perplexity
          └─ Mistral
```

**问题**:
- ❌ 复杂度高（6个API调用）
- ❌ 成本高（$0.06/次）
- ❌ 合成逻辑复杂（投票+权重）

---

### v4.0（GPT-5单核）
```
用户问题 → GPT-5深度推理 → 返回结果
```

**优势**:
- ✅ 架构简化（1个API调用）
- ✅ 成本降低87%（$0.0075/次）
- ✅ 深度推理能力强
- ✅ 响应更连贯

**保留v3.1优势**:
- ✅ ImpactRank算法（新闻评分）
- ✅ 实时数据管道（Finnhub, FRED）
- ✅ 反编造系统（Compliance Guard）
- ✅ 数据溯源（Provenance Tracking）

---

## 🎯 核心IP保护

### 保留的专有技术

1. **ImpactRank算法**（新闻评分）
   - 4维评分：urgency × relevance × authority × freshness
   - 排序优先级：影响力 > 时间

2. **实时数据管道**
   - Finnhub：股票报价、新闻
   - FRED：宏观经济数据
   - SEC EDGAR：财报数据

3. **反编造系统**（3层保护）
   - Layer 1: 数据验证
   - Layer 2: 强制引用
   - Layer 3: Compliance Guard

4. **语义意图理解**
   - AI驱动的意图解析
   - 全局股票发现（多语言）

---

## ⚙️ N8N需要知道的事

### 1. 字数已限制，无需修改N8N
- ✅ 后端已添加800字限制
- ✅ N8N照常工作（不修改）

### 2. 响应时间正常（40秒）
- GPT-5推理需要30-40秒
- N8N超时设置90秒足够

### 3. 热力图处理
- `needs_heatmap: true` → 发送图片
- `heatmap_widget` → TradingView URL

### 4. 错误处理
如果后端返回：
```json
{
  "status": "error",
  "error": "错误信息"
}
```
N8N应该捕获并友好提示用户

---

## 📋 下一步方向（待讨论）

### 可能的优化方向

1. **性能优化**
   - [ ] 缓存常见查询（减少API调用）
   - [ ] 异步数据预取
   - [ ] 降低GPT-5响应时间（调整prompt）

2. **功能增强**
   - [ ] 更多数据源（Twitter情绪、Reddit讨论）
   - [ ] 多语言支持优化
   - [ ] 自定义分析模板

3. **用户体验**
   - [ ] 流式输出（实时显示分析进度）
   - [ ] 个性化推荐
   - [ ] 历史对话上下文

4. **成本优化**
   - [ ] 智能模型选择（简单问题用GPT-4o-mini）
   - [ ] Token使用优化
   - [ ] 批量处理

---

## 🔍 当前系统健康状态

| 检查项 | 状态 | 备注 |
|--------|------|------|
| GPT-5 API | ✅ 正常 | 40秒响应，生成质量高 |
| 字数控制 | ✅ 已修复 | ≤800字，不超Telegram限制 |
| 数据库 | ✅ 正常 | PostgreSQL连接稳定 |
| 实时数据 | ✅ 正常 | Finnhub, FRED可用 |
| N8N集成 | ✅ 正常 | 无需修改 |
| 部署状态 | ✅ 生产环境 | Cloud Run运行中 |

---

**系统版本**: v4.0  
**核心引擎**: GPT-5 Mini (gpt-5-mini)  
**部署平台**: Google Cloud Run  
**维护状态**: 稳定运行 ✅
