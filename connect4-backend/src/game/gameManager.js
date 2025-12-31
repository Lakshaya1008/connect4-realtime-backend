const { v4: uuidv4 } = require('uuid');

// waiting player (only one needed)
let waitingPlayer = null;

// active games
const activeGames = new Map();

// PHASE 5: Player tracking (username -> player data)
// { socketId, gameId, disconnectedAt }
const players = new Map();

// PHASE 5: Reconnection timers (gameId -> timeout)
const reconnectTimers = new Map();

/*
Game structure:
{
  gameId,
  players: [{ username, socketId }, { username, socketId | 'BOT' }],
  sockets: { username: socketId },  // for reconnection
  board,
  currentTurn,
  status,
  mode,        // 'PVP' | 'BOT' - game mode
  difficulty,  // 'EASY' | 'MEDIUM' | 'HARD' | null - only for BOT games
  lastSeen: { username: timestamp }
}
*/

function createEmptyBoard() {
  return Array.from({ length: 6 }, () => Array(7).fill(null));
}

// Updated to accept mode and difficulty for game mode support
// mode: 'PVP' | 'BOT'
// difficulty: 'EASY' | 'MEDIUM' | 'HARD' (only for BOT games, default: MEDIUM)
function createGame(player1, player2, mode = 'PVP', difficulty = null) {
  const gameId = uuidv4();

  // Determine actual difficulty (only applicable for BOT games)
  // Valid difficulties: EASY, MEDIUM, HARD. Default to MEDIUM if invalid.
  const validDifficulties = ['EASY', 'MEDIUM', 'HARD'];
  const actualDifficulty = mode === 'BOT'
    ? (validDifficulties.includes(difficulty) ? difficulty : 'MEDIUM')
    : null;

  const game = {
    gameId,
    players: [player1, player2],
    sockets: {
      [player1.username]: player1.socketId,
      [player2.username]: player2.socketId,
    },
    board: createEmptyBoard(),
    currentTurn: player1.username,
    status: 'ACTIVE',
    mode,              // Store game mode (PVP or BOT)
    difficulty: actualDifficulty,  // Store difficulty (only for BOT games)
    lastSeen: {
      [player1.username]: Date.now(),
      [player2.username]: Date.now(),
    },
  };

  activeGames.set(gameId, game);
  return game;
}

module.exports = {
  activeGames,
  createGame,
  getWaitingPlayer: () => waitingPlayer,
  setWaitingPlayer: (player) => (waitingPlayer = player),
  clearWaitingPlayer: () => (waitingPlayer = null),
  players,
  reconnectTimers,
};

