// v3-dev Express Routes
const express = require('express');
const router = express.Router();

// Import report routes
const reportRouter = require('./report');

// Import pipeline modules
const pipeline = require('../services/pipeline');

// Test route
router.get('/test', (req, res) => {
  res.json({
    status: 'ok',
    message: 'v3-dev routes are working',
    version: 'v3-dev',
    timestamp: new Date().toISOString(),
    environment: 'development',
    note: 'This is isolated from v2-stable'
  });
});

// Health check for v3-dev
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: 'v3-dev',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Pipeline health check endpoint (Step 10)
router.get('/health/pipeline', async (req, res) => {
  try {
    const apiStatus = await pipeline.checkHealth();
    const pipelineStatus = pipeline.getStatus();
    
    res.json({
      status: 'ok',
      pipeline: pipelineStatus,
      api_health: apiStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Pipeline daily report endpoint
router.get('/health/pipeline/report', (req, res) => {
  const report = pipeline.getDailyReport();
  res.type('text/plain').send(report);
});

// Pipeline direct execution endpoint (returns structured JSON)
router.get('/pipeline/:symbol', async (req, res) => {
  const { symbol } = req.params;
  
  console.log(`\n📊 [Pipeline] Direct execution for ${symbol}`);
  
  try {
    const result = await pipeline.generateReport(symbol);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      ticker: symbol,
      status: 'error',
      errors: [error.message],
      timestamp: new Date().toISOString()
    });
  }
});

// Mount report routes at /v3/report/*
router.use('/report', reportRouter);

console.log('✅ V5 router mounted: GET /v3/report/:symbol → v5 report builder');

module.exports = router;
