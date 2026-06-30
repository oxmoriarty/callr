'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWallets } from '@privy-io/react-auth';
import { Wallet as WalletIcon, AlertTriangle, ExternalLink, Copy, Check } from 'lucide-react';
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

function BalanceCard({ label, value, sublabel, accent }: { label: string; value: string; sublabel?: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-text-muted uppercase tracking-label">{label}</p>
        <p className={cn('text-2xl font-bold mt-1', accent && 'text-accent')}>{value}</p>
        {sublabel && <p className="text-xs text-text-muted mt-1">{sublabel}</p>}
      </CardContent>
    </Card>
  );
}

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
    <div className="px-4 py-4 max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">Wallet</h1>

      {/* Address */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <WalletIcon className="w-4 h-4 text-text-muted shrink-0" />
            <span className="text-sm font-mono text-text-muted truncate">
              {address ? `${address.slice(0, 6)}...${address.slice(-6)}` : 'No wallet connected'}
            </span>
          </div>
          {address && (
            <Button variant="ghost" size="icon-sm" onClick={handleCopy}>
              {copied ? <Check className="w-3.5 h-3.5 text-win" /> : <Copy className="w-3.5 h-3.5" />}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* SOL warning */}
      {lowSol && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-start gap-3 p-4 bg-pending/10 border border-pending/20 rounded-xl"
        >
          <AlertTriangle className="w-4 h-4 text-pending shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-pending">Low SOL balance</p>
            <p className="text-xs text-text-muted mt-0.5">
              You need SOL to pay transaction fees. Get free Devnet SOL below.
            </p>
            <a
              href="https://faucet.solana.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-accent font-medium mt-2 hover:underline"
            >
              Devnet faucet <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </motion.div>
      )}

      {/* Balances */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <BalanceCard
            label="Available"
            value={`$${(walletData?.usdcAvailable ?? 0).toFixed(2)}`}
            sublabel="USDC"
          />
          <BalanceCard
            label="Locked"
            value={`$${(walletData?.usdcLocked ?? 0).toFixed(2)}`}
            sublabel="In open positions"
          />
          <BalanceCard
            label="Claimable"
            value={`$${(walletData?.claimableRewards ?? 0).toFixed(2)}`}
            sublabel="Rewards to claim"
            accent
          />
          <BalanceCard
            label="SOL Balance"
            value={(walletData?.solBalance ?? 0).toFixed(3)}
            sublabel="For gas fees"
          />
        </div>
      )}

      {/* Open positions */}
      <div>
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-label mb-3">
          Open Positions
        </h2>
        {walletData?.positions.length ? (
          <div className="space-y-2">
            {walletData.positions.map((pos) => (
              <Card key={pos.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{pos.marketLabel}</p>
                    <p className="text-xs text-text-muted">{pos.fixtureLabel}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={pos.status === 'WON' ? 'win' : pos.status === 'LOST' ? 'loss' : 'secondary'}>
                      {pos.status}
                    </Badge>
                    <p className="text-sm font-semibold mt-1">${pos.stakeAmount.toFixed(2)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-sm text-text-muted">No open positions</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
