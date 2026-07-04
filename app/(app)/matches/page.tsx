'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { impliedToDecimal } from '@/lib/odds';
import { cn } from '@/lib/utils';
import type { FixtureWithMarkets } from '@/types';

type Filter = 'live' | 'upcoming' | 'finished';

function OddsPill({ label, odds, className }: { label: string; odds: number; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg bg-canvas border border-border min-w-[52px]', className)}>
      <span className="text-[10px] text-text-muted font-medium uppercase tracking-label">{label}</span>
      <span className="text-sm font-bold tabular-nums text-text-primary">{impliedToDecimal(odds)}</span>
    </div>
  );
}

function FixtureRow({ fixture, index }: { fixture: FixtureWithMarkets; index: number }) {
  const isLive = ['H1', 'H2', 'HT', 'ET1', 'ET2', 'WET', 'WPE', 'PE'].includes(fixture.status);
  const isFinished = ['F', 'FET', 'FPE'].includes(fixture.status);
  const kickedOff = isLive || isFinished;

  const startDate = new Date(fixture.startTime);
  const timeString = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateString = startDate.toLocaleDateString([], { month: 'short', day: 'numeric' });

  const homeMarket = fixture.markets.find((m) => m.marketType === 'MATCH_WINNER' && m.outcomeValue === 'home');
  const drawMarket = fixture.markets.find((m) => m.marketType === 'DRAW');
  const awayMarket = fixture.markets.find((m) => m.marketType === 'MATCH_WINNER' && m.outcomeValue === 'away');

  const totalPredictions = fixture.markets.reduce((sum, m) => sum + (m._count?.posts ?? 0), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Link href={`/matches/${fixture.id}`}>
        <div className="bg-surface border border-border rounded-xl p-4 hover:border-border/80 hover:bg-surface/80 transition-all group">
          {/* Top row: competition + time/status */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold text-text-muted uppercase tracking-label">
              {fixture.competition}
            </span>
            <div className="flex items-center gap-2">
              {totalPredictions > 0 && (
                <span className="text-[10px] text-text-muted">
                  {totalPredictions} prediction{totalPredictions !== 1 ? 's' : ''}
                </span>
              )}
              {isLive && (
                <span className="flex items-center gap-1.5 text-xs font-bold text-live">
                  <span className="live-dot" /> LIVE
                </span>
              )}
              {!kickedOff && (
                <span className="text-xs text-text-muted">{dateString} · {timeString}</span>
              )}
              {isFinished && (
                <span className="text-xs font-medium text-text-muted">Full Time</span>
              )}
            </div>
          </div>

          {/* Teams + score */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-text-primary truncate">{fixture.homeTeam}</p>
              <p className="font-semibold text-text-primary truncate mt-1">{fixture.awayTeam}</p>
            </div>

            {kickedOff ? (
              /* Score */
              <div className="text-right shrink-0">
                <p className={cn('text-2xl font-bold tabular-nums', isLive && 'text-live')}>{fixture.homeScore}</p>
                <p className={cn('text-2xl font-bold tabular-nums mt-1', isLive && 'text-live')}>{fixture.awayScore}</p>
              </div>
            ) : (
              /* H/D/A odds pills */
              homeMarket && drawMarket && awayMarket ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <OddsPill label="1" odds={homeMarket.oddsImplied} />
                  <OddsPill label="X" odds={drawMarket.oddsImplied} />
                  <OddsPill label="2" odds={awayMarket.oddsImplied} />
                </div>
              ) : homeMarket ? (
                <OddsPill label="H" odds={homeMarket.oddsImplied} />
              ) : null
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function MatchesPage() {
  const [filter, setFilter] = useState<Filter>('live');

  const { data: fixtures = [], isLoading } = useQuery<FixtureWithMarkets[]>({
    queryKey: ['fixtures', filter],
    queryFn: async () => {
      const res = await fetch(`/api/fixtures?filter=${filter}`);
      return res.json() as Promise<FixtureWithMarkets[]>;
    },
    refetchInterval: filter === 'live' ? 15_000 : 60_000,
  });

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold">Matches</h1>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="live">Live</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="finished">Finished</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && fixtures.length === 0 && (
        <div className="bg-surface border border-border rounded-xl p-16 text-center">
          <div className="text-4xl mb-3">⚽</div>
          <p className="font-semibold text-text-primary mb-1">
            {filter === 'live' ? 'No matches live right now' :
             filter === 'upcoming' ? 'No upcoming matches' :
             'No finished matches yet'}
          </p>
          <p className="text-text-muted text-sm">
            {filter === 'live' ? 'Check back when World Cup matches are in play' :
             filter === 'upcoming' ? 'Fixtures will appear here when scheduled' :
             'Completed matches will appear here'}
          </p>
        </div>
      )}

      <div className="space-y-2.5">
        {fixtures.map((fixture, i) => (
          <FixtureRow key={fixture.id} fixture={fixture} index={i} />
        ))}
      </div>
    </div>
  );
}
