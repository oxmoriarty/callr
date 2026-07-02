use anchor_lang::prelude::*;

use crate::errors::CallrError;
use crate::state::{MarketEscrow, MarketStatus};

#[derive(Accounts)]
pub struct VoidMarket<'info> {
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

/// Voids a market when TxLINE reports the underlying fixture as abandoned,
/// cancelled, or postponed beyond resolution (game states A/C/P), or when
/// settlement data is unavailable. All positions become refund-eligible
/// via the same `claim` instruction (Void status pays back stake only).
pub fn handler(ctx: Context<VoidMarket>) -> Result<()> {
    let market = &mut ctx.accounts.market_escrow;
    require!(
        market.status == MarketStatus::Open || market.status == MarketStatus::Locked,
        CallrError::MarketAlreadySettled
    );

    market.status = MarketStatus::Void;
    market.settled_at = Clock::get()?.unix_timestamp;

    msg!("Market {} voided — positions refundable", market.market_id);

    Ok(())
}
