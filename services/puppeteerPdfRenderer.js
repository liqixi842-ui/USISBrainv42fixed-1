/**
 * Puppeteer PDF Renderer
 * Uses v3_dev HTML templates + Puppeteer for watermark-free PDF generation
 * 
 * Architecture: v3_dev buildResearchReport → buildFinalInstitutionalHtml → Puppeteer PDF
 */

const puppeteer = require('puppeteer');
const { execSync } = require('child_process');

/**
 * Dynamically find Chromium executable path
 * Supports: Replit (Nix), CentOS/RHEL, Ubuntu/Debian, macOS
 * @returns {string} Path to Chromium executable
 */
function findChromiumPath() {
  // 1. Environment variable override (highest priority)
  if (process.env.CHROMIUM_PATH) {
    console.log(`📍 [Puppeteer] Using CHROMIUM_PATH env: ${process.env.CHROMIUM_PATH}`);
    return process.env.CHROMIUM_PATH;
  }
  
  const fs = require('fs');
  
  // 2. Common Chromium paths to check (in order of priority)
  const commonPaths = [
    // Linux package manager installations
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    // Snap/Flatpak installations
    '/snap/bin/chromium',
    '/var/lib/flatpak/exports/bin/org.chromium.Chromium',
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    // Replit/Nix (fallback)
    '/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium'
  ];
  
  // Check each path
  for (const chromePath of commonPaths) {
    try {
      if (fs.existsSync(chromePath)) {
        console.log(`📍 [Puppeteer] Found Chromium at: ${chromePath}`);
        return chromePath;
      }
    } catch (e) {
      // Continue checking other paths
    }
  }
  
  // 3. Try 'which' command as last resort
  try {
    const path = execSync('which chromium 2>/dev/null || which chromium-browser 2>/dev/null || which google-chrome 2>/dev/null', { encoding: 'utf-8' }).trim();
    if (path) {
      console.log(`📍 [Puppeteer] Found Chromium via which: ${path}`);
      return path;
    }
  } catch (e) {
    // Ignore errors
  }
  
  // 4. Final fallback - will likely fail but provides clear error
  console.warn(`⚠️ [Puppeteer] No Chromium found! Install with: yum install chromium OR apt install chromium-browser`);
  return '/usr/bin/chromium';
}

/**
 * Convert HTML content to PDF using Puppeteer
 * @param {string} htmlContent - Complete HTML document
 * @param {Object} options - PDF options
 * @returns {Promise<Buffer>} PDF Buffer
 */
async function htmlToPdfWithPuppeteer(htmlContent, options = {}) {
  const {
    format = 'Letter',
    printBackground = true,
    margin = { top: '0', right: '0', bottom: '0', left: '0' }
  } = options;
  
  let browser = null;
  
  try {
    console.log(`📄 [Puppeteer PDF] Launching headless browser...`);
    
    const chromiumPath = findChromiumPath();
    
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: chromiumPath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-zygote'
      ]
    });
    
    const page = await browser.newPage();
    
    await page.setContent(htmlContent, {
      waitUntil: ['load', 'networkidle0'],
      timeout: 60000
    });
    
    console.log(`📄 [Puppeteer PDF] HTML loaded, generating PDF...`);
    
    const pdfBuffer = await page.pdf({
      format: format,
      printBackground: printBackground,
      margin: margin,
      preferCSSPageSize: true
    });
    
    console.log(`✅ [Puppeteer PDF] PDF generated successfully (${(pdfBuffer.length / 1024).toFixed(2)} KB)`);
    
    return Buffer.from(pdfBuffer);
    
  } catch (error) {
    console.error(`❌ [Puppeteer PDF] Generation failed: ${error.message}`);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Generate V6 20-page institutional PDF using v3_dev templates + Puppeteer
 * @param {string} symbol - Stock symbol
 * @param {string} language - Language code
 * @param {Object} options - Generation options
 * @returns {Promise<Buffer>} PDF Buffer
 */
async function generateV6PdfWithPuppeteer(symbol, language = 'en', options = {}) {
  const {
    firmName = 'USIS Research',
    analystName = 'USIS Brain v7.7 Multi-AI System',
    assetType = 'equity'
  } = options;
  
  console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║  V6 PDF Generator (Puppeteer) - ${symbol.padEnd(30)}║`);
  console.log(`║  Firm: ${firmName.padEnd(52)}║`);
  console.log(`║  Analyst: ${analystName.substring(0, 50).padEnd(50)}║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝\n`);
  
  const startTime = Date.now();
  
  try {
    const { buildResearchReport, buildHtmlFromReport } = require('../v3_dev/services/reportService');
    
    console.log(`📊 [V6 Puppeteer] Step 1: Building research report...`);
    
    const brandOptions = {
      brand: firmName,
      firm: firmName,
      analyst: analystName,
      language: language
    };
    
    const report = await buildResearchReport(symbol, assetType, brandOptions);
    
    console.log(`✅ [V6 Puppeteer] Report built (${Date.now() - startTime}ms)`);
    console.log(`   ├─ Symbol: ${report.symbol}`);
    console.log(`   ├─ Rating: ${report.rating}`);
    console.log(`   ├─ Target: $${report.targets?.base?.price?.toFixed(2) || 'N/A'}`);
    console.log(`   └─ Sections: ${Object.keys(report).filter(k => k.endsWith('_text')).length} text sections`);
    
    console.log(`\n📄 [V6 Puppeteer] Step 2: Building 20-page HTML template...`);
    
    const htmlContent = buildHtmlFromReport(report);
    
    console.log(`✅ [V6 Puppeteer] HTML generated (${htmlContent.length} chars, ~${Math.ceil(htmlContent.length / 1024)} KB)`);
    
    console.log(`\n🖨️  [V6 Puppeteer] Step 3: Converting HTML to PDF...`);
    
    const pdfBuffer = await htmlToPdfWithPuppeteer(htmlContent, {
      format: 'Letter',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`\n✅ [V6 Puppeteer] Complete!`);
    console.log(`   ├─ PDF Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`   ├─ Duration: ${duration}ms`);
    console.log(`   └─ Pages: 20 (fixed institutional template)\n`);
    
    return pdfBuffer;
    
  } catch (error) {
    console.error(`\n❌ [V6 Puppeteer] Generation failed`);
    console.error(`   ├─ Symbol: ${symbol}`);
    console.error(`   ├─ Error: ${error.message}`);
    console.error(`   └─ Stack: ${error.stack?.substring(0, 300)}...\n`);
    throw error;
  }
}

/**
 * Generate PDF from existing report object (bypass data fetch)
 * @param {Object} report - Pre-built report object from buildResearchReport
 * @returns {Promise<Buffer>} PDF Buffer
 */
async function generatePdfFromReport(report) {
  try {
    console.log(`📄 [V6 Puppeteer] Generating PDF from existing report...`);
    
    const { buildHtmlFromReport } = require('../v3_dev/services/reportService');
    
    const htmlContent = buildHtmlFromReport(report);
    
    const pdfBuffer = await htmlToPdfWithPuppeteer(htmlContent, {
      format: 'Letter',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });
    
    console.log(`✅ [V6 Puppeteer] PDF from report complete (${(pdfBuffer.length / 1024).toFixed(2)} KB)`);
    
    return pdfBuffer;
    
  } catch (error) {
    console.error(`❌ [V6 Puppeteer] PDF from report failed: ${error.message}`);
    throw error;
  }
}

module.exports = {
  htmlToPdfWithPuppeteer,
  generateV6PdfWithPuppeteer,
  generatePdfFromReport
};
