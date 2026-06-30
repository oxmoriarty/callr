/**
 * Fixture Sync Job
 *
 * Fetches World Cup fixtures from TxLINE and upserts them into the DB.
 * Also triggers market generation for new fixtures.
 * Run via: npx tsx jobs/sync-fixtures.ts
 * Or via cron via /api/cron/sync-fixtures
 */

//import dotenv from "dotenv";

//dotenv.config();
//import "dotenv/config";

console.log("DATABASE_URL:", process.env.DATABASE_URL ? "FOUND" : "MISSING");

import { fetchFixtures } from '@/lib/txline/client';
import { prisma } from '@/lib/prisma';
import { generateMarketsForFixture } from './generate-markets';
import type { GameStatus } from '@/types';

// World Cup competition IDs (from TxLINE schedule)
// The schedule shows fixtures with Competition "World Cup > Group Stage"
const WORLD_CUP_FIXTURE_IDS_SAMPLE = [
  17588227, 17926696, 17926604, 17588396, 17588308, 17588386,
  17588316, 17926689, 17588318, 17588305, 17588239, 17926553,
  17588403, 17588230, 17588311, 17588241, 17588306, 17926828,
  17588322, 17588405, 17926703, 17588228, 17588406, 17588399,
  17926765, 17926603, 17588238, 17588223, 17588388, 17588397,
  17588317, 17588229, 17588229, 17926687, 17588240, 17588320,
  17588310, 17588232, 17588390, 17588235, 17588242, 17588389,
  17926647, 17588313, 17588244, 17588231, 17588324, 17588401,
  17926615, 17588303, 17926766, 17588319, 17588398, 17588395,
  17926764, 17588302, 17588321, 17588236, 17926686, 17926593,
  17588234, 17926740, 17588314, 17588404, 17588309, 17588323,
  17588245, 17588402, 17588391, 17926704, 17588325, 17588326,
];

export async function syncFixtures(): Promise<void> {
  console.log('[SyncFixtures] Starting...');

  try {
    // Fetch all fixtures (no competitionId filter — returns all subscribed)
    const fixtures = await fetchFixtures();

    // Filter to World Cup only
    const worldCupFixtures = fixtures.filter(
      (f) =>
        f.Competition?.toLowerCase().includes('world cup') ||
        WORLD_CUP_FIXTURE_IDS_SAMPLE.includes(f.FixtureId)
    );

    console.log(`[SyncFixtures] Found ${worldCupFixtures.length} World Cup fixtures`);

    for (const f of worldCupFixtures) {
      const existing = await prisma.fixture.findUnique({
        where: { txlineId: f.FixtureId.toString() },
        select: { id: true },
      });

      const fixtureData = {
        txlineId: f.FixtureId.toString(),
        homeTeam: f.Participant1IsHome ? f.Participant1 : f.Participant2,
        awayTeam: f.Participant1IsHome ? f.Participant2 : f.Participant1,
        competition: f.Competition,
        startTime: new Date(f.StartTime),
        status: 'NS' as GameStatus,
      };

      if (!existing) {
        const created = await prisma.fixture.create({ data: fixtureData });
        console.log(`[SyncFixtures] Created fixture: ${created.homeTeam} vs ${created.awayTeam}`);

        // Generate markets for new fixture
        await generateMarketsForFixture(created.id);
      }
      // Don't overwrite live score data on sync
    }

    console.log('[SyncFixtures] Complete');
  } catch (err) {
    console.error('[SyncFixtures] Error:', err);
    throw err;
  }
}

// Run directly
if (require.main === module) {
  syncFixtures()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
