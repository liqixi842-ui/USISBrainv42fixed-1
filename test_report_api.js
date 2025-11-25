// Test the v3 report API endpoint directly
const express = require('express');
const app = express();

// Mount the v3 routes
const v3Routes = require('./v3_dev/routes/report');
app.use('/v3', v3Routes);

// Start test server on different port to avoid conflicts
const PORT = 3001;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Test server running on http://0.0.0.0:${PORT}`);
  console.log(`🧪 Test endpoint: http://0.0.0.0:${PORT}/v3/report/NVDA?format=json`);
  
  // Auto-shutdown after 3 minutes
  setTimeout(() => {
    console.log('⏰ Test server shutting down...');
    server.close();
    process.exit(0);
  }, 180000);
});

// Handle shutdown signals
process.on('SIGTERM', () => {
  console.log('📡 SIGTERM received, shutting down...');
  server.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📡 SIGINT received, shutting down...');
  server.close();
  process.exit(0);
});
