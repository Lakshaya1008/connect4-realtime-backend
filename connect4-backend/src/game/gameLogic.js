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

function checkWin(board, row, col, player) {
  const directions = [
    [[0, -1], [0, 1]],     // horizontal
    [[-1, 0], [1, 0]],     // vertical
    [[-1, -1], [1, 1]],   // diagonal \
    [[-1, 1], [1, -1]],   // diagonal /
  ];

  for (const [[dr1, dc1], [dr2, dc2]] of directions) {
    const count =
      checkDirection(board, row, col, dr1, dc1, player) +
      checkDirection(board, row + dr2, col + dc2, dr2, dc2, player) -
      1;

    if (count >= 4) return true;
  }

  return false;
}

function isBoardFull(board) {
  return board[0].every(cell => cell !== null);
}

module.exports = {
  dropDisc,
  checkWin,
  isBoardFull,
};

