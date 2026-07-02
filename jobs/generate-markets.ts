/**
 * Market Generation
 *
 * Creates canonical markets for a fixture.
 * Uses findOrCreate pattern — safe to call multiple times.
 *
 * For each fixture we create:
 *   - MATCH_WINNER (home win)
 *   - MATCH_WINNER (away win)
 *   - DRAW
 *   - OVER_2_5
 *   - BTTS (yes)
 */

import { prisma } from '@/lib/prisma';
import { fetchOddsSnapshot } from '@/lib/txline/client';
import { ODDS_TYPE_MAP, CALLR_PROGRAM_ID, STAT_KEYS } from '@/lib/constants';
import { pctToImplied as pctToImpliedFn } from '@/lib/odds';
import { getServerProgram, loadSettlementKeypair, initializeMarketOnChain } from '@/lib/solana/program';

interface MarketDefinition {
  marketType: 'MATCH_WINNER' | 'DRAW' | 'OVER_2_5' | 'BTTS' | 'EXACT_SCORE';
  outcomeLabel: string;
  outcomeValue: string;
  defaultOdds: number; // implied probability * 1000
}

function buildMarketDefs(homeTeam: string, awayTeam: string): MarketDefinition[] {
  return [
    {
      marketType: 'MATCH_WINNER',
      outcomeLabel: `${homeTeam} Win`,
      outcomeValue: 'home',
      defaultOdds: 400,
    },
    {
      marketType: 'MATCH_WINNER',
      outcomeLabel: `${awayTeam} Win`,
      outcomeValue: 'away',
      defaultOdds: 300,
    },
    {
      marketType: 'DRAW',
      outcomeLabel: 'Draw',
      outcomeValue: 'draw',
      defaultOdds: 300,
    },
    {
      marketType: 'OVER_2_5',
      outcomeLabel: 'Over 2.5 Goals',
      outcomeValue: 'over',
      defaultOdds: 520,
    },
    {
      marketType: 'BTTS',
      outcomeLabel: 'Both Teams to Score',
      outcomeValue: 'yes',
      defaultOdds: 550,
    },
  ];
}

export async function generateMarketsForFixture(fixtureId: string): Promise<void> {
  const fixture = await prisma.fixture.findUnique({
    where: { id: fixtureId },
    include: { markets: { select: { marketType: true, outcomeValue: true } } },
  });

  if (!fixture) throw new Error(`Fixture not found: ${fixtureId}`);

  const marketDefs = buildMarketDefs(fixture.homeTeam, fixture.awayTeam);

  // Try to fetch real odds from TxLINE to seed initial odds
  let oddsMap: Map<string, number> = new Map();
  try {
    const odds = await fetchOddsSnapshot(parseInt(fixture.txlineId));
    for (const o of odds) {
      const marketType = ODDS_TYPE_MAP[o.SuperOddsType];
      if (!marketType || !o.Pct?.length) continue;

      // Map price names to outcomes
      if (marketType === 'MATCH_WINNER' && o.PriceNames && o.Pct) {
        for (let i = 0; i < o.PriceNames.length; i++) {
          const name = o.PriceNames[i];
          const pct = o.Pct[i];
          if (!name || !pct) continue;

          if (name === '1') oddsMap.set('MATCH_WINNER:home', pctToImpliedFn(pct));
          if (name === 'X') oddsMap.set('DRAW:draw', pctToImpliedFn(pct));
          if (name === '2') oddsMap.set('MATCH_WINNER:away', pctToImpliedFn(pct));
        }
      }

      if (marketType === 'OVER_2_5' && o.PriceNames && o.Pct) {
        for (let i = 0; i < o.PriceNames.length; i++) {
          const name = o.PriceNames[i];
          const pct = o.Pct[i];
          if (!name || !pct) continue;
          if (name?.toLowerCase().includes('over')) {
            oddsMap.set('OVER_2_5:over', pctToImpliedFn(pct));
          }
        }
      }

      if (marketType === 'BTTS' && o.PriceNames && o.Pct) {
        for (let i = 0; i < o.PriceNames.length; i++) {
          const name = o.PriceNames[i];
          const pct = o.Pct[i];
          if (!name || !pct) continue;
          if (name?.toLowerCase() === 'yes') {
            oddsMap.set('BTTS:yes', pctToImpliedFn(pct));
          }
        }
      }
    }
  } catch {
    // TxLINE odds not available yet — use defaults
    console.log(`[Markets] Using default odds for fixture ${fixtureId}`);
  }

  // Create markets that don't exist yet
  const existingKeys = new Set(
    fixture.markets.map((m: { marketType: string; outcomeValue: string }) => `${m.marketType}:${m.outcomeValue}`)
  );

  for (const def of marketDefs) {
    const key = `${def.marketType}:${def.outcomeValue}`;
    if (existingKeys.has(key)) continue;

    const oddsImplied = oddsMap.get(key) ?? def.defaultOdds;

    const market = await prisma.market.create({
      data: {
        fixtureId,
        marketType: def.marketType,
        outcomeLabel: def.outcomeLabel,
        outcomeValue: def.outcomeValue,
        oddsImplied,
      },
    });

    console.log(`[Markets] Created ${def.marketType}:${def.outcomeValue} for fixture ${fixtureId}`);

    // Initialize the on-chain escrow for this market, if the program is
    // deployed. Best-effort: a failure here doesn't block market creation —
    // off-chain social features (posts, likes, comments) work regardless,
    // and on-chain staking simply isn't available until this succeeds.
    if (CALLR_PROGRAM_ID) {
      try {
        await initializeOnChainEscrow(market.id, fixture, def.marketType);
      } catch (err) {
        console.error(`[Markets] On-chain init failed for market ${market.id}:`, err);
      }
    }
  }
}

/**
 * Maps a Callr market type to the TxLINE soccer stat key(s) used to settle
 * it (see TxODDS documentation > Soccer Feed > Stat Period Encoding).
 * Key 1 = Participant1 (home) goals, Key 2 = Participant2 (away) goals.
 */
function statKeysForMarketType(marketType: MarketDefinition['marketType']): {
  statKeyA: number;
  statKeyB: number | null;
} {
  switch (marketType) {
    case 'MATCH_WINNER':
    case 'DRAW':
    case 'OVER_2_5':
    case 'BTTS':
    case 'EXACT_SCORE':
    default:
      // All current market types settle from the same two goal-count stats;
      // the win condition itself (home win / draw / over 2.5 / BTTS) is
      // derived off-chain in lib/settlement/settle.ts from the verified
      // home_score/away_score values, then cross-checked on-chain.
      return { statKeyA: STAT_KEYS.P1_GOALS, statKeyB: STAT_KEYS.P2_GOALS };
  }
}

async function initializeOnChainEscrow(
  marketCuid: string,
  fixture: { txlineId: string; startTime: Date },
  marketType: MarketDefinition['marketType']
): Promise<void> {
  const keypair = loadSettlementKeypair();
  const program = getServerProgram(keypair);
  const { statKeyA, statKeyB } = statKeysForMarketType(marketType);

  const { txSig, marketEscrowPda } = await initializeMarketOnChain(program, keypair, {
    marketCuid,
    txlineFixtureId: parseInt(fixture.txlineId),
    statKeyA,
    statKeyB,
    kickoffTs: Math.floor(fixture.startTime.getTime() / 1000),
  });

  await prisma.market.update({
    where: { id: marketCuid },
    data: { escrowPda: marketEscrowPda.toBase58() },
  });

  console.log(`[Markets] On-chain escrow initialized for ${marketCuid}: ${txSig}`);
}

export async function generateAllMissingMarkets(): Promise<void> {
  const fixtures = await prisma.fixture.findMany({
    where: { status: { not: 'F' } },
    select: { id: true },
  });

  for (const f of fixtures) {
    await generateMarketsForFixture(f.id);
  }
}
