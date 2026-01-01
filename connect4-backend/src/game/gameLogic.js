const ROWS = 6;
const COLS = 7;

function dropDisc(board, col, player) {
  if (col < 0 || col >= COLS) return null;

  for (let row = ROWS - 1; row >= 0; row--) {
    if (!board[row][col]) {
      board[row][col] = player;
      return { row, col };
    }
  }
  return null; // column full
}

function checkDirection(board, row, col, dr, dc, player) {
  let count = 0;
  let r = row;
  let c = col;

  while (
    r >= 0 &&
    r < ROWS &&
    c >= 0 &&
    c < COLS &&
    board[r][c] === player
  ) {
    count++;
    r += dr;
    c += dc;
  }
  return count;
}

// FIX #5: Helper to collect winning cells in a direction
// Used by checkWinWithCells to return the actual winning positions
function collectCellsInDirection(board, row, col, dr, dc, player) {
  const cells = [];
  let r = row;
  let c = col;

  while (
    r >= 0 &&
    r < ROWS &&
    c >= 0 &&
    c < COLS &&
    board[r][c] === player
  ) {
    cells.push({ row: r, col: c });
    r += dr;
    c += dc;
  }
  return cells;
}

/**
 * FIX #5: DESIGN DECISION - WIN HIGHLIGHTING
 *
 * checkWin() returns boolean only (for backward compatibility).
 * checkWinWithCells() returns { won: boolean, winningCells: Array | null }
 *
 * Frontend can use winningCells to highlight the winning line.
 * winningCells is an array of { row, col } objects representing the 4+ winning positions.
 */
function checkWin(board, row, col, player) {
  const result = checkWinWithCells(board, row, col, player);
  return result.won;
}

// FIX #5: New function that returns winning cells for highlighting
// Returns: { won: boolean, winningCells: Array<{row, col}> | null }
function checkWinWithCells(board, row, col, player) {
  const directions = [
    [[0, -1], [0, 1]],     // horizontal
    [[-1, 0], [1, 0]],     // vertical
    [[-1, -1], [1, 1]],   // diagonal \
    [[-1, 1], [1, -1]],   // diagonal /
  ];

  for (const [[dr1, dc1], [dr2, dc2]] of directions) {
    // Collect cells in both directions
    const cells1 = collectCellsInDirection(board, row, col, dr1, dc1, player);
    const cells2 = collectCellsInDirection(board, row + dr2, col + dc2, dr2, dc2, player);

    // Combine cells (cells1 includes the starting cell, so we exclude duplicate)
    const allCells = [...cells1, ...cells2];

    if (allCells.length >= 4) {
      return { won: true, winningCells: allCells };
    }
  }

  return { won: false, winningCells: null };
}

function isBoardFull(board) {
  return board[0].every(cell => cell !== null);
}

module.exports = {
  dropDisc,
  checkWin,
  checkWinWithCells,  // FIX #5: Export new function for win highlighting
  isBoardFull,
};
