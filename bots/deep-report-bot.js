const { generateHybridReport } = require('../deepHybridReportController');
const { renderHybridReportPDF } = require('../deepHybridReportRenderer');

async function handleDeepReport(args, chatId, bot, message) {
  const startTime = Date.now();
  const symbol = args[0]?.toUpperCase();
  
  console.log(`\n🏛️  ═══════════════════════════════════════════════════`);
  console.log(`   DEEP REPORT BOT - Institutional Hybrid Report`);
  console.log(`   ═══════════════════════════════════════════════════`);
  console.log(`   Symbol: ${symbol || 'NOT PROVIDED'}`);
  console.log(`   Chat ID: ${chatId}`);
  console.log(`   Timestamp: ${new Date().toISOString()}`);
  console.log(`   ═══════════════════════════════════════════════════\n`);

  if (!symbol) {
    await bot.sendMessage(chatId, 
      `❌ 请提供股票代码\n\n` +
      `用法示例：\n` +
      `• 机构研报 NVDA\n` +
      `• deep AAPL\n` +
      `• /deep TSLA\n\n` +
      `_USIS Brain v7 Hybrid 机构研报_`,
      { parse_mode: 'Markdown' }
    );
    return { success: false, error: 'No symbol provided' };
  }

  const statusMsg = await bot.sendMessage(chatId,
    `🏛️ *正在生成机构级混合研报...*\n\n` +
    `📊 股票代码: \`${symbol}\`\n` +
    `⏳ 预计时间: 60-90秒\n\n` +
    `_正在收集市场数据并进行AI分析..._`,
    { parse_mode: 'Markdown' }
  );

  try {
    await bot.editMessageText(
      `🏛️ *正在生成机构级混合研报...*\n\n` +
      `📊 股票代码: \`${symbol}\`\n` +
      `⏳ 阶段 1/3: 收集市场数据...`,
      { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown' }
    );

    const reportData = await generateHybridReport(symbol, {});

    await bot.editMessageText(
      `🏛️ *正在生成机构级混合研报...*\n\n` +
      `📊 股票代码: \`${symbol}\`\n` +
      `⏳ 阶段 2/3: 渲染PDF报告...`,
      { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown' }
    );

    const pdfBuffer = await renderHybridReportPDF(reportData);

    await bot.editMessageText(
      `🏛️ *正在生成机构级混合研报...*\n\n` +
      `📊 股票代码: \`${symbol}\`\n` +
      `⏳ 阶段 3/3: 发送报告...`,
      { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown' }
    );

    const duration = Date.now() - startTime;
    const caption = `${symbol} 机构级研报已生成（USIS v7 Hybrid）\n\n` +
      `📊 模块数量: ${reportData.modules.length}\n` +
      `⏱️ 生成耗时: ${(duration / 1000).toFixed(1)}s\n` +
      `📅 日期: ${reportData.date}`;

    await bot.sendDocument(chatId, pdfBuffer, {
      caption,
      filename: `${symbol}_Institutional_Report_${new Date().toISOString().split('T')[0]}.pdf`
    }, {
      contentType: 'application/pdf'
    });

    await bot.deleteMessage(chatId, statusMsg.message_id);

    console.log(`\n✅ [DEEP REPORT BOT] Report generated successfully`);
    console.log(`   ├─ Symbol: ${symbol}`);
    console.log(`   ├─ Modules: ${reportData.modules.length}`);
    console.log(`   ├─ Duration: ${duration}ms`);
    console.log(`   └─ PDF Size: ${(pdfBuffer.length / 1024).toFixed(1)} KB\n`);

    return {
      success: true,
      type: 'deep_report',
      symbol,
      duration,
      moduleCount: reportData.modules.length,
      pdfSize: pdfBuffer.length
    };

  } catch (error) {
    console.error(`\n❌ [DEEP REPORT BOT] Error generating report`);
    console.error(`   ├─ Symbol: ${symbol}`);
    console.error(`   ├─ Error: ${error.message}`);
    console.error(`   └─ Stack: ${error.stack}\n`);

    try {
      await bot.editMessageText(
        `❌ *生成失败*\n\n` +
        `股票代码: \`${symbol}\`\n` +
        `错误信息: ${error.message}\n\n` +
        `请稍后重试或联系管理员。`,
        { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown' }
      );
    } catch (editError) {
      await bot.sendMessage(chatId,
        `❌ 生成 ${symbol} 机构研报失败\n\n` +
        `错误: ${error.message}\n\n` +
        `请稍后重试。`
      );
    }

    return {
      success: false,
      type: 'deep_report',
      symbol,
      error: error.message,
      duration: Date.now() - startTime
    };
  }
}

module.exports = { handleDeepReport };
