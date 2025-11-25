# 🔧 TradingView Black Friday 弹窗修复 - 执行总结

## 📋 问题诊断

### 发现的问题
- **现象**：n8n 截图返回 Black Friday 广告，而不是 K 线图
- **根本原因**：
  - 当前 workflow 使用 **ScreenshotAPI.net** 外部服务
  - 该服务**无法注入自定义 JS 代码**来关闭弹窗
  - TradingView 的弹窗遮住了整个图表

### 当前架构
```
n8n Workflow: "USIS Brain v6.0 - Stock Screenshot Only"
├─ ID: 94XFa6PjmmbNI3a6
├─ Webhook: /webhook/stock_analysis_full
├─ 节点结构:
│  ├─ 📥 Webhook 接收请求
│  ├─ 📊 Code 提取参数
│  ├─ 📸 HTTP Request → ScreenshotAPI.net ❌ (无法注入 JS)
│  ├─ 📦 Code 格式化响应
│  └─ 📤 Webhook 返回结果
```

---

## ✅ 推荐修复方案

### **方案 1：手动在 n8n UI 中修改（最简单）**

#### 步骤：
1. 登录 n8n: https://qian.app.n8n.cloud/
2. 打开 workflow: "USIS Brain v6.0 - Stock Screenshot Only"
3. 找到节点: `📸 截图个股K线图`
4. 在 Query Parameters 中添加：
   - **Name**: `delay`
   - **Value**: `8000` (增加到 8 秒，等待弹窗消失)
5. **或者**添加（如果 ScreenshotAPI 支持）：
   - **Name**: `js_code`
   - **Value**: (见 TRADINGVIEW_POPUP_FIX_GUIDE.md)
6. 保存并测试

**优点：** 改动最小，不需要代码  
**缺点：** 可能无效（取决于 ScreenshotAPI 功能）  
**测试：** `解票 NVDA` 看是否正常

---

### **方案 2：替换为 Browserless 节点（推荐，完全控制）**

#### 前提条件：
- 需要 Browserless API token（或使用 n8n Playwright 节点）
- n8n 支持 Browserless Cloud 集成

#### 执行步骤：

**1. 在 n8n UI 中：**
   - 删除 `📸 截图个股K线图` 节点
   - 添加新节点: **Browserless** 或 **Playwright**
   - 配置 Page Function（见 TRADINGVIEW_POPUP_FIX_GUIDE.md 第 2 节）

**2. 关键配置：**
```javascript
// Page Function 中注入弹窗关闭逻辑
await page.waitForTimeout(3000);

// 点击关闭按钮
const closeBtn = await page.$('button[aria-label="Close"]');
if (closeBtn) await closeBtn.click();

// 删除覆盖元素
await page.evaluate(() => {
  document.querySelectorAll('#overlap-manager-root, div[role="dialog"]')
    .forEach(el => {
      if (el.getBoundingClientRect().width > 400) el.remove();
    });
});

// 截图
const screenshot = await page.screenshot({ type: 'png' });
return { screenshot: screenshot.toString('base64') };
```

**优点：** 完全控制，可靠  
**缺点：** 需要 API token，配置稍复杂  
**成功率：** 99%

---

## 📁 已创建的文件

### 1. **fix-n8n-tv-popup.js** (自动修复脚本 - 未成功)
- **功能**: 尝试通过 n8n API 自动修改 workflow
- **结果**: 失败（n8n API 返回 HTTP 400）
- **原因**: workflow 格式或 API 限制
- **状态**: ❌ 不可用

### 2. **fix-screenshotapi-popup.js** (ScreenshotAPI 参数修复 - 部分成功)
- **功能**: 添加 `execute` 和 `delay` 参数
- **结果**: 成功修改 workflow，但保存失败 (HTTP 400)
- **原因**: n8n API 拒绝保存（可能是参数验证失败）
- **状态**: ⚠️  需要手动在 UI 中操作

### 3. **TRADINGVIEW_POPUP_FIX_GUIDE.md** (详细修复指南)
- **内容**: 完整的手动修复步骤
- **包含**: 两种方案的详细操作流程
- **状态**: ✅ 可用

### 4. **inspect-n8n-workflow.js** (Workflow 检查工具)
- **功能**: 查看 workflow 结构
- **输出**: workflow-definition.json
- **状态**: ✅ 已完成

### 5. **test-screenshot-current.js** (测试脚本)
- **功能**: 测试当前截图效果
- **用法**: `node test-screenshot-current.js`
- **输出**: PNG 文件供检查
- **状态**: ✅ 可用

### 6. **workflow-definition.json** (Workflow 完整定义)
- **内容**: 当前 workflow 的 JSON 定义
- **用途**: 备份和分析
- **状态**: ✅ 已保存

---

## 🧪 测试步骤

### 修复后测试：

#### 1. 功能测试
在 Telegram 中发送：
```
解票 NVDA
解票 AAPL
解票 TSLA
```

#### 2. 检查清单
- [ ] 图片包含完整的 K 线图
- [ ] 没有 Black Friday 广告覆盖
- [ ] 图表清晰可读
- [ ] 响应时间 30-60 秒

#### 3. 自动化测试
运行：
```bash
node test-screenshot-current.js
```
检查生成的 PNG 文件。

---

## 📊 修复优先级

### 🔴 **立即执行（推荐）**
1. **手动在 n8n UI 中增加 delay 参数**
   - 时间：5 分钟
   - 成功率：50%
   - 风险：低

2. **如果方案 1 失败，替换为 Browserless 节点**
   - 时间：30 分钟
   - 成功率：99%
   - 风险：中（需要 API token）

### 🟡 **备选方案**
3. **联系 ScreenshotAPI 支持**
   - 询问是否支持 `js_code` 或 `execute` 参数
   - 获取弹窗绕过方案

4. **自建 Browserless 服务**
   - 使用 Docker 部署 Browserless
   - 完全免费，但需要服务器资源

---

## 🔗 相关资源

| 文件 | 说明 | 状态 |
|------|------|------|
| `TRADINGVIEW_POPUP_FIX_GUIDE.md` | 详细修复指南 | ✅ 可用 |
| `fix-n8n-tv-popup.js` | 自动修复脚本 (失败) | ❌ 不可用 |
| `fix-screenshotapi-popup.js` | 参数修复脚本 (部分失败) | ⚠️  参考 |
| `test-screenshot-current.js` | 测试脚本 | ✅ 可用 |
| `workflow-definition.json` | Workflow 备份 | ✅ 已保存 |

---

## ⚡ 快速行动指南

### 现在立即执行：

**1. 登录 n8n**
```
https://qian.app.n8n.cloud/
```

**2. 打开 Workflow**
```
名称: USIS Brain v6.0 - Stock Screenshot Only
ID: 94XFa6PjmmbNI3a6
```

**3. 修改节点**
```
节点: 📸 截图个股K线图
参数: delay = 8000 (从 3000 改为 8000)
```

**4. 保存并测试**
```
Telegram: 解票 NVDA
```

**5. 检查结果**
- 图片是否正常
- 是否仍有广告

---

## ❓ 故障排查

### 问题 1：仍然有弹窗
**解决**：增加 delay 到 10000 或使用 Browserless 方案

### 问题 2：图片空白
**解决**：检查 TradingView URL 是否正确

### 问题 3：响应超时
**解决**：检查 n8n execution logs，可能是网络问题

---

## 📞 需要帮助？

如果手动修复遇到问题，可以：
1. 查看 `TRADINGVIEW_POPUP_FIX_GUIDE.md` 详细步骤
2. 运行 `node test-screenshot-current.js` 检查当前效果
3. 检查 n8n execution logs 查看错误信息

---

**最后更新**: 2025-01-19  
**状态**: ⏳ 待手动修复
