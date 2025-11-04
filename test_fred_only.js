// 测试FRED API集成（独立脚本）
const fetch = require('node-fetch');

const FRED_API_KEY = process.env.FRED_API_KEY;

async function fetchFREDSeries(seriesId, options = {}) {
  const { limit = 12 } = options;
  
  if (!FRED_API_KEY) {
    throw new Error(`FRED ${seriesId} HTTP 400`);
  }
  
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&limit=${limit}&sort_order=desc`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`FRED ${seriesId} HTTP ${response.status}`);
  }
  
  const data = await response.json();
  
  const observations = data.observations || [];
  if (observations.length === 0) {
    throw new Error(`FRED ${seriesId} no data`);
  }
  
  const latest = observations[0];
  const value = parseFloat(latest.value);
  
  return {
    seriesId,
    latest: {
      date: latest.date,
      value: isNaN(value) ? null : value
    },
    history: observations.slice(1, 13).map(o => ({
      date: o.date,
      value: parseFloat(o.value)
    }))
  };
}

async function collectMacroData() {
  console.log('📊 开始采集FRED宏观数据...');
  
  const seriesWanted = [
    'CPIAUCSL',       // CPI
    'UNRATE',         // 失业率
    'GDPC1',          // 实际GDP
    'FEDFUNDS',       // 联邦基金利率
  ];
  
  const out = {};
  for (const id of seriesWanted) {
    try {
      out[id] = await fetchFREDSeries(id, { limit: 12 });
      console.log(`  ✓ ${id}: ${out[id].latest?.value || 'N/A'}`);
    } catch (e) {
      out[id] = { seriesId: id, error: e.message };
      console.log(`  ✗ ${id}: ${e.message}`);
    }
  }
  
  return out;
}

// 执行测试
(async () => {
  console.log('=== FRED API 测试开始 ===\n');
  console.log('API密钥已配置:', !!FRED_API_KEY);
  console.log('密钥前缀:', FRED_API_KEY ? FRED_API_KEY.slice(0, 6) + '...' : 'N/A');
  console.log('');
  
  const result = await collectMacroData();
  
  console.log('\n=== 测试结果 ===');
  console.log(JSON.stringify(result, null, 2));
  
  console.log('\n=== 数据汇总 ===');
  if (result.CPIAUCSL?.latest) {
    console.log(`📈 CPI: ${result.CPIAUCSL.latest.value} (${result.CPIAUCSL.latest.date})`);
  }
  if (result.UNRATE?.latest) {
    console.log(`💼 失业率: ${result.UNRATE.latest.value}% (${result.UNRATE.latest.date})`);
  }
  if (result.GDPC1?.latest) {
    console.log(`💰 实际GDP: $${result.GDPC1.latest.value}B (${result.GDPC1.latest.date})`);
  }
  if (result.FEDFUNDS?.latest) {
    console.log(`🏦 联邦利率: ${result.FEDFUNDS.latest.value}% (${result.FEDFUNDS.latest.date})`);
  }
  
  console.log('\n✅ FRED集成测试完成！');
})();
