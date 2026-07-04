// Express HTTP server + Socket.IO. Serves the client build in production.
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';

import { questionBank } from './lib/questionBank.js';
import { registerRoomHandlers, handleDeparture } from './sockets/rooms.js';
import { registerGameHandlers } from './sockets/game.js';
import { Events } from '../shared/events.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = join(__dirname, '..', 'client', 'dist');
const PORT = process.env.PORT || 3005;

async function main() {
  await questionBank.load();

  const app = express();
  app.use(express.json());

  // Category list for the client picker (no auth needed).
  app.get('/api/categories', (_req, res) => {
    res.json({ categories: questionBank.listCategories() });
  });

  // Solo practice: return a randomized subset including the answer (revealed
  // immediately in solo mode anyway, so hiding it gains nothing).
  app.get('/api/quiz', (req, res) => {
    const category = typeof req.query.category === 'string' ? req.query.category : 'all';
    const count = Math.max(1, Math.min(50, parseInt(req.query.count, 10) || 10));
    try {
      const questions = questionBank.getQuestions({ category, count });
      res.json({ questions });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Serve built client in production. In dev, Vite serves the client on :3005.
  if (existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST));
    app.get('*', (_req, res) => res.sendFile(join(CLIENT_DIST, 'index.html')));
    console.log(`[server] serving client from ${CLIENT_DIST}`);
  } else {
    app.get('/', (_req, res) =>
      res.send('Pramuka Quiz API is running. Run the Vite dev server (client/) for the UI.')
    );
  }

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: true, credentials: true }, // allow Vite dev origin
  });

  io.on('connection', (socket) => {
    console.log(`[io] connected ${socket.id}`);

    registerRoomHandlers(io, socket);
    registerGameHandlers(io, socket);

    socket.on('disconnecting', () => {
      const roomId = socket.data.roomId;
      if (roomId) handleDeparture(io, socket, roomId);
    });
    socket.on('disconnect', () => {
      console.log(`[io] disconnected ${socket.id}`);
    });
  });

  httpServer.listen(PORT, () => {
    const lanIps = Object.values(networkInterfaces())
      .flat()
      .filter((iface) => iface && !iface.internal && iface.family === 'IPv4')
      .map((iface) => iface.address);
    console.log(`[server] listening on http://localhost:${PORT}`);
    for (const ip of lanIps) {
      console.log(`[server] also reachable on the LAN at http://${ip}:${PORT}`);
    }
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});