import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const filter = searchParams.get('filter') ?? 'upcoming'; // upcoming | live | finished

  try {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const sevenDaysAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    let whereClause = {};
    if (filter === 'live') {
      whereClause = { status: { in: ['H1', 'H2', 'HT', 'ET1', 'ET2', 'WET', 'WPE', 'PE'] } };
    } else if (filter === 'finished') {
      whereClause = { status: { in: ['F', 'FET', 'FPE'] }, startTime: { gte: twoDaysAgo } };
    } else {
      // upcoming — next 7 days
      whereClause = { status: 'NS', startTime: { gte: now, lte: sevenDaysAhead } };
    }

    const fixtures = await prisma.fixture.findMany({
      where: whereClause,
      orderBy: { startTime: 'asc' },
      take: 50,
      include: {
        markets: {
          select: {
            id: true,
            marketType: true,
            outcomeLabel: true,
            outcomeValue: true,
            status: true,
            oddsImplied: true,
            supportPool: true,
            challengePool: true,
            _count: { select: { posts: true } },
          },
        },
      },
    });

    return NextResponse.json(fixtures);
  } catch (err) {
    console.error('[API/fixtures] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch fixtures' }, { status: 500 });
  }
}
