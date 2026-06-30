import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const fixture = await prisma.fixture.findUnique({
      where: { id },
      include: {
        markets: {
          select: {
            id: true,
            fixtureId: true,
            marketType: true,
            outcomeLabel: true,
            outcomeValue: true,
            status: true,
            oddsImplied: true,
            supportPool: true,
            challengePool: true,
            winnerSide: true,
            _count: { select: { posts: true } },
          },
        },
      },
    });

    if (!fixture) {
      return NextResponse.json({ error: 'Fixture not found' }, { status: 404 });
    }

    return NextResponse.json(fixture);
  } catch (err) {
    console.error('[API/fixtures/:id] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch fixture' }, { status: 500 });
  }
}
