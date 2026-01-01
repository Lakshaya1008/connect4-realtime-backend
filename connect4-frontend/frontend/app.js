/**
 * BACKEND URL CONFIGURATION
 */
const BACKEND_URL = window.BACKEND_URL || "http://localhost:3000";

/**
 * SAFETY CHECK — DO NOT REMOVE
 */
if (typeof io === "undefined") {
  console.error("❌ Socket.IO client not loaded. Check script order in index.html");
  alert("Failed to load Socket.IO. Please refresh.");
  throw new Error("Socket.IO missing");
}

const socket = io(BACKEND_URL, { transports: ["websocket"] });

/* ================================
   🔌 BACKEND CONNECTION DIAGNOSTICS
   ================================ */
console.group("🔍 Backend Connection Diagnostics");
console.log("BACKEND_URL:", BACKEND_URL);
console.log("Socket.IO client loaded:", typeof io === "function");
console.groupEnd();

socket.on("connect", () => {
  console.log(
      "%c✅ Backend connected successfully",
      "color:#22c55e;font-weight:bold"
  );
  console.log("Socket ID:", socket.id);
});

socket.on("connect_error", err => {
  console.error(
      "%c❌ Backend connection failed",
      "color:#ef4444;font-weight:bold"
  );
  console.error("Reason:", err.message);
});

socket.on("disconnect", reason => {
  console.warn(
      "%c⚠️ Backend disconnected",
      "color:#f59e0b;font-weight:bold"
  );
  console.warn("Reason:", reason);
});

socket.io.on("reconnect", attempt => {
  console.log(
      `%c🔄 Reconnected (attempt ${attempt})`,
      "color:#3b82f6;font-weight:bold"
  );
});

/* ================================
   GAME STATE
   ================================ */
let username = null;
let gameId = null;
let currentTurn = null;
let player1Name = null;
let player2Name = null;
let myRole = null;
let gameActive = false;
let isMyTurn = false;
let selectedMode = "PVP";
let selectedDifficulty = "MEDIUM";

/* ================================
   DOM REFERENCES
   ================================ */
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

/* ================================
   UI HELPERS
   ================================ */
function updateStatus(message, type = "default") {
  statusP.innerText = message;
  statusP.className = "status-" + type;
}

function showToast(message, type = "warning") {
  const old = document.querySelector(".toast");
  if (old) old.remove();

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

function updatePlayerLegend(p1, p2) {
  player1Name = p1;
  player2Name = p2;

  player1NameSpan.innerText = p1;
  player2NameSpan.innerText = p2;

  const indicator = document.querySelector("#player2-info .player-indicator");
  indicator.className =
      p2 === "BOT"
          ? "player-indicator bot-indicator"
          : "player-indicator player2-indicator";

  playerLegend.style.display = "flex";
}

/* ================================
   MODE / DIFFICULTY
   ================================ */
gameModeRadios.forEach(radio => {
  radio.addEventListener("change", e => {
    selectedMode = e.target.value;
    difficultySelector.style.display =
        selectedMode === "BOT" ? "flex" : "none";
  });
});

difficultySelect?.addEventListener("change", e => {
  selectedDifficulty = e.target.value;
});

/* ================================
   JOIN GAME
   ================================ */
joinBtn.onclick = () => {
  if (joinBtn.disabled) return;

  const name = usernameInput.value.trim();
  if (name.length < 2) {
    showToast("Username too short", "error");
    return;
  }

  username = name;
  joinBtn.disabled = true;

  const payload = { username, mode: selectedMode };
  if (selectedMode === "BOT") payload.difficulty = selectedDifficulty;

  updateStatus(
      selectedMode === "BOT"
          ? `⏳ Starting bot (${selectedDifficulty})...`
          : "⏳ Waiting for opponent...",
      "waiting"
  );

  socket.emit("join_game", payload);
};

/* ================================
   BOARD RENDER
   ================================ */
function renderBoard(board) {
  boardDiv.innerHTML = "";

  boardDiv.classList.toggle("board-disabled", !gameActive);
  boardDiv.classList.toggle("board-waiting", gameActive && !isMyTurn);

  board.forEach(row => {
    row.forEach((cell, col) => {
      const div = document.createElement("div");
      div.className = "cell";

      if (cell === "BOT") div.classList.add("BOT");
      else if (cell === player1Name) div.classList.add("player1");
      else if (cell === player2Name) div.classList.add("player2");

      div.onclick = () => {
        if (!gameActive) {
          showToast("⏳ Game has not started", "info");
          return;
        }
        if (!isMyTurn) {
          showToast("⛔ Not your turn", "warning");
          div.classList.add("invalid-click");
          setTimeout(() => div.classList.remove("invalid-click"), 300);
          return;
        }
        if (cell) {
          showToast("❌ Slot already filled", "error");
          div.classList.add("invalid-click");
          setTimeout(() => div.classList.remove("invalid-click"), 300);
          return;
        }

        socket.emit("make_move", { gameId, column: col, username });
      };

      boardDiv.appendChild(div);
    });
  });
}

/* ================================
   SOCKET EVENTS (FIXED)
   ================================ */
socket.on("game_start", data => {
  console.log("🎮 game_start payload:", data);

  gameId = data.gameId;
  currentTurn = data.currentTurn;
  gameActive = true;

  joinSection.style.display = "none";

  // ✅ SAFE NAME RESOLUTION (ROOT FIX)
  if (data.player1) {
    player1Name = data.player1;
    player2Name = data.player2 || "BOT";
  } else if (Array.isArray(data.players)) {
    player1Name = data.players[0];
    player2Name = data.players[1] || "BOT";
  } else {
    player1Name = username;
    player2Name = "BOT";
  }

  myRole = username === player1Name ? "player1" : "player2";
  isMyTurn = currentTurn === username;

  updatePlayerLegend(player1Name, player2Name);
  updateStatus(isMyTurn ? "🟢 Your Turn" : "⏳ Waiting...", "waiting");
  renderBoard(data.board);
});

socket.on("game_update", data => {
  currentTurn = data.currentTurn;
  isMyTurn = currentTurn === username;
  updateStatus(isMyTurn ? "🟢 Your Turn" : "⏳ Waiting...", "waiting");
  renderBoard(data.board);
});

socket.on("game_over", data => {
  gameActive = false;
  isMyTurn = false;

  if (data.winner === username) updateStatus("🎉 You Win!", "winner");
  else if (data.winner) updateStatus(`${data.winner} Wins`, "loser");
  else updateStatus("🤝 Draw", "draw");

  renderBoard(data.board);
  loadLeaderboard();
});

/* ================================
   LEADERBOARD
   ================================ */
async function loadLeaderboard() {
  try {
    const res = await fetch(`${BACKEND_URL}/leaderboard`);
    const data = await res.json();
    leaderboardUl.innerHTML = "";

    if (!data.length) {
      leaderboardUl.innerHTML =
          "<li class='empty-state'>No games yet</li>";
      return;
    }

    data.forEach((p, i) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="rank">${i + 1}</span>
        <span class="lb-name">${p.username}</span>
        <span class="lb-wins">${p.wins} wins</span>
      `;
      leaderboardUl.appendChild(li);
    });
  } catch {}
}

loadLeaderboard();
