'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWallets } from '@privy-io/react-auth';
import { Wallet as WalletIcon, AlertTriangle, ExternalLink, Copy, Check, ArrowUpRight, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import { useCurrentUser, useAuthToken } from '@/hooks/use-current-user';
import { cn } from '@/lib/utils';

interface WalletData {
  usdcAvailable: number;
  usdcLocked: number;
  claimableRewards: number;
  solBalance: number;
  positions: {
    id: string;
    marketLabel: string;
    fixtureLabel: string;
    side: string;
    stakeAmount: number;
    potentialReturn: number;
    status: string;
  }[];
  transactions: {
    id: string;
    type: string;
    amount: number;
    timestamp: string;
    txSig?: string;
  }[];
}

function StatCard({ label, value, sublabel, accent, highlight }: {
  label: string;
  value: string;
  sublabel?: string;
  accent?: boolean;
  highlight?: boolean;
}) {
  return (
    <Card className={cn(highlight && 'border-win/30 bg-win/5')}>
      <CardContent className="p-4">
        <p className="text-xs text-text-muted uppercase tracking-label mb-1">{label}</p>
        <p className={cn('text-2xl font-bold', accent ? 'text-accent' : highlight ? 'text-win' : 'text-text-primary')}>
          {value}
        </p>
        {sublabel && <p className="text-xs text-text-muted mt-0.5">{sublabel}</p>}
      </CardContent>
    </Card>
  );
}

const STATUS_BADGE: Record<string, { label: string; variant: 'win' | 'loss' | 'secondary' | 'pending' }> = {
  OPEN:    { label: 'Open',    variant: 'secondary' },
  WON:     { label: 'Won',     variant: 'win' },
  LOST:    { label: 'Lost',    variant: 'loss' },
  VOID:    { label: 'Voided', variant: 'secondary' },
  CLAIMED: { label: 'Claimed', variant: 'secondary' },
};

export default function WalletPage() {
  const { user } = useCurrentUser();
  const { wallets } = useWallets();
  const getToken = useAuthToken();
  const [copied, setCopied] = useState(false);

  const solanaWallet = wallets.find((w) => w.walletClientType === 'privy');
  const address = user?.walletAddress ?? solanaWallet?.address;

  const { data: walletData, isLoading } = useQuery<WalletData>({
    queryKey: ['wallet', user?.id],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch('/api/wallet', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to load wallet');
      return res.json() as Promise<WalletData>;
    },
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const lowSol = (walletData?.solBalance ?? 0) < 0.01;
  const hasClaimable = (walletData?.claimableRewards ?? 0) > 0;

  const handleCopy = () => {
    if (!address) return;
    void navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!user) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-text-muted">Sign in to view your wallet</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto space-y-5">
      <h1 className="text-xl font-bold">Wallet</h1>

      {/* Address card */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
              <WalletIcon className="w-4 h-4 text-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-text-muted mb-0.5">Solana Wallet</p>
              <p className="text-sm font-mono text-text-primary truncate">
                {address
                  ? `${address.slice(0, 8)}...${address.slice(-8)}`
                  : 'No wallet connected'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {address && (
              <>
                <Button variant="ghost" size="icon-sm" onClick={handleCopy}>
                  {copied
                    ? <Check className="w-3.5 h-3.5 text-win" />
                    : <Copy className="w-3.5 h-3.5" />}
                </Button>
                <a
                  href={`https://explorer.solana.com/address/${address}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="ghost" size="icon-sm">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Button>
                </a>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* SOL warning */}
      {lowSol && !isLoading && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 p-4 bg-pending/10 border border-pending/20 rounded-xl"
        >
          <AlertTriangle className="w-4 h-4 text-pending shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-pending">Low SOL balance</p>
            <p className="text-xs text-text-muted mt-0.5">
              You need SOL to pay transaction fees on Solana. Get free Devnet SOL from the faucet.
            </p>
            <a
              href="https://faucet.solana.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-accent font-semibold mt-2 hover:underline"
            >
              Get Devnet SOL <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </motion.div>
      )}

      {/* Claimable rewards banner */}
      {hasClaimable && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between p-4 bg-win/10 border border-win/20 rounded-xl"
        >
          <div className="flex items-center gap-2.5">
            <Trophy className="w-5 h-5 text-win" />
            <div>
              <p className="text-sm font-semibold text-win">Rewards ready to claim</p>
              <p className="text-xs text-text-muted mt-0.5">${(walletData?.claimableRewards ?? 0).toFixed(2)} USDC available</p>
            </div>
          </div>
          <Button size="sm" className="bg-win hover:bg-win/90 text-white shrink-0">
            Claim all
          </Button>
        </motion.div>
      )}

      {/* Balance grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Available"
            value={`$${(walletData?.usdcAvailable ?? 0).toFixed(2)}`}
            sublabel="USDC · Free to use"
          />
          <StatCard
            label="Locked"
            value={`$${(walletData?.usdcLocked ?? 0).toFixed(2)}`}
            sublabel="In active positions"
            accent
          />
          <StatCard
            label="Claimable"
            value={`$${(walletData?.claimableRewards ?? 0).toFixed(2)}`}
            sublabel="Won positions"
            highlight={hasClaimable}
          />
          <StatCard
            label="SOL"
            value={(walletData?.solBalance ?? 0).toFixed(4)}
            sublabel="For transaction fees"
          />
        </div>
      )}

      {/* Positions */}
      <div>
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-label mb-3">
          Positions
        </h2>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-16 rounded-xl" />
            ))}
          </div>
        ) : walletData?.positions.length ? (
          <div className="space-y-2">
            {walletData.positions.map((pos) => {
              const badge = STATUS_BADGE[pos.status] ?? { label: pos.status, variant: 'secondary' as const };
              return (
                <Card key={pos.id}>
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{pos.marketLabel}</p>
                      <p className="text-xs text-text-muted mt-0.5">{pos.fixtureLabel}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-bold">${pos.stakeAmount.toFixed(2)}</p>
                        {pos.status === 'OPEN' && (
                          <p className="text-xs text-win">→ ${pos.potentialReturn.toFixed(2)}</p>
                        )}
                      </div>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                      {pos.status === 'WON' && (
                        <Button size="sm" variant="support" className="text-xs">
                          Claim
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="text-3xl mb-3">📊</div>
              <p className="font-semibold text-text-primary mb-1">No positions yet</p>
              <p className="text-sm text-text-muted">
                Support or challenge predictions to build your portfolio
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
