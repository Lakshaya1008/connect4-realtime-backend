# 🎮 Connect Four — Frontend

A **minimal frontend** for the Connect Four real-time game, built to interact with a **backend-heavy, server-authoritative system** using **Socket.IO**.

This frontend intentionally keeps UI and complexity minimal, focusing on correctness and real-time behavior as per the assignment requirements.

---

## 🚀 Features

- 7×6 Connect Four grid
- Username-based game join
- Supports:
   - Player vs Player (PvP)
   - Player vs Bot (Easy / Medium / Hard)
- Real-time updates via WebSockets
- Turn indicators and game status messages
- Game over modal (win / loss / draw)
- Leaderboard display
- Automatic reconnection support

---

## 🧠 Design Philosophy

- **Backend-first architecture**
- Frontend acts only as a presentation layer
- No game logic is handled client-side
- Server remains the single source of truth

Styling is intentionally basic to keep focus on backend engineering.

---

## 🖥️ Running Locally

### Prerequisites
- Backend server must be running
- Backend URL must be reachable

### Steps
1. Start the backend server
2. Open `index.html` directly in a browser  
   *(No build step required)*

---

## ⚙️ Configuration

The frontend connects to the backend using a configurable URL.

```js
const BACKEND_URL = window.BACKEND_URL || "http://localhost:3000";
To connect to a deployed backend:

Set BACKEND_URL via hosting platform configuration

Or define it globally before loading the script

🎮 Gameplay Modes
Player vs Bot

Select “Play vs Bot”

Choose difficulty (Easy / Medium / Hard)

Game starts immediately

Player vs Player

Select “Play vs Player”

Wait for another player to join

Reconnection

Refresh or close the browser during a game

Rejoin with the same username within 30 seconds

Game resumes from the previous state

🏆 Leaderboard

Displays total wins per player

Bot wins are tracked separately by difficulty

Data is fetched from the backend leaderboard API

🔮 Future Improvements

Mobile responsiveness

UI animations

Spectator mode

Player profiles

📌 Summary

This frontend exists to:

Demonstrate real-time backend behavior

Visualize server-authoritative game state

Validate WebSocket communication

It avoids unnecessary complexity to keep focus on backend correctness and system design.