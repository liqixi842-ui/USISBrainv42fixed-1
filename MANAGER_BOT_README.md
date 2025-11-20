# 主管机器人 (Manager Bot)

**@qixizhuguan_bot**

## 功能概述

主管机器人是一个机器人集群的管理中心，负责：
- 📋 机器人通讯录管理
- 🔐 权限控制（OWNER私聊 + 授权群聊）
- 📊 机器人状态监控

## 已登记的机器人

| ID | 用户名 | 角色 | 状态 |
|---|---|---|---|
| manager | @qixizhuguan_bot | 主管机器人 / 权限管理 / 机器人通讯录 | ✅ active |
| news | @chaojilaos_bot | 新闻资讯 / 实时推送 / 快速摘要 | ✅ active |
| research | @qixijiepiao_bot | 个股解票 / 深度分析 / 研报生成 | ✅ active |

## 可用命令

### `/bots` - 显示所有机器人

显示当前登记的所有机器人列表，包括：
- 机器人ID
- 用户名
- 角色描述
- 运行状态

**示例输出：**
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
```

### `/botinfo <id>` - 查看机器人详情

显示指定机器人的详细信息。

**用法：**
```
/botinfo news
/botinfo research
/botinfo manager
```

**示例输出：**
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

### `/help` - 帮助信息

显示命令列表和权限说明。

## 权限规则

### 私聊模式
- ✅ **仅OWNER可使用**
- ❌ 其他用户：不响应、不消耗资源

### 群聊模式
- ✅ **授权群组 + OWNER身份**：可使用所有命令
- ❌ 非授权群组：不响应任何消息
- ❌ 授权群组但非OWNER：不响应命令

### 权限判断逻辑

```javascript
// 1. 检查是否为OWNER
isOwner(userId) {
  return userId === this.ownerId;
}

// 2. 检查是否在授权群组
isAuthorizedGroup(chatId) {
  return this.allowedGroupIds.includes(chatId);
}

// 3. 综合权限判断
canUseCommand(ctx) {
  const userId = ctx.from?.id;
  const chatType = ctx.chat?.type;
  const chatId = ctx.chat?.id;
  
  // 私聊：只有OWNER可用
  if (chatType === 'private') {
    return this.isOwner(userId);
  }
  
  // 群聊：授权群组 + OWNER身份
  if (chatType === 'group' || chatType === 'supergroup') {
    return this.isAuthorizedGroup(chatId) && this.isOwner(userId);
  }
  
  return false;
}
```

## 安装和配置

### 1. 环境变量

在 `.env` 文件中添加：

```bash
# 主管机器人Token（从 @BotFather 获取）
MANAGER_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# OWNER的Telegram用户ID
OWNER_TELEGRAM_ID=123456789
```

### 2. 安装依赖

```bash
npm install telegraf
```

### 3. 运行机器人

**方式1：独立运行**
```bash
node manager-bot.js
```

**方式2：测试模式**
```bash
node test-manager-bot.js
```

**方式3：集成到主项目**
```javascript
const ManagerBot = require('./manager-bot');

const managerBot = new ManagerBot({
  token: process.env.MANAGER_BOT_TOKEN,
  ownerId: process.env.OWNER_TELEGRAM_ID,
  allowedGroupIds: [-1001234567890] // 授权的群组ID
});

await managerBot.start();
```

## 代码结构

### 核心文件

```
.
├── bots_registry.json      # 机器人注册表
├── manager-bot.js          # 主管机器人核心代码
├── test-manager-bot.js     # 测试脚本
└── MANAGER_BOT_README.md   # 说明文档
```

### 关键代码片段

#### 1. 读取 bots_registry.json

```javascript
const botsRegistry = require('./bots_registry.json');

// botsRegistry 结构：
// {
//   "manager": { id, username, name, role, status, ... },
//   "news": { ... },
//   "research": { ... }
// }
```

#### 2. /bots 命令实现

```javascript
this.bot.command('bots', async (ctx) => {
  // 权限检查
  if (!this.canUseCommand(ctx)) {
    return; // 静默忽略
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

#### 3. /botinfo 命令实现

```javascript
this.bot.command('botinfo', async (ctx) => {
  // 权限检查
  if (!this.canUseCommand(ctx)) {
    return;
  }
  
  // 解析参数
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    await ctx.reply('❌ 请提供机器人ID\n\n用法：/botinfo <id>');
    return;
  }
  
  const botId = args[1].toLowerCase();
  const botInfo = this.formatBotInfo(botId);
  
  if (botInfo) {
    await ctx.reply(botInfo, { parse_mode: 'Markdown' });
  } else {
    await ctx.reply(`❌ 未找到机器人：${botId}`);
  }
});
```

#### 4. 权限判断代码

```javascript
canUseCommand(ctx) {
  const userId = ctx.from?.id;
  const chatType = ctx.chat?.type;
  const chatId = ctx.chat?.id;
  
  // 1. 私聊：只有OWNER可以使用
  if (chatType === 'private') {
    return this.isOwner(userId);
  }
  
  // 2. 群聊：必须是授权的群组
  if (chatType === 'group' || chatType === 'supergroup') {
    return this.isAuthorizedGroup(chatId) && this.isOwner(userId);
  }
  
  return false;
}
```

## 管理授权群组

### 添加授权群组

```javascript
// 获取群组ID：在群组中发送消息，通过ctx.chat.id获取
managerBot.addAuthorizedGroup(-1001234567890);
```

### 移除授权群组

```javascript
managerBot.removeAuthorizedGroup(-1001234567890);
```

### 查看授权群组列表

```javascript
console.log('授权群组:', managerBot.allowedGroupIds);
```

## 测试指南

### 1. 私聊测试

1. 以OWNER身份在Telegram中找到机器人
2. 发送 `/start` - 应该收到欢迎消息
3. 发送 `/bots` - 应该看到机器人列表
4. 发送 `/botinfo news` - 应该看到新闻机器人详情

### 2. 非OWNER私聊测试

1. 使用另一个账号与机器人私聊
2. 发送任何命令 - 机器人应该静默（不响应）

### 3. 授权群组测试

1. 将机器人添加到一个群组
2. 获取群组ID并添加到授权列表
3. OWNER在群组中发送 `/bots` - 应该正常响应
4. 其他成员发送命令 - 机器人应该静默

### 4. 非授权群组测试

1. 将机器人添加到未授权的群组
2. OWNER发送命令 - 机器人应该静默
3. 其他成员发送命令 - 机器人应该静默

## 扩展功能

### 添加新机器人

编辑 `bots_registry.json`：

```json
{
  "trading": {
    "id": "trading",
    "username": "qixitrade_bot",
    "name": "交易机器人",
    "role": "自动交易 / 策略执行 / 风控管理",
    "description": "提供自动化交易和策略执行",
    "status": "active",
    "notes": "支持多种交易策略和风控规则"
  }
}
```

### 添加新命令

```javascript
this.bot.command('status', async (ctx) => {
  if (!this.canUseCommand(ctx)) {
    return;
  }
  
  // 实现状态检查逻辑
  const activeCount = Object.values(botsRegistry)
    .filter(bot => bot.status === 'active').length;
    
  await ctx.reply(
    `📊 机器人状态统计\n\n` +
    `总数: ${Object.keys(botsRegistry).length}\n` +
    `激活: ${activeCount}\n` +
    `暂停: ${Object.keys(botsRegistry).length - activeCount}`
  );
});
```

## 常见问题

### Q: 如何获取OWNER的Telegram ID？

A: 使用 [@userinfobot](https://t.me/userinfobot)，发送任意消息即可获取您的用户ID。

### Q: 如何获取群组ID？

A: 
1. 将机器人添加到群组
2. 在代码中打印 `ctx.chat.id`
3. 或使用现有的工具机器人获取

### Q: 为什么机器人不响应命令？

A: 检查以下项：
1. 是否为OWNER（用户ID匹配）
2. 私聊模式下是否已登录正确账号
3. 群聊模式下群组是否已授权
4. 环境变量是否正确配置

### Q: 如何批量管理授权群组？

A: 在初始化时提供群组ID列表：

```javascript
const managerBot = new ManagerBot({
  token: process.env.MANAGER_BOT_TOKEN,
  ownerId: process.env.OWNER_TELEGRAM_ID,
  allowedGroupIds: [
    -1001234567890,  // 群组1
    -1009876543210   // 群组2
  ]
});
```

## 技术栈

- **Node.js** - 运行环境
- **Telegraf** - Telegram Bot框架
- **JSON** - 机器人注册表存储

## 安全建议

1. ✅ **保护Token**：不要将MANAGER_BOT_TOKEN提交到Git
2. ✅ **验证OWNER**：确保OWNER_TELEGRAM_ID设置正确
3. ✅ **群组白名单**：只授权可信的群组
4. ✅ **静默策略**：对未授权用户不响应（避免泄露信息）
5. ✅ **日志审计**：记录所有管理操作

## 更新日志

- **v1.0** (2025-01-19)
  - ✅ 实现基础机器人通讯录
  - ✅ 实现 /bots 和 /botinfo 命令
  - ✅ 实现OWNER权限控制
  - ✅ 实现群组白名单机制
  - ✅ 添加测试脚本和文档

## License

MIT
