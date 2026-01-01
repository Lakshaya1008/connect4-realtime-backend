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

// FIX #3: Updated to accept mode and difficulty for difficulty-based stats tracking
// mode: 'PVP' | 'BOT'
// difficulty: 'EASY' | 'MEDIUM' | 'HARD' | null
async function recordResult({ winner, loser, isDraw, mode = 'PVP', difficulty = null }) {
  // Don't record BOT stats
  if (winner === 'BOT' || loser === 'BOT') {
    // Only update human player
    const humanPlayer = winner === 'BOT' ? loser : winner;
    const humanWon = winner !== 'BOT';

    await ensurePlayer(humanPlayer);

    // FIX #3: Track difficulty-specific stats for BOT games
    const difficultyLower = difficulty ? difficulty.toLowerCase() : 'medium';
    const difficultyWinCol = `wins_vs_bot_${difficultyLower}`;
    const difficultyLossCol = `losses_vs_bot_${difficultyLower}`;

    if (humanWon) {
      // Human beat the bot - increment wins and difficulty-specific wins
      await db.query(
        `UPDATE players
         SET wins = wins + 1,
             ${difficultyWinCol} = ${difficultyWinCol} + 1,
             games_played = games_played + 1,
             updated_at = NOW()
         WHERE username = $1`,
        [humanPlayer]
      );
    } else {
      // Bot beat the human - increment losses and difficulty-specific losses
      await db.query(
        `UPDATE players
         SET losses = losses + 1,
             ${difficultyLossCol} = ${difficultyLossCol} + 1,
             games_played = games_played + 1,
             updated_at = NOW()
         WHERE username = $1`,
        [humanPlayer]
      );
    }
    return;
  }

  // PvP game - no difficulty tracking needed
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
