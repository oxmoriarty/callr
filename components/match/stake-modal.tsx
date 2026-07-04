'use no memo';
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TrendingUp, TrendingDown, Info, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Textarea, Label } from '@/components/ui/primitives';
import { useCurrentUser, useAuthToken } from '@/hooks/use-current-user';
import { useQueryClient } from '@tanstack/react-query';
import { calculatePotentialReturn, impliedToDecimal } from '@/lib/odds';
import { USDC_LAMPORTS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { MarketSummary } from '@/types';

const QUICK_AMOUNTS = [1, 5, 10, 25];

const schema = z.object({
  content: z.string().min(1, 'Add your take on this prediction').max(500),
  stakeAmount: z.coerce.number().min(0, 'Stake must be positive').max(1000, 'Max $1,000 per prediction'),
});

type FormInput = z.input<typeof schema>;
type FormData = z.output<typeof schema>;

type Step = 'compose' | 'confirm' | 'success';

interface StakeModalProps {
  market: MarketSummary;
  side: 'support' | 'challenge';
  fixtureId: string;
  onClose: () => void;
}

export function StakeModal({ market, side, onClose }: StakeModalProps) {
  const { user } = useCurrentUser();
  const getToken = useAuthToken();
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>('compose');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedData, setConfirmedData] = useState<FormData | null>(null);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: { content: '', stakeAmount: 0 },
  });

  const stakeAmount = watch('stakeAmount') || 0;
  const potentialReturn = stakeAmount > 0 ? calculatePotentialReturn(stakeAmount, market.oddsImplied) : 0;
  const profit = potentialReturn - stakeAmount;
  const isSupport = side === 'support';

  // Step 1 → Step 2: validate form then show confirmation
  const handleReview = (raw: FormInput) => {
    const data: FormData = schema.parse(raw);
    setConfirmedData(data);
    setError(null);
    setStep('confirm');
  };

  // Step 2 → Submit: actually post the prediction
  const handleConfirm = async () => {
    if (!user || !confirmedData) return;
    setSubmitting(true);
    setError(null);

    try {
      const token = await getToken();
      const stakeLamports = Math.floor(confirmedData.stakeAmount * USDC_LAMPORTS);

      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          marketId: market.id,
          content: confirmedData.content,
          side,
          stakeAmount: stakeLamports,
        }),
      });

      if (!res.ok) {
        const body = await res.json() as { error?: string };
        // Friendly error — never expose raw server/chain errors
        const raw = body.error ?? '';
        const friendly =
          raw.includes('insufficient') ? 'Insufficient USDC balance. Top up your wallet and try again.' :
          raw.includes('market') ? 'This market is no longer accepting predictions.' :
          raw.includes('Unauthorized') ? 'Session expired. Please sign in again.' :
          'Something went wrong. Your funds were not moved. Please try again.';
        throw new Error(friendly);
      }

      setStep('success');
      await qc.invalidateQueries({ queryKey: ['feed'] });
      await qc.invalidateQueries({ queryKey: ['fixtures'] });
      await qc.invalidateQueries({ queryKey: ['wallet'] });

      setTimeout(onClose, 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Your funds were not moved.');
      setStep('confirm'); // stay on confirm so user can retry
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !submitting) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              'flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-lg border',
              isSupport ? 'side-support' : 'side-challenge'
            )}>
              {isSupport
                ? <TrendingUp className="w-3.5 h-3.5" />
                : <TrendingDown className="w-3.5 h-3.5" />}
              {isSupport ? 'Supporting' : 'Challenging'}
            </span>
            <span className="text-base font-semibold">{market.outcomeLabel}</span>
          </DialogTitle>
          <DialogDescription>
            {step === 'compose' && 'Share your take and optionally stake USDC on-chain.'}
            {step === 'confirm' && 'Review your prediction before posting.'}
            {step === 'success' && 'Your prediction is live.'}
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">

          {/* ─── Step 1: Compose ─────────────────────────────────────────── */}
          {step === 'compose' && (
            <motion.div
              key="compose"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              className="space-y-4"
            >
              {/* Odds snapshot */}
              <div className="flex items-center justify-between p-3 bg-canvas rounded-lg border border-border">
                <div>
                  <p className="text-xs text-text-muted uppercase tracking-label">Odds</p>
                  <p className="text-xl font-bold mt-0.5">{impliedToDecimal(market.oddsImplied)}×</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-text-muted uppercase tracking-label">Market</p>
                  <p className="text-sm font-medium mt-0.5 capitalize">
                    {market.marketType.toLowerCase().replace(/_/g, ' ')}
                  </p>
                </div>
              </div>

              {/* Content */}
              <div className="space-y-1.5">
                <Label htmlFor="content">Your take</Label>
                <Textarea
                  id="content"
                  {...register('content')}
                  placeholder={`Why are you ${isSupport ? 'backing' : 'opposing'} this?`}
                  rows={3}
                />
                {errors.content && (
                  <p className="text-xs text-loss">{errors.content.message}</p>
                )}
              </div>

              {/* Stake */}
              <div className="space-y-1.5">
                <Label htmlFor="stake">Stake — optional</Label>
                <div className="flex gap-2">
                  <Input
                    id="stake"
                    {...register('stakeAmount')}
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="0.00"
                    className="flex-1"
                  />
                  <span className="flex items-center px-3 text-sm text-text-muted bg-canvas border border-border rounded-lg shrink-0">
                    USDC
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {QUICK_AMOUNTS.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setValue('stakeAmount', a)}
                      className="flex-1 py-1 text-xs font-medium border border-border rounded-md hover:border-accent/50 hover:text-accent transition-colors"
                    >
                      ${a}
                    </button>
                  ))}
                </div>
                {errors.stakeAmount && (
                  <p className="text-xs text-loss">{errors.stakeAmount.message}</p>
                )}
              </div>

              {/* Return preview */}
              {stakeAmount > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-canvas rounded-lg border border-border space-y-1.5"
                >
                  <div className="flex items-center gap-1.5 text-xs text-text-muted mb-2">
                    <Info className="w-3.5 h-3.5" />
                    Estimated reward if outcome hits
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Stake</span>
                    <span className="font-medium">${stakeAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Potential return</span>
                    <span className="font-semibold text-win">${potentialReturn.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-border pt-1.5">
                    <span className="text-text-muted">Net profit</span>
                    <span className="font-bold text-win">+${profit.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-text-muted">
                    Late-entry penalty may apply if market is already open.
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ─── Step 2: Confirm ─────────────────────────────────────────── */}
          {step === 'confirm' && confirmedData && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="space-y-4"
            >
              {/* Summary card */}
              <div className="bg-canvas rounded-xl border border-border overflow-hidden">
                <div className={cn(
                  'px-4 py-2.5 text-xs font-semibold uppercase tracking-label flex items-center gap-1.5',
                  isSupport ? 'bg-win/10 text-win' : 'bg-loss/10 text-loss'
                )}>
                  {isSupport ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {isSupport ? 'Supporting' : 'Challenging'} · {market.outcomeLabel}
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-sm text-text-primary leading-relaxed">
                    &ldquo;{confirmedData.content}&rdquo;
                  </p>
                  {confirmedData.stakeAmount > 0 && (
                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <span className="text-sm text-text-muted">Stake</span>
                      <span className="text-sm font-bold">${confirmedData.stakeAmount.toFixed(2)} USDC</span>
                    </div>
                  )}
                  {confirmedData.stakeAmount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-text-muted">If correct</span>
                      <span className="text-sm font-bold text-win">
                        +${(calculatePotentialReturn(confirmedData.stakeAmount, market.oddsImplied) - confirmedData.stakeAmount).toFixed(2)} USDC
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Immutability notice */}
              <div className="flex gap-2.5 p-3 bg-canvas rounded-lg border border-border">
                <AlertCircle className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                <p className="text-xs text-text-muted leading-relaxed">
                  Predictions are permanent and cannot be edited or deleted.
                  {confirmedData.stakeAmount > 0 && ' Your USDC will be locked in escrow until the market settles.'}
                </p>
              </div>

              {/* Error (retry) */}
              {error && (
                <div className="flex gap-2.5 p-3 bg-loss/10 border border-loss/20 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-loss shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-loss mb-0.5">Post failed</p>
                    <p className="text-xs text-loss/80">{error}</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ─── Step 3: Success ─────────────────────────────────────────── */}
          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="py-8 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
                className="text-5xl mb-4"
              >
                ✅
              </motion.div>
              <p className="font-bold text-text-primary text-lg">Prediction posted!</p>
              <p className="text-sm text-text-muted mt-1.5">
                {confirmedData?.stakeAmount
                  ? `$${confirmedData.stakeAmount.toFixed(2)} USDC locked in escrow.`
                  : 'Your call is live on the feed.'}
              </p>
            </motion.div>
          )}

        </AnimatePresence>

        {/* Footer */}
        {step === 'compose' && (
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={() => void handleSubmit(handleReview)()}
              className={isSupport ? 'bg-win hover:bg-win/90 text-white' : 'bg-loss hover:bg-loss/90 text-white'}
            >
              Review prediction →
            </Button>
          </DialogFooter>
        )}

        {step === 'confirm' && (
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => { setError(null); setStep('compose'); }} disabled={submitting}>
              ← Edit
            </Button>
            <Button
              onClick={() => void handleConfirm()}
              loading={submitting}
              className={isSupport ? 'bg-win hover:bg-win/90 text-white' : 'bg-loss hover:bg-loss/90 text-white'}
            >
              {submitting ? 'Posting…' : isSupport ? '↑ Confirm & Support' : '↓ Confirm & Challenge'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
