// Technical Levels Calculator - Support & Resistance
// 基于当日数据和简单技术分析计算支撑压力位

/**
 * 计算支撑和压力位
 * @param {Object} quote - 股票报价数据
 * @returns {Object} - 支撑压力位信息
 */
function calculateSupportResistance(quote) {
  if (!quote || !quote.currentPrice) {
    return null;
  }

  const { currentPrice, high, low, open, previousClose } = quote;
  
  // 1. Pivot Points (经典枢轴点)
  const pivot = (high + low + previousClose) / 3;
  const r1 = (2 * pivot) - low;
  const r2 = pivot + (high - low);
  const r3 = high + 2 * (pivot - low);
  const s1 = (2 * pivot) - high;
  const s2 = pivot - (high - low);
  const s3 = low - 2 * (high - pivot);

  // 2. 今日关键价位
  const todayHigh = high;
  const todayLow = low;
  const todayOpen = open;
  
  // 3. 昨日收盘价（重要心理关口）
  const yesterdayClose = previousClose;

  // 4. 整数关口（心理价位）
  const roundNumber = Math.round(currentPrice / 10) * 10;
  const lowerRound = Math.floor(currentPrice / 10) * 10;
  const upperRound = Math.ceil(currentPrice / 10) * 10;

  // 5. 组合所有可能的支撑压力位
  const allLevels = [
    pivot, r1, r2, r3, s1, s2, s3,
    todayHigh, todayLow, todayOpen,
    yesterdayClose,
    roundNumber, lowerRound, upperRound
  ];

  // 6. 筛选有效的支撑压力位（去重并排序）
  const uniqueLevels = [...new Set(allLevels)]
    .filter(level => level > 0 && level > currentPrice * 0.8 && level < currentPrice * 1.2)
    .sort((a, b) => a - b);

  // 7. 分类为支撑和压力
  const supports = uniqueLevels
    .filter(level => level < currentPrice)
    .sort((a, b) => b - a) // 从高到低
    .slice(0, 3); // 取最近的3个

  const resistances = uniqueLevels
    .filter(level => level > currentPrice)
    .sort((a, b) => a - b) // 从低到高
    .slice(0, 3); // 取最近的3个

  return {
    current: currentPrice,
    pivot: {
      main: pivot,
      r1, r2, r3,
      s1, s2, s3
    },
    keyLevels: {
      todayHigh,
      todayLow,
      todayOpen,
      yesterdayClose
    },
    supports: supports.map(level => ({
      price: level,
      distance: ((currentPrice - level) / currentPrice * 100).toFixed(2),
      type: getLevelType(level, { pivot, s1, s2, s3, todayLow, yesterdayClose, lowerRound })
    })),
    resistances: resistances.map(level => ({
      price: level,
      distance: ((level - currentPrice) / currentPrice * 100).toFixed(2),
      type: getLevelType(level, { pivot, r1, r2, r3, todayHigh, yesterdayClose, upperRound })
    }))
  };
}

/**
 * 判断支撑压力位类型
 */
function getLevelType(level, levels) {
  const tolerance = 0.01; // 1% 容差
  
  if (Math.abs(level - levels.pivot) / level < tolerance) return 'Pivot Point';
  if (Math.abs(level - levels.r1) / level < tolerance) return 'R1';
  if (Math.abs(level - levels.r2) / level < tolerance) return 'R2';
  if (Math.abs(level - levels.r3) / level < tolerance) return 'R3';
  if (Math.abs(level - levels.s1) / level < tolerance) return 'S1';
  if (Math.abs(level - levels.s2) / level < tolerance) return 'S2';
  if (Math.abs(level - levels.s3) / level < tolerance) return 'S3';
  if (Math.abs(level - levels.todayHigh) / level < tolerance) return 'Today High';
  if (Math.abs(level - levels.todayLow) / level < tolerance) return 'Today Low';
  if (Math.abs(level - levels.yesterdayClose) / level < tolerance) return 'Yesterday Close';
  if (Math.abs(level - levels.upperRound) / level < tolerance) return 'Round Number';
  if (Math.abs(level - levels.lowerRound) / level < tolerance) return 'Round Number';
  
  return 'Technical Level';
}

/**
 * 格式化支撑压力位为文本（用于AI Prompt）
 */
function formatLevelsForPrompt(technicalLevels) {
  if (!technicalLevels) {
    return '技术分析数据不可用';
  }

  let output = `\n**技术分析 - 支撑压力位**:\n`;
  output += `当前价格: $${technicalLevels.current.toFixed(2)}\n\n`;

  // 压力位
  if (technicalLevels.resistances.length > 0) {
    output += `📈 压力位（Resistance）:\n`;
    technicalLevels.resistances.forEach((r, i) => {
      output += `  ${i + 1}. $${r.price.toFixed(2)} (+${r.distance}%) - ${r.type}\n`;
    });
    output += `\n`;
  }

  // 支撑位
  if (technicalLevels.supports.length > 0) {
    output += `📉 支撑位（Support）:\n`;
    technicalLevels.supports.forEach((s, i) => {
      output += `  ${i + 1}. $${s.price.toFixed(2)} (-${s.distance}%) - ${s.type}\n`;
    });
    output += `\n`;
  }

  // Pivot Points
  output += `🎯 Pivot Points:\n`;
  output += `  Main Pivot: $${technicalLevels.pivot.main.toFixed(2)}\n`;
  output += `  R1: $${technicalLevels.pivot.r1.toFixed(2)} | R2: $${technicalLevels.pivot.r2.toFixed(2)} | R3: $${technicalLevels.pivot.r3.toFixed(2)}\n`;
  output += `  S1: $${technicalLevels.pivot.s1.toFixed(2)} | S2: $${technicalLevels.pivot.s2.toFixed(2)} | S3: $${technicalLevels.pivot.s3.toFixed(2)}\n`;
  output += `\n`;

  // 今日关键价位
  output += `📊 今日关键价位:\n`;
  output += `  开盘: $${technicalLevels.keyLevels.todayOpen.toFixed(2)}\n`;
  output += `  最高: $${technicalLevels.keyLevels.todayHigh.toFixed(2)}\n`;
  output += `  最低: $${technicalLevels.keyLevels.todayLow.toFixed(2)}\n`;
  output += `  昨收: $${technicalLevels.keyLevels.yesterdayClose.toFixed(2)}\n`;

  return output;
}

module.exports = {
  calculateSupportResistance,
  formatLevelsForPrompt
};
