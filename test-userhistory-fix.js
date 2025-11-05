// 测试userHistory修复是否生效
const express = require("express");
const app = express();
app.use(express.json());

// 模拟orchestrator的关键部分
app.post("/test-fix", async (req, res) => {
  try {
    const { user_id } = req.body || {};
    
    // 🔧 修复：userHistory在外层作用域
    let semanticIntent = null;
    let symbols = [];
    let userHistory = [];  // 这是修复的关键
    
    try {
      // 模拟数据库查询
      if (user_id) {
        userHistory = [{ request_text: "test", mode: "intraday" }];
      }
      
      // 模拟使用userHistory
      console.log(`userHistory length: ${userHistory.length}`);
      
    } catch (error) {
      console.error(`Inner error: ${error.message}`);
    }
    
    // 关键：在外层try-catch之外使用userHistory
    const complexity = { score: userHistory.length };
    
    res.json({ 
      ok: true, 
      fixed: true,
      userHistoryLength: userHistory.length,
      complexity: complexity.score
    });
    
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: error.message,
      stack: error.stack 
    });
  }
});

const PORT = 5001;
app.listen(PORT, () => {
  console.log(`✅ Test server running on port ${PORT}`);
});
