/**
 * 🗣 智能对话系统 - Conversation Agent
 * 处理非分析类对话：问候、帮助、闲聊等
 * 版本：v1.0
 */

const fetch = require("node-fetch");
const OPENAI_KEY = process.env.OPENAI_API_KEY;

/**
 * 处理对话类意图
 * @param {string} userText - 用户输入
 * @param {string} intentType - 意图类型（casual, meta, greeting, help）
 * @param {Array} userHistory - 用户历史记录
 * @returns {Promise<Object>} - 对话响应
 */
async function handleConversation(userText, intentType, userHistory = []) {
  console.log(`\n💬 [Conversation Agent] 处理对话: "${userText}" (类型: ${intentType})`);
  
  // 快速响应模式：问候和帮助
  if (intentType === 'greeting' || isGreeting(userText)) {
    return buildGreetingResponse(userHistory);
  }
  
  if (intentType === 'help' || isHelpRequest(userText)) {
    return buildHelpResponse();
  }
  
  if (intentType === 'meta' || isSystemCommand(userText)) {
    return handleSystemCommand(userText);
  }
  
  // 智能闲聊模式：使用AI理解上下文
  if (intentType === 'casual') {
    return await generateCasualResponse(userText, userHistory);
  }
  
  // 默认：友好提示
  return buildDefaultResponse();
}

/**
 * 判断是否为问候语
 */
function isGreeting(text) {
  const greetings = [
    '你好', 'hi', 'hello', '嗨', '您好', 'hey', 
    '早上好', '下午好', '晚上好', '在吗', '在不在'
  ];
  const lowerText = text.toLowerCase().trim();
  return greetings.some(g => lowerText === g || lowerText === g + '!' || lowerText === g + '?');
}

/**
 * 判断是否为帮助请求
 */
function isHelpRequest(text) {
  const helpKeywords = [
    '帮助', 'help', '怎么用', '如何使用', '能做什么', 
    '可以做什么', '功能', '使用方法', '指南', '教程'
  ];
  const lowerText = text.toLowerCase();
  return helpKeywords.some(kw => lowerText.includes(kw));
}

/**
 * 判断是否为系统命令（严格匹配，避免误判）
 */
function isSystemCommand(text) {
  const lowerText = text.toLowerCase().trim();
  
  // 严格匹配完整命令（避免误判金融术语）
  const exactCommands = [
    '清除记忆', '清空历史', '重置', 'reset', 
    'clear memory', 'clear history', 'reset memory'
  ];
  
  // 检查是否完全匹配或以命令开头（后跟空格）
  return exactCommands.some(cmd => {
    const lowerCmd = cmd.toLowerCase();
    return lowerText === lowerCmd || 
           lowerText === lowerCmd + '!' || 
           lowerText.startsWith(lowerCmd + ' ');
  });
}

/**
 * 构建问候响应
 */
function buildGreetingResponse(userHistory) {
  const isReturningUser = userHistory && userHistory.length > 0;
  
  let greeting = '';
  const hour = new Date().getUTCHours();
  
  if (hour >= 0 && hour < 6) greeting = '🌙 晚上好';
  else if (hour >= 6 && hour < 12) greeting = '☀️ 早上好';
  else if (hour >= 12 && hour < 18) greeting = '☀️ 下午好';
  else greeting = '🌆 晚上好';
  
  if (isReturningUser) {
    const lastRequest = userHistory[userHistory.length - 1];
    const lastSymbol = extractSymbolFromHistory(lastRequest);
    
    if (lastSymbol) {
      return {
        type: 'conversation',
        text: `${greeting}！欢迎回来 👋\n\n上次您关注了 **${lastSymbol}**，需要继续分析吗？\n\n或者告诉我您想了解什么！`,
        suggestions: [
          `继续分析${lastSymbol}`,
          '查看今日热门股票',
          '美股市场概览'
        ]
      };
    }
  }
  
  return {
    type: 'conversation',
    text: `${greeting}！我是USIS Brain 🧠\n\n我可以帮您：\n• 📊 分析全球股票（美股、港股、A股等）\n• 📈 生成K线图表和技术分析\n• 📰 获取实时财经新闻\n• 🎨 查看行业热力图\n• 💡 提供持仓建议和操作策略\n\n试试发送股票代码，比如 "AAPL" 或 "TSLA"！`,
    suggestions: [
      '分析AAPL',
      '今日科技股热力图',
      '我可以做什么？'
    ]
  };
}

/**
 * 构建帮助响应
 */
function buildHelpResponse() {
  return {
    type: 'conversation',
    text: `📚 **USIS Brain 使用指南**\n\n**📊 股票分析**\n• 发送股票代码：\`AAPL\`, \`TSLA\`, \`9988.HK\`\n• 中文名称：\`苹果\`, \`特斯拉\`, \`腾讯\`\n• 带指令：\`NVDA 技术分析\`, \`MSFT 最新新闻\`\n\n**💼 持仓建议**\n• \`DKNG 31.51买进，给续抱建议\`\n• \`TSLA被套了，何时止损\`\n• \`AAPL盈利20%，继续持有还是卖出\`\n\n**🎨 市场热力图**\n• \`美股科技板块热力图\`\n• \`西班牙银行板块\`\n\n**📰 新闻资讯**\n• \`AAPL 两小时内新闻\`\n• \`今日影响市场的重大新闻\`\n\n**💡 小提示**\n我会根据您的问题智能判断需要什么分析，直接说就好！`,
    examples: [
      {
        query: 'TSLA',
        description: '完整技术分析 + K线图'
      },
      {
        query: 'NFLX 1093买入，给出建议',
        description: '基于成本的持仓建议'
      },
      {
        query: '美股科技热力图',
        description: '板块表现可视化'
      }
    ]
  };
}

/**
 * 处理系统命令
 */
function handleSystemCommand(text) {
  if (text.includes('清除') || text.includes('清空') || text.includes('reset')) {
    return {
      type: 'system',
      action: 'clear_memory',
      text: '✅ 已清除对话历史和记忆\n\n重新开始吧！有什么我可以帮您的？'
    };
  }
  
  return buildDefaultResponse();
}

/**
 * 生成智能闲聊响应
 */
async function generateCasualResponse(userText, userHistory) {
  try {
    // 构建上下文
    let contextPrompt = `你是USIS Brain，一个专业的金融分析AI助手。用户正在和你闲聊（非股票分析请求）。\n\n`;
    
    if (userHistory && userHistory.length > 0) {
      contextPrompt += `用户最近关注过的股票：\n`;
      const recentSymbols = userHistory.slice(-5).map(h => extractSymbolFromHistory(h)).filter(Boolean);
      if (recentSymbols.length > 0) {
        contextPrompt += recentSymbols.slice(0, 3).join(', ') + '\n\n';
      }
    }
    
    contextPrompt += `用户说: "${userText}"\n\n请用友好、专业的语气回复。如果可以的话，适当引导用户使用你的金融分析功能。回复要简洁、自然、有温度。`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { 
            role: "system", 
            content: "你是USIS Brain，专业的金融分析AI助手。在闲聊时保持友好、专业，适当引导用户了解你的功能。" 
          },
          { role: "user", content: contextPrompt }
        ],
        temperature: 0.7,
        max_tokens: 300
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    const aiResponse = data.choices[0].message.content.trim();
    
    return {
      type: 'conversation',
      text: aiResponse,
      suggestions: [
        '分析热门股票',
        '查看市场热力图',
        '我可以做什么？'
      ]
    };
    
  } catch (error) {
    console.error(`❌ [Conversation Agent] AI响应失败:`, error.message);
    
    // 降级：使用预设响应
    return {
      type: 'conversation',
      text: `😊 我明白了！\n\n虽然我主要专注于金融分析，但很高兴和您聊天。\n\n有需要分析的股票吗？或者想了解市场动态？`,
      suggestions: [
        '分析AAPL',
        '今日市场概览',
        '功能介绍'
      ]
    };
  }
}

/**
 * 构建默认响应
 */
function buildDefaultResponse() {
  return {
    type: 'conversation',
    text: `🤔 抱歉，我没太理解您的意思。\n\n我可以帮您：\n• 分析股票（如 "AAPL"）\n• 查看热力图（如 "科技板块热力图"）\n• 获取新闻（如 "TSLA新闻"）\n• 提供持仓建议（如 "NVDA 500买入，给建议"）\n\n试试发送股票代码或问题！`,
    suggestions: [
      '分析TSLA',
      '功能介绍',
      '美股热力图'
    ]
  };
}

/**
 * 从历史记录中提取股票代码
 */
function extractSymbolFromHistory(record) {
  if (!record) return null;
  
  // 尝试从request_text提取
  if (record.request_text) {
    const symbolMatch = record.request_text.match(/\b([A-Z]{1,5})\b/);
    if (symbolMatch) return symbolMatch[1];
  }
  
  // 尝试从mode判断
  if (record.mode === 'stock' && record.response_text) {
    const symbolMatch = record.response_text.match(/\*\*([A-Z]{1,5})\*\*/);
    if (symbolMatch) return symbolMatch[1];
  }
  
  return null;
}

module.exports = {
  handleConversation,
  isGreeting,
  isHelpRequest,
  isSystemCommand
};
