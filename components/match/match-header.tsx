'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useMatchRoom, useSocketEvent } from '@/hooks/use-socket-room';
import { LiveClock } from './live-clock';
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
  const [serverMinute, setServerMinute] = useState<number | undefined>();
  const [goalFlash, setGoalFlash] = useState(false);

  useMatchRoom(fixture.id);

  useSocketEvent<ScoreUpdateEvent>('score:update', (data) => {
    if (data.fixtureId !== fixture.id) return;

    const prevHome = homeScore;
    const prevAway = awayScore;

    setHomeScore(data.homeScore);
    setAwayScore(data.awayScore);
    setStatus(data.status);
    if (data.minute != null) setServerMinute(data.minute);

    if (data.homeScore !== prevHome || data.awayScore !== prevAway) {
      setGoalFlash(true);
      setTimeout(() => setGoalFlash(false), 1500);
    }

    if (data.event) {
      setLastEvent(data.event);
      setTimeout(() => setLastEvent(undefined), 6000);
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
    <div className={cn(
      'bg-surface border rounded-xl overflow-hidden transition-colors duration-300',
      goalFlash ? 'border-win/50' : 'border-border'
    )}>
      {/* Competition + status bar */}
      <div className="bg-canvas/60 px-4 py-2.5 flex items-center justify-between">
        <span className="text-xs text-text-muted font-semibold uppercase tracking-label">
          {fixture.competition}
        </span>
        <div className="flex items-center gap-3">
          {live && (
            <>
              <LiveClock serverMinute={serverMinute} status={status} />
              <span className="flex items-center gap-1.5 text-xs font-bold text-live">
                <span className="live-dot" />
                {statusLabel}
              </span>
            </>
          )}
          {status === 'HT' && (
            <span className="text-xs font-semibold text-pending">Half Time</span>
          )}
          {finished && (
            <span className="text-xs font-semibold text-text-muted">{statusLabel}</span>
          )}
          {!kickedOff && status !== 'HT' && (
            <span className="text-xs text-text-muted">{dateString} · {timeString}</span>
          )}
        </div>
      </div>

      {/* Score */}
      <div className="px-6 py-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 text-center">
            <p className="text-xl font-bold leading-tight">{fixture.homeTeam}</p>
            <p className="text-xs text-text-muted mt-1 uppercase tracking-label">Home</p>
          </div>

          <div className="shrink-0 text-center min-w-[130px]">
            {kickedOff ? (
              <div className="flex items-center justify-center gap-3">
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={`h${homeScore}`}
                    initial={{ y: -14, opacity: 0, scale: 0.75 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                    className={cn(
                      'text-5xl font-bold tabular-nums',
                      goalFlash ? 'text-win' : 'text-text-primary'
                    )}
                  >
                    {homeScore}
                  </motion.span>
                </AnimatePresence>
                <span className="text-3xl text-border font-light select-none">–</span>
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={`a${awayScore}`}
                    initial={{ y: -14, opacity: 0, scale: 0.75 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                    className={cn(
                      'text-5xl font-bold tabular-nums',
                      goalFlash ? 'text-win' : 'text-text-primary'
                    )}
                  >
                    {awayScore}
                  </motion.span>
                </AnimatePresence>
              </div>
            ) : (
              <div>
                <p className="text-3xl font-light text-border">vs</p>
                <p className="text-sm text-text-muted mt-1">{timeString}</p>
              </div>
            )}
          </div>

          <div className="flex-1 text-center">
            <p className="text-xl font-bold leading-tight">{fixture.awayTeam}</p>
            <p className="text-xs text-text-muted mt-1 uppercase tracking-label">Away</p>
          </div>
        </div>

        {/* Goal / Event notification */}
        <AnimatePresence>
          {lastEvent && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6 }}
              className={cn(
                'mt-5 mx-auto max-w-xs text-center px-4 py-2.5 rounded-xl text-sm font-semibold',
                lastEvent.type === 'goal' && 'bg-win/15 text-win border border-win/25',
                lastEvent.type === 'red_card' && 'bg-loss/15 text-loss border border-loss/25',
                lastEvent.type === 'yellow_card' && 'bg-pending/15 text-pending border border-pending/25',
                lastEvent.type === 'corner' && 'bg-canvas text-text-muted border border-border',
              )}
            >
              {lastEvent.type === 'goal' && `⚽ GOAL — ${lastEvent.team === 'home' ? fixture.homeTeam : fixture.awayTeam}`}
              {lastEvent.type === 'red_card' && `🟥 Red card · ${lastEvent.team === 'home' ? fixture.homeTeam : fixture.awayTeam}`}
              {lastEvent.type === 'yellow_card' && `🟨 Yellow · ${lastEvent.team === 'home' ? fixture.homeTeam : fixture.awayTeam}`}
              {lastEvent.type === 'corner' && `Corner · ${lastEvent.team === 'home' ? fixture.homeTeam : fixture.awayTeam}`}
              {lastEvent.minute != null && ` (${lastEvent.minute}')`}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
