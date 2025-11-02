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

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`🚀 USIS Brain v3 online on port ${PORT}`));
