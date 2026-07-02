import type { TxLineStatValidation, ProofNode as TxLineProofNode } from '@/types';
import type { ValidateStatArgs, ProofNode, StatTerm } from './settlement-types';

/**
 * Base64/array hash fields from the TxLINE HTTP API arrive as either
 * base64 strings or byte arrays depending on the client; we normalize to
 * a plain number[] of length 32 for Borsh serialization.
 */
function normalizeHash(hash: unknown): number[] {
  if (Array.isArray(hash)) return hash as number[];
  if (typeof hash === 'string') {
    const buf = Buffer.from(hash, 'base64');
    return Array.from(buf);
  }
  throw new Error('Unrecognized hash format from TxLINE proof response');
}

function mapProofNodes(nodes: TxLineProofNode[]): ProofNode[] {
  return nodes.map((n) => ({
    hash: normalizeHash(n.hash),
    isRightSibling: n.isRightSibling,
  }));
}

/**
 * Builds the exact ValidateStatArgs payload our settle_market instruction
 * expects, from a single-stat /api/scores/stat-validation response
 * (see lib/txline/client.ts > fetchStatValidation).
 *
 * The predicate is set to "greater than -1" (i.e. accept any non-negative
 * value) since Callr only relies on TxLINE's CPI to prove the *authenticity*
 * of the stat value — the actual win/lose logic is computed off-chain in
 * lib/settlement/settle.ts and cross-checked on-chain in settle_market.rs
 * against the home_score/away_score the settler supplies.
 */
export function buildValidateStatArgs(
  validation: TxLineStatValidation,
  includeSecondStat = false
): ValidateStatArgs {
  const statA: StatTerm = {
    statToProve: {
      key: validation.statToProve.key,
      value: validation.statToProve.value,
      period: validation.statToProve.period,
    },
    eventStatRoot: normalizeHash(validation.eventStatRoot),
    statProof: mapProofNodes(validation.statProof),
  };

  let statB: StatTerm | null = null;
  if (includeSecondStat && validation.statToProve2 && validation.statProof2) {
    statB = {
      statToProve: {
        key: validation.statToProve2.key,
        value: validation.statToProve2.value,
        period: validation.statToProve2.period,
      },
      eventStatRoot: normalizeHash(validation.eventStatRoot),
      statProof: mapProofNodes(validation.statProof2),
    };
  }

  return {
    ts: validation.ts,
    fixtureSummary: {
      fixtureId: validation.summary.fixtureId,
      updateStats: {
        updateCount: validation.summary.updateStats.updateCount,
        minTimestamp: validation.summary.updateStats.minTimestamp,
        maxTimestamp: validation.summary.updateStats.maxTimestamp,
      },
      eventsSubTreeRoot: normalizeHash(validation.summary.eventStatsSubTreeRoot),
    },
    fixtureProof: mapProofNodes(validation.subTreeProof),
    mainTreeProof: mapProofNodes(validation.mainTreeProof),
    predicate: {
      threshold: -1,
      comparison: { greaterThan: {} },
    },
    statA,
    statB,
    op: statB ? { add: {} } : null,
  };
}
