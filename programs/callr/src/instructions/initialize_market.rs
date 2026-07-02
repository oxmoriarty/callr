use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use anchor_spl::associated_token::AssociatedToken;

use crate::state::{MarketEscrow, MarketStatus, Side};

/// Creates the on-chain escrow for a canonical Callr market.
/// Called once by the backend when a market is first generated from a
/// TxLINE fixture (see jobs/generate-markets.ts on the off-chain side).
#[derive(Accounts)]
#[instruction(market_id: u64)]
pub struct InitializeMarket<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = MarketEscrow::SIZE,
        seeds = [MarketEscrow::SEED_PREFIX, market_id.to_le_bytes().as_ref()],
        bump
    )]
    pub market_escrow: Account<'info, MarketEscrow>,

    pub token_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        associated_token::mint = token_mint,
        associated_token::authority = market_escrow,
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeMarket>,
    market_id: u64,
    txline_fixture_id: i64,
    stat_key_a: u32,
    stat_key_b: Option<u32>,
    kickoff_ts: i64,
) -> Result<()> {
    let market = &mut ctx.accounts.market_escrow;

    market.market_id = market_id;
    market.settlement_authority = ctx.accounts.authority.key();
    market.token_mint = ctx.accounts.token_mint.key();
    market.vault_bump = ctx.bumps.vault.unwrap_or_default();
    market.bump = ctx.bumps.market_escrow;
    market.support_pool = 0;
    market.challenge_pool = 0;
    market.kickoff_ts = kickoff_ts;
    market.status = MarketStatus::Open;
    market.winner_side = Side::None;
    market.txline_fixture_id = txline_fixture_id;
    market.stat_key_a = stat_key_a;
    market.stat_key_b = stat_key_b;
    market.settled_at = 0;

    msg!(
        "Market {} initialized for fixture {} (stat key {})",
        market_id,
        txline_fixture_id,
        stat_key_a
    );

    Ok(())
}
