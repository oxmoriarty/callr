/**
 * TypeScript mirrors of the on-chain types used in settle_market's CPI
 * into TxLINE's validate_stat. Field order and names must match
 * programs/callr/src/instructions/settle_market.rs exactly, since Anchor
 * serializes struct fields positionally via Borsh.
 */

export interface ProofNode {
  hash: number[]; // 32 bytes
  isRightSibling: boolean;
}

export interface ScoreStat {
  key: number;
  value: number;
  period: number;
}

export interface ScoresUpdateStats {
  updateCount: number;
  minTimestamp: number; // i64 — pass as number or BN depending on caller
  maxTimestamp: number;
}

export interface ScoresBatchSummary {
  fixtureId: number;
  updateStats: ScoresUpdateStats;
  eventsSubTreeRoot: number[]; // 32 bytes
}

export interface StatTerm {
  statToProve: ScoreStat;
  eventStatRoot: number[]; // 32 bytes
  statProof: ProofNode[];
}

export type Comparison = { greaterThan: object } | { lessThan: object } | { equalTo: object };
export type BinaryExpression = { add: object } | { subtract: object };

export interface TraderPredicate {
  threshold: number;
  comparison: Comparison;
}

export interface ValidateStatArgs {
  ts: number;
  fixtureSummary: ScoresBatchSummary;
  fixtureProof: ProofNode[];
  mainTreeProof: ProofNode[];
  predicate: TraderPredicate;
  statA: StatTerm;
  statB: StatTerm | null;
  op: BinaryExpression | null;
}
