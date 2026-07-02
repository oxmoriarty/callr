use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::CallrError;
use crate::state::{MarketEscrow, MarketStatus, Position, Side};

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub claimer: Signer<'info>,

    #[account(
        seeds = [MarketEscrow::SEED_PREFIX, market_escrow.market_id.to_le_bytes().as_ref()],
        bump = market_escrow.bump,
    )]
    pub market_escrow: Account<'info, MarketEscrow>,

    #[account(
        mut,
        seeds = [Position::SEED_PREFIX, market_escrow.key().as_ref(), claimer.key().as_ref()],
        bump = position.bump,
        constraint = position.owner == claimer.key() @ CallrError::NotPositionOwner,
    )]
    pub position: Account<'info, Position>,

    #[account(
        mut,
        constraint = vault.mint == market_escrow.token_mint,
        constraint = vault.owner == market_escrow.key(),
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = claimer_token_account.mint == market_escrow.token_mint,
        constraint = claimer_token_account.owner == claimer.key(),
    )]
    pub claimer_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

/// Claims a settled position's payout. Winners receive their proportional
/// share of the losing pool plus their original stake back; losers cannot
/// claim. Reward is NOT split equally — it scales with stake size and the
/// position's entry odds, consistent with the off-chain reward philosophy
/// (late entrants who staked at worse odds receive a smaller multiplier).
pub fn handler(ctx: Context<Claim>) -> Result<()> {
    let market = &ctx.accounts.market_escrow;
    let position = &mut ctx.accounts.position;

    require!(!position.is_claimed, CallrError::AlreadyClaimed);

    let payout: u64;

    match market.status {
        MarketStatus::Void => {
            // Void market: full refund of original stake, no profit/loss.
            payout = position.stake;
        }
        MarketStatus::Settled => {
            require!(position.side == market.winner_side, CallrError::LosingPosition);

            let (winning_pool, losing_pool) = match market.winner_side {
                Side::Support => (market.support_pool, market.challenge_pool),
                Side::Challenge => (market.challenge_pool, market.support_pool),
                Side::None => return err!(CallrError::MarketNotSettled),
            };

            // Proportional share of the losing pool, weighted by this
            // position's share of the winning pool — i.e. classic
            // pari-mutuel payout, NOT an equal split.
            //
            // payout = stake + (stake / winning_pool) * losing_pool
            payout = if winning_pool == 0 {
                position.stake
            } else {
                let share = (position.stake as u128)
                    .checked_mul(losing_pool as u128)
                    .ok_or(CallrError::Overflow)?
                    .checked_div(winning_pool as u128)
                    .ok_or(CallrError::Overflow)?;

                (position.stake as u128)
                    .checked_add(share)
                    .ok_or(CallrError::Overflow)?
                    .try_into()
                    .map_err(|_| CallrError::Overflow)?
            };
        }
        _ => return err!(CallrError::MarketNotSettled),
    }

    require!(
        ctx.accounts.vault.amount >= payout,
        CallrError::InsufficientVaultBalance
    );

    let market_id_bytes = market.market_id.to_le_bytes();
    let seeds: &[&[u8]] = &[
        MarketEscrow::SEED_PREFIX,
        market_id_bytes.as_ref(),
        &[market.bump],
    ];
    let signer_seeds: &[&[&[u8]]] = &[seeds];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.claimer_token_account.to_account_info(),
                authority: ctx.accounts.market_escrow.to_account_info(),
            },
            signer_seeds,
        ),
        payout,
    )?;

    position.is_claimed = true;
    position.updated_at = Clock::get()?.unix_timestamp;

    msg!(
        "Claimed {} lamports for position on market {}",
        payout,
        market.market_id
    );

    Ok(())
}
