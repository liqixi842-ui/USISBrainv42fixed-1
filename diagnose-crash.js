// 诊断服务器崩溃问题

console.log('🔍 开始诊断...\n');

// Test 1: 检查模块导入
console.log('Test 1: 检查v3.1模块导入');
try {
  const { parseUserIntent } = require("./semanticIntentAgent");
  const { resolveSymbols } = require("./symbolResolver");
  const { fetchMarketData, validateDataForAnalysis } = require("./dataBroker");
  const { buildAnalysisPrompt, buildErrorResponse } = require("./analysisPrompt");
  const { validateResponse } = require("./complianceGuard");
  console.log('✅ 所有v3.1模块导入成功\n');
} catch (error) {
  console.error('❌ 模块导入失败:', error.message);
  console.error(error.stack);
  process.exit(1);
}

// Test 2: 检查环境变量
console.log('Test 2: 检查环境变量');
const required = ['OPENAI_API_KEY', 'FINNHUB_API_KEY', 'DATABASE_URL'];
const missing = required.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.warn(`⚠️  缺少环境变量: ${missing.join(', ')}`);
} else {
  console.log('✅ 所有必需环境变量已设置\n');
}

// Test 3: 模拟简单的orchestrate请求
console.log('Test 3: 模拟orchestrate请求流程');

async function testOrchestrateFlow() {
  const { parseUserIntent } = require("./semanticIntentAgent");
  const { resolveSymbols } = require("./symbolResolver");
  
  try {
    console.log('   Step 1: parseUserIntent...');
    const intent = await parseUserIntent("test", []);
    console.log(`   ✅ Intent: ${intent.intentType}`);
    
    console.log('   Step 2: resolveSymbols...');
    const symbols = await resolveSymbols(intent);
    console.log(`   ✅ Symbols: ${symbols.join(', ') || 'none'}`);
    
    console.log('\n✅ 测试流程完成，未发现崩溃问题');
    
  } catch (error) {
    console.error('\n❌ 测试流程失败:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Test 4: 检查数据库连接
async function testDatabase() {
  console.log('\nTest 4: 检查数据库连接');
  const { Pool } = require("pg");
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ 数据库连接正常');
    await pool.end();
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
  }
}

// 运行所有测试
(async () => {
  await testOrchestrateFlow();
  await testDatabase();
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ 诊断完成，未发现明显问题');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  process.exit(0);
})();
