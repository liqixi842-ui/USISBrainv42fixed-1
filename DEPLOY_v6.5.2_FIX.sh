#!/bin/bash
# v6.5.2 Critical Fix - 修复 Manager Bot 使用 v3 正式版而非 v3-dev

echo "🔧 v6.5.2 Critical Fix - 解票功能路由修复"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 修复内容："
echo "✅ Manager Bot 不再调用 v3-dev 慢速路由"
echo "✅ 改用 v3 正式版轻量级快速路径 (generateStockChart)"
echo "✅ 预期速度：从 90 秒超时 → 15-30 秒完成"
echo ""

# 备份原文件
echo "📦 备份原文件..."
cp index.js index.js.backup.$(date +%Y%m%d_%H%M%S)

# 修改 index.js 第 6345-6353 行：添加 telegramAPI 和 botToken 参数支持
echo "🔧 1. 修改 handleTicketAnalysis 函数签名（第 6345-6353 行）..."
sed -i '6347s/async function handleTicketAnalysis({ symbol, mode, chatId })/async function handleTicketAnalysis({ symbol, mode, chatId, telegramAPI: customTelegramAPI, botToken: customBotToken })/' index.js
sed -i '6352a\    // 使用传入的 telegramAPI 或默认的全局 telegramAPI\n    const api = customTelegramAPI || telegramAPI;\n    const token = customBotToken || TELEGRAM_TOKEN;' index.js

# 修改所有函数内的 telegramAPI 调用为 api
echo "🔧 2. 替换函数内所有 telegramAPI 调用..."
sed -i '6370,6500s/await telegramAPI(/await api(/g' index.js
sed -i '6410s/TELEGRAM_TOKEN/token/g' index.js

# 修改第 7458-7476 行：Manager Bot wrapper 函数
echo "🔧 3. 修改 Manager Bot 集成代码（第 7458-7488 行）..."
cat > /tmp/manager_wrapper.txt << 'EOF'
  const researchBotTelegramAPI = createResearchBotTelegramAPI(RESEARCH_BOT_TOKEN);
  
  // 🎯 注册外部处理器：解票功能（v6.5.2: 使用正式版轻量级快速路径）
  async function handleTicketAnalysisWrapper({ symbol, mode, chatId }) {
    console.log(`\n🔀 [ManagerBot → V3 Production] Routing ticket analysis to Research Bot`);
    console.log(`   ├─ Symbol: ${symbol}`);
    console.log(`   ├─ Mode: ${mode}`);
    console.log(`   ├─ Endpoint: generateStockChart (FAST PATH - Production)`);
    console.log(`   └─ Reply Token: RESEARCH_BOT_TOKEN (${RESEARCH_BOT_TOKEN.slice(0, 10)}...)`);
    console.log('[MANAGER → TICKET]', {
      symbol,
      mode,
      endpoint: 'generateStockChart (Production v3 - Lightweight)'
    });
    
    // ✅ 调用正式版轻量级解票功能（15-30秒，不走 v3_dev 重量级路由）
    // 使用 index.js 第 6345 行定义的正式版 handleTicketAnalysis
    await handleTicketAnalysis({
      symbol,
      mode,
      chatId,
      telegramAPI: researchBotTelegramAPI,
      botToken: RESEARCH_BOT_TOKEN
    });
  }
EOF

# 使用 sed 删除旧代码并插入新代码
sed -i '7456,7476d' index.js
sed -i '7455r /tmp/manager_wrapper.txt' index.js

echo ""
echo "✅ 代码修改完成！"
echo ""
echo "🔄 重启应用..."
pkill -f "node index.js"
sleep 2

nohup node index.js > logs/app.log 2>&1 &
NEW_PID=$!

echo "✅ 应用已重启 (PID: $NEW_PID)"
echo ""
echo "⏳ 等待 5 秒..."
sleep 5

echo ""
echo "📋 启动日志检查："
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
tail -30 logs/app.log | grep -E "ManagerBot|V3 Production|Token Check|online" || tail -30 logs/app.log

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ 部署完成！"
echo ""
echo "🧪 测试步骤："
echo "1. 在 Telegram 给 @qixizhuguan_bot 发送: 解票 NVDA"
echo "2. 立即运行: tail -f logs/app.log | grep 'MANAGER → TICKET'"
echo "3. 检查日志中的 endpoint 字段应该显示:"
echo "   endpoint: 'generateStockChart (Production v3 - Lightweight)'"
echo ""
echo "📊 预期结果："
echo "• 不再出现 90 秒超时"
echo "• 15-30 秒内收到 NVDA 技术分析"
echo "• 回复来自 @qixijiepiao_bot (Research Bot)"
