import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { settleFixture } from '@/lib/settlement/settle';

// Called by cron or manually after match finishes
export async function POST(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as { fixtureId?: string };

  if (body.fixtureId) {
    // Settle specific fixture
    try {
      const results = await settleFixture(body.fixtureId);
      return NextResponse.json({ settled: results.length, results });
    } catch (err) {
      console.error('[API/settlement] Error:', err);
      return NextResponse.json({ error: 'Settlement failed' }, { status: 500 });
    }
  }

  // Settle all finished fixtures with open markets
  const finishedWithOpenMarkets = await prisma.fixture.findMany({
    where: {
      status: { in: ['F', 'FET', 'FPE'] },
      markets: { some: { status: { in: ['OPEN', 'LOCKED'] } } },
    },
    select: { id: true, homeTeam: true, awayTeam: true },
  });

  const results = [];
  for (const fixture of finishedWithOpenMarkets) {
    try {
      const settled = await settleFixture(fixture.id);
      results.push({ fixtureId: fixture.id, settled: settled.length });
    } catch (err) {
      console.error(`[Settlement] Failed for ${fixture.id}:`, err);
      results.push({ fixtureId: fixture.id, error: 'Failed' });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
