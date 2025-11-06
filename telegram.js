// Telegram Bot 集成 - v4.5 防崩溃版
// 使用 Telegraf 轮询 + 单例守护 + 完整错误捕获

const { Telegraf } = require('telegraf');
const fetch = require('node-fetch');

let botInstance = null;

// 热力图检测函数
const isHeatmapRequest = (text) => {
  return text.includes('热力图') || 
         text.toLowerCase().includes('heatmap') || 
         text === '/heatmap';
};

// 热力图专用处理
async function handleHeatmapRequest(ctx, text) {
  console.log(`🎨 [Heatmap] 处理请求: "${text}"`);
  
  // 🔍 检测诊断模式
  const hasDebugFlag = /#dbg/i.test(text);
  
  try {
    await ctx.reply(`🎨 正在生成TradingView热力图...${hasDebugFlag ? '\n🔍 诊断模式已启用' : ''}`);
    
    // 调用热力图生成函数（需要从 index.js 导入）
    const { generateSmartHeatmap, generateDebugReport } = require('./index.js');
    
    const result = await generateSmartHeatmap(text);
    
    if (result.buffer) {
      // 发送图片
      await ctx.replyWithPhoto(
        { source: result.buffer },
        { caption: result.caption.slice(0, 1000) }
      );
      
      // 发送详细分析
      await ctx.reply(result.summary);
      
      // 🔍 如果是诊断模式，发送debug报告
      if (hasDebugFlag && result.query) {
        const debugReport = generateDebugReport(text, result.query);
        const reportText = `
🔍 诊断报告
━━━━━━━━━━━━━━━━━━━━
📥 输入:
原文: ${debugReport.input.raw}
规范化: ${debugReport.input.norm}

📊 解析结果:
地区: ${debugReport.parsed.region}
指数: ${debugReport.parsed.index}
板块: ${debugReport.parsed.sector}
置信度: ${debugReport.parsed.confidence}

🎯 触发规则:
${debugReport.parsed.rules_fired.join('\n')}

🌐 动作预览:
数据集: ${debugReport.action_preview.dataset}
期望地区: ${debugReport.action_preview.expected_region}
URL: ${debugReport.action_preview.url.substring(0, 80)}...

🧪 自检样例:
${debugReport.selftest.map((t, i) => `${i+1}. ${t.text.replace(/#dbg/i, '')}\n   → ${t.index} (${t.region}), rules: ${t.rules_fired.slice(0,2).join(', ')}`).join('\n')}
━━━━━━━━━━━━━━━━━━━━
        `.trim();
        await ctx.reply(reportText);
      }
      
      console.log(`✅ [Heatmap] 成功发送 (${result.query.index}, ${result.query.sector})`);
    } else {
      throw new Error('未生成图片buffer');
    }
  } catch (error) {
    console.error(`❌ [Heatmap] 失败:`, error.message);
    console.error('[Heatmap] error stack:', error.stack);
    await ctx.reply(`❌ 热力图生成失败: ${error.message}`);
  }
}

function startTelegramBot({ orchestrateUrl }) {
  if (botInstance) {
    console.log('[TG] bot already running, skip duplicate launch');
    return botInstance;
  }
  
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('[TG] TELEGRAM_BOT_TOKEN missing, skip bot start');
    return null;
  }
  
  const bot = new Telegraf(token, {
    handlerTimeout: 25000 // 避免长 handler 阻塞
  });
  
  // 统一错误捕获
  bot.catch((err, ctx) => {
    console.error('[TG] bot.catch error:', err?.message || err);
    console.error('[TG] error stack:', err?.stack);
    try { 
      ctx?.reply?.('⚠️ 系统繁忙，稍后重试'); 
    } catch (e) {
      console.error('[TG] failed to send error reply:', e.message);
    }
  });
  
  // 文本处理：检测热力图 or 转发到 orchestrate
  bot.on('text', async (ctx) => {
    try {
      const text = ctx.message.text || '';
      const userId = `tg_${ctx.from?.id || 'unknown'}`;
      const chatType = ctx.chat?.type || 'private';
      
      console.log(`\n📨 [TG] 收到消息: "${text}" (用户: ${userId}, chat: ${chatType})`);
      
      // 🎨 热力图请求特殊处理
      if (isHeatmapRequest(text)) {
        await handleHeatmapRequest(ctx, text);
        return; // 提前返回，不继续常规流程
      }
      
      // 🧠 常规分析流程
      await ctx.reply('🧠 正在分析...');
      
      const body = { 
        text, 
        user_id: userId,
        chat_type: chatType,
        mode: 'auto',
        budget: 'low'
      };
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 28000); // 28秒总超时
      
      const res = await fetch(orchestrateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      
      const data = await res.json();
      
      if (!data.ok) {
        await ctx.reply('❌ 系统错误: ' + (data.error || '未知错误'));
        return;
      }
      
      // 处理响应
      const finalText = data.final_text || data.final_analysis || data.text || '无分析结果';
      const imageBuffer = data.image_buffer;
      const imageUrl = data.image_url;
      
      if (imageBuffer) {
        // 发送图片（buffer）
        await ctx.replyWithPhoto(
          { source: Buffer.from(imageBuffer) },
          { caption: finalText.slice(0, 1000) }
        );
      } else if (imageUrl) {
        // 发送图片（URL）
        await ctx.replyWithPhoto(imageUrl, { caption: finalText.slice(0, 1000) });
      } else {
        // 仅文本
        await ctx.reply(finalText);
      }
      
      console.log(`✅ [TG] 成功响应用户 ${userId}`);
      
    } catch (e) {
      console.error('[TG] handler error:', e.message);
      console.error('[TG] error stack:', e.stack);
      try {
        if (e.name === 'AbortError') {
          await ctx.reply('⏱️ 处理超时（28秒），请简化请求或稍后重试');
        } else {
          await ctx.reply('🛡️ 安全模式：处理失败，进程已保护。请稍后重试。');
        }
      } catch (replyErr) {
        console.error('[TG] failed to send error reply:', replyErr.message);
      }
    }
  });
  
  // 仅启用轮询（关闭 webhook），防止模式冲突
  bot.launch({ 
    dropPendingUpdates: true,
    allowedUpdates: ['message']
  }).then(() => {
    console.log('✅ [TG] bot launched (polling mode)');
    console.log('💡 支持智能热力图：直接说"美股的科技股热力图"、"日本大盘热力图"等');
  }).catch((e) => {
    console.error('❌ [TG] launch failed:', e.message);
    console.error('[TG] launch error stack:', e.stack);
  });
  
  // 优雅退出
  const stop = async () => {
    console.log('[TG] Stopping bot...');
    try { 
      await bot.stop('SIGTERM'); 
    } catch (e) {
      console.error('[TG] stop error:', e.message);
    }
    console.log('[TG] bot stopped');
  };
  
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  
  botInstance = bot;
  return bot;
}

module.exports = { startTelegramBot };
