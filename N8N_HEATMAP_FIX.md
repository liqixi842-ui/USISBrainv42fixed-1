# N8N热力图黑屏修复指南

## 问题诊断

**根本原因**：
1. ❌ Telegram WebView不支持TradingView的JavaScript Widget
2. ❌ HTML能加载，但Widget无法渲染 → 黑屏

**解决方案**：使用Puppeteer截图，将动态页面渲染为静态图片

---

## 修复步骤

### 步骤1：在N8N中配置截图节点

#### 方法A：使用HTTP Request + Puppeteer（推荐）

1. **找到A_Screenshot节点**（或创建新的HTTP Request节点）

2. **配置节点参数**：
   ```
   节点类型: HTTP Request
   Method: POST
   URL: https://api.screenshotone.com/take
   或
   URL: https://api.urlbox.io/v1/YOUR_API_KEY/png
   ```

3. **Body配置**（JSON）：
   ```json
   {
     "url": "{{ $json.url }}",
     "full_page": true,
     "wait_for_network_idle": true,
     "wait_for_timeout": 10000,
     "viewport_width": 1200,
     "viewport_height": 800
   }
   ```

4. **连接到Send_Chart_Photo**：
   ```
   A_Screenshot → Send_Chart_Photo
   ```

#### 方法B：使用N8N内置的Screenshot节点

1. **添加Screenshot节点**

2. **配置**：
   ```
   URL: {{ $json.url }}
   Full Page: Yes
   Wait for Selector: .tradingview-widget-container__widget
   Timeout: 15000ms
   ```

3. **输出**：选择"Binary File"

4. **连接到Telegram节点**

---

### 步骤2：更新N8N工作流连接

**原来的流程**：
```
Emit_Chart_Actions → Send_Chart_Photo
```

**修改后的流程**：
```
Emit_Chart_Actions 
   ↓
IF_Has_URL (判断url是否存在)
   ↓ (true)
A_Screenshot (Puppeteer截图)
   ↓
Send_Chart_Photo (发送截图)
```

---

### 步骤3：配置Screenshot API（如果使用外部服务）

#### 推荐服务（免费/低成本）：

1. **ScreenshotOne** (推荐)
   - 网站：https://screenshotone.com
   - 免费额度：100次/月
   - API简单：POST请求即可

2. **Urlbox**
   - 网站：https://urlbox.io
   - 免费额度：50次/月
   - 功能强大

3. **Shot.io**
   - 网站：https://shot.io
   - 完全免费
   - 无需API key

#### Shot.io配置示例（最简单）：

在N8N的HTTP Request节点中：
```
Method: GET
URL: https://shot.screenshotapi.net/screenshot?url={{ encodeURIComponent($json.url) }}&output=image&file_type=png&wait_for_event=load
```

返回的就是图片，直接发送到Telegram！

---

### 步骤4：测试验证

1. **在Telegram发送**：`美股热力图`

2. **预期流程**：
   ```
   Telegram → Brain → N8N → Screenshot API → Telegram
   ```

3. **检查N8N日志**：
   - Emit_Chart_Actions是否返回了url
   - Screenshot节点是否成功
   - Telegram节点是否收到图片

---

## 快速修复（临时方案）

如果不想配置Puppeteer，可以先禁用热力图：

### 在Brain中禁用热力图

```javascript
// 在detectActions函数中，注释掉热力图检测
// if (explicitHeatmap || ...) {
//   actions.push({ type: 'fetch_heatmap', ... });
// }
```

### 或者返回占位符

```javascript
actions.push({
  type: 'send_text_only',
  text: '⚠️ 热力图功能暂时不可用，请稍后再试'
});
```

---

## N8N节点配置示例（复制粘贴）

### Shot.io截图节点（免费，无需API key）

```json
{
  "nodes": [
    {
      "name": "Screenshot_Heatmap",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "=https://shot.screenshotapi.net/screenshot?url={{ encodeURIComponent($json.url) }}&output=image&file_type=png&wait_for_event=load&delay=5000",
        "method": "GET",
        "responseFormat": "file"
      }
    }
  ]
}
```

### 连接到Telegram

```json
{
  "name": "Send_Screenshot_Telegram",
  "type": "n8n-nodes-base.telegram",
  "parameters": {
    "resource": "message",
    "operation": "sendPhoto",
    "chatId": "={{ $node['Emit_Chart_Actions'].json.chat_id }}",
    "binaryData": true,
    "binaryPropertyName": "data",
    "caption": "={{ $node['Emit_Chart_Actions'].json.caption }}"
  }
}
```

---

## 常见问题

### Q1: 截图是黑的
**A**: 增加wait_for_timeout到15000ms

### Q2: 截图不完整
**A**: 设置full_page: true

### Q3: API调用失败
**A**: 检查URL是否正确encode，使用`encodeURIComponent()`

### Q4: N8N报错"Binary data expected"
**A**: 确保Screenshot节点的Response Format设置为"File"

---

## 测试命令

在Telegram测试以下消息：

```
1. 美股热力图
2. 西班牙IBEX35热力图
3. 纳斯达克100热力图
```

每个都应该返回清晰的热力图截图，而不是黑屏。

---

**需要帮助？** 把N8N的节点配置截图发给我，我可以帮你调试！
