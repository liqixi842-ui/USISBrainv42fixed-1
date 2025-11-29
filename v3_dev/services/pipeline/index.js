/**
 * ═══════════════════════════════════════════════════════════════
 * PIPELINE MODULE EXPORTS
 * ═══════════════════════════════════════════════════════════════
 * 
 * Central export for all pipeline components
 */

const pipelineOrchestrator = require('./pipelineOrchestrator');
const dataFetcher = require('./dataFetcher');
const dataValidator = require('./dataValidator');
const chartDataCollector = require('./chartDataCollector');
const chartEngine = require('./chartEngine');
const languageNormalizer = require('./languageNormalizer');
const qaChecker = require('./qaChecker');
const llmPromptTemplate = require('./llmPromptTemplate');
const healthMonitor = require('./healthMonitor');

module.exports = {
  execute: (symbol, options) => pipelineOrchestrator.execute(symbol, options),
  
  orchestrator: pipelineOrchestrator,
  fetcher: dataFetcher,
  validator: dataValidator,
  chartCollector: chartDataCollector,
  chartEngine: chartEngine,
  normalizer: languageNormalizer,
  qa: qaChecker,
  promptTemplate: llmPromptTemplate,
  health: healthMonitor,

  async generateReport(symbol, options = {}) {
    const result = await pipelineOrchestrator.execute(symbol, options);
    healthMonitor.recordRun(result);
    return result;
  },

  async checkHealth() {
    return await healthMonitor.checkAPIs();
  },

  getStatus() {
    return healthMonitor.getStatus();
  },

  getDailyReport() {
    return healthMonitor.generateDailyReport();
  }
};
