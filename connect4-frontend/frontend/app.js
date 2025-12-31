/**
 * BACKEND URL CONFIGURATION
 * -------------------------
 * For local development: Uses localhost:3000 by default
 *
 * For production deployment:
 * Option 1: Set window.BACKEND_URL before this script loads
 *   <script>window.BACKEND_URL = "https://your-backend.onrender.com";</script>
 *
 * Option 2: Use hosting platform environment injection (Netlify/Vercel)
 *
 * Option 3: Edit this constant directly before deploying
 */
const BACKEND_URL = window.BACKEND_URL || "http://localhost:3000";

const socket = io(BACKEND_URL);

let username = null;
let gameId = null;
let currentTurn = null;
let player1Name = null;
let player2Name = null;
let myRole = null; // Will be 'player1' or 'player2'
let gameActive = false; // Track if game is in progress
let isMyTurn = false; // Track if it's my turn
let selectedMode = "PVP"; // Current game mode: "PVP" or "BOT"
let selectedDifficulty = "MEDIUM"; // Bot difficulty: "EASY" or "MEDIUM"

// Debug logging (only in development)
const DEBUG = false;
if (DEBUG) {
  socket.onAny((eventName, ...args) => {
    console.log(`📡 Socket Event: ${eventName}`, args);
  });
}

socket.on("connect", () => {
  if (DEBUG) console.log("✅ Connected to backend:", socket.id);
});

socket.on("disconnect", () => {
  if (DEBUG) console.log("❌ Disconnected from backend");
  updateStatus("⚠️ Connection lost. Reconnecting...", "warning");
});

socket.on("connect_error", (error) => {
  if (DEBUG) console.log("🚨 Connection Error:", error.message);
  updateStatus("❌ Cannot connect to server", "error");
});

const boardDiv = document.getElementById("board");
const statusP = document.getElementById("status");
const joinBtn = document.getElementById("joinBtn");
const usernameInput = document.getElementById("username");
const leaderboardUl = document.getElementById("leaderboard");
const playerLegend = document.getElementById("player-legend");
const player1NameSpan = document.getElementById("player1-name");
const player2NameSpan = document.getElementById("player2-name");
const joinSection = document.getElementById("join");
const difficultySelector = document.getElementById("difficulty-selector");
const difficultySelect = document.getElementById("difficulty");
const gameModeRadios = document.querySelectorAll('input[name="gameMode"]');

// Game mode selection handler
gameModeRadios.forEach(radio => {
  radio.addEventListener("change", (e) => {
    selectedMode = e.target.value;
    // Show/hide difficulty selector based on mode
    if (selectedMode === "BOT") {
      difficultySelector.style.display = "flex";
    } else {
      difficultySelector.style.display = "none";
    }
  });
});

// Difficulty selection handler
if (difficultySelect) {
  difficultySelect.addEventListener("change", (e) => {
    selectedDifficulty = e.target.value;
  });
}

// Validation helpers
function validateUsername(name) {
  if (!name || name.length < 2) {
    return { valid: false, message: "Username must be at least 2 characters" };
  }
  if (name.length > 20) {
    return { valid: false, message: "Username must be 20 characters or less" };
  }
  if (!/^[a-zA-Z0-9@._-]+$/.test(name)) {
    return { valid: false, message: "Username can only contain letters, numbers, @, ., _ and -" };
  }
  return { valid: true };
}

function setJoinLoading(loading) {
  if (loading) {
    joinBtn.disabled = true;
    joinBtn.innerText = "Joining...";
    joinBtn.classList.add("loading");
    usernameInput.disabled = true;
    // Disable mode selection while joining
    gameModeRadios.forEach(r => r.disabled = true);
    if (difficultySelect) difficultySelect.disabled = true;
  } else {
    joinBtn.disabled = false;
    joinBtn.innerText = "Join Game";
    joinBtn.classList.remove("loading");
    usernameInput.disabled = false;
    // Re-enable mode selection
    gameModeRadios.forEach(r => r.disabled = false);
    if (difficultySelect) difficultySelect.disabled = false;
  }
}

function showError(input, message) {
  // Remove existing error
  const existingError = input.parentElement.querySelector('.error-message');
  if (existingError) existingError.remove();

  // Add error styling and message
  input.classList.add('input-error');
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.innerText = message;
  input.parentElement.appendChild(errorDiv);
}

function clearError(input) {
  input.classList.remove('input-error');
  const existingError = input.parentElement.querySelector('.error-message');
  if (existingError) existingError.remove();
}

joinBtn.onclick = () => {
  // Prevent multiple clicks
  if (joinBtn.disabled) return;

  const inputValue = usernameInput.value.trim();
  clearError(usernameInput);

  const validation = validateUsername(inputValue);
  if (!validation.valid) {
    showError(usernameInput, validation.message);
    return;
  }

  username = inputValue;
  setJoinLoading(true);

  // Build payload with mode and optional difficulty
  const payload = {
    username,
    mode: selectedMode
  };

  // Only include difficulty for BOT mode
  if (selectedMode === "BOT") {
    payload.difficulty = selectedDifficulty;
    updateStatus(`⏳ Starting game vs Bot (${selectedDifficulty})...`, "waiting");
  } else {
    updateStatus("⏳ Waiting for opponent...", "waiting");
  }

  socket.emit("join_game", payload);

  // Timeout in case server doesn't respond
  setTimeout(() => {
    if (!gameId && joinBtn.disabled) {
      if (selectedMode === "PVP") {
        updateStatus("⏳ Still waiting for opponent...", "waiting");
      }
    }
  }, 3000);
};

// Enter key to join
usernameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') joinBtn.click();
});

function updatePlayerLegend(p1, p2) {
  player1Name = p1;
  player2Name = p2;
  player1NameSpan.innerText = p1;
  player2NameSpan.innerText = p2;

  // Update indicator class based on if it's BOT
  const player2Indicator = document.querySelector('#player2-info .player-indicator');
  if (player2Indicator) {
    if (p2 === 'BOT') {
      player2Indicator.className = 'player-indicator bot-indicator';
    } else {
      player2Indicator.className = 'player-indicator player2-indicator';
    }
  }

  playerLegend.style.display = 'flex';
}

// Toast notification system
function showToast(message, type = 'warning') {
  // Remove existing toast
  const existingToast = document.querySelector('.toast');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerText = message;
  document.body.appendChild(toast);

  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 10);

  // Remove after 2.5s
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

function renderBoard(board) {
  if (!board || !Array.isArray(board)) return;

  boardDiv.innerHTML = "";

  // Update board interactivity based on game state
  if (!gameActive) {
    boardDiv.classList.add('board-disabled');
  } else if (!isMyTurn) {
    boardDiv.classList.add('board-waiting');
  } else {
    boardDiv.classList.remove('board-disabled', 'board-waiting');
  }

  board.forEach((row, _r) => {
    if (!row || !Array.isArray(row)) return;
    row.forEach((cell, c) => {
      const div = document.createElement("div");

      // Map cell values to CSS classes based on player roles
      let cellClass = "cell";
      if (cell) {
        if (cell === "BOT") {
          cellClass += " BOT";
        } else if (cell === player1Name) {
          cellClass += " player1";
        } else if (cell === player2Name) {
          cellClass += " player2";
        } else {
          cellClass += cell === username ? " player1" : " player2";
        }
      }

      div.className = cellClass;

      // Add click handler with feedback
      div.onclick = () => {
        if (!gameActive) {
          showToast("⏳ Game hasn't started yet", "info");
          return;
        }
        if (!isMyTurn) {
          // Show feedback that it's not their turn
          div.classList.add('invalid-click');
          setTimeout(() => div.classList.remove('invalid-click'), 300);
          showToast(`⏳ Wait for ${currentTurn}'s move`, "warning");
          return;
        }
        if (cell) {
          // Cell already occupied
          div.classList.add('invalid-click');
          setTimeout(() => div.classList.remove('invalid-click'), 300);
          showToast("❌ This spot is already taken!", "error");
          return;
        }
        socket.emit("make_move", {
          gameId,
          column: c,
          username,
        });
      };
      boardDiv.appendChild(div);
    });
  });
}

function updateStatus(message, type = "default") {
  statusP.innerText = message;
  statusP.className = 'status-' + type;
}

/* Socket events */

socket.on("waiting_for_opponent", () => {
  // Only show waiting message for PVP mode
  if (selectedMode === "PVP") {
    updateStatus("⏳ Waiting for opponent...", "waiting");
  }
  gameActive = false;
});

socket.on("game_start", (data) => {
  if (!data) return;

  gameId = data.gameId;
  currentTurn = data.currentTurn;
  gameActive = true;

  // Hide join section when game starts
  if (joinSection) joinSection.style.display = 'none';

  // Determine player roles from backend data
  if (data.player1) {
    player1Name = data.player1;
    player2Name = data.player2 || 'BOT';
  } else {
    player1Name = data.players ? data.players[0] : username;
    player2Name = data.players ? data.players[1] : (data.opponent || 'BOT');
  }

  // Determine my role
  myRole = (username === player1Name) ? 'player1' : 'player2';
  isMyTurn = currentTurn === username;

  updatePlayerLegend(player1Name, player2Name);

  // Show appropriate status based on game mode
  if (isMyTurn) {
    updateStatus("🟢 Your Turn! Click a column to drop your piece", "your-turn");
  } else if (player2Name === 'BOT') {
    updateStatus("🤖 Bot is thinking...", "waiting");
  } else {
    updateStatus(`⏳ ${currentTurn}'s Turn`, "waiting");
  }
  renderBoard(data.board);
});

socket.on("game_update", (data) => {
  if (!data) return;

  currentTurn = data.currentTurn;
  isMyTurn = currentTurn === username;

  if (isMyTurn) {
    updateStatus("🟢 Your Turn! Click a column", "your-turn");
  } else if (currentTurn === 'BOT') {
    updateStatus("🤖 Bot is thinking...", "waiting");
  } else {
    updateStatus(`⏳ Waiting for ${currentTurn}...`, "waiting");
  }
  renderBoard(data.board);
});

socket.on("game_over", (data) => {
  if (!data) return;

  gameActive = false;
  isMyTurn = false;

  let resultType = 'draw';
  let title = "🤝 It's a Draw!";
  let subtitle = "Well played by both!";

  if (data.winner) {
    const isWinner = data.winner === username;
    if (isWinner) {
      resultType = 'win';
      title = "🎉 Victory!";
      subtitle = "Congratulations, you won!";
      updateStatus("🎉 VICTORY!", "winner");
      boardDiv.classList.add('game-won');
    } else {
      resultType = 'lose';
      title = "Game Over";
      subtitle = `${data.winner} wins this round`;
      updateStatus(`${data.winner} Wins`, "loser");
      boardDiv.classList.add('game-lost');
    }
  } else {
    updateStatus("🤝 Draw!", "draw");
  }

  renderBoard(data.board);

  // Show game over modal
  setTimeout(() => {
    showGameOverModal(resultType, title, subtitle);
  }, 800);

  // Reload leaderboard after game ends
  setTimeout(() => {
    loadLeaderboard();
  }, 1000);
});

function showGameOverModal(resultType, title, subtitle) {
  // Remove existing modal
  const existingModal = document.querySelector('.game-over-modal');
  if (existingModal) existingModal.remove();

  const overlay = document.createElement('div');
  overlay.className = 'game-over-modal';

  const modal = document.createElement('div');
  modal.className = `modal-content modal-${resultType}`;

  modal.innerHTML = `
    <div class="modal-icon">${resultType === 'win' ? '🏆' : resultType === 'lose' ? '😔' : '🤝'}</div>
    <h2 class="modal-title">${title}</h2>
    <p class="modal-subtitle">${subtitle}</p>
    <button class="modal-btn" id="playAgainModalBtn">Play Again</button>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Trigger animation
  setTimeout(() => overlay.classList.add('show'), 10);

  // Play again button
  document.getElementById('playAgainModalBtn').onclick = () => {
    overlay.classList.remove('show');
    setTimeout(() => {
      overlay.remove();
      resetGame();
    }, 300);
  };

  // Click outside to close
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('show');
      setTimeout(() => {
        overlay.remove();
        resetGame();
      }, 300);
    }
  };
}

function resetGame() {
  boardDiv.classList.remove('game-won', 'game-lost');
  gameId = null;
  gameActive = false;
  isMyTurn = false;

  // Directly start a new game with the same username and mode
  if (username) {
    playerLegend.style.display = 'none';
    boardDiv.innerHTML = '';

    // Build payload with same mode as before
    const payload = {
      username,
      mode: selectedMode
    };

    if (selectedMode === "BOT") {
      payload.difficulty = selectedDifficulty;
      updateStatus(`⏳ Starting game vs Bot (${selectedDifficulty})...`, "waiting");
    } else {
      updateStatus("⏳ Finding new game...", "waiting");
    }

    socket.emit("join_game", payload);
  } else {
    // Fallback to join screen if no username
    if (joinSection) joinSection.style.display = 'block';
    setJoinLoading(false);
    updateStatus("Ready to play!", "default");
    boardDiv.innerHTML = '';
    playerLegend.style.display = 'none';
  }
}

function showPlayAgain() {
  // Legacy function - now handled by modal
  // Keeping for backwards compatibility
  const existingBtn = document.getElementById('playAgainBtn');
  if (existingBtn) return;
}

/* Phase 5 events */

socket.on("game_resume", (data) => {
  if (!data) return;

  gameId = data.gameId;
  currentTurn = data.currentTurn;
  gameActive = true;

  if (joinSection) joinSection.style.display = 'none';

  if (data.player1) {
    player1Name = data.player1;
    player2Name = data.player2 || 'BOT';
  } else {
    player1Name = data.players ? data.players[0] : username;
    player2Name = data.players ? data.players[1] : (data.opponent || 'BOT');
  }

  myRole = (username === player1Name) ? 'player1' : 'player2';
  isMyTurn = currentTurn === username;

  updatePlayerLegend(player1Name, player2Name);

  if (isMyTurn) {
    updateStatus("🔄 Game Resumed — Your Turn!", "your-turn");
  } else {
    updateStatus(`🔄 Game Resumed — ${currentTurn}'s Turn`, "waiting");
  }
  renderBoard(data.board);
});

socket.on("opponent_disconnected", (data) => {
  if (!data) return;
  updateStatus(`⚠️ ${data.username} disconnected. Waiting...`, "warning");
});

socket.on("opponent_reconnected", (data) => {
  if (!data) return;
  isMyTurn = currentTurn === username;
  if (isMyTurn) {
    updateStatus(`✅ ${data.username} is back! Your Turn!`, "your-turn");
  } else {
    updateStatus(`✅ ${data.username} is back! Their Turn`, "waiting");
  }
});

/* Leaderboard */

async function loadLeaderboard() {
  try {
    const res = await fetch(`${BACKEND_URL}/leaderboard`);
    if (!res.ok) throw new Error('Failed to load');
    const data = await res.json();
    if (!data || !Array.isArray(data)) return;

    leaderboardUl.innerHTML = "";
    if (data.length === 0) {
      const li = document.createElement("li");
      li.innerText = "No games played yet";
      li.className = "empty-state";
      leaderboardUl.appendChild(li);
      return;
    }

    data.forEach((p, index) => {
      if (!p) return;
      const li = document.createElement("li");
      const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "";

      // Build wins display - handle difficulty-separated stats if available
      let winsText = `${p.wins || 0} wins`;

      // If backend provides bot wins by difficulty, show breakdown
      if (p.botWins && typeof p.botWins === 'object') {
        const parts = [];
        if (p.pvpWins) parts.push(`PVP: ${p.pvpWins}`);
        if (p.botWins.EASY) parts.push(`Easy: ${p.botWins.EASY}`);
        if (p.botWins.MEDIUM) parts.push(`Med: ${p.botWins.MEDIUM}`);
        if (p.botWins.HARD) parts.push(`Hard: ${p.botWins.HARD}`);
        if (parts.length > 0) {
          winsText = parts.join(' · ');
        }
      }

      li.innerHTML = `<span class="rank">${medal || (index + 1)}</span> <span class="lb-name">${p.username || 'Unknown'}</span> <span class="lb-wins">${winsText}</span>`;
      leaderboardUl.appendChild(li);
    });
  } catch (err) {
    // Silent fail - leaderboard is not critical
    if (DEBUG) console.log("Leaderboard load failed:", err);
  }
}

loadLeaderboard();

