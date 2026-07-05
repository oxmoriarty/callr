use anchor_lang::prelude::*;

/// One MarketEscrow per canonical Callr market (fixture + market type + outcome).
/// Owns the SPL token vault holding all USDC staked on this market, on both sides.
#[account]
pub struct MarketEscrow {
    /// Off-chain market identifier (matches Postgres `Market.id` hash, see derive_market_id)
    pub market_id: u64,

    /// Authority allowed to call settle_market (the backend settlement signer).
    /// Settlement itself is still verified against TxLINE's on-chain Merkle root —
    /// this authority can only *trigger* settlement, not choose the outcome.
    pub settlement_authority: Pubkey,

    /// Token mint accepted by this market (USDC)
    pub token_mint: Pubkey,

    /// Bump for the vault's associated token account authority
    //remove pub vault_bump: u8,

    /// Bump for this account itself
    pub bump: u8,

    /// Total lamports staked supporting the outcome
    pub support_pool: u64,

    /// Total lamports staked challenging the outcome
    pub challenge_pool: u64,

    /// Unix timestamp after which new positions are considered "late entry"
    /// (kickoff time, used for off-chain reward shaping; not enforced on-chain)
    pub kickoff_ts: i64,

    /// Market lifecycle state
    pub status: MarketStatus,

    /// Winning side once settled (meaningless while status != Settled)
    pub winner_side: Side,

    /// TxLINE fixture ID this market resolves against
    pub txline_fixture_id: i64,

    /// Stat key used for settlement (see TxLINE STAT_KEYS, e.g. 1 = P1 goals)
    pub stat_key_a: u32,

    /// Optional second stat key for two-stat predicates (e.g. goal difference)
    pub stat_key_b: Option<u32>,

    /// Timestamp of settlement (0 if unsettled)
    pub settled_at: i64,
}

impl MarketEscrow {
    pub const SEED_PREFIX: &'static [u8] = b"market_escrow";

    pub const SIZE: usize = 8  // discriminator
        + 8     // market_id
        + 32    // settlement_authority
        + 32    // token_mint
        //remove + 1     // vault_bump
        + 1     // bump
        + 8     // support_pool
        + 8     // challenge_pool
        + 8     // kickoff_ts
        + 1     // status
        + 1     // winner_side
        + 8     // txline_fixture_id
        + 4     // stat_key_a
        + 1 + 4 // stat_key_b (Option<u32>)
        + 8;    // settled_at
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum MarketStatus {
    Open,
    Locked,
    Settled,
    Void,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum Side {
    #[default]
    None,
    Support,
    Challenge,
}
