const { pool } = require('./pg');

async function initDatabase() {
  try {
    // Create players table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS players (
        username TEXT PRIMARY KEY,
        wins INT NOT NULL DEFAULT 0,
        losses INT NOT NULL DEFAULT 0,
        draws INT NOT NULL DEFAULT 0,
        games_played INT NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create games table
    // mode: 'PVP' or 'BOT'
    // difficulty: 'EASY', 'MEDIUM', 'HARD' (NULL for PVP games)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS games (
        id UUID PRIMARY KEY,
        player1 TEXT NOT NULL,
        player2 TEXT NOT NULL,
        winner TEXT,
        ended_reason TEXT,
        mode TEXT,
        difficulty TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('✅ Database tables initialized');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    throw error;
  }
}

module.exports = { initDatabase };

