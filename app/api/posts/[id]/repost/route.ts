import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, AuthError } from '@/lib/auth-server';
import { emitToRoom, emitNotification } from '@/lib/emit';
import { ROOM } from '@/lib/constants';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params;

  try {
    const user = await requireUser(req);

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const existing = await prisma.repost.findUnique({
      where: { postId_userId: { postId, userId: user.id } },
    });

    let reposted: boolean;
    if (existing) {
      await prisma.repost.delete({ where: { id: existing.id } });
      reposted = false;
    } else {
      await prisma.repost.create({ data: { postId, userId: user.id } });
      reposted = true;

      if (post.authorId !== user.id) {
        const notification = await prisma.notification.create({
          data: {
            recipientId: post.authorId,
            actorId: user.id,
            type: 'REPOST',
            postId,
          },
        });
        emitNotification(post.authorId, {
          id: notification.id,
          type: 'REPOST',
          actorName: user.displayName,
          postId,
        });
      }
    }

    const repostCount = await prisma.repost.count({ where: { postId } });
    emitToRoom(ROOM.post(postId), 'post:repost', { postId, repostCount, reposted, userId: user.id });

    return NextResponse.json({ reposted, repostCount });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to toggle repost' }, { status: 500 });
  }
}
