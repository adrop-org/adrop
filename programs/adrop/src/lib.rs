use anchor_lang::prelude::*;

pub mod error;
pub mod instructions;
pub mod state;

pub use instructions::*;
pub use state::*;

declare_id!("BAj8sscSBTkfmcBUySDWBUbiYRcFkP7vH1DQ5HETNpm8");

#[program]
pub mod adrop {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        attester: Pubkey,
        sgt_group: Pubkey,
        usdc_mint: Pubkey,
        global_daily_cap: u16,
    ) -> Result<()> {
        handle_initialize(ctx, attester, sgt_group, usdc_mint, global_daily_cap)
    }

    pub fn register_identity(ctx: Context<RegisterIdentity>, proof_nullifier: [u8; 32]) -> Result<()> {
        handle_register_identity(ctx, proof_nullifier)
    }

    pub fn create_campaign(
        ctx: Context<CreateCampaign>,
        id: u64,
        advertiser: Pubkey,
        segment_root: [u8; 32],
        price_per_view: u64,
        min_dwell_ms: u32,
        freq_cap: u8,
    ) -> Result<()> {
        handle_create_campaign(ctx, id, advertiser, segment_root, price_per_view, min_dwell_ms, freq_cap)
    }

    pub fn activate_campaign(ctx: Context<ActivateCampaign>) -> Result<()> {
        handle_activate_campaign(ctx)
    }
}
