import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser, AuthError } from '@/lib/auth-server';
import { emitToRoom, emitNotification } from '@/lib/emit';
import { ROOM } from '@/lib/constants';

const commentSchema = z.object({ content: z.string().min(1).max(280) });

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params;

  const comments = await prisma.comment.findMany({
    where: { postId },
    orderBy: { createdAt: 'asc' },
    take: 100,
    include: {
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });

  return NextResponse.json(comments);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params;

  try {
    const user = await requireUser(req);
    const body = await req.json() as unknown;
    const { content } = commentSchema.parse(body);

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const comment = await prisma.comment.create({
      data: { postId, authorId: user.id, content },
      include: {
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });

    // Notify post author
    if (post.authorId !== user.id) {
      const notification = await prisma.notification.create({
        data: {
          recipientId: post.authorId,
          actorId: user.id,
          type: 'COMMENT',
          postId,
        },
      });
      emitNotification(post.authorId, {
        id: notification.id,
        type: 'COMMENT',
        actorName: user.displayName,
        postId,
      });
    }

    emitToRoom(ROOM.post(postId), 'post:comment', comment);

    return NextResponse.json(comment, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid content' }, { status: 400 });
    }
    console.error('[API/posts/:id/comment] Error:', err);
    return NextResponse.json({ error: 'Failed to post comment' }, { status: 500 });
  }
}
