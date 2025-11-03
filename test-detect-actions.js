// 测试 detectActions 函数
function detectActions(text = "") {
  const t = text.toLowerCase();
  const actions = [];
  
  // 视觉需求（截图/热力图）
  if (/热力图|heatmap|截图|screenshot|图表|chart|可视化|visual|带图/.test(t)) {
    // 检测地区/国家，返回对应的数据源
    let dataSource = 'SPX500'; // 默认美股
    let marketName = '美股标普500';
    
    if (/西班牙|spain|ibex|马德里/.test(t)) {
      dataSource = 'IBEX';
      marketName = '西班牙IBEX35';
    } else if (/德国|germany|dax|法兰克福/.test(t)) {
      dataSource = 'DAX';
      marketName = '德国DAX';
    } else if (/英国|uk|britain|ftse|伦敦/.test(t)) {
      dataSource = 'FTSE100';
      marketName = '英国富时100';
    } else if (/日本|japan|nikkei|东京/.test(t)) {
      dataSource = 'NIKKEI225';
      marketName = '日本日经225';
    } else if (/法国|france|cac/.test(t)) {
      dataSource = 'CAC40';
      marketName = '法国CAC40';
    } else if (/香港|hk|恒生|hsi/.test(t)) {
      dataSource = 'HSI';
      marketName = '香港恒生';
    } else if (/中国|a股|上证|深证|沪深/.test(t)) {
      dataSource = 'SSE';
      marketName = '中国A股';
    } else if (/纳斯达克|nasdaq|科技股/.test(t)) {
      dataSource = 'NAS100';
      marketName = '纳斯达克100';
    }
    
    // 动态生成TradingView热力图URL
    const heatmapUrl = `https://www.tradingview.com/heatmap/stock/#%7B%22dataSource%22%3A%22${dataSource}%22%2C%22blockColor%22%3A%22change%22%2C%22blockSize%22%3A%22market_cap_basic%22%2C%22grouping%22%3A%22sector%22%7D`;
    
    actions.push({
      type: 'fetch_heatmap',
      tool: 'A_Screenshot',
      url: heatmapUrl,
      market: marketName,
      reason: `用户要求${marketName}热力图`
    });
  }
  
  return actions;
}

// 测试用例
console.log("测试1: 西班牙热力图");
const result1 = detectActions("西班牙热力图");
console.log(JSON.stringify(result1, null, 2));
console.log("\n预期: dataSource=IBEX");
console.log("实际:", result1[0]?.url.includes("IBEX") ? "✅ IBEX" : "❌ " + (result1[0]?.url.match(/dataSource%22%3A%22([^%]+)%22/)?.[1] || "未找到"));

console.log("\n\n测试2: 热力图（无指定国家）");
const result2 = detectActions("热力图");
console.log(JSON.stringify(result2, null, 2));
console.log("\n预期: dataSource=SPX500");
console.log("实际:", result2[0]?.url.includes("SPX500") ? "✅ SPX500" : "❌ " + (result2[0]?.url.match(/dataSource%22%3A%22([^%]+)%22/)?.[1] || "未找到"));

console.log("\n\n测试3: 德国热力图");
const result3 = detectActions("德国热力图");
console.log(JSON.stringify(result3, null, 2));
console.log("\n预期: dataSource=DAX");
console.log("实际:", result3[0]?.url.includes("DAX") ? "✅ DAX" : "❌ " + (result3[0]?.url.match(/dataSource%22%3A%22([^%]+)%22/)?.[1] || "未找到"));
