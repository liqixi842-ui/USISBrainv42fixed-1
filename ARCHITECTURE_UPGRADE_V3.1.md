# USIS Brain v3.1 Architecture Upgrade

**升级日期**: 2025-01-05  
**核心理念**: 从"关键词工作流"到"AI智能理解"

---

## 🎯 升级动机

**用户核心反馈**: "我要的是智能不是工作流"

### v3.0存在的问题

1. **符号提取基于正则表达式**
   - `extractSymbols()`使用正则+关键词映射
   - 只能识别预设的股票名称（如"电力公司" → IBE.MC）
   - 无法处理任意公司名称（如"Grifols", "Sabadell"）
   - 国际股票（非美国）识别失败

2. **行业检测基于关键词匹配**
   - 用固定关键词"能源|energy|石油"检测行业
   - 无法智能理解语义（如"银行板块" vs "金融行业"）
   - 工作流思维，不是AI理解

3. **AI编造数据问题**
   - AI回答"标普500在4300点"（实际5000+）
   - AI回答"IBEX35指数为8000点"（实际12000左右）
   - 原因：AI使用训练数据而非实时数据

4. **缺乏数据来源追踪**
   - 无法验证AI输出的数字来自哪里
   - 没有数据新鲜度评分
   - 无法防止AI编造

---

## 🚀 v3.1 新架构

### 核心原则

**从规则驱动 → AI驱动**

```
v3.0: 用户输入 → 正则提取符号 → 关键词检测行业 → AI分析（可能编造）
v3.1: 用户输入 → AI理解意图 → Finnhub查找符号 → 数据代理 → AI分析（强制引用数据） → 合规验证
```

### 五层智能架构

#### Stage 0: Schema定义 (schemas.js)

定义系统中所有结构化数据：

- **Intent Schema**: 用户意图的标准化表示
  - intentType: stock_query, sector_heatmap, index_query, etc.
  - entities: 提取的实体（公司、符号、行业等）
  - exchange: 交易所提示（US, Spain, HK等）
  - sector: GICS 11大行业分类
  - confidence: 置信度评分

- **Data Request Schema**: 数据请求规范
  - symbols: 股票代码列表
  - dataTypes: 需要的数据类型
  - heatmapParams: 热力图参数

- **Analyst Input Schema**: 传给AI的数据格式
  - marketData: 带来源和时间戳的市场数据
  - metadata: 数据来源、新鲜度、完整性

#### Stage 1: 语义意图理解Agent (semanticIntentAgent.js)

**关键创新**: 用AI理解用户意图，而非正则表达式

```javascript
// v3.0: 关键词匹配
if (text.includes('热力图') || text.includes('heatmap')) {
  intent.needsHeatmap = true;
}

// v3.1: AI理解
const intent = await parseUserIntent(userText, userHistory);
// AI理解："西班牙能源热力图" → {
//   intentType: 'sector_heatmap',
//   exchange: 'Spain',
//   sector: 'energy',
//   confidence: 0.9
// }
```

**功能**:
- 调用GPT-4o-mini进行快速意图理解
- 返回结构化JSON（intentType, entities, mode, exchange, sector）
- 利用用户历史上下文
- 支持中文、英文、西班牙语

#### Stage 2: 股票代码解析器 (symbolResolver.js)

**关键创新**: 用Finnhub Symbol Lookup API查找股票代码

```javascript
// v3.0: 硬编码映射
const mapping = { '电力公司': 'IBE.MC', 'Grifols': ??? };  // 无法覆盖所有

// v3.1: 实时查找
const results = await lookupSymbol('Grifols', 'Spain');
// Finnhub返回: GRF.MC, Grifols S.A., Madrid Stock Exchange
```

**功能**:
- 集成Finnhub Symbol Lookup API
- 智能匹配算法（交易所优先、名称相似度）
- 支持全球市场（US, Spain, HK, CN, EU等）
- 静态映射表作为备用方案

#### Stage 3: 数据代理+反编造机制 (dataBroker.js)

**关键创新**: 为每个数据点附加来源和时间戳

```javascript
// v3.0: 简单返回数据
const price = await fetchPrice(symbol);

// v3.1: 带元数据的数据
const quote = {
  currentPrice: 146.08,
  change: -2.15,
  changePercent: -1.45,
  timestamp: 1704467890000,
  source: 'finnhub',
  freshnessScore: 0.95,  // 新鲜度评分
  dataAgeMinutes: 5
};
```

**功能**:
- 中心化API调用（Finnhub, Alpha Vantage等）
- 数据新鲜度评分（0-1，基于时间）
- 数据质量评估
- 数据来源追踪（provider, endpoint, timestamp）
- 缺失字段明确标记

#### Stage 4: 重写分析Prompt (analysisPrompt.js)

**关键创新**: 强制AI只使用实时数据

```javascript
// v3.0: 没有明确禁止使用训练数据
const prompt = `分析以下股票...`;

// v3.1: 强制数据引用
const prompt = `
⚠️ 严格数据使用规则：
1. 禁止使用任何训练数据
2. 当你提到任何数字时，必须确保该数字存在于提供的数据中
3. 如果数据中没有某个值，你必须说"数据未提供"

========================================
📊 实时市场数据（这是你唯一可以使用的数据源）
========================================

【AAPL】
  - 当前价格: $150.25
  - 涨跌幅: +1.25%
  - 数据时间: 2025-01-05T14:30:00Z
  - 数据来源: finnhub
  - 新鲜度评分: 95%
...
`;
```

**功能**:
- 在prompt开头明确禁止使用训练数据
- 注入完整的数据（价格、时间戳、来源）
- 包含验证检查清单
- 数据缺失时明确说明

#### Stage 5: 合规守卫 (complianceGuard.js)

**关键创新**: 验证AI输出的数字是否存在于数据中

```javascript
// v3.1: 输出验证
const validation = validateResponse(aiResponse, marketData);
if (!validation.valid) {
  console.warn('AI编造了数字:', validation.violations);
  // 要求AI重新生成或返回错误
}
```

**功能**:
- 提取AI响应中的所有数字
- 与原始数据对比（允许±1%误差）
- 识别常见非市场数字（时间、日期等）
- 生成修正建议

---

## 🔄 集成到index.js

### 修改点

1. **Line 7-12**: 导入新模块
```javascript
const { parseUserIntent } = require("./semanticIntentAgent");
const { resolveSymbols } = require("./symbolResolver");
const { fetchMarketData, validateDataForAnalysis } = require("./dataBroker");
const { buildAnalysisPrompt, buildErrorResponse } = require("./analysisPrompt");
const { validateResponse } = require("./complianceGuard");
```

2. **Line 2865-2905**: 替换意图理解逻辑
```javascript
// 旧: extractSymbols(text) + understandIntent()
// 新: parseUserIntent() + resolveSymbols()
```

3. **数据采集**: 使用新的dataBroker（TODO）
4. **AI分析**: 使用新的analysisPrompt（TODO）
5. **输出验证**: 使用complianceGuard（TODO）

### 兼容性保证

- 保留旧的`extractSymbols`和`understandIntent`作为降级方案
- 当新系统失败时，自动回退到旧逻辑
- 确保现有功能不受影响

---

## 📊 预期改进

### 1. 符号识别准确率

| 场景 | v3.0 | v3.1 |
|------|------|------|
| 美国股票 ("AAPL") | ✅ 100% | ✅ 100% |
| 西班牙股票 ("IBE.MC") | ✅ 100% | ✅ 100% |
| 中文映射 ("电力公司") | ✅ 有限支持 | ✅ 100% |
| 任意公司名 ("Grifols") | ❌ 0% | ✅ 95%+ |
| 简称 ("sab" = Sabadell) | ❌ 0% | ✅ 85%+ |

### 2. 行业识别智能化

| 场景 | v3.0 | v3.1 |
|------|------|------|
| "能源热力图" | ✅ 关键词匹配 | ✅ AI理解 |
| "银行板块" | ❌ 无法识别 | ✅ 映射到financials |
| "科技股" | ✅ 关键词匹配 | ✅ AI理解 |
| "金融行业" | ❌ 无法识别 | ✅ 映射到financials |

### 3. 数据准确性

| 指标 | v3.0 | v3.1 |
|------|------|------|
| 数据来源追踪 | ❌ 无 | ✅ 有（provider + timestamp） |
| 新鲜度评分 | ❌ 无 | ✅ 有（0-1评分） |
| AI编造检测 | ❌ 无 | ✅ 有（合规守卫） |
| 数据缺失处理 | ⚠️  可能编造 | ✅ 明确说明 |

---

## 🧪 测试计划

### 测试用例

1. **国际股票识别**
   - "Grifols股票怎么样" → 应识别为GRF.MC
   - "帮我解析西班牙sab股票带走势图" → 应识别为SAB.MC（Sabadell）

2. **行业板块热力图**
   - "西班牙银行板块热力图" → 应返回financials板块，不是整个IBEX35
   - "西班牙能源热力图" → 应返回energy板块

3. **数据准确性**
   - "标普500今天怎么样" → 应显示真实指数值（5000+），不是4300
   - "IBEX35指数" → 应显示真实值（12000左右），不是8000

4. **数据缺失处理**
   - 无效股票代码 → 应明确说"无法获取数据"，不编造

---

## 📝 下一步

1. ✅ 完成Stage 0-5模块
2. ✅ 集成意图理解到index.js
3. 🚧 集成数据采集到index.js
4. 🚧 集成AI分析prompt到index.js
5. 🚧 集成合规守卫到index.js
6. 🧪 测试所有用例
7. 📊 性能优化

---

## 🎓 架构哲学

**v3.0思维**: 
- "如果用户说X，那么做Y"（if-else规则）
- 关键词匹配、正则表达式
- 工作流驱动

**v3.1思维**:
- "让AI理解用户想要什么"（语义理解）
- LLM驱动、API查找
- 智能驱动

---

**总结**: USIS Brain v3.1是从"编程式工作流"到"AI智能理解"的根本性转变，真正实现了"智能"而非"工作流"。
