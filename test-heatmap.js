// 测试热力图生成功能
const detectActions = require('./index.js');

// 测试西班牙热力图检测
const testText = "给我看看西班牙股市热力图";

console.log("🧪 测试输入:", testText);

// 由于detectActions在index.js里不是导出的，我们直接测试URL构建逻辑
const market = 'spain';
const baseUrl = process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : 'https://node-js-tiqxi842.replit.app';
const heatmapUrl = `${baseUrl}/heatmap?market=${market}`;

console.log("✅ 生成的URL:", heatmapUrl);
console.log("\n📝 预期行为:");
console.log("1. Brain检测到'西班牙'关键词");
console.log("2. 返回自建热力图URL");
console.log("3. N8N截图这个URL");
console.log("4. Telegram收到西班牙市场的热力图");

console.log("\n🌍 支持的市场:");
const markets = ['usa', 'spain', 'germany', 'japan', 'uk', 'hongkong', 'china', 'france', 'world'];
markets.forEach(m => {
  console.log(`  - ${m}: ${baseUrl}/heatmap?market=${m}`);
});
