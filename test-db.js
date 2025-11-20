const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ 连接失败:', err.message);
  } else {
    console.log('✅ 连接成功:', res.rows[0]);
  }
  pool.end();
});
