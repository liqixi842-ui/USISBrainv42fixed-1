// v3-dev Express Routes
const express = require('express');
const router = express.Router();

// Import report routes
const reportRouter = require('./report');

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

// Mount report routes at /v3/report/*
router.use('/report', reportRouter);

console.log('✅ V5 router mounted: GET /v3/report/:symbol → v5 report builder');

module.exports = router;
