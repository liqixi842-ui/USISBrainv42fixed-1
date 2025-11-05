const puppeteer = require('puppeteer');

// 🗺️ 指数标签映射（TradingView UI显示的完整名称）
const INDEX_LABEL = {
  SPX500: "S&P 500 Index",
  NASDAQ100: "NASDAQ 100 Index",
  DJ30: "Dow Jones Industrial Average",
  NIKKEI225: "Nikkei 225 Index",
  IBEX35: "IBEX 35 Index",
  DAX40: "DAX 40 Index",
  CAC40: "CAC 40 Index",
  FTSE100: "FTSE 100 Index",
  EURO50: "EURO STOXX 50 Index",
  HSI: "Hang Seng Index",
  CSI300: "CSI 300 Index",
  NIFTY50: "NIFTY 50 Index"
};

// 🌍 地区到默认指数映射
const REGION_TO_INDEX = {
  US: "SPX500",
  JP: "NIKKEI225",
  ES: "IBEX35",
  DE: "DAX40",
  FR: "CAC40",
  UK: "FTSE100",
  EU: "EURO50",
  HK: "HSI",
  CN: "CSI300",
  IN: "NIFTY50"
};

// 🎨 行业别名映射（多语言支持）
const SECTOR_ALIASES = {
  technology: ["Technology", "Tecnología", "科技", "テクノロジー"],
  financials: ["Financials", "Financieros", "金融", "金融サービス"],
  healthcare: ["Health Care", "Salud", "医疗", "ヘルスケア"],
  industrials: ["Industrials", "Industriales", "工业", "資本財"],
  energy: ["Energy", "Energía", "能源", "エネルギー"],
  materials: ["Materials", "Materiales", "材料", "素材"],
  consumer_discretionary: ["Consumer Discretionary", "Consumo discrecional", "可选消费", "一般消費財"],
  consumer_staples: ["Consumer Staples", "Consumo básico", "必需消费", "生活必需品"],
  communication_services: ["Communication Services", "Comunicaciones", "通信", "通信サービス"],
  utilities: ["Utilities", "Servicios públicos", "公用事业", "公益事業"],
  real_estate: ["Real Estate", "Inmobiliario", "房地产", "不動産"]
};

/**
 * 🔍 辅助函数：查找第一个可见元素（Puppeteer版本）
 */
async function firstVisible(page, selectors) {
  for (const sel of selectors) {
    try {
      const elements = await page.$$(sel);
      for (const el of elements) {
        const isVisible = await el.isIntersectingViewport();
        if (isVisible) {
          return el;
        }
      }
    } catch (e) {
      // 选择器无效，继续尝试下一个
    }
  }
  return null;
}

/**
 * 📸 核心函数：使用Puppeteer捕获TradingView热力图
 * @param {Object} options
 * @param {string} options.dataset - 指数代码（如 SPX500, NIKKEI225）
 * @param {string} options.label - 指数显示标签（如 "S&P 500 Index"）
 * @param {string} [options.lang] - 语言代码（如 "es-ES", "ja-JP"）
 * @param {string} [options.sector] - 行业代码（如 "technology"）
 * @param {number} [options.timeout=15000] - 超时时间（毫秒）
 * @returns {Promise<{image_base64: string, visual_index_label: string}>}
 */
async function captureTvHeatmap({ dataset, label, lang, sector, timeout = 15000 }) {
  const startTime = Date.now();
  console.log(`\n📸 [TvCapture] 开始截图: dataset=${dataset}, label="${label}", sector=${sector || 'AUTO'}`);

  let browser;
  try {
    // 1️⃣ 启动浏览器（headless模式）
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions'
      ],
      timeout: timeout
    });

    const page = await browser.newPage();
    
    // 设置语言和viewport
    await page.setExtraHTTPHeaders({
      'Accept-Language': lang || 'en-US,en;q=0.9'
    });
    
    await page.setViewport({ width: 1400, height: 900 });
    page.setDefaultTimeout(timeout);

    // 2️⃣ 访问TradingView热力图（带dataset参数作为初始意图）
    const url = `https://www.tradingview.com/heatmap/stock/?color=change&dataset=${dataset}&group=sector&blockSize=market_cap_diluted&tileColor=change`;
    console.log(`🌐 [TvCapture] 访问: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: timeout });

    // 等待主内容加载
    await page.waitForTimeout(2000);

    // 3️⃣ 点开指数选择器并强制选择目标指数
    console.log(`🎯 [TvCapture] 强制切换到指数: "${label}"`);
    
    try {
      // 查找并点击指数选择按钮（多语言兼容）
      const buttonFound = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const indexBtn = buttons.find(b => {
          const text = (b.textContent || '').toLowerCase();
          const ariaLabel = (b.getAttribute('aria-label') || '').toLowerCase();
          return text.includes('index') || text.includes('índice') || text.includes('指数') || 
                 text.includes('インデックス') || ariaLabel.includes('index');
        });
        if (indexBtn) {
          indexBtn.click();
          return true;
        }
        return false;
      });

      if (buttonFound) {
        console.log(`✅ [TvCapture] 已点击指数选择器`);
        await page.waitForTimeout(400);

        // 查找搜索框并输入
        const searchInputFound = await page.evaluate((searchLabel) => {
          const inputs = Array.from(document.querySelectorAll('input'));
          const searchInput = inputs.find(i => 
            i.type === 'search' || 
            i.placeholder && (
              i.placeholder.toLowerCase().includes('search') ||
              i.placeholder.includes('Buscar') ||
              i.placeholder.includes('搜索')
            )
          );
          if (searchInput) {
            searchInput.value = searchLabel;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
          }
          return false;
        }, label);

        if (searchInputFound) {
          console.log(`🔍 [TvCapture] 搜索指数: "${label}"`);
          await page.waitForTimeout(500);

          // 点击第一条结果
          const itemClicked = await page.evaluate(() => {
            const items = document.querySelectorAll('ul li, [role="listbox"] [role="option"]');
            if (items.length > 0) {
              items[0].click();
              return true;
            }
            return false;
          });

          if (itemClicked) {
            console.log(`✅ [TvCapture] 已选择指数`);
            await page.waitForTimeout(1500);
          }
        }
      } else {
        console.warn(`⚠️  [TvCapture] 未找到指数选择器，继续使用URL参数`);
      }
    } catch (indexError) {
      console.warn(`⚠️  [TvCapture] 指数切换失败: ${indexError.message}，继续使用URL参数`);
    }

    // 4️⃣ 可选：行业聚焦
    if (sector && sector !== "AUTO" && SECTOR_ALIASES[sector]) {
      console.log(`🎨 [TvCapture] 尝试聚焦行业: ${sector}`);
      
      try {
        const sectorAliases = SECTOR_ALIASES[sector];
        const sectorClicked = await page.evaluate((aliases) => {
          // 查找Sector按钮
          const buttons = Array.from(document.querySelectorAll('button'));
          const sectorBtn = buttons.find(b => {
            const text = (b.textContent || '').toLowerCase();
            return text.includes('sector') || text.includes('行业') || text.includes('セクター');
          });
          
          if (sectorBtn) {
            sectorBtn.click();
            // 等待一小会儿后查找行业选项
            setTimeout(() => {
              const allElements = Array.from(document.querySelectorAll('*'));
              for (const alias of aliases) {
                const elem = allElements.find(e => (e.textContent || '').trim() === alias);
                if (elem) {
                  elem.click();
                  return true;
                }
              }
            }, 200);
          }
          return false;
        }, sectorAliases);

        if (sectorClicked) {
          console.log(`✅ [TvCapture] 已聚焦行业: ${sector}`);
          await page.waitForTimeout(1000);
        } else {
          console.warn(`⚠️  [TvCapture] 未能聚焦行业: ${sector}（将返回全图）`);
        }
      } catch (sectorError) {
        console.warn(`⚠️  [TvCapture] 行业聚焦失败: ${sectorError.message}`);
      }
    }

    // 5️⃣ 等待热力图稳定渲染
    await page.waitForTimeout(1200);

    // 6️⃣ 截图（高质量JPEG）
    console.log(`📷 [TvCapture] 开始截图...`);
    const imageBuffer = await page.screenshot({
      type: 'jpeg',
      quality: 90,
      fullPage: false
    });

    // 7️⃣ 采集可见的指数按钮文本用于校验
    const visualIndex = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const indexBtn = buttons.find(b => {
        const text = b.textContent || '';
        return /Index|Índice|指数|インデックス/.test(text);
      });
      return indexBtn ? indexBtn.textContent.trim() : '';
    });

    const elapsed = Date.now() - startTime;
    console.log(`✅ [TvCapture] 截图完成 (${elapsed}ms, ${imageBuffer.length} bytes)`);
    console.log(`🔍 [TvCapture] 视觉校验: visual_index="${visualIndex}"`);

    await browser.close();

    return {
      image_base64: imageBuffer.toString('base64'),
      visual_index_label: visualIndex
    };

  } catch (error) {
    console.error(`❌ [TvCapture] 截图失败:`, error.message);
    if (browser) {
      await browser.close();
    }
    throw error;
  }
}

/**
 * 🔄 带重试的截图函数
 */
async function captureTvHeatmapWithRetry(options, maxRetries = 2) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`\n🔄 [TvCapture] 尝试 ${attempt}/${maxRetries}`);
      const result = await captureTvHeatmap(options);
      
      // 校验视觉指数是否匹配
      const expectedLabel = options.label;
      const visualLabel = result.visual_index_label;
      
      if (visualLabel && !visualLabel.includes(expectedLabel.split(' ')[0])) {
        console.warn(`⚠️  [TvCapture] 视觉校验失败: expected="${expectedLabel}", got="${visualLabel}"`);
        if (attempt < maxRetries) {
          console.log(`🔄 [TvCapture] 将重试...`);
          await new Promise(resolve => setTimeout(resolve, 1500));
          continue;
        }
      }
      
      return result;
    } catch (error) {
      lastError = error;
      console.error(`❌ [TvCapture] 尝试 ${attempt} 失败:`, error.message);
      
      if (attempt < maxRetries) {
        console.log(`🔄 [TvCapture] 等待后重试...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  
  throw new Error(`TradingView截图失败（已重试${maxRetries}次）: ${lastError.message}`);
}

module.exports = {
  captureTvHeatmap,
  captureTvHeatmapWithRetry,
  INDEX_LABEL,
  REGION_TO_INDEX,
  SECTOR_ALIASES
};
