/**
 * 测试 ImpactRank 2.0 评分算法
 * 生成1-10分不同档位的新闻样本，测试评分合理性
 */

const fetch = require('node-fetch');

const API_URL = 'http://localhost:5000/api/news/ingest';
const SECRET = process.env.NEWS_INGESTION_SECRET;

// 不同评分档位的新闻样本
const samples = [
  {
    target: '1-2分',
    title: 'Local Coffee Shop Opens New Branch',
    summary: 'A new coffee shop opened in the neighborhood offering regular coffee and pastries.',
    source: 'Local Blog',
    tier: 1,
    symbols: []
  },
  {
    target: '2-3分',
    title: 'Company XYZ Releases Quarterly Newsletter',
    summary: 'XYZ Corporation published their routine quarterly newsletter with standard updates.',
    source: 'Company Website',
    tier: 2,
    symbols: ['XYZ']
  },
  {
    target: '3-4分',
    title: 'Tech Company Updates Privacy Policy',
    summary: 'ABC Tech announced minor updates to their privacy policy, effective next month.',
    source: 'TechCrunch',
    tier: 3,
    symbols: ['ABC']
  },
  {
    target: '4-5分',
    title: 'Apple Plans to Expand Retail Stores in Asia',
    summary: 'Apple announced plans to open several new retail locations across Asia in the coming year.',
    source: 'Reuters',
    tier: 3,
    symbols: ['AAPL']
  },
  {
    target: '5-6分',
    title: 'Microsoft Reports Strong Cloud Revenue Growth',
    summary: 'Microsoft reported impressive Azure cloud revenue growth of 28% year-over-year in latest earnings.',
    source: 'Bloomberg',
    tier: 4,
    symbols: ['MSFT']
  },
  {
    target: '6-7分',
    title: 'NVIDIA Announces Next-Gen AI Chip Release',
    summary: 'NVIDIA unveiled its next-generation AI chip with 2x performance improvements, targeting data center market.',
    source: 'WSJ',
    tier: 4,
    symbols: ['NVDA']
  },
  {
    target: '7-8分',
    title: '🔥 BREAKING: Fed Signals Rate Cut in September',
    summary: 'Federal Reserve Chair Powell indicated strong possibility of interest rate cuts starting September, sending markets higher.',
    source: 'WSJ',
    tier: 4,
    symbols: ['SPY', 'QQQ']
  },
  {
    target: '8-9分',
    title: '🚨 Tesla Stock Surges 15% on Breakthrough Battery News',
    summary: 'Tesla announced revolutionary solid-state battery technology with 500-mile range, causing massive stock surge in after-hours trading.',
    source: 'WSJ',
    tier: 4,
    symbols: ['TSLA']
  },
  {
    target: '9-10分',
    title: '⚡ URGENT: Emergency Fed Meeting Called, Markets Halt Trading',
    summary: 'BREAKING: Federal Reserve announces emergency meeting following major banking crisis. Trading halted on NYSE and NASDAQ. Unprecedented market action as authorities respond to systemic risk.',
    source: 'WSJ',
    tier: 5,
    symbols: ['SPY', 'QQQ', 'DIA']
  },
  {
    target: '9-10分 (极端)',
    title: '💥 ALERT: Major Tech CEOs Resign Simultaneously, Markets in Chaos',
    summary: 'BREAKING NEWS: CEOs of Apple, Microsoft, Google announce sudden resignations within hours. Stock futures plunge, emergency trading suspensions activated. Unprecedented corporate crisis unfolds.',
    source: 'WSJ',
    tier: 5,
    symbols: ['AAPL', 'MSFT', 'GOOGL']
  }
];

async function testSample(sample, index) {
  const payload = {
    title: sample.title,
    url: `https://test-score.example.com/article-${index}-${Date.now()}`,
    summary: sample.summary,
    published_at: new Date().toISOString(),
    source: sample.source,
    tier: sample.tier,
    symbols: sample.symbols
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SECRET}`
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    return {
      target: sample.target,
      title: sample.title.substring(0, 60) + (sample.title.length > 60 ? '...' : ''),
      score: result.score || 0,
      channel: result.channel || 'unknown',
      action: result.action || 'unknown'
    };
  } catch (error) {
    return {
      target: sample.target,
      title: sample.title.substring(0, 60),
      error: error.message
    };
  }
}

async function runTests() {
  console.log('🧪 ImpactRank 2.0 评分算法测试\n');
  console.log('=' .repeat(100));
  console.log(`${'目标档位'.padEnd(12)} | ${'实际得分'.padEnd(10)} | ${'路由渠道'.padEnd(15)} | ${'标题预览'.padEnd(50)}`);
  console.log('=' .repeat(100));

  const results = [];
  
  for (let i = 0; i < samples.length; i++) {
    const result = await testSample(samples[i], i);
    results.push(result);
    
    if (result.error) {
      console.log(`${result.target.padEnd(12)} | ${'ERROR'.padEnd(10)} | ${'-'.padEnd(15)} | ${result.title}`);
    } else {
      const scoreStr = result.score.toFixed(1);
      console.log(`${result.target.padEnd(12)} | ${scoreStr.padEnd(10)} | ${result.channel.padEnd(15)} | ${result.title}`);
    }
    
    // 避免太快，给服务器一点时间
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('=' .repeat(100));
  console.log('\n📊 评分分布统计：');
  
  const scoreRanges = {
    '1-2分': results.filter(r => r.score >= 1 && r.score < 3).length,
    '3-4分': results.filter(r => r.score >= 3 && r.score < 5).length,
    '5-6分': results.filter(r => r.score >= 5 && r.score < 7).length,
    '7-8分': results.filter(r => r.score >= 7 && r.score < 9).length,
    '9-10分': results.filter(r => r.score >= 9).length
  };

  for (const [range, count] of Object.entries(scoreRanges)) {
    console.log(`  ${range}: ${count} 条新闻`);
  }

  console.log('\n📍 路由统计：');
  const channels = {
    'fastlane': results.filter(r => r.channel === 'fastlane').length,
    'digest_2h': results.filter(r => r.channel === 'digest_2h').length,
    'digest_4h': results.filter(r => r.channel === 'digest_4h').length,
    'suppressed': results.filter(r => r.channel === 'suppressed').length
  };

  for (const [channel, count] of Object.entries(channels)) {
    console.log(`  ${channel}: ${count} 条新闻`);
  }

  console.log('\n💡 路由规则：');
  console.log('  ≥ 7.0 分 → fastlane (立即推送)');
  console.log('  5.0-6.9 分 → digest_2h (2小时摘要)');
  console.log('  3.0-4.9 分 → digest_4h (4小时摘要)');
  console.log('  < 3.0 分 → suppressed (抑制)');
}

if (!SECRET) {
  console.error('❌ 缺少 NEWS_INGESTION_SECRET 环境变量');
  process.exit(1);
}

runTests().catch(console.error);
