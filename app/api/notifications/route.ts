import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, AuthError } from '@/lib/auth-server';

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const { searchParams } = req.nextUrl;
    const cursor = searchParams.get('cursor');

    const notifications = await prisma.notification.findMany({
      where: {
        recipientId: user.id,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 21,
      include: {
        actor: { select: { username: true, displayName: true, avatarUrl: true } },
      },
    });

    const hasMore = notifications.length > 20;
    const items = hasMore ? notifications.slice(0, 20) : notifications;
    const nextCursor = hasMore ? items[items.length - 1]?.createdAt.toISOString() : undefined;

    // Count unread
    const unreadCount = await prisma.notification.count({
      where: { recipientId: user.id, read: false },
    });

    return NextResponse.json({ data: items, nextCursor, hasMore, unreadCount });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

// Mark all as read
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser(req);
    await prisma.notification.updateMany({
      where: { recipientId: user.id, read: false },
      data: { read: true },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to mark notifications read' }, { status: 500 });
  }
}
