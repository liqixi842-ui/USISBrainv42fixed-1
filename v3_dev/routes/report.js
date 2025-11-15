/**
 * v3-dev Research Report Routes
 * HTTP endpoints for research report feature (v1 test version)
 */

const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const { buildSimpleReport, generateHTMLReport, generateMarkdownReport } = require('../services/reportService');

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
 * 根据股票代码生成研报
 * 支持 ?format=json|html|md|pdf 参数
 */
router.get('/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const { format = 'json' } = req.query;
  
  console.log(`📊 [v3-dev] GET /v3/report/${symbol}?format=${format}`);
  
  try {
    // 标准化股票代码
    const normalizedSymbol = symbol.toUpperCase().trim();
    
    if (!normalizedSymbol) {
      return res.status(400).json({
        ok: false,
        error: 'Symbol is required',
        message: '请提供股票代码'
      });
    }

    // 获取市场数据
    let basicData = {};
    
    if (fetchMarketData) {
      try {
        console.log(`📡 [v3-dev Report] 获取市场数据: ${normalizedSymbol}`);
        const marketData = await fetchMarketData([normalizedSymbol], ['quote']);
        
        if (marketData.quotes && marketData.quotes[normalizedSymbol]) {
          basicData = marketData.quotes[normalizedSymbol];
          console.log(`✅ [v3-dev Report] 数据获取成功`);
        } else {
          console.warn(`⚠️  [v3-dev Report] 未找到 ${normalizedSymbol} 的行情数据`);
        }
      } catch (dataError) {
        console.warn(`⚠️  [v3-dev Report] 数据获取失败:`, dataError.message);
        // 使用 mock 数据继续
        basicData = {
          c: 175.50,
          d: 2.30,
          dp: 1.33,
          h: 176.20,
          l: 173.80,
          v: 52000000
        };
      }
    } else {
      // 无 dataBroker，使用 mock 数据
      console.log(`📋 [v3-dev Report] 使用 mock 数据`);
      basicData = {
        c: 175.50,
        d: 2.30,
        dp: 1.33,
        h: 176.20,
        l: 173.80,
        v: 52000000
      };
    }

    // 生成研报
    const report = await buildSimpleReport(normalizedSymbol, basicData);

    // ========== 根据格式返回不同内容 ==========
    
    if (format === 'html') {
      // 返回 HTML 格式
      console.log(`🌐 [v3-dev] 返回 HTML 格式: ${normalizedSymbol}`);
      const html = generateHTMLReport(normalizedSymbol, report);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
      
    } else if (format === 'md' || format === 'markdown') {
      // 返回 Markdown 格式
      console.log(`📝 [v3-dev] 返回 Markdown 格式: ${normalizedSymbol}`);
      const markdown = generateMarkdownReport(normalizedSymbol, report);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `inline; filename="${normalizedSymbol}_Report_v3dev.md"`);
      res.send(markdown);
      
    } else if (format === 'pdf') {
      // 调用外部 PDF 生成服务
      console.log(`📄 [v3-dev] 请求 PDF 格式: ${normalizedSymbol}`);
      
      // 快速检查：PDF_SERVICE_URL 是否配置
      const pdfServiceUrl = process.env.PDF_SERVICE_URL;
      
      if (!pdfServiceUrl) {
        console.warn(`⚠️  [v3-dev PDF] PDF_SERVICE_URL 未配置，返回 503`);
        return res.status(503).json({
          ok: false,
          env: 'v3-dev',
          error: 'PDF service not configured',
          message: 'PDF_SERVICE_URL environment variable is not set',
          symbol: normalizedSymbol,
          hint: 'Try ?format=html or ?format=md instead'
        });
      }
      
      try {
        // 先生成 HTML
        const html = generateHTMLReport(normalizedSymbol, report);
        
        // 调用外部 PDF 服务 (快速超时)
        console.log(`🌐 [v3-dev PDF] 调用外部服务: ${pdfServiceUrl}`);
        
        const pdfResponse = await fetch(pdfServiceUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            html: html,
            symbol: normalizedSymbol,
            title: `${normalizedSymbol} Research Report`,
            locale: 'zh-CN'
          }),
          timeout: 10000 // 10秒快速超时
        });
        
        if (!pdfResponse.ok) {
          throw new Error(`PDF service responded with ${pdfResponse.status}`);
        }
        
        // 获取 PDF 二进制
        const pdfBuffer = await pdfResponse.buffer();
        console.log(`✅ [v3-dev PDF] 外部服务返回 PDF: ${pdfBuffer.length} bytes`);
        
        // 设置响应头
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${normalizedSymbol}_Report_v3dev.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        
        // 发送 PDF
        res.send(pdfBuffer);
        
      } catch (pdfError) {
        console.error(`❌ [v3-dev PDF] 外部服务失败:`, pdfError.message);
        return res.status(503).json({
          ok: false,
          env: 'v3-dev',
          error: 'External PDF service unavailable',
          message: pdfError.message,
          symbol: normalizedSymbol,
          hint: 'Try ?format=html or ?format=md instead'
        });
      }
      
    } else {
      // 默认：返回 JSON 格式
      res.json({
        ok: true,
        env: 'v3-dev',
        version: '1.0-test',
        symbol: normalizedSymbol,
        generated_at: new Date().toISOString(),
        report: report
      });
    }

  } catch (error) {
    console.error(`❌ [v3-dev Report] 生成研报失败:`, error.message);
    
    res.status(500).json({
      ok: false,
      env: 'v3-dev',
      error: 'Report generation failed',
      message: error.message,
      symbol: symbol
    });
  }
});

module.exports = router;
