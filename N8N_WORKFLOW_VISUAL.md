# N8N工作流可视化对比

## 📊 当前工作流（仅文字）
```
┌─────────────────┐
│ Telegram触发器  │  用户发送消息
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ HTTP Request    │  调用Brain API
│ POST /brain/    │
│  orchestrate    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Telegram发送    │  发送文字回复
│ sendMessage     │
└─────────────────┘
```

---

## ✨ 升级后工作流（智能图表）

```
┌─────────────────┐
│ Telegram触发器  │  用户："CPI怎么样？"
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ HTTP Request to Brain                   │
│ POST /brain/orchestrate                 │
│                                         │
│ 返回：                                   │
│ {                                       │
│   "answer": "CPI为3.2%...",            │
│   "actions": [                         │
│     {                                  │
│       "type": "send_chart",           │
│       "url": "https://quickchart...", │
│       "caption": "📈 CPI走势"          │
│     }                                  │
│   ]                                    │
│ }                                      │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│ IF节点          │  检查: actions.length > 0 ?
└────┬────────┬───┘
     │        │
   TRUE     FALSE
     │        │
     │        └─────────────────┐
     │                          │
     ▼                          │
┌─────────────────┐            │
│ Loop遍历actions │            │
└────────┬────────┘            │
         │                      │
         ▼                      │
┌─────────────────┐            │
│ IF: 是图表动作?  │            │
└────┬────────┬───┘            │
   TRUE     FALSE              │
     │        │                │
     ▼        └────────────┐   │
┌─────────────────┐        │   │
│ Telegram        │        │   │
│ Send Photo      │◄───────┘   │
│ (发送图表)       │            │
└────────┬────────┘            │
         │                      │
         └──────────┬───────────┘
                    │
                    ▼
            ┌─────────────────┐
            │ Telegram        │
            │ sendMessage     │
            │ (发送文字分析)   │
            └─────────────────┘
```

---

## 🎯 工作流程示例

### 场景A：用户问"CPI怎么样？"

```
1. Telegram触发器接收消息
   └─> text: "CPI怎么样？"
   
2. HTTP Request调用Brain
   └─> Brain智能决策：需要1张CPI图
   └─> 返回：
       - actions: [{ type: 'send_chart', url: '...', caption: '...' }]
       - answer: "当前CPI为3.2%..."
   
3. IF节点检查
   └─> actions.length = 1 > 0 ✅ TRUE
   
4. Loop遍历actions
   └─> action[0]: { type: 'send_chart', ... }
   
5. IF检查类型
   └─> type === 'send_chart' ✅ TRUE
   
6. Telegram Send Photo
   └─> 发送图表给用户 📊
   
7. Telegram sendMessage
   └─> 发送文字分析 💬

用户收到：
📊 [CPI走势图]
💬 "当前CPI为3.2%，较上月上涨0.1%..."
```

---

### 场景B：用户问"预览下宏观数据"

```
1. Telegram触发器接收消息
   └─> text: "预览下宏观数据"
   
2. HTTP Request调用Brain
   └─> Brain智能决策：总览性请求，无需图表
   └─> 返回：
       - actions: []  (空数组)
       - answer: "当前宏观经济概览：CPI 3.2%..."
   
3. IF节点检查
   └─> actions.length = 0 ❌ FALSE
   └─> 直接跳转到文字发送
   
4. Telegram sendMessage
   └─> 发送文字总览 💬

用户收到：
💬 "当前宏观经济概览：CPI 3.2%，失业率3.8%..."
(无图表，节省资源)
```

---

## 🔑 关键节点配置

### 节点1: IF节点（检查是否有图表）
```javascript
// JavaScript Expression
{{ $json.actions && $json.actions.length > 0 }}
```

### 节点2: Loop节点
```
Loop Over Items
Input Field: actions
```

### 节点3: IF节点（检查动作类型）
```javascript
// JavaScript Expression
{{ $json.type === 'send_chart' }}
```

### 节点4: Telegram Send Photo
```
Chat ID: {{ $node["Telegram Trigger"].json["message"]["chat"]["id"] }}
Photo: {{ $json.url }}
Caption: {{ $json.caption }}
```

---

## ✅ 验证清单

完成配置后，检查：
- [ ] IF节点正确判断actions数组是否存在
- [ ] Loop节点成功遍历每个action
- [ ] Telegram Send Photo能访问action.url
- [ ] 文字消息仍然正常发送
- [ ] 测试"CPI怎么样"能收到图+文字
- [ ] 测试"预览宏观数据"只收到文字

---

## 🎨 架构优势

| 对比项 | 固定工作流 | 智能决策（我们的方案） |
|--------|-----------|---------------------|
| 决策位置 | N8N硬编码 | Brain动态判断 |
| 灵活性 | 修改需改N8N | 只需升级Brain |
| 成本 | 可能生成无用图表 | 按需生成，节省资源 |
| 可维护性 | 逻辑分散在多处 | 集中在Brain |
| 扩展性 | 新需求需改工作流 | Brain自动适应 |

**核心理念**：**Brain思考，N8N执行** 🧠➡️🤖
