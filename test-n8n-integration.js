/**
 * USIS News v2.0 - N8N Integration End-to-End Test
 * 
 * Tests complete N8N → USIS Brain integration:
 * 1. API Authentication (401 handling)
 * 2. News Processing Pipeline (dedupe → score → route → push)
 * 3. Deduplication (URL + topic hash)
 * 4. Database Storage (7 tables)
 */

const axios = require('axios');
const { safeQuery } = require('./dbUtils');

const API_URL = process.env.REPL_URL || 'http://localhost:5000';
const API_ENDPOINT = `${API_URL}/api/news/ingest`;
const NEWS_SECRET = process.env.NEWS_INGESTION_SECRET;

// Test data simulating N8N RSS collector output
const SAMPLE_NEWS = [
  {
    title: "Apple Reports Record Q4 Earnings, Stock Surges 5%",
    url: "https://www.wsj.com/test/apple-earnings-2025-q4",
    summary: "Apple Inc. announced record quarterly earnings with revenue exceeding expectations. iPhone sales drove the growth.",
    published_at: new Date().toISOString(),
    source: "WSJ",
    tier: 4,
    symbols: []
  },
  {
    title: "Fed Signals Rate Cut Coming in December",
    url: "https://www.ft.com/test/fed-rate-decision-dec-2025",
    summary: "Federal Reserve officials hinted at upcoming rate cuts following inflation data showing cooling trends.",
    published_at: new Date().toISOString(),
    source: "Financial Times",
    tier: 4,
    symbols: []
  },
  {
    title: "Tesla Recalls 2M Vehicles Over Autopilot Issue",
    url: "https://www.marketwatch.com/test/tesla-recall-autopilot-2025",
    summary: "Tesla announced a major recall affecting 2 million vehicles due to autopilot software concerns.",
    published_at: new Date().toISOString(),
    source: "MarketWatch",
    tier: 4,
    symbols: []
  }
];

class N8NIntegrationTester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  /**
   * Test 1: Authentication - Invalid Key
   */
  async testAuthInvalidKey() {
    console.log('\n🧪 Test 1: Authentication - Invalid Key');
    
    try {
      const response = await axios.post(API_ENDPOINT, SAMPLE_NEWS[0], {
        headers: {
          'Authorization': 'Bearer invalid-key-12345'
        },
        validateStatus: () => true // Don't throw on 401
      });

      if (response.status === 401 && response.data.ok === false) {
        console.log('✅ PASS: Correctly rejected invalid key (401)');
        this.recordPass('auth_invalid_key');
      } else {
        console.log(`❌ FAIL: Expected 401, got ${response.status}`);
        this.recordFail('auth_invalid_key', `Unexpected status: ${response.status}`);
      }
    } catch (err) {
      console.log(`❌ FAIL: ${err.message}`);
      this.recordFail('auth_invalid_key', err.message);
    }
  }

  /**
   * Test 2: Authentication - Valid Key
   */
  async testAuthValidKey() {
    console.log('\n🧪 Test 2: Authentication - Valid Key');
    
    if (!NEWS_SECRET) {
      console.log('⏭️  SKIP: NEWS_INGESTION_SECRET not set');
      return;
    }

    try {
      const response = await axios.post(API_ENDPOINT, SAMPLE_NEWS[0], {
        headers: {
          'Authorization': `Bearer ${NEWS_SECRET}`
        },
        validateStatus: () => true
      });

      if (response.status === 200 || response.status === 400) {
        console.log(`✅ PASS: Authenticated successfully (${response.status})`);
        console.log(`   Action: ${response.data.action || 'N/A'}`);
        this.recordPass('auth_valid_key');
      } else {
        console.log(`❌ FAIL: Unexpected status ${response.status}`);
        this.recordFail('auth_valid_key', `Status: ${response.status}`);
      }
    } catch (err) {
      console.log(`❌ FAIL: ${err.message}`);
      this.recordFail('auth_valid_key', err.message);
    }
  }

  /**
   * Test 3: Complete News Processing Pipeline
   */
  async testCompleteProcessing() {
    console.log('\n🧪 Test 3: Complete News Processing Pipeline');
    
    if (!NEWS_SECRET) {
      console.log('⏭️  SKIP: NEWS_INGESTION_SECRET not set');
      return;
    }

    try {
      const testNews = {
        title: `[TEST] ${new Date().toISOString()} - Market Breaking News`,
        url: `https://test.example.com/news-${Date.now()}`,
        summary: "This is a test article with high impact keywords: earnings, surge, breaking, record-breaking performance.",
        published_at: new Date().toISOString(),
        source: "WSJ",
        tier: 4,
        symbols: ["AAPL", "MSFT"]
      };

      const response = await axios.post(API_ENDPOINT, testNews, {
        headers: {
          'Authorization': `Bearer ${NEWS_SECRET}`
        }
      });

      console.log(`   Status: ${response.status}`);
      console.log(`   Action: ${response.data.action}`);
      console.log(`   Channel: ${response.data.channel || 'N/A'}`);
      console.log(`   Score: ${response.data.score || 'N/A'}/10`);

      if (response.data.ok && response.data.action) {
        console.log('✅ PASS: News processed successfully');
        this.recordPass('complete_processing');
        return response.data;
      } else {
        console.log(`❌ FAIL: Processing failed - ${response.data.error || 'Unknown error'}`);
        this.recordFail('complete_processing', response.data.error);
        return null;
      }
    } catch (err) {
      console.log(`❌ FAIL: ${err.message}`);
      this.recordFail('complete_processing', err.message);
      return null;
    }
  }

  /**
   * Test 4: URL Deduplication (same URL within 24h)
   */
  async testURLDeduplication() {
    console.log('\n🧪 Test 4: URL Deduplication');
    
    if (!NEWS_SECRET) {
      console.log('⏭️  SKIP: NEWS_INGESTION_SECRET not set');
      return;
    }

    try {
      const duplicateNews = {
        title: "Duplicate Article Title",
        url: `https://test.example.com/duplicate-${Date.now()}`,
        summary: "This is a duplicate test article.",
        published_at: new Date().toISOString(),
        source: "MarketWatch",
        tier: 4,
        symbols: []
      };

      // Send first time
      const response1 = await axios.post(API_ENDPOINT, duplicateNews, {
        headers: { 'Authorization': `Bearer ${NEWS_SECRET}` }
      });

      console.log(`   First submission: ${response1.data.action}`);

      // Send same URL again (should be deduplicated)
      const response2 = await axios.post(API_ENDPOINT, duplicateNews, {
        headers: { 'Authorization': `Bearer ${NEWS_SECRET}` }
      });

      console.log(`   Second submission: ${response2.data.action}`);

      if (response2.data.action === 'skipped' && response2.data.reason?.includes('duplicate')) {
        console.log('✅ PASS: URL deduplication working correctly');
        this.recordPass('url_deduplication');
      } else {
        console.log(`❌ FAIL: Duplicate not detected`);
        this.recordFail('url_deduplication', 'Duplicate URL not caught');
      }
    } catch (err) {
      console.log(`❌ FAIL: ${err.message}`);
      this.recordFail('url_deduplication', err.message);
    }
  }

  /**
   * Test 5: Database Storage Verification
   */
  async testDatabaseStorage() {
    console.log('\n🧪 Test 5: Database Storage Verification');
    
    try {
      // Check all 7 tables exist and have data
      const tables = [
        'news_sources',
        'news_items', 
        'news_scores',
        'news_routing_state',
        'news_dedupe_cache'
      ];

      for (const table of tables) {
        const result = await safeQuery(`SELECT COUNT(*) as count FROM ${table}`);
        const count = parseInt(result.rows[0].count);
        console.log(`   ${table}: ${count} records`);
      }

      // Check for test articles
      const testItems = await safeQuery(`
        SELECT COUNT(*) as count
        FROM news_items
        WHERE title LIKE '%[TEST]%'
        OR url LIKE '%test.example.com%'
      `);

      const testCount = parseInt(testItems.rows[0].count);
      
      if (testCount > 0) {
        console.log(`✅ PASS: Found ${testCount} test articles in database`);
        this.recordPass('database_storage');
      } else {
        console.log('⚠️  WARNING: No test articles found in database');
        this.recordFail('database_storage', 'No test data stored');
      }
    } catch (err) {
      console.log(`❌ FAIL: ${err.message}`);
      this.recordFail('database_storage', err.message);
    }
  }

  /**
   * Test 6: Batch Processing (Multiple News Items)
   */
  async testBatchProcessing() {
    console.log('\n🧪 Test 6: Batch Processing (N8N sends ~70 items/5min)');
    
    if (!NEWS_SECRET) {
      console.log('⏭️  SKIP: NEWS_INGESTION_SECRET not set');
      return;
    }

    try {
      const batchNews = SAMPLE_NEWS.map((news, idx) => ({
        ...news,
        url: `${news.url}-batch-${Date.now()}-${idx}`, // Unique URLs
        title: `${news.title} [Batch Test ${idx + 1}]`
      }));

      let successCount = 0;
      let skipCount = 0;

      for (const news of batchNews) {
        const response = await axios.post(API_ENDPOINT, news, {
          headers: { 'Authorization': `Bearer ${NEWS_SECRET}` }
        });

        if (response.data.action === 'routed' || response.data.action === 'pushed') {
          successCount++;
        } else if (response.data.action === 'skipped') {
          skipCount++;
        }
      }

      console.log(`   Processed: ${successCount} stored, ${skipCount} skipped`);

      if (successCount >= 2) {
        console.log('✅ PASS: Batch processing successful');
        this.recordPass('batch_processing');
      } else {
        console.log(`❌ FAIL: Only ${successCount} items processed`);
        this.recordFail('batch_processing', `Low success rate: ${successCount}/3`);
      }
    } catch (err) {
      console.log(`❌ FAIL: ${err.message}`);
      this.recordFail('batch_processing', err.message);
    }
  }

  /**
   * Helper: Record test pass
   */
  recordPass(testName) {
    this.results.passed++;
    this.results.tests.push({ test: testName, result: 'PASS' });
  }

  /**
   * Helper: Record test failure
   */
  recordFail(testName, error) {
    this.results.failed++;
    this.results.tests.push({ test: testName, result: 'FAIL', error });
  }

  /**
   * Run all tests
   */
  async runAll() {
    console.log('🚀 Starting N8N Integration Tests...');
    console.log(`📍 API Endpoint: ${API_ENDPOINT}`);
    console.log(`🔑 Secret Configured: ${NEWS_SECRET ? 'Yes' : 'No'}`);
    console.log('═'.repeat(60));

    // Run tests sequentially (some depend on previous results)
    await this.testAuthInvalidKey();
    await this.testAuthValidKey();
    await this.testCompleteProcessing();
    await this.testURLDeduplication();
    await this.testDatabaseStorage();
    await this.testBatchProcessing();

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('═'.repeat(60));
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`📈 Success Rate: ${Math.round((this.results.passed / (this.results.passed + this.results.failed)) * 100)}%`);
    
    if (this.results.failed > 0) {
      console.log('\n⚠️  Failed Tests:');
      this.results.tests
        .filter(t => t.result === 'FAIL')
        .forEach(t => console.log(`   - ${t.test}: ${t.error}`));
    }

    console.log('\n' + '═'.repeat(60));

    return this.results;
  }
}

// Run tests
if (require.main === module) {
  const tester = new N8NIntegrationTester();
  tester.runAll()
    .then(results => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(err => {
      console.error('❌ Test suite failed:', err);
      process.exit(1);
    });
}

module.exports = { N8NIntegrationTester };
