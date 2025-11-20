# 主管机器人 - 快速开始指南

## 关键代码片段

### 📋 任务1：读取 bots_registry.json

**文件：`manager-bot.js` (第3行)**

```javascript
const botsRegistry = require('./bots_registry.json');
```

**bots_registry.json 结构：**

```json
{
  "manager": {
    "id": "manager",
    "username": "qixizhuguan_bot",
    "role": "主管机器人 / 权限管理 / 机器人通讯录",
    "status": "active"
  },
  "news": {
    "id": "news",
    "username": "chaojilaos_bot",
    "role": "新闻资讯 / 实时推送 / 快速摘要",
    "status": "active"
  },
  "research": {
    "id": "research",
    "username": "qixijiepiao_bot",
    "role": "个股解票 / 深度分析 / 研报生成",
    "status": "active"
  }
}
```

---

### 🤖 任务2：实现 /bots 命令

**文件：`manager-bot.js` (第80-92行)**

```javascript
// /bots 命令 - 显示所有机器人
this.bot.command('bots', async (ctx) => {
  // 权限检查：只允许OWNER使用
  if (!this.canUseCommand(ctx)) {
    return; // 静默忽略未授权用户
  }
  
  // 格式化机器人列表
  const botsList = this.formatBotsList();
  
  // 发送Markdown格式消息
  await ctx.reply(botsList, { 
    parse_mode: 'Markdown',
    data_testid: 'message-bots-list' 
  });
});
```

**格式化函数：`formatBotsList()` (第165-184行)**

```javascript
formatBotsList() {
  let message = '🤖 *当前登记的机器人：*\n\n';
  
  let index = 1;
  for (const [id, bot] of Object.entries(botsRegistry)) {
    const statusIcon = bot.status === 'active' ? '✅' : '⏸️';
    
    message += `*${index})* \`${id}\` — @${bot.username}\n`;
    message += `   角色：${bot.role}\n`;
    message += `   状态：${statusIcon} ${bot.status}\n\n`;
    
    index++;
  }
  
  message += `\n💡 使用 \`/botinfo <id>\` 查看详情`;
  
  return message;
}
```

**输出示例：**

```
🤖 当前登记的机器人：

1) manager — @qixizhuguan_bot
   角色：主管机器人 / 权限管理 / 机器人通讯录
   状态：✅ active

2) news — @chaojilaos_bot
   角色：新闻资讯 / 实时推送 / 快速摘要
   状态：✅ active

3) research — @qixijiepiao_bot
   角色：个股解票 / 深度分析 / 研报生成
   状态：✅ active

💡 使用 /botinfo <id> 查看详情
```

---

### 🔍 任务3：实现 /botinfo <id> 命令

**文件：`manager-bot.js` (第94-117行)**

```javascript
// /botinfo 命令 - 显示单个机器人详情
this.bot.command('botinfo', async (ctx) => {
  // 权限检查：只允许OWNER使用
  if (!this.canUseCommand(ctx)) {
    return;
  }
  
  // 解析命令参数
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    await ctx.reply(
      '❌ 请提供机器人ID\n\n' +
      '用法：/botinfo <id>\n' +
      '示例：/botinfo news',
      { data_testid: 'message-botinfo-error' }
    );
    return;
  }
  
  // 获取机器人ID并格式化信息
  const botId = args[1].toLowerCase();
  const botInfo = this.formatBotInfo(botId);
  
  if (botInfo) {
    await ctx.reply(botInfo, { 
      parse_mode: 'Markdown',
      data_testid: `message-botinfo-${botId}` 
    });
  } else {
    await ctx.reply(
      `❌ 未找到机器人：${botId}\n\n` +
      `使用 /bots 查看所有可用的机器人`,
      { data_testid: 'message-botinfo-notfound' }
    );
  }
});
```

**格式化函数：`formatBotInfo(botId)` (第186-209行)**

```javascript
formatBotInfo(botId) {
  // 从注册表中查找机器人
  const bot = botsRegistry[botId];
  
  if (!bot) {
    return null; // 未找到
  }
  
  const statusIcon = bot.status === 'active' ? '✅' : '⏸️';
  
  // 构建详细信息
  let message = `🤖 *机器人详情*\n\n`;
  message += `*ID:* \`${bot.id}\`\n`;
  message += `*用户名:* @${bot.username}\n`;
  message += `*名称:* ${bot.name}\n`;
  message += `*角色:* ${bot.role}\n`;
  message += `*状态:* ${statusIcon} ${bot.status}\n\n`;
  message += `*描述:*\n${bot.description}\n\n`;
  
  if (bot.notes) {
    message += `*备注:*\n${bot.notes}`;
  }
  
  return message;
}
```

**输出示例：**

```
🤖 机器人详情

ID: news
用户名: @chaojilaos_bot
名称: 新闻机器人
角色: 新闻资讯 / 实时推送 / 快速摘要
状态: ✅ active

描述:
提供实时金融新闻、市场动态和快讯推送

备注:
每2小时推送Top-10新闻摘要，支持ImpactRank智能评分
```

---

### 🔐 任务4：权限规则

**OWNER检查：`isOwner(userId)` (第30-32行)**

```javascript
isOwner(userId) {
  return userId === this.ownerId;
}
```

**授权群组检查：`isAuthorizedGroup(chatId)` (第34-39行)**

```javascript
isAuthorizedGroup(chatId) {
  return this.allowedGroupIds.includes(chatId);
}
```

**综合权限判断：`canUseCommand(ctx)` (第41-59行)**

```javascript
canUseCommand(ctx) {
  const userId = ctx.from?.id;
  const chatType = ctx.chat?.type;
  const chatId = ctx.chat?.id;
  
  // 1. 私聊：只有OWNER可以使用
  if (chatType === 'private') {
    return this.isOwner(userId);
  }
  
  // 2. 群聊：必须是授权的群组 + OWNER身份
  if (chatType === 'group' || chatType === 'supergroup') {
    return this.isAuthorizedGroup(chatId) && this.isOwner(userId);
  }
  
  // 3. 其他情况一律拒绝
  return false;
}
```

**权限流程图：**

```
用户发送命令
    ↓
是否为私聊？
    ├─ 是 → 是否为OWNER？
    │         ├─ 是 → ✅ 允许
    │         └─ 否 → ❌ 静默拒绝
    │
    └─ 否（群聊）→ 是否为授权群组？
                ├─ 是 → 是否为OWNER？
                │       ├─ 是 → ✅ 允许
                │       └─ 否 → ❌ 静默拒绝
                │
                └─ 否 → ❌ 静默拒绝
```

**应用权限检查：**

```javascript
// 每个命令处理器都以此开头
this.bot.command('bots', async (ctx) => {
  // 第一步：权限检查
  if (!this.canUseCommand(ctx)) {
    return; // 静默忽略，不响应，不调用AI，不浪费资源
  }
  
  // 第二步：执行命令逻辑
  // ... 处理逻辑
});
```

---

## 环境变量配置

**在 `.env` 文件中添加：**

```bash
# 主管机器人Token（从 @BotFather 获取）
MANAGER_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# OWNER的Telegram用户ID（从 @userinfobot 获取）
OWNER_TELEGRAM_ID=123456789
```

---

## 运行步骤

### 1. 安装依赖

```bash
npm install telegraf
```

### 2. 配置环境变量

创建或编辑 `.env` 文件，添加上述环境变量。

### 3. 运行测试

```bash
node test-manager-bot.js
```

### 4. 测试命令

在Telegram中向机器人发送：

```
/start
/bots
/botinfo news
/botinfo research
/help
```

---

## 文件结构

```
项目根目录/
├── bots_registry.json          # 机器人注册表（JSON数据）
├── manager-bot.js              # 主管机器人核心代码
├── test-manager-bot.js         # 测试脚本
├── MANAGER_BOT_README.md       # 完整文档
└── MANAGER_BOT_QUICKSTART.md   # 快速开始（本文件）
```

---

## 权限测试场景

### ✅ 场景1：OWNER私聊（应该成功）

```
用户：OWNER (ID: 123456789)
聊天：私聊
命令：/bots
结果：✅ 返回机器人列表
```

### ❌ 场景2：非OWNER私聊（应该静默）

```
用户：其他用户 (ID: 999999999)
聊天：私聊
命令：/bots
结果：❌ 机器人不响应（静默拒绝）
```

### ✅ 场景3：授权群组中的OWNER（应该成功）

```
用户：OWNER (ID: 123456789)
聊天：群聊 (ID: -1001234567890，已授权)
命令：/bots
结果：✅ 返回机器人列表
```

### ❌ 场景4：授权群组中的非OWNER（应该静默）

```
用户：其他用户 (ID: 999999999)
聊天：群聊 (ID: -1001234567890，已授权)
命令：/bots
结果：❌ 机器人不响应（静默拒绝）
```

### ❌ 场景5：非授权群组中的OWNER（应该静默）

```
用户：OWNER (ID: 123456789)
聊天：群聊 (ID: -1009999999999，未授权)
命令：/bots
结果：❌ 机器人不响应（静默拒绝）
```

---

## 常用操作

### 添加授权群组

```javascript
const ManagerBot = require('./manager-bot');

const bot = new ManagerBot({
  token: process.env.MANAGER_BOT_TOKEN,
  ownerId: process.env.OWNER_TELEGRAM_ID,
  allowedGroupIds: []
});

// 动态添加授权群组
bot.addAuthorizedGroup(-1001234567890);
bot.addAuthorizedGroup(-1009876543210);

await bot.start();
```

### 获取群组ID

在群组中临时添加此代码：

```javascript
this.bot.on('message', (ctx) => {
  console.log('Chat ID:', ctx.chat.id);
  console.log('Chat Type:', ctx.chat.type);
});
```

---

## 完成✅

现在您已经拥有：

✅ **bots_registry.json** - 机器人注册表  
✅ **manager-bot.js** - 完整的主管机器人代码  
✅ **test-manager-bot.js** - 测试脚本  
✅ **/bots 命令** - 显示所有机器人  
✅ **/botinfo 命令** - 显示单个机器人详情  
✅ **权限控制** - OWNER私聊 + 授权群聊  
✅ **静默策略** - 未授权用户不响应，不浪费资源  

**下一步：**
1. 配置环境变量
2. 运行测试脚本
3. 在Telegram中测试命令
4. 添加授权群组（如需）

有问题请参考 `MANAGER_BOT_README.md` 完整文档！
