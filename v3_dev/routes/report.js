/**
 * v3-dev Research Report Routes v2 (Generic Multi-Asset Engine)
 * HTTP endpoints for institutional-grade research reports
 * Supports: JSON, HTML, PDF, Markdown formats for any symbol
 */

const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const { 
  buildResearchReport, 
  buildHtmlFromReport, 
  generatePdfWithDocRaptor,
  // Legacy exports for backward compatibility
  buildSimpleReport,
  generateHTMLReport,
  generateMarkdownReport
} = require('../services/reportService');

// Asset type classifier (equity / index / etf / crypto)
const { classifyAssetType } = require('../services/assetClassifier');

// 尝试导入 dataBroker（如果可用）
let fetchMarketData;
try {
  const dataBroker = require('../../dataBroker');
  fetchMarketData = dataBroker.fetchMarketData;
} catch (error) {
  console.warn(`⚠️  [v3-dev Report Routes] dataBroker not available, using mock data`);
  fetchMarketData = null;
}

/**
 * GET /v3/report/test
 * 返回静态示例研报
 */
router.get('/test', (req, res) => {
  console.log(`📋 [v3-dev] GET /v3/report/test`);
  
  const mockReport = {
    ok: true,
    env: 'v3-dev',
    type: 'equity_research_report_mock',
    symbol: 'AAPL',
    generated_at: new Date().toISOString(),
    sections: {
      summary: '苹果公司（AAPL）是全球领先的科技公司，主营业务包括iPhone、Mac、iPad等硬件产品及App Store、iCloud等服务。公司拥有强大的品牌影响力和生态系统优势。',
      business: '主营业务：消费电子产品（iPhone占营收60%+）、可穿戴设备（Apple Watch、AirPods）、服务业务（增长迅速，利润率高）。地域分布：美洲、欧洲、大中华区、日本及亚太其他地区。',
      valuation: '当前估值：PE约28倍，处于科技股合理区间。近期股价表现稳健，受益于AI概念和服务业务增长。目标价区间：$180-$200（12个月）。',
      technical: '技术面：股价位于上升通道，MA50和MA200呈多头排列。MACD金叉，RSI处于中性区间（50-60）。支撑位$170，压力位$195。',
      risks: '主要风险：1）中美贸易摩擦影响供应链；2）iPhone销量增长放缓；3）监管压力（反垄断）；4）汇率波动风险。'
    },
    rating: 'BUY',
    target_price: '$190',
    horizon: '12个月',
    disclaimer: '本报告为 v3-dev 测试示例，不构成投资建议。'
  };
  
  res.json(mockReport);
});

/**
 * GET /v3/report/:symbol
 * Generate institutional-grade research report for ANY symbol
 * Supports: ?format=json|html|pdf|md
 * Supports: ?asset_type=equity|index|etf|crypto (default: equity)
 */
router.get('/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const { 
    format = 'json', 
    asset_type = 'equity',
    brand = 'USIS Research',
    firm = 'USIS Research Division',
    analyst = 'System (USIS Brain)',
    lang = 'en',
    exchange = null,
    country = null,
    display_name = null,
    modelName = null,     // 🆕 v7.7: 自定义模型名称 (e.g., 北极光量化)
    versionNumber = null  // 🆕 v7.7: 自定义版本号 (e.g., v7)
  } = req.query;
  
  console.log(`\n📊 [v3/report] GET /${symbol}?format=${format}&asset_type=${asset_type}`);
  console.log(`   ├─ Brand: ${brand}`);
  console.log(`   ├─ Firm: ${firm}`);
  console.log(`   ├─ Analyst: ${analyst}`);
  console.log(`   ├─ Language: ${lang}`);
  if (modelName) console.log(`   ├─ Model Name: ${modelName}`);
  if (versionNumber) console.log(`   ├─ Version: ${versionNumber}`);
  if (exchange) console.log(`   ├─ Exchange: ${exchange}`);
  if (country) console.log(`   ├─ Country: ${country}`);
  if (display_name) console.log(`   └─ Display Name: ${display_name}`);
  
  try {
    // Validate and normalize symbol
    const normalizedSymbol = symbol.toUpperCase().trim();
    
    if (!normalizedSymbol) {
      return res.status(400).json({
        ok: false,
        error: 'Symbol is required',
        message: '请提供股票代码'
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // Phase 0: Auto-detect asset type if not explicitly provided
    // ═══════════════════════════════════════════════════════════════
    const symbolMetadata = {
      exchange,
      country,
      displayName: display_name,
      asset_type
    };
    
    // Auto-classify if user didn't override via query parameter
    const detectedAssetType = classifyAssetType(
      normalizedSymbol, 
      display_name || '', 
      symbolMetadata
    );
    
    // Use user-provided asset_type if explicitly set, otherwise use detected
    const finalAssetType = (req.query.asset_type !== undefined) ? asset_type : detectedAssetType;
    
    console.log(`🔍 [v3/report] Asset type for ${normalizedSymbol}: ${finalAssetType}${detectedAssetType !== finalAssetType ? ` (detected: ${detectedAssetType}, overridden by user)` : ''}`);

    // ═══════════════════════════════════════════════════════════════
    // Phase 1: Generate ResearchReport v1 (Generic for ANY symbol)
    // ═══════════════════════════════════════════════════════════════
    console.log(`🔬 [v3/report] Building ResearchReport v1...`);
    const brandOptions = { 
      brand, 
      firm, 
      analyst, 
      language: lang,
      modelName,      // 🆕 v7.7: 自定义模型名称 (e.g., 北极光量化)
      versionNumber,  // 🆕 v7.7: 自定义版本号 (e.g., v7)
      // 🆕 v5.1: Symbol metadata for industry routing
      symbolMetadata: {
        exchange,
        country,
        displayName: display_name
      }
    };
    const report = await buildResearchReport(normalizedSymbol, finalAssetType, brandOptions);
    console.log(`✅ [v3/report] ResearchReport v1 complete (${report.meta.latency_ms}ms)`);

    // ═══════════════════════════════════════════════════════════════
    // Phase 2: Format Output (JSON | HTML | PDF | Markdown)
    // ═══════════════════════════════════════════════════════════════
    
    if (format === 'json') {
      // ─────────────────────────────────────────────────────────────
      // Format: JSON (ResearchReport v1 schema)
      // ─────────────────────────────────────────────────────────────
      console.log(`📦 [v3/report] Returning JSON format`);
      return res.json({
        ok: true,
        env: 'v3-dev',
        version: 'v1',
        ...report
      });
      
    } else if (format === 'html') {
      // ─────────────────────────────────────────────────────────────
      // Format: HTML (using buildHtmlFromReport)
      // ─────────────────────────────────────────────────────────────
      console.log(`🌐 [v3/report] Generating HTML...`);
      const html = buildHtmlFromReport(report);
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
      
    } else if (format === 'pdf') {
      // ─────────────────────────────────────────────────────────────
      // Format: PDF (HTML → DocRaptor → PDF Buffer)
      // ─────────────────────────────────────────────────────────────
      console.log(`📄 [v3/report] Generating PDF...`);
      
      try {
        // Step 1: Generate HTML from report
        const html = buildHtmlFromReport(report);
        
        // Step 2: Convert HTML to PDF via DocRaptor
        const pdfBuffer = await generatePdfWithDocRaptor(normalizedSymbol, html);
        
        console.log(`✅ [v3/report] PDF generated: ${(pdfBuffer.length / 1024).toFixed(1)} KB`);
        
        // Step 3: Send PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${normalizedSymbol}-USIS-Research.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        
        return res.send(pdfBuffer);
        
      } catch (pdfError) {
        console.error(`❌ [v3/report] PDF generation failed: ${pdfError.message}`);
        return res.status(500).json({
          ok: false,
          env: 'v3-dev',
          error: 'PDF generation failed',
          message: pdfError.message,
          symbol: normalizedSymbol,
          hint: 'Try ?format=html or ?format=json instead'
        });
      }
      
    } else if (format === 'md' || format === 'markdown') {
      // ─────────────────────────────────────────────────────────────
      // Format: Markdown (fallback to legacy function for now)
      // ─────────────────────────────────────────────────────────────
      console.log(`📝 [v3/report] Generating Markdown (legacy)...`);
      
      // TODO: Create buildMarkdownFromReport(report) for v1 schema
      // For now, use legacy function
      const legacyReport = {
        symbol: report.symbol,
        company_name: report.name,
        rating: report.rating,
        horizon: report.horizon,
        investment_summary: report.summary_text,
        thesis: [report.thesis_text],
        catalysts: [report.catalysts_text],
        risks: [report.risks_text],
        technical_view: report.tech_view_text,
        action: report.action_text,
        price_info: {
          current: report.price.last,
          change: report.price.change_abs,
          change_percent: report.price.change_pct,
          high: report.price.high_1d,
          low: report.price.low_1d,
          volume: 'N/A'
        },
        generated_at: report.meta.generated_at,
        model_used: report.meta.model,
        latency_ms: report.meta.latency_ms,
        disclaimer: '本报告基于公开市场数据生成，仅供参考，不构成投资建议。'
      };
      
      const markdown = generateMarkdownReport(normalizedSymbol, legacyReport);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `inline; filename="${normalizedSymbol}_Report_v3dev.md"`);
      return res.send(markdown);
      
    } else {
      // Invalid format
      return res.status(400).json({
        ok: false,
        error: 'Invalid format',
        message: 'Supported formats: json, html, pdf, md',
        symbol: normalizedSymbol
      });
    }

  } catch (error) {
    console.error(`❌ [v3/report] Error: ${error.message}`);
    console.error(error.stack);
    
    return res.status(500).json({
      ok: false,
      env: 'v3-dev',
      error: 'Report generation failed',
      message: error.message,
      symbol: symbol
    });
  }
});

module.exports = router;
