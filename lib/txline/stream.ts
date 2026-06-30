/**
 * TxLINE SSE Stream Consumer
 *
 * Connects to /api/scores/stream and /api/odds/stream
 * Emits parsed events to registered handlers
 * Auto-reconnects on disconnect
 */

import { TXLINE_API_BASE } from '@/lib/constants';
import { getStreamHeaders } from './client';
import type { TxLineScores, TxLineOdds } from '@/types';

type ScoresHandler = (data: TxLineScores) => void;
type OddsHandler = (data: TxLineOdds) => void;

interface StreamState {
  controller: AbortController | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectDelay: number;
  lastEventId: string | null;
}

const INITIAL_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 30_000;

class TxLineStreamManager {
  private scoresHandlers = new Set<ScoresHandler>();
  private oddsHandlers = new Set<OddsHandler>();

  private scoresState: StreamState = {
    controller: null,
    reconnectTimer: null,
    reconnectDelay: INITIAL_RECONNECT_MS,
    lastEventId: null,
  };

  private oddsState: StreamState = {
    controller: null,
    reconnectTimer: null,
    reconnectDelay: INITIAL_RECONNECT_MS,
    lastEventId: null,
  };

  // ─── Scores Stream ──────────────────────────────────────────────────────────

  onScores(handler: ScoresHandler): () => void {
    this.scoresHandlers.add(handler);
    if (this.scoresHandlers.size === 1) this.connectScores();
    return () => {
      this.scoresHandlers.delete(handler);
      if (this.scoresHandlers.size === 0) this.disconnectScores();
    };
  }

  private async connectScores(): Promise<void> {
    const state = this.scoresState;
    if (state.controller) return;

    try {
      const headers = await getStreamHeaders();
      const controller = new AbortController();
      state.controller = controller;

      const extraHeaders: Record<string, string> = {};
      if (state.lastEventId) extraHeaders['Last-Event-ID'] = state.lastEventId;

      const response = await fetch(`${TXLINE_API_BASE}/api/scores/stream`, {
        headers: { ...headers, ...extraHeaders },
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Scores stream failed: ${response.status}`);
      }

      state.reconnectDelay = INITIAL_RECONNECT_MS;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (controller.signal.aborted) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let eventId: string | null = null;
        let eventData = '';

        for (const line of lines) {
          if (line.startsWith('id:')) {
            eventId = line.slice(3).trim();
          } else if (line.startsWith('data:')) {
            eventData = line.slice(5).trim();
          } else if (line === '' && eventData) {
            if (eventId) state.lastEventId = eventId;
            try {
              if (eventData !== 'heartbeat') {
                const parsed = JSON.parse(eventData) as TxLineScores;
                this.scoresHandlers.forEach((h) => h(parsed));
              }
            } catch {
              // ignore parse errors
            }
            eventData = '';
            eventId = null;
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('[TxLine] Scores stream error:', err);
    } finally {
      this.scoresState.controller = null;
      this.scheduleReconnect('scores');
    }
  }

  private disconnectScores(): void {
    const state = this.scoresState;
    if (state.reconnectTimer) {
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
    }
    state.controller?.abort();
    state.controller = null;
  }

  // ─── Odds Stream ────────────────────────────────────────────────────────────

  onOdds(handler: OddsHandler): () => void {
    this.oddsHandlers.add(handler);
    if (this.oddsHandlers.size === 1) this.connectOdds();
    return () => {
      this.oddsHandlers.delete(handler);
      if (this.oddsHandlers.size === 0) this.disconnectOdds();
    };
  }

  private async connectOdds(): Promise<void> {
    const state = this.oddsState;
    if (state.controller) return;

    try {
      const headers = await getStreamHeaders();
      const controller = new AbortController();
      state.controller = controller;

      const extraHeaders: Record<string, string> = {};
      if (state.lastEventId) extraHeaders['Last-Event-ID'] = state.lastEventId;

      const response = await fetch(`${TXLINE_API_BASE}/api/odds/stream`, {
        headers: { ...headers, ...extraHeaders },
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Odds stream failed: ${response.status}`);
      }

      state.reconnectDelay = INITIAL_RECONNECT_MS;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (controller.signal.aborted) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let eventId: string | null = null;
        let eventData = '';

        for (const line of lines) {
          if (line.startsWith('id:')) {
            eventId = line.slice(3).trim();
          } else if (line.startsWith('data:')) {
            eventData = line.slice(5).trim();
          } else if (line === '' && eventData) {
            if (eventId) state.lastEventId = eventId;
            try {
              if (eventData !== 'heartbeat') {
                const parsed = JSON.parse(eventData) as TxLineOdds;
                this.oddsHandlers.forEach((h) => h(parsed));
              }
            } catch {
              // ignore parse errors
            }
            eventData = '';
            eventId = null;
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('[TxLine] Odds stream error:', err);
    } finally {
      this.oddsState.controller = null;
      this.scheduleReconnect('odds');
    }
  }

  private disconnectOdds(): void {
    const state = this.oddsState;
    if (state.reconnectTimer) {
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
    }
    state.controller?.abort();
    state.controller = null;
  }

  // ─── Reconnect ──────────────────────────────────────────────────────────────

  private scheduleReconnect(stream: 'scores' | 'odds'): void {
    const state = stream === 'scores' ? this.scoresState : this.oddsState;
    const handlers = stream === 'scores' ? this.scoresHandlers : this.oddsHandlers;

    if (handlers.size === 0) return;
    if (state.reconnectTimer) return;

    console.log(`[TxLine] Reconnecting ${stream} stream in ${state.reconnectDelay}ms`);

    state.reconnectTimer = setTimeout(() => {
      state.reconnectTimer = null;
      state.reconnectDelay = Math.min(state.reconnectDelay * 2, MAX_RECONNECT_MS);
      if (stream === 'scores') {
        void this.connectScores();
      } else {
        void this.connectOdds();
      }
    }, state.reconnectDelay);
  }
}

// Singleton — shared across the server process
export const txlineStream = new TxLineStreamManager();
