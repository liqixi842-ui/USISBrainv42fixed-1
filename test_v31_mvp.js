#!/usr/bin/env node

const http = require('http');

const BASE_URL = 'http://localhost:5000';

function sendRequest(data, testName) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = http.request(BASE_URL, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({ testName, response, statusCode: res.statusCode });
        } catch (e) {
          reject(new Error(`JSON解析失败 [${testName}]: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('='.repeat(80));
  console.log('🧪 USIS Brain v3.1 MVP 验收测试');
  console.log('='.repeat(80));

  const tests = [
    {
      name: '测试1: TSMC完整分析（默认full_report）',
      payload: {
        text: '台积电怎么样？',
        user_id: 'test_user_1',
        chat_type: 'private'
      }
    },
    {
      name: '测试2: IBEX两小时新闻（NEWS模式）',
      payload: {
        text: '西班牙IBEX指数最近两小时有什么重要新闻吗？',
        user_id: 'test_user_2',
        chat_type: 'group'
      }
    },
    {
      name: '测试3: FER纯分析模式（ANALYSIS模式）',
      payload: {
        text: '给我分析一下FER的技术面和基本面，不要其他的',
        user_id: 'test_user_3',
        chat_type: 'private'
      }
    },
    {
      name: '测试4: AAPL新闻+建议组合',
      payload: {
        text: 'AAPL最近有啥新闻？给个操作建议',
        user_id: 'test_user_4',
        chat_type: 'group'
      }
    }
  ];

  const results = [];

  for (const test of tests) {
    console.log(`\n📋 ${test.name}`);
    console.log('   请求:', JSON.stringify(test.payload, null, 2));

    try {
      const { response, statusCode } = await sendRequest(test.payload, test.name);

      console.log(`   状态码: ${statusCode}`);

      if (statusCode === 200 && response.ok) {
        console.log('   ✅ 请求成功');

        // 检查v3.1 MVP核心字段
        const checks = {
          'parse字段': !!response.parse,
          'news字段': response.news !== undefined,
          'analysis字段': response.analysis !== undefined,
          'advice字段': response.advice !== undefined,
          'summary存在': !!response.summary
        };

        console.log('   核心字段检查:');
        for (const [field, pass] of Object.entries(checks)) {
          console.log(`      ${pass ? '✅' : '❌'} ${field}`);
        }

        // 输出部分内容
        if (response.parse) {
          console.log(`   解析结果: ${JSON.stringify(response.parse.symbols)}`);
        }

        if (response.news && response.news.length > 0) {
          console.log(`   新闻数量: ${response.news.length}`);
          console.log(`   首条新闻: ${response.news[0].headline?.substring(0, 60)}...`);
          console.log(`   ImpactRank: ${response.news[0].impactRank?.toFixed(2)}`);
        }

        if (response.summary) {
          const summaryPreview = response.summary.substring(0, 150).replace(/\n/g, ' ');
          console.log(`   摘要预览: ${summaryPreview}...`);
        }

        results.push({ test: test.name, status: 'PASS', response });
      } else {
        console.log(`   ❌ 请求失败: ${response.error || '未知错误'}`);
        results.push({ test: test.name, status: 'FAIL', error: response.error });
      }

    } catch (error) {
      console.log(`   ❌ 异常: ${error.message}`);
      results.push({ test: test.name, status: 'ERROR', error: error.message });
    }

    console.log('   等待2秒...');
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 测试总结');
  console.log('='.repeat(80));

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const errors = results.filter(r => r.status === 'ERROR').length;

  console.log(`总计: ${results.length} | ✅ 通过: ${passed} | ❌ 失败: ${failed} | ⚠️ 错误: ${errors}`);

  if (passed === results.length) {
    console.log('\n🎉 所有测试通过！USIS Brain v3.1 MVP已就绪！');
  } else {
    console.log('\n⚠️  部分测试失败，请检查日志');
  }

  console.log('='.repeat(80));
  process.exit(passed === results.length ? 0 : 1);
}

runTests().catch(err => {
  console.error('测试执行失败:', err);
  process.exit(1);
});
