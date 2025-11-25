const express = require('express');
const router = express.Router();
const { generateHybridReport } = require('../deepHybridReportController');
const { renderHybridReportPDF } = require('../deepHybridReportRenderer');

router.post('/run', async (req, res) => {
  try {
    const { symbol, options } = req.body;

    if (!symbol) {
      return res.status(400).json({ ok: false, error: 'Missing required field: symbol' });
    }

    const reportData = await generateHybridReport(symbol, options || {});
    const pdfBuffer = await renderHybridReportPDF(reportData);
    const pdfBase64 = pdfBuffer.toString('base64');

    return res.json({
      ok: true,
      pdfBase64,
      symbol: reportData.symbol,
      date: reportData.date,
      duration: reportData.duration,
      moduleCount: reportData.modules.length
    });

  } catch (error) {
    console.error('[DeepReportRoute] Error:', error.message);
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

router.get('/health', (req, res) => {
  res.json({ ok: true, service: 'deep-report', version: 'v7.0-hybrid' });
});

module.exports = router;
