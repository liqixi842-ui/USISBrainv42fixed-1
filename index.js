// ====== USIS Brain · 多模型测试版 ======
const express = require("express");
const fetch = require("node-fetch");
const fs = require("fs");
const app = express();
app.use(express.json());

// 文件日志函数
function log(msg) {
  const timestamp = new Date().toISOString();
  const logMsg = `[${timestamp}] ${msg}\n`;
  console.log(msg);
  fs.appendFileSync("/tmp/debug.log", logMsg);
}

// 环境变量
const CLAUDE_KEY = process.env.CLAUDE_API_KEY;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;

// 根路径健康检查
app.get("/", (req, res) => {
  res.status(200).send("OK");
});

// 健康检查
app.get("/health", (req, res) => {
  res.json({ ok: true, service: "USIS Brain", ts: Date.now() });
});

// 多模型决策（Claude + DeepSeek）
app.post("/brain/decide", async (req, res) => {
  const { task = "未命名任务" } = req.body || {};
  log("🧠 接收到任务：" + task);
  log("📊 环境变量状态 - CLAUDE_KEY:" + (CLAUDE_KEY ? "已设置" : "未设置") + " DEEPSEEK_KEY:" + (DEEPSEEK_KEY ? "已设置" : "未设置"));

  let claudeText = "（Claude 无响应）";
  let deepseekText = "（DeepSeek 无响应）";

  // Claude 调用
  if (CLAUDE_KEY && CLAUDE_KEY !== "DeepSeek") {
    try {
      log("📤 正在调用 Claude API...");
      const r1 = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": CLAUDE_KEY,
          "content-type": "application/json",
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 200,
          messages: [{ role: "user", content: `请用中文简要分析：${task}` }]
        })
      });
      const data1 = await r1.json();
      log("✅ Claude 响应状态:" + r1.status);
      log("📥 Claude 返回数据:" + JSON.stringify(data1).substring(0, 200));
      claudeText = data1?.content?.[0]?.text || JSON.stringify(data1);
    } catch (err) {
      log("❌ Claude error:" + err.message);
    }
  } else {
    log("⚠️ Claude API key 未正确设置");
  }

  // DeepSeek 调用
  if (DEEPSEEK_KEY && DEEPSEEK_KEY !== "DeepSeek") {
    try {
      log("📤 正在调用 DeepSeek API...");
      const r2 = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DEEPSEEK_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [{ role: "user", content: `请用中文总结：${task}` }],
          max_tokens: 200
        })
      });
      const data2 = await r2.json();
      log("✅ DeepSeek 响应状态:" + r2.status);
      log("📥 DeepSeek 返回数据:" + JSON.stringify(data2).substring(0, 200));
      deepseekText = data2?.choices?.[0]?.message?.content || JSON.stringify(data2);
    } catch (err) {
      log("❌ DeepSeek error:" + err.message);
    }
  } else {
    log("⚠️ DeepSeek API key 未正确设置（当前值为占位符）");
  }

  // 返回统一结构
  const result = {
    version: "USIS.v2",
    task,
    final_text: {
      zh: `Claude：${claudeText}\n\nDeepSeek：${deepseekText}`,
      es: `Claude y DeepSeek han completado el análisis de "${task}".`
    },
    models: [
      { name: "Claude", output: claudeText },
      { name: "DeepSeek", output: deepseekText }
    ],
    ts: Date.now()
  };

  res.json(result);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`🚀 USIS Brain (multi-model) online on port ${PORT}`));
