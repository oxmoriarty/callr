'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Users, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useSocketEvent, useMarketRoom } from '@/hooks/use-socket-room';
import { useCurrentUser } from '@/hooks/use-current-user';
import { usePrivy } from '@privy-io/react-auth';
import { impliedToDecimal, impliedToPct } from '@/lib/odds';
import { USDC_LAMPORTS } from '@/lib/constants';
import { StakeModal } from './stake-modal';
import type { MarketSummary, LiquidityUpdateEvent, OddsUpdateEvent } from '@/types';

interface MarketPanelProps {
  markets: MarketSummary[];
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
}

function formatPool(lamports: bigint): string {
  const usdc = Number(lamports) / USDC_LAMPORTS;
  if (usdc >= 1000) return `$${(usdc / 1000).toFixed(1)}k`;
  return `$${usdc.toFixed(0)}`;
}

function LiquidityBar({ support, challenge }: { support: bigint; challenge: bigint }) {
  const total = Number(support + challenge);
  if (total === 0) return null;
  const supportPct = (Number(support) / total) * 100;

  return (
    <div className="w-full h-1 bg-border rounded-full overflow-hidden">
      <motion.div
        className="h-full bg-gradient-to-r from-win to-win/80 rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${supportPct}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
    </div>
  );
}

function MarketCard({
  market,
  onStake,
}: {
  market: MarketSummary;
  onStake: (market: MarketSummary, side: 'support' | 'challenge') => void;
}) {
  const [odds, setOdds] = useState(market.oddsImplied);
  const [supportPool, setSupportPool] = useState(market.supportPool);
  const [challengePool, setChallengePool] = useState(market.challengePool);
  const [oddsFlash, setOddsFlash] = useState<'up' | 'down' | null>(null);

  useMarketRoom(market.id);

  useSocketEvent<LiquidityUpdateEvent>('liquidity:update', (data) => {
    if (data.marketId !== market.id) return;
    setSupportPool(BigInt(data.supportPool));
    setChallengePool(BigInt(data.challengePool));
    const prevOdds = odds;
    setOdds(data.oddsImplied);
    setOddsFlash(data.oddsImplied > prevOdds ? 'up' : 'down');
    setTimeout(() => setOddsFlash(null), 800);
  });

  useSocketEvent<OddsUpdateEvent>('odds:update', (data) => {
    if (data.marketType !== market.marketType) return;
    const prevOdds = odds;
    setOdds(data.oddsImplied);
    setOddsFlash(data.oddsImplied > prevOdds ? 'up' : 'down');
    setTimeout(() => setOddsFlash(null), 800);
  });

  const isSettled = market.status === 'SETTLED' || market.status === 'VOID';
  const isLocked = market.status === 'LOCKED';
  const totalPool = Number(supportPool + challengePool) / USDC_LAMPORTS;

  return (
    <div className={cn(
      'bg-canvas border border-border rounded-xl p-4 transition-all',
      isSettled && 'opacity-60'
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{market.outcomeLabel}</h3>
          <p className="text-xs text-text-muted mt-0.5 capitalize">
            {market.marketType.toLowerCase().replace(/_/g, ' ')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isLocked && (
            <span className="flex items-center gap-1 text-xs text-pending">
              <Lock className="w-3 h-3" /> Late entry
            </span>
          )}
          <motion.span
            key={odds}
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            className={cn(
              'text-lg font-bold tabular-nums transition-colors',
              oddsFlash === 'up' && 'text-win',
              oddsFlash === 'down' && 'text-loss',
              !oddsFlash && 'text-text-primary'
            )}
          >
            {impliedToDecimal(odds)}×
          </motion.span>
        </div>
      </div>

      {/* Implied probability */}
      <div className="text-xs text-text-muted mb-2">
        Implied: {impliedToPct(odds)}
      </div>

      {/* Liquidity bar */}
      <LiquidityBar support={supportPool} challenge={challengePool} />

      {/* Pool stats */}
      {totalPool > 0 && (
        <div className="flex items-center justify-between mt-1.5 text-xs text-text-muted">
          <span className="text-win font-medium">↑ {formatPool(supportPool)}</span>
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {market._count?.posts ?? 0} predictions
          </span>
          <span className="text-loss font-medium">{formatPool(challengePool)} ↓</span>
        </div>
      )}

      {/* CTA buttons */}
      {!isSettled && (
        <div className="flex gap-2 mt-3">
          <Button
            variant="support"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => onStake(market, 'support')}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Support
          </Button>
          <Button
            variant="challenge"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => onStake(market, 'challenge')}
          >
            <TrendingDown className="w-3.5 h-3.5" />
            Challenge
          </Button>
        </div>
      )}

      {market.status === 'SETTLED' && (
        <div className={cn(
          'mt-3 text-center text-xs font-medium py-1.5 rounded-lg',
          market.winnerSide === 'support' ? 'bg-win/10 text-win' : 'bg-loss/10 text-loss'
        )}>
          {market.winnerSide === 'support' ? '✓ Supporters won' : '✓ Challengers won'}
        </div>
      )}
    </div>
  );
}

export function MarketPanel({ markets, fixtureId }: MarketPanelProps) {
  const { user } = useCurrentUser();
  const { login } = usePrivy();
  const [stakeTarget, setStakeTarget] = useState<{
    market: MarketSummary;
    side: 'support' | 'challenge';
  } | null>(null);

  const handleStake = (market: MarketSummary, side: 'support' | 'challenge') => {
    if (!user) { login(); return; }
    setStakeTarget({ market, side });
  };

  if (markets.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-8 text-center">
        <p className="text-text-muted text-sm">No markets available yet</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3">
        {markets.map((market) => (
          <MarketCard
            key={market.id}
            market={market}
            onStake={handleStake}
          />
        ))}
      </div>

      {stakeTarget && (
        <StakeModal
          market={stakeTarget.market}
          side={stakeTarget.side}
          fixtureId={fixtureId}
          onClose={() => setStakeTarget(null)}
        />
      )}
    </>
  );
}
