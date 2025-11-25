# 🔑 如何正确获取 TradingView Cookie

## ⚠️ 重要：你需要复制正确格式的 Cookie

当前的 Cookie 格式**不正确**，导致 Browserless 返回 500 错误。

---

## ✅ 正确方法：从 Network Headers 复制

### 步骤 1: 登录 TradingView

访问 https://www.tradingview.com/ 并登录你的 Pro 账号。

### 步骤 2: 打开开发者工具

- **Chrome/Edge**: 按 `F12`
- **Firefox**: 按 `F12`
- **Safari**: `Option + Command + I`

### 步骤 3: 切换到 Network 标签

点击 **Network** (网络) 标签。

### 步骤 4: 刷新页面

按 `F5` 刷新页面，让开发者工具捕获网络请求。

### 步骤 5: 找到主请求

在请求列表中，找到并点击 `www.tradingview.com` 或 `tradingview.com` 的主请求（通常是第一个）。

### 步骤 6: 复制 Cookie 字符串

1. 在右侧面板点击 **Headers** (标头)
2. 向下滚动找到 **Request Headers** (请求标头)
3. 找到 `Cookie:` 字段
4. **重要**: 复制 `Cookie:` 后面的**完整字符串**

**正确格式示例**:
```
sessionid=abc123def456; csrftoken=xyz789; _ga=GA1.2.123456789.1234567890; ...
```

每个 cookie 之间用 `; `（分号+空格）分隔，格式是 `name=value`。

---

## ❌ 错误方法：不要从 Application 标签复制

**不要**从 Chrome 的 **Application** → **Cookies** 复制！

那里的格式包含额外的元数据（domain、path、expiry 等），会导致解析错误。

**错误格式示例**:
```
__eoiID=...tradingview.com/2026-05-02T12:28:11.000Z82✓NoneMedium
```
这种格式**无法使用**！

---

## 🔄 更新 Replit Secrets

### 步骤 1: 删除旧的 TRADINGVIEW_COOKIE

1. 在 Replit 左侧栏点击 **Secrets** (🔐)
2. 找到 `TRADINGVIEW_COOKIE`
3. 点击删除（垃圾桶图标）

### 步骤 2: 添加新的正确格式 Cookie

1. 点击 **+ Add new secret**
2. **Key**: `TRADINGVIEW_COOKIE`
3. **Value**: 粘贴刚才从 **Network Headers** 复制的完整 cookie 字符串
4. 点击 **Add secret**

### 步骤 3: 重启 Bot

```bash
pkill -f "node index.js"
node index.js
```

---

## 🧪 测试验证

重启后，运行测试：

```bash
node -e "const { generateStockChart } = require('./stockChartService'); generateStockChart('NVDA').then(r => console.log('✅ Provider:', r.provider)).catch(e => console.error('❌ Error:', e.message));"
```

**成功的标志**:
```
📸 [Browserless Embed] 开始截图（TradingView Pro 模式，8 cookies）: ...
✅ [Browserless Embed] 截图成功: 450 KB
✅ Provider: browserless-tv-embed-pro
```

**失败的标志**:
```
❌ [Browserless Embed] 截图失败: Request failed with status code 500
```

---

## 📸 Chrome 开发者工具截图示例

### 正确位置 ✅

```
Network 标签 → 点击请求 → Headers 标签 → Request Headers → Cookie:
```

**你应该看到**:
```
Cookie: sessionid=abc123; csrftoken=xyz789; _ga=GA1.2.xxx; ...
```

**复制**整行（不包括 `Cookie:` 前缀）。

---

## 🔒 安全提示

- ✅ 将 cookie 存储在 **Replit Secrets** 中
- ❌ 不要在代码中硬编码
- ❌ 不要分享给他人
- ❌ 不要提交到 Git

---

## 🔄 Cookie 过期处理

TradingView cookie 会过期（通常 1-30 天），如果截图再次出现广告：

1. 重新登录 TradingView
2. 按照上述步骤重新获取 cookie
3. 更新 Replit Secrets
4. 重启 bot

---

**更新时间**: 2025-01-19  
**问题**: Cookie 格式错误（从 Application tab 复制）  
**解决方案**: 从 Network → Headers → Cookie 复制正确格式
