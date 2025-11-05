#!/usr/bin/env node

const https = require('https');

const PROD_URL = 'https://node-js-liqixi842.replit.app/brain/orchestrate';

const CANARY_TESTS = [
  {
    id: 1,
    name: '全球解析：台积电和TSMC ADR价差',
    payload: {
      text: '台积电和TSMC ADR价差怎么理解？给简要建议',
      user_id: 'canary_test_1',
      chat_type: 'private'
    },
    expect: 'parse返回TW:2330与US:TSM；advice有风险点'
  },
  {
    id: 2,
    name: '两小时新闻（地区）：IBEX',
    payload: {
      text: '两小时内影响IBEX的新闻',
      user_id: 'canary_test_2',
      chat_type: 'group'
    },
    expect: 'news含impact_score与reason，按紧急度排序'
  },
  {
    id: 3,
    name: '只要分析：Grifols',
    payload: {
      text: '只要分析，不要建议。Grifols 解析 + 行业影响',
      user_id: 'canary_test_3',
      chat_type: 'private'
    },
    expect: '仅analysis；可有send_chart:kline'
  },
  {
    id: 4,
    name: '只要资讯：AAPL',
    payload: {
      text: 'AAPL 最近资讯（2小时）',
      user_id: 'canary_test_4',
      chat_type: 'group'
    },
    expect: 'mode=news，列3-5条，附impact_score'
  },
  {
    id: 5,
    name: '组合输出：NVDA',
    payload: {
      text: 'NVDA 解析；给我新闻+建议（24h）',
      user_id: 'canary_test_5',
      chat_type: 'private'
    },
    expect: 'parse+news+advice；时间窗=24h'
  }
];

function sendRequest(payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const url = new URL(PROD_URL);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 30000
    };

    const startTime = Date.now();
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const elapsed = Date.now() - startTime;
        try {
          const response = JSON.parse(body);
          resolve({ 
            response, 
            statusCode: res.statusCode,
            elapsed 
          });
        } catch (e) {
          reject(new Error(`JSON解析失败: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时(30s)'));
    });
    
    req.write(data);
    req.end();
  });
}

async function runCanaryTests() {
  console.log('🧪 USIS Brain v3.1 金丝雀测试 (生产环境)');
  console.log('📍 目标: ' + PROD_URL);
  console.log('='.repeat(80));

  const results = [];

  for (const test of CANARY_TESTS) {
    console.log(`\n🔬 [测试${test.id}] ${test.name}`);
    console.log(`   输入: "${test.payload.text}"`);
    console.log(`   期望: ${test.expect}`);

    try {
      const { response, statusCode, elapsed } = await sendRequest(test.payload);

      if (statusCode === 200 && response.ok) {
        console.log(`   ✅ 成功 (${elapsed}ms)`);

        // 提取关键信息
        const summary = {
          id: test.id,
          name: test.name,
          status: 'PASS',
          elapsed,
          parse: response.parse,
          actions: response.actions || [],
          news_count: Array.isArray(response.news) ? response.news.length : 0,
          first_impact_score: null,
          has_analysis: !!response.analysis,
          has_advice: !!response.advice,
          responseMode: response.levels?.l1?.intent?.responseMode
        };

        // 提取首条新闻的impact_score
        if (response.news && response.news.length > 0) {
          summary.first_impact_score = response.news[0].impact_score;
        }

        console.log(`\n   📊 结果摘要:`);
        console.log(`      - Parse: ${JSON.stringify(summary.parse?.symbols || [])}`);
        console.log(`      - Actions: ${summary.actions.length}个`);
        summary.actions.forEach(a => {
          console.log(`         • ${a.type}${a.exchange ? ' ('+a.exchange+')' : ''}`);
        });
        console.log(`      - 新闻数量: ${summary.news_count}`);
        if (summary.first_impact_score !== null) {
          console.log(`      - 首条ImpactScore: ${summary.first_impact_score.toFixed(3)}`);
        }
        console.log(`      - Analysis: ${summary.has_analysis ? '✅' : '❌'}`);
        console.log(`      - Advice: ${summary.has_advice ? '✅' : '❌'}`);
        console.log(`      - ResponseMode: ${summary.responseMode || 'auto'}`);

        results.push(summary);
      } else {
        console.log(`   ❌ 失败 (HTTP ${statusCode})`);
        console.log(`      错误: ${response.error || '未知'}`);
        results.push({
          id: test.id,
          name: test.name,
          status: 'FAIL',
          error: response.error
        });
      }
    } catch (error) {
      console.log(`   ⚠️  异常: ${error.message}`);
      results.push({
        id: test.id,
        name: test.name,
        status: 'ERROR',
        error: error.message
      });
    }

    // 避免过快请求
    if (test.id < CANARY_TESTS.length) {
      console.log(`   ⏳ 等待3秒...`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 金丝雀测试总结');
  console.log('='.repeat(80));

  const passed = results.filter(r => r.status === 'PASS');
  const failed = results.filter(r => r.status === 'FAIL');
  const errors = results.filter(r => r.status === 'ERROR');

  console.log(`\n总计: ${results.length} | ✅ 通过: ${passed.length} | ❌ 失败: ${failed.length} | ⚠️ 错误: ${errors.length}`);

  if (passed.length > 0) {
    console.log('\n📋 通过测试的Actions与ImpactScore:');
    passed.forEach(r => {
      console.log(`\n[测试${r.id}] ${r.name}`);
      console.log(`  响应时间: ${r.elapsed}ms`);
      console.log(`  Actions (${r.actions.length}个):`);
      if (r.actions.length === 0) {
        console.log(`    (无)`);
      } else {
        r.actions.forEach(a => {
          const details = [];
          if (a.exchange) details.push(`exchange=${a.exchange}`);
          if (a.symbols) details.push(`symbols=${JSON.stringify(a.symbols)}`);
          if (a.metric) details.push(`metric=${a.metric}`);
          console.log(`    - ${a.type}${details.length > 0 ? ' ['+details.join(', ')+']' : ''}`);
        });
      }
      console.log(`  首条ImpactScore: ${r.first_impact_score !== null ? r.first_impact_score.toFixed(3) : 'N/A'}`);
      console.log(`  新闻数量: ${r.news_count}`);
    });
  }

  console.log('\n' + '='.repeat(80));
  
  if (passed.length === results.length) {
    console.log('🎉 所有金丝雀测试通过！系统可以放量上线。');
    process.exit(0);
  } else {
    console.log('⚠️  部分测试未通过，建议观察后再放量。');
    process.exit(1);
  }
}

runCanaryTests().catch(err => {
  console.error('测试执行失败:', err);
  process.exit(1);
});
