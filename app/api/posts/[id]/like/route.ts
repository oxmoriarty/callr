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

    // Toggle like
    const existing = await prisma.like.findUnique({
      where: { postId_userId: { postId, userId: user.id } },
    });

    let liked: boolean;
    if (existing) {
      await prisma.like.delete({ where: { id: existing.id } });
      liked = false;
    } else {
      await prisma.like.create({ data: { postId, userId: user.id } });
      liked = true;

      // Notify post author (not self)
      if (post.authorId !== user.id) {
        const notification = await prisma.notification.create({
          data: {
            recipientId: post.authorId,
            actorId: user.id,
            type: 'LIKE',
            postId,
          },
        });
        emitNotification(post.authorId, {
          id: notification.id,
          type: 'LIKE',
          actorName: user.displayName,
          postId,
        });
      }
    }

    const likeCount = await prisma.like.count({ where: { postId } });

    // Emit to post room
    emitToRoom(ROOM.post(postId), 'post:like', { postId, likeCount, liked, userId: user.id });

    return NextResponse.json({ liked, likeCount });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[API/posts/:id/like] Error:', err);
    return NextResponse.json({ error: 'Failed to toggle like' }, { status: 500 });
  }
}
