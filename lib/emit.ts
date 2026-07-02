/**
 * Emit helper for Next.js API routes.
 *
 * In production: POSTs to the Railway socket server's /emit endpoint.
 * In development: Falls back to the same-process socket server via server/socket.ts
 *
 * This decoupling means Next.js API routes work on Vercel (serverless),
 * while real-time events are handled by the persistent Railway process.
 */

const SOCKET_SERVER_URL = process.env.SOCKET_SERVER_URL;
const SOCKET_SECRET = process.env.SOCKET_SECRET ?? '';

export async function emitToRoom(room: string, event: string, data: unknown): Promise<void> {
  if (SOCKET_SERVER_URL) {
    // Production: POST to Railway socket server
    try {
      await fetch(`${SOCKET_SERVER_URL}/emit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-socket-secret': SOCKET_SECRET,
        },
        body: JSON.stringify({ room, event, data }),
        signal: AbortSignal.timeout(3000),
      });
    } catch (err) {
      // Non-fatal: realtime update missed, but DB is source of truth
      console.warn(`[Emit] Failed to emit ${event} to ${room}:`, err);
    }
    return;
  }

  // Development: use in-process socket server
  try {
    const { emitToRoom: localEmit } = await import('@/server/socket');
    localEmit(room, event, data);
  } catch {
    // Server not initialized yet — ignore
  }
}

export async function emitNotification(
  userId: string,
  notification: { id: string; type: string; message?: string; actorName?: string; postId?: string }
): Promise<void> {
  await emitToRoom(`user:${userId}`, 'notification', notification);
}
