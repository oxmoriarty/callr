/**
 * Settlement Engine
 *
 * After a match finishes:
 * 1. Fetch final scores from TxLINE
 * 2. Fetch stat-validation proof for each relevant stat key
 * 3. Determine winner side for each market
 * 4. Mark positions as WON/LOST
 * 5. Emit notifications
 *
 * On-chain settlement (Anchor CPI into TxLINE validate_stat) is handled
 * separately via the Solana program once deployed.
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { fetchScoresSnapshot, fetchStatValidation } from '@/lib/txline/client';
import { STAT_KEYS } from '@/lib/constants';
import { emitToRoom, emitNotification } from '@/server/socket';
import { ROOM } from '@/lib/constants';
import type { MarketType } from '@/types';

interface SettlementResult {
  marketId: string;
  marketType: MarketType;
  outcomeValue: string;
  winnerSide: 'support' | 'challenge' | 'void';
  homeScore: number;
  awayScore: number;
  proof?: {
    ts: number;
    seq: number;
    statKey: number;
    value: number;
  };
}

export async function settleFixture(fixtureId: string): Promise<SettlementResult[]> {
  const fixture = await prisma.fixture.findUnique({
    where: { id: fixtureId },
    include: {
      markets: {
        where: { status: { in: ['OPEN', 'LOCKED'] } },
      },
    },
  });

  if (!fixture) throw new Error(`Fixture not found: ${fixtureId}`);
  if (fixture.markets.length === 0) return [];

  console.log(`[Settlement] Settling ${fixture.markets.length} markets for ${fixture.homeTeam} vs ${fixture.awayTeam}`);

  // Fetch final scores from TxLINE
  const scores = await fetchScoresSnapshot(parseInt(fixture.txlineId));
  const latestScore = scores[scores.length - 1];

  if (!latestScore?.scoreSoccer) {
    console.warn('[Settlement] No score data available, voiding markets');
    await voidAllMarkets(fixture.markets.map((m: { id: string }) => m.id));
    return [];
  }

  const homeScore = latestScore.scoreSoccer.Participant1?.Total?.Goals ?? 0;
  const awayScore = latestScore.scoreSoccer.Participant2?.Total?.Goals ?? 0;
  const totalGoals = homeScore + awayScore;
  const homeScored = homeScore > 0;
  const awayScored = awayScore > 0;

  console.log(`[Settlement] Final score: ${fixture.homeTeam} ${homeScore} - ${awayScore} ${fixture.awayTeam}`);

  // Fetch proof for final seq
  const finalSeq = latestScore.seq;
  let proof: SettlementResult['proof'];

  try {
    const validation = await fetchStatValidation(
      parseInt(fixture.txlineId),
      finalSeq,
      STAT_KEYS.P1_GOALS,
      STAT_KEYS.P2_GOALS
    );
    proof = {
      ts: validation.ts,
      seq: finalSeq,
      statKey: STAT_KEYS.P1_GOALS,
      value: validation.statToProve.value,
    };
    console.log(`[Settlement] Got TxLINE proof at ts=${validation.ts}`);
  } catch (err) {
    console.warn('[Settlement] Could not fetch proof, settling without on-chain verification:', err);
  }

  const results: SettlementResult[] = [];

  for (const market of fixture.markets) {
    let winnerSide: 'support' | 'challenge' | 'void' = 'void';

    switch (market.marketType as MarketType) {
      case 'MATCH_WINNER': {
        if (market.outcomeValue === 'home') {
          winnerSide = homeScore > awayScore ? 'support' : 'challenge';
        } else if (market.outcomeValue === 'away') {
          winnerSide = awayScore > homeScore ? 'support' : 'challenge';
        }
        break;
      }

      case 'DRAW': {
        winnerSide = homeScore === awayScore ? 'support' : 'challenge';
        break;
      }

      case 'OVER_2_5': {
        if (market.outcomeValue === 'over') {
          winnerSide = totalGoals > 2.5 ? 'support' : 'challenge';
        } else if (market.outcomeValue === 'under') {
          winnerSide = totalGoals < 2.5 ? 'support' : 'challenge';
        }
        break;
      }

      case 'BTTS': {
        const btts = homeScored && awayScored;
        if (market.outcomeValue === 'yes') {
          winnerSide = btts ? 'support' : 'challenge';
        } else if (market.outcomeValue === 'no') {
          winnerSide = !btts ? 'support' : 'challenge';
        }
        break;
      }

      case 'EXACT_SCORE': {
        // outcomeValue format: "2-1"
        const [hs, as_] = market.outcomeValue.split('-').map(Number);
        winnerSide = hs === homeScore && as_ === awayScore ? 'support' : 'challenge';
        break;
      }
    }

    results.push({
      marketId: market.id,
      marketType: market.marketType as MarketType,
      outcomeValue: market.outcomeValue,
      winnerSide,
      homeScore,
      awayScore,
      proof,
    });

    // Settle the market in DB
    await settleMarket(market.id, winnerSide);
  }

  // Update fixture status to F
  await prisma.fixture.update({
    where: { id: fixtureId },
    data: { status: 'F', homeScore, awayScore },
  });

  return results;
}

async function settleMarket(
  marketId: string,
  winnerSide: 'support' | 'challenge' | 'void'
): Promise<void> {
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Update market
    await tx.market.update({
      where: { id: marketId },
      data: {
        status: 'SETTLED',
        winnerSide,
        settledAt: new Date(),
      },
    });

    if (winnerSide === 'void') {
      // Void all positions
      await tx.position.updateMany({
        where: { marketId, status: 'OPEN' },
        data: { status: 'VOID' },
      });
      return;
    }

    // Mark positions as WON or LOST
    const positions = await tx.position.findMany({
      where: { marketId, status: 'OPEN' },
      include: { user: { select: { id: true } } },
    });

    for (const position of positions) {
      const won = position.side === winnerSide;
      await tx.position.update({
        where: { id: position.id },
        data: { status: won ? 'WON' : 'LOST' },
      });

      // Create notification
      await tx.notification.create({
        data: {
          recipientId: position.userId,
          type: won ? 'POSITION_WON' : 'POSITION_LOST',
          marketId,
          message: won
            ? `Your prediction won! Claim your reward.`
            : `Your prediction didn't come through this time.`,
        },
      });

      // Emit real-time notification
      emitNotification(position.userId, {
        id: position.id,
        type: won ? 'POSITION_WON' : 'POSITION_LOST',
        message: won ? 'Your prediction won!' : 'Your prediction lost.',
        marketId,
      } as Parameters<typeof emitNotification>[1]);
    }
  });

  // Emit settlement event to market room
  emitToRoom(ROOM.market(marketId), 'market:settled', { marketId, winnerSide });
}

async function voidAllMarkets(marketIds: string[]): Promise<void> {
  for (const id of marketIds) {
    await settleMarket(id, 'void');
  }
}
