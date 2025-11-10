/**
 * 🆕 v1.1: 统一API客户端（超时+重试+熔断器）
 * 
 * 用于标准化所有外部API调用，提供：
 * - 可配置超时（默认25秒）
 * - 指数退避重试（默认2次）
 * - 简单熔断器（连续失败后暂停）
 * - 错误分类（timeout vs network vs server）
 * - 详细日志
 */

// 🔧 全局默认配置
const DEFAULT_TIMEOUT_MS = 25000; // 25秒（符合Telegram 30秒限制）
const DEFAULT_MAX_RETRIES = 2; // 最多重试2次（总共3次尝试）
const DEFAULT_BACKOFF_BASE_MS = 100; // 重试基础延迟100ms

// 🔥 简单熔断器状态（per-provider）
const circuitBreakers = new Map();
const CIRCUIT_BREAKER_THRESHOLD = 5; // 连续失败5次后打开熔断器
const CIRCUIT_BREAKER_RESET_MS = 60000; // 60秒后重置熔断器

/**
 * 检查熔断器状态
 * @param {string} providerId - Provider标识（例如："openai", "finnhub"）
 * @returns {boolean} - true表示熔断器打开（禁止请求）
 */
function isCircuitBreakerOpen(providerId) {
  const breaker = circuitBreakers.get(providerId);
  if (!breaker) return false;
  
  const now = Date.now();
  
  // 检查是否超过重置时间
  if (now - breaker.openedAt > CIRCUIT_BREAKER_RESET_MS) {
    circuitBreakers.delete(providerId);
    console.log(`🔄 [Circuit Breaker] ${providerId} 熔断器已重置`);
    return false;
  }
  
  return breaker.isOpen;
}

/**
 * 记录失败并更新熔断器状态
 * @param {string} providerId 
 */
function recordFailure(providerId) {
  const breaker = circuitBreakers.get(providerId) || { consecutiveFailures: 0, isOpen: false };
  breaker.consecutiveFailures++;
  
  if (breaker.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD && !breaker.isOpen) {
    breaker.isOpen = true;
    breaker.openedAt = Date.now();
    console.error(`🔥 [Circuit Breaker] ${providerId} 熔断器已打开（${breaker.consecutiveFailures}次连续失败）`);
  }
  
  circuitBreakers.set(providerId, breaker);
}

/**
 * 记录成功并重置熔断器
 * @param {string} providerId 
 */
function recordSuccess(providerId) {
  circuitBreakers.delete(providerId);
}

/**
 * 错误分类
 * @param {Error} error 
 * @returns {string} - 'timeout' | 'network' | 'server' | 'unknown'
 */
function classifyError(error) {
  const message = error.message.toLowerCase();
  
  if (message.includes('timeout') || message.includes('aborted')) {
    return 'timeout';
  }
  if (message.includes('fetch') || message.includes('network') || message.includes('enotfound')) {
    return 'network';
  }
  if (message.includes('500') || message.includes('502') || message.includes('503')) {
    return 'server';
  }
  
  return 'unknown';
}

/**
 * 统一fetch包装器（带超时+重试+熔断器）
 * 
 * @param {string} url - 请求URL
 * @param {Object} options - fetch options
 * @param {Object} config - apiClient配置
 * @param {number} config.timeout - 超时时间（毫秒），默认25000
 * @param {number} config.maxRetries - 最大重试次数，默认2
 * @param {string} config.providerId - Provider标识（用于熔断器）
 * @param {boolean} config.skipCircuitBreaker - 是否跳过熔断器检查，默认false
 * @returns {Promise<Response>} - fetch Response对象
 */
async function apiRequest(url, options = {}, config = {}) {
  const timeout = config.timeout || DEFAULT_TIMEOUT_MS;
  const maxRetries = config.maxRetries !== undefined ? config.maxRetries : DEFAULT_MAX_RETRIES;
  const providerId = config.providerId || 'unknown';
  const skipCircuitBreaker = config.skipCircuitBreaker || false;
  
  // 🔥 检查熔断器
  if (!skipCircuitBreaker && isCircuitBreakerOpen(providerId)) {
    throw new Error(`[Circuit Breaker] ${providerId} 熔断器已打开，请求被拒绝`);
  }
  
  let retryCount = 0;
  
  while (retryCount <= maxRetries) {
    // 🔧 每次重试都创建新的AbortController和timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    // 🔧 将startTime移到try块外（避免ReferenceError）
    const startTime = Date.now();
    
    try {
      console.log(`🔄 [API Request] [尝试${retryCount + 1}/${maxRetries + 1}] ${providerId} → ${url.substring(0, 50)}...`);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      const duration = Date.now() - startTime;
      console.log(`✅ [API Request] ${providerId} 成功 (${duration}ms)`);
      
      // 记录成功
      recordSuccess(providerId);
      
      return response;
      
    } catch (fetchError) {
      const duration = Date.now() - startTime;
      const errorType = classifyError(fetchError);
      
      retryCount++;
      
      if (retryCount > maxRetries) {
        // 超过重试次数，记录失败并抛出错误
        console.error(`❌ [API Request] ${providerId} 失败（${maxRetries + 1}次尝试, ${duration}ms）: ${fetchError.message}`);
        recordFailure(providerId);
        throw new Error(`${providerId} API请求失败: ${fetchError.message} (类型: ${errorType})`);
      }
      
      // 指数退避后重试
      const backoffMs = DEFAULT_BACKOFF_BASE_MS * Math.pow(2, retryCount - 1);
      console.warn(`⚠️  [API Request] ${providerId} ${errorType}错误，${backoffMs}ms后重试...`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
      
    } finally {
      // 🔧 确保总是清理timeout（防止timer泄漏）
      clearTimeout(timeoutId);
    }
  }
}

/**
 * GET请求快捷方式
 */
async function get(url, headers = {}, config = {}) {
  return apiRequest(url, { method: 'GET', headers }, config);
}

/**
 * POST请求快捷方式
 */
async function post(url, body = {}, headers = {}, config = {}) {
  return apiRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  }, config);
}

/**
 * 获取熔断器状态（用于监控）
 */
function getCircuitBreakerStatus() {
  const status = {};
  for (const [providerId, breaker] of circuitBreakers.entries()) {
    status[providerId] = {
      isOpen: breaker.isOpen,
      consecutiveFailures: breaker.consecutiveFailures,
      openedAt: breaker.openedAt,
      resetIn: breaker.isOpen ? CIRCUIT_BREAKER_RESET_MS - (Date.now() - breaker.openedAt) : null
    };
  }
  return status;
}

module.exports = {
  apiRequest,
  get,
  post,
  getCircuitBreakerStatus,
  // 导出常量用于测试/配置
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_RETRIES,
  CIRCUIT_BREAKER_THRESHOLD
};
