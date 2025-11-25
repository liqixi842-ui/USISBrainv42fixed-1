/**
 * Test script for newsAutoSummarizer
 * Usage: node test-news-summarizer.js
 */

const { generateSummaries, validateSummary } = require('./services/newsAutoSummarizer');

async function testSummarizer() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   USIS Brain v7.0 - News Auto Summarizer Test            ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  // Test article (sample NVIDIA earnings news)
  const testArticle = {
    title: 'NVIDIA Reports Record Q4 Revenue of $22.1B, Beating Estimates',
    summary: `NVIDIA Corporation (NASDAQ: NVDA) reported fiscal fourth-quarter revenue of $22.1 billion, representing a 265% year-over-year increase and exceeding analyst estimates of $20.4 billion. The company's data center segment revenue reached $18.4 billion, up 409% year-over-year, driven by strong demand for AI chips and GPUs. CEO Jensen Huang stated that "accelerated computing and generative AI have hit the tipping point" and demand remains strong across cloud service providers, enterprises, and consumer internet companies. 

The company's gaming segment revenue was $2.9 billion, up 56% from the prior year. Professional visualization revenue reached $463 million, up 105% year-over-year. Automotive revenue was $281 million, down 4% from the prior year but up 8% sequentially.

For the current quarter (Q1 FY2025), NVIDIA expects revenue of approximately $24 billion, plus or minus 2%, which would represent continued strong growth. The company declared a quarterly cash dividend of $0.04 per share, payable on March 28, 2024.

Gross margin for Q4 was 76.0%, compared to 63.3% a year ago and 74.0% in the prior quarter. Operating expenses were $3.0 billion, up 44% from a year ago. Net income was $12.3 billion, or $4.93 per diluted share, compared to $1.4 billion, or $0.57 per diluted share, a year ago.

Analysts note that NVIDIA's AI chip dominance continues, with the company holding an estimated 80-90% market share in AI training chips. Competition is intensifying from AMD, Intel, and custom chips from cloud providers like Google and Amazon, but NVIDIA's CUDA software ecosystem and first-mover advantage in AI infrastructure remain significant competitive moats.`,
    url: 'https://example.com/nvidia-q4-earnings'
  };
  
  try {
    // Test English summary
    console.log('📝 Testing English summary generation...\n');
    const enResult = await generateSummaries(testArticle, 'en');
    
    console.log('\n━━━ LONG SUMMARY (EN) ━━━');
    console.log(enResult.long_summary);
    console.log(`\n[${enResult.word_count.long} words, Model: ${enResult.model_used}]`);
    
    console.log('\n━━━ SHORT SUMMARY (EN) ━━━');
    console.log(enResult.short_summary);
    console.log(`\n[${enResult.word_count.short} words]`);
    
    console.log('\n━━━ KEY METRICS ━━━');
    console.log(enResult.key_metrics.join(', '));
    
    console.log(`\n━━━ MARKET IMPACT: ${enResult.market_impact} ━━━`);
    
    // Validate summary quality
    const validation = validateSummary(enResult);
    console.log('\n━━━ VALIDATION ━━━');
    console.log(`Valid: ${validation.valid}`);
    console.log(`Quality Score: ${validation.score}/100`);
    if (validation.warnings.length > 0) {
      console.log('Warnings:');
      validation.warnings.forEach(w => console.log(`  - ${w}`));
    }
    
    console.log('\n\n✅ Test completed successfully!');
    console.log(`\nGeneration time: ${enResult.generation_time_ms} ms`);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run test
testSummarizer();
