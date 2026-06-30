import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { prisma } from '@/lib/prisma';
import { requireUser, AuthError } from '@/lib/auth-server';
import { SOLANA_RPC, USDC_MINT_DEVNET, USDC_LAMPORTS } from '@/lib/constants';

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);

    // Fetch open + claimable positions
    const positions = await prisma.position.findMany({
      where: { userId: user.id },
      include: {
        market: {
          select: {
            outcomeLabel: true,
            fixture: { select: { homeTeam: true, awayTeam: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    type PositionRow = (typeof positions)[number];

    const usdcLocked = positions
      .filter((p: PositionRow) => p.status === 'OPEN')
      .reduce((sum: number, p: PositionRow) => sum + Number(p.stakeAmount), 0) / USDC_LAMPORTS;

    const claimableRewards = positions
      .filter((p: PositionRow) => p.status === 'WON')
      .reduce((sum: number, p: PositionRow) => sum + Number(p.potentialReturn), 0) / USDC_LAMPORTS;

    // On-chain balances
    let usdcAvailable = 0;
    let solBalance = 0;

    if (user.walletAddress) {
      try {
        const connection = new Connection(SOLANA_RPC, 'confirmed');
        const pubkey = new PublicKey(user.walletAddress);

        const lamports = await connection.getBalance(pubkey);
        solBalance = lamports / 1e9;

        const usdcAta = getAssociatedTokenAddressSync(
          new PublicKey(USDC_MINT_DEVNET),
          pubkey
        );
        const tokenAccount = await connection.getTokenAccountBalance(usdcAta).catch(() => null);
        usdcAvailable = tokenAccount?.value.uiAmount ?? 0;
      } catch {
        // Wallet not yet funded or RPC error — default to 0
      }
    }

    const formattedPositions = positions
      .filter((p: PositionRow) => p.status !== 'VOID')
      .slice(0, 20)
      .map((p: PositionRow) => ({
        id: p.id,
        marketLabel: p.market.outcomeLabel,
        fixtureLabel: `${p.market.fixture.homeTeam} vs ${p.market.fixture.awayTeam}`,
        side: p.side,
        stakeAmount: Number(p.stakeAmount) / USDC_LAMPORTS,
        potentialReturn: Number(p.potentialReturn) / USDC_LAMPORTS,
        status: p.status,
      }));

    return NextResponse.json({
      usdcAvailable,
      usdcLocked,
      claimableRewards,
      solBalance,
      positions: formattedPositions,
      transactions: [], // populated once on-chain history indexing is added
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[API/wallet] Error:', err);
    return NextResponse.json({ error: 'Failed to load wallet' }, { status: 500 });
  }
}
