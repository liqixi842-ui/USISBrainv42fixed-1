const fetch = require('node-fetch');

async function testNewKey() {
  const key = process.env.DEEPL_API_KEY;
  
  if (!key) {
    console.log('❌ No DEEPL_API_KEY found');
    return;
  }
  
  const isFreeKey = key.endsWith(':fx');
  const endpoint = isFreeKey 
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate';
  
  console.log('🔑 DeepL API Key Status:');
  console.log('  Type:', isFreeKey ? 'Free (:fx suffix)' : 'Pro');
  console.log('  Endpoint:', endpoint);
  console.log('  Key length:', key.length);
  
  const testCases = [
    { text: 'Apple Unveils Breakthrough in AI Chip Technology', lang: 'title' },
    { text: 'Tesla announced today that its Full Self-Driving (FSD) system has successfully completed 1 million miles of autonomous driving without human intervention.', lang: 'summary' }
  ];
  
  for (const test of testCases) {
    console.log(`\n📝 Testing ${test.lang} translation...`);
    console.log('Original:', test.text.substring(0, 60) + '...');
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `DeepL-Auth-Key ${key}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `text=${encodeURIComponent(test.text)}&target_lang=ZH`
      });
      
      if (!response.ok) {
        console.log(`❌ HTTP ${response.status}: ${response.statusText}`);
        const errorText = await response.text();
        console.log('Error:', errorText);
        continue;
      }
      
      const data = await response.json();
      
      if (data.translations && data.translations[0]) {
        console.log('✅ Chinese:', data.translations[0].text);
      } else {
        console.log('❌ Unexpected response:', data);
      }
    } catch (error) {
      console.log('❌ Error:', error.message);
    }
  }
}

testNewKey();
