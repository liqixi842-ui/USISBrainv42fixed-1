# 🧠 Brain + N8N 器官协作架构

## 核心理念

**USIS Brain = 大脑（决策中心）**  
**N8N Workflows = 器官（执行系统）**  
**Telegram = 神经系统（输入/输出）**

---

## 🎯 架构设计

### 传统流水线模式（旧）❌
```
用户 → Telegram → N8N → Brain → 返回文字
                    ↓
              (固定调用A_Screenshot)
```
**问题**: 流水线固定，无法灵活响应用户需求

### 器官协作模式（新）✅
```
用户："盘前带热力图"
  ↓
Telegram → N8N
  ↓
N8N → Brain.orchestrate({"text": "盘前带热力图"})
  ↓
Brain分析 → 返回指令集:
{
  "final_analysis": "分析文本...",
  "actions": [
    {
      "type": "fetch_heatmap",
      "tool": "A_Screenshot",
      "url": "https://...",
      "reason": "用户要求热力图"
    }
  ]
}
  ↓
N8N看到actions → 执行A_Screenshot → 下载图片
  ↓
N8N组合：文字 + 图片 → 发送Telegram
```

---

## 🔧 Brain已支持的Action类型

### 1. fetch_heatmap（热力图截图）
**触发关键词**: 热力图、heatmap、截图、图表、可视化、带图

**Brain返回**:
```json
{
  "type": "fetch_heatmap",
  "tool": "A_Screenshot",
  "url": "https://www.tradingview.com/heatmap/stock/#...",
  "reason": "用户要求热力图"
}
```

**N8N执行**:
- 调用现有的 `A_Screenshot` 节点
- 使用返回的URL参数
- 下载图片到本地

---

### 2. fetch_news_rss（深度新闻爬取）
**触发关键词**: 深度新闻、详细资讯、news detail、爬取

**Brain返回**:
```json
{
  "type": "fetch_news_rss",
  "tool": "C_RSS_News",
  "reason": "用户需要深度新闻爬取"
}
```

**N8N执行**:
- 调用 `C_RSS_News` 节点
- 爬取Google News RSS
- 返回新闻列表

---

### 3. fetch_twitter（Twitter情绪分析）
**触发关键词**: 推特、twitter、社交、sentiment、情绪

**Brain返回**:
```json
{
  "type": "fetch_twitter",
  "tool": "Twitter_Search",
  "reason": "用户需要社交媒体情绪"
}
```

**N8N执行**:
- 调用Twitter API
- 获取相关股票的推文
- 计算情绪指数

---

### 4. generate_image（AI图片生成）
**触发关键词**: 生成图、画图、generate image、create chart

**Brain返回**:
```json
{
  "type": "generate_image",
  "tool": "/img/imagine",
  "reason": "用户需要AI生成图片"
}
```

**N8N执行**:
- 调用Brain的 `/img/imagine` endpoint
- 生成自定义图表
- 返回图片URL

---

## 📋 N8N Workflow修改指南

### Step 1: 接收Brain响应
在N8N中调用Brain后，检查返回的 `actions` 字段：

```javascript
// N8N Code节点
const brainResponse = $json;
const actions = brainResponse.actions || [];
const hasHeatmap = actions.some(a => a.type === 'fetch_heatmap');
const hasTwitter = actions.some(a => a.type === 'fetch_twitter');

return [{
  json: {
    ...brainResponse,
    needs_screenshot: hasHeatmap,
    needs_twitter: hasTwitter
  }
}];
```

---

### Step 2: 条件分支执行
使用N8N的 `IF` 节点创建分支：

```javascript
// IF节点条件
{{ $json.needs_screenshot === true }}
```

**True分支**: 调用 `A_Screenshot`  
**False分支**: 跳过截图

---

### Step 3: 动态URL参数
截图节点使用Brain返回的URL：

```javascript
// A_Screenshot节点的URL字段
{{ 
  $node["Brain_Response"].json.actions
    .find(a => a.type === 'fetch_heatmap')?.url 
  || 'https://www.tradingview.com/heatmap/stock/...' 
}}
```

---

## 🧪 测试用例

### 测试1: 普通盘前（无图）
```bash
POST /brain/orchestrate
{
  "text": "盘前TSLA",
  "chat_type": "private"
}
```

**预期响应**:
```json
{
  "final_analysis": "分析文本...",
  "actions": []  // 空数组，N8N不执行额外操作
}
```

---

### 测试2: 盘前+热力图
```bash
POST /brain/orchestrate
{
  "text": "盘前带热力图",
  "chat_type": "private"
}
```

**预期响应**:
```json
{
  "final_analysis": "分析文本...",
  "actions": [
    {
      "type": "fetch_heatmap",
      "tool": "A_Screenshot",
      "url": "https://www.tradingview.com/heatmap/...",
      "reason": "用户要求热力图"
    }
  ]
}
```

**N8N行为**:
1. 收到响应，看到 `actions[0].type === 'fetch_heatmap'`
2. 触发 `A_Screenshot` 节点
3. 下载热力图
4. 组合文字+图片发送

---

### 测试3: 新闻+Twitter情绪
```bash
POST /brain/orchestrate
{
  "text": "TSLA今日新闻和Twitter情绪",
  "chat_type": "private"
}
```

**预期响应**:
```json
{
  "final_analysis": "新闻列表...",
  "actions": [
    {
      "type": "fetch_twitter",
      "tool": "Twitter_Search",
      "reason": "用户需要社交媒体情绪"
    }
  ],
  "symbols": ["TSLA"]
}
```

**N8N行为**:
1. 调用 `Twitter_Search` API
2. 搜索 "TSLA" 相关推文
3. 计算情绪分数
4. 添加到最终消息

---

## 🎨 N8N Workflow示例代码

### 完整流程示例

```json
{
  "nodes": [
    {
      "name": "Telegram_Trigger",
      "type": "n8n-nodes-base.telegramTrigger"
    },
    {
      "name": "Call_Brain",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "POST",
        "url": "https://node-js-liqixi842.replit.app/brain/orchestrate",
        "body": {
          "text": "={{ $json.message.text }}",
          "chat_type": "{{ $json.message.chat.type === 'private' ? 'private' : 'group' }}"
        },
        "timeout": 90000
      }
    },
    {
      "name": "Parse_Actions",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "jsCode": `
          const brain = $json;
          const actions = brain.actions || [];
          
          return [{
            json: {
              text: brain.final_analysis,
              needs_heatmap: actions.some(a => a.type === 'fetch_heatmap'),
              needs_twitter: actions.some(a => a.type === 'fetch_twitter'),
              heatmap_url: actions.find(a => a.type === 'fetch_heatmap')?.url,
              symbols: brain.symbols
            }
          }];
        `
      }
    },
    {
      "name": "IF_Needs_Heatmap",
      "type": "n8n-nodes-base.if",
      "parameters": {
        "conditions": {
          "boolean": [
            {
              "value1": "={{ $json.needs_heatmap }}",
              "value2": true
            }
          ]
        }
      }
    },
    {
      "name": "A_Screenshot",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "={{ $json.heatmap_url }}"
      }
    },
    {
      "name": "Send_Telegram",
      "type": "n8n-nodes-base.telegram",
      "parameters": {
        "text": "={{ $json.text }}",
        "additionalFields": {
          "photo": "={{ $json.screenshot_url }}"
        }
      }
    }
  ]
}
```

---

## 📊 响应字段完整说明

### Brain Response Structure

```typescript
interface BrainResponse {
  ok: boolean;
  final_analysis: string;  // 最终分析文本
  image_url: string | null;
  
  // 🎯 核心新增字段
  actions: Action[];  // 指令列表
  
  intent: {
    mode: 'premarket' | 'intraday' | 'postmarket' | 'diagnose' | 'news';
    lang: string;
    confidence: number;
  };
  
  scene: {
    name: string;
    depth: 'brief' | 'medium' | 'deep';
    targetLength: number;
  };
  
  symbols: string[];  // 自动提取的股票代码
  
  market_data: {
    collected: boolean;
    summary: string;
    data: {
      quotes: Array<{symbol, current, change, changePercent}>;
      news: Array<{headline, summary, source, url}>;
    };
  } | null;
  
  response_time_ms: number;
}

interface Action {
  type: 'fetch_heatmap' | 'fetch_news_rss' | 'fetch_twitter' | 'generate_image';
  tool: string;  // N8N节点名称或API endpoint
  url?: string;  // 可选的URL参数
  reason: string;  // 为什么需要这个动作
}
```

---

## 🚀 下一步扩展

### 未来可添加的Action类型

1. **fetch_earnings** - 财报日历
   - 触发词: "财报日历"、"earnings calendar"
   - 调用: Alpha Vantage Earnings API

2. **fetch_sentiment_deep** - 深度情绪分析
   - 触发词: "深度情绪"、"full sentiment"
   - 调用: 多源情绪聚合（Reddit + Twitter + News）

3. **generate_technical_chart** - 技术图表
   - 触发词: "K线图"、"技术图"
   - 调用: TradingView Chart API

4. **fetch_insider_trading** - 内部交易数据
   - 触发词: "内部交易"、"insider trading"
   - 调用: SEC Filing API

---

## 💡 最佳实践

### DO ✅
- 让Brain负责意图理解和决策
- 让N8N负责具体执行（API调用、截图、发送）
- 使用actions字段实现灵活协作
- 每个Action提供清晰的reason说明

### DON'T ❌
- 不要在N8N中硬编码意图检测逻辑
- 不要绕过Brain直接调用工具
- 不要忽略actions字段
- 不要创建固定流水线

---

**文档版本**: v3.2 (器官协作架构)  
**更新日期**: 2025-11-03  
**Brain Endpoint**: https://node-js-liqixi842.replit.app/brain/orchestrate
