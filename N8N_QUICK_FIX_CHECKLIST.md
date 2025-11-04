# N8N快速修复清单

## 🚨 立即修复（优先级：严重）

### ✅ 修复1：Call_Brain_Orchestrate节点
**位置**：第一个HTTP Request节点

**操作**：添加两个Body Parameters

1. 点击节点 → Body Parameters
2. 点击"Add Parameter"
3. 添加：
   ```
   Name: mode
   Value: premarket
   ```
4. 再次点击"Add Parameter"
5. 添加：
   ```
   Name: budget
   Value: low
   ```

**检查**：现在应该有5个参数（text, chat_type, user_id, mode, budget）

---

### ✅ 修复2：Parse_Brain_Response节点
**位置**：Code节点（第二个）

**操作**：替换JavaScript代码

**完整代码**（直接复制粘贴）：
```javascript

.
```

**检查**：代码中应该包含 `needs_charts` 和 `charts` 字段

---

### ✅ 修复3：添加图表发送节点

**步骤1：添加IF节点**
1. 在Parse_Brain_Response之后添加IF节点
2. 节点名称：`IF_Needs_Charts`
3. 条件：
   ```javascript
   {{ $json.needs_charts }}
   ```

**步骤2：添加Loop节点（连接到True分支）**
1. 节点类型：Loop Over Items
2. 节点名称：`Loop_Charts`
3. 配置：
   - Mode: Loop Over Items
   - Input Field: `charts`
   - Batch Size: 1

**步骤3：添加Telegram Send Photo节点（在Loop内）**
1. 节点类型：Telegram
2. 节点名称：`Send_Chart_Photo`
3. 配置：
   - Operation: Send Photo
   - Chat ID: `={{ $node["Parse_Brain_Response"].json.chat_id }}`
   - Photo: `={{ $json.url }}`
   - Caption: `={{ $json.caption }}`

---

### ✅ 修复4：Twitter授权头
**位置**：Fetch_Twitter_Data节点 → Headers

**操作**：
1. 找到Authorization header
2. 修改Value从：
   ```
   Kh9BmUUhIUAxNHRQ7SuPp0uPc5RVYY5k6HBSupkvKe9IQ
   ```
   改为：
   ```
   Bearer Kh9BmUUhIUAxNHRQ7SuPp0uPc5RVYY5k6HBSupkvKe9IQ
   ```

---

## 🧪 测试步骤

### 测试1：先测试单纯的Brain调用
发送消息：`测试`

**检查**：
- [ ] N8N没有报错
- [ ] 收到了回复（即使内容简单）

### 测试2：测试图表生成
发送消息：`CPI最近怎么样？`

**期望**：
- [ ] 收到1张CPI图表
- [ ] 收到文字分析

### 测试3：测试无图场景
发送消息：`预览下宏观数据`

**期望**：
- [ ] 只收到文字
- [ ] 没有图表

---

## 🔍 如果还是报错

### 检查点1：Brain API是否可访问
用浏览器或Postman访问：
```
https://node-js-liqixi842.replit.app/health
```
应该返回：`{"status":"healthy"}`

### 检查点2：查看N8N执行日志
1. 点击执行记录
2. 查看每个节点的输入/输出
3. 找到第一个报错的节点

### 检查点3：Brain响应格式
在Parse_Brain_Response节点前添加临时节点：
```javascript
console.log('Brain原始响应:', JSON.stringify($json, null, 2));
return [$input.first()];
```

---

## 📞 常见错误及解决

### 错误1："mode is required"
**原因**：修复1未完成
**解决**：检查Call_Brain_Orchestrate节点是否有mode参数

### 错误2："Cannot read property 'charts' of undefined"
**原因**：修复2未完成
**解决**：检查Parse_Brain_Response节点是否包含charts字段

### 错误3："No photo found"
**原因**：修复3未完成或URL格式错误
**解决**：检查Loop_Charts节点配置和Send_Chart_Photo节点的Photo字段

### 错误4：Twitter API返回401
**原因**：修复4未完成
**解决**：检查Authorization header是否以"Bearer "开头

---

## ✅ 完成检查清单

- [ ] Call_Brain_Orchestrate有5个参数（text, chat_type, user_id, mode, budget）
- [ ] Parse_Brain_Response代码包含needs_charts和charts
- [ ] 添加了IF_Needs_Charts节点
- [ ] 添加了Loop_Charts节点
- [ ] 添加了Send_Chart_Photo节点
- [ ] Twitter Authorization改为"Bearer ..."格式
- [ ] 测试发送"CPI怎么样"能收到图表
- [ ] 测试发送"预览宏观数据"只收到文字

---

**全部完成后，系统将实现智能图表发送！** 🎉
