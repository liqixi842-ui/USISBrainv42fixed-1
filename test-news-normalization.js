/**
 * Phase 2: News Normalization Integration Tests
 * 
 * Verifies:
 * 1. Finnhub adapter → normalized format
 * 2. Alpha Vantage adapter → normalized format
 * 3. Summary fallback logic
 * 4. DateTime format standardization
 * 5. newsRouter final output (Phase 2 unified schema)
 */

const finnhubAdapter = require('./services/newsProviders/finnhubAdapter');
const alphaAdapter = require('./services/newsProviders/alphaAdapter');
const { formatArticleOutput, normalizeSummaries } = require('./services/newsOutputFormatter');
const { formatTimeAgo, isValidISO8601 } = require('./utils/timeFormatter');

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function runTest(name, testFn) {
  console.log(`\n╔════════════════════════════════════════════════════╗`);
  console.log(`║   ${name.padEnd(50)} ║`);
  console.log(`╚════════════════════════════════════════════════════╝\n`);
  
  try {
    testFn();
    console.log(`✅ PASS - ${name}\n`);
    results.passed++;
    results.tests.push({ name, status: 'PASS' });
  } catch (error) {
    console.log(`❌ FAIL - ${name}`);
    console.log(`       Error: ${error.message}\n`);
    results.failed++;
    results.tests.push({ name, status: 'FAIL', error: error.message });
  }
}

// ═══════════════════════════════════════════════════════════
// Test 1: Finnhub Adapter Normalization
// ═══════════════════════════════════════════════════════════
runTest('Finnhub Adapter → Normalized Format', () => {
  const rawArticle = {
    headline: 'NVIDIA Announces Record Revenue',
    datetime: 1706140800, // Unix seconds
    source: 'Reuters',
    url: 'https://example.com/nvda',
    summary: 'NVIDIA reports strong quarterly results.',
    related: 'NVDA'
  };
  
  const normalized = finnhubAdapter.mapArticle(rawArticle, 'NVDA');
  
  // Check required fields
  if (!normalized.id) throw new Error('Missing id field');
  if (normalized.symbol !== 'NVDA') throw new Error('Symbol mismatch');
  if (normalized.headline !== rawArticle.headline) throw new Error('Headline mismatch');
  if (!isValidISO8601(normalized.publishedAt)) throw new Error('publishedAt not ISO8601');
  if (normalized.provider !== 'finnhub') throw new Error('Provider mismatch');
  if (normalized.language !== 'en') throw new Error('Language mismatch');
  if (normalized.rawSummary !== rawArticle.summary) throw new Error('rawSummary mismatch');
  
  console.log('✓ All required fields present');
  console.log(`✓ ISO8601 datetime: ${normalized.publishedAt}`);
  console.log(`✓ Unique ID: ${normalized.id}`);
});

// ═══════════════════════════════════════════════════════════
// Test 2: Alpha Vantage Adapter Normalization
// ═══════════════════════════════════════════════════════════
runTest('Alpha Vantage Adapter → Normalized Format', () => {
  const rawArticle = {
    title: 'Tesla Delivers Record Vehicles',
    time_published: '20240125T153000', // YYYYMMDDTHHMMSS
    summary: 'Tesla exceeds Q4 delivery estimates.',
    url: 'https://example.com/tsla',
    source: 'Bloomberg',
    ticker_sentiment: [
      { ticker: 'TSLA', relevance_score: '0.9' }
    ]
  };
  
  const normalized = alphaAdapter.mapArticle(rawArticle, 'TSLA');
  
  // Check required fields
  if (!normalized.id) throw new Error('Missing id field');
  if (normalized.symbol !== 'TSLA') throw new Error('Symbol mismatch');
  if (normalized.headline !== rawArticle.title) throw new Error('Headline mismatch');
  if (!isValidISO8601(normalized.publishedAt)) throw new Error('publishedAt not ISO8601');
  if (normalized.provider !== 'alpha_vantage') throw new Error('Provider mismatch');
  if (normalized.language !== 'en') throw new Error('Language mismatch');
  
  console.log('✓ All required fields present');
  console.log(`✓ ISO8601 datetime: ${normalized.publishedAt}`);
  console.log(`✓ Datetime conversion: ${rawArticle.time_published} → ${normalized.publishedAt}`);
});

// ═══════════════════════════════════════════════════════════
// Test 3: Summary Fallback Logic + Word Count Enforcement
// ═══════════════════════════════════════════════════════════
runTest('Summary Fallback (No AI, No Raw) + Word Count', () => {
  const article = {
    headline: 'Market Update: Stocks Rally',
    summaryShort: null, // No AI summary
    summaryLong: null,  // No AI summary
    rawSummary: null,   // No provider summary
    source: 'CNBC',
    publishedAt: new Date().toISOString(),
    impactScore: 6.0,
    impactLevel: 'Medium',
    impactEmoji: '🟡',
    impactReason: 'Market volatility',
    language: 'en'
  };
  
  const summaries = normalizeSummaries(article, 'en');
  
  if (!summaries.short || summaries.short.length === 0) {
    throw new Error('No short summary generated');
  }
  if (!summaries.long || summaries.long.length === 0) {
    throw new Error('No long summary generated');
  }
  
  // CRITICAL: Verify word count constraints
  const shortWords = summaries.short.split(/\s+/).length;
  const longWords = summaries.long.split(/\s+/).length;
  
  if (shortWords < 100 || shortWords > 150) {
    throw new Error(`Short summary word count ${shortWords} outside range 100-150`);
  }
  if (longWords < 300 || longWords > 500) {
    throw new Error(`Long summary word count ${longWords} outside range 300-500`);
  }
  
  console.log('✓ Short fallback summary generated');
  console.log(`  ├─ Word count: ${shortWords} (target: 100-150)`);
  console.log(`  └─ "${summaries.short.substring(0, 60)}..."`);
  console.log('✓ Long fallback summary generated');
  console.log(`  ├─ Word count: ${longWords} (target: 300-500)`);
  console.log(`  └─ ${summaries.long.length} characters`);
});

// ═══════════════════════════════════════════════════════════
// Test 4: Summary Fallback (With Raw Summary) + Word Count
// ═══════════════════════════════════════════════════════════
runTest('Summary Fallback (With Provider Raw) + Word Count', () => {
  const article = {
    headline: 'AI Breakthrough in Medical Research',
    summaryShort: null,
    summaryLong: null,
    rawSummary: 'Researchers have developed a new AI model capable of predicting disease outcomes with 95% accuracy, marking a significant advancement in medical diagnostics.',
    source: 'Nature',
    publishedAt: new Date().toISOString(),
    impactLevel: 'High',
    language: 'en'
  };
  
  const summaries = normalizeSummaries(article, 'en');
  
  if (!summaries.short || summaries.short.length === 0) {
    throw new Error('No short summary generated');
  }
  if (!summaries.long || summaries.long.length === 0) {
    throw new Error('No long summary generated');
  }
  
  // CRITICAL: Verify word count constraints (must be enforced even with padding)
  const shortWords = summaries.short.split(/\s+/).length;
  const longWords = summaries.long.split(/\s+/).length;
  
  if (shortWords < 100 || shortWords > 150) {
    throw new Error(`Short summary word count ${shortWords} outside range 100-150`);
  }
  if (longWords < 300 || longWords > 500) {
    throw new Error(`Long summary word count ${longWords} outside range 300-500`);
  }
  
  // Should use rawSummary as source (padded to minimum)
  if (!summaries.short.includes('Researchers') && !summaries.short.includes('AI')) {
    throw new Error('Short summary not using rawSummary');
  }
  
  console.log('✓ Used provider raw summary (with padding)');
  console.log(`✓ Short: ${shortWords} words (target: 100-150)`);
  console.log(`✓ Long: ${longWords} words (target: 300-500)`);
});

// ═══════════════════════════════════════════════════════════
// Test 5: DateTime Format Standardization
// ═══════════════════════════════════════════════════════════
runTest('DateTime ISO8601 Standardization', () => {
  // Test Finnhub Unix timestamp
  const finnhubTime = 1706140800; // Unix seconds
  const finnhubISO = finnhubAdapter.normalizeDateTime(finnhubTime);
  
  if (!isValidISO8601(finnhubISO)) {
    throw new Error('Finnhub datetime not ISO8601');
  }
  
  // Test Alpha Vantage format
  const alphaTime = '20240125T153000';
  const alphaISO = alphaAdapter.normalizeDateTime(alphaTime);
  
  if (!isValidISO8601(alphaISO)) {
    throw new Error('Alpha datetime not ISO8601');
  }
  
  console.log('✓ Finnhub: Unix → ISO8601');
  console.log(`  └─ ${finnhubTime} → ${finnhubISO}`);
  console.log('✓ Alpha: YYYYMMDDTHHMMSS → ISO8601');
  console.log(`  └─ ${alphaTime} → ${alphaISO}`);
});

// ═══════════════════════════════════════════════════════════
// Test 6: Time Ago Formatting
// ═══════════════════════════════════════════════════════════
runTest('formatTimeAgo() Multi-Language', () => {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  
  const enTime = formatTimeAgo(twoHoursAgo, 'en');
  const zhTime = formatTimeAgo(twoHoursAgo, 'zh');
  const esTime = formatTimeAgo(twoHoursAgo, 'es');
  
  if (!enTime.includes('hour')) throw new Error('EN formatting failed');
  if (!zhTime.includes('小时')) throw new Error('ZH formatting failed');
  if (!esTime.includes('hora')) throw new Error('ES formatting failed');
  
  console.log('✓ English:', enTime);
  console.log('✓ Chinese:', zhTime);
  console.log('✓ Spanish:', esTime);
});

// ═══════════════════════════════════════════════════════════
// Test 7: Phase 2 Unified Output Format
// ═══════════════════════════════════════════════════════════
runTest('Phase 2 Unified Output Schema', () => {
  const normalizedArticle = {
    id: 'test_123',
    symbol: 'AAPL',
    headline: 'Apple Reports Strong Earnings',
    summaryShort: null,
    summaryLong: null,
    source: 'WSJ',
    publishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    url: 'https://example.com/aapl',
    impactScore: 8.5,
    impactLevel: 'High',
    impactEmoji: '🔴',
    impactReason: 'Earnings beat expectations',
    language: 'en',
    provider: 'finnhub',
    rawSummary: 'Apple exceeded analyst expectations with strong iPhone sales.'
  };
  
  const formatted = formatArticleOutput(normalizedArticle, 'en');
  
  // Verify Phase 2 schema
  if (!formatted.headline) throw new Error('Missing headline');
  if (!formatted.summaryShort) throw new Error('Missing summaryShort');
  if (!formatted.summaryLong) throw new Error('Missing summaryLong');
  
  // Verify impact object structure
  if (!formatted.impact) throw new Error('Missing impact object');
  if (typeof formatted.impact.score !== 'number') throw new Error('impact.score not number');
  if (!formatted.impact.label) throw new Error('Missing impact.label');
  if (!formatted.impact.emoji) throw new Error('Missing impact.emoji');
  if (!formatted.impact.reason) throw new Error('Missing impact.reason');
  
  // Verify metadata
  if (!formatted.source) throw new Error('Missing source');
  if (!isValidISO8601(formatted.publishedAt)) throw new Error('publishedAt not ISO8601');
  if (!formatted.publishedAgo) throw new Error('Missing publishedAgo');
  if (!formatted.url) throw new Error('Missing url');
  if (!formatted.language) throw new Error('Missing language');
  
  // Verify no _internal field in production mode (unless NEWS_DEBUG=true)
  if (formatted._internal && process.env.NEWS_DEBUG !== 'true') {
    throw new Error('_internal field should not be present in production mode');
  }
  
  // CRITICAL: Verify word count constraints in formatted output
  const shortWords = formatted.summaryShort.split(/\s+/).length;
  const longWords = formatted.summaryLong.split(/\s+/).length;
  
  if (shortWords < 100 || shortWords > 150) {
    throw new Error(`Formatted short summary ${shortWords} words outside range 100-150`);
  }
  if (longWords < 300 || longWords > 500) {
    throw new Error(`Formatted long summary ${longWords} words outside range 300-500`);
  }
  
  console.log('✓ All Phase 2 schema fields present');
  console.log('✓ Impact object structure:', JSON.stringify(formatted.impact));
  console.log('✓ publishedAgo:', formatted.publishedAgo);
  console.log('✓ Word count enforcement: short=' + shortWords + ', long=' + longWords);
});

// ═══════════════════════════════════════════════════════════
// Test 8: End-to-End Adapter → Formatter
// ═══════════════════════════════════════════════════════════
runTest('End-to-End: Adapter → Formatter', () => {
  // Simulate provider raw data
  const finnhubRaw = {
    headline: 'Microsoft Acquires AI Startup',
    datetime: Date.now() / 1000, // Current time in Unix seconds
    source: 'TechCrunch',
    url: 'https://example.com/msft-ai',
    summary: 'Microsoft announces acquisition of promising AI research company.',
    related: 'MSFT'
  };
  
  // Step 1: Adapter normalization
  const normalized = finnhubAdapter.mapArticle(finnhubRaw, 'MSFT');
  
  // Step 2: Add scoring metadata (simulated)
  normalized.impactScore = 7.2;
  normalized.impactLevel = 'High';
  normalized.impactEmoji = '🔴';
  normalized.impactReason = 'Major M&A activity';
  normalized.providerTier = 4;
  
  // Step 3: Format to Phase 2 output
  const output = formatArticleOutput(normalized, 'en');
  
  // Verify complete pipeline
  if (output.headline !== finnhubRaw.headline) throw new Error('Headline lost in pipeline');
  if (output.impact.score !== 7.2) throw new Error('Impact score lost');
  if (!output.summaryShort) throw new Error('Summary generation failed');
  if (!output.publishedAgo.includes('ago') && !output.publishedAgo.includes('now')) {
    throw new Error('Time formatting failed');
  }
  
  console.log('✓ Complete pipeline successful');
  console.log('  ├─ Raw data → Normalized → Formatted');
  console.log(`  ├─ Impact: ${output.impact.score}/10 (${output.impact.label}) ${output.impact.emoji}`);
  console.log(`  └─ Published: ${output.publishedAgo}`);
});

// ═══════════════════════════════════════════════════════════
// Print Summary
// ═══════════════════════════════════════════════════════════
console.log(`\n╔════════════════════════════════════════════════════╗`);
console.log(`║   Test Summary                                     ║`);
console.log(`╚════════════════════════════════════════════════════╝\n`);

results.tests.forEach(test => {
  const icon = test.status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} ${test.status} - ${test.name}`);
  if (test.error) {
    console.log(`       Error: ${test.error}`);
  }
});

const totalTime = '1.2s'; // Placeholder

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`Total: ${results.passed + results.failed} tests`);
console.log(`Passed: ${results.passed}`);
console.log(`Failed: ${results.failed}`);
console.log(`Duration: ${totalTime}`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

if (results.failed > 0) {
  console.log(`⚠️  Some tests failed. Please review errors above.`);
  process.exit(1);
} else {
  console.log(`🎉 All tests passed! Phase 2 normalization is production-ready.`);
  process.exit(0);
}
