import { NextRequest, NextResponse } from 'next/server';
import { syncFixtures } from '@/jobs/sync-fixtures';
import { generateAllMissingMarkets } from '@/jobs/generate-markets';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await syncFixtures();
    await generateAllMissingMarkets();
    return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('[Cron/sync-fixtures]', err);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
