/* =======================
   CONFIG + SOCKET INIT
======================= */

const BACKEND_URL = window.BACKEND_URL || "http://localhost:3000";

console.info("[config] BACKEND_URL:", BACKEND_URL);
console.info("[config] io available:", typeof io !== "undefined");

if (typeof io === "undefined") {
  console.error("❌ Socket.IO client not loaded");
}

const socket = io(BACKEND_URL, {
  transports: ["websocket"],
});

/* =======================
   GLOBAL STATE
======================= */

let username = null;
let gameId = null;
let currentTurn = null;
let player1Name = null;
let player2Name = null;
let gameActive = false;
let isMyTurn = false;
let selectedMode = "PVP";
let selectedDifficulty = "MEDIUM";

/* =======================
   DOM REFERENCES
======================= */

const boardDiv = document.getElementById("board");
const statusP = document.getElementById("status");
const joinBtn = document.getElementById("joinBtn");
const usernameInput = document.getElementById("username");
const leaderboardUl = document.getElementById("leaderboard");
const joinSection = document.getElementById("join");
const difficultySelector = document.getElementById("difficulty-selector");
const difficultySelect = document.getElementById("difficulty");
const gameModeRadios = document.querySelectorAll('input[name="gameMode"]');
const playerLegend = document.getElementById("player-legend");
const player1NameSpan = document.getElementById("player1-name");
const player2NameSpan = document.getElementById("player2-name");

/* =======================
   TOAST SYSTEM (UNCHANGED)
======================= */

function showToast(message, type = "warning") {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerText = message;

  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

/* =======================
   STATUS
======================= */

function updateStatus(message, type = "default") {
  statusP.innerText = message;
  statusP.className = `status-${type}`;
}

/* =======================
   GAME MODE HANDLING
======================= */

gameModeRadios.forEach(radio => {
  radio.addEventListener("change", e => {
    selectedMode = e.target.value;
    difficultySelector.style.display =
        selectedMode === "BOT" ? "flex" : "none";
  });
});

difficultySelect.addEventListener("change", e => {
  selectedDifficulty = e.target.value;
});

/* =======================
   JOIN GAME
======================= */

joinBtn.onclick = () => {
  username = usernameInput.value.trim();
  if (!username) {
    showToast("Username required", "error");
    return;
  }

  const payload = { username, mode: selectedMode };
  if (selectedMode === "BOT") payload.difficulty = selectedDifficulty;

  updateStatus(
      selectedMode === "BOT"
          ? `🤖 Starting bot (${selectedDifficulty})...`
          : "⏳ Waiting for opponent...",
      "waiting"
  );

  socket.emit("join_game", payload);
};

/* =======================
   RENDER BOARD
======================= */

function renderBoard(board) {
  boardDiv.innerHTML = "";

  board.forEach(row => {
    row.forEach((cell, col) => {
      const div = document.createElement("div");
      div.className = "cell";

      if (cell === player1Name) div.classList.add("player1");
      if (cell === player2Name) div.classList.add("player2");
      if (cell === "BOT") div.classList.add("BOT");

      /* ===== PERFECT UX CLICK HANDLING ===== */
      div.onclick = () => {
        if (!gameActive) {
          showToast("⏳ Game has not started yet", "info");
          return;
        }

        if (!isMyTurn) {
          showToast("⛔ Not your turn", "warning");
          div.classList.add("invalid-click");
          setTimeout(() => div.classList.remove("invalid-click"), 300);
          return;
        }

        if (cell) {
          showToast("❌ This slot is already filled", "error");
          div.classList.add("invalid-click");
          setTimeout(() => div.classList.remove("invalid-click"), 300);
          return;
        }

        socket.emit("make_move", {
          gameId,
          column: col,
          username,
        });
      };

      boardDiv.appendChild(div);
    });
  });
}

/* =======================
   SOCKET EVENTS
======================= */

socket.on("waiting_for_opponent", () => {
  gameActive = false;
  updateStatus("⏳ Waiting for opponent...", "waiting");
});

socket.on("game_start", data => {
  gameId = data.gameId;
  player1Name = data.player1;
  player2Name = data.player2 || "BOT";
  currentTurn = data.currentTurn;
  gameActive = true;
  isMyTurn = currentTurn === username;

  joinSection.style.display = "none";
  playerLegend.style.display = "flex";
  player1NameSpan.innerText = player1Name;
  player2NameSpan.innerText = player2Name;

  updateStatus(isMyTurn ? "🟢 Your Turn" : "⏳ Opponent Turn", isMyTurn ? "your-turn" : "waiting");
  renderBoard(data.board);
});

socket.on("game_update", data => {
  currentTurn = data.currentTurn;
  isMyTurn = currentTurn === username;

  updateStatus(
      isMyTurn ? "🟢 Your Turn" : `⏳ ${currentTurn}'s Turn`,
      isMyTurn ? "your-turn" : "waiting"
  );

  renderBoard(data.board);
});

socket.on("game_over", data => {
  gameActive = false;
  isMyTurn = false;

  if (data.winner === username) {
    updateStatus("🎉 YOU WIN!", "winner");
  } else if (data.winner) {
    updateStatus(`${data.winner} wins`, "loser");
  } else {
    updateStatus("🤝 Draw", "draw");
  }

  renderBoard(data.board);
  loadLeaderboard();
});

/* =======================
   LEADERBOARD
======================= */

async function loadLeaderboard() {
  try {
    const res = await fetch(`${BACKEND_URL}/leaderboard`);
    const data = await res.json();

    leaderboardUl.innerHTML = "";

    if (!data.length) {
      leaderboardUl.innerHTML = "<li class='empty-state'>No games yet</li>";
      return;
    }

    data.forEach((p, i) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${i + 1}</span> ${p.username} — ${p.wins} wins`;
      leaderboardUl.appendChild(li);
    });
  } catch {}
}

loadLeaderboard();
