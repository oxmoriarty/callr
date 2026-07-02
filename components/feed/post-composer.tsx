'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TrendingUp, TrendingDown, ChevronDown, ChevronLeft, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/primitives';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/primitives';
import { useCurrentUser, useAuthToken } from '@/hooks/use-current-user';
import { usePrivy } from '@privy-io/react-auth';
import { impliedToDecimal } from '@/lib/odds';
import { USDC_LAMPORTS } from '@/lib/constants';
import type { FixtureWithMarkets, MarketSummary } from '@/types';

const schema = z.object({
  content: z.string().min(1, 'Write your prediction').max(500),
  stakeAmount: z.coerce.number().min(0).max(10_000),
});
type FormInput = z.input<typeof schema>;
type FormData = z.output<typeof schema>;

type Step = 'compose' | 'pick-fixture' | 'pick-market';

interface PostComposerProps {
  onSuccess?: () => void;
  defaultFixture?: FixtureWithMarkets;
}

export function PostComposer({ onSuccess, defaultFixture }: PostComposerProps) {
  const { user } = useCurrentUser();
  const { login } = usePrivy();
  const getToken = useAuthToken();
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>('compose');
  const [selectedFixture, setSelectedFixture] = useState<FixtureWithMarkets | null>(defaultFixture ?? null);
  const [selectedMarket, setSelectedMarket] = useState<MarketSummary | null>(null);
  const [side, setSide] = useState<'support' | 'challenge'>('support');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: { content: '', stakeAmount: 0 },
  });

  const content = watch('content');

  const { data: fixtures = [] } = useQuery<FixtureWithMarkets[]>({
    queryKey: ['fixtures', 'all'],
    queryFn: async () => {
      const [live, upcoming] = await Promise.all([
        fetch('/api/fixtures?filter=live').then(r => r.json()),
        fetch('/api/fixtures?filter=upcoming').then(r => r.json()),
      ]);
      return [...(live as FixtureWithMarkets[]), ...(upcoming as FixtureWithMarkets[])];
    },
    staleTime: 2 * 60_000,
  });

  const onSubmit = async (raw: FormInput) => {
    const data: FormData = schema.parse(raw);
    if (!user) { login(); return; }
    if (!selectedMarket) { setError('Pick a market to predict on'); return; }
    setSubmitting(true);
    setError(null);

    try {
      const token = await getToken();
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          marketId: selectedMarket.id,
          content: data.content,
          side,
          stakeAmount: Math.floor(data.stakeAmount * USDC_LAMPORTS),
        }),
      });

      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? 'Post failed');
      }

      reset();
      setSelectedFixture(defaultFixture ?? null);
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
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      {/* Header strip showing current selection */}
      {selectedMarket && selectedFixture && (
        <div className="px-4 pt-3 pb-0">
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <button
              onClick={() => { setSelectedMarket(null); setSelectedFixture(null); }}
              className="text-text-muted hover:text-loss transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
            <span className="text-text-muted">{selectedFixture.homeTeam} vs {selectedFixture.awayTeam}</span>
            <span className="text-border">·</span>
            <span className="font-medium text-text-primary">{selectedMarket.outcomeLabel}</span>
            <span className="odds-badge ml-auto">{impliedToDecimal(selectedMarket.oddsImplied)}×</span>
          </div>
          {/* Side toggle */}
          <div className="flex gap-1.5 mt-2">
            {(['support', 'challenge'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSide(s)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
                  side === s
                    ? s === 'support' ? 'bg-win/15 border-win/40 text-win' : 'bg-loss/15 border-loss/40 text-loss'
                    : 'border-border text-text-muted hover:border-border/80'
                )}
              >
                {s === 'support' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {s === 'support' ? 'Support' : 'Challenge'}
              </button>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {step === 'compose' && (
          <motion.div key="compose" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="p-4">
              <div className="flex gap-3">
                <Avatar className="w-9 h-9 shrink-0 mt-0.5">
                  <AvatarImage src={user.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {user.displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  {/* Market picker trigger */}
                  {!selectedMarket && (
                    <button
                      onClick={() => setStep('pick-fixture')}
                      className="w-full flex items-center justify-between mb-3 px-3 py-2 rounded-lg border border-dashed border-border text-sm text-text-muted hover:border-accent/40 hover:text-accent transition-colors"
                    >
                      Pick a match & market
                      <ChevronDown className="w-4 h-4 shrink-0" />
                    </button>
                  )}

                  <Textarea
                    {...register('content')}
                    placeholder={
                      selectedMarket
                        ? `Why are you ${side === 'support' ? 'backing' : 'opposing'} this?`
                        : 'Share your football prediction…'
                    }
                    className="resize-none min-h-[72px] bg-transparent border-0 px-0 py-0 focus:ring-0 text-sm placeholder:text-text-muted/60"
                  />
                  {errors.content && (
                    <p className="text-xs text-loss mt-1">{errors.content.message}</p>
                  )}
                </div>
              </div>

              {error && (
                <p className="text-xs text-loss mt-2 pl-12">{error}</p>
              )}

              <div className="flex items-center justify-between pt-3 mt-2 border-t border-border/50 pl-12">
                <span className={cn('text-xs', content.length > 450 ? 'text-loss' : 'text-text-muted')}>
                  {500 - content.length}
                </span>
                <Button
                  onClick={() => void handleSubmit(onSubmit)()}
                  size="sm"
                  loading={submitting}
                  disabled={!content.trim() || submitting}
                >
                  Post prediction
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'pick-fixture' && (
          <motion.div key="fixtures" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <button onClick={() => setStep('compose')} className="text-text-muted hover:text-text-primary">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <h3 className="text-sm font-semibold">Pick a match</h3>
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {fixtures.length === 0 && (
                  <p className="text-xs text-text-muted text-center py-6">No upcoming matches</p>
                )}
                {fixtures.map((fixture) => {
                  const isLive = ['H1', 'H2', 'HT'].includes(fixture.status);
                  return (
                    <button
                      key={fixture.id}
                      onClick={() => { setSelectedFixture(fixture); setStep('pick-market'); }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-canvas transition-colors text-left border border-border/50 hover:border-border"
                    >
                      <div>
                        <p className="text-sm font-medium">{fixture.homeTeam} vs {fixture.awayTeam}</p>
                        <p className="text-xs text-text-muted">{fixture.competition}</p>
                      </div>
                      {isLive && (
                        <span className="flex items-center gap-1 text-xs text-live font-medium shrink-0">
                          <span className="live-dot" /> LIVE
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {step === 'pick-market' && selectedFixture && (
          <motion.div key="markets" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <button onClick={() => setStep('pick-fixture')} className="text-text-muted hover:text-text-primary">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold">Pick a market</h3>
                  <p className="text-xs text-text-muted">{selectedFixture.homeTeam} vs {selectedFixture.awayTeam}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                {selectedFixture.markets.map((market) => (
                  <button
                    key={market.id}
                    onClick={() => { setSelectedMarket(market); setStep('compose'); }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-canvas transition-colors text-left border border-border/50 hover:border-border"
                  >
                    <span className="text-sm">{market.outcomeLabel}</span>
                    <span className="odds-badge shrink-0">{impliedToDecimal(market.oddsImplied)}×</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
