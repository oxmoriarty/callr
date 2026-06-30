'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useMatchRoom, useSocketEvent } from '@/hooks/use-socket-room';
import type { FixtureWithMarkets, ScoreUpdateEvent, GameStatus } from '@/types';
import { isLive as checkLive, isFinished as checkFinished } from '@/lib/constants';

interface MatchHeaderProps {
  fixture: FixtureWithMarkets;
}

const STATUS_LABELS: Partial<Record<GameStatus, string>> = {
  NS:  'Not Started',
  H1:  '1st Half',
  HT:  'Half Time',
  H2:  '2nd Half',
  WET: 'Extra Time',
  ET1: 'ET 1st Half',
  ET2: 'ET 2nd Half',
  WPE: 'Penalties',
  PE:  'Penalties',
  F:   'Full Time',
  FET: 'Full Time (AET)',
  FPE: 'Full Time (Pens)',
  I:   'Interrupted',
  P:   'Postponed',
};

export function MatchHeader({ fixture }: MatchHeaderProps) {
  const [homeScore, setHomeScore] = useState(fixture.homeScore);
  const [awayScore, setAwayScore] = useState(fixture.awayScore);
  const [status, setStatus] = useState<GameStatus>(fixture.status);
  const [lastEvent, setLastEvent] = useState<ScoreUpdateEvent['event'] | undefined>();
  const [minute, setMinute] = useState<number | undefined>();

  useMatchRoom(fixture.id);

  // Listen for live score updates
  useSocketEvent<ScoreUpdateEvent>('score:update', (data) => {
    if (data.fixtureId !== fixture.id) return;

    setHomeScore(data.homeScore);
    setAwayScore(data.awayScore);
    setStatus(data.status);
    setMinute(data.minute);

    if (data.event) {
      setLastEvent(data.event);
      setTimeout(() => setLastEvent(undefined), 5000);
    }
  });

  const live = checkLive(status);
  const finished = checkFinished(status);
  const kickedOff = live || finished;
  const statusLabel = STATUS_LABELS[status] ?? status;

  const startDate = new Date(fixture.startTime);
  const timeString = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateString = startDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      {/* Competition bar */}
      <div className="bg-canvas/60 px-4 py-2 flex items-center justify-between">
        <span className="text-xs text-text-muted font-medium uppercase tracking-label">
          {fixture.competition}
        </span>
        <div className="flex items-center gap-2">
          {live && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-live">
              <span className="live-dot" />
              LIVE
            </span>
          )}
          {finished && (
            <span className="text-xs font-medium text-text-muted">{statusLabel}</span>
          )}
          {!kickedOff && (
            <span className="text-xs text-text-muted">{dateString} · {timeString}</span>
          )}
        </div>
      </div>

      {/* Score area */}
      <div className="px-6 py-8">
        <div className="flex items-center justify-between gap-4">
          {/* Home team */}
          <div className="flex-1 text-center">
            <div className="text-2xl font-bold text-text-primary leading-tight">{fixture.homeTeam}</div>
            <div className="text-xs text-text-muted mt-1">Home</div>
          </div>

          {/* Score / time */}
          <div className="flex-shrink-0 text-center min-w-[120px]">
            {kickedOff ? (
              <div className="flex items-center justify-center gap-3">
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={homeScore}
                    initial={{ y: -8, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="text-5xl font-bold tabular-nums"
                  >
                    {homeScore}
                  </motion.span>
                </AnimatePresence>
                <span className="text-3xl text-text-muted font-light">–</span>
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={awayScore}
                    initial={{ y: -8, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="text-5xl font-bold tabular-nums"
                  >
                    {awayScore}
                  </motion.span>
                </AnimatePresence>
              </div>
            ) : (
              <div>
                <div className="text-3xl font-semibold text-text-muted">vs</div>
                <div className="text-sm text-text-muted mt-1">{timeString}</div>
              </div>
            )}

            {/* Status */}
            {live && (
              <div className="mt-2 text-xs font-medium text-live">
                {statusLabel}{minute ? ` · ${minute}'` : ''}
              </div>
            )}
            {finished && (
              <div className="mt-2 text-xs text-text-muted">{statusLabel}</div>
            )}
          </div>

          {/* Away team */}
          <div className="flex-1 text-center">
            <div className="text-2xl font-bold text-text-primary leading-tight">{fixture.awayTeam}</div>
            <div className="text-xs text-text-muted mt-1">Away</div>
          </div>
        </div>

        {/* Goal/Event notification */}
        <AnimatePresence>
          {lastEvent && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              className={cn(
                'mt-4 mx-auto max-w-xs text-center px-4 py-2 rounded-lg text-sm font-medium',
                lastEvent.type === 'goal' && 'bg-win/15 text-win border border-win/20',
                lastEvent.type === 'red_card' && 'bg-loss/15 text-loss border border-loss/20',
                lastEvent.type === 'yellow_card' && 'bg-pending/15 text-pending border border-pending/20',
                lastEvent.type === 'corner' && 'bg-surface text-text-muted border border-border',
              )}
            >
              {lastEvent.type === 'goal' && `⚽ GOAL! ${lastEvent.team === 'home' ? fixture.homeTeam : fixture.awayTeam}`}
              {lastEvent.type === 'red_card' && `🟥 Red card — ${lastEvent.team === 'home' ? fixture.homeTeam : fixture.awayTeam}`}
              {lastEvent.type === 'yellow_card' && `🟨 Yellow card — ${lastEvent.team === 'home' ? fixture.homeTeam : fixture.awayTeam}`}
              {lastEvent.type === 'corner' && `Corner — ${lastEvent.team === 'home' ? fixture.homeTeam : fixture.awayTeam}`}
              {lastEvent.minute && ` (${lastEvent.minute}')`}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
