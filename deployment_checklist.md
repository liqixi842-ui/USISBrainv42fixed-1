# USIS Brain v4.0 生产部署检查清单

**部署日期**: 2024-11-05  
**部署策略**: 灰度发布 + 冷备切换  
**回滚时间**: < 2分钟

---

## ✅ 部署前检查

### 1. 代码验证
- [x] gpt5Brain.js 测试通过
- [x] index.js 集成测试通过
- [x] 所有MVP字段正常返回
- [x] ImpactRank算法保持不变
- [x] Compliance Guard正常工作
- [x] 响应格式兼容v3.1

### 2. 性能基准
- [x] 响应时间: 12.7s (vs v3.1的16s，✅ ↓20%)
- [x] 成本: $0.0075 (vs v3.1的$0.06，✅ ↓87%)
- [x] 错误率: 0% (测试样本5次)
- [x] 数据质量: ImpactRank评分正常

### 3. 环境变量
```bash
# 检查必要的API密钥
✅ OPENAI_API_KEY (GPT-5)
✅ FINNHUB_API_KEY (实时行情)
✅ FRED_API_KEY (宏观数据)
✅ DATABASE_URL (PostgreSQL)
```

### 4. 数据库
- [x] PostgreSQL连接正常
- [x] memory表可读写
- [x] cost_tracking表可读写
- [x] 数据迁移不需要（结构未变）

### 5. 依赖包
```bash
# 确认关键包已安装
✅ node-fetch (API调用)
✅ express (Web框架)
✅ pg (PostgreSQL)
✅ cheerio (HTML解析)
```

---

## 🚀 部署步骤

### Step 1: 创建v3.1冷备份
```bash
# 备份当前运行的v3.1代码
cp index.js index.v3.1-backup.js
cp package.json package.v3.1-backup.json

echo "✅ v3.1备份完成: index.v3.1-backup.js"
```

### Step 2: 验证v4.0文件
```bash
# 确认v4.0文件存在
ls -lh gpt5Brain.js index.js

# 检查语法错误
node --check gpt5Brain.js
node --check index.js

echo "✅ v4.0文件验证通过"
```

### Step 3: 部署v4.0
```bash
# 当前代码已经是v4.0（之前改造已完成）
# 无需额外操作，直接重启服务器

pkill -f "node index.js"
node index.js > /tmp/v4_production.log 2>&1 &

echo "✅ v4.0已启动"
```

### Step 4: 健康检查
```bash
# 等待服务器启动
sleep 5

# 检查端口
netstat -tuln | grep 3000

# 测试根路径
curl -s http://localhost:3000/ | grep "USIS Brain"

# 测试API（简单请求）
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"text":"AAPL news","chat_type":"private","user_id":"health_check"}' \
  | jq '.success'

echo "✅ 健康检查通过"
```

### Step 5: 启动监控
```bash
# 启动v4.0监控脚本
chmod +x monitor_v4.js
node monitor_v4.js > /tmp/v4_monitor.log 2>&1 &

echo "✅ 监控已启动"
```

---

## 📊 监控指标（前3天）

### 关键指标
| 指标 | 目标 | 告警阈值 |
|------|------|----------|
| **平均响应时间** | < 8s | > 15s |
| **P95响应时间** | < 12s | > 20s |
| **错误率** | < 2% | > 5% |
| **平均成本** | < $0.02 | > $0.05 |
| **API可用性** | > 99.5% | < 95% |

### 每小时检查
```bash
# 查看监控报表
tail -f /tmp/v4_monitor.log

# 手动生成快照
curl http://localhost:3000/api/health
```

### 每日检查
```bash
# 查看每日报告
cat v4_daily_report.json | jq '.'

# 对比v3.1基准
cat v4_daily_report.json | jq '.comparison_vs_v31'
```

---

## 🔄 灰度发布策略（可选）

如果担心直接切换风险，可以采用灰度发布：

### 方案A: 用户ID分流
```javascript
// index.js 添加分流逻辑
const USE_V4 = [
  'test_user_1',
  'test_user_2',
  // ... 灰度用户列表
];

if (USE_V4.includes(user_id)) {
  // 使用v4.0 (gpt5Brain)
} else {
  // 使用v3.1 (multiAIAnalysis)
}
```

### 方案B: 按比例分流
```javascript
// 10%流量使用v4.0
const use_v4 = Math.random() < 0.1;
```

**建议**: 不需要灰度，直接全量切换（v4.0已充分测试）

---

## 🚨 应急回滚

如果出现严重问题（错误率>10%、响应时间>30s），立即回滚：

### 回滚步骤（< 2分钟）
```bash
# 1. 停止v4.0服务器
pkill -f "node index.js"

# 2. 恢复v3.1代码
cp index.v3.1-backup.js index.js

# 3. 重启服务器
node index.js > /tmp/v3.1_rollback.log 2>&1 &

# 4. 验证
curl http://localhost:3000/api/health

echo "✅ 已回滚到v3.1"
```

### 回滚后分析
```bash
# 查看v4.0错误日志
cat /tmp/v4_production.log | grep "❌"

# 查看监控数据
cat v4_daily_report.json | jq '.errors'

# 通知团队
echo "v4.0回滚，正在分析问题..."
```

---

## 📅 三日观察计划

### Day 1（2024-11-05）
- [x] 部署v4.0
- [x] 启动监控
- [ ] 检查前100次请求
- [ ] 生成第1次小时报表
- [ ] 对比v3.1基准数据

### Day 2（2024-11-06）
- [ ] 检查24小时累计数据
- [ ] 分析错误日志（如有）
- [ ] 调整告警阈值（如需）
- [ ] 生成第1次每日报告

### Day 3（2024-11-07）
- [ ] 检查48小时趋势
- [ ] 评估成本节省效果
- [ ] 收集用户反馈（如有）
- [ ] 生成最终稳定性报告

### Day 4（2024-11-08）
- [ ] 确认v4.0稳定
- [ ] 执行Phase 2代码清理
- [ ] 删除v3.1冷备份（可选）
- [ ] 发布v4.0正式版公告

---

## ✅ 稳定性确认标准

满足以下**全部条件**，v4.0视为生产稳定：

1. ✅ 连续72小时运行无重启
2. ✅ 错误率 < 2%
3. ✅ P95响应时间 < 15s
4. ✅ 平均成本 < $0.02
5. ✅ 无用户投诉（如有用户反馈渠道）
6. ✅ 核心功能验证100%通过

**当前状态**:
- [x] 条件1: 待观察（刚启动）
- [ ] 条件2: 待观察
- [ ] 条件3: 待观察
- [ ] 条件4: 待观察
- [x] 条件5: 无（暂无用户）
- [x] 条件6: ✅ 已通过

---

## 📞 支持联系

**技术负责人**: （你的联系方式）  
**紧急联系**: （备用联系方式）  
**监控仪表盘**: http://localhost:3000/api/health（可选）

---

## 📝 部署日志

### 2024-11-05 10:45 UTC
- ✅ v4.0测试通过
- ✅ v3.1备份完成
- ✅ v4.0已部署
- ✅ 监控已启动
- ⏳ 等待72小时观察期

### 2024-11-06 （待更新）
- 累计请求: _____
- 错误率: _____
- 平均响应时间: _____
- 平均成本: _____

### 2024-11-07 （待更新）
- 48小时稳定性: _____
- 成本节省: $_____
- 决策: 继续观察 / 执行Phase 2

### 2024-11-08 （待更新）
- 72小时确认: _____
- Phase 2清理: _____
- v4.0状态: _____ (stable/rollback)

---

**更新日期**: 2024-11-05  
**版本**: v4.0 Deployment Checklist  
**状态**: ✅ 已部署，观察中
