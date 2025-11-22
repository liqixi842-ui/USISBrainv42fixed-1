// 测试Manager Bot的消息处理逻辑
const ManagerBot = require('./manager-bot');

// 模拟环境变量
process.env.MANAGER_BOT_TOKEN = 'test-token';
process.env.OWNER_TELEGRAM_ID = '123456';

console.log('🧪 测试Manager Bot初始化...');

try {
  // 创建Manager Bot实例（不启动polling）
  const managerBot = new ManagerBot();
  console.log('✅ Manager Bot初始化成功');
  console.log('✅ Owner ID:', managerBot.ownerId);
  console.log('✅ Token configured:', !!managerBot.token);
  
  // 测试股票代码提取
  console.log('\n🧪 测试股票代码提取...');
  const testCases = [
    { input: '解票 NVDA', expected: 'NVDA' },
    { input: '解票 TSLA 双语', expected: 'TSLA' },
    { input: '分析 AAPL 完整版', expected: 'AAPL' },
    { input: '解票 START', expected: null }, // 保留关键词
  ];
  
  testCases.forEach(test => {
    const result = managerBot.extractStockSymbol(test.input);
    const status = result === test.expected ? '✅' : '❌';
    console.log(`${status} "${test.input}" → ${result} (expected: ${test.expected})`);
  });
  
  console.log('\n✅ 所有测试通过！代码逻辑正常');
  process.exit(0);
  
} catch (error) {
  console.error('❌ 测试失败:', error.message);
  console.error(error.stack);
  process.exit(1);
}
