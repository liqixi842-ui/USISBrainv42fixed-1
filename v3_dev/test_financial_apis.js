/**
 * Test script for Financial Data Broker APIs
 * Run: node v3_dev/test_financial_apis.js NVDA
 */

require('dotenv').config();

const symbol = process.argv[2] || 'NVDA';

console.log(`\n${'='.repeat(60)}`);
console.log(`Testing Financial Data APIs for: ${symbol}`);
console.log('='.repeat(60));

console.log('\n📌 API Key Status:');
console.log(`   FINNHUB_API_KEY: ${process.env.FINNHUB_API_KEY ? '✅ Set' : '❌ Missing'}`);
console.log(`   TWELVE_DATA_API_KEY: ${process.env.TWELVE_DATA_API_KEY ? '✅ Set' : '❌ Missing'}`);
console.log(`   ALPHA_VANTAGE_API_KEY: ${process.env.ALPHA_VANTAGE_API_KEY ? '✅ Set' : '❌ Missing'}`);

async function testFinnhubReported() {
  console.log('\n📊 Testing Finnhub financials-reported endpoint...');
  
  if (!process.env.FINNHUB_API_KEY) {
    console.log('   ⚠️ Skipped - no API key');
    return null;
  }

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/financials-reported?symbol=${symbol}&token=${process.env.FINNHUB_API_KEY}`
    );
    
    const data = await res.json();
    
    if (!data.data || data.data.length === 0) {
      console.log('   ❌ No data returned');
      console.log('   Response:', JSON.stringify(data).substring(0, 200));
      return null;
    }

    const annualReports = data.data.filter(r => r.form === '10-K' || r.form === '20-F');
    console.log(`   ✅ Found ${annualReports.length} annual reports (10-K/20-F)`);
    
    if (annualReports.length > 0) {
      const latest = annualReports[0];
      console.log(`   Latest report: ${latest.form} for year ${latest.year}`);
      
      if (latest.report && latest.report.ic) {
        const incomeItems = Array.isArray(latest.report.ic) ? latest.report.ic : [];
        const concepts = incomeItems.map(i => i.concept).slice(0, 10);
        console.log(`   IC concepts found (first 10):`, concepts);
        
        const revenue = incomeItems.find(i => 
          i.concept === 'us-gaap_Revenues' || 
          i.concept === 'us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax' ||
          i.concept === 'us-gaap_SalesRevenueNet'
        );
        const eps = incomeItems.find(i => 
          i.concept === 'us-gaap_EarningsPerShareDiluted' || 
          i.concept === 'us-gaap_EarningsPerShareBasic'
        );
        
        console.log(`   Revenue concept: ${revenue ? `${revenue.concept} = ${revenue.value}` : 'Not found'}`);
        console.log(`   EPS concept: ${eps ? `${eps.concept} = ${eps.value}` : 'Not found'}`);
      }
    }
    
    return data;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return null;
  }
}

async function testTwelveData() {
  console.log('\n📊 Testing Twelve Data income_statement endpoint...');
  
  if (!process.env.TWELVE_DATA_API_KEY) {
    console.log('   ⚠️ Skipped - no API key');
    return null;
  }

  try {
    const res = await fetch(
      `https://api.twelvedata.com/income_statement?symbol=${symbol}&period=annual&apikey=${process.env.TWELVE_DATA_API_KEY}`
    );
    
    const data = await res.json();
    
    if (data.status === 'error') {
      console.log(`   ❌ API Error: ${data.message}`);
      return null;
    }
    
    const statements = data.income_statement || data.income || [];
    
    if (statements.length === 0) {
      console.log('   ❌ No income statements returned');
      console.log('   Response keys:', Object.keys(data));
      return null;
    }
    
    console.log(`   ✅ Found ${statements.length} annual statements`);
    
    if (statements.length > 0) {
      const latest = statements[0];
      console.log(`   Latest statement fields:`, Object.keys(latest).slice(0, 10));
      console.log(`   fiscal_date: ${latest.fiscal_date}`);
      console.log(`   sales/revenue: ${latest.sales || latest.revenue || latest.total_revenue || 'Not found'}`);
      console.log(`   eps_diluted: ${latest.eps_diluted || latest.eps_basic || latest.eps || 'Not found'}`);
    }
    
    return data;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return null;
  }
}

async function testAlphaVantage() {
  console.log('\n📊 Testing Alpha Vantage INCOME_STATEMENT endpoint...');
  
  if (!process.env.ALPHA_VANTAGE_API_KEY) {
    console.log('   ⚠️ Skipped - no API key');
    return null;
  }

  try {
    const res = await fetch(
      `https://www.alphavantage.co/query?function=INCOME_STATEMENT&symbol=${symbol}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`
    );
    
    const data = await res.json();
    
    if (data.Note) {
      console.log(`   ⚠️ Rate limit: ${data.Note}`);
      return null;
    }
    
    if (data['Error Message']) {
      console.log(`   ❌ API Error: ${data['Error Message']}`);
      return null;
    }
    
    if (!data.annualReports || data.annualReports.length === 0) {
      console.log('   ❌ No annual reports returned');
      console.log('   Response keys:', Object.keys(data));
      return null;
    }
    
    console.log(`   ✅ Found ${data.annualReports.length} annual reports`);
    
    if (data.annualReports.length > 0) {
      const latest = data.annualReports[0];
      console.log(`   fiscalDateEnding: ${latest.fiscalDateEnding}`);
      console.log(`   totalRevenue: ${latest.totalRevenue}`);
      console.log(`   reportedEPS: ${latest.reportedEPS || 'Not found'}`);
      console.log(`   netIncome: ${latest.netIncome}`);
    }
    
    return data;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return null;
  }
}

async function testFinancialDataBroker() {
  console.log('\n📊 Testing FinancialDataBroker.getHistorySeries()...');
  
  try {
    const FinancialDataBroker = require('./services/financialDataBroker');
    const result = await FinancialDataBroker.getHistorySeries(symbol);
    
    console.log(`   revenue_5y count: ${result.revenue_5y?.length || 0}`);
    console.log(`   eps_5y count: ${result.eps_5y?.length || 0}`);
    
    if (result.revenue_5y?.length > 0) {
      console.log(`   Revenue data:`, result.revenue_5y);
    }
    if (result.eps_5y?.length > 0) {
      console.log(`   EPS data:`, result.eps_5y);
    }
    
    return result;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return null;
  }
}

async function runTests() {
  await testFinnhubReported();
  await testTwelveData();
  await testAlphaVantage();
  await testFinancialDataBroker();
  
  console.log('\n' + '='.repeat(60));
  console.log('Testing complete');
  console.log('='.repeat(60) + '\n');
}

runTests().catch(console.error);
