import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { settleFixture } from '@/lib/settlement/settle';

/**
 * Settlement endpoint.
 *
 * GET  — triggered by the Railway socket server when TxLINE reports a
 *        match as finished (event-driven, fires within seconds of FT).
 *        Also usable as a Vercel daily cron for any missed settlements.
 *
 * POST — manual trigger for a specific fixture (admin / testing).
 *
 * Both require Authorization: Bearer {CRON_SECRET}
 */

function auth(req: NextRequest): boolean {
  const header = req.headers.get('authorization');
  return header === `Bearer ${process.env.CRON_SECRET}`;
}

async function settleAllPending() {
  const fixtures = await prisma.fixture.findMany({
    where: {
      status: { in: ['F', 'FET', 'FPE'] },
      markets: { some: { status: { in: ['OPEN', 'LOCKED'] } } },
    },
    select: { id: true, homeTeam: true, awayTeam: true },
  });

  const results = [];
  for (const fixture of fixtures) {
    try {
      const settled = await settleFixture(fixture.id);
      results.push({ fixtureId: fixture.id, settled: settled.length });
      console.log(`[Settlement] Settled ${settled.length} markets for ${fixture.homeTeam} vs ${fixture.awayTeam}`);
    } catch (err) {
      console.error(`[Settlement] Failed for ${fixture.id}:`, err);
      results.push({ fixtureId: fixture.id, error: 'Failed' });
    }
  }
  return results;
}

// GET — event-driven (from Railway) or daily cron fallback
export async function GET(req: NextRequest) {
  if (!auth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Optional: settle a specific fixture passed as query param
  const fixtureId = req.nextUrl.searchParams.get('fixtureId');

  if (fixtureId) {
    try {
      const results = await settleFixture(fixtureId);
      return NextResponse.json({ settled: results.length, results });
    } catch (err) {
      console.error('[API/settlement] Error:', err);
      return NextResponse.json({ error: 'Settlement failed' }, { status: 500 });
    }
  }

  const results = await settleAllPending();
  return NextResponse.json({ processed: results.length, results });
}

// POST — manual trigger (for specific fixture or all)
export async function POST(req: NextRequest) {
  if (!auth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as { fixtureId?: string };

  if (body.fixtureId) {
    try {
      const results = await settleFixture(body.fixtureId);
      return NextResponse.json({ settled: results.length, results });
    } catch (err) {
      console.error('[API/settlement] Error:', err);
      return NextResponse.json({ error: 'Settlement failed' }, { status: 500 });
    }
  }

  const results = await settleAllPending();
  return NextResponse.json({ processed: results.length, results });
}
