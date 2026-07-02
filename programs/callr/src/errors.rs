use anchor_lang::prelude::*;

#[error_code]
pub enum CallrError {
    #[msg("Market is not open for staking")]
    MarketNotOpen,

    #[msg("Market has already been settled")]
    MarketAlreadySettled,

    #[msg("Market has not been settled yet")]
    MarketNotSettled,

    #[msg("Market was voided; use the void-refund claim path")]
    MarketVoided,

    #[msg("Stake amount must be greater than zero")]
    ZeroStake,

    #[msg("Stake amount is below the minimum")]
    StakeTooSmall,

    #[msg("Position already exists on the opposite side of this market")]
    OppositeSideExists,

    #[msg("Only the settlement authority may call this instruction")]
    UnauthorizedSettler,

    #[msg("Position has already been claimed")]
    AlreadyClaimed,

    #[msg("Caller does not own this position")]
    NotPositionOwner,

    #[msg("Position is on the losing side; nothing to claim")]
    LosingPosition,

    #[msg("TxLINE Merkle proof verification failed")]
    InvalidTxlineProof,

    #[msg("TxLINE stat value did not match the expected fixture")]
    StatFixtureMismatch,

    #[msg("Arithmetic overflow")]
    Overflow,

    #[msg("Vault has insufficient balance for this payout")]
    InsufficientVaultBalance,
}
