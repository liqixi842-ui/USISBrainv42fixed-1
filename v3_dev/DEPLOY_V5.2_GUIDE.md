# v5.2 Analyst Voice - 部署指南

## ✅ 代码已完成并通过审查

所有 v5.2 核心功能已实现并通过 Architect 审查：

### 修改文件清单
```
modified:   v3_dev/services/reportService.js
modified:   v3_dev/services/v5/reportBuilderV5.js
modified:   v3_dev/services/v5/writerStockV3.js
new file:   v3_dev/V5.2_ANALYST_VOICE_UPDATE.md
new file:   v3_dev/DEPLOY_V5.2_GUIDE.md
```

### Architect 审查结果
- ✅ **Investment Thesis**：最低词数 900（绝对最低 600），包含 ≥3 次分析师引用
- ✅ **Company Overview**：最低词数 800（绝对最低 500），包含 ≥2 次分析师引用
- ✅ **参数传递**：analyst/firm/brand 正确从 reportService → reportBuilderV5 → writerStockV3 流转
- ✅ **错误处理**：如果重试后仍 < 绝对最低词数，抛出错误而非返回空内容
- ✅ **语法检查**：所有文件通过 `node -c` 验证

---

## 🚀 手动部署步骤（在 Replit）

### 步骤1：提交代码到 Git
```bash
# 查看修改文件
git status

# 添加所有修改到暂存区
git add v3_dev/

# 提交（使用清晰的 commit message）
git commit -m "feat(v5.2): Add Analyst Voice to Investment Thesis & Company Overview

- Modified writerStockV3.js: Added analyst attributions (≥3 in thesis, ≥2 in overview)
- Enforced minimum content length: thesis ≥900 words, overview ≥800 words
- Implemented retry mechanism with strict validation
- Updated parameter passing: analyst/firm/brand → reportService → reportBuilderV5 → writerStockV3
- Enhanced error handling: throw error if content too short after retries
- Architect review: PASSED (all requirements met)

Files modified:
- v3_dev/services/reportService.js
- v3_dev/services/v5/reportBuilderV5.js
- v3_dev/services/v5/writerStockV3.js

New docs:
- v3_dev/V5.2_ANALYST_VOICE_UPDATE.md
- v3_dev/DEPLOY_V5.2_GUIDE.md
"

# 推送到远程仓库
git push origin main
```

---

## 🖥️  生产服务器部署（myusis.net）

### 步骤2：SSH 到生产服务器
```bash
ssh YOUR_USERNAME@myusis.net
```

### 步骤3：拉取最新代码
```bash
cd /opt/usis-brain

# 拉取最新代码
git pull origin main
```

### 步骤4：重启应用
```bash
# 重启 PM2 进程
pm2 restart usis-brain

# 查看日志（验证启动成功）
pm2 logs usis-brain --lines 30 --nostream
```

### 步骤5：验证 v5.2 标识
```bash
# 检查启动日志中是否显示 v5.2 功能
pm2 logs usis-brain | grep -i "analyst"

# 应该看到类似：
# [WriterStockV3] Enhancing NVDA with 5-Engine Framework + Analyst Voice
#   Analyst: Anthony Venn Dutton | Firm: Aberdeen Investments
```

---

## 🧪 功能测试

### 方式1：Telegram Bot（推荐）
发送以下消息到您的 Telegram Bot：
```
研报, NVDA, Aberdeen Investments, Anthony Venn Dutton, 英文
```

**或使用结构化命令：**
```
/report NVDA brand=ABDN firm=Aberdeen Investments analyst=Anthony Venn Dutton
```

### 方式2：API 直接调用
```bash
curl -X GET "http://myusis.net/v3/report/NVDA?firm=Aberdeen%20Investments&brand=ABDN&analyst=Anthony%20Venn%20Dutton&language=English"
```

### 方式3：测试默认值（无 analyst 参数）
```bash
# 应该使用默认值："System (USIS Brain)"
curl -X GET "http://myusis.net/v3/report/NVDA"
```

---

## 📊 预期结果验证

### Investment Thesis 页面应包含：
1. **至少3次分析师引用**（例如）：
   - "In Anthony Venn Dutton's view, NVIDIA's data center dominance..."
   - "Anthony Venn Dutton argues that the company's CUDA moat..."
   - "According to Anthony Venn Dutton, the AI tailwind remains..."

2. **内容长度**：≥900 词（理想：900-1000 词）

3. **不再出现空占位符**：
   - ❌ "Analysis not available."
   - ❌ "Analysis is being prepared."

### Company Overview 页面应包含：
1. **至少2次分析师引用**（例如）：
   - "Anthony Venn Dutton highlights that NVIDIA's business model..."
   - "As Anthony Venn Dutton notes, the gaming division..."

2. **内容长度**：≥800 词（理想：800-900 词）

### 日志验证（重要！）
生成报告时，控制台日志应显示：
```
[WriterStockV3] Thesis attempt 1: 4567 chars, 912 words
✅ Thesis meets minimum requirement (912 ≥ 900 words)

[WriterStockV3] Overview attempt 1: 3890 chars, 823 words
✅ Overview meets minimum requirement (823 ≥ 800 words)
```

**如果第一次尝试不够长：**
```
[WriterStockV3] Thesis attempt 1: 3200 chars, 650 words
⚠️  [WriterStockV3] Thesis too short (650 < 900 words), retrying...
[WriterStockV3] Thesis attempt 2: 4500 chars, 920 words
✅ Thesis meets minimum requirement (920 ≥ 900 words)
```

---

## 🔧 故障排查

### 问题1：报告仍显示 "Analysis not available"
**可能原因**：
- 代码未拉取到生产服务器
- PM2 未正确重启
- 缓存问题

**解决方案**：
```bash
# 确认 Git 拉取成功
cd /opt/usis-brain
git log --oneline -5  # 应该看到 "feat(v5.2): Add Analyst Voice..." commit

# 强制重启 PM2
pm2 delete usis-brain
pm2 start ecosystem.config.js  # 或您的启动脚本

# 清除 Node.js require 缓存（如果使用）
pm2 restart usis-brain --update-env
```

### 问题2：内容长度仍然很短（<600词）
**可能原因**：
- OpenAI API 配额耗尽
- 网络请求超时

**解决方案**：
```bash
# 检查日志中的错误
pm2 logs usis-brain --err --lines 50

# 查找类似错误：
# "Investment Thesis generation failed: 320 words (required: 900)"
```

### 问题3：分析师引用未显示
**可能原因**：
- analyst 参数未传递到 writerStockV3
- OpenAI 未遵循 prompt 要求

**解决方案**：
- 检查日志中是否显示：`Analyst: Anthony Venn Dutton | Firm: Aberdeen Investments`
- 如果未显示，检查 reportService.js 和 reportBuilderV5.js 的参数传递

---

## 📝 回滚计划（如有问题）

### 回滚到 v5.1 稳定版
```bash
cd /opt/usis-brain

# 查看最近的 commits
git log --oneline -10

# 回滚到 v5.2 之前的 commit（假设是 abc1234）
git reset --hard abc1234

# 强制推送（注意：会覆盖远程 v5.2 commit）
git push origin main --force

# 重启应用
pm2 restart usis-brain
```

---

## 📈 下一步增强功能（可选，P2 优先级）

以下功能可在 v5.2 核心功能验证成功后实施：

### 1. Industry & Macro 分析师发言
- 修改 `writerIndustryV3.js` 和 `writerMacroV3.js`
- 加入至少1次 analyst 引用
- 目标长度：400-700 词

### 2. Analyst Commentary 结尾页
- 在 Analyst View 页面增加独立段落
- 使用第一人称或显式分析师引用
- 总结核心观点和评级

### 3. Text Cleaner 保护机制
- 修改 `textCleanerEngine.js`
- 保护包含 analyst 名称的句子不被 repetition cleaner 删除

---

## ✅ 部署检查清单

部署前请确认：
- [ ] 在 Replit 执行 `git status` 确认所有文件已修改
- [ ] 在 Replit 执行 `git add v3_dev/` 暂存文件
- [ ] 在 Replit 执行 `git commit -m "..."` 提交
- [ ] 在 Replit 执行 `git push origin main` 推送到远程
- [ ] 在生产服务器执行 `git pull origin main` 拉取代码
- [ ] 在生产服务器执行 `pm2 restart usis-brain` 重启
- [ ] 在生产服务器执行 `pm2 logs usis-brain` 查看日志
- [ ] 通过 Telegram 测试一份报告（建议：NVDA）
- [ ] 验证 Investment Thesis 和 Company Overview 包含分析师引用
- [ ] 验证内容长度符合要求（thesis ≥900, overview ≥800）

---

**部署日期**：2025-11-19  
**版本号**：v5.2 Analyst Voice  
**状态**：✅ Ready for Production Deployment
