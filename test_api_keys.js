// 测试API Keys有效性
const fetch = require('node-fetch');

async function testOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('❌ OPENAI_API_KEY 未配置');
    return false;
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      console.log('✅ OpenAI API Key 有效');
      return true;
    } else {
      const error = await response.text();
      console.log(`❌ OpenAI API Key 无效: ${response.status} - ${error.slice(0, 200)}`);
      return false;
    }
  } catch (err) {
    console.log(`❌ OpenAI API 测试失败: ${err.message}`);
    return false;
  }
}

async function testTelegramBot(token, botName) {
  if (!token) {
    console.log(`❌ ${botName} Token 未配置`);
    return false;
  }
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await response.json();
    
    if (data.ok) {
      console.log(`✅ ${botName} Token 有效 (@${data.result.username})`);
      return true;
    } else {
      console.log(`❌ ${botName} Token 无效: ${data.description}`);
      return false;
    }
  } catch (err) {
    console.log(`❌ ${botName} 测试失败: ${err.message}`);
    return false;
  }
}

async function testFinnhub() {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    console.log('❌ FINNHUB_API_KEY 未配置');
    return false;
  }
  
  try {
    const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=AAPL&token=${apiKey}`);
    const data = await response.json();
    
    if (data.c) {
      console.log(`✅ Finnhub API Key 有效 (AAPL价格: $${data.c})`);
      return true;
    } else {
      console.log(`❌ Finnhub API Key 无效: ${JSON.stringify(data).slice(0, 200)}`);
      return false;
    }
  } catch (err) {
    console.log(`❌ Finnhub API 测试失败: ${err.message}`);
    return false;
  }
}

async function runTests() {
  console.log('\n🔍 ═══════ API Keys 验证测试 ═══════\n');
  
  console.log('📊 1. OpenAI API');
  await testOpenAI();
  
  console.log('\n📊 2. Telegram Bot Tokens');
  await testTelegramBot(process.env.MANAGER_BOT_TOKEN, 'Manager Bot');
  await testTelegramBot(process.env.RESEARCH_BOT_TOKEN, 'Research Bot');
  await testTelegramBot(process.env.NEWS_BOT_TOKEN, 'News Bot');
  
  console.log('\n📊 3. Finnhub API (股票数据)');
  await testFinnhub();
  
  console.log('\n✅ 测试完成\n');
}

runTests();
