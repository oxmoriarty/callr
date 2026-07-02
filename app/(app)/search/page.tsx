'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search as SearchIcon, Users, Trophy } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/primitives';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/primitives';
import { useDebounce } from '@/hooks/use-debounce';

interface SearchResult {
  users: Array<{
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    _count: { followers: number };
  }>;
  fixtures: Array<{
    id: string;
    homeTeam: string;
    awayTeam: string;
    competition: string;
    startTime: string;
    status: string;
  }>;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  const { data, isLoading } = useQuery<SearchResult>({
    queryKey: ['search', debouncedQuery],
    queryFn: async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`);
      return res.json() as Promise<SearchResult>;
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 10_000,
  });

  const hasResults = (data?.users.length ?? 0) > 0 || (data?.fixtures.length ?? 0) > 0;

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto">
      <div className="relative mb-6">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search players, teams, matches…"
          className="pl-9 h-10"
          autoFocus
        />
      </div>

      <AnimatePresence mode="wait">
        {debouncedQuery.length < 2 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 text-text-muted text-sm"
          >
            Search for users or matches
          </motion.div>
        ) : isLoading ? (
          <motion.div key="loading" className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-16 rounded-xl" />
            ))}
          </motion.div>
        ) : !hasResults ? (
          <motion.div
            key="no-results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 text-text-muted text-sm"
          >
            No results for &ldquo;{debouncedQuery}&rdquo;
          </motion.div>
        ) : (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {(data?.users.length ?? 0) > 0 && (
              <section>
                <h2 className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-label mb-3">
                  <Users className="w-3.5 h-3.5" /> People
                </h2>
                <div className="space-y-2">
                  {data?.users.map((user) => (
                    <Link key={user.id} href={`/${user.username}`}>
                      <div className="flex items-center gap-3 p-3 bg-surface border border-border rounded-xl hover:border-border/80 transition-colors">
                        <Avatar className="w-9 h-9">
                          <AvatarImage src={user.avatarUrl ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {user.displayName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{user.displayName}</p>
                          <p className="text-xs text-text-muted">
                            @{user.username} · {user._count.followers} followers
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {(data?.fixtures.length ?? 0) > 0 && (
              <section>
                <h2 className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-label mb-3">
                  <Trophy className="w-3.5 h-3.5" /> Matches
                </h2>
                <div className="space-y-2">
                  {data?.fixtures.map((fixture) => {
                    const isLive = ['H1', 'H2', 'HT'].includes(fixture.status);
                    return (
                      <Link key={fixture.id} href={`/matches/${fixture.id}`}>
                        <div className="flex items-center justify-between p-3 bg-surface border border-border rounded-xl hover:border-border/80 transition-colors">
                          <div>
                            <p className="text-sm font-medium">
                              {fixture.homeTeam} vs {fixture.awayTeam}
                            </p>
                            <p className="text-xs text-text-muted">{fixture.competition}</p>
                          </div>
                          {isLive && (
                            <span className="flex items-center gap-1 text-xs font-semibold text-live">
                              <span className="live-dot" /> LIVE
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
