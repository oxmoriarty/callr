import {
  LATE_ENTRY_MAX_PENALTY,
  ODDS_BLEND_INTERNAL,
  ODDS_BLEND_TXLINE,
} from '@/lib/constants';

/**
 * Convert TxLINE Pct string ("52.632") to implied probability * 1000 (integer)
 * e.g. "52.632" → 526
 */
export function pctToImplied(pct: string): number {
  if (pct === 'NA') return 500; // fallback to even
  return Math.round(parseFloat(pct) * 10);
}

/**
 * Blend TxLINE implied odds with internal liquidity ratio.
 * Both are expressed as probability * 1000 (0–1000).
 */
export function blendOdds(
  txlineImplied: number,
  supportPool: bigint,
  challengePool: bigint
): number {
  const total = supportPool + challengePool;
  if (total === BigInt(0)) return txlineImplied;

  // Internal implied: supportPool / total * 1000
  const internalImplied = Number((supportPool * BigInt(1000)) / total);

  return Math.round(
    ODDS_BLEND_TXLINE * txlineImplied + ODDS_BLEND_INTERNAL * internalImplied
  );
}

/**
 * Calculate potential return for a stake given entry odds and timing.
 *
 * @param stakeUsdc - stake in whole USDC
 * @param impliedProbability - entry odds as probability * 1000
 * @param minutesElapsed - minutes into match (0 for pre-match)
 * @returns potential return in whole USDC (including stake back)
 */
export function calculatePotentialReturn(
  stakeUsdc: number,
  impliedProbability: number,
  minutesElapsed = 0
): number {
  if (impliedProbability <= 0 || impliedProbability >= 1000) return stakeUsdc;

  // Fair odds multiplier = 1 / (implied / 1000)
  const fairMultiplier = 1000 / impliedProbability;

  // Late entry penalty — linear decay up to 30% at 90 min
  const timePenalty = Math.min(minutesElapsed / 90, 1) * LATE_ENTRY_MAX_PENALTY;
  const adjustedMultiplier = fairMultiplier * (1 - timePenalty);

  return parseFloat((stakeUsdc * adjustedMultiplier).toFixed(6));
}

/**
 * Calculate potential return in USDC lamports (bigint)
 */
export function calculatePotentialReturnLamports(
  stakeLamports: bigint,
  impliedProbability: number,
  minutesElapsed = 0
): bigint {
  if (impliedProbability <= 0 || impliedProbability >= 1000) return stakeLamports;

  const fairMultiplier = 1000 / impliedProbability;
  const timePenalty = Math.min(minutesElapsed / 90, 1) * LATE_ENTRY_MAX_PENALTY;
  const adjustedMultiplier = Math.floor(fairMultiplier * (1 - timePenalty) * 10000);

  return (stakeLamports * BigInt(adjustedMultiplier)) / BigInt(10000);
}

/**
 * Format implied probability as decimal odds string
 * e.g. 333 (33.3%) → "3.00"
 */
export function impliedToDecimal(implied: number): string {
  if (implied <= 0) return '—';
  return (1000 / implied).toFixed(2);
}

/**
 * Format implied probability as percentage string
 * e.g. 526 → "52.6%"
 */
export function impliedToPct(implied: number): string {
  return `${(implied / 10).toFixed(1)}%`;
}
