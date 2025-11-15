const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const FONT_REGULAR = path.join(__dirname, "fonts", "NotoSansCJK-Regular.otf");
const FONT_BOLD = path.join(__dirname, "fonts", "NotoSansCJK-Bold.otf");

function main() {
  console.log("🔍 检查字体文件...");
  console.log(`Regular: ${FONT_REGULAR}`);
  console.log(`  存在: ${fs.existsSync(FONT_REGULAR)}`);
  if (fs.existsSync(FONT_REGULAR)) {
    const stats = fs.statSync(FONT_REGULAR);
    console.log(`  大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  }
  
  console.log(`Bold: ${FONT_BOLD}`);
  console.log(`  存在: ${fs.existsSync(FONT_BOLD)}`);
  if (fs.existsSync(FONT_BOLD)) {
    const stats = fs.statSync(FONT_BOLD);
    console.log(`  大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  }

  console.log("\n📄 开始生成 PDF...");
  
  const doc = new PDFDocument({ size: "A4" });
  const outPath = path.join(__dirname, "tmp_test_pdf.pdf");
  const stream = fs.createWriteStream(outPath);

  doc.pipe(stream);

  // 注册中文字体
  doc.registerFont("Regular", FONT_REGULAR);
  doc.registerFont("Bold", FONT_BOLD);

  // 标题
  doc.font("Bold").fontSize(20).text("USIS 研报 PDF 中文测试", { align: "center" });
  doc.moveDown();
  
  // 正文
  doc.font("Regular").fontSize(12);

  const lines = [
    "标的：NVIDIA Corp (NVDA)",
    "测试句子：这是 USIS v3-dev 的中文 PDF 渲染测试。",
    "技术指标示例：RSI(14) = 49.42，MACD = 1.70，EMA(20) = 191.96。",
    "结论：如果你在生成的 PDF 里看到的这些中文是正常可读的，说明字体配置是正确的。",
    "",
    "英文测试：This is an English sentence.",
    "数字测试：1234567890",
    "符号测试：@#$%^&*()_+-=[]{}|;':\",./<>?",
    "",
    "混合测试：Apple (AAPL) 股价 $175.50，上涨 2.3%。",
    "长段落测试：根据最新财报，苹果公司第四季度营收达到 899 亿美元，同比增长 6%。iPhone 业务仍然是公司的主要收入来源，占总营收的 52%。服务业务表现强劲，同比增长 16%，显示出良好的增长潜力。"
  ];

  for (const line of lines) {
    doc.text(String(line));
    doc.moveDown(0.5);
  }

  doc.end();

  stream.on("finish", () => {
    const stats = fs.statSync(outPath);
    console.log(`✅ tmp_test_pdf.pdf 生成成功`);
    console.log(`   路径: ${outPath}`);
    console.log(`   大小: ${(stats.size / 1024).toFixed(2)} KB`);
  });

  stream.on("error", (err) => {
    console.error("❌ PDF 生成失败:", err);
  });
}

main();
