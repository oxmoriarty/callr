'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TrendingUp, TrendingDown, ChevronDown } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea, Input } from '@/components/ui/primitives';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/primitives';
import { useCurrentUser, useAuthToken } from '@/hooks/use-current-user';
import { usePrivy } from '@privy-io/react-auth';
import { impliedToDecimal } from '@/lib/odds';
import { USDC_LAMPORTS } from '@/lib/constants';
import type { FixtureWithMarkets, MarketSummary } from '@/types';

const schema = z.object({
  content: z.string().min(1, 'Write something').max(500),
  stakeAmount: z.coerce.number().min(0).max(10_000),
});

type FormInput = z.input<typeof schema>;
type FormData = z.output<typeof schema>;

export function PostComposer({ onSuccess }: { onSuccess?: () => void }) {
  const { user } = useCurrentUser();
  const { login } = usePrivy();
  const getToken = useAuthToken();
  const qc = useQueryClient();

  const [selectedFixture, setSelectedFixture] = useState<FixtureWithMarkets | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<MarketSummary | null>(null);
  const [side, setSide] = useState<'support' | 'challenge'>('support');
  const [step, setStep] = useState<'compose' | 'pick-fixture' | 'pick-market'>('compose');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, watch, reset } = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: { content: '', stakeAmount: 0 },
  });

  const content = watch('content');

  // Fetch fixtures
  const { data: fixtures = [] } = useQuery<FixtureWithMarkets[]>({
    queryKey: ['fixtures', 'upcoming'],
    queryFn: async () => {
      const res = await fetch('/api/fixtures?filter=upcoming');
      return res.json() as Promise<FixtureWithMarkets[]>;
    },
    staleTime: 2 * 60_000,
  });

  const { data: liveFixtures = [] } = useQuery<FixtureWithMarkets[]>({
    queryKey: ['fixtures', 'live'],
    queryFn: async () => {
      const res = await fetch('/api/fixtures?filter=live');
      return res.json() as Promise<FixtureWithMarkets[]>;
    },
    refetchInterval: 30_000,
  });

  const allFixtures = [...liveFixtures, ...fixtures];

  const onSubmit = async (raw: FormInput) => {
    const data: FormData = schema.parse(raw);
    if (!user) { login(); return; }
    if (!selectedMarket) { setError('Pick a market to predict on'); return; }
    setSubmitting(true);
    setError(null);

    try {
      const token = await getToken();
      const stakeLamports = Math.floor(data.stakeAmount * USDC_LAMPORTS);

      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          marketId: selectedMarket.id,
          content: data.content,
          side,
          stakeAmount: stakeLamports,
        }),
      });

      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? 'Post failed');
      }

      // Reset form
      reset();
      setSelectedFixture(null);
      setSelectedMarket(null);
      setSide('support');
      setStep('compose');

      await qc.invalidateQueries({ queryKey: ['feed'] });
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="bg-surface border border-border rounded-xl p-6 text-center">
        <p className="text-text-muted text-sm mb-3">Sign in to make predictions</p>
        <Button onClick={() => login()} size="sm">Sign in</Button>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex gap-3">
        <Avatar className="w-9 h-9 shrink-0 mt-0.5">
          <AvatarImage src={user.avatarUrl ?? undefined} />
          <AvatarFallback className="text-xs">
            {user.displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          {/* Market picker button */}
          <button
            type="button"
            onClick={() => setStep(step === 'pick-fixture' ? 'compose' : 'pick-fixture')}
            className={cn(
              'w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors mb-3',
              selectedMarket
                ? 'border-accent/40 bg-accent/5 text-text-primary'
                : 'border-border bg-canvas text-text-muted hover:border-border/80'
            )}
          >
            {selectedMarket && selectedFixture ? (
              <span className="font-medium">
                {selectedFixture.homeTeam} vs {selectedFixture.awayTeam} · {selectedMarket.outcomeLabel}
              </span>
            ) : (
              <span>Pick a match to predict on</span>
            )}
            <ChevronDown className={cn('w-4 h-4 shrink-0 transition-transform', step === 'pick-fixture' && 'rotate-180')} />
          </button>

          {/* Fixture picker dropdown */}
          <AnimatePresence>
            {step === 'pick-fixture' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-3"
              >
                <div className="border border-border rounded-lg bg-canvas max-h-52 overflow-y-auto">
                  {allFixtures.length === 0 ? (
                    <p className="px-3 py-4 text-xs text-text-muted text-center">No matches available</p>
                  ) : (
                    allFixtures.map((fixture) => {
                      const isLive = ['H1', 'H2', 'HT'].includes(fixture.status);
                      return (
                        <button
                          key={fixture.id}
                          type="button"
                          onClick={() => {
                            setSelectedFixture(fixture);
                            setSelectedMarket(null);
                            setStep('pick-market');
                          }}
                          className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-surface transition-colors text-left border-b border-border/50 last:border-0"
                        >
                          <div>
                            <span className="text-sm font-medium">{fixture.homeTeam} vs {fixture.awayTeam}</span>
                            <p className="text-xs text-text-muted">{fixture.competition}</p>
                          </div>
                          {isLive && (
                            <span className="flex items-center gap-1 text-xs text-live font-medium">
                              <span className="live-dot" /> LIVE
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}

            {step === 'pick-market' && selectedFixture && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-3"
              >
                <div className="border border-border rounded-lg bg-canvas">
                  {selectedFixture.markets.map((market) => (
                    <button
                      key={market.id}
                      type="button"
                      onClick={() => {
                        setSelectedMarket(market);
                        setStep('compose');
                      }}
                      className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-surface transition-colors text-left border-b border-border/50 last:border-0"
                    >
                      <span className="text-sm">{market.outcomeLabel}</span>
                      <span className="odds-badge">{impliedToDecimal(market.oddsImplied)}×</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Side selector */}
          {selectedMarket && (
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setSide('support')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-xs font-medium transition-all',
                  side === 'support'
                    ? 'bg-win/15 border-win/40 text-win'
                    : 'border-border text-text-muted hover:border-win/30 hover:text-win'
                )}
              >
                <TrendingUp className="w-3.5 h-3.5" /> Support
              </button>
              <button
                type="button"
                onClick={() => setSide('challenge')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-xs font-medium transition-all',
                  side === 'challenge'
                    ? 'bg-loss/15 border-loss/40 text-loss'
                    : 'border-border text-text-muted hover:border-loss/30 hover:text-loss'
                )}
              >
                <TrendingDown className="w-3.5 h-3.5" /> Challenge
              </button>
            </div>
          )}

          {/* Text input */}
          <Textarea
            {...register('content')}
            placeholder={
              selectedMarket
                ? `Why are you ${side === 'support' ? 'supporting' : 'challenging'} ${selectedMarket.outcomeLabel}?`
                : 'Share your prediction…'
            }
            className="mb-2 resize-none min-h-[80px] bg-transparent border-0 px-0 py-0 text-sm focus:ring-0 placeholder:text-text-muted/60"
          />

          {/* Bottom bar */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/50">
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">Stake (USDC)</span>
              <Input
                {...register('stakeAmount')}
                type="number"
                min="0"
                step="0.5"
                placeholder="0"
                className="w-20 h-7 text-xs px-2"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className={cn('text-xs', content.length > 450 ? 'text-loss' : 'text-text-muted')}>
                {500 - content.length}
              </span>
              <Button
                onClick={() => void handleSubmit(onSubmit)()}
                size="sm"
                loading={submitting}
                disabled={!content.trim() || submitting}
              >
                Post
              </Button>
            </div>
          </div>

          {error && (
            <p className="mt-2 text-xs text-loss">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
