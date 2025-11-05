const { parseUserIntent } = require('./semanticIntentAgent');
const { resolveSymbols } = require('./symbolResolver');
const { fetchMarketData, validateDataForAnalysis } = require('./dataBroker');
const { buildAnalysisPrompt } = require('./analysisPrompt');
const { validateResponse } = require('./complianceGuard');

async function testV31Pipeline() {
  console.log('🧪 Testing USIS Brain v3.1 Pipeline\n');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Test 1: Semantic Intent Understanding');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const testQuery = "Grifols今天表现如何？";
  console.log(`📝 Query: "${testQuery}"\n`);
  
  try {
    const semanticIntent = await parseUserIntent(testQuery, []);
    console.log('✅ Semantic Intent Parsed:');
    console.log(JSON.stringify(semanticIntent, null, 2));
    console.log();
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Test 2: Symbol Resolution');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const resolved = await resolveSymbols(semanticIntent);
    console.log('✅ Resolved Symbols:');
    console.log(JSON.stringify(resolved, null, 2));
    console.log();
    
    if (resolved.length > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Test 3: Data Broker');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const marketData = await fetchMarketData(resolved, ['quote']);
      console.log('✅ Market Data Fetched:');
      console.log(`   Symbols: ${Object.keys(marketData.quotes || {}).join(', ')}`);
      console.log(`   Data Quality: ${(marketData.metadata.dataQuality.overallScore * 100).toFixed(0)}%`);
      console.log(`   Summary Length: ${marketData.summary?.length || 0} chars`);
      console.log();
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Test 4: Data Validation');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const validation = validateDataForAnalysis(marketData);
      console.log(`✅ Validation Result: ${validation.valid ? 'VALID' : 'INVALID'}`);
      if (!validation.valid) {
        console.log(`   Reason: ${validation.reason}`);
      }
      console.log();
      
      if (validation.valid) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('Test 5: Anti-Hallucination Prompt');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        const prompt = buildAnalysisPrompt({
          marketData,
          intent: semanticIntent,
          userQuery: testQuery,
          mode: 'intraday',
          language: 'zh'
        });
        
        console.log('✅ Prompt Generated:');
        console.log(`   Length: ${prompt.length} chars`);
        console.log('   Preview:');
        console.log(prompt.substring(0, 500) + '...\n');
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('Test 6: Compliance Guard');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        const mockResponse = `Grifols (GRF.MC) 当前价格 €10.50，上涨 +2.3%。成交量较昨日增加15%，技术面呈现突破态势。`;
        const complianceCheck = validateResponse(mockResponse, marketData);
        
        console.log(`✅ Compliance Check:`);
        console.log(`   Valid: ${complianceCheck.valid}`);
        console.log(`   Confidence: ${(complianceCheck.confidence * 100).toFixed(0)}%`);
        if (complianceCheck.violations.length > 0) {
          console.log(`   Violations: ${complianceCheck.violations.length}`);
        }
      }
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ v3.1 Pipeline Test Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('\n❌ Test Failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testV31Pipeline().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
