const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const setupGameSocket = require('./socket/gameSocket');
const leaderboardRoutes = require('./routes/leaderboard');
const { initDatabase } = require('./db/initDb');

// Environment variables with sensible defaults for local development
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';

// CORS configuration: allow localhost in dev, specific origin in production
const corsOrigin = NODE_ENV === 'production'
  ? FRONTEND_ORIGIN
  : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5500', 'http://127.0.0.1:5500'];

const app = express();

// Configure CORS for Express
app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));
app.use(express.json());

// Health check endpoint for deployment platforms
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', environment: NODE_ENV });
});

app.use('/leaderboard', leaderboardRoutes);

const server = http.createServer(app);

// Configure Socket.IO with same CORS rules
const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

setupGameSocket(io);

// Initialize database then start server
initDatabase()
  .then(() => {
    server.listen(PORT, () => {
      // Log environment safely (no secrets)
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 Environment: ${NODE_ENV}`);
      console.log(`🌐 CORS origin: ${Array.isArray(corsOrigin) ? corsOrigin.join(', ') : corsOrigin}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
