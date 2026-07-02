'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { MatchHeader } from '@/components/match/match-header';
import { MarketPanel } from '@/components/match/market-panel';
import { Feed } from '@/components/feed/feed';
import type { FixtureWithMarkets } from '@/types';

export default function MatchDetailPage() {
  const params = useParams<{ id: string }>();
  const fixtureId = params.id;

  const { data: fixture, isLoading } = useQuery<FixtureWithMarkets>({
    queryKey: ['fixture', fixtureId],
    queryFn: async () => {
      const res = await fetch(`/api/fixtures/${fixtureId}`);
      if (!res.ok) throw new Error('Fixture not found');
      return res.json() as Promise<FixtureWithMarkets>;
    },
    refetchInterval: 20_000,
  });

  if (isLoading) {
    return (
      <div className="px-4 py-4 max-w-2xl mx-auto space-y-4">
        <div className="skeleton h-56 rounded-xl" />
        <div className="skeleton h-28 rounded-xl" />
        <div className="skeleton h-28 rounded-xl" />
      </div>
    );
  }

  if (!fixture) {
    return (
      <div className="px-4 py-12 max-w-2xl mx-auto text-center">
        <p className="text-text-muted">Match not found</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto space-y-4">
      <MatchHeader fixture={fixture} />

      <section>
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-label mb-3">
          Prediction Markets
        </h2>
        <MarketPanel
          markets={fixture.markets}
          fixtureId={fixture.id}
          homeTeam={fixture.homeTeam}
          awayTeam={fixture.awayTeam}
        />
      </section>

      <section>
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-label mb-3">
          Predictions
        </h2>
        <Feed fixtureId={fixture.id} />
      </section>
    </div>
  );
}
