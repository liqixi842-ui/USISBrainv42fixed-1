# 🚀 USIS Brain v3 - 启动指南

## ❗ 当前问题

**所有3个问题的根本原因：服务器没有运行！**

1. ⚠️ 系统临时错误 → N8N无法连接到Brain API
2. 📈 没有走势图 → Brain没有返回actions指令给N8N
3. 💰 价格数据是假的 → Brain没有运行，AI没有收到实时数据

## ✅ 代码已修复

**Brain端修复完成**：
- ✅ `detectActions`函数：智能区分个股K线图 vs 市场热力图
- ✅ Claude Prompt：强制第一句包含"当前价格$XXX，涨跌幅+X%"
- ✅ GPT-4 Prompt：强制引用实时价格、市场情绪、新闻
- ✅ 数据流：`collectMarketData()` → `generateDataSummary()` → AI prompts

## 🎯 启动服务器（3种方法）

### **方法1：Shell标签（推荐）**
1. 点击Replit顶部的 **Shell** 标签
2. 输入命令：
   ```bash
   ./start.sh
   ```
3. 看到这些信息说明启动成功：
   ```
   🚀 USIS Brain v3 online on port 5000
   📍 Listening on 0.0.0.0:5000
   ✅ Database initialized: user_memory table ready
   ```
4. **保持Shell标签打开**（关闭会终止服务器）

### **方法2：Replit Run按钮**
1. 编辑 `.replit` 文件，添加：
   ```toml
   run = "node index.js"
   ```
2. 点击顶部的 **Run** 按钮
3. 服务器会自动启动

### **方法3：后台守护进程**
```bash
nohup ./daemon.sh &
```
这会在后台持续运行，即使关闭Shell也不会停止。

## 🧪 验证服务器运行

### **测试Health端点**
```bash
curl http://localhost:5000/health
```

### **测试Brain分析**
```bash
curl -X POST http://localhost:5000/brain/orchestrate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "分析NVDA",
    "chat_type": "private",
    "user_id": "test_user"
  }'
```

应该看到包含：
- `final_analysis`: AI分析文字（包含真实价格）
- `actions`: `[{ "type": "fetch_symbol_chart", "symbols": ["NVDA"] }]`
- `symbols`: `["NVDA"]`
- `market_data`: 真实市场数据

## 🎉 修复后的效果

**智能图表识别**：
- ✅ "分析NVDA" → NVDA K线图 + 真实价格分析
- ✅ "TSLA走势" → TSLA K线图
- ✅ "美股热力图" → S&P 500市场热力图
- ✅ "西班牙热力图" → 西班牙市场热力图

**真实数据分析**：
- ✅ 第一句包含："NVDA当前价格$XXX，涨跌幅+X%"
- ✅ 使用Finnhub/Alpha Vantage实时数据
- ✅ 不再编造价格

## 📝 N8N端需要的更新

服务器运行后，还需要更新N8N workflow添加个股K线图支持。
详见：`N8N_SYMBOL_CHART_UPDATE.md`

核心修改：
1. 添加 `IF_Needs_SymbolChart` 节点
2. 添加 `Screenshot_SymbolChart` 节点
3. 连接到 `Merge_Screenshot`

## 🐛 故障排查

### **服务器无法启动**
```bash
# 检查端口是否被占用
lsof -i :5000

# 查看日志
tail -f /tmp/brain.log
```

### **数据库连接失败**
```bash
# 检查DATABASE_URL环境变量
echo $DATABASE_URL
```

### **API Key缺失**
检查Replit Secrets中是否配置：
- `ALPHA_VANTAGE_API_KEY`
- `FINNHUB_API_KEY`
- `GEMINI_API_KEY`
- `PERPLEXITY_API_KEY`
- (其他AI API keys)

## 📞 联系支持

如果问题持续，提供以下信息：
1. 服务器日志（`/tmp/brain.log`）
2. 错误截图
3. 测试curl命令的输出
