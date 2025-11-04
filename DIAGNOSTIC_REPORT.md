# USIS Brain 问题诊断与修复报告

## 📊 测试结果总览

| 功能 | 状态 | 详情 |
|------|------|------|
| Skip逻辑 | ✅ 已修复 | "预览下宏观数据"正常返回纯文字 |
| 个股K线图 | ✅ 正常 | NVDA图表完美显示 |
| AI文字分析 | ✅ 正常 | 所有请求都有分析返回 |
| 热力图显示 | ❌ 黑屏 | TradingView Widget未加载 |
| 价格数据 | ⚠️ 轻微不一致 | 图表vs文字有差异 |

---

## 🐛 问题1：热力图黑屏（严重）

### 根本原因
1. **服务器domain不可访问**
   - Brain生成的URL：`https://3a420d76-4b61-4eda-b642-da18f4a05ba5-00-1c70dqauwfcxs.janeway.replit.dev/heatmap?...`
   - 测试结果：返回"Hmm... We couldn't reach this app"
   - **原因**：Replit domain配置问题或服务未绑定到该domain

2. **TradingView Widget在Telegram中无法执行**
   - 即使HTML能加载，Telegram WebView不支持复杂JavaScript
   - TradingView的嵌入式Widget需要JavaScript才能渲染
   - 结果：黑屏

### 影响
- ❌ 用户请求"美股热力图"时收到黑色图片
- ❌ 所有市场的热力图都无法显示
- ❌ 影响用户体验

### 解决方案（3个选项）

#### 方案A：使用Puppeteer截图（推荐）
```javascript
// 在N8N中，A_Screenshot节点应该：
1. 接收Brain返回的heatmap URL
2. 使用Puppeteer打开页面
3. 等待TradingView Widget加载完成
4. 截图并发送到Telegram
```

**优点**：
- ✅ 可以渲染TradingView Widget
- ✅ 获得真实的可视化图表
- ✅ 不需要修改Brain代码

**缺点**：
- ⚠️ 需要配置Puppeteer（可能在N8N中已有）
- ⚠️ 加载时间较长（5-10秒）

#### 方案B：使用QuickChart生成静态图表
```javascript
// 在Brain中，替换TradingView为QuickChart
const chartUrl = `https://quickchart.io/chart?...`;
```

**优点**：
- ✅ 不需要JavaScript，纯图片
- ✅ 加载速度快
- ✅ Telegram直接支持

**缺点**：
- ❌ 不如TradingView专业
- ❌ 需要重新实现热力图逻辑

#### 方案C：修复Replit domain配置
```bash
# 确保服务绑定到正确的domain
# 检查REPLIT_DOMAINS环境变量
```

**优点**：
- ✅ 修复根本问题

**缺点**：
- ❌ 仍然无法解决Telegram WebView不支持JavaScript的问题

---

## 🐛 问题2：AI价格数据轻微不一致

### 观察到的差异
- **TradingView图表显示**：NVDA $206.88 (-2.1680%)
- **AI文字分析说**："今天NVDA的盘前价格是200.24，跌幅达到了3.21%"

### 可能原因
1. **不同时间点的数据**
   - TradingView显示实时收盘价
   - AI可能使用了盘前数据
   
2. **数据未正确注入prompt**
   - 虽然添加了日志，但未验证marketData是否真的传递给AI

3. **AI仍在编造数据**
   - 如果marketData.summary为空，AI会根据记忆或训练数据编造

### 诊断方法
需要查看Brain日志中的以下内容：
```
📊 开始采集市场数据: NVDA
📊 市场数据采集结果:
   - collected: true/false
   - summary长度: XXX字
   - quotes数量: X
   - summary预览: NVDA: 当前$XXX, 涨跌+/-X.XX%...
✅ 实时数据已注入AI prompt (XXX字)
```

**如果日志显示**：
- `collected: false` → Finnhub API调用失败
- `summary长度: 0字` → 数据采集成功但格式化失败
- `⚠️ 实时数据未注入` → 数据未传递给AI

### 解决方案
1. **启动服务器并查看日志**
   ```bash
   node index.js
   # 然后在Telegram发送"NVDA"
   # 查看控制台输出
   ```

2. **验证Finnhub API**
   ```bash
   curl "https://finnhub.io/api/v1/quote?symbol=NVDA&token=${FINNHUB_API_KEY}"
   ```

3. **强制AI使用实时数据**
   - 在prompt中明确要求："以下是Finnhub实时数据，必须使用："
   - 添加数据验证：如果summary为空，直接返回错误而不是让AI编造

---

## ✅ 已修复的问题

### 1. Skip逻辑修复
**问题**：
- "预览下宏观数据"请求时，Brain返回skip:true
- 但N8N仍然执行Send_Chart_Photo节点
- 导致Telegram报错："请求中没有照片"

**修复**：
```javascript
// Emit_Chart_Actions节点（N8N）
// 修改前：
return [{ json: { skip: true } }];  // ❌ 后续节点仍会执行

// 修改后：
return [];  // ✅ 后续节点不执行
```

**测试结果**：✅ 成功
- "预览下宏观数据" → 纯文字返回
- 无错误消息
- Skip逻辑正常工作

---

## 📋 下一步行动

### 立即行动（高优先级）

#### 1. 修复热力图黑屏
**选择方案A**（使用Puppeteer截图）：

在N8N中配置A_Screenshot节点：
```javascript
// 节点配置
Operation: Screenshot
URL: {{ $json.url }}  // 从Brain的action.url获取
Wait for Selector: .tradingview-widget-container__widget
Timeout: 15000
Full Page: true
```

#### 2. 验证数据流
启动服务器并测试：
```bash
# 1. 启动Brain
node index.js

# 2. 在Telegram发送测试消息
"NVDA"

# 3. 查看控制台日志
# 确认看到：
# - 📊 开始采集市场数据: NVDA
# - ✅ 实时数据已注入AI prompt
```

#### 3. 如果数据仍然错误
检查collectMarketData函数：
```javascript
// 确保返回正确的数据结构
{
  collected: true,
  data: { quotes: {...}, news: {...} },
  summary: "NVDA: 当前$206.88, 涨跌-2.17%..." // 必须有这个
}
```

### 后续优化（低优先级）

1. **添加数据验证**
   - 如果marketData.summary为空，返回明确的错误
   - 不让AI在没有数据时编造

2. **改进热力图方案**
   - 考虑使用QuickChart替代TradingView（更可靠）
   - 或者实现服务器端渲染

3. **完善日志系统**
   - 保存每次请求的日志到文件
   - 方便追踪问题

---

## 🎯 总体评估

### 已解决 (1/3)
- ✅ Skip逻辑修复

### 部分解决 (0.5/3)
- ⚠️ 数据调试日志已添加（但未验证是否修复编造问题）

### 未解决 (1.5/3)
- ❌ 热力图黑屏
- ❌ AI数据编造问题未根本解决

### 进度：约50%

---

## 💡 建议

1. **先修复热力图**（用户最可见的问题）
   - 配置N8N的Puppeteer截图
   - 或暂时禁用热力图功能

2. **然后验证数据流**
   - 启动服务器
   - 查看日志
   - 确认Finnhub数据正确传递给AI

3. **最后完善体验**
   - 添加错误处理
   - 改进响应速度
   - 优化成本

---

**需要我先修复哪个问题？**
1. 热力图黑屏（需要配置N8N Puppeteer）
2. 数据编造验证（需要查看完整日志）
3. 两者都修（但需要更多信息）
