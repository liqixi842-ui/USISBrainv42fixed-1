// ====== USIS Brain · v3（多模型 + 投票） ======
const express = require("express");
const fetch = require("node-fetch");
const { Pool } = require("pg");
const app = express();
app.use(express.json());

// PostgreSQL Database Connection
if (!process.env.DATABASE_URL) {
  console.error("⚠️  DATABASE_URL not found - memory persistence disabled");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database table
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_memory (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        request_text TEXT,
        mode TEXT,
        symbols TEXT[],
        response_text TEXT,
        chat_type TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_user_memory_user_id ON user_memory(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_memory_timestamp ON user_memory(timestamp DESC);
      
      CREATE TABLE IF NOT EXISTS cost_tracking (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        mode TEXT,
        models JSONB,
        estimated_cost DECIMAL(10,4),
        actual_cost DECIMAL(10,4),
        response_time_ms INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_cost_tracking_user ON cost_tracking(user_id);
      CREATE INDEX IF NOT EXISTS idx_cost_tracking_time ON cost_tracking(timestamp DESC);
    `);
    console.log("✅ Database initialized: user_memory and cost_tracking tables ready");
  } catch (error) {
    console.error("❌ Database initialization error:", error.message);
  }
}

// Initialize database on startup
initDatabase();

// 添加请求日志中间件（用于调试Cloud Run健康检查）
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path} from ${req.ip || req.connection.remoteAddress}`);
  next();
});

const CLAUDE_KEY   = process.env.CLAUDE_API_KEY;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const MJAPI_KEY    = process.env.MJAPI_KEY;

// Image generation config
const IMAGE_PROVIDER = process.env.IMAGE_PROVIDER || "replicate";
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const MJ_RELAY_URL = process.env.MJ_RELAY_URL;

// Twitter API config
const TWITTER_BEARER = process.env.TWITTER_BEARER;

// Log token status on startup
if (REPLICATE_API_TOKEN) {
  console.log("✅ Using Replicate token:", REPLICATE_API_TOKEN.substring(0, 10) + "...");
} else {
  console.warn("⚠️  REPLICATE_API_TOKEN not found in environment");
}

if (TWITTER_BEARER) {
  console.log("✅ Twitter Bearer token configured");
} else {
  console.warn("⚠️  TWITTER_BEARER not found in environment");
}

// ---- Health
app.get("/", (_req, res) => res.status(200).send("OK"));

// ---- Feed Receiver: 接收 n8n 发来的行情+新闻数据
app.post("/brain/feed", (req, res) => {
  try {
    console.log("📥 收到 n8n 数据:", JSON.stringify(req.body, null, 2));
    res.json({ ok: true, received: req.body });
  } catch (err) {
    console.error("❌ feed 错误:", err);
    res.json({ ok: false, error: err.message });
  }
});

// ---- Midjourney Imagine: 转发 prompt 到 Midjourney API
app.post("/mj/imagine", async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.json({ ok: false, error: "缺少 prompt 参数" });
    }

    if (!MJAPI_KEY) {
      return res.json({ ok: false, error: "MJAPI_KEY 环境变量未设置" });
    }

    console.log("🎨 Midjourney Imagine:", prompt);

    const response = await fetch("https://api.mjapi.pro/v2/imagine", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MJAPI_KEY}`
      },
      body: JSON.stringify({
        prompt: prompt,
        mode: "fast",
        ratio: "16:9"
      })
    });

    const data = await response.json();
    
    console.log("✅ Midjourney 响应:", response.status);

    res.json({ ok: true, data: data });
  } catch (err) {
    console.error("❌ Midjourney 错误:", err);
    res.json({ ok: false, error: err.message });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true, service: "USIS Brain", ts: Date.now() }));

// ---- Image Generation Health Check
app.get("/img/health", (_req, res) => {
  res.json({ provider: IMAGE_PROVIDER, ok: true });
});

// ---- Twitter Search: 搜索 Twitter 推文
app.get("/social/twitter/search", async (req, res) => {
  try {
    // Check TWITTER_BEARER token
    if (!TWITTER_BEARER) {
      return res.json({ ok: false, error: "MISSING_TWITTER_BEARER" });
    }

    const query = req.query.query;
    const maxResults = parseInt(req.query.max_results) || 20;

    if (!query) {
      return res.json({ ok: false, error: "MISSING_QUERY_PARAMETER" });
    }

    console.log(`🐦 Twitter search: query="${query}", max_results=${maxResults}`);

    // Build Twitter API URL with parameters
    const tweetFields = "created_at,public_metrics,lang,author_id,source";
    const apiUrl = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=${maxResults}&tweet.fields=${tweetFields}`;

    // Call Twitter API with 60s timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(apiUrl, {
      headers: {
        "Authorization": `Bearer ${TWITTER_BEARER}`,
        "Content-Type": "application/json"
      },
      signal: controller.signal
    });

    clearTimeout(timeout);

    const data = await response.json();

    // Check for API errors
    if (!response.ok || data.errors) {
      console.error("❌ Twitter API error:", JSON.stringify(data, null, 2));
      return res.json({
        ok: false,
        error: "TWITTER_API_ERROR",
        raw: data
      });
    }

    // Process tweets: calculate score and format
    const tweets = data.data || [];
    const processed = tweets.map(tweet => {
      const metrics = tweet.public_metrics || {};
      const score = (metrics.retweet_count || 0) + (metrics.like_count || 0);
      
      return {
        id: tweet.id,
        text: tweet.text,
        created_at: tweet.created_at,
        score: score
      };
    });

    // Sort by score (descending) and take top 5
    const topTweets = processed
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    console.log(`✅ Found ${tweets.length} tweets, returning top ${topTweets.length}`);

    return res.json({
      ok: true,
      items: topTweets
    });

  } catch (err) {
    console.error("❌ Twitter search error:", err);
    
    if (err.name === 'AbortError') {
      return res.json({ ok: false, error: "TWITTER_TIMEOUT" });
    }
    
    return res.json({ 
      ok: false, 
      error: err.message,
      raw: err.toString()
    });
  }
});

// ---- Heatmap Generator: 自建热力图
app.get("/heatmap", async (req, res) => {
  try {
    const market = req.query.market || 'usa';
    const index = req.query.index || '';  // 新增：支持指定具体指数
    console.log(`📊 生成热力图: market=${market}, index=${index}`);

    // 定义各市场的主要股票（使用美股ticker和ADR）
    const marketStocks = {
      usa: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'JPM', 'V', 'JNJ', 'WMT', 'PG', 'MA', 'HD', 'DIS', 'BAC', 'NFLX', 'ADBE', 'CRM'],
      spain: ['TEF', 'SAN', 'BBVA', 'IBE', 'ITX', 'REP', 'ACS', 'FER', 'ENG', 'SAB'],
      germany: ['SAP', 'SIEGY', 'BASFY', 'BAYRY', 'DDAIF', 'VOW', 'BMWYY', 'ALIZY', 'DHRTY', 'MUV2'],
      japan: ['TM', 'SONY', 'MSBHF', 'HMC', 'SMFG', 'MTU', 'FUJIY', 'NTDOY', 'HTHIY', 'PCRFY'],
      uk: ['BP', 'HSBC', 'AZN', 'SHEL', 'GSK', 'RIO', 'ULVR', 'DGE', 'RELX', 'NG'],
      hongkong: ['BABA', 'TCEHY', '0700.HK', '0005.HK', '0001.HK', '0388.HK', '0939.HK', '2318.HK', '0883.HK', '0016.HK'],
      china: ['BABA', 'JD', 'BIDU', 'PDD', 'NIO', 'XPEV', 'LI', 'TME', 'BILI', 'IQ'],
      france: ['OR', 'BNP', 'SAN', 'AIR', 'AXA', 'DANOY', 'LVMUY', 'PUGOY', 'SAFRY', 'VIVHY'],
      europe: ['ASML', 'NVO', 'LVMUY', 'SAP', 'NESN', 'OR', 'SIEGY', 'RHHBY', 'AZN', 'NOVN', 'BP', 'SHEL', 'HSBC', 'BNP', 'SAN', 'BAYRY', 'BASFY', 'VOW', 'ITX', 'REP'],
      world: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'BABA', 'TSM', 'V', 'JNJ', 'WMT', 'JPM', 'MA', 'PG', 'LVMUY', 'NVO', 'TM', 'ASML', 'NSRGY', 'SAP']
    };

    const stocks = marketStocks[market] || marketStocks.usa;
    const FINNHUB_KEY = process.env.FINNHUB_API_KEY;

    if (!FINNHUB_KEY) {
      return res.send('<h1>FINNHUB_API_KEY not configured</h1>');
    }

    // 并行获取所有股票的实时数据
    const promises = stocks.map(async (symbol) => {
      try {
        const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`);
        const data = await response.json();
        
        if (data.c && data.pc) {  // c=当前价格, pc=前收盘价
          const change = ((data.c - data.pc) / data.pc) * 100;
          return {
            symbol,
            price: data.c,
            change: change.toFixed(2),
            value: Math.abs(change)  // 用于调整方块大小
          };
        }
        return null;
      } catch (err) {
        console.error(`获取${symbol}数据失败:`, err.message);
        return null;
      }
    });

    const results = await Promise.all(promises);
    const validStocks = results.filter(item => item !== null);

    // 生成HTML热力图
    const html = generateHeatmapHTML(validStocks, market, index);
    res.send(html);

  } catch (err) {
    console.error("❌ 热力图生成错误:", err);
    res.send(`<h1>Error: ${err.message}</h1>`);
  }
});

// 生成热力图HTML（使用TradingView嵌入Widget）
function generateHeatmapHTML(stocks, marketName, indexName = '') {
  // TradingView 官方支持的 dataSource 完整列表
  const allIndices = {
    // 🇺🇸 美国
    'SPX500': 'S&P 500',
    'DJDJI': 'Dow Jones Industrial',
    'DJDJU': 'Dow Jones Utilities',
    'DJDJT': 'Dow Jones Transportation',
    'DJCA': 'Dow Jones Composite',
    'NASDAQ100': 'Nasdaq 100',
    'NASDAQCOMPOSITE': 'Nasdaq Composite',
    'NASDAQBKX': 'Nasdaq Bank',
    'AllUSA': 'All US Stocks',
    
    // 🇬🇧 英国
    'UK100': 'FTSE 100',
    'AllUK': 'All UK Stocks',
    
    // 🇩🇪 德国
    'DAX': 'DAX 40',
    'TECDAX': 'TecDAX',
    'MDAX': 'MDAX',
    'SDAX': 'SDAX',
    'AllDE': 'All Germany Stocks',
    
    // 🇫🇷 法国
    'CAC40': 'CAC 40',
    'SBF120': 'SBF 120',
    'AllFR': 'All France Stocks',
    
    // 🇪🇸 西班牙
    'IBEX35': 'IBEX 35',
    'BMEIS': 'BME Small Cap',
    'BMEINDGRO15': 'BME Industry Growth 15',
    'BMEINDGROAS': 'BME Industry Growth AS',
    'BMEICC': 'BME Consumer',
    'AllES': 'All Spain Stocks',
    
    // 🇧🇪 比利时
    'AllBE': 'All Belgium Stocks',
    
    // 🇯🇵 日本
    'AllJP': 'All Japan Stocks',
    
    // 🇨🇳 中国
    'AllCN': 'All China A Stocks',
    
    // 🇦🇺 澳大利亚
    'AllAU': 'All Australia Stocks',
    
    // 🌎 美洲其他
    'AllBR': 'All Brazil Stocks',
    'AllAR': 'All Argentina Stocks',
    'AllCA': 'All Canada Stocks',
    'AllCL': 'All Chile Stocks',
    'AllCO': 'All Colombia Stocks',
    
    // 🏭 行业指数
    'TVCRUI': 'Cruise Industry',
    'TVCRUA': 'Airlines & Cruise',
    'TVCRUT': 'Transport & Travel',
    
    // 💰 加密货币
    'CRYPTO': 'Cryptocurrency'
  };
  
  // 智能映射：将用户请求的指数映射到最佳的 TradingView dataSource
  const indexMapping = {
    // 美国替代名称
    'DJI': 'DJDJI',
    'DOW': 'DJDJI',
    'DOWJONES': 'DJDJI',
    'SP500': 'SPX500',
    'NASDAQ': 'NASDAQCOMPOSITE',
    'NDX': 'NASDAQ100',
    'RUSSELL2000': 'AllUSA',
    'RUSSELL1000': 'AllUSA',
    'RUSSELL3000': 'AllUSA',
    
    // 英国替代名称
    'FTSE100': 'UK100',
    'FTSE': 'UK100',
    
    // 西班牙替代名称
    'IBEX': 'IBEX35',
    'IBEXSMALLCAP': 'BMEIS',
    'IBEXMEDIUMCAP': 'IBEX35',
    
    // 其他通用映射
    'USA': 'AllUSA',
    'UK': 'AllUK',
    'GERMANY': 'AllDE',
    'FRANCE': 'AllFR',
    'SPAIN': 'AllES',
    'JAPAN': 'AllJP',
    'CHINA': 'AllCN',
    'AUSTRALIA': 'AllAU'
  };

  // 市场到可用指数的映射（用于错误提示）
  const marketIndices = {
    spain: ['IBEX35', 'BMEIS', 'BMEINDGRO15', 'BMEINDGROAS', 'BMEICC', 'AllES'],
    germany: ['DAX', 'TECDAX', 'MDAX', 'SDAX', 'AllDE'],
    uk: ['UK100', 'AllUK'],
    france: ['CAC40', 'SBF120', 'AllFR'],
    usa: ['SPX500', 'DJDJI', 'NASDAQ100', 'NASDAQCOMPOSITE', 'AllUSA'],
    japan: ['AllJP'],
    china: ['AllCN'],
    australia: ['AllAU'],
    brazil: ['AllBR'],
    canada: ['AllCA']
  };

  // 确定最终使用的dataSource
  let dataSource, title, errorMessage = null;
  
  if (indexName) {
    const upperIndex = indexName.toUpperCase();
    
    // 1. 检查是否是直接支持的值
    if (allIndices[upperIndex]) {
      dataSource = upperIndex;
      title = allIndices[dataSource];
    }
    // 2. 检查是否需要映射
    else if (indexMapping[upperIndex]) {
      dataSource = indexMapping[upperIndex];
      title = allIndices[dataSource];
    }
    // 3. 未知指数，返回错误提示
    else {
      // 尝试根据index名称猜测市场
      let guessedMarket = 'usa';
      if (/spain|ibex|bme|西班牙/i.test(indexName)) guessedMarket = 'spain';
      else if (/germany|dax|德国/i.test(indexName)) guessedMarket = 'germany';
      else if (/uk|ftse|英国/i.test(indexName)) guessedMarket = 'uk';
      else if (/france|cac|法国/i.test(indexName)) guessedMarket = 'france';
      
      const availableIndices = marketIndices[guessedMarket] || marketIndices.usa;
      errorMessage = `当前不支持指数"${indexName}"。\n\n可用指数：\n${availableIndices.map(idx => `• ${idx} - ${allIndices[idx]}`).join('\n')}`;
      
      dataSource = availableIndices[0];
      title = `Error: Unsupported Index`;
    }
  } else {
    // 没有指定index，根据market参数选择最佳指数
    // 注意：某些市场的"All"系列数据可能不完整，使用主要指数更可靠
    const marketMapping = {
      usa: 'SPX500',        // S&P 500（比AllUSA更可靠）
      spain: 'IBEX35',      // IBEX 35（西班牙主要蓝筹指数，数据最完整）
      germany: 'DAX',       // DAX 40（德国主要指数）
      uk: 'UK100',          // FTSE 100（英国主要指数）
      france: 'CAC40',      // CAC 40（法国主要指数）
      japan: 'AllJP',       // 日本全市场
      china: 'AllCN',       // 中国A股全市场
      australia: 'AllAU',   // 澳大利亚全市场
      hongkong: 'AllCN',    // 香港 → 中国A股
      belgium: 'AllBE',     // 比利时全市场
      brazil: 'AllBR',      // 巴西全市场
      argentina: 'AllAR',   // 阿根廷全市场
      canada: 'AllCA',      // 加拿大全市场
      chile: 'AllCL',       // 智利全市场
      colombia: 'AllCO',    // 哥伦比亚全市场
      europe: 'CAC40',      // 欧洲默认 → 法国CAC40
      world: 'SPX500'       // 全球 → S&P 500
    };
    
    dataSource = marketMapping[marketName];
    
    // 如果market不支持，返回错误提示
    if (!dataSource) {
      errorMessage = `当前不支持市场"${marketName}"。\n\n可用市场：\n• 美国 (usa)\n• 西班牙 (spain)\n• 德国 (germany)\n• 英国 (uk)\n• 法国 (france)\n• 日本 (japan)\n• 中国 (china)\n• 澳大利亚 (australia)\n• 巴西 (brazil)\n• 加拿大 (canada)`;
      dataSource = 'SPX500';
      title = 'Error: Unsupported Market';
    } else {
      title = allIndices[dataSource];
    }
  }
  
  // 如果有错误，返回错误页面
  if (errorMessage) {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>错误 - 不支持的市场或指数</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
    }
    .error-card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      padding: 40px;
      max-width: 600px;
      width: 100%;
    }
    h1 {
      color: #e53e3e;
      font-size: 28px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .icon {
      font-size: 36px;
    }
    .message {
      color: #2d3748;
      font-size: 16px;
      line-height: 1.8;
      white-space: pre-line;
      background: #f7fafc;
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }
    .footer {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid #e2e8f0;
      color: #718096;
      font-size: 14px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="error-card">
    <h1><span class="icon">⚠️</span> 不支持的市场或指数</h1>
    <div class="message">${errorMessage}</div>
    <div class="footer">
      <p>💡 提示：请核对指数名称后重新发送</p>
    </div>
  </div>
</body>
</html>
`;
  }

  // 直接返回嵌入TradingView Widget的HTML
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} Heatmap</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #131722;
      color: white;
      overflow: hidden;
      width: 100%;
      height: 100%;
    }
    .header {
      background: #1E222D;
      padding: 15px 20px;
      text-align: center;
      border-bottom: 1px solid #2A2E39;
      height: 60px;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 600;
      color: #D1D4DC;
      margin: 0;
      line-height: 30px;
    }
    .tradingview-widget-container {
      width: 100%;
      height: calc(100% - 60px);
    }
    .tradingview-widget-container__widget {
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title} Heatmap</h1>
  </div>
  
  <!-- TradingView Widget BEGIN -->
  <div class="tradingview-widget-container">
    <div class="tradingview-widget-container__widget"></div>
    <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js" async>
    {
      "exchanges": [],
      "dataSource": "${dataSource}",
      "grouping": "sector",
      "blockSize": "market_cap_basic",
      "blockColor": "change",
      "locale": "en",
      "symbolUrl": "",
      "colorTheme": "dark",
      "hasTopBar": false,
      "isDataSetEnabled": false,
      "isZoomEnabled": true,
      "hasSymbolTooltip": true,
      "width": "100%",
      "height": 800
    }
    </script>
  </div>
  <!-- TradingView Widget END -->
</body>
</html>
  `;
}

// ---- Helper: Poll Replicate prediction (only if needed)
async function pollReplicatePrediction(predictionId, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
    
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json"
      }
    });
    
    const data = await response.json();
    console.log(`📊 Replicate poll ${i+1}/${maxAttempts}: status=${data.status}`);
    
    if (data.status === "succeeded") {
      return { success: true, output: data.output };
    }
    
    if (data.status === "failed" || data.status === "canceled") {
      console.error("❌ Replicate polling failed:", JSON.stringify(data, null, 2));
      return { success: false, error: "REPLICATE_STATUS_FAILED", raw: data };
    }
  }
  
  return { success: false, error: "REPLICATE_TIMEOUT" };
}

// ---- Image Generation: Unified endpoint
app.post("/img/imagine", async (req, res) => {
  try {
    // 1️⃣ Check REPLICATE_API_TOKEN first
    if (!REPLICATE_API_TOKEN) {
      console.error("❌ REPLICATE_API_TOKEN missing");
      return res.json({ ok: false, error: "MISSING_TOKEN" });
    }

    // 2️⃣ Clean prompt - remove line breaks, tabs, and excessive whitespace
    const rawPrompt = req.body?.prompt || "";
    const prompt = rawPrompt.replace(/\s+/g, " ").trim();
    const ratio = req.body?.ratio || "16:9";
    
    if (!prompt) {
      return res.json({ ok: false, error: "MISSING_PROMPT" });
    }

    console.log(`🎨 Image request: provider=${IMAGE_PROVIDER}, prompt="${prompt}", ratio=${ratio}`);

    // Provider: Replicate
    if (IMAGE_PROVIDER === "replicate") {
      // 3️⃣ Create prediction
      const createResponse = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${REPLICATE_API_TOKEN}`,
          "Content-Type": "application/json",
          "Prefer": "wait"
        },
        body: JSON.stringify({
          input: {
            prompt: prompt,
            aspect_ratio: ratio,
            num_outputs: 1,
            num_inference_steps: 4,
            go_fast: true
          }
        })
      });

      const prediction = await createResponse.json();
      
      // 3️⃣ Check for errors or missing ID
      if (createResponse.status !== 201 && createResponse.status !== 200) {
        console.error("❌ Replicate create failed:", JSON.stringify(prediction, null, 2));
        return res.json({ 
          ok: false, 
          error: "REPLICATE_CREATE_FAILED",
          raw: prediction
        });
      }

      if (!prediction.id) {
        console.error("❌ No prediction ID:", JSON.stringify(prediction, null, 2));
        return res.json({ 
          ok: false, 
          error: "REPLICATE_CREATE_FAILED",
          raw: prediction
        });
      }

      // Check if we got immediate result (Prefer: wait header)
      if (prediction.status === "succeeded" && prediction.output) {
        const imageUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
        console.log(`✅ Image generated (immediate): ${imageUrl}`);
        return res.json({ ok: true, image_url: imageUrl });
      }

      // 4️⃣ Poll for result
      console.log(`⏳ Polling prediction: id=${prediction.id}`);
      const result = await pollReplicatePrediction(prediction.id);
      
      if (!result.success) {
        return res.json({ 
          ok: false, 
          error: result.error,
          raw: result.raw
        });
      }

      // 5️⃣ Success - return image URL
      const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;
      console.log(`✅ Image generated: ${imageUrl}`);
      
      return res.json({ ok: true, image_url: imageUrl });
    }

    // Provider: MJ Relay
    if (IMAGE_PROVIDER === "mjrelay") {
      if (!MJ_RELAY_URL) {
        return res.json({ ok: false, error: "MJ_RELAY_URL_MISSING" });
      }

      const response = await fetch(MJ_RELAY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, ratio })
      });

      const data = await response.json();
      const imageUrl = data.image_url || (Array.isArray(data.images) ? data.images[0] : null);

      if (!imageUrl) {
        return res.json({ ok: false, error: "MJ_RELAY_NO_IMAGE", raw: data });
      }

      console.log(`✅ MJ Relay image: ${imageUrl}`);
      return res.json({ ok: true, image_url: imageUrl });
    }

    // Unknown provider
    return res.json({ ok: false, error: `UNKNOWN_PROVIDER_${IMAGE_PROVIDER}` });

  } catch (err) {
    console.error("❌ Image generation error:", err);
    return res.json({ ok: false, error: err.message });
  }
});

// ---- 简单规则投票器：从文本里判定 BUY / HOLD / SELL
function pickVote(text = "") {
  const t = text.toLowerCase();
  const buyWords  = ["看多","乐观","上涨","买入","走强","向上","bull","optimistic","accumulate"];
  const sellWords = ["看空","悲观","下跌","卖出","走弱","向下","bear","risk off","reduce"];
  let score = 0;
  buyWords.forEach(w => { if (t.includes(w)) score += 1; });
  sellWords.forEach(w => { if (t.includes(w)) score -= 1; });
  if (score > 0)  return { vote: "BUY",  conf: Math.min(0.6 + score*0.1, 0.95) };
  if (score < 0)  return { vote: "SELL", conf: Math.min(0.6 + (-score)*0.1, 0.95) };
  return { vote: "HOLD", conf: 0.55 };
}

// ---- 多模型决策
app.post("/brain/decide", async (req, res) => {
  const { task = "未命名任务" } = req.body || {};
  console.log("🧠 任务:", task);

  // 并行调用两个模型
  const calls = [];

  // Claude
  calls.push((async () => {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": CLAUDE_KEY,
          "content-type": "application/json",
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 220,
          messages: [{ role: "user", content: `请用要点判断市场倾向（BUY/HOLD/SELL）并给出一句理由：${task}` }]
        })
      });
      const j = await r.json();
      const text = j?.content?.[0]?.text || JSON.stringify(j);
      const { vote, conf } = pickVote(text);
      return { name: "Claude", text, vote, confidence: conf };
    } catch (e) {
      console.error("Claude error:", e);
      return { name: "Claude", text: "（无响应）", vote: "HOLD", confidence: 0.4 };
    }
  })());

  // DeepSeek
  calls.push((async () => {
    try {
      const r = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DEEPSEEK_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [{ role: "user", content: `请判断 BUY/HOLD/SELL，并用一句话说明理由：${task}` }],
          max_tokens: 220
        })
      });
      const j = await r.json();
      const text = j?.choices?.[0]?.message?.content || JSON.stringify(j);
      const { vote, conf } = pickVote(text);
      return { name: "DeepSeek", text, vote, confidence: conf };
    } catch (e) {
      console.error("DeepSeek error:", e);
      return { name: "DeepSeek", text: "（无响应）", vote: "HOLD", confidence: 0.4 };
    }
  })());

  const results = await Promise.all(calls);

  // —— 投票：简单多数；平手则 HOLD
  const tally = { BUY: 0, HOLD: 0, SELL: 0 };
  results.forEach(r => { tally[r.vote] += 1; });

  let finalVote = "HOLD";
  if (tally.BUY > tally.SELL && tally.BUY >= tally.HOLD) finalVote = "BUY";
  else if (tally.SELL > tally.BUY && tally.SELL >= tally.HOLD) finalVote = "SELL";

  // 置信度：平均模型置信度 × 投票一致度
  const avgConf = results.reduce((s, r) => s + (r.confidence || 0.5), 0) / results.length;
  const agreement = Math.max(tally.BUY, tally.SELL, tally.HOLD) / results.length;
  const finalConfidence = Math.min(0.98, Number((avgConf * (0.6 + 0.4 * agreement)).toFixed(2)));

  // —— 构造输出（兼容旧字段）
  const zhLines = results.map(r => `${r.name}（${r.vote}，${Math.round((r.confidence||0)*100)}%）：${r.text}`);
  const payload = {
    version: "USIS.v3",
    task,
    final_text: {
      zh: zhLines.join("\n\n"),
      es: `Voto final: ${finalVote}. Confianza: ${Math.round(finalConfidence*100)}%.`
    },
    models: results.map(r => ({
      name: r.name,
      output: r.text,
      vote: r.vote,
      confidence: r.confidence
    })),
    decision: {
      vote: finalVote,
      confidence: finalConfidence,
      reasons: results.map(r => `${r.name}: ${r.vote}`)
    },
    tags: ["market/open","vote"],
    ts: Date.now()
  };

  res.json(payload);
});

// ---- Intent Router: 意图识别（模式 + 抽票 + 语言）
app.post("/brain/intent", async (req, res) => {
  try {
    const text = (req.body?.text || '').trim();
    const allow = Array.isArray(req.body?.allow) ? req.body.allow : ['premarket','intraday','postmarket','diagnose','news'];
    const langHint = (req.body?.lang || '').toLowerCase();

    // 1) 语言判定（轻量规则）
    let lang = 'zh';
    if (langHint) {
      lang = langHint;
    } else if (/[a-z]/i.test(text) && !/[\u4e00-\u9fa5]/.test(text)) {
      lang = 'en';
    } else if (/[áéíóúüñ¡¿]/i.test(text)) {
      lang = 'es';
    }

    // 2) 模式识别（关键词 → mode）
    const t = text.toLowerCase();
    const pick = (m) => allow.includes(m) ? m : null;

    let mode = null;
    if (!mode && /(盘启|盘前|premarket|\bpre\b)/.test(t)) mode = pick('premarket');
    if (!mode && /(盘中|intraday|live)/.test(t)) mode = pick('intraday');
    if (!mode && /(复盘|收盘|postmarket|review|after)/.test(t)) mode = pick('postmarket');
    if (!mode && /(解票|诊股|ticker|symbol)/.test(t)) mode = pick('diagnose');
    if (!mode && /(新闻|资讯|news)/.test(t)) mode = pick('news');

    // 3) 抽取股票代码（简单正则，使用原文而非小写版本）
    const sym = (text.match(/\b[A-Z]{1,5}\b/g) || [])
      .filter(s => !['US','ES','ETF','ETF?'].includes(s))
      .slice(0, 10);

    console.log(`🎯 意图: text="${text}" → mode=${mode}, symbols=${sym.join(',')}, lang=${lang}`);

    // 4) 返回结果
    return res.json({
      version: 'USIS.v3',
      mode: mode || null,
      symbols: sym,
      lang,
      echo: text
    });
  } catch (e) {
    console.error('❌ intent error:', e);
    res.status(500).json({ error: 'intent-failed' });
  }
});

// ========================================
// 🧠 AI ORCHESTRATOR - 智能协调系统
// ========================================

// Memory Layer - 简单内存存储（后续可替换为 Redis/DB）
const Memory = {
  logs: [],
  userPrefs: {},
  
  save(entry) {
    this.logs.push({ ...entry, ts: new Date().toISOString() });
    // 只保留最近 1000 条
    if (this.logs.length > 1000) this.logs = this.logs.slice(-1000);
  },
  
  recent(n = 10) {
    return this.logs.slice(-n);
  },
  
  setUserPref(userId, key, value) {
    if (!this.userPrefs[userId]) this.userPrefs[userId] = {};
    this.userPrefs[userId][key] = value;
  },
  
  getUserPref(userId, key) {
    return this.userPrefs[userId]?.[key];
  }
};

// Symbol Extraction - 从文本中提取股票代码
function extractSymbols(text = "") {
  // 大小写不敏感匹配（转大写处理）
  const upperText = text.toUpperCase();
  const matches = upperText.match(/\b[A-Z]{1,5}\b/g) || [];
  
  // 去重并过滤常见非股票词（扩展黑名单）
  const blacklist = [
    'US', 'USD', 'PM', 'AM', 'ET', 'PT', 'NY', 'LA', 'SF', 
    'AI', 'EV', 'IPO', 'CEO', 'CFO', 'CTO', 'API', 'URL', 'HTML',
    'GDP', 'CPI', 'PPI', 'PMI', 'FED', 'SEC', 'DOW', 'FX', 'VIX',
    'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HAS', 'HAD', 'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'DAY'
  ];
  
  const filtered = [...new Set(matches)].filter(s => !blacklist.includes(s));
  return filtered;
}

// Detect Actions - 检测用户需要的"器官"操作（Brain给N8N下指令）
function detectActions(text = "", symbols = []) {
  const t = text.toLowerCase();
  const actions = [];
  
  // 🎯 优先判断：个股K线图 vs 市场热力图
  const hasSymbols = symbols && symbols.length > 0;
  const explicitHeatmap = /热力图|heatmap|市场图|板块图|sector/.test(t);
  const needsChart = /图|chart|走势|k线|k-line|candlestick|图表|可视化|visual/.test(t);
  
  // 🔍 决策逻辑：
  // 1. 如果有symbols + 需要图表 + 不是明确说"热力图" → 个股K线图
  // 2. 如果明确说"热力图" → 市场热力图
  // 3. 如果没有symbols + 需要图表 → 市场热力图
  
  if (hasSymbols && needsChart && !explicitHeatmap) {
    // 个股K线图优先
    actions.push({
      type: 'fetch_symbol_chart',
      tool: 'TradingView_SymbolChart',
      symbols: symbols,
      reason: `用户要求查看${symbols.join(', ')}的K线走势图`
    });
    console.log(`📈 检测到个股图表需求: ${symbols.join(', ')}`);
    return actions;  // 直接返回，不再检测热力图
  }
  
  // 视觉需求（市场热力图/截图）
  if (explicitHeatmap || (/截图|screenshot/.test(t) && !hasSymbols)) {
    // 智能检测具体指数（优先级高于地区检测）
    let index = '';
    let indexName = '';
    
    // 🇺🇸 美国指数
    if (/纳斯达克100|nasdaq\s*100|nasdaq100|ndx/.test(t)) {
      index = 'NASDAQ100';
      indexName = 'Nasdaq 100';
    } else if (/纳斯达克综合|nasdaq\s*composite|nasdaqcomposite/.test(t)) {
      index = 'NASDAQCOMPOSITE';
      indexName = 'Nasdaq Composite';
    } else if (/纳斯达克银行|nasdaq\s*bank/.test(t)) {
      index = 'NASDAQBKX';
      indexName = 'Nasdaq Bank';
    } else if (/道琼斯工业|道指|dow\s*jones\s*industrial|djdji|dji/.test(t)) {
      index = 'DJDJI';
      indexName = '道琼斯工业指数';
    } else if (/道琼斯公用|dow\s*utilities|djdju/.test(t)) {
      index = 'DJDJU';
      indexName = '道琼斯公用事业';
    } else if (/道琼斯运输|dow\s*transport|djdjt/.test(t)) {
      index = 'DJDJT';
      indexName = '道琼斯运输';
    } else if (/道琼斯综合|dow\s*composite|djca/.test(t)) {
      index = 'DJCA';
      indexName = '道琼斯综合';
    } else if (/罗素1000|russell\s*1000/.test(t)) {
      index = 'RUSSELL1000';
      indexName = 'Russell 1000';
    } else if (/罗素2000|russell\s*2000/.test(t)) {
      index = 'RUSSELL2000';
      indexName = 'Russell 2000';
    } else if (/罗素3000|russell\s*3000/.test(t)) {
      index = 'RUSSELL3000';
      indexName = 'Russell 3000';
    } else if (/标普500|s&p\s*500|spx|sp500/.test(t)) {
      index = 'SPX500';
      indexName = 'S&P 500';
    }
    
    // 🇪🇸 西班牙指数
    if (!index && /西班牙|spain|ibex|马德里|bme/.test(t)) {
      if (/small\s*cap|小盘|小型股|bmeis/.test(t)) {
        index = 'BMEIS';
        indexName = 'BME Small Cap';
      } else if (/消费|consumer|bmeicc/.test(t)) {
        index = 'BMEICC';
        indexName = 'BME Consumer';
      } else if (/industry.*growth.*15|bmeindgro15/.test(t)) {
        index = 'BMEINDGRO15';
        indexName = 'BME Industry Growth 15';
      } else if (/industry.*growth|bmeindgroas/.test(t)) {
        index = 'BMEINDGROAS';
        indexName = 'BME Industry Growth AS';
      } else if (/ibex\s*35|ibex35/.test(t)) {
        index = 'IBEX35';
        indexName = 'IBEX 35';
      }
    }
    
    // 🇬🇧 英国指数
    if (!index && /英国|uk|britain|ftse|伦敦/.test(t)) {
      if (/ftse\s*100|uk100/.test(t)) {
        index = 'UK100';
        indexName = 'FTSE 100';
      }
    }
    
    // 🇩🇪 德国指数
    if (!index && /德国|germany|法兰克福/.test(t)) {
      if (/tecdax|科技/.test(t)) {
        index = 'TECDAX';
        indexName = 'TecDAX';
      } else if (/mdax|中盘/.test(t)) {
        index = 'MDAX';
        indexName = 'MDAX';
      } else if (/sdax|小盘/.test(t)) {
        index = 'SDAX';
        indexName = 'SDAX';
      } else if (/dax/.test(t)) {
        index = 'DAX';
        indexName = 'DAX 40';
      }
    }
    
    // 🇫🇷 法国指数
    if (!index && /法国|france|巴黎/.test(t)) {
      if (/sbf\s*120/.test(t)) {
        index = 'SBF120';
        indexName = 'SBF 120';
      } else if (/cac\s*40|cac40/.test(t)) {
        index = 'CAC40';
        indexName = 'CAC 40';
      }
    }
    
    // 🏭 行业指数
    if (!index) {
      if (/邮轮|游轮|cruise/.test(t)) {
        index = 'TVCRUI';
        indexName = 'Cruise Industry';
      } else if (/航空.*邮轮|airline.*cruise/.test(t)) {
        index = 'TVCRUA';
        indexName = 'Airlines & Cruise';
      } else if (/运输.*旅游|transport.*travel/.test(t)) {
        index = 'TVCRUT';
        indexName = 'Transport & Travel';
      }
    }
    
    // 💰 加密货币
    if (!index && /加密|crypto|比特币|btc|以太坊|eth/.test(t)) {
      index = 'CRYPTO';
      indexName = 'Cryptocurrency';
    }
    
    // 如果还没有指定指数，继续检测地区/国家
    let market = 'usa';
    let marketName = '美股市场';
    
    if (!index) {
      if (/西班牙|spain|西班牙市场|马德里/.test(t)) {
        market = 'spain';
        marketName = '西班牙市场';
      } else if (/德国|germany|法兰克福/.test(t)) {
        market = 'germany';
        marketName = '德国市场';
      } else if (/英国|uk|britain|伦敦/.test(t)) {
        market = 'uk';
        marketName = '英国市场';
      } else if (/法国|france|巴黎/.test(t)) {
        market = 'france';
        marketName = '法国市场';
      } else if (/日本|japan|nikkei|东京/.test(t)) {
        market = 'japan';
        marketName = '日本市场';
      } else if (/中国|a股|上证|深证|沪深/.test(t)) {
        market = 'china';
        marketName = '中国市场';
      } else if (/香港|hk|恒生/.test(t)) {
        market = 'hongkong';
        marketName = '香港市场';
      } else if (/澳大利亚|澳洲|australia/.test(t)) {
        market = 'australia';
        marketName = '澳大利亚市场';
      } else if (/巴西|brazil/.test(t)) {
        market = 'brazil';
        marketName = '巴西市场';
      } else if (/加拿大|canada/.test(t)) {
        market = 'canada';
        marketName = '加拿大市场';
      } else if (/欧洲|europe|eu/.test(t)) {
        market = 'europe';
        marketName = '欧洲市场';
      } else if (/全球|世界|world/.test(t)) {
        market = 'world';
        marketName = '全球市场';
      }
    }
    
    // 使用自建热力图（快速、稳定、支持所有市场和指数）
    // 使用生产域名确保外部服务可访问
    const baseUrl = 'https://node-js-liqixi842.replit.app';
    let heatmapUrl = `${baseUrl}/heatmap?market=${market}`;
    
    // 如果指定了具体指数，添加index参数
    if (index) {
      heatmapUrl += `&index=${index}`;
      marketName = indexName;
    }
    
    actions.push({
      type: 'fetch_heatmap',
      tool: 'A_Screenshot',
      url: heatmapUrl,
      market: marketName,
      reason: `用户要求${marketName}热力图`
    });
  }
  
  // 深度新闻需求（RSS爬取）
  if (/深度新闻|详细资讯|news detail|爬取/.test(t)) {
    actions.push({
      type: 'fetch_news_rss',
      tool: 'C_RSS_News',
      reason: '用户需要深度新闻爬取'
    });
  }
  
  // Twitter情绪需求
  if (/推特|twitter|社交|sentiment|情绪|x\.com/.test(t)) {
    actions.push({
      type: 'fetch_twitter',
      tool: 'Twitter_Search',
      reason: '用户需要社交媒体情绪'
    });
  }
  
  // 图片生成需求
  if (/生成图|画图|generate image|create chart|ai.*图/.test(t)) {
    actions.push({
      type: 'generate_image',
      tool: '/img/imagine',
      reason: '用户需要AI生成图片'
    });
  }
  
  return actions;
}

// Intent Understanding - 深度意图理解 + Action Detection
function understandIntent(text = "", mode = null, symbols = []) {
  const t = text.toLowerCase();
  
  // 如果已经指定 mode，直接使用
  if (mode && ['premarket', 'intraday', 'postmarket', 'diagnose', 'news'].includes(mode)) {
    return { 
      mode, 
      confidence: 1.0, 
      lang: 'zh',
      actions: detectActions(text, symbols) // 新增：检测需要执行的动作
    };
  }
  
  // 关键词匹配
  let detectedMode = null;
  let confidence = 0.8;
  
  // 🎯 Meta模式：关于AI本身的问题（严格匹配，避免误判市场分析）
  const hasMetaKeyword = /(你是谁|你叫什么名字|你的功能|介绍.*自己|what can you do|who are you|your capability|你的能力是|你都能做)/.test(t);
  const hasStockContext = /([A-Z]{1,5}\b|股票|盘前|盘中|盘后|分析|诊股|热力图|新闻|行情)/.test(text);
  
  if (hasMetaKeyword && !hasStockContext) {
    detectedMode = 'meta';
  } else if (/(盘前|premarket|\bpre\b|开盘前|早盘)/.test(t)) {
    detectedMode = 'premarket';
  } else if (/(盘中|intraday|live|盘面|实时|当前)/.test(t)) {
    detectedMode = 'intraday';
  } else if (/(复盘|收盘|postmarket|review|after|晚间|收市)/.test(t)) {
    detectedMode = 'postmarket';
  } else if (/(解票|诊股|ticker|symbol|分析.*股|看.*股)/.test(t)) {
    detectedMode = 'diagnose';
  } else if (/(新闻|资讯|消息|news|热点|头条)/.test(t)) {
    detectedMode = 'news';
  } else {
    // 默认根据美东时间判断（DST-aware）
    const now = new Date();
    // 使用 Intl.DateTimeFormat 获取美东时间（自动处理DST）
    const etHour = parseInt(new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      hour12: false
    }).format(now));
    
    if (etHour >= 6 && etHour < 9) detectedMode = 'premarket';      // 6am-9am ET
    else if (etHour >= 9 && etHour < 16) detectedMode = 'intraday'; // 9am-4pm ET
    else if (etHour >= 16 && etHour < 22) detectedMode = 'postmarket'; // 4pm-10pm ET
    else detectedMode = 'news';
    confidence = 0.5; // 低置信度
  }
  
  return { 
    mode: detectedMode, 
    confidence, 
    lang: 'zh',
    actions: detectActions(text, symbols) // 新增：检测需要执行的动作
  };
}

// Scene Awareness - 场景感知（判断内容长度和深度）
function analyzeScene(mode, symbols = []) {
  const scenes = {
    premarket: {
      name: '盘前资讯',
      targetLength: 300,  // 短内容
      depth: 'brief',     // 简要
      style: 'quick',     // 快速扫描
      focus: ['sentiment', 'key_news', 'major_events']
    },
    intraday: {
      name: '盘中热点',
      targetLength: 500,  // 中等长度
      depth: 'medium',    // 中等深度
      style: 'alert',     // 警觉关注
      focus: ['price_action', 'volume', 'breaking_news']
    },
    postmarket: {
      name: '晚间复盘',
      targetLength: 800,  // 长内容
      depth: 'deep',      // 深度分析
      style: 'analytical',// 分析总结
      focus: ['full_day_review', 'trend_analysis', 'strategy']
    },
    diagnose: {
      name: '个股诊断',
      targetLength: 600,  // 中长内容
      depth: 'deep',      // 深度
      style: 'focused',   // 聚焦
      focus: ['technical', 'fundamental', 'sentiment']
    },
    news: {
      name: '市场资讯',
      targetLength: 500,  // 中等
      depth: 'medium',    // 中等
      style: 'informative', // 信息性
      focus: ['events', 'impact', 'context']
    }
  };
  
  return scenes[mode] || scenes.news;
}

// ========================================
// 🚀 三级Orchestrator架构 (阶段I新增)
// ========================================

// L1: 复杂度评分器 - 评估请求的复杂度，决定使用哪个层级处理
function calculateComplexityScore(text = "", mode = "", symbols = [], userHistory = []) {
  let complexityScore = 0;
  
  // 1. 基于模式的基础分数
  const modeScores = {
    'meta': 0,        // 最简单，直接回复
    'casual': 1,      // 闲聊，轻量AI
    'news': 2,        // 新闻，中等
    'premarket': 3,   // 盘前简报
    'intraday': 4,    // 盘中分析
    'diagnose': 6,    // 个股诊断，需要深度
    'postmarket': 7   // 复盘总结，最深度
  };
  complexityScore += (modeScores[mode] || 3);
  
  // 2. 股票数量影响
  if (symbols.length >= 5) complexityScore += 3;  // 多股票对比
  else if (symbols.length >= 2) complexityScore += 2;  // 2-4只股票
  else if (symbols.length === 1) complexityScore += 1;  // 单股
  
  // 3. 文本复杂度
  const textLower = text.toLowerCase();
  const complexKeywords = [
    '策略', '对冲', '套利', '组合', 'strategy', 'hedge', 'portfolio',
    '回测', 'backtest', '量化', 'quant',
    '风险', 'risk', '波动', 'volatility',
    '为什么', 'why', '原因', 'reason', '深度', 'deep'
  ];
  const complexKeywordCount = complexKeywords.filter(k => textLower.includes(k)).length;
  complexityScore += complexKeywordCount * 2;
  
  // 4. 问题类型
  if (/如何|怎么|怎样|为什么|why|how/.test(textLower)) complexityScore += 2;  // 需要推理
  if (/对比|比较|vs|versus/.test(textLower)) complexityScore += 3;  // 需要对比分析
  
  // 5. 历史上下文依赖
  if (userHistory && userHistory.length > 0) {
    const recentModes = userHistory.map(h => h.mode);
    if (recentModes.includes('diagnose') || recentModes.includes('postmarket')) {
      complexityScore += 1;  // 用户偏好深度分析
    }
  }
  
  // 归一化到0-10
  complexityScore = Math.min(10, Math.max(0, complexityScore));
  
  // 决定层级
  let tier = 'L1';  // L1: 快速路由（GPT-4o-mini）
  if (complexityScore >= 8) tier = 'L3';  // L3: 深度推理（o1/Claude Opus）
  else if (complexityScore >= 4) tier = 'L2';  // L2: 标准分析（现有6-AI）
  
  return {
    score: complexityScore,
    tier,
    reasoning: `模式:${mode}(${modeScores[mode] || 0}分) + 股票:${symbols.length}只 + 关键词:${complexKeywordCount}个`
  };
}

// L2: 智能模型选择器 - 根据场景选择最优AI模型组合
function selectOptimalModels(complexity, mode, symbols = [], budget = 'medium') {
  // 预算配置（每次分析的目标成本）
  const budgetConfigs = {
    'low': { maxCost: 0.05, maxModels: 2 },      // $0.05 - 2个模型
    'medium': { maxCost: 0.15, maxModels: 4 },   // $0.15 - 4个模型
    'high': { maxCost: 0.30, maxModels: 6 },     // $0.30 - 6个模型
    'unlimited': { maxCost: 1.0, maxModels: 9 }  // $1.00 - 9个模型（包括o1）
  };
  
  const budgetConfig = budgetConfigs[budget] || budgetConfigs['medium'];
  
  // 模型成本估算（每次调用约1000 tokens）
  const modelCosts = {
    'gpt4o-mini': 0.0003,    // 最便宜，快速路由用
    'claude': 0.015,         // Claude 3.5 Sonnet
    'deepseek': 0.0014,      // DeepSeek Chat
    'gpt4': 0.03,            // GPT-4
    'gemini': 0.001,         // Gemini Pro (免费tier)
    'perplexity': 0.005,     // Perplexity Sonar
    'mistral': 0.007,        // Mistral Large
    'claude-opus': 0.075,    // Claude Opus (顶级)
    'o1': 0.300              // OpenAI o1 (深度推理)
  };
  
  const selectedModels = [];
  let estimatedCost = 0;
  
  // L1层：使用GPT-4o-mini快速路由（meta、casual场景）
  if (complexity.tier === 'L1') {
    selectedModels.push({ name: 'gpt4o-mini', role: 'quick_responder', cost: modelCosts['gpt4o-mini'] });
    estimatedCost += modelCosts['gpt4o-mini'];
  }
  
  // L2层：标准6-AI协同（大部分场景）
  else if (complexity.tier === 'L2') {
    // 核心模型（总是使用）
    const coreModels = ['claude', 'gpt4', 'deepseek'];
    coreModels.forEach(model => {
      selectedModels.push({ name: model, role: AI_ROLES[model]?.specialty || '分析师', cost: modelCosts[model] });
      estimatedCost += modelCosts[model];
    });
    
    // 根据场景添加专业模型
    if (mode === 'news' || mode === 'intraday') {
      selectedModels.push({ name: 'gemini', role: AI_ROLES.gemini.specialty, cost: modelCosts.gemini });
      selectedModels.push({ name: 'perplexity', role: AI_ROLES.perplexity.specialty, cost: modelCosts.perplexity });
      estimatedCost += modelCosts.gemini + modelCosts.perplexity;
    }
    
    if (mode === 'postmarket' || mode === 'diagnose') {
      selectedModels.push({ name: 'mistral', role: AI_ROLES.mistral.specialty, cost: modelCosts.mistral });
      estimatedCost += modelCosts.mistral;
    }
  }
  
  // L3层：深度推理（复杂场景）
  else if (complexity.tier === 'L3') {
    // 使用所有6个标准模型
    ['claude', 'deepseek', 'gpt4', 'gemini', 'perplexity', 'mistral'].forEach(model => {
      selectedModels.push({ name: model, role: AI_ROLES[model]?.specialty || '分析师', cost: modelCosts[model] });
      estimatedCost += modelCosts[model];
    });
    
    // 如果预算允许，添加深度推理模型
    if (budgetConfig.maxCost >= 0.3) {
      // 优先选择Claude Opus（性价比高）
      selectedModels.push({ name: 'claude-opus', role: '顶级分析师·深度推理', cost: modelCosts['claude-opus'] });
      estimatedCost += modelCosts['claude-opus'];
      
      // 如果预算充足且场景极其复杂，考虑o1
      if (budgetConfig.maxCost >= 1.0 && complexity.score >= 9) {
        selectedModels.push({ name: 'o1', role: '超级大脑·战略推理', cost: modelCosts['o1'] });
        estimatedCost += modelCosts['o1'];
      }
    }
  }
  
  return {
    models: selectedModels,
    estimatedCost: parseFloat(estimatedCost.toFixed(4)),
    tier: complexity.tier,
    budgetConfig: budgetConfig.maxCost,
    withinBudget: estimatedCost <= budgetConfig.maxCost
  };
}

// L3: 成本追踪器 - 记录每次分析的成本
async function trackCost(user_id, mode, models, actualCost, responseTime) {
  try {
    // 插入成本记录 (表已在initDatabase中创建)
    await pool.query(
      'INSERT INTO cost_tracking (user_id, mode, models, estimated_cost, actual_cost, response_time_ms) VALUES ($1, $2, $3, $4, $5, $6)',
      [user_id || 'anonymous', mode, JSON.stringify(models), actualCost, actualCost, responseTime]
    );
    
    console.log(`💰 成本追踪: $${actualCost.toFixed(4)} (${responseTime}ms)`);
  } catch (error) {
    console.error('❌ 成本追踪失败:', error.message);
  }
}

// L3: 获取总成本 - 从数据库汇总特定请求的总成本
async function getTotalCostFromDB(requestId) {
  try {
    // 由于我们目前使用user_id作为主键，这里返回null
    // 后续可扩展为按requestId追踪
    return null;
  } catch (error) {
    console.error('❌ 获取成本失败:', error.message);
    return null;
  }
}

// Planner - 任务规划器
function planTasks(intent, scene, symbols = []) {
  const tasks = [];
  
  // 基础任务：总是需要
  tasks.push('understand_context');
  
  // 根据场景添加任务
  if (scene.focus.includes('sentiment') || scene.focus.includes('trend_analysis')) {
    tasks.push('fetch_sentiment');
  }
  
  if (scene.focus.includes('key_news') || scene.focus.includes('breaking_news') || scene.focus.includes('events')) {
    tasks.push('fetch_news');
  }
  
  if (symbols.length > 0) {
    tasks.push('fetch_quotes');
    
    if (scene.focus.includes('technical')) {
      tasks.push('technical_analysis');
    }
  }
  
  // 多 AI 分析（核心任务）
  tasks.push('multi_ai_analysis');
  
  // 智能合成
  tasks.push('synthesize');
  
  return tasks;
}

// ========================================
// Multi-AI Coordination - 多AI协调系统
// ========================================

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const PERPLEXITY_KEY = process.env.PERPLEXITY_API_KEY;
const MISTRAL_KEY = process.env.MISTRAL_API_KEY;
const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_API_KEY;

// AI Agent Roles - 每个AI的角色定位（6个分析AI）
const AI_ROLES = {
  claude: {
    name: 'Claude',
    specialty: '技术分析专家',
    focus: '技术指标、图表形态、支撑阻力位'
  },
  deepseek: {
    name: 'DeepSeek',
    specialty: '中文市场洞察',
    focus: '中文资讯解读、A股港股联动、本地化分析'
  },
  gpt4: {
    name: 'GPT-4',
    specialty: '综合策略分析师',
    focus: '宏观趋势、风险评估、投资建议'
  },
  gemini: {
    name: 'Gemini',
    specialty: '实时数据分析',
    focus: '最新资讯、实时行情、突发事件'
  },
  perplexity: {
    name: 'Perplexity',
    specialty: '深度研究专家',
    focus: '行业研究、公司基本面、长期趋势'
  },
  mistral: {
    name: 'Mistral',
    specialty: '市场情绪与风险评估',
    focus: '情绪指标、恐慌贪婪、风险预警'
  }
};

// Call Claude API
async function callClaude(prompt, maxTokens = 300) {
  try {
    if (!CLAUDE_KEY) {
      return { success: false, error: 'CLAUDE_KEY missing' };
    }
    
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": CLAUDE_KEY,
        "content-type": "application/json",
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }]
      })
    });
    
    const data = await response.json();
    const text = data?.content?.[0]?.text || '';
    
    return { success: true, text };
  } catch (err) {
    console.error('❌ Claude error:', err.message);
    return { success: false, error: err.message };
  }
}

// Call DeepSeek API
async function callDeepSeek(prompt, maxTokens = 300) {
  try {
    if (!DEEPSEEK_KEY) {
      return { success: false, error: 'DEEPSEEK_KEY missing' };
    }
    
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DEEPSEEK_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens
      })
    });
    
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || '';
    
    return { success: true, text };
  } catch (err) {
    console.error('❌ DeepSeek error:', err.message);
    return { success: false, error: err.message };
  }
}

// Call GPT-4 API
async function callGPT4(prompt, maxTokens = 400) {
  try {
    if (!OPENAI_KEY) {
      return { success: false, error: 'OPENAI_KEY missing' };
    }
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.3
      })
    });
    
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || '';
    
    return { success: true, text };
  } catch (err) {
    console.error('❌ GPT-4 error:', err.message);
    return { success: false, error: err.message };
  }
}

// Call Gemini API
async function callGemini(prompt, maxTokens = 300) {
  try {
    if (!GEMINI_KEY) {
      return { success: false, error: 'GEMINI_KEY missing' };
    }
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: 0.3
        }
      })
    });
    
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    return { success: true, text };
  } catch (err) {
    console.error('❌ Gemini error:', err.message);
    return { success: false, error: err.message };
  }
}

// Call Perplexity API
async function callPerplexity(prompt, maxTokens = 300) {
  try {
    if (!PERPLEXITY_KEY) {
      return { success: false, error: 'PERPLEXITY_KEY missing' };
    }
    
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-small-128k-online",
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.3
      })
    });
    
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || '';
    
    return { success: true, text };
  } catch (err) {
    console.error('❌ Perplexity error:', err.message);
    return { success: false, error: err.message };
  }
}

// Call Mistral API
async function callMistral(prompt, maxTokens = 300) {
  try {
    if (!MISTRAL_KEY) {
      return { success: false, error: 'MISTRAL_KEY missing' };
    }
    
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MISTRAL_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "mistral-large-latest",
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.3
      })
    });
    
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || '';
    
    return { success: true, text };
  } catch (err) {
    console.error('❌ Mistral error:', err.message);
    return { success: false, error: err.message };
  }
}

// Multi-AI Analysis - 多AI并行分析（6个AI全面协同）
async function multiAIAnalysis({ mode, scene, symbols, text, chatType, marketData }) {
  console.log(`🤖 开始6个AI并行分析...`);
  
  // 准备上下文（包含实时数据）
  let dataContext = '';
  if (marketData && marketData.collected) {
    dataContext = `\n\n【实时数据】\n${marketData.summary}`;
  }
  
  const context = {
    mode,
    scene: scene.name,
    symbols: symbols.join(', ') || '无特定股票',
    request: text + dataContext
  };
  
  // 构建不同AI的prompt
  const prompts = {
    claude: buildClaudePrompt(context, scene),
    deepseek: buildDeepSeekPrompt(context, scene),
    gpt4: buildGPT4Prompt(context, scene, chatType),
    gemini: buildGeminiPrompt(context, scene),
    perplexity: buildPerplexityPrompt(context, scene),
    mistral: buildMistralPrompt(context, scene)
  };
  
  // 并行调用6个AI
  const [claudeResult, deepseekResult, gpt4Result, geminiResult, perplexityResult, mistralResult] = await Promise.all([
    callClaude(prompts.claude, scene.targetLength * 0.25),
    callDeepSeek(prompts.deepseek, scene.targetLength * 0.25),
    callGPT4(prompts.gpt4, scene.targetLength * 0.3),
    callGemini(prompts.gemini, scene.targetLength * 0.25),
    callPerplexity(prompts.perplexity, scene.targetLength * 0.25),
    callMistral(prompts.mistral, scene.targetLength * 0.25)
  ]);
  
  console.log(`  ✅ Claude: ${claudeResult.success ? '成功' : '失败'}`);
  console.log(`  ✅ DeepSeek: ${deepseekResult.success ? '成功' : '失败'}`);
  console.log(`  ✅ GPT-4: ${gpt4Result.success ? '成功' : '失败'}`);
  console.log(`  ✅ Gemini: ${geminiResult.success ? '成功' : '失败'}`);
  console.log(`  ✅ Perplexity: ${perplexityResult.success ? '成功' : '失败'}`);
  console.log(`  ✅ Mistral: ${mistralResult.success ? '成功' : '失败'}`);
  
  return {
    claude: { ...AI_ROLES.claude, ...claudeResult },
    deepseek: { ...AI_ROLES.deepseek, ...deepseekResult },
    gpt4: { ...AI_ROLES.gpt4, ...gpt4Result },
    gemini: { ...AI_ROLES.gemini, ...geminiResult },
    perplexity: { ...AI_ROLES.perplexity, ...perplexityResult },
    mistral: { ...AI_ROLES.mistral, ...mistralResult }
  };
}

// Build Claude Prompt - 技术分析专家
function buildClaudePrompt(context, scene) {
  return `你是一位技术分析专家，专注于${scene.focus.join('、')}。

场景：${context.scene}
股票：${context.symbols}
用户请求：${context.request}

🎯 关键要求：
1. **必须使用实时数据**：上面提供的实时价格、涨跌幅、新闻等数据，必须在分析中直接引用
   - 示例："NVDA当前价格$120.50，较昨日收盘上涨+2.34%"
   - 示例："从5日、10日、20日均线来看..."（如果数据中有）

2. **技术面分析要点**（${scene.targetLength/3}字左右）：
   - 当前价格位置分析（支撑位、压力位）
   - 短期趋势判断（如MACD、RSI如果有数据）
   - 成交量变化（如果有数据）

3. **输出格式**：
   - 第一句必须包含：股票代码 + 当前价格 + 涨跌幅
   - 然后用2-3个要点说明技术面判断
   - 最后给出短期趋势预测

要求：
- 用具体数字说话，不要空洞描述
- 专业但简洁
- 不要免责声明`;
}

// Build DeepSeek Prompt - 中文市场专家
function buildDeepSeekPrompt(context, scene) {
  return `你是一位中文市场分析专家，擅长解读中文资讯和本地市场情绪。

场景：${context.scene}
股票：${context.symbols}
用户请求：${context.request}

请从市场情绪和资讯角度提供${scene.targetLength/3}字左右的分析，包括：
- 市场情绪判断
- 关键资讯解读
- 风险提示

要求：
- 中文地道表达
- 关注情绪面
- 简洁有力`;
}

// Build GPT-4 Prompt - 综合策略分析师
function buildGPT4Prompt(context, scene, chatType) {
  // 新闻模式：返回新闻摘要而非投资分析
  if (context.mode === 'news') {
    return `你是一位财经新闻编辑，负责整理最新市场资讯。

股票：${context.symbols || '全市场'}
用户请求：${context.request}

请以新闻摘要形式输出，格式：
1. 【标题】新闻标题
   摘要：简短说明（20-30字）
   
2. 【标题】第二条新闻
   摘要：简短说明

要求：
- 列出3-5条最重要的新闻
- 每条新闻包含标题和简短摘要
- 优先报道重大事件、财报、政策变化
- 不要分析和建议，只报道事实
- ${chatType === 'private' ? '口语化表达' : '专业新闻语气'}`;
  }
  
  // 常规模式：投资分析
  let styleGuide = chatType === 'private' 
    ? `风格：像贴心老师一样，用"你看"、"我注意到"等口语化表达，用生活化类比解释专业概念` 
    : `风格：专业团队口吻，使用"老师团队认为"、"我们认为"，结构化输出`;
  
  if (scene.userTone === 'casual') styleGuide += `\n额外要求：使用更加轻松随意的语气`;
  else if (scene.userTone === 'professional') styleGuide += `\n额外要求：保持专业严谨的语气`;
  
  return `你是一位综合策略分析师，负责整合技术面和情绪面，给出最终建议。

场景：${context.scene}
股票：${context.symbols}
用户请求：${context.request}

${styleGuide}

🎯 数据使用要求：
- **必须引用实时价格**：开头第一句必须包含当前价格和涨跌幅
- **必须结合市场情绪**：如果有情绪数据（看多/看空百分比），必须提及
- **必须参考新闻**：如果有最新新闻，需简要概括关键信息

请提供${scene.targetLength/5}字左右的综合分析，包括：
- 开头：当前价格 + 涨跌幅（必须有）
- 整体判断（BUY/HOLD/SELL）
- 核心理由（2-3点，结合技术面+情绪面+新闻面）
- 具体建议

要求：
- ${chatType === 'private' ? '口语化、有温度' : '专业、结构化'}
- 给出明确观点
- 不要免责声明`;
}

// Build Gemini Prompt - 实时数据分析
function buildGeminiPrompt(context, scene) {
  return `你是一位实时数据分析专家，专注于最新资讯和实时行情。

场景：${context.scene}
股票：${context.symbols}
用户请求：${context.request}

请从实时数据角度提供${scene.targetLength/5}字左右的分析，包括：
- 最新市场动态
- 突发新闻影响
- 当前价格走势

要求：
- 关注实时性
- 数据准确
- 简洁有力`;
}

// Build Perplexity Prompt - 深度研究
function buildPerplexityPrompt(context, scene) {
  return `你是一位深度研究专家，专注于行业研究和公司基本面。

场景：${context.scene}
股票：${context.symbols}
用户请求：${context.request}

请从基本面角度提供${scene.targetLength/6}字左右的分析，包括：
- 公司基本面分析
- 行业趋势判断
- 长期投资价值

要求：
- 深度挖掘
- 逻辑严谨
- 不要废话`;
}

// Build Mistral Prompt - 市场情绪与风险评估
function buildMistralPrompt(context, scene) {
  return `你是一位市场情绪和风险评估专家，专注于识别市场恐慌与贪婪。

场景：${context.scene}
股票：${context.symbols}
用户请求：${context.request}

请从情绪和风险角度提供${scene.targetLength/6}字左右的分析，包括：
- 当前市场情绪判断（恐慌/中性/贪婪）
- 主要风险因素识别
- 风险等级评估

要求：
- 敏锐捕捉情绪
- 风险提示明确
- 简洁有力`;
}

// ========================================
// Data Empire - 数据帝国层
// ========================================

// Finnhub - 实时行情+新闻+情绪
async function fetchFinnhubQuote(symbol) {
  try {
    if (!FINNHUB_KEY) {
      return { success: false, error: 'FINNHUB_KEY missing' };
    }
    
    const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`);
    const data = await response.json();
    
    if (data.error || !data.c) {
      return { success: false, error: data.error || 'No data' };
    }
    
    return {
      success: true,
      symbol,
      current: data.c,
      high: data.h,
      low: data.l,
      open: data.o,
      previousClose: data.pc,
      change: data.d,
      changePercent: data.dp,
      timestamp: data.t
    };
  } catch (err) {
    console.error(`❌ Finnhub quote error (${symbol}):`, err.message);
    return { success: false, error: err.message };
  }
}

async function fetchFinnhubNews(symbol, limit = 5) {
  try {
    if (!FINNHUB_KEY) {
      return { success: false, error: 'FINNHUB_KEY missing' };
    }
    
    const to = Math.floor(Date.now() / 1000);
    const from = to - 86400 * 3; // 最近3天
    
    const response = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${FINNHUB_KEY}`
    );
    const data = await response.json();
    
    if (!Array.isArray(data)) {
      return { success: false, error: 'Invalid response' };
    }
    
    const news = data.slice(0, limit).map(item => ({
      headline: item.headline,
      summary: item.summary,
      source: item.source,
      url: item.url,
      datetime: item.datetime
    }));
    
    return { success: true, symbol, news };
  } catch (err) {
    console.error(`❌ Finnhub news error (${symbol}):`, err.message);
    return { success: false, error: err.message };
  }
}

async function fetchFinnhubSentiment(symbol) {
  try {
    if (!FINNHUB_KEY) {
      return { success: false, error: 'FINNHUB_KEY missing' };
    }
    
    const response = await fetch(
      `https://finnhub.io/api/v1/news-sentiment?symbol=${symbol}&token=${FINNHUB_KEY}`
    );
    const data = await response.json();
    
    if (data.error) {
      return { success: false, error: data.error };
    }
    
    return {
      success: true,
      symbol,
      sentiment: {
        buzz: data.buzz?.articlesInLastWeek || 0,
        positive: data.sentiment?.bullishPercent || 0,
        negative: data.sentiment?.bearishPercent || 0,
        score: data.companyNewsScore || 0
      }
    };
  } catch (err) {
    console.error(`❌ Finnhub sentiment error (${symbol}):`, err.message);
    return { success: false, error: err.message };
  }
}

// ========================================
// SEC EDGAR API Integration (阶段I新增)
// ========================================

// SEC EDGAR: 查找公司CIK (Central Index Key)
let SEC_TICKER_MAP = null;  // 缓存ticker到CIK的映射
async function fetchSECCIK(ticker) {
  try {
    // 第一次调用时加载映射表
    if (!SEC_TICKER_MAP) {
      console.log('📥 下载SEC ticker映射表...');
      const response = await fetch('https://www.sec.gov/files/company_tickers.json', {
        headers: {
          'User-Agent': 'USIS Brain v3.1 replit-agent@example.com'
        }
      });
      const data = await response.json();
      
      // 转换为ticker -> CIK映射
      SEC_TICKER_MAP = {};
      Object.values(data).forEach(company => {
        SEC_TICKER_MAP[company.ticker.toUpperCase()] = String(company.cik_str).padStart(10, '0');
      });
      console.log(`✅ SEC映射表加载完成: ${Object.keys(SEC_TICKER_MAP).length} 家公司`);
    }
    
    const cik = SEC_TICKER_MAP[ticker.toUpperCase()];
    if (!cik) {
      return { success: false, error: 'CIK not found' };
    }
    
    return { success: true, ticker, cik };
  } catch (err) {
    console.error(`❌ SEC CIK查找失败 (${ticker}):`, err.message);
    return { success: false, error: err.message };
  }
}

// SEC EDGAR: 获取公司最新财报列表
async function fetchSECFilings(ticker, limit = 5) {
  try {
    const cikResult = await fetchSECCIK(ticker);
    if (!cikResult.success) {
      return { success: false, error: cikResult.error };
    }
    
    const { cik } = cikResult;
    const response = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
      headers: {
        'User-Agent': 'USIS Brain v3.1 replit-agent@example.com'
      }
    });
    
    const data = await response.json();
    const recentFilings = data.filings?.recent;
    
    if (!recentFilings) {
      return { success: false, error: 'No filings found' };
    }
    
    // 提取最近的10-K和10-Q财报
    const filings = [];
    for (let i = 0; i < recentFilings.form.length && filings.length < limit; i++) {
      const formType = recentFilings.form[i];
      if (formType === '10-K' || formType === '10-Q') {
        filings.push({
          form: formType,
          filingDate: recentFilings.filingDate[i],
          reportDate: recentFilings.reportDate[i],
          accessionNumber: recentFilings.accessionNumber[i]
        });
      }
    }
    
    return {
      success: true,
      ticker,
      company: data.name,
      cik,
      filings
    };
  } catch (err) {
    console.error(`❌ SEC财报获取失败 (${ticker}):`, err.message);
    return { success: false, error: err.message };
  }
}

// SEC EDGAR: 获取公司财务数据（简化版）
async function fetchSECFinancials(ticker) {
  try {
    const cikResult = await fetchSECCIK(ticker);
    if (!cikResult.success) {
      return { success: false, error: cikResult.error };
    }
    
    const { cik } = cikResult;
    const response = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
      headers: {
        'User-Agent': 'USIS Brain v3.1 replit-agent@example.com'
      }
    });
    
    const data = await response.json();
    const facts = data.facts?.['us-gaap'];
    
    if (!facts) {
      return { success: false, error: 'No financial facts found' };
    }
    
    // 提取关键财务指标（最近一期）
    const getLatestValue = (conceptNames) => {
      try {
        // 支持多个concept名称，按优先级尝试
        const concepts = Array.isArray(conceptNames) ? conceptNames : [conceptNames];
        
        for (const concept of concepts) {
          const usdData = facts[concept]?.units?.USD;
          if (!usdData || usdData.length === 0) continue;
          
          // 按日期排序，优先获取10-K，其次10-Q
          const sortedData = usdData
            .filter(d => d.form === '10-K' || d.form === '10-Q')
            .sort((a, b) => {
              // 优先10-K，然后按日期
              if (a.form !== b.form) {
                return a.form === '10-K' ? -1 : 1;
              }
              return new Date(b.end) - new Date(a.end);
            });
          
          if (sortedData.length > 0) {
            return {
              value: sortedData[0].val,
              period: sortedData[0].end,
              form: sortedData[0].form
            };
          }
        }
        
        return null;
      } catch (err) {
        console.error(`❌ getLatestValue error for ${conceptNames}:`, err.message);
        return null;
      }
    };
    
    // 尝试多种可能的concept名称（SEC公司使用不同的会计术语）
    const financials = {
      revenue: getLatestValue(['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet']),
      netIncome: getLatestValue(['NetIncomeLoss', 'ProfitLoss']),
      assets: getLatestValue(['Assets']),
      equity: getLatestValue(['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'])
    };
    
    // 检查是否至少有一个有效数据（检查value属性是否存在且非null）
    const hasData = Object.values(financials).some(entry => entry?.value != null);
    if (!hasData) {
      console.log(`⚠️  ${ticker}: 未找到有效财务数据`);
      return { success: false, error: 'No valid financial metrics found' };
    }
    
    return {
      success: true,
      ticker,
      cik,
      financials
    };
  } catch (err) {
    console.error(`❌ SEC财务数据获取失败 (${ticker}):`, err.message);
    return { success: false, error: err.message };
  }
}

// 智能数据采集器 - 根据symbols自动采集多源数据
async function collectMarketData(symbols = [], options = {}) {
  if (symbols.length === 0) {
    return { collected: false, reason: 'No symbols provided' };
  }
  
  // 决定是否获取SEC财报数据（仅在深度分析场景下）
  const includeSEC = options.includeSEC || 
                      options.mode === 'diagnose' || 
                      options.mode === 'postmarket' ||
                      (options.text && /(财报|基本面|10-k|10-q|营收|利润|fundamental)/i.test(options.text));
  
  console.log(`📊 开始采集数据: ${symbols.join(', ')}${includeSEC ? ' (含SEC财报)' : ''}`);
  
  const results = {
    quotes: {},
    news: {},
    sentiment: {},
    ...(includeSEC && { sec_filings: {}, sec_financials: {} })
  };
  
  // 并行采集所有symbol的数据
  await Promise.all(
    symbols.map(async (symbol) => {
      // 基础数据：总是获取
      const [quote, news, sentiment] = await Promise.all([
        fetchFinnhubQuote(symbol),
        fetchFinnhubNews(symbol, 3),
        fetchFinnhubSentiment(symbol)
      ]);
      
      if (quote.success) results.quotes[symbol] = quote;
      if (news.success) results.news[symbol] = news;
      if (sentiment.success) results.sentiment[symbol] = sentiment;
      
      // SEC数据：仅在需要时获取
      if (includeSEC) {
        const [secFilings, secFinancials] = await Promise.all([
          fetchSECFilings(symbol, 3),
          fetchSECFinancials(symbol)
        ]);
        
        if (secFilings.success) results.sec_filings[symbol] = secFilings;
        if (secFinancials.success) results.sec_financials[symbol] = secFinancials;
      }
    })
  );
  
  const dataSourcesCount = includeSEC ? 
    `quotes=${Object.keys(results.quotes).length}, news=${Object.keys(results.news).length}, sentiment=${Object.keys(results.sentiment).length}, SEC财报=${Object.keys(results.sec_filings || {}).length}` :
    `quotes=${Object.keys(results.quotes).length}, news=${Object.keys(results.news).length}, sentiment=${Object.keys(results.sentiment).length}`;
  
  console.log(`✅ 数据采集完成: ${dataSourcesCount}`);
  
  return {
    collected: true,
    data: results,
    summary: generateDataSummary(results)
  };
}

// 生成数据摘要（给AI使用）
function generateDataSummary(results) {
  const parts = [];
  
  // 行情数据
  Object.values(results.quotes).forEach(q => {
    if (q.success) {
      parts.push(`${q.symbol}: 当前$${q.current}, 涨跌${q.changePercent >= 0 ? '+' : ''}${q.changePercent.toFixed(2)}%`);
    }
  });
  
  // 新闻标题
  Object.values(results.news).forEach(n => {
    if (n.success && n.news.length > 0) {
      const headlines = n.news.slice(0, 2).map(item => item.headline).join('; ');
      parts.push(`${n.symbol}新闻: ${headlines}`);
    }
  });
  
  // 情绪数据
  Object.values(results.sentiment).forEach(s => {
    if (s.success) {
      parts.push(`${s.symbol}情绪: ${s.sentiment.positive}%看多, ${s.sentiment.negative}%看空`);
    }
  });
  
  // SEC财报数据（新增）
  if (results.sec_filings) {
    Object.values(results.sec_filings).forEach(f => {
      if (f.success && f.filings.length > 0) {
        const latest = f.filings[0];
        parts.push(`${f.ticker}最新财报: ${latest.form} (${latest.reportDate})`);
      }
    });
  }
  
  // SEC财务数据（新增）
  if (results.sec_financials) {
    Object.values(results.sec_financials).forEach(f => {
      if (f.success && f.financials) {
        const { revenue, netIncome } = f.financials;
        const revenueStr = revenue ? `营收$${(revenue.value / 1e9).toFixed(2)}B` : '';
        const incomeStr = netIncome ? `净利润$${(netIncome.value / 1e9).toFixed(2)}B` : '';
        if (revenueStr || incomeStr) {
          parts.push(`${f.ticker}财务数据: ${[revenueStr, incomeStr].filter(Boolean).join(', ')} (${revenue?.period || netIncome?.period})`);
        }
      }
    });
  }
  
  return parts.join('\n');
}

// ========================================
// Intelligent Synthesis - 智能合成系统
// ========================================

// Synthesize Multi-AI Outputs - 智能合成多个AI的输出
async function synthesizeAIOutputs(aiResults, { mode, scene, chatType, symbols, text }) {
  console.log(`🔮 开始智能合成...`);
  
  // 提取成功的AI输出（6个AI）
  const validOutputs = [];
  if (aiResults.claude.success) validOutputs.push({ name: 'Claude (技术分析)', text: aiResults.claude.text });
  if (aiResults.deepseek.success) validOutputs.push({ name: 'DeepSeek (市场洞察)', text: aiResults.deepseek.text });
  if (aiResults.gpt4.success) validOutputs.push({ name: 'GPT-4 (综合策略)', text: aiResults.gpt4.text });
  if (aiResults.gemini.success) validOutputs.push({ name: 'Gemini (实时数据)', text: aiResults.gemini.text });
  if (aiResults.perplexity.success) validOutputs.push({ name: 'Perplexity (深度研究)', text: aiResults.perplexity.text });
  if (aiResults.mistral.success) validOutputs.push({ name: 'Mistral (情绪风险)', text: aiResults.mistral.text });
  
  if (validOutputs.length === 0) {
    return {
      success: false,
      text: '抱歉，暂时无法获取分析结果，请稍后重试。'
    };
  }
  
  // 如果只有一个AI成功，直接返回
  if (validOutputs.length === 1) {
    return {
      success: true,
      text: formatSingleOutput(validOutputs[0], chatType, scene)
    };
  }
  
  // 多个AI成功：调用 GPT-4 进行智能合成
  const synthesisPrompt = buildSynthesisPrompt(validOutputs, { mode, scene, chatType, symbols, text });
  
  const synthesisResult = await callGPT4(synthesisPrompt, scene.targetLength);
  
  if (!synthesisResult.success) {
    // 合成失败，返回简单拼接
    return {
      success: true,
      text: formatMultipleOutputs(validOutputs, chatType, scene),
      fallback: true
    };
  }
  
  console.log(`✨ 合成完成`);
  
  return {
    success: true,
    text: synthesisResult.text,
    synthesized: true
  };
}

// Build Synthesis Prompt - 合成指令
function buildSynthesisPrompt(aiOutputs, { mode, scene, chatType, symbols, text }) {
  const styleGuide = chatType === 'private' 
    ? `写作风格：
- 像老师给学生讲解，用"你看"、"我注意到"等口语
- 用生活化类比解释复杂概念（如"就像菜市场抢菜，价格虚高"）
- 温和但坚定，鼓励性话语
- 适度emoji（📊💡⚠️✅等）`
    : `写作风格：
- 专业团队口吻，用"老师团队认为"、"我们认为"
- 结构化输出：标题 + 数据 + 点评 + 展望
- 正式但不僵硬
- 明确的观点和建议`;
  
  const outputsSummary = aiOutputs.map(o => `【${o.name}】\n${o.text}`).join('\n\n');
  
  return `你是USIS智能合成系统，负责整合多位专家的分析，生成连贯、专业的最终报告。

场景：${scene.name}
股票：${symbols.join(', ') || '无特定股票'}
用户请求：${text}

${styleGuide}

以下是三位专家的独立分析：

${outputsSummary}

请基于以上分析，生成一份${scene.targetLength}字左右的最终报告，要求：

1. **不是简单拼接**：提炼关键观点，识别共识和分歧
2. **连贯叙述**：像一个人在说话，不要分段罗列
3. **突出重点**：
   - ${scene.depth === 'brief' ? '快速扫描关键信息' : scene.depth === 'medium' ? '中等深度分析' : '深度剖析趋势和策略'}
   - 明确的判断（BUY/HOLD/SELL）
   - 2-3个核心理由
4. **风格一致**：${chatType === 'private' ? '口语化、有温度' : '专业、结构化'}

不要：
- 不要说"根据以上分析"、"综合来看"等套话
- 不要免责声明
- 不要机械重复专家观点

直接输出最终报告：`;
}

// Format Single Output - 单个AI输出格式化
function formatSingleOutput(output, chatType, scene) {
  if (chatType === 'private') {
    return `${output.text}\n\n💡 以上分析来自 ${output.name}`;
  } else {
    return `【${scene.name}】\n\n${output.text}\n\n━━━━━━━━━━━━━━━\n📊 ${output.name}`;
  }
}

// Format Multiple Outputs - 多个AI输出简单格式化（兜底方案）
function formatMultipleOutputs(outputs, chatType, scene) {
  if (chatType === 'private') {
    const sections = outputs.map(o => `${o.text}`).join('\n\n━━━\n\n');
    return `${sections}\n\n💡 综合了 ${outputs.length} 位专家的观点`;
  } else {
    const sections = outputs.map(o => `【${o.name}】\n${o.text}`).join('\n\n');
    return `【${scene.name}】\n\n${sections}`;
  }
}

// Main Orchestrator Endpoint
app.post("/brain/orchestrate", async (req, res) => {
  try {
    const startTime = Date.now();
    
    // 1. 解析输入
    const {
      text = "",
      chat_type = "private",  // private | group
      mode = null,            // premarket | intraday | postmarket | diagnose | news
      symbols: providedSymbols = [],  // 股票代码（如果提供）
      user_id = null,
      lang = "zh"
    } = req.body || {};
    
    // 1.5. 自动提取symbols（如果未提供）
    const extractedSymbols = extractSymbols(text);
    const symbols = providedSymbols.length > 0 ? providedSymbols : extractedSymbols;
    
    console.log(`\n🧠 Orchestrator 收到请求:`);
    console.log(`   文本: "${text}"`);
    console.log(`   场景: ${chat_type}`);
    console.log(`   模式: ${mode || '自动检测'}`);
    console.log(`   股票: ${symbols.join(', ') || '无'}${extractedSymbols.length > 0 ? ' (自动提取)' : ''}`);
    
    // 2. Intent Understanding (传入symbols用于智能判断图表类型)
    const intent = understandIntent(text, mode, symbols);
    console.log(`🎯 意图识别: ${intent.mode} (置信度: ${intent.confidence})`);
    
    // 2.6. 检测到的Action指令
    if (intent.actions && intent.actions.length > 0) {
      console.log(`🎬 检测到动作指令: ${intent.actions.map(a => a.type).join(', ')}`);
      intent.actions.forEach(action => {
        console.log(`   → ${action.tool}: ${action.reason}`);
      });
    }
    
    // 2.5. 从 PostgreSQL 读取用户历史记忆（最近3条）
    let userHistory = [];
    let userPrefs = {};
    if (user_id) {
      try {
        const historyResult = await pool.query(
          'SELECT request_text, mode, symbols, response_text, timestamp FROM user_memory WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 3',
          [user_id]
        );
        userHistory = historyResult.rows;
        console.log(`💾 用户历史记忆: 找到${userHistory.length}条记录`);
        
        // 从内存中读取用户偏好（旧逻辑保留兼容）
        userPrefs = Memory.userPrefs[user_id] || {};
      } catch (error) {
        console.error(`❌ 读取用户历史失败:`, error.message);
        userHistory = [];
        userPrefs = Memory.userPrefs[user_id] || {};
      }
    }
    console.log(`💾 用户偏好:`, Object.keys(userPrefs).length ? userPrefs : '无');
    
    // 3. Scene Awareness (考虑置信度和用户偏好)
    const scene = analyzeScene(intent.mode, symbols);
    
    // 应用用户偏好调整场景
    if (userPrefs.preferred_depth) {
      const depthMultipliers = { brief: 0.7, medium: 1.0, deep: 1.3 };
      scene.targetLength = Math.round(scene.targetLength * (depthMultipliers[userPrefs.preferred_depth] || 1.0));
      console.log(`💾 应用用户偏好深度: ${userPrefs.preferred_depth}`);
    }
    
    if (userPrefs.preferred_tone) {
      scene.userTone = userPrefs.preferred_tone; // casual | professional
      console.log(`💾 应用用户偏好语气: ${userPrefs.preferred_tone}`);
    }
    
    // 如果置信度低，添加警告
    if (intent.confidence < 0.7) {
      scene.lowConfidence = true;
      console.log(`⚠️  低置信度检测，可能需要用户确认`);
    }
    
    console.log(`📋 场景分析: ${scene.name} | 目标长度: ${scene.targetLength}字 | 深度: ${scene.depth}`);
    
    // 🚀 三级Orchestrator: 复杂度评分 & 模型选择
    const complexity = calculateComplexityScore(text, intent.mode, symbols, userHistory);
    console.log(`🎯 复杂度评分: ${complexity.score}/10 | 层级: ${complexity.tier}`);
    console.log(`   推理: ${complexity.reasoning}`);
    
    // 智能模型选择（默认medium预算）
    const budget = process.env.AI_BUDGET || 'medium';  // 可通过环境变量配置
    const modelSelection = selectOptimalModels(complexity, intent.mode, symbols, budget);
    console.log(`🤖 模型选择: ${modelSelection.models.map(m => m.name).join(', ')}`);
    console.log(`💰 预估成本: $${modelSelection.estimatedCost} (预算: $${modelSelection.budgetConfig})`);
    
    // 4. Planning
    const tasks = planTasks(intent, scene, symbols);
    console.log(`📝 任务规划: ${tasks.join(' → ')}`);
    
    // 🎯 特殊处理1：Meta问题（关于AI本身）
    if (intent.mode === 'meta') {
      console.log(`🤖 检测到Meta问题（关于AI能力），直接回复`);
      
      const metaText = `你好！我是USIS Brain v3，一个智能市场分析助手。

🧠 **我的核心能力：**
1. **实时市场分析** - 盘前、盘中、盘后全天候分析
2. **个股诊断** - 技术面 + 基本面 + 情绪面综合解读
3. **6模型协同** - Claude、GPT-4、Gemini等6个AI专家团队分析
4. **可视化热力图** - 支持40+全球指数（美股、欧洲、亚洲等）
5. **新闻追踪** - 实时抓取市场动态和公司新闻
6. **记忆学习** - 记住你的历史对话和偏好，提供个性化分析

💡 **使用示例：**
- "盘前NVDA" - 查看NVDA盘前分析
- "特斯拉热力图" - 查看特斯拉所在板块热力图
- "西班牙IBEX35热力图" - 查看西班牙市场
- "新闻资讯" - 获取最新市场动态

💾 **关于学习：**
我会记住你最近的对话历史（最近3条），根据你的偏好和习惯调整分析风格。
想清空记忆？说"清空记忆"即可重新开始！

有什么市场问题可以随时问我！📈`;
      
      return res.json({
        status: "ok",
        ok: true,
        final_analysis: metaText,
        final_text: metaText,
        needs_heatmap: false,
        actions: [],
        intent: { mode: 'meta', lang: intent.lang, confidence: 1.0 },
        scene: { name: 'Meta', depth: 'simple', targetLength: 200 },
        symbols: [],
        market_data: null,
        ai_results: null,
        synthesis: { success: true, synthesized: false },
        low_confidence: false,
        chat_type,
        user_id,
        response_time_ms: Date.now() - startTime,
        debug: { note: 'Meta question - direct response' }
      });
    }
    
    // 🎯 特殊处理2：纯新闻请求（无需AI分析）
    if (intent.mode === 'news' && symbols.length === 0 && !/(分析|解读|点评)/.test(text)) {
      console.log(`📰 检测到纯新闻请求，直接返回新闻列表`);
      
      const newsPrompt = intent.actions && intent.actions.length > 0
        ? `用户需要：${intent.actions.map(a => a.reason).join('、')}`
        : '市场最新动态';
      
      const newsText = `📰 新闻资讯\n\n${newsPrompt}\n\n💡 提示：请说"分析XX新闻"或提供股票代码，我可以为您深度解读市场动态。`;
      
      return res.json({
        status: "ok",
        ok: true,
        final_analysis: newsText,
        final_text: newsText,
        needs_heatmap: false,
        actions: [
          {
            type: 'fetch_news',
            tool: 'RSS_News',
            reason: '用户需要新闻资讯'
          }
        ],
        intent: { mode: 'news', lang: intent.lang, confidence: intent.confidence },
        scene: { name: scene.name, depth: 'simple', targetLength: 100 },
        symbols: [],
        market_data: null,
        ai_results: null,
        synthesis: { success: true, synthesized: false },
        low_confidence: false,
        chat_type,
        user_id,
        response_time_ms: Date.now() - startTime,
        debug: { note: 'Pure news request - skipped AI analysis' }
      });
    }
    
    // 🎯 特殊处理3：闲聊模式检测（用简短AI回复，不调用6模型）
    const marketKeywords = ['分析', '走势', '图', 'K线', '趋势', '价格', '股票', '行情', '盘前', '盘中', '盘后', '热力图', '涨', '跌', '买', '卖', '买点', '卖点', '止损', '止盈', '复盘', '板块', 'chart', 'stock', 'market'];
    const hasMarketKeywords = marketKeywords.some(k => text.toLowerCase().includes(k));
    const isMarketMode = ['premarket', 'intraday', 'postmarket', 'diagnose', 'news', 'heatmap'].includes(intent.mode);
    const isCasualChat = !hasMarketKeywords && !isMarketMode && symbols.length === 0;
    
    if (isCasualChat) {
      console.log(`💬 检测到闲聊模式，使用简短AI回复`);
      
      // 闲聊模式：只调用GPT-4，用简短prompt
      const casualPrompt = `你是一个友好、简洁的聊天助手。只用中文回答。每次回复控制在1~3句，最多120字。避免行情/技术分析。

用户说：${text}

请简短友好地回复，如果合适可以引导用户尝试市场分析功能。`;
      
      try {
        const gptResult = await callGPT4(casualPrompt, 60); // 最多60 tokens，约120字
        
        let chatText = gptResult.success ? gptResult.text : '你好！我是市场分析助手，可以帮你分析股票、查看热力图等。有什么想了解的吗？';
        
        // 限制长度：最多240字符（约120汉字）
        if (chatText.length > 240) {
          chatText = chatText.slice(0, 240) + '...';
        }
        
        return res.json({
          status: "ok",
          ok: true,
          final_analysis: chatText,
          final_text: chatText,
          needs_heatmap: false,
          actions: [],
          intent: { mode: 'casual', lang: intent.lang, confidence: 0.9 },
          scene: { name: 'Casual', depth: 'simple', targetLength: 50 },
          symbols: [],
          market_data: null,
          ai_results: { gpt4: gptResult },
          synthesis: { success: true, synthesized: false },
          low_confidence: false,
          chat_type,
          user_id,
          response_time_ms: Date.now() - startTime,
          debug: { note: 'Casual chat - used lightweight GPT-4 response' }
        });
      } catch (error) {
        console.error('❌ 闲聊模式GPT-4调用失败:', error.message);
        // 降级到预设回复
        return res.json({
          status: "ok",
          ok: true,
          final_analysis: '你好！我是市场分析助手，可以帮你分析股票、查看热力图等。有什么想了解的吗？',
          final_text: '你好！我是市场分析助手，可以帮你分析股票、查看热力图等。有什么想了解的吗？',
          needs_heatmap: false,
          actions: [],
          intent: { mode: 'casual', lang: intent.lang, confidence: 0.9 },
          scene: { name: 'Casual', depth: 'simple', targetLength: 50 },
          symbols: [],
          market_data: null,
          ai_results: null,
          synthesis: { success: true, synthesized: false },
          low_confidence: false,
          chat_type,
          user_id,
          response_time_ms: Date.now() - startTime,
          debug: { note: 'Casual chat - fallback to preset response' }
        });
      }
    }
    
    // 4.5. 数据采集（如果有股票代码）
    let marketData = null;
    if (symbols.length > 0) {
      marketData = await collectMarketData(symbols, {
        mode: intent.mode,
        text: text
      });
    }
    
    // 5. Execute Multi-AI Analysis
    const aiResults = await multiAIAnalysis({
      mode: intent.mode,
      scene,
      symbols,
      text,
      chatType: chat_type,
      marketData
    });
    
    // 6. Intelligent Synthesis
    const synthesis = await synthesizeAIOutputs(aiResults, {
      mode: intent.mode,
      scene,
      chatType: chat_type,
      symbols,
      text
    });
    
    const responseText = synthesis.text;
    const imageUrl = null; // TODO: 后续添加图表生成
    
    // 7. Save to PostgreSQL Memory
    if (user_id) {
      try {
        await pool.query(
          'INSERT INTO user_memory (user_id, request_text, mode, symbols, response_text, chat_type) VALUES ($1, $2, $3, $4, $5, $6)',
          [user_id, text, intent.mode, symbols, responseText, chat_type]
        );
        console.log(`💾 保存用户记忆: user_id=${user_id}, mode=${intent.mode}`);
      } catch (error) {
        console.error(`❌ 保存用户记忆失败:`, error.message);
      }
    }
    
    // 同时保存到旧Memory系统（兼容性）
    Memory.save({
      user_id,
      intent: intent.mode,
      chat_type,
      symbols,
      success: synthesis.success,
      synthesized: synthesis.synthesized,
      ok: true
    });
    
    const responseTime = Date.now() - startTime;
    console.log(`✅ 响应完成 (${responseTime}ms)\n`);
    
    // --- Response Mapper (v2): standardize orchestrator output ---
    const reqId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

    // L1
    const l1_intent = intent;
    const l1_score = complexity.score;

    // L2
    const l2_plan = tasks;  // 任务分解
    const l2_models = modelSelection.models;
    const l2_budget = modelSelection.budgetConfig;

    // L3
    const l3_triggered = complexity.tier === 'L3';
    const l3_models = l3_triggered 
      ? modelSelection.models.filter(m => m.name === 'o1' || m.name === 'claude-opus').map(m => m.name)
      : [];
    const l3_reason = l3_triggered ? complexity.reasoning : null;

    // Cost
    const estCost = modelSelection.estimatedCost;
    let totalCost = null;
    try {
      totalCost = await getTotalCostFromDB(reqId);
    } catch(_) {}

    // SEC 财报
    const sec_financials = marketData?.data?.sec_financials || null;

    // 终端文本
    const finalSummary = responseText;

    // 归一化 actions
    const actions_v2 = intent.actions || [];

    // v2 标准响应
    const responseV2 = {
      ok: true,
      status: "ok",  // N8N workflow需要此字段
      requestId: reqId,
      levels: {
        l1: { intent: l1_intent, score: l1_score, router: 'gpt-4o-mini' },
        l2: { plan: l2_plan, modelsSelected: l2_models, budget: l2_budget },
        l3: { triggered: l3_triggered, models: l3_models, reason: l3_reason }
      },
      cost: {
        estimated: estCost,
        total: totalCost
      },
      market_data: {
        sec_financials,
        collected: marketData?.collected,
        summary: marketData?.summary,
        data: marketData?.data
      },
      summary: finalSummary,
      caption: finalSummary,
      actions: actions_v2,
      
      // 兼容老字段
      final_analysis: responseText,
      final_text: responseText,
      image_url: imageUrl,
      needs_heatmap: intent.actions ? intent.actions.some(a => a.type === 'fetch_heatmap') : false,
      intent: {
        mode: intent.mode,
        lang: intent.lang,
        confidence: intent.confidence
      },
      scene: {
        name: scene.name,
        depth: scene.depth,
        targetLength: scene.targetLength
      },
      symbols,
      ai_results: aiResults,
      synthesis: {
        success: synthesis.success,
        synthesized: synthesis.synthesized
      },
      low_confidence: intent.confidence < 0.7,
      chat_type,
      user_id,
      response_time_ms: responseTime,
      
      // Debug信息
      debug: {
        style: chat_type === 'private' ? 'teacher_personal' : 'team_professional',
        tasks,
        user_prefs: userPrefs,
        complexity: {
          score: complexity.score,
          tier: complexity.tier,
          reasoning: complexity.reasoning
        },
        model_selection: {
          models: modelSelection.models.map(m => ({ name: m.name, role: m.role })),
          estimated_cost: modelSelection.estimatedCost,
          tier: modelSelection.tier
        }
      }
    };

    // 🚀 三级Orchestrator: 成本追踪（异步，不阻塞响应）
    trackCost(
      user_id, 
      intent.mode, 
      modelSelection.models, 
      modelSelection.estimatedCost, 
      responseTime
    ).catch(err => console.error('成本追踪失败:', err.message));
    
    // 8. Response
    return res.json(responseV2);
    
  } catch (err) {
    console.error("❌ Orchestrator 错误:", err);
    Memory.save({ error: String(err), ok: false });
    
    return res.status(500).json({
      ok: false,
      error: "orchestrator_failed",
      detail: String(err)
    });
  }
});

// Memory API - 查看系统记忆
app.get("/brain/memory", (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  return res.json({
    recent_logs: Memory.recent(limit),
    user_prefs: Memory.userPrefs
  });
});

// Memory Clear API - 清空用户历史记忆
app.post("/brain/memory/clear", async (req, res) => {
  try {
    const { user_id } = req.body;
    
    if (!user_id) {
      return res.status(400).json({
        ok: false,
        error: "user_id is required"
      });
    }
    
    // 从PostgreSQL删除用户历史
    const result = await pool.query(
      'DELETE FROM user_memory WHERE user_id = $1',
      [user_id]
    );
    
    console.log(`🗑️  清空用户记忆: user_id=${user_id}, 删除${result.rowCount}条记录`);
    
    // 同时清空内存中的用户偏好（兼容性）
    if (Memory.userPrefs[user_id]) {
      delete Memory.userPrefs[user_id];
    }
    
    return res.json({
      ok: true,
      message: `已清空用户 ${user_id} 的历史记忆`,
      deleted_count: result.rowCount
    });
    
  } catch (error) {
    console.error(`❌ 清空记忆失败:`, error.message);
    return res.status(500).json({
      ok: false,
      error: "clear_memory_failed",
      detail: error.message
    });
  }
});

// 批量测试端点 - 同时显示多个dataSource
app.get("/heatmap/test-all", (req, res) => {
  const testCodes = [
    { code: 'SPX500', name: 'S&P 500' },
    { code: 'DJI', name: 'Dow Jones' },
    { code: 'NDX', name: 'Nasdaq 100' },
    { code: 'IXIC', name: 'Nasdaq Composite' },
    { code: 'RUT', name: 'Russell 2000' },
    { code: 'USA', name: 'All US' },
    { code: 'IBEX', name: 'IBEX 35' },
    { code: 'IBEX35', name: 'IBEX 35 Alt' },
    { code: 'BME', name: 'Spain BME' },
    { code: 'SPAIN', name: 'Spain' },
    { code: 'DAX', name: 'DAX Germany' },
    { code: 'FTSE', name: 'FTSE UK' },
    { code: 'CAC', name: 'CAC France' },
    { code: 'STOXX', name: 'Euro Stoxx' },
    { code: 'NKY', name: 'Nikkei' },
    { code: 'HSI', name: 'Hang Seng' },
    { code: 'ASX', name: 'Australia' },
    { code: 'ASX200', name: 'ASX 200' }
  ];

  let html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>TradingView DataSource Grid Test</title>
<style>
  body { font-family: Arial, sans-serif; background: #0D1117; color: white; margin: 0; padding: 20px; }
  h1 { text-align: center; color: #58A6FF; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 20px; margin-top: 30px; }
  .widget-box { background: #161B22; border: 1px solid #30363D; border-radius: 8px; padding: 15px; height: 350px; }
  .widget-title { font-weight: bold; margin-bottom: 10px; color: #58A6FF; text-align: center; }
  .widget-code { font-size: 12px; color: #8B949E; text-align: center; margin-bottom: 10px; }
  .widget-container { width: 100%; height: 280px; }
</style></head><body>
<h1>🔬 TradingView DataSource 批量测试</h1>
<p style="text-align: center; color: #8B949E;">观察哪些widget显示了不同的内容（非S&P 500），那些dataSource值就是有效的</p>
<div class="grid">`;

  testCodes.forEach(({ code, name }) => {
    html += `<div class="widget-box">
      <div class="widget-title">${name}</div>
      <div class="widget-code">dataSource: "${code}"</div>
      <div class="widget-container">
        <div class="tradingview-widget-container" style="width: 100%; height: 100%;">
          <div class="tradingview-widget-container__widget"></div>
          <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js" async>
          {"exchanges":[],"dataSource":"${code}","grouping":"sector","blockSize":"market_cap_basic","blockColor":"change","locale":"en","symbolUrl":"","colorTheme":"dark","hasTopBar":false,"isDataSetEnabled":true,"isZoomEnabled":true,"hasSymbolTooltip":true,"width":"100%","height":"100%"}
          </script>
        </div>
      </div>
    </div>`;
  });

  html += `</div>
<div style="margin-top: 40px; text-align: center; color: #8B949E;">
  <p>💡 提示：向下滚动查看所有测试。如果某个widget和其他的内容不同，说明dataSource有效！</p>
</div></body></html>`;

  res.send(html);
});

// 测试端点 - 用于测试不同的TradingView dataSource值
app.get("/heatmap/test", (req, res) => {
  const testSource = req.query.source || 'SPX500';
  
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TradingView DataSource Tester</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #131722;
      color: white;
    }
    .controls {
      background: #1E222D;
      padding: 20px;
      border-bottom: 2px solid #2A2E39;
    }
    .controls h1 {
      font-size: 20px;
      margin-bottom: 15px;
      color: #D1D4DC;
    }
    .controls input {
      width: 300px;
      padding: 10px;
      font-size: 16px;
      border: 1px solid #2A2E39;
      background: #131722;
      color: white;
      border-radius: 4px;
      margin-right: 10px;
    }
    .controls button {
      padding: 10px 20px;
      font-size: 16px;
      background: #2962FF;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    .controls button:hover {
      background: #1E53E5;
    }
    .current-value {
      margin-top: 10px;
      color: #787B86;
      font-size: 14px;
    }
    .tradingview-widget-container {
      width: 100%;
      height: calc(100vh - 150px);
    }
  </style>
</head>
<body>
  <div class="controls">
    <h1>🔬 TradingView DataSource Tester</h1>
    <input type="text" id="sourceInput" value="${testSource}" placeholder="输入dataSource值 (例如: SPX500, NDX, DJI)">
    <button onclick="testSource()">测试</button>
    <div class="current-value">当前测试值: <strong>${testSource}</strong></div>
  </div>
  
  <div class="tradingview-widget-container">
    <div class="tradingview-widget-container__widget"></div>
    <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js" async>
    {
      "exchanges": [],
      "dataSource": "${testSource}",
      "grouping": "sector",
      "blockSize": "market_cap_basic",
      "blockColor": "change",
      "locale": "en",
      "symbolUrl": "",
      "colorTheme": "dark",
      "hasTopBar": false,
      "isDataSetEnabled": true,
      "isZoomEnabled": true,
      "hasSymbolTooltip": true,
      "width": "100%",
      "height": "100%"
    }
    </script>
  </div>
  
  <script>
    function testSource() {
      const value = document.getElementById('sourceInput').value.trim();
      window.location.href = '/heatmap/test?source=' + encodeURIComponent(value);
    }
    
    document.getElementById('sourceInput').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        testSource();
      }
    });
  </script>
</body>
</html>
  `);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 USIS Brain v3 online on port ${PORT}`);
  console.log(`📍 Listening on 0.0.0.0:${PORT}`);
  console.log(`🔗 Health check available at http://0.0.0.0:${PORT}/health`);
});
