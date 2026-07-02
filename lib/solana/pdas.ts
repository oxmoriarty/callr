import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { CALLR_PROGRAM_ID, USDC_MINT_DEVNET } from '@/lib/constants';

const programId = () => new PublicKey(CALLR_PROGRAM_ID);

/**
 * Deterministically derive a numeric on-chain market_id (u64) from our
 * Postgres Market.id (a cuid string). We hash it down to a u64 so the
 * on-chain PDA seed stays fixed-size, while keeping a 1:1 mapping back
 * to the off-chain record.
 */
export function marketIdToU64(marketCuid: string): bigint {
  // FNV-1a 64-bit hash — deterministic, fast, good distribution for short strings
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;

  for (let i = 0; i < marketCuid.length; i++) {
    hash ^= BigInt(marketCuid.charCodeAt(i));
    hash = (hash * prime) & mask;
  }

  return hash;
}

function u64ToLeBytes(value: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(value);
  return buf;
}

export function deriveMarketEscrowPda(marketId: bigint): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('market_escrow'), u64ToLeBytes(marketId)],
    programId()
  );
}

export function deriveVaultPda(marketEscrowPda: PublicKey, mint = USDC_MINT_DEVNET): PublicKey {
  return getAssociatedTokenAddressSync(new PublicKey(mint), marketEscrowPda, true);
}

export function derivePositionPda(
  marketEscrowPda: PublicKey,
  owner: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('position'), marketEscrowPda.toBuffer(), owner.toBuffer()],
    programId()
  );
}

/**
 * TxLINE's daily_scores_roots PDA — required as a readonly account in the
 * settle_market CPI. Derivation matches TxLINE's published seed scheme
 * (TxODDS documentation > Program Addresses).
 */
export function deriveTxlineDailyScoresRootsPda(
  epochDay: number,
  txlineProgramId: string
): PublicKey {
  const epochDayBuf = Buffer.alloc(2);
  epochDayBuf.writeUInt16LE(epochDay);

  return PublicKey.findProgramAddressSync(
    [Buffer.from('daily_scores_roots'), epochDayBuf],
    new PublicKey(txlineProgramId)
  )[0];
}
