import * as anchor from '@coral-xyz/anchor';
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { SOLANA_RPC, USDC_MINT_DEVNET } from '@/lib/constants';
import { deriveMarketEscrowPda, deriveVaultPda, marketIdToU64 } from './pdas';
import type { ValidateStatArgs } from './settlement-types';

// NodeWallet is the server-safe Keypair-backed wallet adapter.
// require() used here to avoid ESM/CJS bundling issues with the browser
// Wallet re-export from @coral-xyz/anchor.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const NodeWallet: new (payer: Keypair) => anchor.Wallet = require(
  '@coral-xyz/anchor/dist/cjs/nodewallet'
).default;

// IDL is generated at `anchor build` time into target/idl/callr.json and
// target/types/callr.ts. This module assumes that build artifact exists;
// see programs/callr for the source. In a freshly cloned repo, run
// `anchor build` before importing this module from a server context.
//
// We type the program loosely here (Program<any>) to avoid a hard compile-time
// dependency on the generated IDL file inside this TypeScript project, since
// the IDL is only produced by the separate Anchor/Rust build step.
type CallrProgram = Program<anchor.Idl>;

/**
 * Loads the Callr program using a server-held keypair as the settlement
 * authority. Used by the settlement job (lib/settlement/settle.ts) and by
 * any backend-initiated instruction (initialize_market, lock_market,
 * void_market, settle_market).
 */
export function getServerProgram(settlementKeypair: Keypair): CallrProgram {
  const connection = new Connection(SOLANA_RPC, 'confirmed');
  const wallet = new NodeWallet(settlementKeypair);
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });

  // IDL is produced by `anchor build` into target/idl/callr.json.
  // A placeholder IDL is committed so the Next.js webpack build doesn't fail;
  // the real IDL is populated before deployment by running `anchor build`.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const idl = require('../../target/idl/callr.json') as anchor.Idl;
  return new Program(idl, provider) as CallrProgram;
}

export function loadSettlementKeypair(): Keypair {
  const raw = process.env.SETTLEMENT_AUTHORITY_KEYPAIR;
  if (!raw) throw new Error('SETTLEMENT_AUTHORITY_KEYPAIR not set');
  const bytes = Uint8Array.from(JSON.parse(raw) as number[]);
  return Keypair.fromSecretKey(bytes);
}

// ─── Instruction Builders ─────────────────────────────────────────────────────

interface InitializeMarketParams {
  marketCuid: string;
  txlineFixtureId: number;
  statKeyA: number;
  statKeyB: number | null;
  kickoffTs: number;
  mint?: string;
}

export async function initializeMarketOnChain(
  program: CallrProgram,
  authority: Keypair,
  params: InitializeMarketParams
): Promise<{ txSig: string; marketEscrowPda: PublicKey; marketId: bigint }> {
  const marketId = marketIdToU64(params.marketCuid);
  const [marketEscrowPda] = deriveMarketEscrowPda(marketId);
  const mint = new PublicKey(params.mint ?? USDC_MINT_DEVNET);
  const vault = deriveVaultPda(marketEscrowPda, params.mint ?? USDC_MINT_DEVNET);

  const txSig = await program.methods
    .initializeMarket(
      new BN(marketId.toString()),
      new BN(params.txlineFixtureId),
      params.statKeyA,
      params.statKeyB,
      new BN(params.kickoffTs)
    )
    .accounts({
      authority: authority.publicKey,
      marketEscrow: marketEscrowPda,
      tokenMint: mint,
      vault,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([authority])
    .rpc();

  return { txSig, marketEscrowPda, marketId };
}

export async function settleMarketOnChain(
  program: CallrProgram,
  authority: Keypair,
  marketCuid: string,
  dailyScoresMerkleRoots: PublicKey,
  txlineProgramId: PublicKey,
  proofArgs: ValidateStatArgs,
  homeScore: number,
  awayScore: number
): Promise<string> {
  const marketId = marketIdToU64(marketCuid);
  const [marketEscrowPda] = deriveMarketEscrowPda(marketId);

  return program.methods
    .settleMarket(proofArgs, homeScore, awayScore)
    .accounts({
      settler: authority.publicKey,
      marketEscrow: marketEscrowPda,
      dailyScoresMerkleRoots,
      txlineProgram: txlineProgramId,
    })
    .signers([authority])
    .rpc();
}

export async function voidMarketOnChain(
  program: CallrProgram,
  authority: Keypair,
  marketCuid: string
): Promise<string> {
  const marketId = marketIdToU64(marketCuid);
  const [marketEscrowPda] = deriveMarketEscrowPda(marketId);

  return program.methods
    .voidMarket()
    .accounts({
      settler: authority.publicKey,
      marketEscrow: marketEscrowPda,
    })
    .signers([authority])
    .rpc();
}


// Note: PDA helpers are importable directly from '@/lib/solana/pdas'

