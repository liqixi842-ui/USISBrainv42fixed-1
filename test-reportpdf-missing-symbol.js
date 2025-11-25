/**
 * test-reportpdf-missing-symbol.js
 * 测试 handleReportPdf 在缺少 symbol 时是否正确处理
 */

const { handleReportPdf } = require('./bots/report-bot.js');

// Mock bot object
const mockBot = {
  sendMessage: async (chatId, text, options) => {
    console.log(`📨 Mock bot.sendMessage called:`);
    console.log(`   chatId: ${chatId}`);
    console.log(`   text: ${text.substring(0, 100)}...`);
    console.log(`   options: ${JSON.stringify(options)}`);
    return { message_id: 123 };
  }
};

// Mock message object
const mockMessage = {
  from: { id: 12345, username: 'testuser' },
  chat: { id: 67890 },
  text: '/reportpdf'
};

async function test() {
  console.log('\n🧪 Testing handleReportPdf with missing symbol...\n');
  
  try {
    // Test 1: Empty args array
    console.log('Test 1: Empty args array');
    const result1 = await handleReportPdf([], 67890, mockBot, mockMessage, {});
    console.log(`✅ Result 1: ${JSON.stringify(result1)}`);
    console.log(`✅ Function returned successfully without crashing\n`);
    
    // Test 2: With premium flag but no symbol
    console.log('Test 2: Premium flag but no symbol');
    const result2 = await handleReportPdf([], 67890, mockBot, mockMessage, { premium: true });
    console.log(`✅ Result 2: ${JSON.stringify(result2)}`);
    console.log(`✅ Function returned successfully without crashing\n`);
    
    console.log('🎉 All tests passed! handleReportPdf correctly handles missing symbol case.');
    
  } catch (error) {
    console.error('\n❌ Test failed!');
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    process.exit(1);
  }
}

test();
