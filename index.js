// 最小版 USIS Brain（Replit 友好版：使用 CommonJS + 动态端口）
const express = require("express");
const app = express();
app.use(express.json());

// 健康检查
app.get("/health", (req, res) => {
  res.json({ ok: true, service: "USIS Brain", ts: Date.now() });
});

// 决策示例（先返回模拟结果，稍后再接多模型）
app.post("/brain/decide", async (req, res) => {
  const { task = "未命名任务" } = req.body || {};
  console.log("🧠 接收到任务：", task);

  const result = {
    version: "USIS.v1",
    final_text: {
      zh: `任务「${task}」的示例结论：市场整体稳定，留意科技与能源的轮动。`,
      es: `Resultado simulado para "${task}": el mercado se mantiene estable; vigila la rotación en tecnología y energía.`
    },
    tags: ["market/open","demo"],
    cost: { usd: 0.01 },
    latency_ms: 1200,
  };

  res.json(result);
});

// ！！！Replit 必须用动态端口
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`🚀 USIS Brain online on port ${PORT}`));
