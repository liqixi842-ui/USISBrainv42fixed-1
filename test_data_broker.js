#!/usr/bin/env node
/**
 * Test dataBroker quote retrieval for NVDA
 */

const dataBroker = require('./dataBroker');

async function testDataBroker() {
  console.log('🧪 Testing Data Broker for NVDA...\n');
  
  try {
    const marketData = await dataBroker.fetchMarketData(['NVDA'], ['quote']);
    
    if (marketData.quotes && marketData.quotes.NVDA) {
      const quote = marketData.quotes.NVDA;
      
      console.log('✅ Quote Retrieved:\n');
      console.log(JSON.stringify(quote, null, 2));
      console.log('\n─── Field Mapping ───');
      console.log(`currentPrice:    ${quote.currentPrice}`);
      console.log(`change:          ${quote.change}`);
      console.log(`changePercent:   ${quote.changePercent}`);
      console.log(`high:            ${quote.high}`);
      console.log(`low:             ${quote.low}`);
      console.log(`open:            ${quote.open}`);
      console.log(`previousClose:   ${quote.previousClose}`);
      console.log(`source:          ${quote.source}`);
    } else {
      console.log('❌ No quote data for NVDA');
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

testDataBroker();
