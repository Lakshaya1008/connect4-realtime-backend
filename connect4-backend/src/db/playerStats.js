const db = require('./pg');

async function ensurePlayer(username) {
  if (username === 'BOT') return; // Don't track BOT stats

  await db.query(
    `INSERT INTO players (username)
     VALUES ($1)
     ON CONFLICT (username) DO NOTHING`,
    [username]
  );
}

async function recordResult({ winner, loser, isDraw }) {
  // Don't record BOT stats
  if (winner === 'BOT' || loser === 'BOT') {
    // Only update human player
    const humanPlayer = winner === 'BOT' ? loser : winner;
    const humanWon = winner !== 'BOT';

    await ensurePlayer(humanPlayer);

    if (humanWon) {
      await db.query(
        `UPDATE players
         SET wins = wins + 1,
             games_played = games_played + 1,
             updated_at = NOW()
         WHERE username = $1`,
        [humanPlayer]
      );
    } else {
      await db.query(
        `UPDATE players
         SET losses = losses + 1,
             games_played = games_played + 1,
             updated_at = NOW()
         WHERE username = $1`,
        [humanPlayer]
      );
    }
    return;
  }

  // PvP game
  if (isDraw) {
    await Promise.all([
      ensurePlayer(winner),
      ensurePlayer(loser),
      db.query(
        `UPDATE players
         SET draws = draws + 1,
             games_played = games_played + 1,
             updated_at = NOW()
         WHERE username IN ($1, $2)`,
        [winner, loser]
      ),
    ]);
    return;
  }

  await Promise.all([
    ensurePlayer(winner),
    ensurePlayer(loser),
    db.query(
      `UPDATE players
       SET wins = wins + 1,
           games_played = games_played + 1,
           updated_at = NOW()
       WHERE username = $1`,
      [winner]
    ),
    db.query(
      `UPDATE players
       SET losses = losses + 1,
           games_played = games_played + 1,
           updated_at = NOW()
       WHERE username = $1`,
      [loser]
    ),
  ]);
}

module.exports = { recordResult };

