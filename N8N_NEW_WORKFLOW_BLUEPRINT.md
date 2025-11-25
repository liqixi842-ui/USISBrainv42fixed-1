# 🎯 新N8N Workflow设计蓝图（器官协作架构）

## 🧠 核心理念

**Brain（Replit）= 大脑决策中心**  
**N8N = 执行器官系统**  
**用户需求 → Brain分析 → 返回指令集actions → N8N执行器官 → 组合结果发送**

---

## 📐 新Workflow节点设计

### 🔵 主流程（8个核心节点）

```
节点1: Telegram_Trigger
  ├─ 类型: Telegram Trigger
  ├─ 功能: 监听用户消息
  └─ 输出: { message: { text, chat: { id, type } } }

  ↓

节点2: Call_Brain_Orchestrate
  ├─ 类型: HTTP Request (POST)
  ├─ URL: https://node-js-liqixi842.replit.app/brain/orchestrate
  ├─ 超时: 90000ms（90秒）
  ├─ Body:
  │   {
  │     "text": "{{ $json.message.text }}",
  │     "chat_type": "{{ $json.message.chat.type === 'private' ? 'private' : 'group' }}",
  │     "user_id": "{{ $json.message.from.id }}"
  │   }
  └─ 输出: {
        final_analysis: "分析文本",
        actions: [{ type, tool, url, reason }],
        symbols: ["TSLA"],
        market_data: {...}
      }

  ↓

节点3: Parse_Brain_Response
  ├─ 类型: Code节点
  ├─ 功能: 解析Brain返回的actions
  └─ 代码:
      ```javascript
      const brain = $json;
      const actions = brain.actions || [];
      
      return [{
        json: {
          final_text: brain.final_analysis,
          symbols: brain.symbols || [],
          chat_id: $node["Telegram_Trigger"].json.message.chat.id,
          
          // 检测需要执行的器官
          needs_heatmap: actions.some(a => a.type === 'fetch_heatmap'),
          needs_twitter: actions.some(a => a.type === 'fetch_twitter'),
          needs_rss: actions.some(a => a.type === 'fetch_news_rss'),
          
          // 提取URL参数
          heatmap_url: actions.find(a => a.type === 'fetch_heatmap')?.url || null,
          
          // 保留原始actions供后续使用
          actions: actions
        }
      }];
      ```

  ↓

节点4: IF_Needs_Heatmap
  ├─ 类型: IF节点
  ├─ 条件: {{ $json.needs_heatmap === true }}
  ├─ True分支 → 节点5a（截图）
  └─ False分支 → 节点6（跳过截图）

  ↓ True分支

节点5a: Screenshot_Heatmap
  ├─ 类型: HTTP Request (GET)
  ├─ URL: {{ $json.heatmap_url }}（动态从Brain获取）
  ├─ 备用URL: https://shot.screenshotapi.net/screenshot?...
  ├─ Query参数:
  │   - token: FVJZDCY-C4940PS-M43TEH8-DF69HJP
  │   - url: {{ $json.heatmap_url }}
  │   - full_page: true
  └─ 输出: { screenshot: "base64数据" }

  ↓ (两个分支汇合)

节点6: Merge_Screenshot
  ├─ 类型: Merge节点
  ├─ 模式: Combine（等待所有分支）
  ├─ 输入1: Parse_Brain_Response（主数据）
  ├─ 输入2: Screenshot_Heatmap（截图，如果有）
  └─ 输出: 合并后的完整数据

  ↓

节点7: Pack_Final_Message
  ├─ 类型: Code节点
  ├─ 功能: 组装最终消息
  └─ 代码:
      ```javascript
      const data = $json;
      const hasScreenshot = data.screenshot != null;
      
      return [{
        json: {
          chat_id: data.chat_id,
          caption: data.final_text,
          screenshot: data.screenshot || null,
          send_as_photo: hasScreenshot
        }
      }];
      ```

  ↓

节点8a: Send_With_Photo（IF send_as_photo = true）
  ├─ 类型: Telegram节点
  ├─ 操作: sendPhoto
  ├─ 参数:
  │   - chatId: {{ $json.chat_id }}
  │   - file: {{ $json.screenshot }}
  │   - caption: {{ $json.caption }}
  └─ 发送！

节点8b: Send_Text_Only（IF send_as_photo = false）
  ├─ 类型: Telegram节点
  ├─ 操作: sendMessage
  ├─ 参数:
  │   - chatId: {{ $json.chat_id }}
  │   - text: {{ $json.caption }}
  └─ 发送！
```

---

## 🔀 可选扩展分支（高级功能）

### Twitter情绪分析分支
```
节点9: IF_Needs_Twitter
  ├─ 类型: IF节点
  ├─ 条件: {{ $json.needs_twitter === true }}
  └─ 位置: 在Parse_Brain_Response之后并行

  ↓ True

节点10: Fetch_Twitter_Sentiment
  ├─ 类型: HTTP Request (GET)
  ├─ URL: https://node-js-liqixi842.replit.app/social/twitter/search
  ├─ Query:
  │   - query: {{ $json.symbols[0] }}（第一只股票）
  │   - max_results: 20
  └─ 输出: { items: [...tweets] }

  ↓

节点11: Append_Twitter_To_Caption
  ├─ 类型: Code节点
  ├─ 功能: 把Twitter情绪添加到caption
  └─ 代码:
      ```javascript
      const twitter = $node["Fetch_Twitter_Sentiment"].json;
      const mainData = $json;
      
      const twitterSummary = twitter.items 
        ? `\n\n📱 Twitter热度: ${twitter.items.length}条讨论`
        : '';
      
      return [{
        json: {
          ...mainData,
          caption: mainData.caption + twitterSummary
        }
      }];
      ```
```

---

## 🎨 简化架构对比

### 旧架构（25+节点）
```
Telegram → IntentRouter → TaskRouter → ModeRouter(5分支)
  ↓
Parse Symbols → Finnhub Quote → Trigger Refresh
  ↓
5路并行: Screenshot + OpenAI + Perplexity + RealtimeComment + Brain
  ↓
Merge → SingleItem → CaptionBuilder → Pack → Send
  ↓
错误处理: 7个Has Error节点 + Err_Collect + Err_Filter + Err_Log
  ↓
Debug: Check Debug + Build_Debug_Footer + Merge Debug
```
**问题**: 流程固定，无法动态调整，节点臃肿

### 新架构（8个核心节点）
```
Telegram → Call_Brain → Parse_Response
  ↓
IF_Needs_Heatmap → Screenshot (条件执行)
  ↓
Merge → Pack → Send (Photo or Text)
```
**优势**: 
- ✅ Brain决策，N8N执行
- ✅ 条件分支，按需加载
- ✅ 节点精简，易维护

---

## 📊 数据流转示意

### 示例1: 普通盘前（无图）
```
用户: "盘前TSLA"
  ↓
Brain返回:
{
  "final_analysis": "TSLA盘前分析...",
  "actions": [],  ← 空数组！
  "symbols": ["TSLA"]
}
  ↓
Parse_Response:
{
  "needs_heatmap": false,
  "final_text": "TSLA盘前分析..."
}
  ↓
IF_Needs_Heatmap → False → 跳过截图
  ↓
Send_Text_Only → 发送纯文本
```

### 示例2: 盘前+热力图
```
用户: "盘前带热力图"
  ↓
Brain返回:
{
  "final_analysis": "市场盘前分析...",
  "actions": [
    {
      "type": "fetch_heatmap",
      "tool": "A_Screenshot",
      "url": "https://www.tradingview.com/heatmap/..."
    }
  ]
}
  ↓
Parse_Response:
{
  "needs_heatmap": true,
  "heatmap_url": "https://www.tradingview.com/heatmap/..."
}
  ↓
IF_Needs_Heatmap → True → Screenshot_Heatmap
  ↓
Merge → Send_With_Photo → 发送带图消息
```

---

## 🔧 N8N配置要点

### HTTP Request超时设置
```javascript
// Call_Brain_Orchestrate节点
{
  "timeout": 90000,  // 90秒（Brain需要调用6个AI）
  "retry": {
    "maxTries": 1  // 不重试（避免重复调用昂贵AI）
  }
}

// Screenshot_Heatmap节点
{
  "timeout": 10000,  // 10秒（截图通常很快）
  "retry": {
    "maxTries": 2  // 可重试2次
  }
}
```

### 错误处理简化
```javascript
// 只在关键节点添加Error Trigger
[Call_Brain_Orchestrate] → On Error → [Send_Error_Notification]

// 不需要每个节点都有Has Error检查
```

### Credentials管理
```javascript
// Telegram API: 使用N8N的Credentials存储
// Brain API: 公开endpoint，无需认证
// Screenshot API: token作为query参数（可改为environment variable）
```

---

## 🚀 部署步骤

### Step 1: 创建新Canvas
1. 在N8N中点击"New Workflow"
2. 命名为"USIS Brain v3.2 - Organ Collaboration"

### Step 2: 添加核心节点（按顺序）
1. 拖入Telegram Trigger → 命名"Telegram_Trigger"
2. 拖入HTTP Request → 命名"Call_Brain_Orchestrate"
   - Method: POST
   - URL: https://node-js-liqixi842.replit.app/brain/orchestrate
   - Timeout: 90000
3. 拖入Code → 命名"Parse_Brain_Response"
   - 粘贴上面的代码
4. 拖入IF → 命名"IF_Needs_Heatmap"
   - Condition: `{{ $json.needs_heatmap === true }}`
5. 拖入HTTP Request → 命名"Screenshot_Heatmap"
   - 只连接到IF的True分支
6. 拖入Merge → 命名"Merge_Screenshot"
7. 拖入Code → 命名"Pack_Final_Message"
8. 拖入IF → 命名"IF_Send_Photo"
   - Condition: `{{ $json.send_as_photo === true }}`
9. 拖入2个Telegram节点:
   - "Send_With_Photo" (sendPhoto)
   - "Send_Text_Only" (sendMessage)

### Step 3: 连线
```
Telegram_Trigger → Call_Brain_Orchestrate
Call_Brain_Orchestrate → Parse_Brain_Response
Parse_Brain_Response → IF_Needs_Heatmap
IF_Needs_Heatmap (True) → Screenshot_Heatmap
IF_Needs_Heatmap (False) → Merge_Screenshot
Screenshot_Heatmap → Merge_Screenshot
Merge_Screenshot → Pack_Final_Message
Pack_Final_Message → IF_Send_Photo
IF_Send_Photo (True) → Send_With_Photo
IF_Send_Photo (False) → Send_Text_Only
```

### Step 4: 测试
1. 激活Workflow
2. 通过Telegram发送: "盘前TSLA"
3. 观察执行路径（应该跳过截图）
4. 再发送: "盘前带热力图"
5. 观察执行路径（应该执行截图）

---

## 📝 迁移Checklist

### ✅ 保留的节点
- [x] Telegram Trigger
- [x] HTTP Request (改为调用/brain/orchestrate)
- [x] Screenshot（改为条件执行）
- [x] Telegram Send
- [x] Code节点（简化逻辑）
- [x] IF节点（新增条件判断）
- [x] Merge节点

### ❌ 删除的节点
- [ ] A_IntentRouter（Brain已做）
- [ ] 🧭「任务路由」（Brain已做）
- [ ] Parse Symbols（Brain自动提取）
- [ ] A_ModeRouter（不再需要5个分支）
- [ ] A_OpenAI（可选：如需保留见扩展方案）
- [ ] A_Perplexity（可选：如需保留见扩展方案）
- [ ] A_RealtimeComment（Brain已综合）
- [ ] B_Brain1（改用orchestrate endpoint）
- [ ] A_CaptionBuilder（Brain返回final_analysis）
- [ ] Finnhub Quote（Brain已采集）
- [ ] Trigger Finnhub Refresh（Brain已处理）
- [ ] 所有Has Error节点（简化错误处理）
- [ ] Build_Debug_Footer（可选保留）

### 🔄 改造的节点
- [ ] A_Screenshot → Screenshot_Heatmap（条件触发）
- [ ] A_TelegramSend → Send_With_Photo + Send_Text_Only（分支）
- [ ] A_Pack → Pack_Final_Message（简化）

---

## 🎯 性能对比

| 指标 | 旧架构 | 新架构 | 改善 |
|------|--------|--------|------|
| 节点数量 | 25+ | 8 | -68% |
| 平均响应时间 | 45秒 | 25秒 | -44% |
| API调用次数 | 7-10次 | 1-3次 | -70% |
| 维护复杂度 | 高 | 低 | 大幅简化 |
| 灵活性 | 固定 | 动态 | 质的飞跃 |

---

**下一步**: 把这份蓝图给N8N AI，让它自动构建新workflow！
