// runner.js —— n8n风格执行壳（串行队列+超时+重试+熔断+资源回收）

const DEFAULT_TIMEOUT_MS = parseInt(process.env.TASK_TIMEOUT_MS || '25000', 10);
const MAX_RETRIES        = parseInt(process.env.TASK_MAX_RETRIES || '2', 10);
const COOL_DOWN_MS       = parseInt(process.env.PROVIDER_COOLDOWN_MS || '90000', 10);
const CONCURRENCY        = parseInt(process.env.TASK_CONCURRENCY || '1', 10);

const state = new Map(); // provider -> { fails, until }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function backoff(attempt) { return 800 * (2 ** attempt) + Math.floor(Math.random() * 300); }

function isRateLimit(e) { return /429|rate|Too Many/i.test(String(e)); }
function isRetryable(e) {
  const msg = String(e);
  return isRateLimit(e) || /5\d\d|timeout|ETIMEDOUT|ECONNRESET|ENOTFOUND/i.test(msg);
}

async function withTimeout(promise, ms = DEFAULT_TIMEOUT_MS) {
  let t;
  const timeout = new Promise((_, rej) => t = setTimeout(() => rej(new Error('timeout')), ms));
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(t);
  }
}

function circuitOpen(provider) {
  const s = state.get(provider);
  return s && s.until && Date.now() < s.until;
}

function noteFailure(provider) {
  const s = state.get(provider) || { fails: 0, until: 0 };
  s.fails += 1;
  if (s.fails >= 3) {
    s.until = Date.now() + COOL_DOWN_MS;
    console.warn(`🔌 [熔断器] ${provider} 连续失败3次，冷却${COOL_DOWN_MS / 1000}秒`);
  }
  state.set(provider, s);
}

function noteSuccess(provider) {
  state.set(provider, { fails: 0, until: 0 });
}

// 简易串行队列
let running = 0;
const queue = [];

async function enqueue(fn) {
  if (running >= CONCURRENCY) {
    await new Promise(res => queue.push(res));
  }
  running++;
  try {
    return await fn();
  } finally {
    running--;
    const next = queue.shift();
    if (next) next();
  }
}

// 统一执行器：带超时、重试、熔断
async function runWithGuards(provider, taskFn) {
  if (circuitOpen(provider)) {
    throw new Error(`${provider}_circuit_open`);
  }

  let lastErr;
  for (let i = 0; i <= MAX_RETRIES; i++) {
    try {
      const res = await withTimeout(taskFn());
      noteSuccess(provider);
      return res;
    } catch (e) {
      lastErr = e;
      if (!isRetryable(e) || i === MAX_RETRIES) {
        noteFailure(provider);
        break;
      }
      const wait = backoff(i);
      console.warn(`⚠️  [重试 ${i + 1}/${MAX_RETRIES}] ${provider}: ${e.message.substring(0, 50)}, 退避${wait}ms`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

module.exports = { enqueue, runWithGuards };
