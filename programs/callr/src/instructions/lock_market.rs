use anchor_lang::prelude::*;

use crate::errors::CallrError;
use crate::state::{MarketEscrow, MarketStatus};

#[derive(Accounts)]
pub struct LockMarket<'info> {
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
}

/// Marks a market Locked at kickoff. Staking remains possible (late entry
/// is allowed per the product spec) but the off-chain client uses this flag
/// to surface the late-entry odds penalty in the UI. Kept as an explicit
/// on-chain transition so the lifecycle is fully auditable, not just inferred
/// from `kickoff_ts`.
pub fn handler(ctx: Context<LockMarket>) -> Result<()> {
    let market = &mut ctx.accounts.market_escrow;
    require!(market.status == MarketStatus::Open, CallrError::MarketNotOpen);

    market.status = MarketStatus::Locked;

    msg!("Market {} locked at kickoff", market.market_id);

    Ok(())
}
