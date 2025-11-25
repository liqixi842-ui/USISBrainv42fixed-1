const PDFDocument = require('pdfkit');
const fetch = require('node-fetch');

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

const COLORS = {
  primary: '#1a2332',
  accent: '#3498db',
  success: '#27ae60',
  warning: '#f39c12',
  danger: '#e74c3c',
  text: '#2c3e50',
  textLight: '#7f8c8d',
  border: '#bdc3c7',
  background: '#ecf0f1',
  white: '#ffffff'
};

const PDF_SECTION_MODULES = ['cover', 'rating_conclusion'];

async function fetchImageAsBuffer(url) {
  try {
    const response = await fetch(url, { timeout: 15000 });
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (e) {
    return null;
  }
}

function extractImageUrls(html) {
  const urls = [];
  const regex = /<img[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

function parseTableFromHTML(html) {
  const tables = [];
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch;
  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableContent = tableMatch[1];
    const rows = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
      const cells = [];
      const cellRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
        const cellText = cellMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
        cells.push(cellText);
      }
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length > 0) tables.push(rows);
  }
  return tables;
}

function parseListsFromHTML(html) {
  const items = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let match;
  while ((match = liRegex.exec(html)) !== null) {
    const text = match[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (text) items.push(text);
  }
  return items;
}

function parseHeadingsFromHTML(html) {
  const headings = [];
  const hRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match;
  while ((match = hRegex.exec(html)) !== null) {
    const level = parseInt(match[1]);
    const text = match[2].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (text) headings.push({ level, text });
  }
  return headings;
}

function parseParagraphsFromHTML(html) {
  const paragraphs = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let match;
  while ((match = pRegex.exec(html)) !== null) {
    let text = match[1].replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '$1');
    text = text.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (text) paragraphs.push(text);
  }
  return paragraphs;
}

function stripHTML(html) {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
}

function checkPageBreak(doc, neededHeight) {
  if (doc.y + neededHeight > PAGE_HEIGHT - MARGIN - 50) {
    doc.addPage();
    return true;
  }
  return false;
}

function renderTable(doc, rows, options = {}) {
  if (!rows || rows.length === 0) return;
  const colCount = Math.max(...rows.map(r => r.length));
  const colWidth = (CONTENT_WIDTH - 20) / colCount;
  const cellPadding = 8;
  const fontSize = options.fontSize || 9;
  const headerBg = options.headerBg || COLORS.accent;

  rows.forEach((row, rowIndex) => {
    const rowHeight = fontSize + cellPadding * 2;
    checkPageBreak(doc, rowHeight + 10);
    const startX = MARGIN + 10;
    const startY = doc.y;

    if (rowIndex === 0) {
      doc.rect(startX, startY, CONTENT_WIDTH - 20, rowHeight).fill(headerBg);
      doc.fillColor(COLORS.white);
    } else if (rowIndex % 2 === 0) {
      doc.rect(startX, startY, CONTENT_WIDTH - 20, rowHeight).fill('#f8f9fa');
      doc.fillColor(COLORS.text);
    } else {
      doc.fillColor(COLORS.text);
    }

    row.forEach((cell, colIndex) => {
      const x = startX + colIndex * colWidth + cellPadding;
      const y = startY + cellPadding;
      doc.fontSize(fontSize).text(cell || '', x, y, { width: colWidth - cellPadding * 2, align: 'left', lineBreak: false });
    });

    doc.rect(startX, startY, CONTENT_WIDTH - 20, rowHeight).stroke(COLORS.border);
    doc.y = startY + rowHeight;
  });

  doc.y += 15;
  doc.fillColor(COLORS.text);
}

function renderHeading(doc, text, level) {
  const sizes = { 1: 24, 2: 18, 3: 14, 4: 12, 5: 11, 6: 10 };
  const fontSize = sizes[level] || 12;
  checkPageBreak(doc, fontSize + 30);

  if (level <= 2) {
    doc.moveDown(0.5);
    doc.fontSize(fontSize).font('Helvetica-Bold').fillColor(COLORS.primary).text(text, MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.moveTo(MARGIN, doc.y + 5).lineTo(MARGIN + CONTENT_WIDTH, doc.y + 5).strokeColor(COLORS.accent).lineWidth(level === 1 ? 3 : 2).stroke();
    doc.y += 15;
  } else {
    doc.fontSize(fontSize).font('Helvetica-Bold').fillColor(COLORS.text).text(text, MARGIN, doc.y, { width: CONTENT_WIDTH });
  }

  doc.font('Helvetica').moveDown(0.3);
}

function renderParagraph(doc, text) {
  checkPageBreak(doc, 50);
  doc.fontSize(10).font('Helvetica').fillColor(COLORS.text).text(text, MARGIN, doc.y, { width: CONTENT_WIDTH, align: 'justify', lineGap: 3 });
  doc.moveDown(0.5);
}

function renderList(doc, items) {
  items.forEach(item => {
    checkPageBreak(doc, 20);
    doc.fontSize(10).font('Helvetica').fillColor(COLORS.text).text(`• ${item}`, MARGIN + 15, doc.y, { width: CONTENT_WIDTH - 15, lineGap: 2 });
    doc.moveDown(0.3);
  });
  doc.moveDown(0.3);
}

function renderHighlightBox(doc, content, type = 'info') {
  const bgColors = { info: '#e8f4f8', warning: '#fff3cd', danger: '#f8d7da' };
  const borderColors = { info: COLORS.accent, warning: COLORS.warning, danger: COLORS.danger };
  const boxHeight = Math.max(60, content.length * 0.5 + 40);
  checkPageBreak(doc, boxHeight + 20);

  const startY = doc.y;
  doc.rect(MARGIN, startY, CONTENT_WIDTH, boxHeight).fill(bgColors[type] || bgColors.info);
  doc.rect(MARGIN, startY, 5, boxHeight).fill(borderColors[type] || borderColors.info);
  doc.fontSize(10).font('Helvetica').fillColor(COLORS.text).text(content, MARGIN + 15, startY + 15, { width: CONTENT_WIDTH - 30, lineGap: 3 });
  doc.y = startY + boxHeight + 10;
}

async function renderImage(doc, imageUrl) {
  if (!imageUrl) return;
  const buffer = await fetchImageAsBuffer(imageUrl);
  if (!buffer) return;
  checkPageBreak(doc, 280);
  try {
    doc.image(buffer, MARGIN + 20, doc.y, { width: CONTENT_WIDTH - 40, align: 'center' });
    doc.y += 220;
    doc.moveDown(0.5);
  } catch (e) {}
}

function renderCover(doc, module) {
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(COLORS.primary);

  doc.fontSize(14).font('Helvetica-Bold').fillColor(COLORS.accent).text('USIS INSTITUTIONAL RESEARCH', MARGIN, 100, { align: 'left' });
  doc.moveTo(MARGIN, 130).lineTo(PAGE_WIDTH - MARGIN, 130).strokeColor(COLORS.accent).lineWidth(2).stroke();

  const symbol = module.data?.symbol || 'N/A';
  doc.fontSize(56).font('Helvetica-Bold').fillColor(COLORS.white).text(symbol, MARGIN, 180, { align: 'left' });

  const companyName = module.data?.profile?.name || 'Equity Research Report';
  doc.fontSize(24).font('Helvetica').fillColor('#94a3b8').text(companyName, MARGIN, 260, { width: CONTENT_WIDTH });

  doc.fontSize(14).font('Helvetica-Bold').fillColor(COLORS.accent).text('HYBRID ANALYSIS REPORT', MARGIN, 320, { align: 'left' });

  const price = module.data?.quote?.c ? `$${module.data.quote.c}` : 'N/A';
  const change = module.data?.quote?.dp ? `(${module.data.quote.dp > 0 ? '+' : ''}${module.data.quote.dp.toFixed(2)}%)` : '';
  doc.fontSize(18).font('Helvetica').fillColor(COLORS.white).text(`Current Price: ${price} ${change}`, MARGIN, 380, { align: 'left' });

  if (module.ai?.content || module.ai?.coreView) {
    const coreView = module.ai.content || module.ai.coreView;
    doc.fontSize(12).font('Helvetica').fillColor('#94a3b8').text('Core View:', MARGIN, 450, { align: 'left' });
    doc.rect(MARGIN, 470, CONTENT_WIDTH, 60).fill('#2a3a4a');
    doc.fontSize(11).font('Helvetica').fillColor(COLORS.white).text(coreView, MARGIN + 15, 485, { width: CONTENT_WIDTH - 30 });
  }

  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.fontSize(12).font('Helvetica').fillColor('#64748b').text(date, MARGIN, PAGE_HEIGHT - 150, { align: 'left' });
  doc.fontSize(9).fillColor('#475569').text('This report is generated by USIS Brain v7.0 Hybrid AI Research System.\nFor institutional use only.', MARGIN, PAGE_HEIGHT - 120, { width: CONTENT_WIDTH });
  doc.moveTo(MARGIN, PAGE_HEIGHT - 50).lineTo(PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 50).strokeColor(COLORS.accent).lineWidth(1).stroke();

  doc.addPage();
}

function renderRatingConclusion(doc, module) {
  doc.addPage();
  doc.rect(0, 0, PAGE_WIDTH, 120).fill(COLORS.primary);
  doc.fontSize(28).font('Helvetica-Bold').fillColor(COLORS.white).text('Investment Rating & Conclusion', MARGIN, 45, { align: 'center', width: CONTENT_WIDTH });

  const ratingCode = module.ai?.ratingCode || 'HOLD';
  const ratingColors = { BUY: COLORS.success, SELL: COLORS.danger, HOLD: COLORS.warning };
  const ratingColor = ratingColors[ratingCode] || COLORS.warning;

  doc.y = 150;
  doc.rect(PAGE_WIDTH / 2 - 80, doc.y, 160, 60).fill(ratingColor);
  doc.fontSize(32).font('Helvetica-Bold').fillColor(COLORS.white).text(ratingCode, PAGE_WIDTH / 2 - 80, doc.y + 15, { width: 160, align: 'center' });
  doc.y += 80;

  if (module.ai?.shortTermView) {
    renderHeading(doc, 'Short-Term View', 3);
    renderParagraph(doc, module.ai.shortTermView);
  }

  if (module.ai?.supportLevel || module.ai?.resistanceLevel) {
    renderHeading(doc, 'Key Levels', 3);
    renderParagraph(doc, `Support: $${module.ai.supportLevel || 'N/A'} | Resistance: $${module.ai.resistanceLevel || 'N/A'}`);
  }

  if (module.ai?.breakoutTrigger) {
    renderHeading(doc, 'Breakout Trigger', 3);
    renderParagraph(doc, module.ai.breakoutTrigger);
  }

  if (module.ai?.suggestion) {
    renderHeading(doc, 'Investment Suggestion', 3);
    renderHighlightBox(doc, module.ai.suggestion, 'info');
  }

  if (module.ai?.investmentSummary) {
    renderHeading(doc, 'Investment Summary', 3);
    renderParagraph(doc, module.ai.investmentSummary);
  }
}

async function renderGenericModule(doc, module) {
  const html = module.html || '';
  const headings = parseHeadingsFromHTML(html);
  const tables = parseTableFromHTML(html);
  const lists = parseListsFromHTML(html);
  const paragraphs = parseParagraphsFromHTML(html);
  const imageUrls = extractImageUrls(html);

  for (const heading of headings) {
    renderHeading(doc, heading.text, heading.level);
  }

  for (const para of paragraphs) {
    if (para.includes('：') || para.includes(':')) {
      const parts = para.split(/[：:]/);
      if (parts.length === 2 && parts[0].length < 20) {
        doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.text).text(parts[0] + ':', MARGIN, doc.y, { continued: true });
        doc.font('Helvetica').text(' ' + parts[1], { width: CONTENT_WIDTH });
        doc.moveDown(0.3);
        continue;
      }
    }
    renderParagraph(doc, para);
  }

  if (lists.length > 0) {
    renderList(doc, lists);
  }

  for (const table of tables) {
    renderTable(doc, table);
  }

  for (const url of imageUrls) {
    await renderImage(doc, url);
  }

  doc.moveDown(1);
}

async function renderHybridReportPDF(reportData) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        info: {
          Title: `${reportData.symbol} - USIS Hybrid Research Report`,
          Author: 'USIS Brain v7.0 Hybrid AI System',
          Subject: `Institutional research report for ${reportData.symbol}`,
          Keywords: 'research, equity, analysis, institutional, hybrid',
          CreationDate: new Date()
        }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const modules = reportData.modules || [];

      for (const module of modules) {
        if (module.name === 'cover') {
          renderCover(doc, module);
        } else if (module.name === 'rating_conclusion') {
          renderRatingConclusion(doc, module);
        } else if (module.name === 'disclaimer') {
          checkPageBreak(doc, 150);
          doc.rect(MARGIN, doc.y, CONTENT_WIDTH, 120).fill(COLORS.background).stroke(COLORS.border);
          doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.text).text('Disclaimer', MARGIN + 15, doc.y + 15);
          doc.fontSize(9).font('Helvetica').fillColor(COLORS.textLight).text(
            'This report is generated by USIS Brain v7.0 Hybrid AI Research System for informational purposes only. ' +
            'It does not constitute investment advice. Investing involves risk. Past performance is not indicative of future results. ' +
            'Please consult a qualified financial advisor before making investment decisions.',
            MARGIN + 15, doc.y + 35, { width: CONTENT_WIDTH - 30, lineGap: 2 }
          );
          doc.fontSize(8).text(`Report Date: ${reportData.date} | Version: v7.0-Hybrid | Sources: Finnhub, Twelve Data, Alpha Vantage`, MARGIN + 15, doc.y + 85, { width: CONTENT_WIDTH - 30 });
        } else {
          await renderGenericModule(doc, module);
        }
      }

      const range = doc.bufferedPageRange();

      for (let i = range.start; i < range.start + range.count; i++) {
        try {
          doc.switchToPage(i);
        } catch (e) {
          continue;
        }

        if (i > range.start) {
          doc.fontSize(8).font('Helvetica').fillColor(COLORS.textLight).text(
            `USIS Institutional Research | ${reportData.symbol} | Page ${i - range.start + 1} of ${range.count}`,
            MARGIN, 20, { width: CONTENT_WIDTH, align: 'center' }
          );

          doc.moveTo(MARGIN, 32)
             .lineTo(PAGE_WIDTH - MARGIN, 32)
             .strokeColor('#e2e8f0')
             .lineWidth(0.5)
             .stroke();
        }
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  renderHybridReportPDF
};
