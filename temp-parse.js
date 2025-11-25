const fs = require('fs');
const path = require('path');

async function main() {
  const pdfParse = (await import('pdf-parse')).default;
  const pdfPath = 'attached_assets/NVDA_Aberdeen_Investments_2025-11-19_1763567733910.pdf';
  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(dataBuffer);
  console.log(data.text);
}

main().catch(console.error);
