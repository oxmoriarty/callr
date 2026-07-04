/**
 * Emit helper for Next.js API routes.
 *
 * Always uses HTTP POST to the Socket.IO server's /emit endpoint.
 * In dev: posts to localhost:4000 (start socket-server separately with `npm run dev` in socket-server/)
 * In prod: posts to the Railway socket server URL.
 *
 * Non-fatal — if the socket server is unreachable, the app still works
 * (real-time updates are missed but DB is always source of truth).
 */

const SOCKET_SERVER_URL =
  process.env.SOCKET_SERVER_URL ??
  (process.env.NODE_ENV === 'development' ? 'http://localhost:4000' : null);

const SOCKET_SECRET = process.env.SOCKET_SECRET ?? '';

export async function emitToRoom(room: string, event: string, data: unknown): Promise<void> {
  if (!SOCKET_SERVER_URL) return;

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
  } catch {
    // Non-fatal — socket server may not be running in dev
  }
}

export async function emitNotification(
  userId: string,
  notification: { id: string; type: string; message?: string; actorName?: string; postId?: string }
): Promise<void> {
  await emitToRoom(`user:${userId}`, 'notification', notification);
}
