// 测试脚本：模拟/brain/orchestrate的请求流程

const { parseUserIntent } = require("./semanticIntentAgent");

async function testCrash() {
  try {
    console.log("开始测试...");
    
    const text = "测试GPT-5路由";
    const userHistory = [];
    
    console.log("调用parseUserIntent...");
    const result = await parseUserIntent(text, userHistory);
    
    console.log("✅ 测试成功:", JSON.stringify(result, null, 2));
    process.exit(0);
    
  } catch (error) {
    console.error("❌ 测试失败:");
    console.error("错误类型:", error.constructor.name);
    console.error("错误消息:", error.message);
    console.error("错误堆栈:");
    console.error(error.stack);
    process.exit(1);
  }
}

testCrash();
