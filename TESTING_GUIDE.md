# 🧪 USIS Brain v3 测试指南

## 已完成的修复 (2025-11-03)

### ✅ 修复1：实时数据采集（Symbol自动提取）

**改进点**:
- ✅ **大小写不敏感**: 现在"tsla"和"TSLA"都能识别
- ✅ **扩展黑名单**: 过滤GDP、CPI、PM、AM等非股票词
- ✅ **自动提取**: 无需手动传symbols参数

**测试用例**:

```bash
# 测试1: 小写股票代码
POST /brain/orchestrate
Body: {"text": "盘前tsla", "chat_type": "private"}
预期: symbols=["TSLA"], market_data.collected=true

# 测试2: 多个股票
POST /brain/orchestrate
Body: {"text": "nvda和aapl怎么样", "chat_type": "private"}
预期: symbols=["NVDA", "AAPL"], 两只股票的实时数据

# 测试3: 中英文混合
POST /brain/orchestrate
Body: {"text": "特斯拉TSLA今天走势", "chat_type": "private"}
预期: symbols=["TSLA"]
```

---

### ✅ 修复2：新闻模式（部分完成）

**改进点**:
- ✅ GPT-4现在返回新闻列表（而非投资分析）
- ⚠️ 其他5个AI仍需适配（后续工作）

**测试用例**:

```bash
# 测试1: 纯新闻请求
POST /brain/orchestrate
Body: {"text": "今日热点新闻", "chat_type": "private"}
预期: mode="news", 返回新闻列表格式

# 测试2: 股票新闻
POST /brain/orchestrate
Body: {"text": "tsla最新资讯", "chat_type": "private"}
预期: mode="news", symbols=["TSLA"], 返回TSLA相关新闻
```

---

## N8N Webhook配置

### 正确的请求格式

```json
{
  "text": "{{ $json.message.text }}",
  "chat_type": "{{ $json.message.chat.type === 'private' ? 'private' : 'group' }}",
  "user_id": "{{ $json.message.from.id }}"
}
```

**关键点**:
- ❌ 不再需要手动传`symbols`字段
- ✅ 系统会自动从`text`中提取股票代码
- ✅ 支持小写、中文混合

### 响应字段映射

**新字段**:
- `symbols`: 自动提取的股票列表
- `market_data.collected`: 是否成功获取实时数据
- `market_data.data.quotes`: 实时行情数组
- `market_data.summary`: 数据摘要文本

**N8N使用**:
```javascript
// 获取最终分析文本
$json.final_analysis

// 获取股票代码列表
$json.symbols.join(', ')

// 检查是否有实时数据
$json.market_data.collected ? '有实时数据' : '无数据'
```

---

## 快速测试脚本

### 使用curl测试

```bash
# Production endpoint
ENDPOINT="https://node-js-liqixi842.replit.app"

# 测试1: Symbol自动提取（小写）
curl -X POST $ENDPOINT/brain/orchestrate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "盘前tsla",
    "chat_type": "private"
  }'

# 测试2: 新闻模式
curl -X POST $ENDPOINT/brain/orchestrate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "今日热点新闻",
    "chat_type": "private"
  }'

# 测试3: 多股票中文
curl -X POST $ENDPOINT/brain/orchestrate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "帮我看看nvda和amd",
    "chat_type": "group"
  }'
```

---

## 预期结果

### 成功指标

**数据采集**:
- ✅ `symbols`数组非空
- ✅ `market_data.collected = true`
- ✅ `market_data.data.quotes`包含实时价格
- ✅ AI分析中出现真实价格（非编造）

**新闻模式**:
- ✅ `intent.mode = "news"`
- ✅ `final_analysis`包含新闻列表格式
- ✅ 输出包含"【标题】"等结构化标记
- ✅ 没有BUY/HOLD/SELL等投资建议

---

## 已知限制

### Symbol提取黑名单
以下词汇会被过滤（不会被识别为股票）:
```
US, USD, PM, AM, ET, PT, NY, LA, SF
AI, EV, IPO, CEO, CFO, CTO, API
GDP, CPI, PPI, PMI, FED, SEC, DOW, FX, VIX
THE, AND, FOR, ARE, BUT, NOT, YOU, ALL, CAN...
```

### 新闻模式未完全适配
- ✅ GPT-4: 返回新闻列表
- ⏳ Claude: 仍返回技术分析（待修复）
- ⏳ DeepSeek: 仍返回市场情绪（待修复）
- ⏳ Gemini: 仍返回实时分析（待修复）
- ⏳ Perplexity: 仍返回深度研究（待修复）
- ⏳ Mistral: 仍返回风险评估（待修复）

**结果**: 新闻模式下，最终输出会混合新闻和分析内容

---

## 故障排查

### 问题：market_data.collected = false

**可能原因**:
1. 用户消息中没有识别到股票代码
2. 提取的代码在黑名单中（如PM、AI）
3. Finnhub/Alpha Vantage API调用失败

**排查步骤**:
```bash
# 检查symbols是否提取成功
curl -X POST $ENDPOINT/brain/intent \
  -H "Content-Type: application/json" \
  -d '{"text": "你的消息"}'
# 看symbols字段是否非空

# 检查API key
curl $ENDPOINT/health
# 确保服务正常
```

### 问题：仍返回投资分析而非新闻

**原因**: 
- 其他5个AI仍未适配新闻模式
- Synthesis逻辑会混合所有AI输出

**临时方案**:
- 关注GPT-4的输出（已修复）
- 后续版本会完整适配

---

## 下一步开发计划

1. ⏳ **完成新闻模式**: 修改其他5个AI的prompt
2. ⏳ **集成图片生成**: 检测"热力图"等关键词时调用`/img/imagine`
3. ⏳ **增强Symbol提取**: 支持.DOT后缀（如BRK.A）
4. ⏳ **添加缓存层**: 避免重复调用昂贵的AI API

---

**测试环境**: https://node-js-liqixi842.replit.app  
**文档更新**: 2025-11-03  
**版本**: v3.1 (数据帝国层修复版)
