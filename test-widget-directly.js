const express = require('express');
const app = express();

// 测试列表：根据TradingView界面和常见代码
const testCodes = [
  // 美国
  { code: 'SPX500', name: 'S&P 500' },
  { code: 'DJI', name: 'Dow Jones' },
  { code: 'NDX', name: 'Nasdaq 100' },
  { code: 'IXIC', name: 'Nasdaq Composite' },
  { code: 'RUT', name: 'Russell 2000' },
  { code: 'USA', name: 'All US' },
  
  // 西班牙
  { code: 'IBEX', name: 'IBEX 35' },
  { code: 'IBEX35', name: 'IBEX 35 Alt' },
  { code: 'BME', name: 'Spain BME' },
  { code: 'SPAIN', name: 'Spain' },
  
  // 其他欧洲
  { code: 'DAX', name: 'DAX Germany' },
  { code: 'FTSE', name: 'FTSE UK' },
  { code: 'CAC', name: 'CAC France' },
  { code: 'STOXX', name: 'Euro Stoxx' },
  
  // 亚洲
  { code: 'NKY', name: 'Nikkei' },
  { code: 'HSI', name: 'Hang Seng' },
  { code: 'ASX', name: 'Australia' },
  
  // 已知有效
  { code: 'ASX200', name: 'ASX 200 (Known)' }
];

app.get('/test-all', (req, res) => {
  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>TradingView DataSource Grid Test</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background: #0D1117;
      color: white;
      margin: 0;
      padding: 20px;
    }
    h1 {
      text-align: center;
      color: #58A6FF;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
      gap: 20px;
      margin-top: 30px;
    }
    .widget-box {
      background: #161B22;
      border: 1px solid #30363D;
      border-radius: 8px;
      padding: 15px;
      height: 350px;
    }
    .widget-title {
      font-weight: bold;
      margin-bottom: 10px;
      color: #58A6FF;
      text-align: center;
    }
    .widget-code {
      font-size: 12px;
      color: #8B949E;
      text-align: center;
      margin-bottom: 10px;
    }
    .widget-container {
      width: 100%;
      height: 280px;
    }
  </style>
</head>
<body>
  <h1>🔬 TradingView DataSource 批量测试</h1>
  <p style="text-align: center; color: #8B949E;">
    观察哪些widget显示了不同的内容（非S&P 500），那些dataSource值就是有效的
  </p>
  
  <div class="grid">
`;

  testCodes.forEach(({ code, name }) => {
    html += `
    <div class="widget-box">
      <div class="widget-title">${name}</div>
      <div class="widget-code">dataSource: "${code}"</div>
      <div class="widget-container">
        <div class="tradingview-widget-container" style="width: 100%; height: 100%;">
          <div class="tradingview-widget-container__widget"></div>
          <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js" async>
          {
            "exchanges": [],
            "dataSource": "${code}",
            "grouping": "sector",
            "blockSize": "market_cap_basic",
            "blockColor": "change",
            "locale": "en",
            "symbolUrl": "",
            "colorTheme": "dark",
            "hasTopBar": false,
            "isDataSetEnabled": true,
            "isZoomEnabled": true,
            "hasSymbolTooltip": true,
            "width": "100%",
            "height": "100%"
          }
          </script>
        </div>
      </div>
    </div>
`;
  });

  html += `
  </div>
  
  <div style="margin-top: 40px; text-align: center; color: #8B949E;">
    <p>💡 提示：向下滚动查看所有测试。如果某个widget和其他的内容不同，说明dataSource有效！</p>
  </div>
</body>
</html>
`;

  res.send(html);
});

const PORT = 5001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🧪 批量测试服务器启动！`);
  console.log(`📍 访问: http://localhost:${PORT}/test-all\n`);
  console.log(`生产环境: https://node-js-liqixi842.replit.app/test-all`);
});
