# Replit 重启指南 - v4.2 Grifols修复

## 问题现象
代码修改完成但服务仍使用旧代码，系统提示：
```
⚠️  No new logs. Some changes may require restarting the workflow/app to appear
```

## 解决方案（按优先级排序）

### 方案1：强制容器重启（最有效）
在Shell中执行：
```bash
kill 1
```
这会终止init进程，Replit会自动重启整个容器并加载新代码。

### 方案2：使用start.sh脚本
```bash
chmod +x start.sh
pkill -9 node
./start.sh
```

### 方案3：完全关闭浏览器标签
1. 关闭所有Replit标签页
2. 等待60秒（确保容器完全清理）
3. 重新打开项目
4. 通过Shell执行：`npm start`

## 验证新代码已加载

执行以下命令，检查归一化是否生效：
```bash
curl -s -X POST https://node-js-liqixi842.replit.app/brain/orchestrate \
 -H "Content-Type: application/json" \
 -d '{"text":"GRF.MC","user_id":"test"}' | jq '.symbols'
```

**成功标志**：输出 `["BME:GRF"]`（而不是`["GRF.MC"]`）

## 完整回归测试命令

重启成功后，依次执行：

```bash
# 测试A: Grifols仅分析
curl -s -X POST https://node-js-liqixi842.replit.app/brain/orchestrate \
 -H "Content-Type: application/json" \
 -d '{"text":"只要分析，不要建议。Grifols 行业影响","user_id":"qa"}' \
 | jq '{symbols:.symbols, debug:.debug}'

# 测试B: GRF.MC解析
curl -s -X POST https://node-js-liqixi842.replit.app/brain/orchestrate \
 -H "Content-Type: application/json" \
 -d '{"text":"GRF.MC 的基本面与风险点","user_id":"qa"}' \
 | jq '{symbols:.symbols, debug:.debug}'

# 测试C: IBEX新闻
curl -s -X POST https://node-js-liqixi842.replit.app/brain/orchestrate \
 -H "Content-Type: application/json" \
 -d '{"text":"两小时内影响 IBEX 的新闻","user_id":"qa"}' \
 | jq '.debug'

# Stats摘要
curl -s https://node-js-liqixi842.replit.app/brain/stats | jq

# 日志检查
tail -60 /tmp/restart.log | grep -E "🔄|Normalize|BME"
```

## 预期结果

- ✅ Symbols: `["BME:GRF"]`（归一化成功）
- ✅ 日志包含：`🔄 [Normalize] GRF.MC → BME:GRF`
- ✅ Status: `ok` 或包含分析内容
- ✅ debug.data_errors: 如果行情失败则包含错误详情

---
**修复完成时间**: 2025-11-05  
**Architect审查**: ✅ PASS  
**代码就绪**: 100%  
**等待**: Replit容器重启
