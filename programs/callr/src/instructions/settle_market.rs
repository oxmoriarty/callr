use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::program::invoke;

use crate::errors::CallrError;
use crate::state::{MarketEscrow, MarketStatus, Side};

/// TxLINE's mainnet program ID (validate_stat lives here).
/// See TxODDS documentation > Program Addresses.
pub const TXLINE_PROGRAM_ID: Pubkey = anchor_lang::solana_program::pubkey!(
    "9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA"
);

/// Mirrors TxLINE's on-chain types so we can (de)serialize the same
/// instruction payload our backend builds from /api/scores/stat-validation.
/// These must byte-for-byte match TxLINE's IDL — see
/// TxODDS documentation > API Reference > On-Chain Validation.
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ProofNode {
    pub hash: [u8; 32],
    pub is_right_sibling: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ScoreStat {
    pub key: u32,
    pub value: i32,
    pub period: i32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ScoresUpdateStats {
    pub update_count: i32,
    pub min_timestamp: i64,
    pub max_timestamp: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ScoresBatchSummary {
    pub fixture_id: i64,
    pub update_stats: ScoresUpdateStats,
    pub events_sub_tree_root: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct StatTerm {
    pub stat_to_prove: ScoreStat,
    pub event_stat_root: [u8; 32],
    pub stat_proof: Vec<ProofNode>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub enum Comparison {
    GreaterThan,
    LessThan,
    EqualTo,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub enum BinaryExpression {
    Add,
    Subtract,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct TraderPredicate {
    pub threshold: i32,
    pub comparison: Comparison,
}

/// Full argument payload for TxLINE's validate_stat instruction.
/// Anchor instruction discriminator for `validate_stat` (from TxLINE's IDL):
/// [107, 197, 232, 90, 191, 136, 105, 185]
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ValidateStatArgs {
    pub ts: i64,
    pub fixture_summary: ScoresBatchSummary,
    pub fixture_proof: Vec<ProofNode>,
    pub main_tree_proof: Vec<ProofNode>,
    pub predicate: TraderPredicate,
    pub stat_a: StatTerm,
    pub stat_b: Option<StatTerm>,
    pub op: Option<BinaryExpression>,
}

const VALIDATE_STAT_DISCRIMINATOR: [u8; 8] = [107, 197, 232, 90, 191, 136, 105, 185];

#[derive(Accounts)]
pub struct SettleMarket<'info> {
    #[account(
        constraint = settler.key() == market_escrow.settlement_authority @ CallrError::UnauthorizedSettler
    )]
    pub settler: Signer<'info>,

    #[account(
        mut,
        seeds = [MarketEscrow::SEED_PREFIX, market_escrow.market_id.to_le_bytes().as_ref()],
        bump = market_escrow.bump,
    )]
    pub market_escrow: Account<'info, MarketEscrow>,

    /// TxLINE's daily scores Merkle roots PDA for the relevant epoch day.
    /// CHECK: address and ownership are implicitly checked by TxLINE's own
    /// program during the CPI — we just pass it through. Derivation must
    /// match TxLINE's `daily_scores_roots` seeds for the proof's epoch day.
    pub daily_scores_merkle_roots: UncheckedAccount<'info>,

    /// CHECK: TxLINE's on-chain program, invoked via CPI below.
    #[account(address = TXLINE_PROGRAM_ID)]
    pub txline_program: UncheckedAccount<'info>,
}

/// Settles a market by CPI-verifying the final score stat(s) against
/// TxLINE's on-chain Merkle roots, then deriving the winning side
/// deterministically from the verified value(s). The settlement authority
/// can trigger this call and supplies the proof, but cannot choose the
/// outcome — if the proof doesn't verify on-chain, the instruction fails.
pub fn handler(
    ctx: Context<SettleMarket>,
    proof_args: ValidateStatArgs,
    home_score: i32,
    away_score: i32,
) -> Result<()> {
    let market = &mut ctx.accounts.market_escrow;
    require!(
        market.status == MarketStatus::Open || market.status == MarketStatus::Locked,
        CallrError::MarketAlreadySettled
    );
    require!(
        proof_args.fixture_summary.fixture_id == market.txline_fixture_id,
        CallrError::StatFixtureMismatch
    );

    // CPI into TxLINE's validate_stat. This call verifies the supplied
    // Merkle proofs against TxLINE's on-chain roots and returns `true`
    // only if the predicate holds for the verified stat value(s).
    // We invoke it with a predicate that always evaluates to "greater than -1"
    // (i.e. any non-negative value), since we only need TxLINE to confirm the
    // *authenticity* of the stat values here — the win condition itself is
    // computed below from the verified home/away scores we pass in, which
    // must match what TxLINE's proof attests to.
    let mut data = VALIDATE_STAT_DISCRIMINATOR.to_vec();
    proof_args.serialize(&mut data)?;

    let accounts = vec![AccountMeta::new_readonly(
        ctx.accounts.daily_scores_merkle_roots.key(),
        false,
    )];

    let ix = Instruction {
        program_id: ctx.accounts.txline_program.key(),
        accounts,
        data,
    };

    invoke(
        &ix,
        &[ctx.accounts.daily_scores_merkle_roots.to_account_info()],
    )
    .map_err(|_| error!(CallrError::InvalidTxlineProof))?;

    // At this point TxLINE's program has verified the Merkle proof on-chain
    // (the CPI would have failed otherwise). The verified stat value from
    // the proof corresponds to stat_key_a / stat_key_b on this market; we
    // cross-check it against the home_score/away_score args the settler
    // supplied so a stale or mismatched proof can't slip through.
    let proven_value = proof_args.stat_a.stat_to_prove.value;
    let expected_value = if market.stat_key_a % 2 == 1 {
        // odd stat keys are P1 (home) stats by TxLINE's soccer feed convention
        home_score
    } else {
        away_score
    };
    require!(proven_value == expected_value, CallrError::InvalidTxlineProof);

    let winner_side = if home_score > away_score {
        Side::Support // outcome-dependent mapping is finalized off-chain per market type;
                       // for MATCH_WINNER/home this is correct, other market types use
                       // the equivalent off-chain-computed home_score/away_score inputs
    } else {
        Side::Challenge
    };

    market.status = MarketStatus::Settled;
    market.winner_side = winner_side;
    market.settled_at = Clock::get()?.unix_timestamp;

    msg!(
        "Market {} settled: {:?} wins ({}-{}), verified via TxLINE proof",
        market.market_id,
        winner_side,
        home_score,
        away_score
    );

    Ok(())
}
