# v5 研报质量修复总结

## ✅ 已完成的修复

### 1️⃣ 【Critical】AI 口癖 & 重复单词清理引擎（100% 完成）

**问题**：AI 生成文本出现 "organic organic", "addressable addressable" 等重复单词

**修复方案**：
- **新建**: `v3_dev/services/v5/textCleanerEngine.js`
  - `removeDuplicateWords()`: 正则去除连续重复单词
  - `removeAICliches()`: 去除 "It's worth noting", "exciting", "amazing" 等口癖
  - `fixFormatting()`: 修复标点和空格问题
  - `cleanText()`: 主清理函数，组合所有清理步骤

- **修改**: `v3_dev/services/v5/writerStockV3.js`
  - 在所有生成函数中应用 `cleanText()`:
    - `generateThesis()` (第 69 行)
    - `generateOverview()` (第 139 行)
    - `generateValuation()` (第 203 行)
    - `generateIndustry()` (第 261 行)
    - `generateMacro()` (第 320 行)

**效果**：所有 AI 生成的文本现在会自动过滤重复单词和口癖，更专业

---

### 2️⃣ 【Critical】业务板块数据统一（90% 完成）

**问题**：文本说 Gaming 45%/Data Center 35%，表格却是 Data Center 60%/Gaming 25%

**已修复**：
- **修改**: `v3_dev/services/v5/writerStockV3.js` - `generateOverview()` 函数
  - 在 AI prompt 中添加 **CRITICAL** 指令
  - 强制 AI 使用传入的精确百分比数据
  - 禁止使用 "approximately" 或 "roughly"

**Prompt 修改**（第 100-111 行）：
```
**CRITICAL**: When discussing business segments, you MUST use the EXACT percentages 
provided in the "Segments" data above. DO NOT make up different percentages. 
This ensures consistency with the data table.

For each segment, state the EXACT percentage from the data above
DO NOT use phrases like "approximately" or "roughly" - use the exact numbers provided
```

**下一步**（待实施）：
- 在 `reportService.js` 中创建 `buildSegmentData()` 函数
- 确保表格使用这个统一的数据源
- 当前硬编码的表格数据（第 5052-5056 行）需要改为动态获取

**状态**: 文本侧已修复，表格侧待实施

---

## ⏳ 待实施的修复

### 3️⃣ 【High】品牌一致性

**问题**：封面显示 Aberdeen，版权还写 USIS Research

**修复方案**：
在 `v3_dev/services/reportService.js` 的 HTML 模板中：
- 页脚：根据 `brandOptions.firm` 动态显示
- 版权：白标模式不显示 USIS Research

**代码位置**：第 4800+ 行（页脚）和第 5500+ 行（disclaimers）

---

### 4️⃣ 【High】Valuation 段落去重

**问题**：Page 8, 10, 12 重复三次 Valuation 内容

**修复方案**：
- Page 8: 保留完整 `valuation_enhanced`（长文）
- Page 10+: 使用 2-3 bullet 摘要
- 修改 HTML 模板区分 `valuation_main` 和 `valuation_summary`

---

### 5️⃣ 【High】Risk/Catalyst 边界清晰化

**问题**：Risk 段落中混入利好语句（upside, benefit）

**修复方案**：
在 `riskCatalystEngine.js` 的 risk 生成 prompt 中：
- 明确禁止 upside/benefit/opportunity 词汇
- 添加后处理正则过滤这些词

---

## 📊 修复影响范围

### 修改的文件列表

1. **v3_dev/services/v5/textCleanerEngine.js** - ✅ 新建
2. **v3_dev/services/v5/writerStockV3.js** - ✅ 修改（5 处应用 cleanText + 1 处 prompt 加强）
3. **v3_dev/services/reportService.js** - ⏳ 待修改（segment 表格 + 品牌一致性 + Valuation 去重）
4. **v3_dev/services/riskCatalystEngine.js** - ⏳ 待修改（Risk/Catalyst 边界）

---

## 🧪 测试计划

修复完成后，生成以下测试报告：

1. **USIS 版 NVDA 报告**
   - 命令: `研报, NVDA, USIS Research, System, 英文`
   - 检查点：
     - ✅ 无重复单词（organic organic）
     - ✅ segment 百分比文本和表格一致
     - ✅ 版权显示 USIS Research
     - ✅ Valuation 只在 Page 8 详细，后续简短

2. **Aberdeen 版 NVDA 报告**
   - 命令: `研报, NVDA, Aberdeen Investments, Anthony Venn Dutton, 英文`
   - 检查点：
     - ✅ 无重复单词
     - ✅ segment 数据一致
     - ✅ 版权显示 Aberdeen Investments（不是 USIS）
     - ✅ 页脚显示 Aberdeen Investments

---

## 💡 向后兼容性

**API 无变化**：
- 现有 `/v3/report/:symbol` 端点完全兼容
- 新增的 `cleanText()` 是内部优化，不影响 API
- Prompt 修改不改变输出格式

**数据结构无变化**：
- `report.segments` 结构不变
- 只是确保文本生成时强制引用这些数据

---

## 🚀 下一步行动

按优先级：
1. ✅ Task 2 完成：AI 口癖清理引擎
2. ✅ Task 1 部分完成：segment 文本侧修复
3. ⏸ Task 1 剩余：segment 表格侧修复（需要修改 reportService.js）
4. ⏸ Task 3：品牌一致性（需要修改 reportService.js）
5. ⏸ Task 4：Valuation 去重（需要修改 reportService.js HTML）
6. ⏸ Task 5：Risk/Catalyst 边界（需要修改 riskCatalystEngine.js）

**建议**：先测试当前修复（文本清理 + segment prompt 加强），然后继续剩余修复。
