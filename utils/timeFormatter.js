/**
 * Time Formatting Utilities
 * 
 * Provides human-readable time formatting for news articles.
 * All timestamps must be in ISO8601 format.
 * 
 * @module utils/timeFormatter
 */

/**
 * Format ISO8601 timestamp to human-readable "time ago" format
 * @param {string} isoTimestamp - ISO8601 formatted timestamp
 * @param {string} language - Language code ('en', 'zh', 'es')
 * @returns {string} Human-readable time string
 * 
 * @example
 * formatTimeAgo('2024-01-24T15:30:00.000Z', 'en') // "2 hours ago"
 * formatTimeAgo('2024-01-23T15:30:00.000Z', 'zh') // "1天前"
 */
function formatTimeAgo(isoTimestamp, language = 'en') {
  try {
    const now = new Date();
    const published = new Date(isoTimestamp);
    
    // Validate the timestamp
    if (isNaN(published.getTime())) {
      return language === 'zh' ? '时间未知' : language === 'es' ? 'Tiempo desconocido' : 'Unknown time';
    }
    
    const diffMs = now - published;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    
    // Multi-language strings
    const strings = {
      en: {
        justNow: 'just now',
        minutesAgo: (n) => `${n} minute${n > 1 ? 's' : ''} ago`,
        hoursAgo: (n) => `${n} hour${n > 1 ? 's' : ''} ago`,
        daysAgo: (n) => `${n} day${n > 1 ? 's' : ''} ago`,
        weeksAgo: (n) => `${n} week${n > 1 ? 's' : ''} ago`,
        monthsAgo: (n) => `${n} month${n > 1 ? 's' : ''} ago`,
        longAgo: 'long ago'
      },
      zh: {
        justNow: '刚刚',
        minutesAgo: (n) => `${n}分钟前`,
        hoursAgo: (n) => `${n}小时前`,
        daysAgo: (n) => `${n}天前`,
        weeksAgo: (n) => `${n}周前`,
        monthsAgo: (n) => `${n}个月前`,
        longAgo: '很久之前'
      },
      es: {
        justNow: 'justo ahora',
        minutesAgo: (n) => `hace ${n} minuto${n > 1 ? 's' : ''}`,
        hoursAgo: (n) => `hace ${n} hora${n > 1 ? 's' : ''}`,
        daysAgo: (n) => `hace ${n} día${n > 1 ? 's' : ''}`,
        weeksAgo: (n) => `hace ${n} semana${n > 1 ? 's' : ''}`,
        monthsAgo: (n) => `hace ${n} mes${n > 1 ? 'es' : ''}`,
        longAgo: 'hace mucho tiempo'
      }
    };
    
    const lang = strings[language] || strings.en;
    
    // Format based on time difference
    if (diffSeconds < 60) {
      return lang.justNow;
    } else if (diffMinutes < 60) {
      return lang.minutesAgo(diffMinutes);
    } else if (diffHours < 24) {
      return lang.hoursAgo(diffHours);
    } else if (diffDays < 7) {
      return lang.daysAgo(diffDays);
    } else if (diffWeeks < 4) {
      return lang.weeksAgo(diffWeeks);
    } else if (diffMonths < 12) {
      return lang.monthsAgo(diffMonths);
    } else {
      return lang.longAgo;
    }
    
  } catch (error) {
    console.error('⚠️  [TimeFormatter] Error formatting time:', error.message);
    return language === 'zh' ? '时间未知' : language === 'es' ? 'Tiempo desconocido' : 'Unknown time';
  }
}

/**
 * Format ISO8601 timestamp to localized date string
 * @param {string} isoTimestamp - ISO8601 formatted timestamp
 * @param {string} language - Language code ('en', 'zh', 'es')
 * @returns {string} Localized date string
 * 
 * @example
 * formatDate('2024-01-24T15:30:00.000Z', 'en') // "Jan 24, 2024"
 * formatDate('2024-01-24T15:30:00.000Z', 'zh') // "2024年1月24日"
 */
function formatDate(isoTimestamp, language = 'en') {
  try {
    const date = new Date(isoTimestamp);
    
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    
    if (language === 'zh') {
      return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    } else if (language === 'es') {
      const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      return `${date.getDate()} ${months[date.getMonth()]}, ${date.getFullYear()}`;
    } else {
      // English
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    }
    
  } catch (error) {
    console.error('⚠️  [TimeFormatter] Error formatting date:', error.message);
    return 'Invalid date';
  }
}

/**
 * Validate ISO8601 timestamp
 * @param {string} timestamp - Timestamp to validate
 * @returns {boolean} True if valid ISO8601
 */
function isValidISO8601(timestamp) {
  if (!timestamp || typeof timestamp !== 'string') {
    return false;
  }
  
  try {
    const date = new Date(timestamp);
    return !isNaN(date.getTime()) && timestamp.includes('T') && timestamp.includes('Z');
  } catch (error) {
    return false;
  }
}

/**
 * Convert any timestamp to ISO8601 format (safety function)
 * @param {string|Date|number} timestamp - Input timestamp
 * @returns {string} ISO8601 formatted timestamp
 */
function ensureISO8601(timestamp) {
  try {
    if (typeof timestamp === 'string' && isValidISO8601(timestamp)) {
      return timestamp;
    }
    
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return new Date().toISOString(); // Fallback to current time
    }
    
    return date.toISOString();
  } catch (error) {
    console.error('⚠️  [TimeFormatter] Error converting to ISO8601:', error.message);
    return new Date().toISOString();
  }
}

module.exports = {
  formatTimeAgo,
  formatDate,
  isValidISO8601,
  ensureISO8601
};
