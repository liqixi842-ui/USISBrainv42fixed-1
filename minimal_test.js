const express = require('express');
const app = express();

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Minimal server listening on 0.0.0.0:${PORT}`);
});

// 保持进程运行
setInterval(() => {
  console.log(`[${new Date().toISOString()}] Server alive`);
}, 30000);

console.log('Script execution complete');
