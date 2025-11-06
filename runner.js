/**
 * Runner - v4.4 (Simplified for Pure SaaS)
 * 超时控制 + 重试机制（移除复杂的熔断器和队列，因为只有单一SaaS提供商）
 */

const DEFAULT_TIMEOUT_MS = parseInt(process.env.TASK_TIMEOUT_MS || '25000', 10);
const MAX_RETRIES        = parseInt(process.env.TASK_MAX_RETRIES || '2', 10);

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function backoff(attempt) {
  return 800 * (2 ** attempt) + Math.floor(Math.random() * 300);
}

function isRetryable(e) {
  const msg = String(e);
  return /429|rate|Too Many|5\d\d|timeout|ETIMEDOUT|ECONNRESET|ENOTFOUND/i.test(msg);
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

/**
 * 统一执行器：带超时和重试
 * 适用于单一SaaS提供商（无需复杂的熔断器和多provider状态管理）
 */
async function runWithGuards(provider, taskFn) {
  let lastErr;
  
  for (let i = 0; i <= MAX_RETRIES; i++) {
    try {
      const res = await withTimeout(taskFn());
      return res;
    } catch (e) {
      lastErr = e;
      
      if (!isRetryable(e) || i === MAX_RETRIES) {
        break;
      }
      
      const wait = backoff(i);
      console.warn(`⚠️  [重试 ${i + 1}/${MAX_RETRIES}] ${provider}: ${e.message.substring(0, 50)}, 退避${wait}ms`);
      await sleep(wait);
    }
  }
  
  throw lastErr;
}

module.exports = { runWithGuards };
