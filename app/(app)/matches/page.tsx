'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/primitives';
import { impliedToDecimal } from '@/lib/odds';
import type { FixtureWithMarkets } from '@/types';

type Filter = 'live' | 'upcoming' | 'finished';

function FixtureRow({ fixture }: { fixture: FixtureWithMarkets }) {
  const isLive = ['H1', 'H2', 'HT', 'ET1', 'ET2'].includes(fixture.status);
  const isFinished = ['F', 'FET', 'FPE'].includes(fixture.status);
  const kickedOff = isLive || isFinished;

  const startDate = new Date(fixture.startTime);
  const timeString = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const winnerMarket = fixture.markets.find((m) => m.marketType === 'MATCH_WINNER' && m.outcomeValue === 'home');

  return (
    <Link href={`/matches/${fixture.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface border border-border rounded-xl p-4 hover:border-border/80 transition-colors"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-text-muted font-medium uppercase tracking-label">
            {fixture.competition}
          </span>
          {isLive && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-live">
              <span className="live-dot" /> LIVE
            </span>
          )}
          {!kickedOff && <span className="text-xs text-text-muted">{timeString}</span>}
          {isFinished && <span className="text-xs text-text-muted">Full Time</span>}
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <p className="font-semibold text-text-primary">{fixture.homeTeam}</p>
            <p className="font-semibold text-text-primary mt-1">{fixture.awayTeam}</p>
          </div>

          {kickedOff ? (
            <div className="text-right">
              <p className="text-xl font-bold tabular-nums">{fixture.homeScore}</p>
              <p className="text-xl font-bold tabular-nums mt-1">{fixture.awayScore}</p>
            </div>
          ) : winnerMarket ? (
            <div className="text-right">
              <p className="odds-badge">{impliedToDecimal(winnerMarket.oddsImplied)}×</p>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 mt-3">
          <Badge variant="outline" className="text-xs">
            {fixture.markets.length} markets
          </Badge>
        </div>
      </motion.div>
    </Link>
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
      <h1 className="text-xl font-bold mb-4">Matches</h1>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="mb-4">
        <TabsList>
          <TabsTrigger value="live">Live</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="finished">Finished</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-32 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && fixtures.length === 0 && (
        <div className="bg-surface border border-border rounded-xl p-12 text-center">
          <p className="text-text-muted text-sm">No {filter} matches right now</p>
        </div>
      )}

      <div className="space-y-3">
        {fixtures.map((fixture) => (
          <FixtureRow key={fixture.id} fixture={fixture} />
        ))}
      </div>
    </div>
  );
}
