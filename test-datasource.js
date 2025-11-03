const fetch = require("node-fetch");
const cheerio = require("cheerio");

// 要爬取的市场代码（扩展版）
const knownCodes = [
  "SPX500", "DJCA", "DJI", "NDX", "IXIC", "RUSSELL1000", "RUSSELL2000", "RUSSELL3000",
  "DAX", "DAX40", "FTSE100", "FTSE250", "IBEX35", "IBEXSC", "IBEXMC",
  "NIKKEI225", "NI225", "HANGSENG", "HSI", "CAC40", "ASX200", 
  "SSE", "SSE50", "STOXX50E", "TSX", "KOSPI"
];

// 基础URL + 带参数的URL
const urls = [
  "https://www.tradingview.com/heatmap/stock/"
];

// 为每个已知代码生成URL
knownCodes.forEach(code => {
  urls.push(`https://www.tradingview.com/heatmap/stock/#%7B%22dataSource%22%3A%22${code}%22%7D`);
});

async function extractDataSources() {
  const results = new Set();
  let processed = 0;

  console.log(`🔍 开始爬取 ${urls.length} 个URL...\n`);

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      const html = await res.text();

      // 搜索所有包含 dataSource 的模式
      const patterns = [
        /"dataSource"\s*:\s*"([^"]+)"/g,
        /'dataSource'\s*:\s*'([^']+)'/g,
        /dataSource=["']([^"']+)["']/g
      ];

      patterns.forEach(pattern => {
        const matches = html.match(pattern);
        if (matches) {
          matches.forEach((m) => {
            const match = m.match(/["']([^"']+)["']/);
            if (match && match[1]) {
              results.add(match[1]);
            }
          });
        }
      });

      processed++;
      if (processed % 10 === 0) {
        console.log(`⏳ 已处理: ${processed}/${urls.length}`);
      }
    } catch (err) {
      // 静默处理错误，继续下一个
    }
    
    // 避免请求过快
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n✅ 处理完成: ${processed}/${urls.length}\n`);
  console.log("📊 找到的唯一dataSource值:\n");
  
  const sortedResults = [...results].sort();
  sortedResults.forEach(val => console.log(`  "${val}",`));
  
  console.log(`\n总计: ${sortedResults.length} 个唯一值`);
  
  return sortedResults;
}

extractDataSources().catch(console.error);
