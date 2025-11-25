# v5 研报简化协议实现文档

## ✅ 已完成的功能

我已经在 USIS Brain 中实现了你要求的简化研报生成协议。现在你可以用一行命令生成专业的研报！

---

## 📝 使用方法

### 1️⃣ 命令格式

```
研报, 股票代码, 机构名字, 老师名字, 语言
```

### 2️⃣ 使用示例

```
研报, NVDA, USIS Research, Inma Ramírez Torres, 英文
研报, TSLA, Vanguard España, Pablo Bernal, 西班牙语
研报, BABA, USIS Research, System, 中文
研报, AAPL
```

### 3️⃣ 字段说明

| 字段 | 说明 | 默认值 | 必填 |
|------|------|--------|------|
| 研报 | 触发关键词 | - | ✅ |
| 股票代码 | 例如 NVDA、TSLA、BABA | - | ✅ |
| 机构名字 | 任意字符串 | USIS Research Division | ❌ |
| 老师名字 | 任意字符串 | System (USIS Brain) | ❌ |
| 语言 | 中文/英文/西班牙语等 | 英文 (en) | ❌ |

### 4️⃣ 支持的语言

| 语言 | 输入方式 | 语言代码 |
|------|----------|----------|
| 中文 | 中文、中、chinese、zh | zh |
| 英文 | 英文、英、english、en | en |
| 西班牙语 | 西班牙语、西班牙、西、spanish、es | es |
| 法语 | 法语、法、french、fr | fr |
| 德语 | 德语、德、german、de | de |
| 日语 | 日语、日、japanese、ja | ja |
| 韩语 | 韩语、韩、korean、ko | ko |

---

## 🔧 技术实现细节

### 1️⃣ 修改的文件

#### **semanticIntentAgent.js**（新增 2 个功能）

**功能 1：快速检测研报命令**
- 在 `parseUserIntent()` 函数开头（第 22-47 行）添加快速检测逻辑
- 当用户输入以 "研报" 或 "/研报" 开头时，直接解析参数，不调用 AI
- 返回标准的 Intent 对象，包含 `reportParams`

**功能 2：解析研报命令参数**
- 新增 `parseResearchReportCommand()` 函数（第 371-442 行）
- 支持中英文逗号分割
- 自动 trim() 处理多余空格
- 智能语言映射（例如："西班牙" → "es"）
- 参数验证（股票代码必须是大写字母和数字）

#### **index.js**（修改 Telegram Bot 逻辑）

**位置：第 6397-6490 行**

**主要改动**：
1. 替换旧的 `isReportRequest` 检测为 `isReportCommandV5`
2. 调用 `parseResearchReportCommand()` 解析用户输入
3. 将解析出的 `{ symbol, firm, analyst, lang }` 参数传递给 v3/report API
4. 增强错误提示，包含格式说明和示例

**关键代码**：
```javascript
const { parseResearchReportCommand } = require('./semanticIntentAgent');
const reportParams = parseResearchReportCommand(text);

const params = new URLSearchParams({
  format: 'pdf',
  asset_type: 'equity',
  brand: firm,
  firm: firm,
  analyst: analyst,
  lang: lang
});
```

---

## 🌐 n8n 集成方案

### 方案 1：直接转发到 /brain/run（推荐）

**n8n 工作流配置**：

```
[Telegram Trigger]
  ↓
[Function Node: 检测研报命令]
  ↓
[HTTP Request: POST http://myusis.net:3000/brain/run]
  ↓
[Telegram: 发送PDF]
```

**Function Node 代码示例**：
```javascript
// 检测是否为研报命令
const text = $input.item.json.message.text;

if (text.startsWith('研报') || text.startsWith('/研报')) {
  return {
    json: {
      text: text,
      chat_id: $input.item.json.message.chat.id,
      user_id: $input.item.json.message.from.id
    }
  };
}

// 如果不是研报命令，跳过
return [];
```

**HTTP Request 节点配置**：
- Method: POST
- URL: http://myusis.net:3000/brain/run
- Body (JSON):
```json
{
  "text": "{{ $json.text }}",
  "chat_id": "{{ $json.chat_id }}",
  "user_id": "{{ $json.user_id }}"
}
```

### 方案 2：调用 v3/report API

**n8n 工作流配置**：

```
[Telegram Trigger]
  ↓
[Function Node: 解析研报命令]
  ↓
[HTTP Request: GET http://myusis.net:3000/v3/report/:symbol?params]
  ↓
[Telegram: 发送PDF]
```

**Function Node 代码示例**：
```javascript
const { parseResearchReportCommand } = require('./semanticIntentAgent');

const text = $input.item.json.message.text;
const params = parseResearchReportCommand(text);

if (!params) {
  throw new Error('Invalid report command format');
}

return {
  json: {
    symbol: params.symbol,
    firm: params.firm,
    analyst: params.analyst,
    lang: params.lang,
    chat_id: $input.item.json.message.chat.id
  }
};
```

---

## 📊 系统返回格式

### Telegram Bot 返回

**开始消息**：
```
📊 **正在生成机构级研报** (NVDA)

🏢 **机构**: USIS Research
👤 **分析师**: Inma Ramírez Torres
🌐 **语言**: 英文

⏱ 预计需要 2-5 分钟
📄 包含专业财务分析 + 图表

请稍候，AI正在分析中...
```

**完成消息**：
```
📊 **NVDA 深度研报**

🏢 **USIS Research**
👤 **分析师**: Inma Ramírez Torres
🌐 **语言**: 英文

📄 详细分析请见附件PDF（567.3 KB）
```

### n8n JSON 返回（建议格式）

```json
{
  "type": "research_report_v5_pdf",
  "symbol": "NVDA",
  "firm": "USIS Research",
  "analyst": "Inma Ramírez Torres",
  "lang": "en",
  "pdf_url": "http://myusis.net:3000/v3/report/NVDA?format=pdf&firm=USIS+Research&analyst=Inma+Ramírez+Torres&lang=en",
  "pdf_size_kb": 567.3,
  "generated_at": "2025-11-18T18:30:00.000Z"
}
```

---

## 🆕 如何添加新语言

### 步骤 1：编辑 semanticIntentAgent.js

找到 `parseResearchReportCommand()` 函数（第 380-389 行）的语言映射表：

```javascript
const languageMap = {
  '中文': 'zh', '中': 'zh', 'chinese': 'zh', 'zh': 'zh',
  '英文': 'en', '英': 'en', 'english': 'en', 'en': 'en',
  '西班牙语': 'es', '西班牙': 'es', '西': 'es', 'spanish': 'es', 'es': 'es',
  '法语': 'fr', '法': 'fr', 'french': 'fr', 'fr': 'fr',
  // 👇 添加新语言到这里
  '意大利语': 'it', '意': 'it', 'italian': 'it', 'it': 'it'
};
```

### 步骤 2：编辑 index.js

找到语言名称映射（第 6418-6421 行）：

```javascript
const langName = {
  'zh': '中文', 'en': '英文', 'es': '西班牙语', 
  'fr': '法语', 'de': '德语', 'ja': '日语', 'ko': '韩语',
  // 👇 添加新语言到这里
  'it': '意大利语'
}[lang] || '英文';
```

### 步骤 3：重启服务

```bash
pm2 restart usis-brain
```

### 步骤 4：测试

```
研报, AAPL, Goldman Sachs, Marco Rossi, 意大利语
```

---

## ✅ 测试清单

- [ ] 测试完整命令：`研报, NVDA, USIS Research, Inma Ramírez Torres, 英文`
- [ ] 测试默认值：`研报, TSLA`
- [ ] 测试中文：`研报, BABA, USIS Research, System, 中文`
- [ ] 测试西班牙语：`研报, SAN, Vanguard España, Pablo Bernal, 西班牙语`
- [ ] 测试错误格式：`研报, 123`（应该返回错误提示）
- [ ] 测试缺少股票代码：`研报, , USIS Research`（应该返回错误提示）

---

## 🔍 调试日志

当你发送研报命令时，控制台会输出以下日志：

```
📊 [Parse Report Command] 输入: "研报, NVDA, USIS Research, Inma Ramírez Torres, 英文"
   解析字段数: 4 [ 'NVDA', 'USIS Research', 'Inma Ramírez Torres', '英文' ]
✅ [Parse Report Command] 解析成功:
   股票: NVDA
   机构: USIS Research
   分析师: Inma Ramírez Torres
   语言: en (原始: 英文)

📊 [v5/report] 检测到研报命令（v5简化协议）
📡 [主Bot v5] /report NVDA → calling v3 API with v5 params
   机构: USIS Research
   分析师: Inma Ramírez Torres
   语言: en
✅ [主Bot v5] v3 API 成功: 567.3 KB
✅ [主Bot v5] 深度研报已发送: NVDA (567.3 KB)
```

---

## 📌 重要提醒

1. **股票代码必须提供**，否则会返回错误提示
2. **机构名字、分析师、语言都有默认值**，可以省略
3. **支持中英文逗号**，系统会自动处理
4. **语言映射自动完成**，例如 "西班牙" 会自动转为 "es"
5. **v3/report API 已支持所有参数**，无需额外修改

---

## 🎯 下一步（可选）

1. **在 n8n 中配置工作流**（按照上面的方案 1 或方案 2）
2. **测试不同语言的报告生成**
3. **添加更多语言支持**（按照上面的步骤）
4. **在 Telegram Bot 中添加 /help 命令**，说明研报格式

---

**实现完毕！** 🎉

现在你可以在 Telegram 里直接发送：
```
研报, NVDA, USIS Research, Inma Ramírez Torres, 英文
```

系统会自动生成一份专业的 v5 研报 PDF！
