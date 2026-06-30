// ─── TxLINE ──────────────────────────────────────────────────────────────────

export const TXLINE_API_BASE = process.env.TXLINE_API_BASE ?? 'https://txline.txodds.com';

// Mainnet TxLINE Solana program
export const TXLINE_PROGRAM_ID = '9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA';
export const TXLINE_MINT = 'Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL';
export const TXLINE_USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

// World Cup free tier service levels
export const TXLINE_SERVICE_LEVEL_REALTIME = 12;  // real-time, free
export const TXLINE_SERVICE_LEVEL_60S = 1;         // 60-second delay, free

// ─── Soccer Stat Keys ────────────────────────────────────────────────────────
// Full game stat keys (no period prefix)
export const STAT_KEYS = {
  P1_GOALS: 1,
  P2_GOALS: 2,
  P1_YELLOW_CARDS: 3,
  P2_YELLOW_CARDS: 4,
  P1_RED_CARDS: 5,
  P2_RED_CARDS: 6,
  P1_CORNERS: 7,
  P2_CORNERS: 8,
} as const;

// Period multipliers — (period * 1000) + base_key
export const PERIOD_MULTIPLIERS = {
  FULL: 0,
  H1: 1000,
  H2: 2000,
  ET1: 3000,
  ET2: 4000,
  PE: 5000,
} as const;

// ─── Market Outcome Definitions ──────────────────────────────────────────────

export const MARKET_DEFINITIONS = {
  MATCH_WINNER: {
    home: { label: '{home} Win', value: 'home', statKey: STAT_KEYS.P1_GOALS },
    away: { label: '{away} Win', value: 'away', statKey: STAT_KEYS.P2_GOALS },
  },
  DRAW: {
    draw: { label: 'Draw', value: 'draw' },
  },
  OVER_2_5: {
    over: { label: 'Over 2.5 Goals', value: 'over' },
    under: { label: 'Under 2.5 Goals', value: 'under' },
  },
  BTTS: {
    yes: { label: 'Both Teams Score', value: 'yes' },
    no: { label: 'One Side Blank', value: 'no' },
  },
} as const;

// ─── Solana / App ─────────────────────────────────────────────────────────────

export const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC ?? 'https://api.devnet.solana.com';
export const CALLR_PROGRAM_ID = process.env.CALLR_PROGRAM_ID ?? '';

// USDC devnet mint (Circle's official devnet USDC)
export const USDC_MINT_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
export const USDC_DECIMALS = 6;
export const USDC_LAMPORTS = 1_000_000; // 1 USDC = 1,000,000 lamports

// Minimum stake: 0.5 USDC
export const MIN_STAKE_USDC = 0.5;
export const MIN_STAKE_LAMPORTS = MIN_STAKE_USDC * USDC_LAMPORTS;

// ─── Odds / Reward Calculation ────────────────────────────────────────────────

// Maximum late-entry reward penalty (30% for 90th minute)
export const LATE_ENTRY_MAX_PENALTY = 0.3;

// Blend ratio: 70% TxLINE odds, 30% internal liquidity
export const ODDS_BLEND_TXLINE = 0.7;
export const ODDS_BLEND_INTERNAL = 0.3;

// ─── Socket.IO Rooms ─────────────────────────────────────────────────────────

export const ROOM = {
  user: (id: string) => `user:${id}`,
  match: (id: string) => `match:${id}`,
  market: (id: string) => `market:${id}`,
  post: (id: string) => `post:${id}`,
  feed: 'feed',
} as const;

// ─── Game Status Helpers ──────────────────────────────────────────────────────

export const LIVE_STATUSES = new Set(['H1', 'H2', 'HT', 'ET1', 'ET2', 'WET', 'WPE', 'PE']);
export const FINISHED_STATUSES = new Set(['F', 'FET', 'FPE']);
export const UPCOMING_STATUSES = new Set(['NS']);

export function isLive(status: string): boolean {
  return LIVE_STATUSES.has(status);
}

export function isFinished(status: string): boolean {
  return FINISHED_STATUSES.has(status);
}

export function isUpcoming(status: string): boolean {
  return UPCOMING_STATUSES.has(status);
}

// ─── SuperOddsType → MarketType mapping ──────────────────────────────────────
// Maps TxLINE's SuperOddsType strings to our internal market types
export const ODDS_TYPE_MAP: Record<string, string> = {
  'FT Match Result': 'MATCH_WINNER',
  'FT Goals Over/Under': 'OVER_2_5',
  'Both Teams To Score': 'BTTS',
  'Correct Score': 'EXACT_SCORE',
};
