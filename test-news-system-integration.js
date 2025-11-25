/**
 * ═══════════════════════════════════════════════════════════════
 * USIS Brain v7.1 - News System Integration Test
 * ═══════════════════════════════════════════════════════════════
 * 
 * Tests:
 * 1. Provider cascade (Finnhub → Alpha Vantage)
 * 2. ImpactRank 2.0 scoring
 * 3. Auto-summarization (long + short)
 * 4. Multi-language translation (EN/CN/ES)
 * 5. Batch processing
 * 6. Deduplication
 * 7. newsRouter integration
 * 8. End-to-end /news command flow
 */

const { fetchAndScoreNews, generateSummaries, batchGenerateSummaries } = require('./services/newsQueryService');
const { processNewsArticle, processBatchNewsArticles, getRouterStats } = require('./services/newsRouter');
const { translateNewsSummary, getCacheStats, clearCache } = require('./utils/newsTranslationService');

// Import internal functions (not exported, use alternatives)
// scoreNewsArticle - use via newsRouter.scoreArticle
// deduplicateNews - use via newsRouter.deduplicateArticles

/**
 * Test 1: Basic News Fetching with Provider Cascade
 */
async function testProviderCascade() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║   Test 1: Provider Cascade                         ║');
  console.log('╚════════════════════════════════════════════════════╝\n');
  
  try {
    const articles = await fetchAndScoreNews('AAPL', {
      days: 3,
      maxArticles: 5,
      generateSummaries: false
    });
    
    console.log(`✅ Fetched ${articles.length} articles for AAPL`);
    console.log(`   └─ Top Articles:`);
    
    articles.slice(0, 3).forEach((article, i) => {
      console.log(`      ${i + 1}. ${(article.headline || article.title || '').substring(0, 60)}...`);
      console.log(`         Score: ${article.composite_score || article.impact_score || 0}/10 (${article.impact_level || 'N/A'})`);
    });
    
    return { success: true, count: articles.length };
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test 2: ImpactRank 2.0 Scoring (via newsRouter)
 */
async function testScoring() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║   Test 2: ImpactRank 2.0 Scoring                   ║');
  console.log('╚════════════════════════════════════════════════════╝\n');
  
  const testArticle = {
    headline: 'NVIDIA Announces New AI Chip with 50% Performance Boost',
    summary: 'NVIDIA Corporation unveiled its next-generation AI accelerator, promising significant performance improvements for machine learning workloads.',
    source: 'Reuters',
    datetime: Date.now() / 1000,
    url: 'https://example.com/nvidia-news'
  };
  
  try {
    const { scoreArticle } = require('./services/newsRouter');
    const scoreResult = await scoreArticle(testArticle, 'NVDA');
    
    console.log(`✅ Scoring complete`);
    console.log(`   ├─ Composite Score: ${scoreResult.composite_score}/10`);
    console.log(`   ├─ Impact Level: ${scoreResult.impact_level}`);
    console.log(`   └─ Breakdown: ${scoreResult.breakdown}`);
    
    return { success: true, score: scoreResult.composite_score };
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test 3: Auto-Summarization (Long + Short)
 */
async function testSummarization() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║   Test 3: Auto-Summarization                       ║');
  console.log('╚════════════════════════════════════════════════════╝\n');
  
  const testArticle = {
    headline: 'Apple Reports Record Q4 Earnings, Stock Rises 5%',
    summary: 'Apple Inc. reported quarterly revenue of $89.5 billion, beating analyst expectations. iPhone sales remained strong in international markets, while services revenue grew 16% year-over-year. The company also announced a $10 billion share buyback program.',
    source: 'Bloomberg',
    datetime: Date.now() / 1000,
    url: 'https://example.com/apple-earnings'
  };
  
  try {
    const { summarizeArticle } = require('./services/newsRouter');
    const summaries = await summarizeArticle(testArticle, 'en');
    
    console.log(`✅ Summaries generated`);
    console.log(`   ├─ Long Summary: ${summaries.word_count.long} words`);
    console.log(`   │  "${(summaries.long_summary || '').substring(0, 100)}..."`);
    console.log(`   ├─ Short Summary: ${summaries.word_count.short} words`);
    console.log(`   │  "${(summaries.short_summary || '').substring(0, 80)}..."`);
    console.log(`   ├─ Key Metrics: ${(summaries.key_metrics || []).join(', ')}`);
    console.log(`   ├─ Market Impact: ${summaries.market_impact || 'N/A'}`);
    console.log(`   └─ Model: ${summaries.model_used || 'N/A'}`);
    
    return { success: true, summaries };
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test 4: Multi-Language Translation
 */
async function testTranslation() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║   Test 4: Multi-Language Translation               ║');
  console.log('╚════════════════════════════════════════════════════╝\n');
  
  const testSummary = 'Tesla stock surges 8% after Q3 delivery numbers exceed expectations, with 435,000 vehicles delivered globally.';
  
  try {
    // Clear cache before test
    clearCache();
    
    const translations = await translateNewsSummary(testSummary);
    
    console.log(`✅ Translations complete`);
    console.log(`   ├─ English: "${translations.en.substring(0, 60)}..."`);
    console.log(`   ├─ Chinese: "${translations.cn.substring(0, 60)}..."`);
    console.log(`   └─ Spanish: "${translations.es.substring(0, 60)}..."`);
    
    // Test cache
    const cacheStats = getCacheStats();
    console.log(`\n   💾 Cache: ${cacheStats.size}/${cacheStats.maxSize} entries`);
    
    return { success: true, translations };
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test 5: Batch Processing
 */
async function testBatchProcessing() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║   Test 5: Batch Processing                         ║');
  console.log('╚════════════════════════════════════════════════════╝\n');
  
  const testArticles = [
    {
      headline: 'Microsoft Announces Azure AI Expansion',
      summary: 'Microsoft expands Azure AI services with new enterprise features.',
      source: 'TechCrunch',
      datetime: Date.now() / 1000,
      url: 'https://example.com/msft-1'
    },
    {
      headline: 'Google Unveils New Gemini Model',
      summary: 'Google releases Gemini 2.5, claiming state-of-the-art performance.',
      source: 'The Verge',
      datetime: Date.now() / 1000,
      url: 'https://example.com/goog-1'
    },
    {
      headline: 'Amazon Web Services Revenue Grows 20%',
      summary: 'AWS reports strong growth in cloud computing segment.',
      source: 'CNBC',
      datetime: Date.now() / 1000,
      url: 'https://example.com/amzn-1'
    }
  ];
  
  try {
    const processed = await processBatchNewsArticles(testArticles, {
      symbol: 'MSFT',
      generateSummary: false,
      translate: false,
      deduplicate: true
    });
    
    console.log(`✅ Batch processing complete`);
    console.log(`   ├─ Processed: ${processed.length} articles`);
    console.log(`   └─ Results:`);
    
    processed.forEach((article, i) => {
      console.log(`      ${i + 1}. ${article.headline.substring(0, 50)}...`);
      console.log(`         Score: ${article.composite_score || 'N/A'}/10`);
    });
    
    return { success: true, count: processed.length };
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test 6: Deduplication
 */
async function testDeduplication() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║   Test 6: Deduplication                            ║');
  console.log('╚════════════════════════════════════════════════════╝\n');
  
  const testArticles = [
    {
      headline: 'Tesla Delivers Record Number of Vehicles',
      summary: 'Tesla delivered 435,000 vehicles in Q3.',
      source: 'Reuters',
      datetime: Date.now() / 1000,
      url: 'https://example.com/tesla-1'
    },
    {
      headline: 'Tesla Q3 Deliveries Exceed Expectations',
      summary: 'Tesla delivered 435,000 vehicles globally.',
      source: 'Bloomberg',
      datetime: Date.now() / 1000,
      url: 'https://example.com/tesla-2'
    },
    {
      headline: 'NVIDIA Stock Jumps on AI Demand',
      summary: 'NVIDIA shares rise 7% on strong AI chip demand.',
      source: 'CNBC',
      datetime: Date.now() / 1000,
      url: 'https://example.com/nvda-1'
    }
  ];
  
  try {
    const { deduplicateArticles } = require('./services/newsRouter');
    const beforeCount = testArticles.length;
    const deduplicated = deduplicateArticles(testArticles);
    const afterCount = deduplicated.length;
    const removedCount = beforeCount - afterCount;
    
    console.log(`✅ Deduplication complete`);
    console.log(`   ├─ Before: ${beforeCount} articles`);
    console.log(`   ├─ After: ${afterCount} articles`);
    console.log(`   └─ Removed: ${removedCount} duplicate(s)`);
    
    return { success: true, removed: removedCount };
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test 7: newsRouter Integration
 */
async function testNewsRouter() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║   Test 7: newsRouter Integration                   ║');
  console.log('╚════════════════════════════════════════════════════╝\n');
  
  const testArticle = {
    headline: 'AMD Launches New Ryzen Processor Line',
    summary: 'AMD announces Ryzen 9000 series with improved performance and efficiency.',
    source: 'AnandTech',
    datetime: Date.now() / 1000,
    url: 'https://example.com/amd-1'
  };
  
  try {
    const result = await processNewsArticle(testArticle, {
      symbol: 'AMD',
      generateSummary: false, // Skip AI summary for speed
      translate: false
    });
    
    console.log(`✅ newsRouter processing complete`);
    console.log(`   ├─ Success: ${result.success}`);
    console.log(`   ├─ Score: ${result.article.composite_score}/10`);
    console.log(`   └─ Duration: ${result.processing_time_ms}ms`);
    
    // Get router stats
    const stats = getRouterStats();
    console.log(`\n   📊 Router Stats:`);
    console.log(`      ├─ Version: ${stats.router_version}`);
    console.log(`      └─ Translation Cache: ${stats.translation_cache.size} entries`);
    
    return { success: true };
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test 8: End-to-End /news Command Flow
 */
async function testEndToEnd() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║   Test 8: End-to-End /news NVDA 5                  ║');
  console.log('╚════════════════════════════════════════════════════╝\n');
  
  try {
    const articles = await fetchAndScoreNews('NVDA', {
      days: 7,
      maxArticles: 5,
      generateSummaries: false, // Skip for speed
      language: 'en'
    });
    
    console.log(`✅ End-to-end test complete`);
    console.log(`   ├─ Symbol: NVDA`);
    console.log(`   ├─ Articles: ${articles.length}`);
    console.log(`   └─ Top Articles:`);
    
    articles.slice(0, 3).forEach((article, i) => {
      console.log(`\n      ${i + 1}. ${article.headline || article.title}`);
      console.log(`         ├─ Score: ${article.composite_score || article.impact_score}/10 (${article.impact_level || 'N/A'})`);
      console.log(`         ├─ Source: ${article.source || 'N/A'}`);
      console.log(`         └─ Time: ${new Date(article.datetime * 1000).toISOString()}`);
    });
    
    return { success: true, articles };
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║   USIS Brain v7.1 - News System Integration Test  ║');
  console.log('║   Phase 1: Complete System Validation             ║');
  console.log('╚════════════════════════════════════════════════════╝');
  
  const startTime = Date.now();
  const results = [];
  
  // Run all tests sequentially
  results.push({ name: 'Provider Cascade', result: await testProviderCascade() });
  results.push({ name: 'ImpactRank 2.0', result: await testScoring() });
  results.push({ name: 'Summarization', result: await testSummarization() });
  results.push({ name: 'Translation', result: await testTranslation() });
  results.push({ name: 'Batch Processing', result: await testBatchProcessing() });
  results.push({ name: 'Deduplication', result: await testDeduplication() });
  results.push({ name: 'newsRouter', result: await testNewsRouter() });
  results.push({ name: 'End-to-End', result: await testEndToEnd() });
  
  const totalDuration = Date.now() - startTime;
  
  // Summary
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║   Test Summary                                     ║');
  console.log('╚════════════════════════════════════════════════════╝\n');
  
  const passed = results.filter(r => r.result.success).length;
  const failed = results.filter(r => !r.result.success).length;
  
  results.forEach(({ name, result }) => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${name}`);
    if (!result.success && result.error) {
      console.log(`       Error: ${result.error}`);
    }
  });
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Total: ${results.length} tests`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Duration: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  if (failed === 0) {
    console.log('🎉 All tests passed! News system is ready for production.\n');
  } else {
    console.log('⚠️  Some tests failed. Please review errors above.\n');
  }
}

// Run if executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = {
  runAllTests,
  testProviderCascade,
  testScoring,
  testSummarization,
  testTranslation,
  testBatchProcessing,
  testDeduplication,
  testNewsRouter,
  testEndToEnd
};
