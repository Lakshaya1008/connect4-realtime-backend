const { dropDisc, checkWin } = require('./gameLogic');

function cloneBoard(board) {
  return board.map(row => [...row]);
}

function getValidColumns(board) {
  return [...Array(7).keys()].filter(col => board[0][col] === null);
}

// EASY difficulty: Random valid move
// No strategy, pure randomness
function findRandomMove(board) {
  const validCols = getValidColumns(board);
  if (validCols.length === 0) return null;
  return validCols[Math.floor(Math.random() * validCols.length)];
}

// MEDIUM difficulty: Strategic move (win > block > center > fallback)
// Single-ply heuristic evaluation
function findMediumMove(board, bot, opponent) {
  const validCols = getValidColumns(board);

  // 1. Winning move - take it immediately
  for (const col of validCols) {
    const temp = cloneBoard(board);
    const move = dropDisc(temp, col, bot);
    if (move && checkWin(temp, move.row, move.col, bot)) {
      return col;
    }
  }

  // 2. Block opponent's winning move
  for (const col of validCols) {
    const temp = cloneBoard(board);
    const move = dropDisc(temp, col, opponent);
    if (move && checkWin(temp, move.row, move.col, opponent)) {
      return col;
    }
  }

  // 3. Prefer center column (strategic advantage)
  if (validCols.includes(3)) return 3;

  // 4. Fallback to first valid column
  return validCols[0];
}

// HARD difficulty: Shallow lookahead (1-2 ply) with position evaluation
// Looks ahead to see consequences of moves, but NOT full minimax
function findHardMove(board, bot, opponent) {
  const validCols = getValidColumns(board);
  if (validCols.length === 0) return null;

  // Score each column based on lookahead evaluation
  const scores = validCols.map(col => {
    const score = evaluateMove(board, col, bot, opponent);
    return { col, score };
  });

  // Sort by score (highest first) and pick best
  scores.sort((a, b) => b.score - a.score);
  return scores[0].col;
}

// Evaluate a move with 1-2 ply lookahead
// Returns a score: higher is better for bot
function evaluateMove(board, col, bot, opponent) {
  const temp = cloneBoard(board);
  const move = dropDisc(temp, col, bot);

  if (!move) return -1000; // Invalid move

  // Immediate win = highest priority
  if (checkWin(temp, move.row, move.col, bot)) {
    return 10000;
  }

  let score = 0;

  // Evaluate center preference (columns closer to center are better)
  score += (3 - Math.abs(col - 3)) * 10;

  // Check if this move blocks opponent's win
  const blockTest = cloneBoard(board);
  const blockMove = dropDisc(blockTest, col, opponent);
  if (blockMove && checkWin(blockTest, blockMove.row, blockMove.col, opponent)) {
    score += 500; // Blocking is important
  }

  // Lookahead: Check opponent's responses (1 ply ahead)
  const opponentCols = getValidColumns(temp);
  for (const oppCol of opponentCols) {
    const tempOpp = cloneBoard(temp);
    const oppMove = dropDisc(tempOpp, oppCol, opponent);

    if (oppMove && checkWin(tempOpp, oppMove.row, oppMove.col, opponent)) {
      // This move allows opponent to win next turn = bad
      score -= 800;
      break;
    }
  }

  // Lookahead: Check if bot can set up a winning threat (2 ply ahead)
  for (const nextCol of opponentCols) {
    const tempNext = cloneBoard(temp);
    // Simulate opponent makes a non-critical move
    dropDisc(tempNext, nextCol, opponent);

    // Can bot win after that?
    const botNextCols = getValidColumns(tempNext);
    for (const botNextCol of botNextCols) {
      const tempBot = cloneBoard(tempNext);
      const botNextMove = dropDisc(tempBot, botNextCol, bot);
      if (botNextMove && checkWin(tempBot, botNextMove.row, botNextMove.col, bot)) {
        score += 100; // Creates winning opportunity
        break;
      }
    }
  }

  // Count connected pieces (building threats)
  score += countConnected(temp, move.row, move.col, bot) * 5;

  return score;
}

// Count how many pieces are connected to this position
function countConnected(board, row, col, player) {
  const directions = [
    [0, 1],   // horizontal
    [1, 0],   // vertical
    [1, 1],   // diagonal /
    [1, -1],  // diagonal \
  ];

  let total = 0;
  for (const [dr, dc] of directions) {
    let count = 1;
    // Count in positive direction
    for (let i = 1; i < 4; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === player) {
        count++;
      } else break;
    }
    // Count in negative direction
    for (let i = 1; i < 4; i++) {
      const r = row - dr * i;
      const c = col - dc * i;
      if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === player) {
        count++;
      } else break;
    }
    total += count;
  }
  return total;
}

// Unified bot move function - single entry point
// difficulty: 'EASY' | 'MEDIUM' | 'HARD' (default: MEDIUM)
function getBotMove(board, bot, opponent, difficulty = 'MEDIUM') {
  switch (difficulty) {
    case 'EASY':
      return findRandomMove(board);
    case 'HARD':
      return findHardMove(board, bot, opponent);
    case 'MEDIUM':
    default:
      return findMediumMove(board, bot, opponent);
  }
}

// Export for backward compatibility
module.exports = {
  findBestMove: findMediumMove, // Alias for backward compat
  findRandomMove,
  findMediumMove,
  findHardMove,
  getBotMove
};

