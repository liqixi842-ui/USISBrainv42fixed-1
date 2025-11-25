# CHANGELOG

## v4.3 (2025-11-05)

### 🎨 热力图功能重大升级
1. **ScreenshotAPI 集成**
   - ✅ 优先使用 ScreenshotAPI.net 截取真实 TradingView 热力图
   - ✅ 支持多市场映射：US→SPX500, Europe→DAX, China→AllCN 等
   - ✅ 5秒加载延迟确保完整渲染，1200x800 高清截图
   - ✅ GET 请求格式，token 作为 query 参数
   
2. **智能降级机制**
   - ✅ ScreenshotAPI 失败自动降级到 QuickChart
   - ✅ 完整错误日志记录
   - ✅ 用户体验无中断

3. **Telegram Bot 增强**
   - ✅ 新增 `/heatmap` 命令直接生成热力图
   - ✅ 文本关键词检测："热力图" / "heatmap" 自动触发
   - ✅ 支持 buffer 和 URL 两种图片发送方式
   - ✅ 详细 caption 显示来源、耗时、数据集信息

### 技术实现
- `generateHeatmap()` 函数：统一热力图生成入口
- 正确的 ScreenshotAPI GET 请求（修复了之前的 POST 错误）
- 市场到数据集映射自动化
- 25秒超时保护，20秒 API 超时限制

---

## v4.2_fixed (2025-11-05)

### 核心修复
- **Symbol Normalizer**: 锁定交易所后缀映射
  - `.MC` → `BME:` (Madrid)
  - `.DE` → `XETRA:` (Frankfurt)
  - `.PA` → `EPA:` (Paris)
  - `.MI` → `MIL:` (Milan)
  - `.L` → `LSE:` (London)
  
- **Soft Dependency**: 行情数据采集失败不再阻断分析流程
  - 失败时仅记录到 `debug.data_errors`
  - 允许"仅分析"模式继续执行
  
- **Response Contract**: `/brain/orchestrate` 响应格式标准化
  - `status: "ok"` 顶层字段固定
  - `symbols` 顶层字段（经过 normalizeSymbol 处理）
  - `debug.data_errors` 规范化初始化

### 验证通过
- ✅ GRF.MC → BME:GRF 符号转换
- ✅ SAP.DE → XETRA:SAP 符号转换
- ✅ debug.data_errors 作用域初始化
- ✅ 本地健康检查通过

---

## 历史版本

### v4.2 (2025-11)
- GPT-5 单核引擎集成
- 三层 Orchestrator 架构
- P50/P95 延迟统计

### v4.1
- SmartBrain 智能降级系统
- 用户历史记忆优化

### v4.0
- GPT-5 单核替换多 AI 投票
- 实时数据采集增强

### v3.1
- 智能意图理解
- Symbol Resolver
- 合规守卫

### v3.0
- 初始架构
- 基础功能实现
