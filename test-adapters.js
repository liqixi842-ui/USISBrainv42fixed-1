/**
 * Quick test for Provider Adapters
 */

const finnhubAdapter = require('./services/newsProviders/finnhubAdapter');
const alphaAdapter = require('./services/newsProviders/alphaAdapter');

console.log('═══════════════════════════════════════════════════════');
console.log('Testing Provider Adapters');
console.log('═══════════════════════════════════════════════════════\n');

// Test 1: Finnhub Adapter
console.log('Test 1: Finnhub Adapter');
console.log('─────────────────────────────────────────────────────\n');

const finnhubArticle = {
  headline: 'NVIDIA Announces New AI Chip',
  datetime: 1706140800, // Unix timestamp (seconds)
  source: 'Reuters',
  url: 'https://reuters.com/nvda-chip',
  summary: 'NVIDIA unveiled its latest GPU architecture designed for AI workloads.',
  related: 'NVDA'
};

try {
  const normalized = finnhubAdapter.mapArticle(finnhubArticle, 'NVDA');
  console.log('✅ Finnhub normalization successful');
  console.log('  ├─ ID:', normalized.id);
  console.log('  ├─ Symbol:', normalized.symbol);
  console.log('  ├─ Headline:', normalized.headline);
  console.log('  ├─ Source:', normalized.source);
  console.log('  ├─ Published:', normalized.publishedAt);
  console.log('  ├─ Provider:', normalized.provider);
  console.log('  ├─ Language:', normalized.language);
  console.log('  └─ RawSummary:', normalized.rawSummary?.substring(0, 50) + '...');
  
  const isValid = finnhubAdapter.validateNormalized(normalized);
  console.log(`\n  Validation: ${isValid ? '✅ PASS' : '❌ FAIL'}\n`);
} catch (error) {
  console.error('❌ Test failed:', error.message);
}

// Test 2: Alpha Vantage Adapter
console.log('\nTest 2: Alpha Vantage Adapter');
console.log('─────────────────────────────────────────────────────\n');

const alphaArticle = {
  title: 'Tesla Reports Record Deliveries',
  time_published: '20240125T153000', // YYYYMMDDTHHMMSS format
  summary: 'Tesla announced record vehicle deliveries for Q4 2024, surpassing analyst expectations.',
  url: 'https://example.com/tsla-deliveries',
  source: 'Bloomberg',
  ticker_sentiment: [
    { ticker: 'TSLA', relevance_score: '0.9' },
    { ticker: 'RIVN', relevance_score: '0.3' }
  ]
};

try {
  const normalized = alphaAdapter.mapArticle(alphaArticle, 'TSLA');
  console.log('✅ Alpha Vantage normalization successful');
  console.log('  ├─ ID:', normalized.id);
  console.log('  ├─ Symbol:', normalized.symbol);
  console.log('  ├─ Headline:', normalized.headline);
  console.log('  ├─ Source:', normalized.source);
  console.log('  ├─ Published:', normalized.publishedAt);
  console.log('  ├─ Provider:', normalized.provider);
  console.log('  ├─ Language:', normalized.language);
  console.log('  └─ RawSummary:', normalized.rawSummary?.substring(0, 50) + '...');
  
  const isValid = alphaAdapter.validateNormalized(normalized);
  console.log(`\n  Validation: ${isValid ? '✅ PASS' : '❌ FAIL'}\n`);
} catch (error) {
  console.error('❌ Test failed:', error.message);
}

// Test 3: Batch Processing
console.log('\nTest 3: Batch Processing');
console.log('─────────────────────────────────────────────────────\n');

const finnhubBatch = [
  { headline: 'Apple Earnings Beat', datetime: 1706140800, source: 'WSJ', url: 'http://a.com' },
  { headline: 'Invalid', datetime: null }, // Missing datetime - should be skipped
  { headline: 'Google AI Update', datetime: 1706227200, source: 'TechCrunch', url: 'http://b.com' }
];

try {
  const normalizedBatch = finnhubAdapter.mapArticles(finnhubBatch, 'AAPL');
  console.log(`✅ Batch processing: ${normalizedBatch.length}/${finnhubBatch.length} articles normalized`);
  normalizedBatch.forEach((article, i) => {
    console.log(`  ${i + 1}. ${article.headline} (${article.source})`);
  });
} catch (error) {
  console.error('❌ Test failed:', error.message);
}

console.log('\n═══════════════════════════════════════════════════════');
console.log('All Tests Complete');
console.log('═══════════════════════════════════════════════════════');
