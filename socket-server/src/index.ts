/**
 * Callr Socket.IO Server
 * Deploys to Railway as a standalone Node.js service.
 * Bridges TxLINE SSE streams to connected clients in real time.
 *
 * This is intentionally separate from Next.js so that:
 * - Next.js deploys to Vercel (serverless, scales automatically)
 * - Socket.IO runs as a persistent process on Railway (free tier)
 */

import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import axios from 'axios';

const PORT = parseInt(process.env.PORT ?? '4000', 10);
const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const TXLINE_API_BASE = process.env.TXLINE_API_BASE ?? 'https://txline.txodds.com';

// ─── HTTP Server ──────────────────────────────────────────────────────────────

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', ts: Date.now() }));
    return;
  }
  res.writeHead(404);
  res.end();
});

// ─── Socket.IO ────────────────────────────────────────────────────────────────

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: ALLOWED_ORIGIN.split(','),
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  socket.on('join:user', (userId: string) => void socket.join(`user:${userId}`));
  socket.on('join:match', (id: string) => void socket.join(`match:${id}`));
  socket.on('join:market', (id: string) => void socket.join(`market:${id}`));
  socket.on('join:post', (id: string) => void socket.join(`post:${id}`));
  socket.on('leave:match', (id: string) => void socket.leave(`match:${id}`));

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// ─── Internal event endpoint (called by Next.js API routes) ──────────────────
// Next.js API routes POST events here; this server fans them out to clients.
// Secured by SOCKET_SECRET header.

import { IncomingMessage, ServerResponse } from 'http';

const originalHandler = httpServer.listeners('request')[0] as (req: IncomingMessage, res: ServerResponse) => void;
httpServer.removeAllListeners('request');

httpServer.on('request', (req: IncomingMessage, res: ServerResponse) => {
  // CORS for internal API
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-socket-secret');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', connections: io.sockets.sockets.size, ts: Date.now() }));
    return;
  }

  if (req.url === '/emit' && req.method === 'POST') {
    const secret = req.headers['x-socket-secret'];
    if (secret !== process.env.SOCKET_SECRET) {
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }

    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const { room, event, data } = JSON.parse(body) as { room: string; event: string; data: unknown };
        io.to(room).emit(event, data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400);
        res.end('Bad request');
      }
    });
    return;
  }

  // 404 for everything else
  res.writeHead(404);
  res.end();
});

// ─── TxLINE SSE Consumer ─────────────────────────────────────────────────────

interface TokenCache {
  jwt: string;
  apiToken: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

async function getToken(): Promise<{ jwt: string; apiToken: string } | null> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache;

  const jwt = process.env.TXLINE_JWT;
  const apiToken = process.env.TXLINE_API_TOKEN;
  if (!jwt || !apiToken) return null;

  tokenCache = { jwt, apiToken, expiresAt: Date.now() + 23 * 60 * 60 * 1000 };
  return tokenCache;
}

async function connectStream(type: 'scores' | 'odds'): Promise<void> {
  const token = await getToken();
  if (!token) {
    console.log(`[TxLINE] No token configured, ${type} stream inactive`);
    return;
  }

  const url = `${TXLINE_API_BASE}/api/${type}/stream`;
  console.log(`[TxLINE] Connecting to ${type} stream...`);

  const controller = new AbortController();

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token.jwt}`,
        'X-Api-Token': token.apiToken,
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`Stream ${type} failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      let eventData = '';
      for (const line of lines) {
        if (line.startsWith('data:')) {
          eventData = line.slice(5).trim();
        } else if (line === '' && eventData) {
          if (eventData !== 'heartbeat') {
            try {
              const parsed = JSON.parse(eventData);
              handleStreamEvent(type, parsed);
            } catch { /* ignore parse errors */ }
          }
          eventData = '';
        }
      }
    }
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      console.error(`[TxLINE] ${type} stream error:`, err);
    }
  }

  // Reconnect after delay
  setTimeout(() => void connectStream(type), 5000);
}

function handleStreamEvent(type: 'scores' | 'odds', data: Record<string, unknown>): void {
  if (type === 'scores') {
    const fixtureId = String(data.fixtureId ?? data.FixtureId);
    const scoreSoccer = data.scoreSoccer as Record<string, Record<string, Record<string, number>>> | undefined;
    const homeScore = scoreSoccer?.Participant1?.Total?.Goals ?? 0;
    const awayScore = scoreSoccer?.Participant2?.Total?.Goals ?? 0;
    const status = (data.gameState as string) ?? 'NS';

    io.to(`match:${fixtureId}`).emit('score:update', {
      fixtureId,
      homeScore,
      awayScore,
      status,
      gameState: status,
    });

    if (['F', 'FET', 'FPE'].includes(status)) {
      io.emit('settlement:pending', { fixtureId });
    }
  }

  if (type === 'odds') {
    const fixtureId = String(data.FixtureId ?? data.fixtureId);
    io.to(`match:${fixtureId}`).emit('odds:update', {
      fixtureId,
      superOddsType: data.SuperOddsType,
      priceNames: data.PriceNames,
      prices: data.Prices,
      pct: data.Pct,
    });
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`[Callr Socket] Listening on port ${PORT}`);
  console.log(`[Callr Socket] Allowed origin: ${ALLOWED_ORIGIN}`);

  // Start TxLINE streams
  void connectStream('scores');
  void connectStream('odds');
});
