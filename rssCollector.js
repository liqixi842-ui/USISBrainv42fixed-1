/**
 * USIS News RSS Collector - 内置新闻采集系统
 * 
 * 从精选的免费RSS源自动采集新闻，无需外部N8N服务
 */

const Parser = require('rss-parser');
const axios = require('axios');

class RSSCollector {
  constructor() {
    this.parser = new Parser({
      timeout: 10000,
      headers: {
        'User-Agent': 'USIS-Brain-NewsBot/6.0'
      }
    });
    
    this.sources = this.initializeSources();
    console.log(`📡 [RSSCollector] Initialized with ${this.sources.length} sources`);
  }

  /**
   * 初始化RSS源配置（精选免费且可靠的源）
   */
  initializeSources() {
    return [
      // 一类：权威监管源（全部免费）
      { name: 'Fed', url: 'https://www.federalreserve.gov/feeds/press_all.xml', tier: 1, enabled: true },
      { name: 'SEC', url: 'https://www.sec.gov/news/pressreleases.rss', tier: 1, enabled: true },
      { name: 'ECB', url: 'https://www.ecb.europa.eu/rss/press.html', tier: 1, enabled: true },
      
      // 二类：一线财经媒体（免费RSS）
      { name: 'Reuters Business', url: 'https://www.reutersagency.com/feed/?taxonomy=best-topics&post_type=best', tier: 2, enabled: true },
      { name: 'CNBC', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', tier: 2, enabled: true },
      { name: 'MarketWatch', url: 'https://www.marketwatch.com/rss/topstories', tier: 2, enabled: true },
      { name: 'Yahoo Finance', url: 'https://finance.yahoo.com/news/rssindex', tier: 2, enabled: true },
      { name: 'Fortune', url: 'https://fortune.com/feed', tier: 2, enabled: true },
      { name: 'Bloomberg Markets', url: 'https://feeds.bloomberg.com/markets/news.rss', tier: 2, enabled: true },
      { name: 'WSJ Markets', url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml', tier: 2, enabled: true },
      
      // 西班牙财经媒体（免费RSS）
      { name: 'Expansión', url: 'https://www.expansion.com/rss/portada.xml', tier: 2, enabled: true },
      { name: 'El Español - Invertia', url: 'https://www.elespanol.com/rss/invertia', tier: 2, enabled: true },
      
      // 加拿大财经媒体（免费RSS）
      { name: 'Financial Post', url: 'https://feeds.feedburner.com/FP_TopStories', tier: 2, enabled: true },
      { name: 'Bank of Canada', url: 'https://www.bankofcanada.ca/feed/', tier: 1, enabled: true },
      
      // 三类：行业垂直+聚合源（免费）
      { name: 'Investing.com', url: 'https://www.investing.com/rss/news.rss', tier: 3, enabled: true },
      { name: 'Seeking Alpha', url: 'https://seekingalpha.com/feed.xml', tier: 3, enabled: true },
      { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', tier: 3, enabled: true },
      { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', tier: 3, enabled: false },
      { name: 'Electrek', url: 'https://electrek.co/feed/', tier: 3, enabled: false },
      { name: 'FreightWaves', url: 'https://www.freightwaves.com/feed', tier: 3, enabled: false },
      { name: 'OilPrice', url: 'https://oilprice.com/rss/main', tier: 3, enabled: false },
      
      // 中文财经源（免费）
      { name: '财联社', url: 'https://www.cls.cn/api/sw?app=CailianpressWeb&os=web&sv=7.7.4', tier: 3, enabled: false },
    ];
  }

  /**
   * 采集单个RSS源
   */
  async fetchSource(source) {
    try {
      const feed = await this.parser.parseURL(source.url);
      
      if (!feed || !feed.items || feed.items.length === 0) {
        console.log(`⚠️  [RSS] ${source.name}: No items`);
        return [];
      }

      const items = feed.items.map(item => ({
        title: item.title || '',
        url: item.link || item.guid || '',
        summary: item.contentSnippet || item.description || item.content || '',
        published_at: item.isoDate || item.pubDate || new Date().toISOString(),
        source: source.name,
        tier: source.tier,
        symbols: []
      }));

      console.log(`✅ [RSS] ${source.name}: ${items.length} items`);
      return items;

    } catch (error) {
      console.error(`❌ [RSS] ${source.name} failed:`, error.message);
      return [];
    }
  }

  /**
   * 采集所有启用的RSS源
   */
  async fetchAll() {
    const enabledSources = this.sources.filter(s => s.enabled);
    console.log(`\n📡 [RSS] Starting collection from ${enabledSources.length} sources...`);

    const results = await Promise.allSettled(
      enabledSources.map(source => this.fetchSource(source))
    );

    const allItems = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value)
      .filter(item => item.url && item.title);

    console.log(`📊 [RSS] Total collected: ${allItems.length} items\n`);
    return allItems;
  }

  /**
   * 发送到本地API进行处理
   */
  async sendToAPI(item) {
    try {
      const port = process.env.PORT || 5000;
      const response = await axios.post(
        `http://localhost:${port}/api/news/ingest`,
        {
          ...item,
          dryRun: false
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-News-Secret': process.env.NEWS_INGESTION_SECRET || ''
          },
          timeout: 15000
        }
      );

      return { success: true, data: response.data };
    } catch (error) {
      if (error.response?.data) {
        return { success: false, error: error.response.data };
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * 执行完整的采集流程
   */
  async run() {
    const startTime = Date.now();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 RSS Collection Started - ${new Date().toLocaleString('zh-CN')}`);
    console.log('='.repeat(60));

    try {
      // 1. 采集所有RSS
      const items = await this.fetchAll();

      if (items.length === 0) {
        console.log('⚠️  No items collected');
        return { success: true, processed: 0, elapsed: Date.now() - startTime };
      }

      // 2. 发送到API处理
      let processed = 0;
      let skipped = 0;
      let failed = 0;

      for (const item of items) {
        const result = await this.sendToAPI(item);
        
        if (result.success) {
          if (result.data.action === 'skipped') {
            skipped++;
          } else {
            processed++;
          }
        } else {
          failed++;
        }
        
        // 避免API限流
        await new Promise(r => setTimeout(r, 100));
      }

      const elapsed = Date.now() - startTime;
      console.log(`\n${'='.repeat(60)}`);
      console.log(`✅ Collection Complete`);
      console.log(`   Processed: ${processed} | Skipped: ${skipped} | Failed: ${failed}`);
      console.log(`   Total time: ${(elapsed / 1000).toFixed(1)}s`);
      console.log('='.repeat(60));

      return { success: true, processed, skipped, failed, elapsed };

    } catch (error) {
      console.error(`❌ Collection failed:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = RSSCollector;
