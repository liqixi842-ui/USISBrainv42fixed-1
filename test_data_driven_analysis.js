/**
 * 测试v5.0数据驱动分析质量
 * 对比旧版vs新版分析的深度和专业性
 */

const { fetchDataDrivenAnalysis } = require('./dataBroker');
const { generateDataDrivenStockAnalysis } = require('./gpt5Brain');

async function testDataDrivenAnalysis() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 测试v5.0数据驱动分析系统');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // 测试股票列表
  const testSymbols = ['AAPL', 'TSLA', 'MSFT'];
  
  for (const symbol of testSymbols) {
    console.log(`\n📊 测试股票: ${symbol}`);
    console.log('─'.repeat(50));
    
    try {
      // 1. 获取数据驱动分析数据包
      console.log('1️⃣ 获取多维度数据...');
      const dataPackage = await fetchDataDrivenAnalysis(symbol);
      
      const completeness = dataPackage.metadata.completeness;
      console.log(`   ✅ 数据完整度: ${(completeness.completenessScore * 100).toFixed(0)}%`);
      console.log(`   - 实时报价: ${completeness.hasQuote ? '✅' : '❌'}`);
      console.log(`   - 公司概况: ${completeness.hasProfile ? '✅' : '❌'}`);
      console.log(`   - 技术指标: ${completeness.hasMetrics ? '✅' : '❌'}`);
      console.log(`   - 近期新闻: ${completeness.hasNews ? '✅' : '❌'}`);
      
      // 显示关键数据
      if (dataPackage.profile) {
        console.log(`\n   📍 公司信息:`);
        console.log(`      名称: ${dataPackage.profile.companyName}`);
        console.log(`      行业: ${dataPackage.profile.finnhubIndustry || 'N/A'}`);
        console.log(`      市值: $${(dataPackage.profile.marketCapitalization / 1000).toFixed(2)}B`);
      }
      
      if (dataPackage.metrics) {
        console.log(`\n   📈 关键指标:`);
        console.log(`      P/E: ${dataPackage.metrics.peRatio?.toFixed(2) || 'N/A'}`);
        console.log(`      利润率: ${dataPackage.metrics.profitMargin ? (dataPackage.metrics.profitMargin * 100).toFixed(1) + '%' : 'N/A'}`);
        console.log(`      ROE: ${dataPackage.metrics.roe ? (dataPackage.metrics.roe * 100).toFixed(1) + '%' : 'N/A'}`);
        console.log(`      营收增长: ${dataPackage.metrics.revenueGrowth ? (dataPackage.metrics.revenueGrowth * 100).toFixed(1) + '%' : 'N/A'}`);
      }
      
      if (dataPackage.quote) {
        console.log(`\n   💰 实时行情:`);
        console.log(`      当前价: $${dataPackage.quote.currentPrice?.toFixed(2)}`);
        console.log(`      涨跌幅: ${dataPackage.quote.changePercent >= 0 ? '+' : ''}${dataPackage.quote.changePercent?.toFixed(2)}%`);
      }
      
      // 2. 生成数据驱动分析报告
      console.log(`\n2️⃣ 生成机构级分析报告...`);
      const analysisResult = await generateDataDrivenStockAnalysis(
        dataPackage,
        null, // 无Vision分析（仅测试数据驱动部分）
        { mode: 'analysis', scene: 'intraday' }
      );
      
      if (analysisResult.success) {
        console.log(`   ✅ 分析成功 (${analysisResult.model})`);
        console.log(`   💸 成本: $${analysisResult.cost_usd?.toFixed(4)}`);
        console.log(`   📝 报告长度: ${analysisResult.text.length} 字符`);
        
        // 显示报告摘要（前500字符）
        console.log(`\n📋 报告摘要:`);
        console.log('─'.repeat(50));
        console.log(analysisResult.text.substring(0, 500) + '...');
        console.log('─'.repeat(50));
        
        // 质量检查
        const qualityChecks = {
          hasExecutiveSummary: /执行摘要|Executive Summary/i.test(analysisResult.text),
          hasQuantitativeData: /市值|P\/E|ROE|营收增长|市盈率/.test(analysisResult.text),
          hasActionableAdvice: /操作建议|目标价|建议仓位|入场策略/.test(analysisResult.text),
          hasRiskAssessment: /风险评估|风险提示|监控指标/.test(analysisResult.text),
          usesDataDrivenLanguage: /数据显示|指标证实|财报反映|基于.+数据/.test(analysisResult.text),
          avoidsFuzzyLanguage: !/可能|或许|大概|也许/.test(analysisResult.text.substring(0, 500))
        };
        
        console.log(`\n✅ 质量检查:`);
        Object.entries(qualityChecks).forEach(([check, passed]) => {
          console.log(`   ${passed ? '✅' : '❌'} ${check}`);
        });
        
        const qualityScore = Object.values(qualityChecks).filter(Boolean).length / Object.keys(qualityChecks).length;
        console.log(`\n🎯 质量评分: ${(qualityScore * 100).toFixed(0)}%`);
        
      } else {
        console.log(`   ❌ 分析失败`);
      }
      
    } catch (error) {
      console.error(`\n❌ 测试失败: ${error.message}`);
      if (error.stack) {
        console.error(error.stack);
      }
    }
    
    console.log('\n' + '━'.repeat(50) + '\n');
    
    // 等待3秒避免API限流
    if (testSymbols.indexOf(symbol) < testSymbols.length - 1) {
      console.log('⏳ 等待3秒避免API限流...\n');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ 测试完成');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// 运行测试
testDataDrivenAnalysis().catch(err => {
  console.error('测试脚本错误:', err);
  process.exit(1);
});
