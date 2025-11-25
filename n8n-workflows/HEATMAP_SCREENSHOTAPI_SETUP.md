# 🔧 热力图 ScreenshotAPI Workflow 设置指南

## 📋 问题描述
之前的热力图截图服务无论传入什么 `dataset` 参数（DJI、NAS100、IBEX35），都返回默认的 S&P500 热力图，并且带有 Black Friday 弹窗。

## ✅ 解决方案
创建了新的 n8n workflow：`heatmap-screenshotapi.json`，修复了以下问题：

### 1. **动态 URL 传参** ✅
```json
{
  "name": "url",
  "value": "={{ $json.tradingview_url }}"
}
```
- ✅ 使用 `{{ $json.tradingview_url }}` 动态表达式
- ✅ 不再硬编码 URL
- ✅ 正确传递 dataset 参数

### 2. **缓存控制** ✅
```json
{
  "name": "fresh",
  "value": "true"
}
```
- ✅ `fresh=true` 强制绕过 ScreenshotAPI 缓存
- ✅ 确保每次请求都是最新截图

### 3. **弹窗处理** ✅
```json
{
  "name": "delay",
  "value": "2000"
},
{
  "name": "wait_for_event",
  "value": "networkidle"
}
```
- ✅ `delay=2000` 延迟 2 秒等待弹窗消失
- ✅ `wait_for_event=networkidle` 等待网络空闲（确保页面完全加载）

### 4. **调试日志** ✅
- ✅ 在"提取并记录URL"节点打印传入的 URL 和 dataset
- ✅ 在"格式化响应"节点打印截图完成信息
- ✅ 方便排查问题

## 📥 导入到 n8n

### 方法 1: 通过 n8n UI 导入
1. 登录你的 n8n 实例：`https://qian.app.n8n.cloud`
2. 点击右上角 **"+"** → **"Import from File"**
3. 上传 `n8n-workflows/heatmap-screenshotapi.json`
4. 激活 workflow（点击右上角的开关）

### 方法 2: 通过 n8n API 导入（如果你有 API 访问权限）
```bash
curl -X POST https://qian.app.n8n.cloud/api/v1/workflows \
  -H "X-N8N-API-KEY: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d @n8n-workflows/heatmap-screenshotapi.json
```

## 🔑 环境变量配置

在 n8n 中设置以下环境变量：

```bash
SCREENSHOT_API_KEY=HHBYB5H-4CT4970-MVZEKM2-EMEWEXX
```

或者在 workflow JSON 中直接替换：
```json
{
  "name": "token",
  "value": "={{ $env.SCREENSHOT_API_KEY }}"
}
```

改为：
```json
{
  "name": "token",
  "value": "HHBYB5H-4CT4970-MVZEKM2-EMEWEXX"
}
```

## 🔗 Webhook URL

导入后，你的 webhook URL 将是：
```
https://qian.app.n8n.cloud/webhook/capture_heatmap_screenshotapi
```

## 🔄 更新 Replit 代码

修改 `screenshotProviders.js` 中的 webhook URL：

```javascript
// 旧的（Browserless）
const n8nWebhook = process.env.N8N_HEATMAP_WEBHOOK || 'https://qian.app.n8n.cloud/webhook/capture_heatmap';

// 新的（ScreenshotAPI）
const n8nWebhook = process.env.N8N_HEATMAP_WEBHOOK || 'https://qian.app.n8n.cloud/webhook/capture_heatmap_screenshotapi';
```

或者在 Replit Secrets 中设置：
```bash
N8N_HEATMAP_WEBHOOK=https://qian.app.n8n.cloud/webhook/capture_heatmap_screenshotapi
```

## 🧪 测试

### 测试命令（在 Telegram）：
1. `纳指科技股热力图` → 应返回 NAS100 热力图
2. `西班牙IBEX金融板块热力图` → 应返回 IBEX35 热力图
3. `道指热力图` → 应返回 DJ30 热力图

### 预期 URL 格式：
```
https://www.tradingview.com/heatmap/stock/?dataset=NAS100&color=change&...
https://www.tradingview.com/heatmap/stock/?dataset=IBEX35&color=change&...
https://www.tradingview.com/heatmap/stock/?dataset=DJ30&color=change&...
```

### 验证日志（在 n8n 执行日志中）：
```
📥 [N8N] 收到热力图请求
   URL: https://www.tradingview.com/heatmap/stock/?dataset=NAS100&...
   Dataset: NAS100
✅ [N8N] 截图完成
   Dataset: NAS100
   文件大小: 234.56 KB
   Base64 长度: 321234
```

## 📊 URL 模板

这个 workflow 使用的 URL 模板是：

```
{{ $json.tradingview_url }}
```

这意味着 Replit 需要传递完整的 TradingView URL，例如：
```json
{
  "url": "https://www.tradingview.com/heatmap/stock/?dataset=NAS100&color=change&dataset_type=cfd&exchange=US&group=sector&size=market_cap_basic"
}
```

## 🚨 常见问题

### Q: 还是返回 S&P500？
A: 检查 n8n 执行日志，确认：
1. URL 是否正确传递（查看"提取并记录URL"节点日志）
2. ScreenshotAPI 是否收到了正确的 URL（查看 HTTP Request 节点日志）

### Q: 还是有 Black Friday 弹窗？
A: 增加 `delay` 参数值：
```json
{
  "name": "delay",
  "value": "3000"  // 从 2000 增加到 3000
}
```

### Q: 截图超时？
A: 增加 timeout 值：
```json
"options": {
  "timeout": 45000  // 从 35000 增加到 45000
}
```

## ✅ 验证清单

- [ ] n8n workflow 已导入并激活
- [ ] SCREENSHOT_API_KEY 环境变量已设置
- [ ] N8N_HEATMAP_WEBHOOK 环境变量已更新
- [ ] 测试纳指热力图（应返回 NAS100）
- [ ] 测试西班牙热力图（应返回 IBEX35）
- [ ] 测试道指热力图（应返回 DJ30）
- [ ] n8n 执行日志显示正确的 dataset

## 📝 技术细节

**ScreenshotAPI 参数说明**：
- `token`: API 密钥
- `url`: 要截图的完整 URL（**动态传参**）
- `fresh=true`: 绕过缓存
- `full_page=false`: 不截取整个页面（热力图只需要可见区域）
- `wait_for_event=networkidle`: 等待网络空闲
- `delay=2000`: 延迟 2 秒（等待弹窗消失）
- `output=image`: 直接返回图片
- `file_type=png`: PNG 格式
- `width=1400`: 宽度 1400px
- `height=900`: 高度 900px

---

**创建时间**: 2025-11-25  
**版本**: 2.0  
**状态**: ✅ 已修复
