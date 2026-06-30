'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TrendingUp, TrendingDown, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
  content: z.string().min(1, 'Add a prediction note').max(500),
  stakeAmount: z.coerce
    .number()
    .min(0, 'Stake must be positive')
    .max(1000, 'Max stake is $1,000'),
});

type FormInput = z.input<typeof schema>;
type FormData = z.output<typeof schema>;

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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: { content: '', stakeAmount: 0 },
  });

  const stakeAmount = watch('stakeAmount') || 0;
  const potentialReturn = stakeAmount > 0
    ? calculatePotentialReturn(stakeAmount, market.oddsImplied)
    : 0;
  const profit = potentialReturn - stakeAmount;

  const isSupport = side === 'support';

  const onSubmit = async (raw: FormInput) => {
    const data: FormData = schema.parse(raw);
    if (!user) return;
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
          marketId: market.id,
          content: data.content,
          side,
          stakeAmount: stakeLamports,
        }),
      });

      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? 'Failed to post prediction');
      }

      setSuccess(true);
      await qc.invalidateQueries({ queryKey: ['feed'] });
      await qc.invalidateQueries({ queryKey: ['fixtures'] });

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className={cn(
                'flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-lg border',
                isSupport ? 'side-support' : 'side-challenge'
              )}
            >
              {isSupport ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {isSupport ? 'Supporting' : 'Challenging'}
            </span>
            {market.outcomeLabel}
          </DialogTitle>
          <DialogDescription>
            Share your prediction and optionally stake USDC to back it on-chain.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="py-8 text-center"
          >
            <div className="text-4xl mb-3">✅</div>
            <p className="font-semibold text-text-primary">Prediction posted!</p>
            <p className="text-sm text-text-muted mt-1">Your call is live.</p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {/* Odds display */}
            <div className="flex items-center justify-between p-3 bg-canvas rounded-lg border border-border">
              <div>
                <p className="text-xs text-text-muted uppercase tracking-label">Current Odds</p>
                <p className="text-xl font-bold text-text-primary mt-0.5">
                  {impliedToDecimal(market.oddsImplied)}×
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-text-muted uppercase tracking-label">Type</p>
                <p className="text-sm font-medium text-text-primary mt-0.5">
                  {market.marketType.replace(/_/g, ' ')}
                </p>
              </div>
            </div>

            {/* Content */}
            <div className="space-y-1.5">
              <Label htmlFor="content">Your take</Label>
              <Textarea
                id="content"
                {...register('content')}
                placeholder={`Why are you ${isSupport ? 'supporting' : 'challenging'} this outcome?`}
                rows={3}
              />
              {errors.content && (
                <p className="text-xs text-loss">{errors.content.message}</p>
              )}
            </div>

            {/* Stake amount */}
            <div className="space-y-1.5">
              <Label htmlFor="stake">Stake (USDC) — optional</Label>
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
                <span className="flex items-center px-3 text-sm text-text-muted bg-canvas border border-border rounded-lg">
                  USDC
                </span>
              </div>

              {/* Quick amounts */}
              <div className="flex gap-2">
                {QUICK_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setValue('stakeAmount', amount)}
                    className="flex-1 py-1 text-xs font-medium border border-border rounded-md hover:border-accent/50 hover:text-accent transition-colors"
                  >
                    ${amount}
                  </button>
                ))}
              </div>

              {errors.stakeAmount && (
                <p className="text-xs text-loss">{errors.stakeAmount.message}</p>
              )}
            </div>

            {/* Potential return preview */}
            {stakeAmount > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-canvas rounded-lg border border-border space-y-2"
              >
                <div className="flex items-center gap-1.5 text-xs text-text-muted mb-2">
                  <Info className="w-3.5 h-3.5" />
                  Reward estimate (if outcome hits)
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Stake</span>
                  <span className="font-medium">${stakeAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Potential return</span>
                  <span className="font-medium text-win">${potentialReturn.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-border pt-2">
                  <span className="text-text-muted">Net profit</span>
                  <span className="font-semibold text-win">+${profit.toFixed(2)}</span>
                </div>
                <p className="text-xs text-text-muted">
                  Late entry penalty may apply. Final return determined at settlement.
                </p>
              </motion.div>
            )}

            {error && (
              <div className="p-3 bg-loss/10 border border-loss/20 rounded-lg">
                <p className="text-xs text-loss">{error}</p>
              </div>
            )}
          </div>
        )}

        {!success && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleSubmit(onSubmit)()}
              loading={submitting}
              className={cn(
                isSupport
                  ? 'bg-win hover:bg-win/90 text-white'
                  : 'bg-loss hover:bg-loss/90 text-white'
              )}
            >
              {isSupport ? '↑ Post & Support' : '↓ Post & Challenge'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
