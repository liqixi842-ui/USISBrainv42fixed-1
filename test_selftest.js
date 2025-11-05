#!/usr/bin/env node
// 测试 selftest/orchestrate 核心逻辑

console.log("🧪 Testing selftest/orchestrate logic\n");

// 模拟 normalizeSymbol 函数
const normalizeSymbol = (raw) => {
  const s = (raw || '').trim().toUpperCase();
  if (/\.MC$/.test(s)) return `BME:${s.replace(/\.MC$/, '')}`;
  if (/\.DE$/.test(s)) return `XETRA:${s.replace(/\.DE$/, '')}`;
  if (/\.PA$/.test(s)) return `EPA:${s.replace(/\.PA$/, '')}`;
  if (/\.MI$/.test(s)) return `MIL:${s.replace(/\.MI$/, '')}`;
  if (/\.L$/.test(s)) return `LSE:${s.replace(/\.L$/, '')}`;
  return s;
};

// 测试用例
const testCases = [
  { input: 'GRF.MC', expected: 'BME:GRF' },
  { input: 'SAP.DE', expected: 'XETRA:SAP' }
];

console.log("Testing symbol normalization:");
testCases.forEach(({ input, expected }) => {
  const result = normalizeSymbol(input);
  const pass = result === expected;
  console.log(`  ${pass ? '✅' : '❌'} ${input} → ${result} (expected: ${expected})`);
});

console.log("\nSimulating /selftest/orchestrate response:");

const resolvedSymbols = ['GRF.MC'].map(normalizeSymbol);
const expectedSymbol = "BME:GRF";
const contractValid = resolvedSymbols && resolvedSymbols.includes(expectedSymbol);

const response = contractValid ? {
  ok: true,
  status: "ok",
  model: "selftest",
  symbols: resolvedSymbols,
  debug: {
    contract_validated: true,
    expected_symbol: expectedSymbol,
    test_type: "normalizer_only",
    message: "Symbol normalizer working correctly"
  }
} : {
  ok: false,
  status: "contract-failed",
  model: "selftest",
  symbols: resolvedSymbols || [],
  debug: {
    message: `Expected symbol ${expectedSymbol} not found`,
    received_symbols: resolvedSymbols,
    test_type: "normalizer_only"
  }
};

console.log(JSON.stringify(response, null, 2));

console.log("\n" + (response.ok ? "✅ Contract test PASSED" : "❌ Contract test FAILED"));
