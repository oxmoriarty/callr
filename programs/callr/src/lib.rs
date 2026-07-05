use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;
use state::Side;

declare_id!("J2N4rB7rEgwF9gKCkqb7NaEqnecVG7gLYUkQUcNFSHbp");

/// Callr — on-chain escrow and trust-minimized settlement for social
/// prediction markets. Each market is a shared liquidity pool (support vs.
/// challenge) backed by a USDC vault; settlement is verified on-chain by
/// CPI-ing into TxLINE's `validate_stat` instruction against TxLINE's
/// published Merkle roots, rather than trusting Callr's backend outcome
/// directly.
#[program]
pub mod callr {
    use super::*;

    /// Creates the escrow + vault for a new canonical market.
    /// Called by the backend immediately after a market row is created
    /// in Postgres (see jobs/generate-markets.ts).
    pub fn initialize_market(
        ctx: Context<InitializeMarket>,
        market_id: u64,
        txline_fixture_id: i64,
        stat_key_a: u32,
        stat_key_b: Option<u32>,
        kickoff_ts: i64,
    ) -> Result<()> {
        instructions::initialize_market::handler(
            ctx,
            market_id,
            txline_fixture_id,
            stat_key_a,
            stat_key_b,
            kickoff_ts,
        )
    }

    /// Stakes USDC supporting or challenging a market's outcome.
    /// Creates a Position on first call; tops up (stake-weighted odds
    /// averaging) on repeat calls from the same user on the same side.
    pub fn stake(ctx: Context<Stake>, side: Side, amount: u64) -> Result<()> {
        instructions::stake::handler(ctx, side, amount)
    }

    /// Transitions a market to Locked at kickoff (late-entry flag).
    pub fn lock_market(ctx: Context<LockMarket>) -> Result<()> {
        instructions::lock_market::handler(ctx)
    }

    /// Settles a market by verifying the final score against TxLINE's
    /// on-chain Merkle roots via CPI, then deriving the winning side.
    pub fn settle_market(
        ctx: Context<SettleMarket>,
        proof_args: ValidateStatArgs,
        home_score: i32,
        away_score: i32,
    ) -> Result<()> {
        instructions::settle_market::handler(ctx, proof_args, home_score, away_score)
    }

    /// Voids a market (abandoned/cancelled/postponed fixture) — all
    /// positions become refund-eligible for their original stake.
    pub fn void_market(ctx: Context<VoidMarket>) -> Result<()> {
        instructions::void_market::handler(ctx)
    }

    /// Claims a settled or voided position's payout from the vault.
    /// Payout is pari-mutuel (proportional to stake and pool sizes),
    /// never an equal split.
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        instructions::claim::handler(ctx)
    }
}
