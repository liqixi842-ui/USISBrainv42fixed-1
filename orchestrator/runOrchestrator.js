/**
 * USIS Brain v1.1 - Core Orchestrator Module
 * 
 * Extracted from index.js /brain/orchestrate endpoint to enable direct function calls
 * and eliminate HTTP self-call in Telegram Bot.
 * 
 * @module runOrchestrator
 * @version 1.1.0
 * @date 2025-11-10
 */

const { Memory } = require('../index.js'); // Assuming these will be exported

/**
 * Custom error class for orchestrator-specific errors
 */
class OrchestratorError extends Error {
  constructor(message, code = 'ORCHESTRATOR_ERROR', httpStatus = 500) {
    super(message);
    this.name = 'OrchestratorError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.safeMessage = message; // User-facing message
  }
}

/**
 * Main orchestrator function - analyzes user input and returns comprehensive market analysis
 * 
 * @param {Object} params - Orchestrator parameters
 * @param {string} params.reqId - Unique request ID for tracking
 * @param {string} params.text - User input text
 * @param {string} params.chatType - Chat type: 'private' | 'group'
 * @param {string} params.userId - User identifier
 * @param {string} [params.mode] - Analysis mode: 'premarket' | 'intraday' | 'postmarket' | 'diagnose' | 'news'
 * @param {string[]} [params.symbols] - Stock symbols (if provided)
 * @param {string} [params.lang='zh'] - Language preference
 * @param {string} [params.budget='low'] - Budget control: 'low' | 'medium' | 'high' | 'unlimited'
 * @param {Array} [params.userHistory] - User conversation history
 * @param {number} [params.timeoutMs] - Optional timeout in milliseconds
 * @param {Object} [params.requestTrackerCtx] - Request tracking context for stage updates
 * @param {Object} [params.injectedServices] - Injected service dependencies (for testing)
 * 
 * @returns {Promise<Object>} Analysis result with final_text, symbols, actions, etc.
 * @throws {OrchestratorError} On recoverable errors
 * @throws {Error} On unrecoverable system errors
 */
async function runOrchestrator(params) {
  const startTime = Date.now();
  
  // Extract parameters with defaults
  const {
    reqId,
    text = "default",
    chatType = "private",
    userId = "system",
    mode = null,
    symbols: providedSymbols = [],
    lang = "zh",
    budget = "low",
    userHistory: inputUserHistory = null,
    timeoutMs,
    requestTrackerCtx,
    injectedServices = {}
  } = params;
  
  // Validate required parameters
  if (!reqId) {
    throw new OrchestratorError('Missing required parameter: reqId', 'MISSING_REQID', 400);
  }
  
  // Update request tracker stage if provided
  const updateStage = (stage) => {
    if (requestTrackerCtx && requestTrackerCtx.updateStage) {
      requestTrackerCtx.updateStage(stage);
    }
  };
  
  try {
    updateStage('parsing');
    
    console.log(`\n🧠 [${reqId}] runOrchestrator 启动:`);
    console.log(`   文本: "${text}"`);
    console.log(`   场景: ${chatType}`);
    console.log(`   模式: ${mode || '自动检测'}`);
    console.log(`   预算: ${budget || '未指定（使用默认）'}`);
    
    // TODO: Migrate core orchestrator logic here (1100+ lines)
    // This is a placeholder implementation
    
    // For now, return a minimal response
    return {
      status: "ok",
      ok: true,
      final_analysis: "🚧 runOrchestrator 模块正在开发中...",
      final_text: "🚧 runOrchestrator 模块正在开发中...",
      needs_heatmap: false,
      actions: [],
      intent: { mode: mode || 'auto', lang, confidence: 1.0 },
      scene: { name: 'Development', depth: 'simple', targetLength: 50 },
      symbols: providedSymbols,
      market_data: null,
      ai_results: null,
      synthesis: { success: true, synthesized: false },
      low_confidence: false,
      chat_type: chatType,
      user_id: userId,
      response_time_ms: Date.now() - startTime,
      debug: { note: 'runOrchestrator placeholder - migration in progress' }
    };
    
  } catch (error) {
    console.error(`❌ [${reqId}] runOrchestrator error:`, error.message);
    
    // Rethrow OrchestratorErrors as-is
    if (error instanceof OrchestratorError) {
      throw error;
    }
    
    // Wrap other errors
    throw new OrchestratorError(
      error.message || 'Unknown orchestrator error',
      'ORCHESTRATOR_INTERNAL_ERROR',
      500
    );
  }
}

module.exports = {
  runOrchestrator,
  OrchestratorError
};
