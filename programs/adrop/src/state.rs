use anchor_lang::prelude::*;

pub const PROOF_TYPE_SGT: u8 = 1;

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub attester: Pubkey,
    pub protocol_treasury_ata: Pubkey,
    pub sgt_group: Pubkey,
    pub usdc_mint: Pubkey,
    pub global_daily_cap: u16,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Identity {
    pub owner: Pubkey,
    pub proof_type: u8,
    pub proof_nullifier: [u8; 32],
    pub registered_at: i64,
    pub last_day: u32,
    pub views_today: u16,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum CampaignStatus {
    Draft,
    Active,
    Ended,
}

#[account]
#[derive(InitSpace)]
pub struct Campaign {
    pub id: u64,
    pub advertiser: Pubkey,
    pub host_ata: Option<Pubkey>,
    pub segment_root: [u8; 32],
    pub price_per_view: u64,
    pub min_dwell_ms: u32,
    pub freq_cap: u8,
    pub budget: u64,
    pub spent: u64,
    pub status: CampaignStatus,
    pub created_at: i64,
    pub bump: u8,
}
