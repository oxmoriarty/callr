import { Server as SocketIOServer } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { txlineStream } from '@/lib/txline/stream';
import { ROOM, isFinished, ODDS_TYPE_MAP } from '@/lib/constants';
import { pctToImplied } from '@/lib/odds';
import { prisma } from '@/lib/prisma';
import type { TxLineScores, TxLineOdds, GameStatus } from '@/types';

let io: SocketIOServer | null = null;

export function getIO(): SocketIOServer | null {
  return io;
}

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  if (io) return io;

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    // Client joins rooms it cares about
    socket.on('join:user', (userId: string) => {
      void socket.join(ROOM.user(userId));
    });

    socket.on('join:match', (fixtureId: string) => {
      void socket.join(ROOM.match(fixtureId));
    });

    socket.on('join:market', (marketId: string) => {
      void socket.join(ROOM.market(marketId));
    });

    socket.on('join:post', (postId: string) => {
      void socket.join(ROOM.post(postId));
    });

    socket.on('leave:match', (fixtureId: string) => {
      void socket.leave(ROOM.match(fixtureId));
    });
  });

  // ─── TxLINE → Socket.IO bridge ───────────────────────────────────────────

  txlineStream.onScores(async (data: TxLineScores) => {
    if (!io) return;

    const fixtureId = data.fixtureId.toString();
    const scoreSoccer = data.scoreSoccer;

    const homeScore = scoreSoccer?.Participant1?.Total?.Goals ?? 0;
    const awayScore = scoreSoccer?.Participant2?.Total?.Goals ?? 0;
    const status = (data.gameState ?? 'NS') as GameStatus;

    // Determine match event type from dataSoccer
    let event: { type: string; team: string; minute?: number } | undefined;
    if (data.dataSoccer) {
      const d = data.dataSoccer;
      const team = d.Participant === 1 ? 'home' : 'away';
      if (d.Goal) event = { type: 'goal', team, minute: d.Minutes };
      else if (d.RedCard) event = { type: 'red_card', team, minute: d.Minutes };
      else if (d.YellowCard) event = { type: 'yellow_card', team, minute: d.Minutes };
      else if (d.Corner) event = { type: 'corner', team, minute: d.Minutes };
    }

    // Emit to match room
    io.to(ROOM.match(fixtureId)).emit('score:update', {
      fixtureId,
      homeScore,
      awayScore,
      status,
      gameState: data.gameState,
      minute: data.dataSoccer?.Minutes,
      event,
    });

    // Persist to DB
    try {
      await prisma.fixture.updateMany({
        where: { txlineId: fixtureId },
        data: {
          homeScore,
          awayScore,
          status,
          gameStateRaw: data.gameState,
        },
      });

      // If match just finished, trigger settlement job
      if (isFinished(status)) {
        const fixture = await prisma.fixture.findUnique({
          where: { txlineId: fixtureId },
          select: { id: true },
        });
        if (fixture) {
          io.emit('settlement:pending', { fixtureId: fixture.id });
        }
      }
    } catch (err) {
      console.error('[Socket] DB update error:', err);
    }
  });

  txlineStream.onOdds(async (data: TxLineOdds) => {
    if (!io) return;

    const fixtureId = data.FixtureId.toString();

    // Map TxLINE odds type to our market type
    const marketType = ODDS_TYPE_MAP[data.SuperOddsType];
    if (!marketType) return;

    // Get implied probability from Pct array
    let oddsImplied = 500; // default even
    if (data.Pct && data.Pct.length > 0 && data.PriceNames) {
      // For "FT Match Result": PriceNames = ["1", "X", "2"]
      // We take home win (index 0) as the primary signal
      const pct = data.Pct[0];
      if (pct) oddsImplied = pctToImplied(pct);
    }

    // Emit odds update to match room
    io.to(ROOM.match(fixtureId)).emit('odds:update', {
      fixtureId,
      marketType,
      oddsImplied,
      priceNames: data.PriceNames ?? [],
      prices: data.Prices ?? [],
    });

    // Update DB market odds
    try {
      const fixture = await prisma.fixture.findUnique({
        where: { txlineId: fixtureId },
        select: { id: true },
      });
      if (!fixture) return;

      await prisma.market.updateMany({
        where: {
          fixtureId: fixture.id,
          marketType: marketType as never,
        },
        data: { oddsImplied },
      });
    } catch (err) {
      console.error('[Socket] Odds DB update error:', err);
    }
  });

  console.log('[Socket] Server initialized');
  return io;
}

/**
 * Emit an event to a specific room (call from API routes)
 */
export function emitToRoom(room: string, event: string, data: unknown): void {
  io?.to(room).emit(event, data);
}

/**
 * Emit a notification to a user
 */
export function emitNotification(
  userId: string,
  notification: { id: string; type: string; message?: string; actorName?: string; postId?: string }
): void {
  io?.to(ROOM.user(userId)).emit('notification', notification);
}
