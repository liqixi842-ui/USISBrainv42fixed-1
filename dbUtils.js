/**
 * Database Utilities
 * Shared database functions for USIS Brain modules
 */

const { Pool } = require('pg');

const ENABLE_DB = process.env.ENABLE_DB !== 'false'; // Default: enabled
let pool = null;

/**
 * Lazy-load database connection pool
 */
function getPool() {
  if (!ENABLE_DB) {
    throw new Error('Database is disabled (ENABLE_DB=false)');
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }

  if (!pool) {
    // Neon配置：保留完整URL，使用require模式
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        require: true,
        rejectUnauthorized: false
      },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on('error', (err) => {
      console.error('❌ [DB Pool] Unexpected error:', err);
    });

    console.log('🔌 [DB] Connection pool created');
  }

  return pool;
}

/**
 * Safe query wrapper with timeout and error handling
 */
async function safeQuery(queryText, params = []) {
  if (!ENABLE_DB) {
    throw new Error('Database is disabled');
  }

  const dbPool = getPool();
  const startTime = Date.now();
  
  try {
    const result = await dbPool.query(queryText, params);
    const duration = Date.now() - startTime;
    
    if (duration > 3000) {
      console.warn(`⚠️  [DB] Slow query (${duration}ms): ${queryText.substring(0, 50)}...`);
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (error.message.includes('timeout') || error.message.includes('canceled')) {
      console.error(`⏱️  [DB] Query timeout (${duration}ms): ${queryText.substring(0, 50)}...`);
    } else {
      console.error(`❌ [DB] Query failed (${duration}ms):`, error.message);
    }
    
    throw error;
  }
}

module.exports = {
  getPool,
  safeQuery,
  ENABLE_DB
};
