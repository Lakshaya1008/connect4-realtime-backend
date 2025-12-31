const {
  createGame,
  getWaitingPlayer,
  setWaitingPlayer,
  clearWaitingPlayer,
  activeGames,
  players,
  reconnectTimers,
} = require('../game/gameManager');
const { dropDisc, checkWin, isBoardFull } = require('../game/gameLogic');
const { getBotMove } = require('../game/botLogic');
const { recordResult } = require('../db/playerStats');
const db = require('../db/pg');

// PHASE 6: Persist game results to database
// Updated to include mode and difficulty for game mode support
async function persistGame({ gameId, player1, player2, winner, reason, mode, difficulty }) {
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
      });
    } else {
      // Win/Loss
      const loser = winner === player1 ? player2 : player1;
      await recordResult({
        winner,
        loser,
        isDraw: false,
      });
    }
  } catch (error) {
    console.error('Failed to persist game:', error.message);
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

      console.log(`${username} wants to join a ${mode} game${mode === 'BOT' ? ` (difficulty: ${difficulty})` : ''}`);

      // PHASE 5: RECONNECTION CHECK
      if (players.has(username)) {
        const player = players.get(username);

        // Player was in a game and disconnected
        if (player.disconnectedAt && player.gameId) {
          const game = activeGames.get(player.gameId);

          if (game && game.status === 'ACTIVE') {
            // Cancel forfeit timer
            if (reconnectTimers.has(player.gameId)) {
              clearTimeout(reconnectTimers.get(player.gameId));
              reconnectTimers.delete(player.gameId);
              console.log(`Reconnect timer cancelled for ${username}`);
            }

            // Rebind socket
            player.socketId = socket.id;
            player.disconnectedAt = null;

            // Update game socket mapping
            game.sockets[username] = socket.id;
            socket.join(player.gameId);

            // Resume game
            socket.emit('game_resume', {
              gameId: player.gameId,
              board: game.board,
              currentTurn: game.currentTurn,
              players: game.players.map(p => p.username),
            });

            // Notify opponent
            socket.to(player.gameId).emit('opponent_reconnected', {
              username,
            });

            console.log(`${username} reconnected to game ${player.gameId}`);
            return; // 🔴 STOP. Do NOT create a new game
          }
        }
      }

      // BOT MODE: Start game immediately with bot opponent
      if (mode === 'BOT') {
        const game = createGame(
          { username, socketId: socket.id },
          { username: 'BOT', socketId: 'BOT' },
          'BOT',      // mode
          difficulty  // difficulty (EASY or MEDIUM)
        );

        // Register human player (bot doesn't need tracking)
        players.set(username, {
          socketId: socket.id,
          gameId: game.gameId,
          disconnectedAt: null,
        });

        socket.join(game.gameId);

        socket.emit('game_start', {
          gameId: game.gameId,
          players: [username, 'BOT'],
          currentTurn: game.currentTurn,
          board: game.board,
          mode: game.mode,
          difficulty: game.difficulty,
        });

        console.log(`Bot game started: ${game.gameId} (difficulty: ${difficulty})`);
        return; // Exit early - BOT game started
      }

      // PVP MODE: Match with another waiting player
      const waitingPlayer = getWaitingPlayer();

      // CASE 1: Someone is already waiting → start PVP game
      if (waitingPlayer) {
        clearWaitingPlayer();

        const game = createGame(
          waitingPlayer,
          { username, socketId: socket.id },
          'PVP',  // mode
          null    // no difficulty for PVP
        );

        // Register both players
        players.set(waitingPlayer.username, {
          socketId: waitingPlayer.socketId,
          gameId: game.gameId,
          disconnectedAt: null,
        });

        players.set(username, {
          socketId: socket.id,
          gameId: game.gameId,
          disconnectedAt: null,
        });

        // join sockets to room
        socket.join(game.gameId);
        io.to(waitingPlayer.socketId).socketsJoin(game.gameId);

        io.to(game.gameId).emit('game_start', {
          gameId: game.gameId,
          players: game.players.map(p => p.username),
          currentTurn: game.currentTurn,
          board: game.board,
          mode: game.mode,
        });

        console.log('PVP Game started:', game.gameId);
      }
      // CASE 2: No one waiting → put this player in queue (PVP only)
      // Note: No auto-fallback to bot - player must explicitly choose BOT mode
      else {
        setWaitingPlayer({ username, socketId: socket.id });

        socket.emit('waiting_for_opponent');

        console.log(`${username} is waiting for PVP opponent`);
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

      const won = checkWin(game.board, move.row, move.col, username);

      if (won) {
        game.status = 'FINISHED';
        game.winner = username;

        io.to(game.gameId).emit('game_over', {
          winner: username,
          board: game.board,
        });

        // PHASE 6: Persist to database (non-blocking)
        persistGame({
          gameId: game.gameId,
          player1: game.players[0].username,
          player2: game.players[1].username,
          winner: username,
          reason: 'win',
          mode: game.mode,
          difficulty: game.difficulty,
        }).catch(err => console.error('Persist error:', err));

        // PHASE 5: Cleanup player registrations
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

        io.to(game.gameId).emit('game_over', {
          winner: null,
          board: game.board,
        });

        // PHASE 6: Persist to database (non-blocking)
        persistGame({
          gameId: game.gameId,
          player1: game.players[0].username,
          player2: game.players[1].username,
          winner: null,
          reason: 'draw',
          mode: game.mode,
          difficulty: game.difficulty,
        }).catch(err => console.error('Persist error:', err));

        // PHASE 5: Cleanup player registrations
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

      io.to(game.gameId).emit('game_update', {
        board: game.board,
        currentTurn: game.currentTurn,
      });

      // BOT move - uses game.difficulty for EASY/MEDIUM behavior
      if (game.currentTurn === 'BOT') {
        setTimeout(() => {
          const opponent = game.players.find(p => p.username !== 'BOT').username;
          // Use getBotMove which respects difficulty setting
          const botMoveCol = getBotMove(game.board, 'BOT', opponent, game.difficulty);
          const move = dropDisc(game.board, botMoveCol, 'BOT');

          if (!move) return;

          if (checkWin(game.board, move.row, move.col, 'BOT')) {
            game.status = 'FINISHED';
            io.to(game.gameId).emit('game_over', {
              winner: 'BOT',
              board: game.board,
            });

            // PHASE 6: Persist to database (non-blocking)
            persistGame({
              gameId: game.gameId,
              player1: game.players[0].username,
              player2: game.players[1].username,
              winner: 'BOT',
              reason: 'win',
              mode: game.mode,
              difficulty: game.difficulty,
            }).catch(err => console.error('Persist error:', err));

            // PHASE 5: Cleanup player registrations
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
            io.to(game.gameId).emit('game_over', {
              winner: null,
              board: game.board,
            });

            // PHASE 6: Persist to database (non-blocking)
            persistGame({
              gameId: game.gameId,
              player1: game.players[0].username,
              player2: game.players[1].username,
              winner: null,
              reason: 'draw',
              mode: game.mode,
              difficulty: game.difficulty,
            }).catch(err => console.error('Persist error:', err));

            // PHASE 5: Cleanup player registrations
            game.players.forEach(p => {
              if (p.username !== 'BOT') {
                players.delete(p.username);
              }
            });

            activeGames.delete(game.gameId);
            return;
          }

          game.currentTurn = game.players[0].username;
          io.to(game.gameId).emit('game_update', {
            board: game.board,
            currentTurn: game.currentTurn,
          });
        }, 700); // human-like delay
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);

      // PHASE 5: Find which player disconnected
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
        console.log(`Forfeit: ${usernameFound} did not reconnect`);

        // Find opponent (the other non-BOT player or BOT)
        const opponent = game.players.find(p => p.username !== usernameFound);
        const winner = opponent ? opponent.username : null;

        io.to(player.gameId).emit('game_over', {
          winner,
          reason: 'forfeit',
          board: game.board,
        });

        // PHASE 6: Persist to database (non-blocking)
        persistGame({
          gameId: game.gameId,
          player1: game.players[0].username,
          player2: game.players[1].username,
          winner,
          reason: 'forfeit',
          mode: game.mode,
          difficulty: game.difficulty,
        }).catch(err => console.error('Persist error:', err));

        // Cleanup
        game.players.forEach(p => {
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

