/**
 * Runner - v4.5 (Minimal for Pure SaaS)
 * 仅超时控制，无重试（让 SaaS 服务自己处理）
 */

const DEFAULT_TIMEOUT_MS = parseInt(process.env.TASK_TIMEOUT_MS || '30000', 10);

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
 * 执行器：仅超时保护
 */
async function runWithGuards(provider, taskFn) {
  return withTimeout(taskFn());
}

module.exports = { runWithGuards };
