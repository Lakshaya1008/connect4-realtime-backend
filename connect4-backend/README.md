# 🎯 Connect Four — Backend-Heavy Real-Time Game

A real-time multiplayer Connect Four game built with a server-authoritative backend, supporting PvP gameplay, intelligent bot opponents, reconnection handling, persistence, and a leaderboard.

This project was built as part of the **Emitrr Backend Engineering Intern** assignment.

---

## 🚀 Features

### Core Gameplay

- Real-time **Player vs Player** gameplay using WebSockets (Socket.IO)
- **Bot fallback** if no second player joins
- **Three bot difficulty levels:**
  - **Easy** – random valid moves
  - **Medium** – win / block / center strategy
  - **Hard** – shallow lookahead for stronger play
- Server-enforced turn validation and move correctness
- Win detection (horizontal, vertical, diagonal)
- Draw detection

### Matchmaking & Resilience

- In-memory game state for active matches
- Automatic **reconnection within 30 seconds** using username/game identity
- Forfeit handling if a player fails to reconnect
- Server remains the single source of truth

### Persistence & Leaderboard

- Completed games stored in **PostgreSQL**
- Game metadata persisted:
  - Game mode (PvP / Bot)
  - Bot difficulty (if applicable)
  - Winner
- Leaderboard tracks player wins
- Bot wins are segmented by difficulty for meaningful statistics

---

## 🧠 Architecture Overview

```
Client (Browser)
     |
Socket.IO
     |
Game Manager (Server Authoritative)
     |—— Game Logic (rules, validation)
     |—— Bot Logic (difficulty-based AI)
     |
In-Memory State (Active Games)
     |
PostgreSQL (Completed Games & Leaderboard)
```

**Design choices:**

- Game state is kept in memory for low-latency real-time play
- Database writes occur only on game completion
- Bot logic is enforced server-side, never trusted to the client
- Reconnection is handled without restarting the game

---

## 🤖 Bot Difficulty Design

| Difficulty | Behavior |
|------------|----------|
| Easy | Random valid moves |
| Medium | Win if possible → Block opponent → Prefer center |
| Hard | Shallow lookahead (1–2 ply), deterministic |

The bot is competitive but not unbeatable, prioritizing fair gameplay over perfect play.

---

## 🖥️ Frontend

- Minimal HTML/CSS/JS frontend
- Displays 7×6 grid
- Supports:
  - Username entry
  - PvP or Bot selection
  - Difficulty selection
  - Real-time move updates
  - Game result modal
  - Leaderboard view

Styling is intentionally minimal; focus is on backend correctness.

---

## ⚙️ Local Setup

### Requirements

- Node.js (v18+)
- PostgreSQL

### Install & Run

```bash
npm install
npm run dev    # Development
npm start      # Production
```

---

## 🌐 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | No |
| `NODE_ENV` | Environment | No |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `FRONTEND_ORIGIN` | Frontend URL (CORS) | Yes |

**Example:**

```env
PORT=3000
NODE_ENV=production
DATABASE_URL=postgres://user:password@host:5432/db
FRONTEND_ORIGIN=https://frontend-url.com
```

---

## 🚀 Deployment

The application is deployment-ready and can be hosted on platforms like:

- **Render**
- **Railway**
- **Fly.io**

| Component | Type |
|-----------|------|
| Backend | Web Service |
| Frontend | Static Site |
| Database | Managed PostgreSQL |

A `/health` endpoint is provided for platform health checks.

---

## 📊 Kafka Analytics (Bonus)

Kafka-based analytics was listed as a bonus requirement.

Due to time constraints, Kafka was not implemented, but the architecture is designed so that:

- Game events can be emitted without coupling gameplay logic
- Analytics can be added as a separate consumer service

---

## 🔮 Future Improvements

- Ranked matchmaking
- Advanced AI (full minimax)
- Spectator mode
- Horizontal scaling with Redis
- Authentication & player profiles

---

## 📌 Summary

This project demonstrates:

- ✅ Real-time system design
- ✅ Backend-first architecture
- ✅ State management and fault tolerance
- ✅ Deterministic AI behavior
- ✅ Clean separation of concerns

