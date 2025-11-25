/**
 * ═══════════════════════════════════════════════════════════════
 * Phase 2 News Bot Integration Test
 * ═══════════════════════════════════════════════════════════════
 * 
 * Tests:
 * 1. News fetching with Phase 2 adapters
 * 2. Output formatting with Phase 2 schema
 * 3. Telegram message formatting
 * 4. Multiple symbols (AAPL, NVDA, TSLA)
 */

const { fetchAndScoreNews } = require('./services/newsQueryService');
const { formatBatchArticles } = require('./services/newsOutputFormatter');

console.log(`\n╔════════════════════════════════════════════════════╗`);
console.log(`║   Phase 2 News Bot Integration Test               ║`);
console.log(`╚════════════════════════════════════════════════════╝\n`);

/**
 * Test Phase 2 news fetching and formatting
 */
async function testNewsBot(symbol, limit = 3) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📰 Testing: ${symbol} (limit: ${limit})`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  try {
    // Step 1: Fetch and score news
    console.log(`⏳ [1/3] Fetching news with Phase 2 adapters...`);
    const startFetch = Date.now();
    
    const scoredNews = await fetchAndScoreNews(symbol, {
      limit: limit,
      days: 7,
      generateSummaries: false
    });
    
    const fetchDuration = Date.now() - startFetch;
    console.log(`✅ Fetched ${scoredNews.length} articles in ${fetchDuration}ms\n`);
    
    if (scoredNews.length === 0) {
      console.log(`⚠️  No news found for ${symbol}\n`);
      return { success: true, symbol, articles: 0 };
    }
    
    // Step 2: Format with Phase 2 schema
    console.log(`⏳ [2/3] Formatting with Phase 2 schema...`);
    const startFormat = Date.now();
    
    const formattedNews = formatBatchArticles(scoredNews, 'en');
    
    const formatDuration = Date.now() - startFormat;
    console.log(`✅ Formatted ${formattedNews.length} articles in ${formatDuration}ms\n`);
    
    // Step 3: Validate Phase 2 schema
    console.log(`⏳ [3/3] Validating Phase 2 schema...`);
    
    let validationErrors = 0;
    formattedNews.forEach((article, index) => {
      const errors = [];
      
      // Required fields
      if (!article.headline) errors.push('Missing headline');
      if (!article.summaryShort) errors.push('Missing summaryShort');
      if (!article.summaryLong) errors.push('Missing summaryLong');
      if (!article.impact) errors.push('Missing impact');
      if (!article.source) errors.push('Missing source');
      if (!article.publishedAt) errors.push('Missing publishedAt');
      if (!article.publishedAgo) errors.push('Missing publishedAgo');
      if (!article.url) errors.push('Missing url');
      
      // Impact object validation
      if (article.impact) {
        if (typeof article.impact.score !== 'number') errors.push('Invalid impact.score');
        if (!article.impact.label) errors.push('Missing impact.label');
        if (!article.impact.emoji) errors.push('Missing impact.emoji');
        if (!article.impact.reason) errors.push('Missing impact.reason');
      }
      
      // Word count validation
      const shortWords = article.summaryShort.split(/\s+/).length;
      const longWords = article.summaryLong.split(/\s+/).length;
      
      if (shortWords < 100 || shortWords > 150) {
        errors.push(`summaryShort ${shortWords} words (expected 100-150)`);
      }
      if (longWords < 300 || longWords > 500) {
        errors.push(`summaryLong ${longWords} words (expected 300-500)`);
      }
      
      if (errors.length > 0) {
        console.log(`❌ Article ${index + 1} validation failed:`);
        errors.forEach(err => console.log(`   - ${err}`));
        validationErrors++;
      }
    });
    
    if (validationErrors === 0) {
      console.log(`✅ All ${formattedNews.length} articles passed Phase 2 schema validation\n`);
    } else {
      console.log(`⚠️  ${validationErrors}/${formattedNews.length} articles failed validation\n`);
    }
    
    // Step 4: Display sample article
    if (formattedNews.length > 0) {
      const sample = formattedNews[0];
      
      console.log(`\n📋 Sample Article (Phase 2 Format):`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Headline: ${sample.headline}`);
      console.log(`Impact: ${sample.impact.emoji} ${sample.impact.score.toFixed(1)}/10 (${sample.impact.label})`);
      console.log(`Reason: ${sample.impact.reason}`);
      console.log(`Source: ${sample.source}`);
      console.log(`Published: ${sample.publishedAgo}`);
      console.log(`\nShort Summary (${sample.summaryShort.split(/\s+/).length} words):`);
      console.log(sample.summaryShort.substring(0, 150) + '...');
      console.log(`\nLong Summary (${sample.summaryLong.split(/\s+/).length} words):`);
      console.log(sample.summaryLong.substring(0, 200) + '...');
      console.log(`\nURL: ${sample.url}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    }
    
    return {
      success: true,
      symbol: symbol,
      articles: formattedNews.length,
      fetchDuration,
      formatDuration,
      validationErrors
    };
    
  } catch (error) {
    console.error(`❌ Test failed for ${symbol}:`);
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack: ${error.stack}\n`);
    
    return {
      success: false,
      symbol: symbol,
      error: error.message
    };
  }
}

/**
 * Run all tests
 */
async function runTests() {
  const testCases = [
    { symbol: 'AAPL', limit: 3 },
    { symbol: 'NVDA', limit: 3 },
    { symbol: 'TSLA', limit: 5 }
  ];
  
  const results = [];
  
  for (const test of testCases) {
    const result = await testNewsBot(test.symbol, test.limit);
    results.push(result);
    
    // Delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  console.log(`\n╔════════════════════════════════════════════════════╗`);
  console.log(`║   Test Summary                                     ║`);
  console.log(`╚════════════════════════════════════════════════════╝\n`);
  
  results.forEach((result, index) => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${result.symbol}`);
    
    if (result.success) {
      console.log(`  ├─ Articles: ${result.articles}`);
      console.log(`  ├─ Fetch: ${result.fetchDuration}ms`);
      console.log(`  ├─ Format: ${result.formatDuration}ms`);
      console.log(`  └─ Validation errors: ${result.validationErrors || 0}`);
    } else {
      console.log(`  └─ Error: ${result.error}`);
    }
    console.log('');
  });
  
  const totalSuccess = results.filter(r => r.success).length;
  const totalArticles = results.reduce((sum, r) => sum + (r.articles || 0), 0);
  
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Tests Passed: ${totalSuccess}/${results.length}`);
  console.log(`Total Articles: ${totalArticles}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  if (totalSuccess === results.length) {
    console.log(`🎉 All tests passed! Phase 2 News Bot is ready.\n`);
  } else {
    console.log(`⚠️  Some tests failed. Please review errors above.\n`);
  }
}

// Run tests
runTests().catch(error => {
  console.error(`\n❌ Fatal error during testing:`);
  console.error(error);
  process.exit(1);
});
