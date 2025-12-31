const { Pool } = require('pg');

// Environment variables for database configuration
const DATABASE_URL = process.env.DATABASE_URL;
const NODE_ENV = process.env.NODE_ENV || 'development';

// SSL configuration for cloud providers (Render, Railway, Neon, etc.)
// In production, most cloud Postgres providers require SSL
// rejectUnauthorized: false is needed for some providers that use self-signed certs
const sslConfig = NODE_ENV === 'production'
  ? { rejectUnauthorized: false }
  : false;

// Pool configuration
const poolConfig = DATABASE_URL
  ? {
      connectionString: DATABASE_URL,
      ssl: sslConfig,
    }
  : {
      // Local development fallback (no DATABASE_URL set)
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: 'postgres',
      database: 'connect4',
      ssl: false,
    };

const pool = new Pool(poolConfig);

// Test connection on startup (log safely, no credentials)
pool.query('SELECT NOW()', (err) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
  } else {
    console.log('✅ Database connected');
    console.log(`📊 SSL: ${sslConfig ? 'enabled' : 'disabled'}`);
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};

