// Test script for Orchestrator
const fetch = require("node-fetch");

const BASE_URL = "http://localhost:3000";

async function test(name, payload) {
  console.log(`\n🧪 测试: ${name}`);
  console.log(`📤 请求:`, JSON.stringify(payload, null, 2));
  
  try {
    const res = await fetch(`${BASE_URL}/brain/orchestrate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    console.log(`📥 响应:`, JSON.stringify(data, null, 2));
    return data;
  } catch (err) {
    console.error(`❌ 错误:`, err.message);
    return null;
  }
}

async function runTests() {
  console.log("🚀 开始测试 Orchestrator...\n");
  
  // Test 1: 盘前资讯 (私聊)
  await test("盘前资讯 - 私聊", {
    text: "盘前看看市场",
    chat_type: "private"
  });
  
  await new Promise(r => setTimeout(r, 1000));
  
  // Test 2: 个股诊断 (群组)
  await test("个股诊断 - 群组", {
    text: "分析 NVDA TSLA",
    chat_type: "group",
    symbols: ["NVDA", "TSLA"]
  });
  
  await new Promise(r => setTimeout(r, 1000));
  
  // Test 3: 晚间复盘 (私聊)
  await test("晚间复盘 - 私聊", {
    text: "今天复盘一下",
    chat_type: "private"
  });
  
  await new Promise(r => setTimeout(r, 1000));
  
  // Test 4: 热点新闻 (群组)
  await test("热点新闻 - 群组", {
    text: "今天有什么新闻",
    chat_type: "group"
  });
  
  console.log("\n✅ 测试完成！");
  process.exit(0);
}

// 等待服务器启动
setTimeout(runTests, 2000);
