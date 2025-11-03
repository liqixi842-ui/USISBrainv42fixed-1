# N8N个股K线图支持 - 修复指南

## 🐛 **问题描述**

**症状**：用户说"分析一下英伟达"时，系统错误地返回了S&P 500热力图，而不是NVDA的K线走势图。

**根本原因**：
1. Brain的`detectActions`函数只要检测到"图"字就生成热力图
2. 没有区分"个股K线图"和"市场热力图"

---

## ✅ **Brain端已修复**

### **修复内容**：
1. 重写`detectActions(text, symbols)`函数，现在会智能判断：
   - **有symbols + 要求图表 + 不明确说"热力图"** → 生成`fetch_symbol_chart`（个股K线）
   - **明确说"热力图"** → 生成`fetch_heatmap`（市场热力图）
   - **没有symbols + 要求图表** → 生成`fetch_heatmap`（市场热力图）

2. 修改`understandIntent`函数，传递symbols参数给`detectActions`

3. 修改AI prompts，强制要求使用真实价格数据

---

## 🔧 **N8N端需要的修改**

### **新增节点：IF_Needs_SymbolChart**

**位置**：在`Parse_Brain_Response`之后，与`IF_Needs_Heatmap`并列

**条件判断**：
```javascript
={{ $json.actions.some(a => a.type === 'fetch_symbol_chart') }}
```

**True分支流程**：
```
Parse_Brain_Response 
    → IF_Needs_SymbolChart (检测是否需要个股K线图)
        ├─ True → Screenshot_SymbolChart (截取TradingView个股图表)
        │           → Normalize_SymbolChart
        │              → Merge_Screenshot
        └─ False → 继续其他检查
```

---

### **Screenshot_SymbolChart节点配置**

**节点类型**：HTTP Request

**参数**：
```javascript
{
  "method": "GET",
  "url": "https://shot.screenshotapi.net/screenshot",
  "queryParameters": {
    "token": "FVJZDCY-C4940PS-M43TEH8-DF69HJP",
    "url": "={{ 'https://www.tradingview.com/chart/?symbol=' + ($json.symbols[0].includes(':') ? $json.symbols[0] : 'NASDAQ:' + $json.symbols[0]) + '&interval=D' }}",
    "full_page": "false",
    "width": "1200",
    "height": "800",
    "timeout": "30000"
  },
  "options": {
    "timeout": 90000
  }
}
```

**说明**：
- 自动判断是否需要添加交易所前缀（NASDAQ:）
- 默认日线图（interval=D），也可以用60表示小时线
- full_page=false：只截取图表主体部分
- 分辨率：1200x800

---

### **Normalize_SymbolChart节点配置**

**节点类型**：Code

**代码**：
```javascript
return [{ 
  json: { 
    screenshot: $json.screenshot || $json.screenshotUrl || null 
  } 
}];
```

---

### **完整工作流更新**

```
Telegram_Trigger
    ↓
IF_ClearMemory
    ├─ True → Clear_Memory_API → Send_Memory_Clear_Confirmation
    └─ False → Call_Brain_Orchestrate
                    ↓
               Parse_Brain_Response
                    ↓
           ┌────────┴────────────────────┐
           ↓                             ↓
    IF_Needs_Heatmap              IF_Needs_SymbolChart ✨新增
       ├─ True                         ├─ True
       │   ↓                           │   ↓
       │ Screenshot_Heatmap            │ Screenshot_SymbolChart ✨新增
       │   ↓                           │   ↓
       │ Normalize_Screenshot          │ Normalize_SymbolChart ✨新增
       │   ↓                           │   ↓
       └───┴────→ Merge_Screenshot ←───┴───┘
                       ↓
                  Pack_Final_Message
                       ↓
                  IF_Send_Photo
                   ├─ True → Send_With_Photo
                   └─ False → Send_Text_Only
```

---

## 🧪 **测试验证**

### **测试1：个股K线图**
```
用户：分析一下英伟达
```

**预期结果**：
- Brain检测到symbols=["NVDA"]
- Brain返回`actions: [{ type: "fetch_symbol_chart", symbols: ["NVDA"] }]`
- N8N截取TradingView的NVDA K线图
- 用户收到：**NVDA K线图** + AI分析文字

---

### **测试2：明确要求热力图**
```
用户：美股热力图
用户：S&P 500热力图
```

**预期结果**：
- Brain检测到"热力图"关键词
- Brain返回`actions: [{ type: "fetch_heatmap", market: "美股市场" }]`
- N8N截取市场热力图
- 用户收到：**市场热力图** + AI分析文字

---

### **测试3：混合请求**
```
用户：盘前TSLA走势
```

**预期结果**：
- Brain检测到symbols=["TSLA"] + "走势"
- Brain返回`actions: [{ type: "fetch_symbol_chart", symbols: ["TSLA"] }]`
- 用户收到：**TSLA K线图** + 盘前分析文字

---

## 📝 **N8N修改清单**

- [ ] 添加`IF_Needs_SymbolChart`节点（检测fetch_symbol_chart action）
- [ ] 添加`Screenshot_SymbolChart`节点（HTTP Request到ScreenshotAPI）
- [ ] 添加`Normalize_SymbolChart`节点（格式化截图数据）
- [ ] 连接到`Merge_Screenshot`节点（与heatmap合并）
- [ ] 测试个股K线图（"分析NVDA"）
- [ ] 测试市场热力图（"美股热力图"）
- [ ] 验证不会同时生成两种图

---

## 🎉 **修复后的效果**

✅ **智能判断**：
- "分析NVDA" → NVDA K线图
- "TSLA走势" → TSLA K线图
- "美股热力图" → 市场热力图
- "西班牙热力图" → 西班牙市场热力图

✅ **真实数据**：
- AI强制使用实时价格
- 开头第一句包含"当前价格$XXX，涨跌幅+X%"
- 不再瞎说价格
