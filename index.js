// ====== USIS Brain · v3（多模型 + 投票） ======
const express = require("express");
const fetch = require("node-fetch");
const app = express();
app.use(express.json());

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
    console.log(`📊 生成热力图: market=${market}`);

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
    const html = generateHeatmapHTML(validStocks, market);
    res.send(html);

  } catch (err) {
    console.error("❌ 热力图生成错误:", err);
    res.send(`<h1>Error: ${err.message}</h1>`);
  }
});

// 生成热力图HTML
function generateHeatmapHTML(stocks, marketName) {
  const marketTitles = {
    usa: '美国股市热力图',
    spain: '西班牙股市热力图',
    germany: '德国股市热力图',
    japan: '日本股市热力图',
    uk: '英国股市热力图',
    hongkong: '香港股市热力图',
    china: '中国A股热力图',
    france: '法国股市热力图',
    europe: '欧洲股市热力图',
    world: '全球股市热力图'
  };

  const title = marketTitles[marketName] || '股市热力图';

  const stocksHTML = stocks.map(stock => {
    const changeNum = parseFloat(stock.change);
    const color = changeNum >= 0 ? 
      `hsl(120, ${Math.min(100, Math.abs(changeNum) * 20)}%, ${50 - Math.min(40, Math.abs(changeNum) * 3)}%)` :  // 绿色
      `hsl(0, ${Math.min(100, Math.abs(changeNum) * 20)}%, ${50 - Math.min(40, Math.abs(changeNum) * 3)}%)`;      // 红色
    
    const size = Math.max(100, Math.min(300, stock.value * 30));  // 根据涨跌幅调整大小
    
    return `
      <div class="stock-card" style="background: ${color}; width: ${size}px; height: ${size}px;">
        <div class="symbol">${stock.symbol}</div>
        <div class="change">${changeNum >= 0 ? '+' : ''}${stock.change}%</div>
        <div class="price">$${stock.price.toFixed(2)}</div>
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0e27;
      color: white;
      padding: 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .header h1 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 10px;
    }
    .header .timestamp {
      color: #888;
      font-size: 14px;
    }
    .heatmap-container {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      justify-content: center;
      padding: 20px;
    }
    .stock-card {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      border-radius: 8px;
      transition: transform 0.2s;
      cursor: pointer;
      padding: 10px;
    }
    .stock-card:hover {
      transform: scale(1.05);
      box-shadow: 0 8px 20px rgba(0,0,0,0.3);
    }
    .symbol {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .change {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .price {
      font-size: 14px;
      opacity: 0.8;
    }
    .legend {
      display: flex;
      justify-content: center;
      gap: 40px;
      margin-top: 30px;
      padding: 20px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .legend-color {
      width: 30px;
      height: 30px;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    <div class="timestamp">${new Date().toLocaleString('zh-CN')}</div>
  </div>
  
  <div class="heatmap-container">
    ${stocksHTML}
  </div>

  <div class="legend">
    <div class="legend-item">
      <div class="legend-color" style="background: hsl(120, 80%, 30%);"></div>
      <span>大涨</span>
    </div>
    <div class="legend-item">
      <div class="legend-color" style="background: hsl(120, 50%, 40%);"></div>
      <span>小涨</span>
    </div>
    <div class="legend-item">
      <div class="legend-color" style="background: hsl(0, 50%, 40%);"></div>
      <span>小跌</span>
    </div>
    <div class="legend-item">
      <div class="legend-color" style="background: hsl(0, 80%, 30%);"></div>
      <span>大跌</span>
    </div>
  </div>
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
function detectActions(text = "") {
  const t = text.toLowerCase();
  const actions = [];
  
  // 视觉需求（截图/热力图）
  if (/热力图|heatmap|截图|screenshot|图表|chart|可视化|visual|带图/.test(t)) {
    // 检测地区/国家，返回对应的市场参数
    let market = 'usa';
    let marketName = '美股市场';
    
    if (/西班牙|spain|ibex|马德里/.test(t)) {
      market = 'spain';
      marketName = '西班牙市场';
    } else if (/德国|germany|dax|法兰克福/.test(t)) {
      market = 'germany';
      marketName = '德国市场';
    } else if (/英国|uk|britain|ftse|伦敦/.test(t)) {
      market = 'uk';
      marketName = '英国市场';
    } else if (/日本|japan|nikkei|东京/.test(t)) {
      market = 'japan';
      marketName = '日本市场';
    } else if (/法国|france|cac/.test(t)) {
      market = 'france';
      marketName = '法国市场';
    } else if (/香港|hk|恒生|hsi/.test(t)) {
      market = 'hongkong';
      marketName = '香港市场';
    } else if (/中国|a股|上证|深证|沪深/.test(t)) {
      market = 'china';
      marketName = '中国市场';
    } else if (/欧洲|europe|eu/.test(t)) {
      market = 'europe';
      marketName = '欧洲市场';
    } else if (/全球|世界|world/.test(t)) {
      market = 'world';
      marketName = '全球市场';
    }
    
    // 使用自建热力图（快速、稳定、支持所有市场）
    const baseUrl = process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : 'https://node-js-tiqxi842.replit.app';
    const heatmapUrl = `${baseUrl}/heatmap?market=${market}`;
    
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
function understandIntent(text = "", mode = null) {
  const t = text.toLowerCase();
  
  // 如果已经指定 mode，直接使用
  if (mode && ['premarket', 'intraday', 'postmarket', 'diagnose', 'news'].includes(mode)) {
    return { 
      mode, 
      confidence: 1.0, 
      lang: 'zh',
      actions: detectActions(text) // 新增：检测需要执行的动作
    };
  }
  
  // 关键词匹配
  let detectedMode = null;
  let confidence = 0.8;
  
  if (/(盘前|premarket|\bpre\b|开盘前|早盘)/.test(t)) {
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
    actions: detectActions(text) // 新增：检测需要执行的动作
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

请从技术分析角度提供${scene.targetLength/3}字左右的分析，包括：
- 技术指标判断
- 关键价位分析
- 短期趋势预测

要求：
- 专业但简洁
- 突出技术要点
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

请提供${scene.targetLength/5}字左右的综合分析，包括：
- 整体判断（BUY/HOLD/SELL）
- 核心理由（2-3点）
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

// 智能数据采集器 - 根据symbols自动采集多源数据
async function collectMarketData(symbols = []) {
  if (symbols.length === 0) {
    return { collected: false, reason: 'No symbols provided' };
  }
  
  console.log(`📊 开始采集数据: ${symbols.join(', ')}`);
  
  const results = {
    quotes: {},
    news: {},
    sentiment: {}
  };
  
  // 并行采集所有symbol的数据
  await Promise.all(
    symbols.map(async (symbol) => {
      const [quote, news, sentiment] = await Promise.all([
        fetchFinnhubQuote(symbol),
        fetchFinnhubNews(symbol, 3),
        fetchFinnhubSentiment(symbol)
      ]);
      
      if (quote.success) results.quotes[symbol] = quote;
      if (news.success) results.news[symbol] = news;
      if (sentiment.success) results.sentiment[symbol] = sentiment;
    })
  );
  
  console.log(`✅ 数据采集完成: quotes=${Object.keys(results.quotes).length}, news=${Object.keys(results.news).length}, sentiment=${Object.keys(results.sentiment).length}`);
  
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
    
    // 2. Intent Understanding
    const intent = understandIntent(text, mode);
    console.log(`🎯 意图识别: ${intent.mode} (置信度: ${intent.confidence})`);
    
    // 2.6. 检测到的Action指令
    if (intent.actions && intent.actions.length > 0) {
      console.log(`🎬 检测到动作指令: ${intent.actions.map(a => a.type).join(', ')}`);
      intent.actions.forEach(action => {
        console.log(`   → ${action.tool}: ${action.reason}`);
      });
    }
    
    // 2.5. 从 Memory 读取用户偏好
    const userPrefs = user_id ? Memory.userPrefs[user_id] || {} : {};
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
    
    // 4. Planning
    const tasks = planTasks(intent, scene, symbols);
    console.log(`📝 任务规划: ${tasks.join(' → ')}`);
    
    // 4.5. 数据采集（如果有股票代码）
    let marketData = null;
    if (symbols.length > 0) {
      marketData = await collectMarketData(symbols);
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
    
    // 7. Save to Memory
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
    
    // 8. Response
    return res.json({
      ok: true,
      final_analysis: responseText,  // 主要字段：最终综合分析
      image_url: imageUrl,
      
      // 🎯 新增：Action指令集（给N8N的器官指令）
      actions: intent.actions || [],  // Brain告诉N8N该执行哪些操作
      
      // 核心元数据
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
      
      // 数据采集结果
      market_data: marketData ? {
        collected: marketData.collected,
        summary: marketData.summary,
        data: marketData.data  // 包含完整数据供N8N使用
      } : null,
      
      // AI分析结果
      ai_results: aiResults,
      
      // 综合信息
      synthesis: {
        success: synthesis.success,
        synthesized: synthesis.synthesized
      },
      
      // 系统信息
      low_confidence: intent.confidence < 0.7,
      chat_type,
      user_id,
      response_time_ms: responseTime,
      
      // Debug信息
      debug: {
        style: chat_type === 'private' ? 'teacher_personal' : 'team_professional',
        tasks,
        user_prefs: userPrefs
      }
    });
    
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`🚀 USIS Brain v3 online on port ${PORT}`));
