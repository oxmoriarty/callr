import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerUser } from '@/lib/auth-server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params;
  const currentUser = await getServerUser(req);

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        market: {
          include: {
            fixture: {
              select: {
                id: true, homeTeam: true, awayTeam: true,
                status: true, homeScore: true, awayScore: true, startTime: true,
              },
            },
          },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          take: 100,
          include: {
            author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
        },
        _count: { select: { likes: true, comments: true, reposts: true } },
        ...(currentUser ? {
          likes: { where: { userId: currentUser.id }, select: { id: true } },
          reposts: { where: { userId: currentUser.id }, select: { id: true } },
        } : {}),
      },
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const enriched = {
      ...post,
      isLiked: currentUser ? (post as Record<string, unknown[]>).likes?.length > 0 : false,
      isReposted: currentUser ? (post as Record<string, unknown[]>).reposts?.length > 0 : false,
      likes: undefined,
      reposts: undefined,
    };

    return NextResponse.json(enriched);
  } catch (err) {
    console.error('[API/posts/:id]', err);
    return NextResponse.json({ error: 'Failed to fetch post' }, { status: 500 });
  }
}
