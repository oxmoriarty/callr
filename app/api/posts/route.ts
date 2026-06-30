import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUser, AuthError } from '@/lib/auth-server';
import { calculatePotentialReturnLamports, blendOdds } from '@/lib/odds';
import { emitToRoom } from '@/server/socket';
import { ROOM, isLive } from '@/lib/constants';

const createPostSchema = z.object({
  marketId: z.string().min(1),
  content: z.string().min(1).max(500),
  side: z.enum(['support', 'challenge']),
  stakeAmount: z.number().int().min(0), // USDC lamports (0 = no stake, just social)
  txSig: z.string().optional(),         // Solana tx signature for the on-chain stake
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = await req.json() as unknown;
    const data = createPostSchema.parse(body);

    // Fetch market + fixture
    const market = await prisma.market.findUnique({
      where: { id: data.marketId },
      include: { fixture: { select: { startTime: true, status: true } } },
    });

    if (!market) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 });
    }

    if (market.status === 'SETTLED' || market.status === 'VOID') {
      return NextResponse.json({ error: 'Market is already settled' }, { status: 400 });
    }

    // Calculate blended odds at entry time
    const blendedOdds = blendOdds(market.oddsImplied, market.supportPool, market.challengePool);

    // Calculate minutes elapsed for late-entry penalty
    const now = Date.now();
    const kickoff = market.fixture.startTime.getTime();
    const minutesElapsed = isLive(market.fixture.status)
      ? Math.max(0, (now - kickoff) / 60_000)
      : 0;

    const stakeLamports = BigInt(data.stakeAmount);
    const potentialReturn = stakeLamports > 0n
      ? calculatePotentialReturnLamports(stakeLamports, blendedOdds, minutesElapsed)
      : 0n;

    // Create post + position in a transaction
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const post = await tx.post.create({
        data: {
          authorId: user.id,
          marketId: data.marketId,
          content: data.content,
          side: data.side,
          stakeAmount: stakeLamports,
          txSig: data.txSig,
        },
        include: {
          author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          market: {
            include: {
              fixture: {
                select: { homeTeam: true, awayTeam: true, status: true, homeScore: true, awayScore: true, startTime: true },
              },
            },
          },
          _count: { select: { likes: true, comments: true, reposts: true } },
        },
      });

      // Create position if staking
      if (stakeLamports > 0n) {
        await tx.position.create({
          data: {
            userId: user.id,
            marketId: data.marketId,
            postId: post.id,
            side: data.side,
            stakeAmount: stakeLamports,
            entryOdds: blendedOdds,
            potentialReturn,
            onChainPda: data.txSig, // temporary — real PDA set after Anchor tx
          },
        });

        // Update market liquidity pools
        if (data.side === 'support') {
          await tx.market.update({
            where: { id: data.marketId },
            data: { supportPool: { increment: stakeLamports } },
          });
        } else {
          await tx.market.update({
            where: { id: data.marketId },
            data: { challengePool: { increment: stakeLamports } },
          });
        }
      }

      return post;
    });

    // Emit to feed and market room
    emitToRoom(ROOM.feed, 'post:new', result);
    emitToRoom(ROOM.market(data.marketId), 'liquidity:update', {
      marketId: data.marketId,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: err.errors }, { status: 400 });
    }
    console.error('[API/posts] Error:', err);
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }
}
