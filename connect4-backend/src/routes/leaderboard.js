const express = require('express');
const db = require('../db/pg');
const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT username, wins, losses, draws, games_played
       FROM players
       ORDER BY wins DESC, games_played ASC
       LIMIT 10`
    );

    res.json(rows);
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

module.exports = router;
