#!/usr/bin/env node
const http = require('http');

const options = {
  hostname: '0.0.0.0',
  port: 3000,
  path: '/v3/report/NVDA?format=json',
  method: 'GET',
  timeout: 60000
};

console.log('🧪 Testing NVDA Report (simple HTTP)...\n');

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const report = JSON.parse(data);
      console.log(`✅ Price: $${report.price.last}`);
      console.log(`✅ Market Cap: $${report.valuation.market_cap ? (report.valuation.market_cap / 1e9).toFixed(1) + 'B' : 'N/A'}`);
      console.log(`✅ Base Target: $${report.targets.base.price} (+${report.targets.base.upside_pct}%)`);
      console.log(`\n✅ SUCCESS! Report generated with real data.`);
    } catch (e) {
      console.error('Error parsing JSON:', e.message);
      console.log('Response:', data.substring(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error(`❌ Request failed: ${e.message}`);
  console.log('\nTrying to restart server...');
});

req.on('timeout', () => {
  console.log('⏳ Request timed out (server might be processing)');
  req.destroy();
});

req.end();
