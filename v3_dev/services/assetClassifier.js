/**
 * Asset Type Classifier
 * Classifies symbols as: equity | index | etf | crypto
 * Used by v5.2/v6 report router to select correct templates
 */

/**
 * Classify asset type based on symbol, display name, and optional metadata.
 * @param {string} rawSymbol - Raw symbol (e.g., "NVDA", "^GSPC", "BTC-USD")
 * @param {string} displayName - Display name (e.g., "NVIDIA Corporation")
 * @param {object} metadata - Optional metadata from data providers
 * @returns {'equity' | 'index' | 'etf' | 'crypto'}
 */
function classifyAssetType(rawSymbol, displayName = '', metadata = {}) {
  const symbol = (rawSymbol || '').trim();
  const name = (displayName || '').trim().toLowerCase();
  const metaType = (metadata.asset_type || metadata.type || '').toLowerCase();

  // ════════════════════════════════════════════════════════════════
  // 1) Crypto Detection (metadata + regex + base extraction + keywords)
  // ════════════════════════════════════════════════════════════════
  
  // Check metadata first (most reliable)
  if (metaType === 'crypto' || metaType === 'cryptocurrency' || metaType === 'digital currency') {
    return 'crypto';
  }
  
  const upperSymbol = symbol.toUpperCase();
  
  // Regex detection for crypto pairs with delimiters (BTC-USD, 1INCH-USDT, etc.)
  // Supports alphanumeric base tokens (allows digits for 1INCH, etc.)
  const cryptoPairRegex = /^[A-Z0-9]{1,10}[-/](USD|USDT|EUR|GBP|JPY|BUSD|USDC|BTC|ETH)$/i;
  if (cryptoPairRegex.test(upperSymbol)) {
    return 'crypto';
  }
  
  // Base crypto symbols (without quote currency)
  const baseCryptoSymbols = [
    'BTC', 'XBT',           // Bitcoin
    'ETH',                  // Ethereum
    'BNB',                  // Binance Coin
    'XRP',                  // Ripple
    'ADA',                  // Cardano
    'SOL',                  // Solana
    'DOGE',                 // Dogecoin
    'MATIC', 'POL',         // Polygon
    'DOT',                  // Polkadot
    'LINK',                 // Chainlink
    'UNI',                  // Uniswap
    'AVAX',                 // Avalanche
    'ATOM',                 // Cosmos
    'LTC',                  // Litecoin
    'BCH',                  // Bitcoin Cash
    'XLM',                  // Stellar
    'ALGO',                 // Algorand
    'VET',                  // VeChain
    'ICP',                  // Internet Computer
    'FIL',                  // Filecoin
    'HBAR',                 // Hedera
    'NEAR',                 // NEAR Protocol
    'APT',                  // Aptos
    'ARB',                  // Arbitrum
    'OP',                   // Optimism
    '1INCH',                // 1inch
    'AAVE',                 // Aave
    'SHIB',                 // Shiba Inu
    'TRX',                  // Tron
    'ETC',                  // Ethereum Classic
    'XMR',                  // Monero
    'TON',                  // Toncoin
    'STX'                   // Stacks
  ];
  
  // ═══════════════════════════════════════════════════════════════
  // Helper function: Extract base crypto symbol from various formats
  // ═══════════════════════════════════════════════════════════════
  function extractBaseCrypto(sym) {
    // Step 1: Normalize symbol - remove Yahoo Finance/Bloomberg suffixes
    let normalized = sym.replace(/=X$/i, '').replace(/:.*$/i, ''); // BTCUSD=X → BTCUSD, BTC:USD → BTC
    
    // Step 2: Try splitting by common delimiters (-, /)
    const parts = normalized.split(/[-/]/);
    if (parts.length > 1 && baseCryptoSymbols.includes(parts[0])) {
      return parts[0]; // BTC-USD → BTC, ETH/USDT → ETH
    }
    
    // Step 3: Try stripping quote currencies from end (BTCUSD → BTC, SOLUSDT → SOL)
    const quoteCurrencies = ['USDT', 'USD', 'EUR', 'GBP', 'JPY', 'BUSD', 'USDC']; // Order matters: try longer first
    for (const quote of quoteCurrencies) {
      if (normalized.endsWith(quote) && normalized.length > quote.length) {
        const base = normalized.substring(0, normalized.length - quote.length);
        if (baseCryptoSymbols.includes(base)) {
          return base; // BTCUSD → BTC, ETHUSDT → ETH
        }
      }
    }
    
    // Step 4: Return original if no quote found (might be plain BTC, ETH, etc.)
    return normalized;
  }
  
  const baseSymbol = extractBaseCrypto(upperSymbol);
  
  // Check if extracted base symbol is a known crypto
  if (baseCryptoSymbols.includes(baseSymbol)) {
    return 'crypto';
  }
  
  // Keyword detection for crypto in display name
  const cryptoKeywords = ['bitcoin', 'ethereum', 'crypto', 'cryptocurrency', 'blockchain', 'dogecoin', 'solana'];
  if (cryptoKeywords.some(k => name.includes(k))) {
    return 'crypto';
  }

  // ════════════════════════════════════════════════════════════════
  // 2) Index Detection (^ prefix + keyword matching)
  // ════════════════════════════════════════════════════════════════
  
  // Symbols starting with ^ are typically indices
  if (symbol.startsWith('^')) {
    return 'index';
  }

  // Common index keywords (multilingual)
  const indexKeywords = [
    'index', 'indice', 'índice',
    's&p 500', 'sp500', 'spx', 's&p500',
    'nasdaq', 'nasdaq composite', 'nasdaq-100',
    'dow jones', 'djia', 'dow 30',
    'nikkei', 'nikkei 225',
    'ftse', 'ftse 100',
    'dax', 'cac 40',
    'ibex', 'ibex 35',
    'hang seng', 'hsi',
    'euro stoxx', 'stoxx 50'
  ];
  
  const lowerSymbol = symbol.toLowerCase();
  if (indexKeywords.some(k => lowerSymbol.includes(k) || name.includes(k))) {
    return 'index';
  }

  // ════════════════════════════════════════════════════════════════
  // 3) ETF Detection (metadata + common tickers)
  // ════════════════════════════════════════════════════════════════
  
  // Use metadata if available
  if (metaType === 'etf' || metaType === 'exchange traded fund') {
    return 'etf';
  }

  // Common ETF tickers (can be extended)
  const commonEtfs = [
    // Broad Market
    'VOO', 'SPY', 'IVV', 'VTI', 'ITOT',
    // Tech/Growth
    'QQQ', 'VGT', 'XLK', 'ARKK', 'ARKW', 'ARKG',
    // International
    'EEM', 'VEA', 'IEFA', 'VWO', 'IXUS',
    // Sector
    'XLF', 'XLE', 'XLV', 'XLI', 'XLP', 'XLU', 'XLY',
    // Fixed Income
    'AGG', 'BND', 'HYG', 'LQD', 'TLT', 'SHY',
    // Others
    'GLD', 'SLV', 'USO', 'VNQ'
  ];
  
  if (commonEtfs.includes(upperSymbol)) {
    return 'etf';
  }

  // ETF keyword detection
  const etfKeywords = ['etf', 'exchange traded fund', 'ishares', 'vanguard', 'spdr'];
  if (etfKeywords.some(k => name.includes(k))) {
    return 'etf';
  }

  // ════════════════════════════════════════════════════════════════
  // 4) Default: Equity (Individual Stocks)
  // ════════════════════════════════════════════════════════════════
  return 'equity';
}

module.exports = {
  classifyAssetType,
};
