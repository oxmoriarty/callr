'use client';

import { useState, useEffect } from 'react';
import type { GameStatus } from '@/types';
import { isLive as checkLive } from '@/lib/constants';

interface LiveClockProps {
  serverMinute: number | undefined;
  status: GameStatus;
}

export function LiveClock({ serverMinute, status }: LiveClockProps) {
  const live = checkLive(status);
  // Count of interval ticks since mount — resets when component remounts
  // (which happens on every socket update when serverMinute changes)
  const [ticks, setTicks] = useState(0);

  useEffect(() => {
    if (!live) return;
    const interval = setInterval(() => {
      setTicks((t) => t + 1);
    }, 60_000);
    return () => {
      clearInterval(interval);
      setTicks(0);
    };
  }, [live, serverMinute]); // re-mount effect when serverMinute changes → resets ticks to 0

  if (!live || serverMinute == null) return null;
  const cap = status === 'H1' ? 45 : status === 'H2' ? 90 : 120;
  const display = Math.min(serverMinute + ticks, cap);

  return (
    <span className="text-xs font-bold text-live tabular-nums font-mono">
      {display}&apos;
    </span>
  );
}
