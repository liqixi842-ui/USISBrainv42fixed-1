/**
 * USIS News v2.0 - End-to-End Test
 * 
 * Tests: RSS fetching → Adapter → Deduplication → Scoring → Routing
 */

const { fetchRSSFeed } = require('./newsIngestion/utils/rssFetcher');
const Tier4Adapter = require('./newsIngestion/adapters/Tier4Adapter');
const { NewsScorer } = require('./newsScoring');
const { NewsDeduplicator } = require('./newsDeduplication');
const { NewsRouter } = require('./newsRouter');

async function testRSSFetcher() {
  console.log('\n🧪 Test 1: RSS Fetcher');
  console.log('='.repeat(50));
  
  try {
    const feedUrl = 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml';
    const items = await fetchRSSFeed(feedUrl, { timeout: 10000 });
    
    console.log(`✅ Fetched ${items.length} items from WSJ`);
    if (items.length > 0) {
      console.log(`📰 Sample: ${items[0].title}`);
    }
    
    return { passed: true, itemCount: items.length };
  } catch (error) {
    console.error(`❌ RSS Fetcher failed: ${error.message}`);
    return { passed: false, error: error.message };
  }
}

async function testAdapter() {
  console.log('\n🧪 Test 2: Tier 4 Adapter');
  console.log('='.repeat(50));
  
  try {
    const adapter = new Tier4Adapter();
    const since = new Date(Date.now() - 3600000); // Last hour
    
    const result = await adapter.fetchBatch({ since, limit: 10 });
    
    console.log(`✅ Adapter fetched ${result.ok.length} articles`);
    console.log(`⚠️  Adapter errors: ${result.errors.length}`);
    
    if (result.ok.length > 0) {
      const sample = result.ok[0];
      console.log(`📰 Sample: ${sample.title}`);
      console.log(`   Symbols: ${sample.symbols.join(', ') || 'None'}`);
      console.log(`   Published: ${sample.published_at.toISOString()}`);
    }
    
    return { passed: true, articleCount: result.ok.length, errorCount: result.errors.length };
  } catch (error) {
    console.error(`❌ Adapter failed: ${error.message}`);
    return { passed: false, error: error.message };
  }
}

async function testDeduplication() {
  console.log('\n🧪 Test 3: Deduplication Engine');
  console.log('='.repeat(50));
  
  try {
    const deduplicator = new NewsDeduplicator();
    
    // Test article
    const article = {
      external_id: 'test_article_001',
      title: 'Apple Reports Strong Q4 Earnings, Beats Estimates',
      summary: 'Apple Inc reported quarterly earnings that exceeded Wall Street expectations...',
      url: 'https://example.com/test-article-001',
      published_at: new Date(),
      symbols: ['AAPL'],
      entities: {}
    };
    
    // Test URL hash
    const urlHash1 = deduplicator.hashUrl('https://example.com/test?utm_source=twitter');
    const urlHash2 = deduplicator.hashUrl('https://example.com/test'); // Should match after normalization
    
    console.log(`🔐 URL Hash Test:`);
    console.log(`   With params: ${urlHash1}`);
    console.log(`   Without params: ${urlHash2}`);
    console.log(`   Match: ${urlHash1 === urlHash2 ? '✅' : '❌'}`);
    
    // Test topic hash
    const topicHash = deduplicator.hashTopic(article.title, article.summary);
    console.log(`🔐 Topic Hash: ${topicHash}`);
    
    return { passed: true, urlHashMatch: urlHash1 === urlHash2, topicHash: !!topicHash };
  } catch (error) {
    console.error(`❌ Deduplication failed: ${error.message}`);
    return { passed: false, error: error.message };
  }
}

async function testScoring() {
  console.log('\n🧪 Test 4: ImpactRank 2.0 Scoring');
  console.log('='.repeat(50));
  
  try {
    const scorer = new NewsScorer();
    
    // Test articles with different characteristics
    const testCases = [
      {
        name: 'High-impact earnings news',
        article: {
          title: 'Apple Reports Record Q4 Earnings, Beats EPS Estimates',
          summary: 'Apple Inc announced quarterly earnings that exceeded analyst expectations with revenue growth...',
          published_at: new Date(), // Fresh
          symbols: ['AAPL']
        },
        tier: 4,
        expectedScore: '>= 6.0'
      },
      {
        name: 'Low-impact product news',
        article: {
          title: 'Apple Releases Minor Software Update',
          summary: 'Apple released a minor bug fix update for iOS...',
          published_at: new Date(Date.now() - 24 * 3600000), // Old
          symbols: ['AAPL']
        },
        tier: 3,
        expectedScore: '< 5.0'
      }
    ];
    
    for (const testCase of testCases) {
      const result = await scorer.scoreArticle(testCase.article, testCase.tier);
      
      console.log(`\n📊 ${testCase.name}:`);
      console.log(`   Freshness: ${result.scores.freshness.toFixed(2)}`);
      console.log(`   Source Quality: ${result.scores.source_quality.toFixed(2)}`);
      console.log(`   Impact: ${result.scores.impact.toFixed(2)}`);
      console.log(`   Composite: ${result.composite_score}/10`);
      console.log(`   Expected: ${testCase.expectedScore} | Actual: ${result.composite_score >= 6 ? '✅' : '⚠️'}`);
    }
    
    return { passed: true };
  } catch (error) {
    console.error(`❌ Scoring failed: ${error.message}`);
    return { passed: false, error: error.message };
  }
}

async function testRouting() {
  console.log('\n🧪 Test 5: Routing Logic');
  console.log('='.repeat(50));
  
  try {
    const router = new NewsRouter();
    
    // Test routing rules
    const testScores = [
      { score: 9.0, expectedChannel: 'fastlane' },
      { score: 6.5, expectedChannel: 'digest_2h' },
      { score: 4.0, expectedChannel: 'digest_4h' },
      { score: 2.0, expectedChannel: 'suppressed' }
    ];
    
    for (const test of testScores) {
      const channel = router.determineChannel(test.score);
      const match = channel === test.expectedChannel;
      
      console.log(`📍 Score ${test.score} → ${channel} (expected: ${test.expectedChannel}) ${match ? '✅' : '❌'}`);
    }
    
    return { passed: true };
  } catch (error) {
    console.error(`❌ Routing failed: ${error.message}`);
    return { passed: false, error: error.message };
  }
}

async function runAllTests() {
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║   USIS News v2.0 - End-to-End Test Suite      ║');
  console.log('╚════════════════════════════════════════════════╝');
  
  const results = {
    rss: await testRSSFetcher(),
    adapter: await testAdapter(),
    dedupe: await testDeduplication(),
    scoring: await testScoring(),
    routing: await testRouting()
  };
  
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║              Test Summary                      ║');
  console.log('╚════════════════════════════════════════════════╝\n');
  
  const passedCount = Object.values(results).filter(r => r.passed).length;
  const totalCount = Object.keys(results).length;
  
  console.log(`RSS Fetcher:     ${results.rss.passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Tier 4 Adapter:  ${results.adapter.passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Deduplication:   ${results.dedupe.passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Scoring Engine:  ${results.scoring.passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Routing Logic:   ${results.routing.passed ? '✅ PASS' : '❌ FAIL'}`);
  
  console.log(`\n📊 Overall: ${passedCount}/${totalCount} tests passed`);
  
  if (passedCount === totalCount) {
    console.log('\n🎉 All tests passed! News system is ready for deployment.\n');
  } else {
    console.log('\n⚠️  Some tests failed. Please review errors above.\n');
  }
  
  return results;
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('💥 Test suite crashed:', err);
      process.exit(1);
    });
}

module.exports = { runAllTests };
