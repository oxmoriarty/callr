import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, AuthError } from '@/lib/auth-server';
import { emitNotification } from '@/server/socket';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await params;

  try {
    const user = await requireUser(req);

    if (user.id === targetUserId) {
      return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });
    }

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, displayName: true },
    });

    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: user.id, followingId: targetUserId } },
    });

    let following: boolean;

    if (existing) {
      await prisma.follow.delete({ where: { id: existing.id } });
      following = false;
    } else {
      await prisma.follow.create({
        data: { followerId: user.id, followingId: targetUserId },
      });
      following = true;

      const notification = await prisma.notification.create({
        data: {
          recipientId: targetUserId,
          actorId: user.id,
          type: 'FOLLOW',
        },
      });

      emitNotification(targetUserId, {
        id: notification.id,
        type: 'FOLLOW',
        actorName: user.displayName,
      });
    }

    const followerCount = await prisma.follow.count({ where: { followingId: targetUserId } });

    return NextResponse.json({ following, followerCount });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[API/users/:id/follow] Error:', err);
    return NextResponse.json({ error: 'Failed to toggle follow' }, { status: 500 });
  }
}
