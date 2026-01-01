const express = require('express');
const db = require('../db/pg');
const router = express.Router();

// FIX #3: Updated leaderboard to include difficulty-based stats
router.get('/', async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT 
         username, 
         wins, 
         losses, 
         draws, 
         games_played,
         wins_vs_bot_easy,
         wins_vs_bot_medium,
         wins_vs_bot_hard,
         losses_vs_bot_easy,
         losses_vs_bot_medium,
         losses_vs_bot_hard
       FROM players
       ORDER BY wins DESC, games_played ASC
       LIMIT 10`
    );

    // FIX #3: Format response with nested bot_stats for cleaner API
    const formattedRows = rows.map(row => ({
      username: row.username,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      games_played: row.games_played,
      // Nested object for bot difficulty stats (cleaner API contract)
      bot_stats: {
        easy: {
          wins: row.wins_vs_bot_easy || 0,
          losses: row.losses_vs_bot_easy || 0,
        },
        medium: {
          wins: row.wins_vs_bot_medium || 0,
          losses: row.losses_vs_bot_medium || 0,
        },
        hard: {
          wins: row.wins_vs_bot_hard || 0,
          losses: row.losses_vs_bot_hard || 0,
        },
      },
    }));

    res.json(formattedRows);
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

module.exports = router;
