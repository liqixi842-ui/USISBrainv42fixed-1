/**
 * v3-dev Research Report Service v1 (Test Version)
 * 只在开发环境使用，不影响 v2-stable
 */

const fetch = require('node-fetch');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// 中文字体路径
const FONT_REGULAR = path.join(__dirname, '../../fonts/NotoSansCJK-Regular.otf');
const FONT_BOLD = path.join(__dirname, '../../fonts/NotoSansCJK-Bold.otf');

/**
 * 构建简易研报
 * @param {string} symbol - 股票代码
 * @param {object} basicData - 基础数据（报价等）
 * @returns {Promise<object>} 研报对象
 */
async function buildSimpleReport(symbol, basicData = {}) {
  console.log(`📊 [v3-dev Report Service] 开始生成研报: ${symbol}`);
  
  const startTime = Date.now();
  
  try {
    // 准备数据上下文
    const price = basicData.price || basicData.c || 'N/A';
    const change = basicData.change || basicData.d || 'N/A';
    const changePercent = basicData.changePercent || basicData.dp || 'N/A';
    const high = basicData.high || basicData.h || 'N/A';
    const low = basicData.low || basicData.l || 'N/A';
    const volume = basicData.volume || basicData.v || 'N/A';
    
    // 构建 AI prompt
    const systemPrompt = `你是一位专业的股票分析师。请基于提供的市场数据，生成一份简明的股票研究报告。

要求：
1. 评级只能是：STRONG_BUY（强烈买入）、BUY（买入）、HOLD（持有）、SELL（卖出）、STRONG_SELL（强烈卖出）之一
2. 时间范围：短期（1-3月）、中期（3-12月）、长期（1年以上）
3. 简明扼要，不要过度解读
4. 明确标注这是基于有限数据的初步分析
5. 必须用中文回复

返回格式（纯JSON，不要markdown代码块）：
{
  "rating": "评级",
  "horizon": "时间范围",
  "summary": "核心观点（50-100字）",
  "drivers": ["驱动因素1", "驱动因素2", "驱动因素3"],
  "risks": ["风险点1", "风险点2"],
  "technical_view": "技术面简评（30-50字）"
}`;

    const userPrompt = `请分析以下股票：

股票代码：${symbol.toUpperCase()}
当前价格：${price}
涨跌幅：${changePercent}%
涨跌额：${change}
最高价：${high}
最低价：${low}
成交量：${volume}

请基于以上数据生成研报JSON。`;

    // 调用 GPT-4o-mini（轻量快速）
    console.log(`🤖 [v3-dev Report] 调用 AI: gpt-4o-mini`);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 1000,
        temperature: 0.7
      }),
      timeout: 15000 // 15秒超时
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiContent = data.choices?.[0]?.message?.content;
    
    if (!aiContent) {
      throw new Error('AI 返回空内容');
    }

    // 解析 AI 返回的 JSON
    let reportData;
    try {
      // 移除可能的 markdown 代码块标记
      const cleanContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      reportData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.warn(`⚠️  [v3-dev Report] AI返回非JSON格式，使用fallback`);
      // Fallback: 基于价格变化的简单判断
      reportData = generateFallbackReport(symbol, basicData, startTime);
    }

    const elapsed = Date.now() - startTime;
    console.log(`✅ [v3-dev Report] 研报生成完成 (${elapsed}ms)`);

    // 构建最终报告结构
    return {
      title: `${symbol.toUpperCase()} 研究报告（测试版）`,
      symbol: symbol.toUpperCase(),
      rating: reportData.rating || 'HOLD',
      horizon: reportData.horizon || '中期',
      summary: reportData.summary || '数据不足，建议谨慎观察。',
      drivers: reportData.drivers || ['市场波动', '行业趋势'],
      risks: reportData.risks || ['市场风险', '数据有限'],
      technical_view: reportData.technical_view || '技术面中性',
      price_info: {
        current: price,
        change: change,
        change_percent: changePercent,
        high: high,
        low: low,
        volume: volume
      },
      generated_at: new Date().toISOString(),
      model_used: 'gpt-4o-mini',
      latency_ms: elapsed,
      disclaimer: '⚠️ 本报告为 v3-dev 测试版本，基于有限数据生成，仅供参考，不构成投资建议。'
    };

  } catch (error) {
    console.error(`❌ [v3-dev Report] 生成失败:`, error.message);
    
    // 完全失败时的 fallback
    return generateFallbackReport(symbol, basicData, startTime);
  }
}

/**
 * Fallback 报告生成（不调用 AI）
 */
function generateFallbackReport(symbol, basicData, startTime = Date.now()) {
  const price = basicData.price || basicData.c || 'N/A';
  const changePercent = basicData.changePercent || basicData.dp || 0;
  
  // 简单的评级逻辑
  let rating = 'HOLD';
  if (changePercent > 5) rating = 'BUY';
  else if (changePercent > 10) rating = 'STRONG_BUY';
  else if (changePercent < -5) rating = 'SELL';
  else if (changePercent < -10) rating = 'STRONG_SELL';

  const elapsed = Date.now() - startTime;

  return {
    title: `${symbol.toUpperCase()} 研究报告（简化版）`,
    symbol: symbol.toUpperCase(),
    rating: rating,
    horizon: '短期',
    summary: `${symbol.toUpperCase()} 当前价格 ${price}，涨跌幅 ${changePercent}%。建议根据市场情况谨慎操作。`,
    drivers: ['市场整体走势', '板块轮动', '资金流向'],
    risks: ['市场波动风险', '政策不确定性', '数据时效性'],
    technical_view: '基于当前价格走势的初步判断，建议关注成交量变化。',
    price_info: {
      current: price,
      change: basicData.change || basicData.d || 'N/A',
      change_percent: changePercent,
      high: basicData.high || basicData.h || 'N/A',
      low: basicData.low || basicData.l || 'N/A',
      volume: basicData.volume || basicData.v || 'N/A'
    },
    generated_at: new Date().toISOString(),
    model_used: 'fallback',
    latency_ms: elapsed,
    disclaimer: '⚠️ 本报告为测试版本，数据有限，仅供参考。'
  };
}

/**
 * 生成 PDF 格式研报
 * @param {object} report - 研报对象
 * @returns {Promise<Buffer>} PDF Buffer
 */
async function generatePDF(report) {
  return new Promise((resolve, reject) => {
    try {
      // 验证字体文件存在
      if (!fs.existsSync(FONT_REGULAR)) {
        throw new Error(`字体文件不存在: ${FONT_REGULAR}`);
      }
      if (!fs.existsSync(FONT_BOLD)) {
        throw new Error(`字体文件不存在: ${FONT_BOLD}`);
      }

      console.log(`📄 [v3-dev PDF] 开始生成 PDF: ${report.symbol}`);

      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        bufferPages: true
      });

      // 注册中文字体（关键：解决乱码）
      doc.registerFont('Regular', FONT_REGULAR);
      doc.registerFont('Bold', FONT_BOLD);

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        console.log(`✅ [v3-dev PDF] PDF 生成完成: ${pdfBuffer.length} bytes`);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      // 页面宽度
      const pageWidth = doc.page.width - 100;
      let y = 50;

      // ========== 标题部分 ==========
      doc.font('Bold').fontSize(24).fillColor('#4F46E5');
      doc.text('USIS·研究报告', 50, y, { align: 'center' });
      y += 35;

      doc.font('Bold').fontSize(20).fillColor('#1F2937');
      doc.text(String(report.symbol), 50, y, { align: 'center' });
      y += 30;

      // 评级徽章
      const ratingColors = {
        'STRONG_BUY': '#10B981',
        'BUY': '#34D399',
        'HOLD': '#FBBF24',
        'SELL': '#F87171',
        'STRONG_SELL': '#EF4444'
      };
      const ratingColor = ratingColors[report.rating] || '#6B7280';
      
      doc.fontSize(16).fillColor(ratingColor).font('Bold');
      doc.text(`评级: ${report.rating}`, 50, y, { align: 'center' });
      y += 25;

      doc.fontSize(12).fillColor('#6B7280').font('Regular');
      doc.text(`时间范围: ${report.horizon}`, 50, y, { align: 'center' });
      y += 40;

      // 分隔线
      doc.moveTo(50, y).lineTo(doc.page.width - 50, y).stroke('#E5E7EB');
      y += 25;

      // ========== 价格信息 ==========
      doc.font('Bold').fontSize(14).fillColor('#4F46E5');
      doc.text('[价格信息]', 50, y);
      y += 20;

      doc.font('Regular').fontSize(11).fillColor('#1F2937');
      const priceInfo = [
        `当前价: ${report.price_info.current}`,
        `涨跌: ${report.price_info.change} (${report.price_info.change_percent}%)`,
        `最高: ${report.price_info.high}`,
        `最低: ${report.price_info.low}`,
        `成交量: ${report.price_info.volume}`
      ];
      
      priceInfo.forEach(info => {
        doc.text(String(info), 70, y);
        y += 18;
      });
      y += 10;

      // ========== 核心观点 ==========
      doc.font('Bold').fontSize(14).fillColor('#4F46E5');
      doc.text('[核心观点]', 50, y);
      y += 20;

      doc.font('Regular').fontSize(11).fillColor('#1F2937');
      const summaryLines = doc.heightOfString(String(report.summary), {
        width: pageWidth,
        align: 'left'
      });
      
      doc.text(String(report.summary), 70, y, {
        width: pageWidth - 20,
        align: 'left'
      });
      y += summaryLines + 15;

      // ========== 驱动因素 ==========
      doc.font('Bold').fontSize(14).fillColor('#4F46E5');
      doc.text('[驱动因素]', 50, y);
      y += 20;

      doc.font('Regular').fontSize(11).fillColor('#1F2937');
      if (report.drivers && report.drivers.length > 0) {
        report.drivers.forEach((driver, index) => {
          const text = `${index + 1}. ${String(driver)}`;
          const height = doc.heightOfString(text, { width: pageWidth - 20 });
          doc.text(text, 70, y, { width: pageWidth - 20 });
          y += height + 8;
        });
      }
      y += 10;

      // ========== 风险提示 ==========
      doc.font('Bold').fontSize(14).fillColor('#4F46E5');
      doc.text('[风险提示]', 50, y);
      y += 20;

      doc.font('Regular').fontSize(11).fillColor('#1F2937');
      if (report.risks && report.risks.length > 0) {
        report.risks.forEach((risk, index) => {
          const text = `${index + 1}. ${String(risk)}`;
          const height = doc.heightOfString(text, { width: pageWidth - 20 });
          doc.text(text, 70, y, { width: pageWidth - 20 });
          y += height + 8;
        });
      }
      y += 10;

      // ========== 技术面分析 ==========
      doc.font('Bold').fontSize(14).fillColor('#4F46E5');
      doc.text('[技术面分析]', 50, y);
      y += 20;

      doc.font('Regular').fontSize(11).fillColor('#1F2937');
      const technicalHeight = doc.heightOfString(String(report.technical_view), {
        width: pageWidth - 20
      });
      doc.text(String(report.technical_view), 70, y, {
        width: pageWidth - 20
      });
      y += technicalHeight + 20;

      // ========== 元信息 ==========
      y += 20;
      doc.fontSize(10).fillColor('#6B7280').font('Regular');
      doc.text(`AI 模型: ${report.model_used}`, 50, y);
      y += 15;
      doc.text(`生成时间: ${report.latency_ms}ms`, 50, y);
      y += 15;
      doc.text(`生成于: ${new Date(report.generated_at).toLocaleString('zh-CN')}`, 50, y);
      y += 15;
      doc.text('环境: v3-dev (测试版)', 50, y);
      y += 25;

      // ========== 免责声明 ==========
      doc.rect(50, y, pageWidth, 60).fillAndStroke('#FEF3C7', '#F59E0B');
      y += 10;
      doc.fillColor('#92400E').fontSize(9).font('Regular');
      doc.text('[免责声明]', 60, y);
      y += 15;
      doc.text(String(report.disclaimer), 60, y, {
        width: pageWidth - 20
      });

      // 结束文档
      doc.end();

    } catch (error) {
      console.error(`❌ [v3-dev PDF] 生成失败:`, error.message);
      reject(error);
    }
  });
}

module.exports = {
  buildSimpleReport,
  generatePDF
};
