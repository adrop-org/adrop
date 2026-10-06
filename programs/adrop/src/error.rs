use anchor_lang::prelude::*;

#[error_code]
pub enum AdropError {
    #[msg("SGT token account is not owned by the signer")]
    SgtNotOwned,
    #[msg("SGT token account holds no token")]
    SgtZeroBalance,
    #[msg("SGT mint is not a Token-2022 mint")]
    SgtWrongTokenProgram,
    #[msg("SGT mint lacks the MetadataPointer or TokenGroupMember extension")]
    SgtMissingExtension,
    #[msg("SGT mint metadata pointer does not point at the SGT group")]
    SgtWrongMetadataPointer,
    #[msg("SGT mint is not a member of the SGT group")]
    SgtWrongGroup,
    #[msg("Proof nullifier does not match the SGT mint")]
    BadNullifier,
    #[msg("Price per view must be positive")]
    ZeroPrice,
    #[msg("Campaign is not in the expected status")]
    WrongCampaignStatus,
    #[msg("Escrow holds less than one view's price")]
    EscrowUnderfunded,
    #[msg("Merkle proof does not prove segment membership")]
    BadMerkleProof,
    #[msg("Identity reached the global daily cap")]
    GlobalCapExceeded,
    #[msg("Signer is not the configured attester")]
    NotAttester,
    #[msg("Fee payer must differ from the attester")]
    FeePayerIsAttester,
    #[msg("Identity is not owned by the viewer")]
    IdentityNotOwned,
    #[msg("Token account has the wrong mint")]
    WrongMint,
    #[msg("Signer is neither the advertiser nor the admin")]
    Unauthorized,
}
