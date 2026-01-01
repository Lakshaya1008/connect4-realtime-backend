# Backend Refactoring - API Contract Fixes

## Summary of Changes

All required fixes have been implemented to make the backend API contracts consistent, debuggable, and leaderboard-ready.

---

## FIX #1: Normalized Socket.IO Payloads

**Files Modified:** `src/socket/gameSocket.js`

### Changes:
- Added `buildGamePayload()` helper function that ensures consistent payload shape
- All `game_start`, `game_resume`, `game_update`, and `game_over` events now return:

```javascript
{
  gameId: string,
  players: [string, string],  // [player1, player2] or [username, 'BOT']
  currentTurn: string,
  board: 2D array,
  mode: 'PVP' | 'BOT',
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | null,  // null for PVP
  reason?: 'win' | 'draw' | 'forfeit',  // only for game_over
  winningCells?: Array<{row, col}>,  // only for game_over with reason='win'
  winner?: string | null,  // only for game_over
}
```

### Backward Compatibility:
- All existing fields are preserved
- New fields (`mode`, `difficulty`) are always present
- `difficulty` is `null` for PVP games (as expected)

---

## FIX #2: game_over Always Includes reason, mode, difficulty

**Files Modified:** `src/socket/gameSocket.js`

### Changes:
- All `game_over` emissions now include:
  - `reason`: 'win' | 'draw' | 'forfeit'
  - `mode`: 'PVP' | 'BOT'
  - `difficulty`: 'EASY' | 'MEDIUM' | 'HARD' | null

### Locations Updated:
- Human player win (line ~250)
- Draw detection (line ~280)
- BOT win (line ~320)
- BOT draw (line ~350)
- Forfeit timeout (line ~420)

---

## FIX #3: Leaderboard Difficulty Support

**Files Modified:**
- `src/db/initDb.js` - Schema changes
- `src/db/playerStats.js` - Stats tracking
- `src/routes/leaderboard.js` - API response

### Database Schema Changes:

**New columns added to `players` table:**
```sql
ALTER TABLE players ADD COLUMN IF NOT EXISTS wins_vs_bot_easy INT NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS wins_vs_bot_medium INT NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS wins_vs_bot_hard INT NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS losses_vs_bot_easy INT NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS losses_vs_bot_medium INT NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS losses_vs_bot_hard INT NOT NULL DEFAULT 0;
```

**Migration is automatic:** The `initDatabase()` function runs ALTER TABLE statements that are safe to re-run.

### recordResult() Changes:
- Now accepts `mode` and `difficulty` parameters
- When playing against BOT, increments difficulty-specific columns:
  - `wins_vs_bot_easy`, `wins_vs_bot_medium`, `wins_vs_bot_hard`
  - `losses_vs_bot_easy`, `losses_vs_bot_medium`, `losses_vs_bot_hard`

### Leaderboard API Response:
```javascript
{
  username: string,
  wins: number,
  losses: number,
  draws: number,
  games_played: number,
  bot_stats: {
    easy: { wins: number, losses: number },
    medium: { wins: number, losses: number },
    hard: { wins: number, losses: number },
  }
}
```

---

## FIX #4: Waiting Player Disconnect Bug

**Files Modified:** `src/socket/gameSocket.js`

### Problem:
If a player in the PVP waiting queue disconnected, the next player could be matched with a stale/disconnected socket.

### Solution:
1. **On disconnect:** Check if the disconnected socket was the waiting player. If so, clear the waiting queue.
2. **On join_game (PVP):** Before matching, verify the waiting player's socket is still connected using `io.sockets.sockets.get(socketId).connected`.

### Code Locations:
- `disconnect` handler (line ~385): Clears waiting player if their socket disconnects
- `join_game` handler (line ~165): Validates waiting player socket before matching

---

## FIX #5: Win Highlighting (winningCells)

**Files Modified:**
- `src/game/gameLogic.js` - New function
- `src/socket/gameSocket.js` - Uses new function

### Design Decision:
**IMPLEMENTED** - `checkWinWithCells()` now returns winning cell positions.

### New Function:
```javascript
function checkWinWithCells(board, row, col, player) {
  // Returns: { won: boolean, winningCells: Array<{row, col}> | null }
}
```

### Backward Compatibility:
- `checkWin()` still exists and returns boolean only
- `checkWinWithCells()` is the new function used internally
- `game_over` payload includes `winningCells` array when `reason === 'win'`

### winningCells Format:
```javascript
winningCells: [
  { row: 5, col: 0 },
  { row: 5, col: 1 },
  { row: 5, col: 2 },
  { row: 5, col: 3 },
]
```

---

## FIX #6: Backend Logging

**Files Modified:** `src/socket/gameSocket.js`

### Logging Added:
```
[PERSIST] Starting persistGame: { gameId, player1, player2, winner, reason, mode, difficulty }
[PERSIST] ✅ Success: gameId=xxx, winner=xxx, reason=xxx
[PERSIST] ❌ Failed: gameId=xxx, error=xxx
[FIX #4] Waiting player xxx disconnected, clearing queue
```

### Log Format:
- `[PERSIST]` prefix for persistence operations
- `[FIX #4]` prefix for waiting player cleanup
- Includes all relevant context: username, mode, difficulty, reason

---

## SQL Migration (Manual)

If your database already exists and you need to add the new columns:

```sql
-- Add difficulty-based stats columns
ALTER TABLE players ADD COLUMN IF NOT EXISTS wins_vs_bot_easy INT NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS wins_vs_bot_medium INT NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS wins_vs_bot_hard INT NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS losses_vs_bot_easy INT NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS losses_vs_bot_medium INT NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS losses_vs_bot_hard INT NOT NULL DEFAULT 0;
```

**Note:** The `initDatabase()` function runs these automatically on server start, so manual migration is usually not needed.

---

## Testing Checklist

### Payload Normalization:
- [ ] `game_start` (BOT mode) includes mode='BOT', difficulty='MEDIUM'
- [ ] `game_start` (PVP mode) includes mode='PVP', difficulty=null
- [ ] `game_resume` includes mode and difficulty
- [ ] `game_over` includes reason, mode, difficulty

### Leaderboard:
- [ ] GET /leaderboard returns bot_stats object
- [ ] Winning against EASY bot increments wins_vs_bot_easy
- [ ] Losing against HARD bot increments losses_vs_bot_hard

### Waiting Player Bug:
- [ ] Disconnecting while waiting clears the queue
- [ ] New player doesn't match with disconnected socket

### Win Highlighting:
- [ ] `game_over` with reason='win' includes winningCells array
- [ ] winningCells contains 4+ positions

### Logging:
- [ ] [PERSIST] logs appear on game end
- [ ] Logs include mode, difficulty, reason

---

## Files Changed Summary

| File | Changes |
|------|---------|
| `src/socket/gameSocket.js` | Payload normalization, logging, waiting player fix, winningCells |
| `src/game/gameLogic.js` | Added checkWinWithCells() function |
| `src/db/initDb.js` | Added difficulty stats columns |
| `src/db/playerStats.js` | Track difficulty-specific stats |
| `src/routes/leaderboard.js` | Return bot_stats in response |

---

## No Breaking Changes

- All existing socket event names preserved
- All existing payload fields preserved (new fields added)
- Backward compatible with frontends that ignore new fields
- PVP games continue to work with difficulty=null

