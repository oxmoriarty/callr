import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerUser } from '@/lib/auth-server';

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const cursor = searchParams.get('cursor');
  const mode = searchParams.get('mode') ?? 'global';
  const fixtureId = searchParams.get('fixtureId');

  try {
    const currentUser = await getServerUser(req);

    const whereClause: Record<string, unknown> = {};

    if (fixtureId) {
      // Filter to posts on markets belonging to this fixture
      whereClause.market = { fixtureId };
    }

    if (mode === 'following' && currentUser) {
      const following = await prisma.follow.findMany({
        where: { followerId: currentUser.id },
        select: { followingId: true },
      });
      const followingIds = following.map((f: { followingId: string }) => f.followingId);
      whereClause.authorId = { in: followingIds };
    }

    const posts = await prisma.post.findMany({
      where: {
        ...whereClause,
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
        ...(currentUser
          ? {
              likes: { where: { userId: currentUser.id }, select: { id: true } },
              reposts: { where: { userId: currentUser.id }, select: { id: true } },
            }
          : {}),
      },
    });

    const hasMore = posts.length > PAGE_SIZE;
    const items = hasMore ? posts.slice(0, PAGE_SIZE) : posts;

    const enriched = items.map((post: typeof items[number]) => ({
      ...post,
      isLiked: currentUser ? (post as unknown as Record<string, unknown[]>).likes?.length > 0 : false,
      isReposted: currentUser ? (post as unknown as Record<string, unknown[]>).reposts?.length > 0 : false,
      likes: undefined,
      reposts: undefined,
    }));

    const nextCursor = hasMore
      ? items[items.length - 1]?.createdAt.toISOString()
      : undefined;

    return NextResponse.json({ data: enriched, nextCursor, hasMore });
  } catch (err) {
    console.error('[API/feed] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch feed' }, { status: 500 });
  }
}
