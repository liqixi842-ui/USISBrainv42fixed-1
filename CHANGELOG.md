# CHANGELOG

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
