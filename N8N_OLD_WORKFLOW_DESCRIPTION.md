# 🗺️ 旧N8N Workflow自然语言描述（供AI重建）

## 📋 主workflow: "My workflow"

### 🎯 整体流程概述
用户通过Telegram发送消息 → N8N接收 → 意图识别 → 根据模式（盘前/盘中/复盘/诊股/新闻）执行不同分支 → 并行调用多个AI和数据源 → 合并结果 → 构建caption → 发送带截图的Telegram消息

---

## 🔗 节点连线关系（按执行顺序）

### 第1阶段：接收与意图识别
```
1. [🟢 「接收指令」]
   类型：Telegram Trigger
   功能：监听Telegram消息
   输出：用户消息对象（包含message.text, message.chat.id等）
   
   ↓
   
2. [A_IntentRouter]
   类型：HTTP Request (POST)
   URL：https://node-js-liqixi842.replit.app/brain/intent
   输入：
     - text: {{ $json.message.text }}
     - lang: "zh"
     - allow: ["盘前", "盘中", "收盘", "复盘", "解票", "诊股", "资讯", "新闻", "行情"]
   输出：{ mode: "premarket"/"intraday"/..., symbols: [...] }
   
   ↓
   
3. [🧭 「任务路由」]
   类型：Code节点
   功能：根据A_IntentRouter返回的mode决定处理逻辑
   逻辑：
     - 如果mode不存在，用关键词匹配（盘前/盘中/复盘/解票/新闻）
     - 如果都不匹配，返回帮助信息
   输出：{ mode, raw_text, symbols }
```

---

### 第2阶段：模式路由（分支处理）
```
4. [A_ModeRouter]
   类型：Switch节点（5个分支）
   条件判断：
     - 分支1: mode === "premarket" → 盘前流程
     - 分支2: mode === "intraday" → 盘中流程
     - 分支3: mode === "postmarket" → 复盘流程
     - 分支4: mode === "diagnose" → 诊股流程
     - 分支5: mode === "news" → 新闻流程
   
   每个分支都会执行：Symbol提取 → 数据采集 → AI分析 → 合并结果
```

---

### 第3阶段：数据采集（盘前分支示例）
```
5. [Parse Symbols]
   类型：Code节点
   功能：从消息中提取股票代码
   逻辑：
     - 正则匹配：/\b[A-Za-z]{1,5}\b/g
     - 提取大写字母组合
     - 如果没找到，使用默认列表：["SPY","QQQ","AAPL","TSLA","NVDA","MSFT","AMZN","META"]
   输出：symbols数组（每个symbol一条item）
   
   ↓ (循环每个symbol)
   
6. [Finnhub Quote]
   类型：HTTP Request (GET)
   URL：https://finnhub.io/api/v1/quote
   参数：
     - symbol: {{ $json.symbol }}
     - token: d40idr1r01qqo3qi7o20d40idr1r01qqo3qi7o2g
   输出：{ c: 当前价, h: 最高, l: 最低, o: 开盘, pc: 前收盘, d: 变化, dp: 变化百分比, t: 时间戳 }
   
   ↓
   
7. [Trigger Finnhub Refresh]
   类型：Code节点
   功能：把多条Finnhub Quote结果汇总成一条
   逻辑：
     - 从所有Finnhub Quote结果中提取symbol, price, changePct
     - 构建priceText：每行 "TSLA: $250.00 📈 +2.5%"
     - 构建priceTable：制表符分隔的表格
   输出：{ symbols: [...], priceText: "...", priceTable: "..." }
```

---

### 第4阶段：并行AI分析（5路并行）
```
所有分支从 [Trigger Finnhub Refresh] 开始并行执行：

路径A: 热力图截图
8a. [A_Screenshot]
    类型：HTTP Request (GET)
    URL：https://shot.screenshotapi.net/screenshot
    参数：
      - token: FVJZDCY-C4940PS-M43TEH8-DF69HJP
      - url: https://www.tradingview.com/heatmap/stock/#...
      - full_page: true
    输出：{ screenshot: "base64图片数据" }

路径B: OpenAI分析
8b. [A_OpenAI]
    类型：HTTP Request (POST)
    URL：https://api.openai.com/v1/chat/completions
    请求体：
      - model: "gpt-4o"
      - messages: 系统提示词 + "请提供【盘前快报】300-400字"
    输出：{ choices: [{ message: { content: "分析文本..." }}] }

路径C: Perplexity分析
8c. [A_Perplexity]
    类型：HTTP Request (POST)
    URL：https://api.perplexity.ai/chat/completions
    请求体：
      - model: "sonar-pro"
      - messages: 包含Finnhub实时行情的提示词
      - max_tokens: 900
    输出：{ choices: [{ message: { content: "市场观察..." }}] }

路径D: GPT-4实时点评
8d. [A_RealtimeComment]
    类型：HTTP Request (POST)
    URL：https://api.openai.com/v1/chat/completions
    请求体：
      - model: "gpt-4o-2024-08-06"
      - messages: 包含OpenAI基础分析 + Finnhub实时数据
      - 要求输出：情绪诊断、3个关键信号、策略框架、反向思考、一句话
    输出：{ choices: [{ message: { content: "实战点评..." }}] }

路径E: Brain决策
8e. [B_Brain1]
    类型：HTTP Request (POST)
    URL：https://node-js-liqixi842.replit.app/brain/decide
    请求体：
      - mode: {{ $json.mode }}
      - text: {{ $json.raw_text }}
      - symbols: Finnhub的symbols数组
    输出：{ final_text: { zh: "..." }, decision: { vote: "BUY/HOLD/SELL", confidence: 0.8 } }
```

---

### 第5阶段：结果合并与输出
```
9. [A_Merge]
   类型：Merge节点（5路输入）
   模式：Combine by Position
   输入：
     - 输入1: A_Screenshot
     - 输入2: A_OpenAI
     - 输入3: A_Perplexity
     - 输入4: A_RealtimeComment
     - 输入5: B_Brain1
   输出：合并后的单条数据（包含所有5个节点的结果）
   
   ↓
   
10. [A_SingleItem ✅]
    类型：Code节点
    功能：只取第一条item（去重）
    代码：return [items[0]];
    
    ↓
    
11. [A_CaptionBuilder]
    类型：Code节点
    功能：构建最终的Telegram caption
    逻辑：
      - 从B_Brain1提取final_text.zh和decision.vote
      - 从Trigger Finnhub Refresh提取priceText
      - 根据mode选择标题：
        * premarket: "📊 盘前快照"
        * intraday: "⏱ 盘中热点"
        * postmarket: "🧾 收盘复盘"
        * diagnose: "🧪 单票诊断"
        * news: "📰 市场资讯"
      - 拼接格式：
        标题 + 价格表（如果是盘前/复盘） + 决策结论 + Brain分析文本
    输出：{ caption: "最终文本..." }
    
    ↓
    
12. [A_Pack]
    类型：Set节点
    功能：打包最终输出数据
    字段：
      - caption: {{ $json.caption }}
      - screenshot: {{ $node["A_Screenshot"].json.screenshot }}
      - chat_id: {{ $node["🟢 「接收指令」"].json.message.chat.id }}
    
    ↓
    
13. [A_TelegramSend]
    类型：Telegram节点
    操作：sendPhoto
    参数：
      - chatId: {{ $json.chat_id }}
      - file: {{ $json.screenshot }}（base64图片）
      - caption: {{ $json.caption }}
    
    完成！消息发送到Telegram
```

---

## 🔀 其他分支节点

### 错误处理分支
```
14. [Err_Collect]
    类型：Merge节点
    功能：收集所有错误节点的输出
    
    ↓
    
15. [Err_Filter]
    类型：IF节点
    条件：检查是否有错误
    
    ↓
    
16. [Err_Log]
    类型：HTTP Request
    功能：记录错误到日志系统
    
    ↓
    
17. [A_TelegramText_Admin]
    类型：Telegram节点
    功能：发送错误通知给管理员
```

### Debug分支
```
18. [Check Debug]
    类型：IF节点
    条件：检查是否开启debug模式
    
    ↓ (如果debug=true)
    
19. [Build_Debug_Footer]
    类型：Code节点
    功能：构建debug信息footer
    内容：执行时间、节点状态、数据摘要
    
    ↓
    
20. [Merge Debug]
    类型：Merge节点
    功能：把debug footer合并到main flow
```

### Fallback分支（无图模式）
```
21. [A_TaskRouter]
    类型：IF节点
    条件：检查mode是否需要图片
    
    ↓ (如果不需要图片)
    
22. [A_Fallback_Text]
    类型：Set节点
    功能：只发送文字，不带图片
    
    ↓
    
23. [A_TelegramText]
    类型：Telegram节点
    操作：sendMessage（纯文本）
```

---

## 📊 辅助workflow: "USIS_DataEmpire_C"

这是一个独立的定时数据采集workflow（未连接到主workflow）

### 流程
```
1. [Schedule Trigger]
   类型：定时触发器
   频率：每小时执行一次
   
   ↓
   
2. [C_Quote_AVDemo]
   类型：HTTP Request
   URL：Alpha Vantage全球行情API
   功能：获取IBM股票数据（demo）
   
   ↓
   
3. [C_Map_Quote]
   类型：Set节点
   功能：提取字段（symbol, price, change, pct, time）
   
   ↓
   
4. [C_RSS_News]（并行）
   类型：HTTP Request
   URL：Google News RSS Feed
   参数：q=IBM
   
   ↓
   
5. [C_Convert_RSS_JSON]
   类型：XML节点
   功能：把RSS XML转JSON
   
   ↓
   
6. [C_Map_News]
   类型：Set节点
   功能：提取前3条新闻（title, url, publishedAt, source）
   
   ↓
   
7. [C_Merge_QuoteNews]
   类型：Merge节点
   功能：合并行情和新闻
   
   ↓
   
8. [C_Post_BrainFeed]
   类型：HTTP Request (POST)
   URL：https://node-js-liqixi842.replit.app/brain/feed
   功能：把数据喂给Brain的/brain/feed endpoint
```

---

## 🎨 关键设计模式

### 1. 并行扇出模式
- Trigger Finnhub Refresh → 5路并行（Screenshot, OpenAI, Perplexity, RealtimeComment, Brain）
- 优点：加快响应速度
- 实现：每个分支独立HTTP请求

### 2. 错误收集模式
- 每个关键节点都有对应的"Has Error?"检查节点
- 所有错误汇总到Err_Collect
- 统一发送管理员通知

### 3. 条件分支模式
- A_ModeRouter按mode分5个分支
- Check Debug决定是否添加debug footer
- A_TaskRouter决定是否发送图片

### 4. 数据重组模式
- Trigger Finnhub Refresh把多条数据汇总成一条
- A_Pack重组最终输出结构
- A_CaptionBuilder拼接文本

---

## 🔧 技术细节

### API认证
- **Telegram**: 通过credentials存储
- **OpenAI**: Bearer token硬编码在请求头
- **Perplexity**: Bearer token硬编码
- **Finnhub**: token作为query参数
- **Screenshot API**: token作为query参数

### 数据流动
1. Telegram消息 → JSON对象
2. JSON对象在节点间传递（通过$json）
3. 可以引用之前节点：$node["节点名"].json.字段名
4. 最终打包成{ caption, screenshot, chat_id }

### 超时设置
- 大部分HTTP请求：6000ms（6秒）
- OpenAI某些endpoint：15000ms（15秒）

---

## 🚨 已知问题（为什么要重构）

1. **固定流水线**：无法根据用户需求灵活调整
   - 用户说"盘前"也会截图
   - 用户说"盘前带热力图"和"盘前"走同样流程

2. **重复逻辑**：
   - Parse Symbols和A_IntentRouter都在提取symbols
   - Brain的/brain/intent和N8N的🧭「任务路由」重复判断mode

3. **硬编码多**：
   - API keys直接写在JSON里
   - 提示词固定，无法动态调整

4. **串行瓶颈**：
   - 虽然有并行，但Merge等待最慢的节点
   - Brain决策在N8N端，无法利用Replit的并发

5. **错误处理复杂**：
   - 每个节点都有Has Error检查
   - 错误处理节点比业务节点还多

---

## ✅ 新架构改进方向

### 保留（N8N强项）
- ✅ Telegram Trigger
- ✅ A_Screenshot（根据Brain的actions执行）
- ✅ 并行AI调用（A_OpenAI, A_Perplexity）
- ✅ Merge和条件分支
- ✅ Send Telegram

### 删除/迁移（重复或低效）
- ❌ Parse Symbols → Brain自动提取
- ❌ 🧭「任务路由」→ Brain的understandIntent
- ❌ A_ModeRouter → Brain的detectActions
- ❌ A_CaptionBuilder → Brain的final_analysis
- ❌ 大部分Has Error节点 → 简化错误处理

### 新增（器官协作）
- ✅ IF节点：判断Brain返回的actions数组
- ✅ 动态URL：使用actions[].url参数
- ✅ 灵活分支：根据actions.type决定执行哪些器官

---

**文档用途**：把这份描述给N8N的AI，让它在新画布重建优化后的workflow
**重建原则**：保留N8N强项（并行、截图、Telegram），删除重复逻辑，添加Brain协作
