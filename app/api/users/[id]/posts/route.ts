import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const PAGE_SIZE = 20;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params;
  const { searchParams } = req.nextUrl;
  const cursor = searchParams.get('cursor');

  try {
    const posts = await prisma.post.findMany({
      where: {
        authorId: userId,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE + 1,
      include: {
        author: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        market: {
          include: {
            fixture: {
              select: {
                id: true,
                homeTeam: true,
                awayTeam: true,
                status: true,
                homeScore: true,
                awayScore: true,
                startTime: true,
              },
            },
          },
        },
        _count: { select: { likes: true, comments: true, reposts: true } },
      },
    });

    const hasMore = posts.length > PAGE_SIZE;
    const items = hasMore ? posts.slice(0, PAGE_SIZE) : posts;
    const nextCursor = hasMore
      ? items[items.length - 1]?.createdAt.toISOString()
      : undefined;

    return NextResponse.json({ data: items, nextCursor, hasMore });
  } catch (err) {
    console.error('[API/users/:id/posts]', err);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}
