/**
 * asyncTools.js - 异步操作工具集
 * 提供超时控制、重试机制等可靠性增强功能
 */

/**
 * 为异步操作添加超时控制
 * @param {string} label - 操作标签（用于日志）
 * @param {Function} fn - 异步函数
 * @param {number} timeoutMs - 超时时间（毫秒）
 * @returns {Promise<any>} 操作结果
 * @throws {Error} 超时错误
 */
async function runWithTimeout(label, fn, timeoutMs) {
  return new Promise(async (resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`[Timeout] ${label} exceeded ${timeoutMs}ms`));
    }, timeoutMs);

    try {
      const result = await fn();
      clearTimeout(timer);
      resolve(result);
    } catch (error) {
      clearTimeout(timer);
      reject(error);
    }
  });
}

/**
 * 智能重试助手
 * 实现指数退避和抖动机制
 */
class RetryHelper {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 2;
    this.baseDelay = options.baseDelay || 1500; // 1.5秒
    this.backoffFactor = options.backoffFactor || 2;
    this.jitter = options.jitter || 250; // ±250ms
    this.retryableErrors = options.retryableErrors || [
      'ECONNABORTED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNRESET',
      'EPIPE'
    ];
  }

  /**
   * 判断错误是否可重试
   * @param {Error} error - 错误对象
   * @returns {boolean}
   */
  isRetryable(error) {
    if (!error) return false;
    
    // 网络错误
    if (this.retryableErrors.includes(error.code)) return true;
    
    // HTTP 5xx错误
    if (error.response && error.response.status >= 500) return true;
    
    // 超时错误
    if (error.message && error.message.includes('timeout')) return true;
    
    return false;
  }

  /**
   * 计算延迟时间（带抖动）
   * @param {number} attempt - 当前重试次数（从0开始）
   * @returns {number} 延迟毫秒数
   */
  getDelay(attempt) {
    const exponentialDelay = this.baseDelay * Math.pow(this.backoffFactor, attempt);
    const jitterOffset = Math.random() * this.jitter * 2 - this.jitter;
    return Math.max(0, exponentialDelay + jitterOffset);
  }

  /**
   * 执行带重试的异步操作
   * @param {string} label - 操作标签
   * @param {Function} fn - 异步函数
   * @param {Object} options - 选项
   * @returns {Promise<any>}
   */
  async execute(label, fn, options = {}) {
    const startTime = Date.now();
    const timeoutBudget = options.timeout || Infinity;
    let lastError = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // 检查时间预算
        const elapsed = Date.now() - startTime;
        if (elapsed >= timeoutBudget) {
          throw new Error(`[RetryBudget] ${label} exceeded time budget ${timeoutBudget}ms`);
        }

        if (attempt > 0) {
          const delay = this.getDelay(attempt - 1);
          console.log(`🔁 [Retry ${attempt}/${this.maxRetries}] ${label} - waiting ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        const result = await fn();
        
        if (attempt > 0) {
          console.log(`✅ [Retry Success] ${label} succeeded on attempt ${attempt + 1}`);
        }
        
        return result;

      } catch (error) {
        lastError = error;
        
        // 检查是否还有重试机会
        const hasRetriesLeft = attempt < this.maxRetries;
        const isRetryable = this.isRetryable(error);
        const hasTimeBudget = (Date.now() - startTime) < timeoutBudget;

        if (!hasRetriesLeft || !isRetryable || !hasTimeBudget) {
          console.error(`❌ [Retry Failed] ${label} - attempt ${attempt + 1}/${this.maxRetries + 1}`, {
            error: error.message,
            code: error.code,
            retryable: isRetryable,
            hasRetriesLeft,
            hasTimeBudget
          });
          throw error;
        }

        console.warn(`⚠️  [Retry] ${label} failed on attempt ${attempt + 1}:`, error.message);
      }
    }

    throw lastError;
  }
}

/**
 * 延迟函数
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  runWithTimeout,
  RetryHelper,
  delay
};
