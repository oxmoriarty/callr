use anchor_lang::prelude::*;
use crate::state::market_escrow::Side;

/// One Position per (user, market). Created on first stake; subsequent stakes
/// on the same side top it up. A user cannot hold both sides of the same market
/// (enforced in the stake instruction) — mirrors the "one canonical market,
/// one position per user" rule from the product spec.
#[account]
pub struct Position {
    pub owner: Pubkey,
    pub market: Pubkey,

    pub side: Side,

    /// Total staked by this user on this market (lamports of token_mint)
    pub stake: u64,

    /// Implied probability at first entry (probability * 1000), used for
    /// payout calculation. Topping up uses a stake-weighted average so a
    /// single position can't be gamed by re-entering after odds move.
    pub entry_odds: u32,

    /// Whether the reward (or refund, if market voided) has been claimed
    pub is_claimed: bool,

    /// Bump for this PDA
    pub bump: u8,

    /// Timestamp of last stake update
    pub updated_at: i64,
}

impl Position {
    pub const SEED_PREFIX: &'static [u8] = b"position";

    pub const SIZE: usize = 8  // discriminator
        + 32    // owner
        + 32    // market
        + 1     // side
        + 8     // stake
        + 4     // entry_odds
        + 1     // is_claimed
        + 1     // bump
        + 8;    // updated_at
}
