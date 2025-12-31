/* ======================
   CONFIG & SOCKET SETUP
====================== */

const BACKEND_URL = window.BACKEND_URL || "http://localhost:3000";

console.log("[config] BACKEND_URL:", BACKEND_URL);
console.log("[config] io exists:", typeof io);

if (typeof io === "undefined") {
  throw new Error("❌ Socket.IO client not loaded. Check script order.");
}

const socket = io(BACKEND_URL, {
  transports: ["websocket"],
});

/* ======================
   DOM REFERENCES
====================== */

const boardDiv = document.getElementById("board");
const statusP = document.getElementById("status");
const joinBtn = document.getElementById("joinBtn");
const usernameInput = document.getElementById("username");
const leaderboardUl = document.getElementById("leaderboard");
const difficultySelector = document.getElementById("difficulty-selector");
const difficultySelect = document.getElementById("difficulty");
const gameModeRadios = document.querySelectorAll('input[name="gameMode"]');

/* ======================
   STATE
====================== */

let username = null;
let gameId = null;
let currentTurn = null;
let gameActive = false;
let isMyTurn = false;
let selectedMode = "PVP";
let selectedDifficulty = "MEDIUM";

/* ======================
   GAME MODE HANDLING
====================== */

gameModeRadios.forEach(radio => {
  radio.addEventListener("change", e => {
    selectedMode = e.target.value;
    difficultySelector.style.display =
        selectedMode === "BOT" ? "block" : "none";
  });
});

difficultySelect.addEventListener("change", e => {
  selectedDifficulty = e.target.value;
});

/* ======================
   JOIN GAME
====================== */

joinBtn.onclick = () => {
  const name = usernameInput.value.trim();

  if (name.length < 2) {
    alert("Username must be at least 2 characters");
    return;
  }

  username = name;
  joinBtn.disabled = true;
  joinBtn.innerText = "Joining...";

  socket.emit("join_game", {
    username,
    mode: selectedMode,
    difficulty: selectedMode === "BOT" ? selectedDifficulty : undefined,
  });

  updateStatus(
      selectedMode === "BOT"
          ? `🤖 Playing vs Bot (${selectedDifficulty})`
          : "⏳ Waiting for opponent...",
      "waiting"
  );
};

/* ======================
   SOCKET EVENTS
====================== */

socket.on("connect", () => {
  console.log("✅ Connected:", socket.id);
});

socket.on("waiting_for_opponent", () => {
  updateStatus("⏳ Waiting for opponent...", "waiting");
});

socket.on("game_start", data => {
  gameId = data.gameId;
  currentTurn = data.currentTurn;
  gameActive = true;
  isMyTurn = currentTurn === username;

  document.getElementById("join").style.display = "none";
  renderBoard(data.board);

  updateStatus(
      isMyTurn ? "🟢 Your turn" : `⏳ ${currentTurn}'s turn`,
      isMyTurn ? "your-turn" : "waiting"
  );
});

socket.on("game_update", data => {
  currentTurn = data.currentTurn;
  isMyTurn = currentTurn === username;

  renderBoard(data.board);
  updateStatus(
      isMyTurn ? "🟢 Your turn" : `⏳ ${currentTurn}'s turn`,
      isMyTurn ? "your-turn" : "waiting"
  );
});

socket.on("game_over", data => {
  gameActive = false;
  renderBoard(data.board);

  if (data.winner) {
    updateStatus(
        data.winner === username ? "🎉 You Win!" : `❌ ${data.winner} Wins`,
        data.winner === username ? "winner" : "loser"
    );
  } else {
    updateStatus("🤝 Draw", "draw");
  }

  loadLeaderboard();
});

/* ======================
   BOARD RENDERING
====================== */

function renderBoard(board) {
  boardDiv.innerHTML = "";

  board.forEach((row, r) => {
    row.forEach((cell, c) => {
      const div = document.createElement("div");
      div.className = "cell" + (cell ? " filled" : "");

      div.onclick = () => {
        if (!gameActive || !isMyTurn || cell) return;

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

/* ======================
   STATUS & LEADERBOARD
====================== */

function updateStatus(msg, type = "") {
  statusP.innerText = msg;
  statusP.className = type;
}

async function loadLeaderboard() {
  try {
    const res = await fetch(`${BACKEND_URL}/leaderboard`);
    const data = await res.json();

    leaderboardUl.innerHTML = "";
    if (data.length === 0) {
      leaderboardUl.innerHTML = "<li>No games yet</li>";
      return;
    }

    data.forEach((p, i) => {
      const li = document.createElement("li");
      li.innerText = `${i + 1}. ${p.username} - ${p.wins} wins`;
      leaderboardUl.appendChild(li);
    });
  } catch (e) {
    console.warn("Leaderboard failed to load");
  }
}

loadLeaderboard();
