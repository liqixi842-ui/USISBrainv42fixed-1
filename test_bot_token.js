// 快速测试当前使用哪个Token
console.log("环境变量检查:");
console.log("TELEGRAM_BOT_TOKEN_TEST:", process.env.TELEGRAM_BOT_TOKEN_TEST ? process.env.TELEGRAM_BOT_TOKEN_TEST.slice(0, 15) + "..." : "未设置");
console.log("TELEGRAM_BOT_TOKEN:", process.env.TELEGRAM_BOT_TOKEN ? process.env.TELEGRAM_BOT_TOKEN.slice(0, 15) + "..." : "未设置");

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN_TEST || process.env.TELEGRAM_BOT_TOKEN;
console.log("\n实际使用的Token:", TELEGRAM_TOKEN ? TELEGRAM_TOKEN.slice(0, 15) + "..." : "无");
