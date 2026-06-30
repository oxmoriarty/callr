import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { blendOdds } from '@/lib/odds';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const market = await prisma.market.findUnique({
      where: { id },
      include: {
        fixture: true,
        _count: { select: { posts: true, positions: true } },
      },
    });

    if (!market) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 });
    }

    // Blend odds with internal liquidity
    const blendedOdds = blendOdds(
      market.oddsImplied,
      market.supportPool,
      market.challengePool
    );

    return NextResponse.json({ ...market, blendedOdds });
  } catch (err) {
    console.error('[API/markets/:id] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch market' }, { status: 500 });
  }
}
