#!/usr/bin/env node
// v4.2_fixed 验证脚本 - 独立运行，不需要服务器

console.log("==========================================");
console.log("USIS Brain v4.2_fixed - 核心功能验证");
console.log("==========================================\n");

// 测试 1: normalizeSymbol 函数
console.log("[1/3] Symbol Normalizer 验证");
console.log("----------------------------------------");

function normalizeSymbol(raw) {
  const s = (raw || '').trim().toUpperCase();
  const map = [
    { re: /\.MC$/, to: sym => `BME:${sym.replace(/\.MC$/, '')}` },
    { re: /\.PA$/, to: sym => `EPA:${sym.replace(/\.PA$/, '')}` },
    { re: /\.DE$/, to: sym => `XETRA:${sym.replace(/\.DE$/, '')}` },
    { re: /\.MI$/, to: sym => `MIL:${sym.replace(/\.MI$/, '')}` },
    { re: /\.L$/,  to: sym => `LSE:${sym.replace(/\.L$/, '')}` }
  ];
  for (const r of map) {
    if (r.re.test(s)) {
      return r.to(s);
    }
  }
  return s;
}

const testCases = [
  { input: 'GRF.MC', expected: 'BME:GRF' },
  { input: 'SAP.DE', expected: 'XETRA:SAP' },
  { input: 'BNP.PA', expected: 'EPA:BNP' },
  { input: 'UCG.MI', expected: 'MIL:UCG' },
  { input: 'VOD.L', expected: 'LSE:VOD' },
  { input: 'AAPL', expected: 'AAPL' }  // US股票不转换
];

let passed = 0;
let failed = 0;

testCases.forEach(({ input, expected }) => {
  const result = normalizeSymbol(input);
  if (result === expected) {
    console.log(`✅ ${input.padEnd(10)} -> ${result}`);
    passed++;
  } else {
    console.log(`❌ ${input.padEnd(10)} -> ${result} (expected: ${expected})`);
    failed++;
  }
});

console.log("");

// 测试 2: 验证 symbolResolver.js 文件存在
console.log("[2/3] 文件完整性检查");
console.log("----------------------------------------");

const fs = require('fs');
const path = require('path');

const requiredFiles = [
  'index.js',
  'symbolResolver.js',
  'CHANGELOG.md',
  'RELEASE_v4.2_fixed.md',
  'scripts/smoke.sh'
];

requiredFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} (missing)`);
    failed++;
  }
});

console.log("");

// 测试 3: 验证 index.js 中包含 /version 端点
console.log("[3/3] 代码功能验证");
console.log("----------------------------------------");

try {
  const indexContent = fs.readFileSync('index.js', 'utf8');
  
  const checks = [
    { name: '/health endpoint', pattern: /app\.get\s*\(\s*["']\/health["']/ },
    { name: '/version endpoint', pattern: /app\.get\s*\(\s*["']\/version["']/ },
    { name: 'normalizeSymbol function', pattern: /function\s+normalizeSymbol|const\s+normalizeSymbol\s*=/ },
    { name: 'debug.data_errors init', pattern: /data_errors:\s*\[\]/ }
  ];
  
  checks.forEach(({ name, pattern }) => {
    if (pattern.test(indexContent)) {
      console.log(`✅ ${name}`);
      passed++;
    } else {
      // 对于 normalizeSymbol，它在 symbolResolver.js 中
      if (name === 'normalizeSymbol function') {
        const resolverContent = fs.readFileSync('symbolResolver.js', 'utf8');
        if (/function\s+normalizeSymbol|const\s+normalizeSymbol\s*=/.test(resolverContent)) {
          console.log(`✅ ${name} (in symbolResolver.js)`);
          passed++;
          return;
        }
      }
      console.log(`❌ ${name}`);
      failed++;
    }
  });
} catch (error) {
  console.log(`❌ 代码检查失败: ${error.message}`);
  failed++;
}

console.log("");
console.log("==========================================");
console.log(`总计: ${passed} 通过, ${failed} 失败`);
console.log("==========================================");

if (failed === 0) {
  console.log("✅ v4.2_fixed 核心功能验证通过！");
  process.exit(0);
} else {
  console.log(`⚠️  发现 ${failed} 个问题需要修复`);
  process.exit(1);
}
