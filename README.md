# 🎮 Connect Four — Real-Time Backend-Heavy Game

A real-time multiplayer **Connect Four (4-in-a-Row)** game built with a **server-authoritative backend**, intelligent bot opponents, reconnection handling, persistence, and a live leaderboard.

This project was built as part of the **Emitrr – Full Stack Intern (Backend Heavy)** assignment.

---

## 🧠 Project Overview

This system focuses on **backend correctness, real-time communication, and game state management**, with a minimal frontend used only for interaction and testing.

### Key Highlights
- Real-time gameplay using **WebSockets (Socket.IO)**
- **PvP matchmaking** with automatic **bot fallback**
- **Intelligent bot AI** (non-random, strategic)
- **Reconnect support (30s)** for dropped players
- **PostgreSQL persistence** for completed games
- **Leaderboard** showing player wins
- Clean separation of **game logic**, **state**, and **transport**

---

## 🗂 Repository Structure
.
├── connect4-backend/ # Backend (Node.js + Socket.IO + PostgreSQL)
├── connect4-frontend/ # Minimal frontend (HTML/CSS/JS)
├── .gitignore
└── README.md # You are here
.
├── connect4-backend/ # Backend (Node.js + Socket.IO + PostgreSQL)
├── connect4-frontend/ # Minimal frontend (HTML/CSS/JS)
├── .gitignore
└── README.md 

---

## ⚙️ Backend Features

### Gameplay & Matchmaking
- Player vs Player matchmaking
- If no opponent joins within **10 seconds**, a **competitive bot** starts the game
- Server-enforced turn validation
- Win detection (horizontal, vertical, diagonal)
- Draw detection

### Bot AI
- **Not random**
- Prioritizes:
  1. Winning if possible
  2. Blocking opponent’s winning move
  3. Strategic positioning (center preference)

### Reliability
- Active games stored **in memory** for fast real-time updates
- Player reconnection supported for **30 seconds**
- Automatic forfeit if reconnect timeout expires
- Server remains the **single source of truth**

### Persistence & Leaderboard
- Completed games stored in **PostgreSQL**
- Winner recorded per game
- Leaderboard tracks **number of wins per player**

---

## 🖥 Frontend Features

- Minimal UI (HTML/CSS/JavaScript)
- 7×6 Connect Four grid
- Username input
- Real-time move updates
- Game result modal (win / loss / draw)
- Leaderboard display

> Styling is intentionally minimal — focus is on backend behavior.

---

## 🚀 Running the Project Locally

### Requirements
- Node.js (v18+ recommended)
- PostgreSQL

---

### Backend Setup

```bash
cd connect4-backend
npm install
npm run dev      # Development mode
npm start        # Production mode

Environment Variables (Backend)
PORT=3000
NODE_ENV=development
DATABASE_URL=postgres://user:password@localhost:5432/connect4
FRONTEND_ORIGIN=http://localhost:63342
Frontend Setup

Simply open the frontend files in a browser:

connect4-frontend/frontend/index.html


Ensure the backend is running on port 3000.
🌐 Deployment

The project is deployment-ready and can be hosted using:

Render

Railway

Fly.io

Recommended Setup

Backend → Web Service

Database → Managed PostgreSQL

Frontend → Static site

A health check endpoint is available:

GET /health

🧪 Bonus – Kafka Analytics

Kafka-based analytics was listed as a bonus requirement.

Due to time constraints, Kafka is not implemented, but the backend is structured so that:

Game events can be emitted without coupling gameplay logic

Analytics can be added as a separate consumer service later

🧠 Design Philosophy

Backend-first architecture

Deterministic, server-authoritative gameplay

No trust placed on client logic

Simple, explainable AI over complex black-box logic

Clean, interview-defensible design choices

📌 What This Project Demonstrates

Real-time systems with WebSockets

State management under concurrency

Fault tolerance (disconnects & reconnects)

Clean backend architecture

Practical AI decision-making

Production-oriented thinking

📬 Submission Notes

GitHub repository contains both backend and frontend

App is designed to be easily deployed

README explains setup, behavior, and design decisions clearly

👤 Author

Lakshaya Jain
Backend-focused developer
Built for the Emitrr Internship Assignment


