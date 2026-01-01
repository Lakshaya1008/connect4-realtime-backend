const { pool } = require('./pg');

async function initDatabase() {
  try {
    // Create players table
    // FIX #3: Added difficulty-based win tracking columns for BOT games
    await pool.query(`
      CREATE TABLE IF NOT EXISTS players (
        username TEXT PRIMARY KEY,
        wins INT NOT NULL DEFAULT 0,
        losses INT NOT NULL DEFAULT 0,
        draws INT NOT NULL DEFAULT 0,
        games_played INT NOT NULL DEFAULT 0,
        wins_vs_bot_easy INT NOT NULL DEFAULT 0,
        wins_vs_bot_medium INT NOT NULL DEFAULT 0,
        wins_vs_bot_hard INT NOT NULL DEFAULT 0,
        losses_vs_bot_easy INT NOT NULL DEFAULT 0,
        losses_vs_bot_medium INT NOT NULL DEFAULT 0,
        losses_vs_bot_hard INT NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // FIX #3: Migration for existing tables - add new columns if they don't exist
    // This ensures backward compatibility with existing databases
    const migrationQueries = [
      `ALTER TABLE players ADD COLUMN IF NOT EXISTS wins_vs_bot_easy INT NOT NULL DEFAULT 0`,
      `ALTER TABLE players ADD COLUMN IF NOT EXISTS wins_vs_bot_medium INT NOT NULL DEFAULT 0`,
      `ALTER TABLE players ADD COLUMN IF NOT EXISTS wins_vs_bot_hard INT NOT NULL DEFAULT 0`,
      `ALTER TABLE players ADD COLUMN IF NOT EXISTS losses_vs_bot_easy INT NOT NULL DEFAULT 0`,
      `ALTER TABLE players ADD COLUMN IF NOT EXISTS losses_vs_bot_medium INT NOT NULL DEFAULT 0`,
      `ALTER TABLE players ADD COLUMN IF NOT EXISTS losses_vs_bot_hard INT NOT NULL DEFAULT 0`,
    ];

    for (const query of migrationQueries) {
      try {
        await pool.query(query);
      } catch (err) {
        // Ignore errors (column may already exist)
      }
    }

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
