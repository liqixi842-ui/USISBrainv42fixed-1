# v5 研报质量修复计划

## 🛑 Critical Issues（已识别根源）

### 1️⃣ 业务板块收入占比矛盾

**问题根源**：
- **文件**: `v3_dev/services/reportService.js` + `v3_dev/services/v5/writerStockV3.js`
- **问题**: 
  - 表格硬编码：第 5052-5056 行（Data Center 60%, Gaming 25%）
  - AI 生成文本：`generateOverview()` 可能生成不同的百分比

**修复方案**：
1. 创建统一的 `segmentData` 对象（作为单一数据源）
2. 表格使用 `segmentData` 渲染
3. AI prompt 强制引用 `segmentData` 中的百分比
4. 如果没有真实数据，统一使用 fallback

**修改文件**：
- `v3_dev/services/reportService.js`: 创建 `buildSegmentData()` 函数
- `v3_dev/services/v5/writerStockV3.js`: 修改 `generateOverview()` 强制使用传入的 segment 数据

---

## ⚠ High Priority

### 2️⃣ AI 口癖（organic organic / addressable addressable）

**修复方案**：
- 创建 `v3_dev/services/v5/textCleanerEngine.js`
- 实现 `removeDuplicateWords()` 函数
- 在 `styleEngine.applyStyle()` 之后调用

**修改文件**：
- 新建: `v3_dev/services/v5/textCleanerEngine.js`
- 修改: `v3_dev/services/v5/writerStockV3.js` (所有生成函数)

### 3️⃣ Valuation 段落重复

**修复方案**：
- 区分 `valuation_main`（长文）和 `valuation_summary`（短文）
- Page 8: 长文
- Page 10+: 使用 2-3 bullet 摘要

**修改文件**：
- `v3_dev/services/reportService.js`: 修改 HTML 模板

### 4️⃣ Risk/Catalyst 边界不清

**修复方案**：
- 在 risk 生成 prompt 中明确禁止 upside/benefit 词汇
- 添加后处理过滤

**修改文件**：
- `v3_dev/services/v5/writerStockV3.js`: 修改 `generateRisks()` prompt

### 5️⃣ 品牌一致性

**修复方案**：
- 根据 `firm` 参数动态控制页脚和版权
- 白标模式：不显示 USIS Research

**修改文件**：
- `v3_dev/services/reportService.js`: 修改 HTML footer 和 disclaimers

---

## 🧩 Nice-to-have

### 6️⃣ Executive Summary 浓缩
### 7️⃣ 机构/分析师人设化
### 8️⃣ Lite vs Full 版本

---

## 实施顺序

1. ✅ **Critical 1**: 业务板块统一数据源
2. ✅ **High 2**: AI 口癖清理
3. ✅ **High 5**: 品牌一致性
4. ✅ **High 3**: Valuation 去重
5. ✅ **High 4**: Risk/Catalyst 边界
6. ⏸ Nice-to-have（根据需求）
