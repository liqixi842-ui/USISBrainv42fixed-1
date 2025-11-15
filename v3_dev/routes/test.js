// v3-dev Test Route
// This is a sample route to verify v3-dev is working

const express = require('express');
const router = express.Router();

// GET /v3/report/test
router.get('/test', (req, res) => {
  res.json({
    status: 'ok',
    message: 'v3-dev is working',
    version: 'v3-dev',
    timestamp: new Date().toISOString(),
    environment: 'development',
    note: 'This is isolated from v2-stable'
  });
});

module.exports = router;
