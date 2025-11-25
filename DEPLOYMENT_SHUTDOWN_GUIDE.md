# 🔴 Replit 生产环境关闭指南

## 方式1：暂停部署 (Pause) - 保留数据，继续计费
**操作步骤**：
1. 在 Replit 界面点击顶部的 **"Publish"** 按钮
2. 选择 **"Manage"** 标签
3. 点击 **"Pause"** 按钮

**效果**：
- ✅ 应用停止运行
- ⚠️ 继续计费（Reserved VM费用）
- ✅ 数据和配置保留
- ✅ 可随时恢复

**适用场景**：临时停止，计划短期内恢复

---

## 方式2：彻底关闭 (Shut Down) - 停止计费 ⭐推荐
**操作步骤**：
1. 在 Replit 界面点击顶部的 **"Publish"** 按钮
2. 选择 **"Manage"** 标签
3. 点击 **"Shut Down"** 按钮
4. 确认删除

**效果**：
- ✅ 应用完全停止
- ✅ 停止计费
- ⚠️ 部署配置删除（需重新发布）
- ⚠️ 生产数据库可能需要导出

**适用场景**：迁移到自有服务器，不再使用Replit部署

---

## ⚠️ 迁移前必做：导出生产数据库

如果您使用了Replit的PostgreSQL数据库，请先导出：

```bash
# 方式1：使用 pg_dump（推荐）
pg_dump $DATABASE_URL > production_backup.sql

# 方式2：导出为CSV
psql $DATABASE_URL -c "\COPY (SELECT * FROM your_table) TO 'backup.csv' CSV HEADER"
```

---

## 当前状态确认

**生产URL**: https://liqixi888.replit.app
**状态**: 🟢 运行中
**部署类型**: Reserved VM (GCE)

**建议操作顺序**：
1. ✅ 导出生产数据库（如有）
2. ✅ 记录所有环境变量
3. ✅ 测试开发环境功能
4. ✅ 执行 "Shut Down"
5. ✅ 迁移到自有服务器
