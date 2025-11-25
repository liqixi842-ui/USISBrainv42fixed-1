# USIS Brain v3.2 混合中枢架构蓝图
## GPT-5作为统一语言前端 + 保留核心数据/算法层

---

## 📐 架构总览

```
Telegram用户输入
    ↓
[L1] 语义理解（保留SemanticIntentAgent）
    ↓
[L2] 数据编排层（保留Orchestrator）
    ├─→ [数据源1] Finnhub实时报价/新闻 ✅保留
    ├─→ [数据源2] ImpactRank评分算法 ✅保留
    ├─→ [数据源3] FRED宏观数据 ✅保留
    ├─→ [数据源4] SEC财报数据 ✅保留
    └─→ [数据源5] Alpha Vantage技术指标 ✅保留
    ↓
[L3] 分析生成层（🔄重构为GPT-5单一出口）
    ├─→ ❌删除：多AI并行投票（Claude/DeepSeek/Gemini等）
    └─→ ✅新增：GPT-5统一生成
    ↓
[L4] 格式化输出（保留ResponseFormatter）
    ↓
n8n → Telegram发送
```

---

## 🔧 分层职责重构表

| 层级 | 组件 | 当前状态 | v3.2调整 | 保留原因 |
|------|------|---------|---------|---------|
| **数据层** | Finnhub API | ✅保留 | 无变化 | GPT-5无法获取实时市场数据 |
| | SEC EDGAR API | ✅保留 | 无变化 | 专有财报数据通道 |
| | FRED API | ✅保留 | 无变化 | 宏观经济数据源 |
| | ImpactRank算法 | ✅保留 | 无变化 | **核心IP**：四维评分公式 |
| | Symbol Resolver | ✅保留 | 增强中文别名字典 | 多语言股票解析能力 |
| **逻辑层** | SemanticIntentAgent | ✅保留 | 简化为intent分类器 | 保留mode/responseMode识别 |
| | Complexity Scorer | ⚠️简化 | 合并到orchestrator | 不再需要多模型选择 |
| | Model Selector | ❌删除 | 统一用GPT-5 | 简化架构 |
| | Data Broker | ✅保留 | 无变化 | 数据源协调与provenance |
| | News Broker | ✅保留 | 无变化 | **核心IP**：新闻聚合+评分 |
| **生成层** | 多AI并行分析 | ❌删除 | → GPT-5单一生成 | 降低延迟和成本 |
| | Synthesis引擎 | ❌删除 | GPT-5原生整合 | 避免二次加工 |
| | Analysis Prompt | 🔄重构 | → GPT-5 System Prompt | 保留anti-hallucination逻辑 |
| | Compliance Guard | ✅保留 | 后置验证 | 确保GPT-5输出数据合规 |
| **输出层** | Response Formatter | ✅保留 | 无变化 | 格式化news/analysis/advice |
| | n8n工作流 | ✅保留 | 无变化 | Telegram集成 |

---

## 🎯 核心改造：L3生成层重构

### 当前架构（v3.1）
```javascript
// ❌ 多AI并行 + 投票合成
const aiResults = await Promise.all([
  callClaude(prompt),
  callDeepSeek(prompt),
  callGPT4(prompt),
  callGemini(prompt),
  callPerplexity(prompt),
  callMistral(prompt)
]);

const synthesis = synthesizeVotes(aiResults); // 二次加工
```

**问题**：
- 延迟：6个API串行等待，P95=16s
- 成本：6次调用叠加（$0.06/次）
- 语义损失：多AI复述导致信息稀释

---

### 目标架构（v3.2）
```javascript
// ✅ GPT-5单一生成 + 函数调用
const marketData = {
  quotes: await fetchFinnhubQuotes(symbols),
  news: await fetchAndRankNews({ symbols, timeWindow: '2h' }),
  sentiment: await getSentimentScore(symbols),
  technicals: await getAlphaVantageTechnicals(symbols),
  sec_filings: await getSECFilings(symbols)
};

const response = await callGPT5({
  systemPrompt: ANALYSIS_PROMPT_V32,
  userQuery: text,
  marketData: marketData, // 所有实时数据
  responseMode: intent.responseMode,
  functions: [
    'calculate_impact_rank',    // ImpactRank算法封装
    'get_macro_indicators',     // FRED数据封装
    'search_sec_filing'         // SEC查询封装
  ]
});
```

**优势**：
- 延迟：单次API调用，预计P95<3s（↓81%）
- 成本：单次GPT-5调用 ~$0.01-0.02（↓60%）
- 质量：GPT-5原生整合，无二次加工损失

---

## 🔀 函数化改造：把算法封装成GPT-5可调用的工具

### 示例：ImpactRank函数化
```javascript
// GPT-5的Function Calling定义
const functions = [
  {
    name: 'calculate_impact_rank',
    description: '计算新闻的ImpactRank评分（0-1），基于四维公式',
    parameters: {
      newsItem: { type: 'object', description: '新闻对象' },
      targetSymbols: { type: 'array', description: '目标股票代码' },
      region: { type: 'string', description: '地区（US/EU/CN）' }
    },
    implementation: async (params) => {
      // 调用你的ImpactRank核心算法
      return calculateImpactRank(
        params.newsItem, 
        params.targetSymbols, 
        params.region
      );
    }
  },
  {
    name: 'get_fred_macro_data',
    description: '获取FRED宏观经济数据（CPI/GDP/失业率等）',
    parameters: {
      indicators: { type: 'array', description: '指标列表' }
    },
    implementation: async (params) => {
      return await collectMacroData({ indicators: params.indicators });
    }
  }
];
```

**GPT-5工作流**：
1. 接收用户问题："AAPL最近两小时有什么重要新闻？"
2. 自动调用 `calculate_impact_rank()` 对新闻评分
3. 基于评分结果生成自然语言输出
4. 无需人工编写投票/合成逻辑

---

## 📊 性能对比预测

| 指标 | v3.1 (多AI并行) | v3.2 (GPT-5单一) | 改善 |
|------|----------------|-----------------|------|
| P50延迟 | 14.5s | 2.0s | ↓86% |
| P95延迟 | 16.4s | 3.5s | ↓79% |
| 单次成本 | $0.06 | $0.015 | ↓75% |
| 语义一致性 | 中（多AI投票） | 高（单一生成） | ↑ |
| 维护复杂度 | 高（6个API） | 低（1个API） | ↓ |

---

## 🛠️ 实施路线图

### Phase 1：最小改动验证（1-2天）
**目标**：用GPT-5替换synthesis节点，保留其他所有逻辑

```javascript
// 修改点：仅替换L3生成层
const aiResults = await callGPT5Single({
  prompt: generateAnalysisPrompt(marketData, intent),
  temperature: 0.3
});

// 保留ComplianceGuard验证
const validated = validateResponse(aiResults.text, marketData);
```

**验证指标**：
- 延迟 < 5s
- 成本 < $0.03/次
- 质量主观评估（对比v3.1的5个测试用例）

---

### Phase 2：函数化改造（3-5天）
**目标**：把ImpactRank/FRED/SEC封装成GPT-5函数

```javascript
// 新增：函数注册系统
const functionRegistry = {
  calculate_impact_rank: newsBroker.calculateImpactRank,
  get_fred_data: fredAPI.collectMacroData,
  search_sec_filing: secAPI.searchFilings
};

// GPT-5调用
const response = await openai.chat.completions.create({
  model: 'gpt-5-turbo',
  messages: [...],
  functions: Object.keys(functionRegistry).map(toOpenAIFunction),
  function_call: 'auto'
});
```

---

### Phase 3：清理冗余代码（1天）
**删除**：
- `multiAIAnalysis()` - 6个并行AI调用
- `synthesizeAIOutputs()` - 投票合成逻辑
- `modelSelector.js` - 模型选择器
- `complexityScorer.js` - 复杂度评分（GPT-5自适应）

**保留**：
- `newsBroker.js` ✅
- `dataBroker.js` ✅
- `complianceGuard.js` ✅
- `responseFormatter.js` ✅
- `symbolResolver.js` ✅

---

## 🔐 核心竞争力保护

### 你的护城河（GPT-5无法替代）
1. **ImpactRank评分算法** - 封装成黑盒函数，GPT-5只能调用
2. **实时数据通道** - Finnhub/SEC/FRED直连
3. **用户画像系统** - PostgreSQL存储的用户偏好/历史
4. **中文股票别名库** - 台积电/特斯拉等映射表
5. **n8n工作流编排** - Telegram集成与触发逻辑

### GPT-5的定位
- 不是"替代品"，而是"更好的嘴巴"
- 负责理解和表达，不负责决策和数据
- 你控制它的输入（数据）和约束（System Prompt），它只是执行者

---

## 💰 商业影响

### 成本优化
- **当前**：6个AI × $0.01/次 = $0.06/次
- **v3.2**：1个GPT-5 × $0.015/次 = $0.015/次
- **月度节省**（1000用户 × 10次/天）：$13,500 → $4,500（↓67%）

### 用户体验
- **响应速度**：16s → 3s（用户不会流失）
- **质量一致性**：避免多AI观点冲突
- **可解释性**：单一AI更容易追溯逻辑

---

## 🎯 下一步行动

### 选项A：立即开始Phase 1（推荐）
- 用1-2天验证GPT-5替换效果
- 金丝雀测试5条语句对比v3.1 vs v3.2
- 成功后再进Phase 2函数化

### 选项B：继续运营v3.1，并行开发v3.2
- v3.1服务真实用户
- v3.2在分支上迭代
- 2周后A/B测试决定切换

### 选项C：暂缓改造，专注数据积累
- 保持v3.1运营，收集用户反馈
- 优先做"中文别名库"等快赢改进
- 等GPT-5正式发布再重构

---

## 📝 总结

**你的系统价值 ≠ 多AI投票**  
**你的系统价值 = 实时数据 + 专有算法 + 工作流自动化**

GPT-5是工具，不是对手。  
把它当成"升级后的输出引擎"，而不是"竞争者"。

---

**是否要我帮你启动Phase 1？** 我可以立即修改代码，用GPT-5替换synthesis节点，然后跑5条金丝雀测试对比效果。
