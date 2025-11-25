# Telegram Bot 测试示例
## v3-dev Bot (@chaojilaos_bot 或您的开发Bot)

## 🎯 双入口支持（v5.1 新增）

v3-dev Bot 现在支持 **两种命令方式**：

1. **自然语言入口**（推荐，与生产Bot一致）  
   格式：`研报, 股票代码, 机构名字, 分析师名字, 语言`

2. **结构化入口**（高级用户，支持brand参数）  
   格式：`/report SYMBOL brand=... firm=... analyst=...`

---

## 快速测试命令

### 1. 基础功能测试
```
/test
```
✅ 验证Bot在线

```
/help
```
📚 查看所有可用命令（包含双入口说明）

---

### 2. 自然语言测试（推荐）
```
研报, NVDA, Aberdeen Investments, Anthony Venn Dutton, 英文
```
**测试目标：**
- ✅ 自然语言解析正确
- ✅ 机构名：Aberdeen Investments
- ✅ 分析师：Anthony Venn Dutton
- ✅ 语言：英文

**预期输出：**
- PDF文件：`NVDA-Research-Report.pdf`
- 标题栏：Aberdeen Investments — Equity Research
- 分析师：Lead Analyst: Anthony Venn Dutton

---

### 3. 结构化命令测试
```
/report NVDA brand=VADA firm=Aberdeen Investments analyst=Anthony Venn Dutton
```
**测试目标：**
- ✅ 结构化参数解析
- ✅ 支持 brand 参数（自然语言不支持）
- ✅ 与自然语言使用相同底层函数

**预期输出：**
- PDF文件：`NVDA-Research-Report.pdf`
- 品牌名：VADA（在封面显示）
- 标题栏：Aberdeen Investments — Equity Research
- 分析师：Lead Analyst: Anthony Venn Dutton

---

### 4. REIT行业分类测试（自然语言）
```
研报, O, USIS Research Division, System (USIS Brain), 英文
```
**测试目标：**
- ✅ 行业识别：Real Estate Investment Trust (REIT)
- ✅ AI提示词包含REIT专业术语
- ✅ 指标：FFO, NOI, Cap Rate, Occupancy Rate

**验证点：**
- Investment Thesis应聚焦：分红收益、租户质量、地理分布
- Valuation应使用P/FFO估值而非P/E

---

### 5. 结构化命令参数写法测试（3种）

#### 写法1：下划线分隔（适合快速输入）
```
/report NVDA brand=VADA firm=Aberdeen_Investments analyst=Anthony_Venn_Dutton
```

#### 写法2：引号包裹（推荐正式场合）
```
/report NVDA brand="VADA" firm="Aberdeen Investments" analyst="Anthony Venn Dutton"
```

#### 写法3：空格分隔（最自然）
```
/report NVDA brand=VADA firm=Aberdeen Investments analyst=Anthony Venn Dutton
```

**测试目标：**
- ✅ 所有3种写法结果相同
- ✅ PDF标题栏：`Aberdeen Investments — Equity Research`
- ✅ 品牌名：VADA
- ✅ 分析师：`Lead Analyst: Anthony Venn Dutton`

**注意：** brand 参数仅在结构化命令中支持，自然语言不支持

---

### 6. 金融行业测试（自然语言）
```
研报, JPM, Goldman Sachs, Michael Chen, 英文
```
**测试目标：**
- ✅ 行业识别：Financial Services
- ✅ 关键指标：NIM (Net Interest Margin), ROE, CET1 Ratio
- ✅ 自定义品牌：Goldman Sachs

---

### 7. 医疗行业测试（默认参数）
```
研报, JNJ
```
**测试目标：**
- ✅ 行业识别：Healthcare
- ✅ 关键指标：R&D Spending, Pipeline Strength, Patent Expiry

---

### 8. 能源行业测试（默认参数）
```
研报, XOM
```
**测试目标：**
- ✅ 行业识别：Energy
- ✅ 关键指标：Oil Price Sensitivity, Reserves, CAPEX

---

## 完整测试流程（建议顺序）

### 阶段1：基础功能验证
1. `/test` - 确认Bot在线
2. `/help` - 查看命令列表（验证双入口说明）
3. `研报, NVDA` - 测试自然语言默认配置

### 阶段2：自然语言入口验证
4. `研报, NVDA, Aberdeen Investments, Anthony Venn Dutton, 英文` - 完整参数
5. `研报, O, USIS Research, System (USIS Brain), 英文` - REIT行业
6. `研报, JPM, Goldman Sachs, Michael Chen, 英文` - 金融行业

### 阶段3：结构化命令验证（含brand参数）
7. `/report NVDA brand=VADA firm=Aberdeen Investments analyst=Anthony Venn Dutton`
8. 检查PDF中 brand 参数是否正确显示

### 阶段4：双入口对比测试
9. 自然语言：`研报, TSLA, Morgan Stanley, Adam Jonas, 英文`
10. 结构化：`/report TSLA firm=Morgan Stanley analyst=Adam Jonas`
11. 验证：两种方式生成结果一致（除brand参数外）

---

## 预期响应流程

### Bot响应1: 开始生成
```
🔬 正在生成 NVDA 研报

⏳ 正在调用 Replit v3_dev PDF API...

(这可能需要 60-120 秒)
```

### Bot响应2: 生成完成
```
🔬 正在生成 NVDA 研报

✅ PDF 生成完成 (234.5 KB)
⏳ 正在发送 PDF...
```

### Bot响应3: PDF文档
- 文件名：`NVDA-USIS-Research.pdf`
- Caption：
```
📊 USIS Research Report - NVDA

Generated via Replit v3_dev API
Source: http://localhost:3000
```

---

## 故障排除

### 问题1: Bot无响应
**原因**：Bot实例冲突或应用未启动
**解决**：
1. 检查应用是否运行：`ps aux | grep node`
2. 查看日志：`tail -f /tmp/usis_dev.log`
3. 重启应用

### 问题2: "Conflict: terminated by other getUpdates request"
**原因**：多个Bot实例同时运行
**解决**：这是正常警告，不影响功能（仅影响轮询效率）

### 问题3: API超时（240秒后无响应）
**原因**：
- OpenAI API响应慢
- 数据源（Finnhub/Twelve Data）延迟
- 网络问题

**解决**：
1. 检查API密钥是否有效
2. 查看日志了解卡在哪个步骤
3. 重试命令

### 问题4: PDF内容不完整
**原因**：某个数据源返回空数据
**解决**：
- 查看日志中的数据获取状态
- 验证symbol是否正确（NYSE、NASDAQ等）
- 尝试不同的symbol

---

## 日志监控

实时查看Bot日志：
```bash
tail -f /tmp/usis_dev.log | grep -E "DEV_BOT|report|PDF"
```

查看详细参数解析：
```bash
grep "BRAND_DEBUG" /tmp/usis_dev.log
```

---

## 成功标准

✅ **P0功能（必须通过）**
- [ ] 能成功生成任意symbol的PDF
- [ ] PDF包含20页完整内容
- [ ] 行业分类正确（REIT vs Tech vs Financial）

✅ **P1功能（重要）**
- [ ] 自定义品牌参数正确传递
- [ ] PDF中无硬编码 "USIS" 字样（使用自定义品牌时）
- [ ] 分析师格式统一为 "Lead Analyst:"

✅ **P2功能（优化）**
- [ ] AI内容无模板化词汇（constructive/supportive等）
- [ ] 所有数据引用准确
- [ ] 页面标题栏显示正确firm名称
