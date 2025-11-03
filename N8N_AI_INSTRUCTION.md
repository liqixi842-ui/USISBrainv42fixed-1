# N8N AI指令：创建USIS Brain v3器官协作系统

请创建一个包含以下8个节点的workflow，并按照指定方式连接。

---

## 节点1: Telegram_Trigger
- **类型**: Telegram Trigger
- **配置**: 监听所有消息
- **输出字段**: message.text, message.chat.id, message.chat.type, message.from.id

---

## 节点2: Call_Brain_Orchestrate
- **类型**: HTTP Request
- **Method**: POST
- **URL**: `https://node-js-liqixi842.replit.app/brain/orchestrate`
- **超时**: 90000ms
- **Body Type**: JSON
- **Body内容**:
```json
{
  "text": "{{ $json.message.text }}",
  "chat_type": "{{ $json.message.chat.type === 'private' ? 'private' : 'group' }}",
  "user_id": "{{ $json.message.from.id }}"
}
```

---

## 节点3: Parse_Brain_Response
- **类型**: Code
- **代码**:
```javascript
const brain = $json;
const actions = brain.actions || [];

return [{
  json: {
    final_text: brain.final_analysis || "未收到分析",
    symbols: brain.symbols || [],
    chat_id: $node["Telegram_Trigger"].json.message.chat.id,
    
    needs_heatmap: actions.some(a => a.type === 'fetch_heatmap'),
    heatmap_url: actions.find(a => a.type === 'fetch_heatmap')?.url || null,
    
    actions: actions
  }
}];
```

---

## 节点4: IF_Needs_Heatmap
- **类型**: IF
- **条件**: `{{ $json.needs_heatmap === true }}`
- **True分支**: 连接到节点5
- **False分支**: 连接到节点6

---

## 节点5: Screenshot_Heatmap
- **类型**: HTTP Request
- **Method**: GET
- **仅在IF_Needs_Heatmap为True时执行**
- **URL**: `https://shot.screenshotapi.net/screenshot`
- **Query参数**:
  - token: `FVJZDCY-C4940PS-M43TEH8-DF69HJP`
  - url: `{{ $json.heatmap_url || 'https://www.tradingview.com/heatmap/stock/' }}`
  - full_page: `true`
- **超时**: 15000ms

---

## 节点6: Merge_Screenshot
- **类型**: Merge
- **模式**: Combine (Merge By Position)
- **输入1**: 来自Parse_Brain_Response（主数据流）
- **输入2**: 来自Screenshot_Heatmap（可选的截图）
- **配置**: Include unpaired items = true

---

## 节点7: Pack_Final_Message
- **类型**: Code
- **代码**:
```javascript
const mainData = $input.first().json;
const screenshotData = $input.all().find(item => item.json.screenshot);

const hasScreenshot = screenshotData && screenshotData.json.screenshot;

return [{
  json: {
    chat_id: mainData.chat_id,
    caption: mainData.final_text,
    screenshot: hasScreenshot ? screenshotData.json.screenshot : null,
    send_as_photo: !!hasScreenshot
  }
}];
```

---

## 节点8a: Send_With_Photo
- **类型**: Telegram
- **操作**: Send Photo
- **仅在IF_Send_Photo为True时执行**
- **配置**:
  - Chat ID: `{{ $json.chat_id }}`
  - Photo: `{{ $json.screenshot }}`
  - Caption: `{{ $json.caption }}`

---

## 节点8b: Send_Text_Only
- **类型**: Telegram
- **操作**: Send Message
- **仅在IF_Send_Photo为False时执行**
- **配置**:
  - Chat ID: `{{ $json.chat_id }}`
  - Text: `{{ $json.caption }}`

---

## 节点8前: IF_Send_Photo
- **类型**: IF
- **条件**: `{{ $json.send_as_photo === true }}`
- **True分支**: 连接到Send_With_Photo
- **False分支**: 连接到Send_Text_Only

---

## 连线关系
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

---

## 节点位置建议（从左到右）
```
列1: Telegram_Trigger
列2: Call_Brain_Orchestrate
列3: Parse_Brain_Response
列4: IF_Needs_Heatmap
列5: Screenshot_Heatmap (偏上)
列6: Merge_Screenshot
列7: Pack_Final_Message
列8: IF_Send_Photo
列9: Send_With_Photo (偏上) + Send_Text_Only (偏下)
```

---

## 重要配置项

### Telegram凭证
- 所有Telegram节点需要配置相同的Telegram Bot凭证
- 如果已有凭证，请选择它
- 如果没有，需要先在N8N中添加Telegram credentials

### 错误处理
- Call_Brain_Orchestrate节点：
  - Continue On Fail = true
  - Retry On Fail = false（避免重复调用AI）

### 执行顺序
- 确保Merge_Screenshot节点设置为等待所有输入
- 如果Parse_Brain_Response流入，但Screenshot_Heatmap未执行，Merge应该只传递主数据

---

## 测试步骤

### 测试1: 纯文本（无图）
1. 激活workflow
2. 发送Telegram消息: `盘前TSLA`
3. 预期: 收到纯文本回复（无图片）
4. 验证: Screenshot_Heatmap节点应该被跳过

### 测试2: 带热力图
1. 发送Telegram消息: `盘前带热力图`
2. 预期: 收到带图片的回复
3. 验证: Screenshot_Heatmap节点应该被执行

---

## 常见问题

### Q: Parse_Brain_Response报错"Cannot read property 'message'"
**A**: 确保节点引用改为 `$node["Telegram_Trigger"]` 而不是 `$input`

### Q: Merge_Screenshot一直等待
**A**: 设置"Include unpaired items" = true，允许单路输入通过

### Q: 截图返回空
**A**: 检查heatmap_url是否正确，或者Screenshot API token是否有效

---

请按照上述配置创建workflow，节点命名务必与文档一致，以便代码中的引用正常工作。
