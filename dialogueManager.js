// ====== 对话状态管理器 v1.0 ======
// 功能：跟踪用户会话、股票代码、分析历史，实现上下文连续对话
// 目标：从"指令响应"升级为"智能对话伙伴"

/**
 * 对话状态管理类
 * 为每个用户维护独立的会话状态
 */
class DialogueState {
  constructor(userId) {
    this.userId = userId;
    this.currentStock = null;           // 当前讨论的股票
    this.analysisHistory = [];          // 分析历史（最多10条）
    this.userPreferences = {};          // 用户偏好设置
    this.conversationContext = {};      // 对话上下文
    this.lastInteraction = Date.now();  // 最后交互时间
    this.positionContext = null;        // 持仓信息（buyPrice, holdingIntent等）
  }

  /**
   * 更新对话上下文
   * @param {string} stock - 股票代码
   * @param {string} analysisType - 分析类型（intraday, news, technical, hold_recommendation等）
   * @param {Object} userData - 用户数据（包括持仓信息）
   */
  updateContext(stock, analysisType, userData = {}) {
    this.currentStock = stock;
    this.lastInteraction = Date.now();
    
    // 保存持仓信息（如果提供）
    if (userData.positionContext) {
      this.positionContext = {
        stock: stock,
        buyPrice: userData.positionContext.buyPrice,
        holdingIntent: userData.positionContext.holdingIntent,
        profitStatus: userData.positionContext.profitStatus,
        timestamp: Date.now()
      };
    }
    
    // 记录分析历史
    this.analysisHistory.push({
      timestamp: Date.now(),
      type: analysisType,
      stock: stock,
      userData: userData,
      hasPosition: !!userData.positionContext
    });
    
    // 保持最近10次分析记录
    if (this.analysisHistory.length > 10) {
      this.analysisHistory.shift();
    }
  }

  /**
   * 获取当前对话上下文
   * @returns {Object} 上下文信息
   */
  getContext() {
    const lastAnalysis = this.analysisHistory[this.analysisHistory.length - 1];
    
    return {
      currentStock: this.currentStock,
      lastAnalysis: lastAnalysis,
      positionContext: this.positionContext,
      preferences: this.userPreferences,
      historyCount: this.analysisHistory.length,
      lastInteractionAge: Date.now() - this.lastInteraction
    };
  }

  /**
   * 检测是否为连续对话（相同股票的补充分析）
   * @param {string} stock - 当前股票
   * @param {string} analysisType - 当前分析类型
   * @returns {boolean} 是否为连续对话
   */
  isContinuation(stock, analysisType) {
    // 如果超过5分钟没有交互，视为新对话
    const sessionTimeout = 5 * 60 * 1000; // 5分钟
    if (Date.now() - this.lastInteraction > sessionTimeout) {
      return false;
    }
    
    // 如果股票代码相同，且有分析历史，视为连续对话
    if (stock === this.currentStock && this.analysisHistory.length > 0) {
      return true;
    }
    
    return false;
  }

  /**
   * 检测是否为重复分析
   * @param {string} stock - 股票代码
   * @param {string} analysisType - 分析类型
   * @returns {boolean} 是否为重复分析
   */
  isDuplicateRequest(stock, analysisType) {
    if (this.analysisHistory.length === 0) return false;
    
    const lastAnalysis = this.analysisHistory[this.analysisHistory.length - 1];
    
    // 如果1分钟内对同一股票做了相同类型的分析，视为重复
    const duplicateTimeout = 60 * 1000; // 1分钟
    const timeSinceLastAnalysis = Date.now() - lastAnalysis.timestamp;
    
    return (
      lastAnalysis.stock === stock &&
      lastAnalysis.type === analysisType &&
      timeSinceLastAnalysis < duplicateTimeout
    );
  }

  /**
   * 获取持仓信息（如果存在且未过期）
   * @returns {Object|null} 持仓信息
   */
  getPositionContext() {
    if (!this.positionContext) return null;
    
    // 持仓信息5分钟有效期
    const positionTimeout = 5 * 60 * 1000;
    const age = Date.now() - this.positionContext.timestamp;
    
    if (age > positionTimeout) {
      this.positionContext = null;
      return null;
    }
    
    return this.positionContext;
  }

  /**
   * 设置用户偏好
   * @param {Object} preferences - 偏好设置
   */
  setPreferences(preferences) {
    this.userPreferences = {
      ...this.userPreferences,
      ...preferences,
      updatedAt: Date.now()
    };
  }

  /**
   * 获取用户偏好
   * @returns {Object} 用户偏好
   */
  getPreferences() {
    return this.userPreferences;
  }

  /**
   * 重置对话状态（新话题开始）
   */
  reset() {
    this.currentStock = null;
    this.conversationContext = {};
    this.positionContext = null;
    // 保留analysisHistory和userPreferences
  }
}

/**
 * 对话管理器（单例）
 * 管理所有用户的对话状态
 */
class DialogueManager {
  constructor() {
    this.userStates = new Map();  // userId -> DialogueState
    this.cleanupInterval = null;
    
    // 启动自动清理（每10分钟清理过期状态）
    this.startAutoCleanup();
  }

  /**
   * 获取或创建用户的对话状态
   * @param {string} userId - 用户ID
   * @returns {DialogueState} 对话状态
   */
  getOrCreateState(userId) {
    if (!this.userStates.has(userId)) {
      this.userStates.set(userId, new DialogueState(userId));
    }
    return this.userStates.get(userId);
  }

  /**
   * 更新用户对话上下文
   * @param {string} userId - 用户ID
   * @param {string} stock - 股票代码
   * @param {string} analysisType - 分析类型
   * @param {Object} userData - 用户数据
   */
  updateUserContext(userId, stock, analysisType, userData = {}) {
    const state = this.getOrCreateState(userId);
    state.updateContext(stock, analysisType, userData);
  }

  /**
   * 获取用户上下文
   * @param {string} userId - 用户ID
   * @returns {Object} 上下文信息
   */
  getUserContext(userId) {
    const state = this.getOrCreateState(userId);
    return state.getContext();
  }

  /**
   * 检测是否为连续对话
   * @param {string} userId - 用户ID
   * @param {string} stock - 股票代码
   * @param {string} analysisType - 分析类型
   * @returns {boolean} 是否为连续对话
   */
  isContinuousDialogue(userId, stock, analysisType) {
    const state = this.getOrCreateState(userId);
    return state.isContinuation(stock, analysisType);
  }

  /**
   * 检测是否为重复请求
   * @param {string} userId - 用户ID
   * @param {string} stock - 股票代码
   * @param {string} analysisType - 分析类型
   * @returns {boolean} 是否为重复请求
   */
  isDuplicateRequest(userId, stock, analysisType) {
    const state = this.getOrCreateState(userId);
    return state.isDuplicateRequest(stock, analysisType);
  }

  /**
   * 获取用户持仓信息
   * @param {string} userId - 用户ID
   * @returns {Object|null} 持仓信息
   */
  getUserPosition(userId) {
    const state = this.getOrCreateState(userId);
    return state.getPositionContext();
  }

  /**
   * 设置用户偏好
   * @param {string} userId - 用户ID
   * @param {Object} preferences - 偏好设置
   */
  setUserPreferences(userId, preferences) {
    const state = this.getOrCreateState(userId);
    state.setPreferences(preferences);
  }

  /**
   * 获取用户偏好
   * @param {string} userId - 用户ID
   * @returns {Object} 用户偏好
   */
  getUserPreferences(userId) {
    const state = this.getOrCreateState(userId);
    return state.getPreferences();
  }

  /**
   * 重置用户对话状态
   * @param {string} userId - 用户ID
   */
  resetUserState(userId) {
    const state = this.getOrCreateState(userId);
    state.reset();
  }

  /**
   * 启动自动清理（清理过期的用户状态）
   */
  startAutoCleanup() {
    // 每10分钟清理一次
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 10 * 60 * 1000);
  }

  /**
   * 清理过期的用户状态
   */
  cleanup() {
    const expirationTime = 30 * 60 * 1000; // 30分钟无交互视为过期
    const now = Date.now();
    
    for (const [userId, state] of this.userStates.entries()) {
      if (now - state.lastInteraction > expirationTime) {
        this.userStates.delete(userId);
        console.log(`🧹 [Dialogue Manager] 清理过期状态: ${userId}`);
      }
    }
  }

  /**
   * 停止自动清理
   */
  stopAutoCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计数据
   */
  getStats() {
    return {
      activeUsers: this.userStates.size,
      totalSessions: Array.from(this.userStates.values())
        .reduce((sum, state) => sum + state.analysisHistory.length, 0)
    };
  }
}

// 导出单例
const dialogueManager = new DialogueManager();

module.exports = {
  DialogueState,
  DialogueManager,
  dialogueManager
};
