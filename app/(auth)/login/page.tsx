'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/hooks/use-current-user';

export default function LoginPage() {
  const { login, authenticated, ready } = usePrivy();
  const { user, isLoading } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (!ready || isLoading) return;
    if (authenticated && user) {
      router.replace('/');
    } else if (authenticated && !user && !isLoading) {
      router.replace('/onboarding');
    }
  }, [ready, authenticated, user, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-canvas">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm text-center"
      >
        <div className="flex justify-center mb-8">
          <svg viewBox="0 0 160 48" width="160" height="48" aria-label="Callr">
            <circle cx="24" cy="24" r="18" fill="none" stroke="#fff" strokeWidth="2"/>
            <polygon points="24,10 32,16 29,26 19,26 16,16" fill="#1800AD"/>
            <line x1="24" y1="10" x2="16" y2="16" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="24" y1="10" x2="32" y2="16" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="16" y1="16" x2="8" y2="24" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="32" y1="16" x2="40" y2="24" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="19" y1="26" x2="14" y2="36" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="29" y1="26" x2="34" y2="36" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
            <text x="52" y="33" fontFamily="Inter,sans-serif" fontSize="26" fontWeight="700" fill="#fff">callr</text>
          </svg>
        </div>

        <h1 className="text-2xl font-bold mb-2">Predict together</h1>
        <p className="text-text-muted text-sm mb-8 leading-relaxed">
          Social prediction markets for the World Cup. Support or challenge calls
          using on-chain USDC — settled trustlessly via verified match data.
        </p>

        <Button onClick={() => login()} size="xl" className="w-full">
          Continue
        </Button>

        <p className="text-xs text-text-muted mt-6">
          Powered by TxLINE · Settled on Solana
        </p>
      </motion.div>
    </div>
  );
}
