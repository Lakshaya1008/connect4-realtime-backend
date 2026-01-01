
// ⚠️ API CONTRACT FREEZE
// Frontend relies on this payload shape.
// Do NOT change fields without updating frontend.

const {
  createGame,
  getWaitingPlayer,
  setWaitingPlayer,
  clearWaitingPlayer,
  activeGames,
  players,
  reconnectTimers,
} = require('../game/gameManager');
const { dropDisc, checkWinWithCells, isBoardFull } = require('../game/gameLogic');
const { getBotMove } = require('../game/botLogic');
const { recordResult } = require('../db/playerStats');
const db = require('../db/pg');

// FIX #1: Helper to build normalized game payload
// Ensures consistent payload shape across all events
function buildGamePayload(game, options = {}) {
  const { reason = null, winningCells = null } = options;
  const payload = {
    gameId: game.gameId,
    players: game.players.map(p => p.username),
    currentTurn: game.currentTurn,
    board: game.board,
    mode: game.mode,
    difficulty: game.difficulty,  // null for PVP, 'EASY'|'MEDIUM'|'HARD' for BOT
  };

  // Only include reason for game_over events
  if (reason) {
    payload.reason = reason;
  }

  // FIX #5: Include winningCells if provided (for win highlighting)
  if (winningCells) {
    payload.winningCells = winningCells;
  }

  return payload;
}

// FIX #6: Enhanced persistGame with detailed logging
async function persistGame({ gameId, player1, player2, winner, reason, mode, difficulty }) {
  // FIX #6: Log when persistGame is called
  console.log(`[PERSIST] Starting persistGame:`, {
    gameId,
    player1,
    player2,
    winner,
    reason,
    mode,
    difficulty,
  });

  try {
    await db.query(
      `INSERT INTO games (id, player1, player2, winner, ended_reason, mode, difficulty)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [gameId, player1, player2, winner, reason, mode, difficulty]
    );

    if (winner === null) {
      // Draw
      await recordResult({
        winner: player1,
        loser: player2,
        isDraw: true,
        mode,
        difficulty,
      });
    } else {
      // Win/Loss
      const loser = winner === player1 ? player2 : player1;
      // FIX #3: Pass mode and difficulty to recordResult for difficulty-based tracking
      await recordResult({
        winner,
        loser,
        isDraw: false,
        mode,
        difficulty,
      });
    }

    // FIX #6: Log success
    console.log(`[PERSIST] ✅ Success: gameId=${gameId}, winner=${winner}, reason=${reason}`);
  } catch (error) {
    // FIX #6: Log failure with details
    console.error(`[PERSIST] ❌ Failed: gameId=${gameId}, error=${error.message}`);
  }
}

module.exports = function setupGameSocket(io) {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Updated to accept mode and difficulty from frontend
    // mode: 'PVP' | 'BOT' (default: PVP for backward compatibility)
    // difficulty: 'EASY' | 'MEDIUM' | 'HARD' (default: MEDIUM, only used for BOT mode)
    socket.on('join_game', ({ username, mode = 'PVP', difficulty = 'MEDIUM' }) => {
      if (!username) {
        socket.emit('error', 'Username required');
        return;
      }

      // Trim and validate username
      const trimmedUsername = username.trim();
      if (!trimmedUsername) {
        socket.emit('error', 'Username required');
        return;
      }

      console.log(`${trimmedUsername} wants to join a ${mode} game${mode === 'BOT' ? ` (difficulty: ${difficulty})` : ''}`);

      // FIX: Check if username is already waiting in PVP queue
      // This prevents the "dddddd VS dddddd" race condition
      const waitingPlayer = getWaitingPlayer();
      if (waitingPlayer && waitingPlayer.username.toLowerCase() === trimmedUsername.toLowerCase()) {
        console.log(`[REJECT] Username ${trimmedUsername} is already waiting in PVP queue`);
        socket.emit('join_error', {
          code: 'USERNAME_IN_USE',
          message: 'Username already in use in another session'
        });
        return;
      }

      // PHASE 5: RECONNECTION CHECK
      if (players.has(trimmedUsername)) {
        const player = players.get(trimmedUsername);

        // Player was in a game and disconnected
        if (player.disconnectedAt && player.gameId) {
          const game = activeGames.get(player.gameId);

          if (game && game.status === 'ACTIVE') {
            // Cancel forfeit timer
            if (reconnectTimers.has(player.gameId)) {
              clearTimeout(reconnectTimers.get(player.gameId));
              reconnectTimers.delete(player.gameId);
              console.log(`Reconnect timer cancelled for ${trimmedUsername}`);
            }

            // Rebind socket
            player.socketId = socket.id;
            player.disconnectedAt = null;

            // Update game socket mapping
            game.sockets[trimmedUsername] = socket.id;
            socket.join(player.gameId);

            // FIX #1: Normalize game_resume payload to include mode and difficulty
            socket.emit('game_resume', buildGamePayload(game));

            // Notify opponent
            socket.to(player.gameId).emit('opponent_reconnected', {
              username: trimmedUsername,
            });

            console.log(`${trimmedUsername} reconnected to game ${player.gameId}`);
            return; // 🔴 STOP. Do NOT create a new game
          }
        }

        // FIX #1: Username already in active game (not disconnected) - REJECT
        // This prevents duplicate tabs/devices from joining with same username
        if (!player.disconnectedAt && player.gameId) {
          const existingGame = activeGames.get(player.gameId);
          if (existingGame && existingGame.status === 'ACTIVE') {
            console.log(`[REJECT] Username ${trimmedUsername} already in active game ${player.gameId}`);
            socket.emit('join_error', {
              code: 'USERNAME_IN_USE',
              message: 'Username already in use in another session'
            });
            return; // 🔴 STOP. Do NOT allow duplicate username
          }
        }
      }

      // BOT MODE: Start game immediately with bot opponent
      if (mode === 'BOT') {
        const game = createGame(
          { username: trimmedUsername, socketId: socket.id },
          { username: 'BOT', socketId: 'BOT' },
          'BOT',
          difficulty
        );

        // Register human player (bot doesn't need tracking)
        players.set(trimmedUsername, {
          socketId: socket.id,
          gameId: game.gameId,
          disconnectedAt: null,
        });

        socket.join(game.gameId);

        // FIX #1: Normalize game_start payload
        socket.emit('game_start', buildGamePayload(game));

        console.log(`Bot game started: ${game.gameId} (difficulty: ${difficulty})`);
        return; // Exit early - BOT game started
      }

      // PVP MODE: Match with another waiting player
      // Note: We already checked for duplicate username with waiting player at the top
      const currentWaitingPlayer = getWaitingPlayer();

      // FIX #4: Check if waiting player's socket is still connected
      // Prevent matching with disconnected sockets
      if (currentWaitingPlayer) {
        const waitingSocket = io.sockets.sockets.get(currentWaitingPlayer.socketId);
        if (!waitingSocket || !waitingSocket.connected) {
          // FIX #4: Waiting player disconnected, clear and continue
          console.log(`[FIX #4] Waiting player ${currentWaitingPlayer.username} disconnected, clearing queue`);
          clearWaitingPlayer();
        }
      }

      // Re-check after potential cleanup
      const validWaitingPlayer = getWaitingPlayer();

      // CASE 1: Someone is already waiting → start PVP game
      if (validWaitingPlayer) {
        // Double-check: prevent same username match (case-insensitive)
        if (validWaitingPlayer.username.toLowerCase() === trimmedUsername.toLowerCase()) {
          console.log(`[REJECT] Username ${trimmedUsername} tried to match with themselves`);
          socket.emit('join_error', {
            code: 'USERNAME_IN_USE',
            message: 'Username already in use in another session'
          });
          return;
        }

        clearWaitingPlayer();

        const game = createGame(
          validWaitingPlayer,
          { username: trimmedUsername, socketId: socket.id },
          'PVP',
          null  // no difficulty for PVP
        );

        // Register both players
        players.set(validWaitingPlayer.username, {
          socketId: validWaitingPlayer.socketId,
          gameId: game.gameId,
          disconnectedAt: null,
        });

        players.set(trimmedUsername, {
          socketId: socket.id,
          gameId: game.gameId,
          disconnectedAt: null,
        });

        // join sockets to room
        socket.join(game.gameId);
        io.to(validWaitingPlayer.socketId).socketsJoin(game.gameId);

        // FIX #1: Normalize game_start payload (includes mode, difficulty=null for PVP)
        io.to(game.gameId).emit('game_start', buildGamePayload(game));

        console.log('PVP Game started:', game.gameId);
      }
      // CASE 2: No one waiting → put this player in queue (PVP only)
      else {
        setWaitingPlayer({ username: trimmedUsername, socketId: socket.id });

        socket.emit('waiting_for_opponent');

        console.log(`${trimmedUsername} is waiting for PVP opponent`);
      }
    });

    socket.on('make_move', ({ gameId, column, username }) => {
      const game = activeGames.get(gameId);
      if (!game || game.status !== 'ACTIVE') return;

      if (game.currentTurn !== username) {
        socket.emit('error', 'Not your turn');
        return;
      }

      const move = dropDisc(game.board, column, username);
      if (!move) {
        socket.emit('error', 'Invalid move');
        return;
      }

      // FIX #5: Use checkWinWithCells to get winning cells for highlighting
      const { won, winningCells } = checkWinWithCells(game.board, move.row, move.col, username);

      if (won) {
        game.status = 'FINISHED';
        game.winner = username;

        // FIX #1 & #2: Normalize game_over payload with reason, mode, difficulty, winningCells
        io.to(game.gameId).emit('game_over', {
          ...buildGamePayload(game, { reason: 'win', winningCells }),
          winner: username,
        });

        // FIX #6: Persist with logging
        persistGame({
          gameId: game.gameId,
          player1: game.players[0].username,
          player2: game.players[1].username,
          winner: username,
          reason: 'win',
          mode: game.mode,
          difficulty: game.difficulty,
        });

        // Cleanup player registrations
        game.players.forEach(p => {
          if (p.username !== 'BOT') {
            players.delete(p.username);
          }
        });

        activeGames.delete(game.gameId);
        return;
      }

      if (isBoardFull(game.board)) {
        game.status = 'FINISHED';

        // FIX #1 & #2: Normalize game_over payload with reason
        io.to(game.gameId).emit('game_over', {
          ...buildGamePayload(game, { reason: 'draw' }),
          winner: null,
        });

        // FIX #6: Persist with logging
        persistGame({
          gameId: game.gameId,
          player1: game.players[0].username,
          player2: game.players[1].username,
          winner: null,
          reason: 'draw',
          mode: game.mode,
          difficulty: game.difficulty,
        });

        // Cleanup player registrations
        game.players.forEach(p => {
          if (p.username !== 'BOT') {
            players.delete(p.username);
          }
        });

        activeGames.delete(game.gameId);
        return;
      }

      // switch turn
      const [p1, p2] = game.players.map(p => p.username);
      game.currentTurn = game.currentTurn === p1 ? p2 : p1;

      // FIX #1: Normalize game_update payload to include all required fields
      io.to(game.gameId).emit('game_update', buildGamePayload(game));

      // BOT move - uses game.difficulty for EASY/MEDIUM/HARD behavior
      if (game.currentTurn === 'BOT') {
        setTimeout(() => {
          // FIX #2: Guard - check game is still active (handles race conditions)
          if (!game || game.status !== 'ACTIVE') {
            console.log('[BOT] Game no longer active, aborting bot move');
            return;
          }

          const opponent = game.players.find(p => p.username !== 'BOT').username;

          // FIX #2: Safe bot move with fallback
          let botMoveCol = getBotMove(game.board, 'BOT', opponent, game.difficulty);
          let botMove = null;

          // FIX #2: If primary move fails, try all valid columns
          if (botMoveCol !== null && botMoveCol !== undefined) {
            botMove = dropDisc(game.board, botMoveCol, 'BOT');
          }

          // FIX #2: Fallback - try any valid column if primary failed
          if (!botMove) {
            console.log('[BOT] Primary move failed, trying fallback columns');
            for (let col = 0; col < 7; col++) {
              if (game.board[0][col] === null) {
                botMove = dropDisc(game.board, col, 'BOT');
                if (botMove) {
                  console.log(`[BOT] Fallback move succeeded on column ${col}`);
                  break;
                }
              }
            }
          }

          // FIX #2: If no valid move exists, board must be full - end as draw
          if (!botMove) {
            console.log('[BOT] No valid moves available, ending as draw');
            game.status = 'FINISHED';

            io.to(game.gameId).emit('game_over', {
              ...buildGamePayload(game, { reason: 'draw' }),
              winner: null,
            });

            persistGame({
              gameId: game.gameId,
              player1: game.players[0].username,
              player2: game.players[1].username,
              winner: null,
              reason: 'draw',
              mode: game.mode,
              difficulty: game.difficulty,
            });

            game.players.forEach(p => {
              if (p.username !== 'BOT') {
                players.delete(p.username);
              }
            });

            activeGames.delete(game.gameId);
            return;
          }

          // FIX #5: Use checkWinWithCells for bot moves too
          const { won: botWon, winningCells: botWinningCells } = checkWinWithCells(
            game.board, botMove.row, botMove.col, 'BOT'
          );

          if (botWon) {
            game.status = 'FINISHED';

            // FIX #1 & #2: Normalize game_over payload
            io.to(game.gameId).emit('game_over', {
              ...buildGamePayload(game, { reason: 'win', winningCells: botWinningCells }),
              winner: 'BOT',
            });

            // FIX #6: Persist with logging
            persistGame({
              gameId: game.gameId,
              player1: game.players[0].username,
              player2: game.players[1].username,
              winner: 'BOT',
              reason: 'win',
              mode: game.mode,
              difficulty: game.difficulty,
            });

            // Cleanup
            game.players.forEach(p => {
              if (p.username !== 'BOT') {
                players.delete(p.username);
              }
            });

            activeGames.delete(game.gameId);
            return;
          }

          if (isBoardFull(game.board)) {
            game.status = 'FINISHED';

            // FIX #1 & #2: Normalize game_over payload
            io.to(game.gameId).emit('game_over', {
              ...buildGamePayload(game, { reason: 'draw' }),
              winner: null,
            });

            // FIX #6: Persist with logging
            persistGame({
              gameId: game.gameId,
              player1: game.players[0].username,
              player2: game.players[1].username,
              winner: null,
              reason: 'draw',
              mode: game.mode,
              difficulty: game.difficulty,
            });

            // Cleanup
            game.players.forEach(p => {
              if (p.username !== 'BOT') {
                players.delete(p.username);
              }
            });

            activeGames.delete(game.gameId);
            return;
          }

          game.currentTurn = game.players[0].username;
          // FIX #1: Normalize game_update payload to include all required fields
          io.to(game.gameId).emit('game_update', buildGamePayload(game));
        }, 700); // human-like delay
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);

      // FIX #4: Check if disconnected socket was the waiting player
      const waitingPlayer = getWaitingPlayer();
      if (waitingPlayer && waitingPlayer.socketId === socket.id) {
        console.log(`[FIX #4] Waiting player ${waitingPlayer.username} disconnected, clearing queue`);
        clearWaitingPlayer();
        return;  // No game to forfeit, just clear the queue
      }

      // PHASE 5: Find which player disconnected from an active game
      let usernameFound = null;

      for (const [username, player] of players.entries()) {
        if (player.socketId === socket.id) {
          usernameFound = username;
          break;
        }
      }

      if (!usernameFound) return;

      const player = players.get(usernameFound);
      const game = activeGames.get(player.gameId);

      if (!game || game.status !== 'ACTIVE') return;

      console.log(`Player disconnected: ${usernameFound} from game ${player.gameId}`);

      // Mark as disconnected
      player.disconnectedAt = Date.now();

      // Notify opponent
      socket.to(player.gameId).emit('opponent_disconnected', {
        username: usernameFound,
      });

      // Start 30s forfeit timer
      const timeout = setTimeout(() => {
        // FIX #3: Guard - check game is still active before forfeiting
        // Prevents race condition where reconnect happened but timer wasn't cleared
        const currentGame = activeGames.get(player.gameId);
        if (!currentGame || currentGame.status !== 'ACTIVE') {
          console.log(`[FORFEIT] Game ${player.gameId} already ended or player reconnected, skipping forfeit`);
          reconnectTimers.delete(player.gameId);
          return;
        }

        console.log(`Forfeit: ${usernameFound} did not reconnect`);

        // Find opponent (the other player or BOT)
        const opponent = currentGame.players.find(p => p.username !== usernameFound);
        const winner = opponent ? opponent.username : null;

        // FIX #1 & #2: Normalize game_over payload with reason
        io.to(player.gameId).emit('game_over', {
          ...buildGamePayload(currentGame, { reason: 'forfeit' }),
          winner,
        });

        // FIX #6: Persist with logging
        persistGame({
          gameId: currentGame.gameId,
          player1: currentGame.players[0].username,
          player2: currentGame.players[1].username,
          winner,
          reason: 'forfeit',
          mode: currentGame.mode,
          difficulty: currentGame.difficulty,
        });

        // Cleanup
        currentGame.players.forEach(p => {
          if (p.username !== 'BOT') {
            players.delete(p.username);
          }
        });
        activeGames.delete(player.gameId);
        reconnectTimers.delete(player.gameId);
      }, 30000);

      reconnectTimers.set(player.gameId, timeout);
    });
  });
};

