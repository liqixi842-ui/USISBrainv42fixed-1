// 简化测试Bot - 验证技术分析修复

const { Telegraf } = require('telegraf');
const { generateStockChart } = require('./stockChartService');
const { calculateTechnicalLevels } = require('./technicalLevels');
const { fetchMarketData } = require('./dataBroker');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN_TEST || process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ 需要 TELEGRAM_BOT_TOKEN_TEST 或 TELEGRAM_BOT_TOKEN');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

console.log('🚀 简化测试Bot启动中...');

// 处理所有文本消息
bot.on('text', async (ctx) => {
  const userInput = ctx.message.text;
  const userId = ctx.from.id;
  
  console.log(`📨 收到消息 [${userId}]: ${userInput}`);
  
  try {
    // 简单识别股票代码
    const symbol = userInput.toUpperCase().match(/[A-Z]{1,5}/)?.[0];
    
    if (!symbol) {
      await ctx.reply('请发送股票代码，例如：AAPL 或 给出苹果支撑压力建议');
      return;
    }
    
    await ctx.reply('🧠 正在分析...');
    
    // 1. 获取市场数据
    const marketData = await fetchMarketData([symbol]);
    const stockData = marketData[symbol];
    
    if (!stockData || !stockData.c) {
      await ctx.reply(`❌ 无法获取 ${symbol} 的市场数据`);
      return;
    }
    
    // 2. 计算技术分析
    const technicalLevels = calculateTechnicalLevels(stockData);
    
    // 3. 生成分析报告
    let analysis = `【${symbol} 技术分析】\n\n`;
    analysis += `💰 当前价格：$${stockData.c.toFixed(2)}\n`;
    analysis += `📊 涨跌幅：${stockData.dp >= 0 ? '+' : ''}${stockData.dp.toFixed(2)}%\n\n`;
    
    analysis += `【关键价位】\n`;
    analysis += `🔴 压力位2：$${technicalLevels.r2.toFixed(2)}\n`;
    analysis += `🔴 压力位1：$${technicalLevels.r1.toFixed(2)}\n`;
    analysis += `⚪ 枢轴点：$${technicalLevels.pivot.toFixed(2)}\n`;
    analysis += `🟢 支撑位1：$${technicalLevels.s1.toFixed(2)}\n`;
    analysis += `🟢 支撑位2：$${technicalLevels.s2.toFixed(2)}\n\n`;
    
    analysis += `【操作建议】\n`;
    const currentPrice = stockData.c;
    if (currentPrice > technicalLevels.r1) {
      analysis += `• 当前价格突破压力位R1，关注${technicalLevels.r2.toFixed(2)}能否突破\n`;
      analysis += `• 止盈位建议：$${technicalLevels.r2.toFixed(2)}\n`;
    } else if (currentPrice < technicalLevels.s1) {
      analysis += `• 当前价格跌破支撑位S1，关注${technicalLevels.s2.toFixed(2)}支撑强度\n`;
      analysis += `• 止损位建议：$${technicalLevels.s2.toFixed(2)}\n`;
    } else {
      analysis += `• 当前在枢轴点附近震荡\n`;
      analysis += `• 上方压力：$${technicalLevels.r1.toFixed(2)}\n`;
      analysis += `• 下方支撑：$${technicalLevels.s1.toFixed(2)}\n`;
    }
    
    analysis += `\n✅ 数据来源：Finnhub实时行情 + Pivot Points算法`;
    
    await ctx.reply(analysis);
    console.log(`✅ 成功发送分析给用户 ${userId}`);
    
  } catch (error) {
    console.error('❌ 处理消息失败:', error);
    await ctx.reply(`抱歉，分析时出现错误：${error.message}`);
  }
});

// 启动Bot
bot.launch()
  .then(() => {
    console.log('✅ 简化测试Bot运行中');
    console.log('📱 请在Telegram中发送消息测试');
  })
  .catch(err => {
    console.error('❌ Bot启动失败:', err);
    process.exit(1);
  });

// 优雅关闭
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
