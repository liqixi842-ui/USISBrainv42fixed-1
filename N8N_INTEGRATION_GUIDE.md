# N8N工作流集成指南 - 图表发送功能

## 📋 概述
Brain现在会在响应中输出`actions`数组，包含需要发送的图表。N8N需要新增节点来处理这些actions。

---

## 🔧 N8N工作流修改方案

### 当前工作流
```
Telegram接收 → HTTP Request到Brain → Telegram发送文字
```

### 修改后工作流
```
Telegram接收 
  → HTTP Request到Brain 
  → [新增] IF节点：检查是否有actions
      → [新增] Loop节点：遍历actions数组
          → [新增] IF节点：检查action.type === 'send_chart'
              → [新增] Telegram Send Photo：发送图表
  → Telegram发送文字（现有节点）
```

---

## 📝 详细步骤

### 步骤1：在"HTTP Request到Brain"节点后添加IF节点

**节点名称**: `检查是否有图表`

**条件配置**:
```
条件类型: JavaScript Expression
表达式: {{ $json.actions && $json.actions.length > 0 }}
```

**说明**: 检查Brain返回的响应中是否有actions数组且不为空

---

### 步骤2A：添加Loop节点（True分支）

**节点名称**: `遍历图表列表`

**配置**:
- Loop Mode: `Loop Over Items`
- Input Field Name: `actions`
- Batch Size: `1`

**说明**: 遍历每个action项

---

### 步骤3A：添加IF节点（在Loop内）

**节点名称**: `检查是否为图表动作`

**条件配置**:
```
条件类型: JavaScript Expression
表达式: {{ $json.type === 'send_chart' }}
```

---

### 步骤4A：添加Telegram Send Photo节点（True分支）

**节点名称**: `发送图表到Telegram`

**配置**:
- Credential: 你的Telegram Bot凭证
- Chat ID: `{{ $node["Telegram Trigger"].json["message"]["chat"]["id"] }}`
- Photo: `{{ $json.url }}`（使用URL方式）
- Caption: `{{ $json.caption }}`
- Parse Mode: `HTML` 或 `Markdown`

**说明**: 使用QuickChart生成的URL发送图片

---

### 步骤2B：继续流向文字发送（False分支）

现有的"Telegram发送文字"节点保持不变，连接到IF节点的False分支。

---

## 📊 Brain输出格式示例

Brain会返回这样的JSON：

```json
{
  "version": "USIS.v3",
  "status": "success",
  "answer": "当前CPI为3.2%，较上月上涨0.1%...",
  "actions": [
    {
      "type": "send_chart",
      "metric": "CPIAUCSL",
      "url": "https://quickchart.io/chart?c=%7B%22type%22%3A%22line%22...",
      "caption": "📈 CPIAUCSL 最近走势（智能生成）"
    }
  ],
  "levels": {
    "l1": { ... },
    "l2": {
      "visualIntent": {
        "needChart": true,
        "metrics": ["CPIAUCSL"],
        "style": "single",
        "reason": "rule-min"
      }
    }
  }
}
```

---

## 🧪 测试场景

完成配置后，向Bot发送以下消息测试：

### 测试1：应该发送1张图
```
CPI最近趋势怎么样？
```
**期望**: 先收到1张CPI图表，然后收到文字分析

### 测试2：不应该发送图
```
预览下宏观数据
```
**期望**: 只收到文字总览，无图表

### 测试3：应该发送1张图
```
失业率上升了吗？
```
**期望**: 先收到1张失业率图表，然后收到文字分析

---

## 🎯 核心优势

1. **智能决策**: Brain根据用户意图决定是否发图，N8N只负责执行
2. **脑体分离**: Brain=决策中心，N8N=执行中心
3. **灵活扩展**: 未来可支持多图、对比图，只需Brain升级
4. **成本优化**: 不需要图表时不生成，节省QuickChart配额

---

## ⚠️ 注意事项

1. **URL编码**: QuickChart URL已经过编码，直接使用即可
2. **错误处理**: 建议在"发送图表"节点添加Error Trigger，捕获发送失败的情况
3. **顺序控制**: 如果希望"先发图再发文字"，可以在Loop结束后再连接文字发送节点
4. **Caption长度**: Telegram caption限制1024字符，Brain已自动控制在安全范围

---

## 🔄 可选优化（未来）

### 优化1：批量发送
如果一次请求有多张图，可以使用Telegram的Media Group功能批量发送

### 优化2：图表缓存
对于相同指标的重复请求，可以在N8N中添加缓存节点，避免重复生成

### 优化3：异步发送
如果图表生成耗时，可以先发送"正在生成图表..."，然后异步发送图表

---

## 📞 技术支持

如果遇到问题，检查以下内容：
- Brain响应中是否有`actions`数组（查看N8N执行日志）
- Telegram Bot是否有发送图片的权限
- QuickChart URL是否可访问（复制URL到浏览器测试）
- N8N节点引用路径是否正确（如`$json.url`）
