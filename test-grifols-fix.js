// 测试 v4.2 Grifols修复
const { resolveSymbols } = require("./symbolResolver");

async function testGrifolsNormalization() {
  console.log("=== 测试 Grifols 符号归一化 ===\n");
  
  // 测试1: Grifols公司名
  const intent1 = {
    entities: [
      { type: 'company', value: 'Grifols' }
    ],
    exchange: 'Spain'
  };
  
  console.log("测试1: 公司名 'Grifols'");
  const symbols1 = await resolveSymbols(intent1);
  console.log(`结果: ${JSON.stringify(symbols1)}`);
  console.log(`期望: ["BME:GRF"]`);
  console.log(`通过: ${JSON.stringify(symbols1) === '["BME:GRF"]' ? '✅' : '❌'}\n`);
  
  // 测试2: GRF.MC符号
  const intent2 = {
    entities: [
      { type: 'symbol', value: 'GRF.MC' }
    ]
  };
  
  console.log("测试2: 符号 'GRF.MC'");
  const symbols2 = await resolveSymbols(intent2);
  console.log(`结果: ${JSON.stringify(symbols2)}`);
  console.log(`期望: ["BME:GRF"]`);
  console.log(`通过: ${JSON.stringify(symbols2) === '["BME:GRF"]' ? '✅' : '❌'}\n`);
  
  // 测试3: 其他欧洲符号
  const intent3 = {
    entities: [
      { type: 'symbol', value: 'SAP.DE' },
      { type: 'symbol', value: 'BNP.PA' }
    ]
  };
  
  console.log("测试3: 多个欧洲符号 'SAP.DE', 'BNP.PA'");
  const symbols3 = await resolveSymbols(intent3);
  console.log(`结果: ${JSON.stringify(symbols3)}`);
  console.log(`期望: ["XETRA:SAP","EPA:BNP"]`);
  console.log(`通过: ${JSON.stringify(symbols3) === '["XETRA:SAP","EPA:BNP"]' ? '✅' : '❌'}\n`);
  
  console.log("=== 测试完成 ===");
}

testGrifolsNormalization().catch(err => {
  console.error("测试失败:", err.message);
  process.exit(1);
});
