import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import WebSocket from 'ws';
import themesRouter from './routes/themes';
import conversationsRouter from './routes/conversations';
import { RealtimeService } from './services/realtime.service';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocket.Server({ server, path: '/realtime' });

const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/themes', themesRouter);
app.use('/api/conversations', conversationsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize Realtime Service
new RealtimeService(wss);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready at ws://localhost:${PORT}/realtime`);
});
