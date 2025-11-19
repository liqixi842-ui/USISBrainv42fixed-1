# USIS Brain v5.1 Testing Guide
## 测试完成状态：✅ 代码已完成，等待实际测试验证

## v5.1 已实现功能清单

### P0 核心功能
- [x] **完整符号描述解析** - 支持 "Inmobiliaria Colonial (BME:COL, Spain)" 格式
- [x] **行业智能分类系统** - 7种行业类型（REIT、Tech、Financial、Healthcare、Industrial、Retail、Energy）
- [x] **AI提示词动态适配** - 根据行业自动调整分析重点、指标、语气

### P1 品牌与本地化
- [x] **品牌白标化系统** - 支持自定义 firm/brand/analyst 参数
- [x] **多语言架构集成** - language 参数完整支持
- [x] **分析师格式统一** - 全部使用 "Lead Analyst:" 格式

### P2 专业品质
- [x] **估值语言去模板化** - AI提示词明确禁止 constructive/supportive/compelling 等词汇
- [x] **专业数据驱动描述** - 所有分析基于实际数据引用
- [x] **页面标题栏** - 所有20页添加蓝色渐变标题栏 "{{firm}} — Equity Research"

### Bug修复
- [x] generateFallbackPDF 作用域问题
- [x] createHelpers report参数传递
- [x] 函数声明清理
- [x] 重复header删除

## 测试方式

### 方式1: Telegram Bot测试（推荐）

**开发机器人**: @chaojilaos_bot (使用 TELEGRAM_BOT_TOKEN_DEV)

#### 基础测试
```
/report NVDA
```
- 验证：使用默认品牌 "USIS Research"
- 预期：生成完整PDF研报（~20页）

#### 行业分类测试（REIT）
```
/report O
```
- 符号：O (Realty Income Corporation - REIT公司)
- 验证：
  - AI提示词应包含 REIT专业术语（FFO、NOI、Cap Rate）
  - Investment Thesis 应关注分红收益、租户质量
  - Valuation Analysis 应使用 P/FFO 而非 P/E

#### 白标品牌测试
```
/report NVDA brand=VADA firm=Aberdeen Investments analyst=Anthony Venn Dutton
```
- 验证：
  - PDF标题栏：Aberdeen Investments — Equity Research
  - 品牌名：VADA
  - 分析师：Lead Analyst: Anthony Venn Dutton

#### 完整符号描述测试
```
/report COL
```
- 符号：COL (Inmobiliaria Colonial - 西班牙REIT)
- 验证：系统能正确解析 "Inmobiliaria Colonial (BME:COL, Spain)"

### 方式2: REST API测试

#### JSON格式
```bash
curl "http://localhost:3000/v3/report/NVDA?format=json&firm=Vanguard%20Research&analyst=Sarah%20Chen,%20CFA"
```

#### PDF格式
```bash
curl "http://localhost:3000/v3/report/O?format=pdf&firm=Aberdeen%20Investments" -o test_report.pdf
```

#### HTML格式
```bash
curl "http://localhost:3000/v3/report/NVDA?format=html&brand=Custom%20Brand" > test_report.html
```

## 验证要点

### 1. 行业分类准确性
- REIT公司（O, VNQ, PSA）→ 应使用FFO指标
- 科技公司（NVDA, AAPL）→ 应关注研发投入、创新
- 金融公司（JPM, BAC）→ 应分析NIM、ROE、监管资本

### 2. 白标品牌正确性
检查PDF文档中：
- **每页标题栏**：`{{firm}} — Equity Research`
- **封面品牌名**：显示自定义brand参数
- **分析师署名**：`Lead Analyst: {{analyst}}`
- **无硬编码**：不应出现 "USIS" 字样（除非用户指定）

### 3. 专业语言质量
AI生成内容应避免：
- ❌ "constructive"
- ❌ "supportive" 
- ❌ "compelling"
- ❌ "well-positioned"
✅ 替代为数据驱动描述：
- "EPS growth of 25% YoY"
- "Operating margin expanded from 18% to 22%"
- "Debt-to-equity ratio improved from 0.8 to 0.5"

### 4. 多语言支持（架构验证）
```bash
# 测试语言参数传递
curl "http://localhost:3000/v3/report/NVDA?format=json&lang=zh-CN"
```
- 验证：language参数正确传递到所有生成函数

## 已知问题

### Telegram Bot Polling冲突
- **现象**：日志显示 "Conflict: terminated by other getUpdates request"
- **原因**：多个Bot实例同时运行（开发环境 + 生产环境）
- **影响**：不影响API功能，仅影响实时消息接收
- **解决**：停止其他Bot实例，或使用webhook模式

### 长时间API调用
- **现象**：报告生成耗时 60-120 秒
- **原因**：涉及多次AI API调用（GPT-4、Claude等）+ 数据获取
- **正常行为**：符合预期，系统已设置240秒超时

## 性能基准

- **JSON格式**：~30-60秒
- **HTML格式**：~40-80秒  
- **PDF格式**：~60-120秒（含DocRaptor渲染）

## 代码审查状态

✅ **所有变更已通过 Architect 审查**（"Pass" 判定）

主要审查文件：
- `v3_dev/services/reportService.js`
- `v3_dev/services/v5/writerStockV3.js`
- `v3_dev/services/industryClassifier.js`
- `v3_dev/services/v5/reportBuilderV5.js`
- `v3_dev/routes/report.js`
- `v3_dev/services/v5/styleEngine.js`
- `v3_dev/services/v5/textCleanerEngine.js`

## 下一步建议

1. **实际测试验证** - 通过Telegram发送 `/report NVDA` 测试完整流程
2. **多行业测试** - 测试REIT、Tech、Financial三种行业分类
3. **白标测试** - 验证自定义品牌参数正确传递
4. **性能监控** - 观察生成时间和成本（已有cost_tracking表）
5. **多语言测试** - 验证language参数在所有模块正确工作

## 生产部署checklist

- [ ] 设置 `REPLIT_DEPLOYMENT_URL` 环境变量指向生产域名
- [ ] 配置DocRaptor生产API密钥（`DOC_RAPTOR_TEST_MODE=false`）
- [ ] 启用 Reserved VM（支持持续后台进程）
- [ ] 设置速率限制（防止滥用）
- [ ] 配置监控告警（Telegram通知）
