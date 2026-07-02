use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::CallrError;
use crate::state::{MarketEscrow, MarketStatus, Position, Side};

const MIN_STAKE_LAMPORTS: u64 = 500_000; // 0.5 USDC at 6 decimals

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub staker: Signer<'info>,

    #[account(
        mut,
        seeds = [MarketEscrow::SEED_PREFIX, market_escrow.market_id.to_le_bytes().as_ref()],
        bump = market_escrow.bump,
    )]
    pub market_escrow: Account<'info, MarketEscrow>,

    #[account(
        init_if_needed,
        payer = staker,
        space = Position::SIZE,
        seeds = [Position::SEED_PREFIX, market_escrow.key().as_ref(), staker.key().as_ref()],
        bump
    )]
    pub position: Account<'info, Position>,

    #[account(
        mut,
        constraint = staker_token_account.mint == market_escrow.token_mint,
        constraint = staker_token_account.owner == staker.key(),
    )]
    pub staker_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = vault.mint == market_escrow.token_mint,
        constraint = vault.owner == market_escrow.key(),
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Stake>, side: Side, amount: u64) -> Result<()> {
    require!(amount > 0, CallrError::ZeroStake);
    require!(amount >= MIN_STAKE_LAMPORTS, CallrError::StakeTooSmall);
    require!(side != Side::None, CallrError::ZeroStake);

    let market = &mut ctx.accounts.market_escrow;
    require!(market.status == MarketStatus::Open, CallrError::MarketNotOpen);

    let position = &mut ctx.accounts.position;
    let is_new_position = position.owner == Pubkey::default();

    if is_new_position {
        position.owner = ctx.accounts.staker.key();
        position.market = market.key();
        position.side = side;
        position.stake = 0;
        position.entry_odds = current_implied_odds(market, side);
        position.is_claimed = false;
        position.bump = ctx.bumps.position;
    } else {
        require!(position.owner == ctx.accounts.staker.key(), CallrError::NotPositionOwner);
        require!(position.side == side, CallrError::OppositeSideExists);

        // Stake-weighted average of entry odds so topping up after odds move
        // doesn't let a user retroactively improve their original entry price.
        let new_odds = current_implied_odds(market, side);
        let old_weight = position.stake as u128;
        let new_weight = amount as u128;
        let total_weight = old_weight
            .checked_add(new_weight)
            .ok_or(CallrError::Overflow)?;

        let weighted = (position.entry_odds as u128)
            .checked_mul(old_weight)
            .ok_or(CallrError::Overflow)?
            .checked_add(
                (new_odds as u128)
                    .checked_mul(new_weight)
                    .ok_or(CallrError::Overflow)?,
            )
            .ok_or(CallrError::Overflow)?
            .checked_div(total_weight)
            .ok_or(CallrError::Overflow)?;

        position.entry_odds = weighted as u32;
    }

    position.stake = position
        .stake
        .checked_add(amount)
        .ok_or(CallrError::Overflow)?;
    position.updated_at = Clock::get()?.unix_timestamp;

    // Transfer stake into the market vault
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.staker_token_account.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.staker.to_account_info(),
            },
        ),
        amount,
    )?;

    // Update pool totals
    match side {
        Side::Support => {
            market.support_pool = market
                .support_pool
                .checked_add(amount)
                .ok_or(CallrError::Overflow)?;
        }
        Side::Challenge => {
            market.challenge_pool = market
                .challenge_pool
                .checked_add(amount)
                .ok_or(CallrError::Overflow)?;
        }
        Side::None => unreachable!(),
    }

    msg!(
        "Stake: {} lamports on {:?} side, position total now {}",
        amount,
        side,
        position.stake
    );

    Ok(())
}

/// Implied probability (×1000) for the given side based on current pool ratio.
/// Falls back to 500 (even odds) when pools are empty.
fn current_implied_odds(market: &MarketEscrow, side: Side) -> u32 {
    let total = market.support_pool as u128 + market.challenge_pool as u128;
    if total == 0 {
        return 500;
    }

    let side_pool = match side {
        Side::Support => market.support_pool as u128,
        Side::Challenge => market.challenge_pool as u128,
        Side::None => 0,
    };

    ((side_pool * 1000) / total) as u32
}
