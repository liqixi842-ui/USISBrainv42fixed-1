/**
 * ═══════════════════════════════════════════════════════════════
 * TECHNICAL ENGINE v1.0 - Basic Technical Analysis Module
 * ═══════════════════════════════════════════════════════════════
 * 
 * Provides basic technical indicators for research reports
 * - Support/Resistance levels (from 52W and intraday data)
 * - RSI, MACD, EMA calculations (v2.0 future enhancement)
 * 
 * Usage:
 *   const TechnicalEngine = require('./technicalEngine');
 *   const techs = TechnicalEngine.calculateBasicTechs(price, high52w, low52w, ...);
 */

/**
 * Calculate basic technical indicators from price data
 * @param {object} priceData - Price object with current, 52W high/low, intraday data
 * @returns {object} Technical indicators object
 */
function calculateBasicTechs(priceData) {
  if (!priceData) {
    return {
      support_level: null,
      resistance_level: null,
      rsi_14: null,
      macd: null,
      ema_20: null,
      ema_50: null,
      ema_200: null
    };
  }
  
  const currentPrice = priceData.last;
  const high52w = priceData.high_52w;
  const low52w = priceData.low_52w;
  const intradayHigh = priceData.high_1d;
  const intradayLow = priceData.low_1d;
  
  // Calculate support level (conservative approach)
  // Priority: Recent intraday low > 52W low
  let supportLevel = null;
  if (intradayLow && intradayLow > 0) {
    supportLevel = intradayLow;
  } else if (low52w && low52w > 0) {
    supportLevel = low52w;
  }
  
  // Calculate resistance level
  // Use 52W high as primary resistance
  let resistanceLevel = null;
  if (high52w && high52w > 0) {
    resistanceLevel = high52w;
  } else if (intradayHigh && intradayHigh > 0) {
    resistanceLevel = intradayHigh;
  }
  
  return {
    support_level: supportLevel,
    resistance_level: resistanceLevel,
    rsi_14: null,        // Future: Requires 14-day price history
    macd: null,          // Future: Requires daily close prices
    ema_20: null,        // Future: Requires 20-day price history
    ema_50: null,        // Future: Requires 50-day price history
    ema_200: null        // Future: Requires 200-day price history
  };
}

module.exports = {
  calculateBasicTechs
};
