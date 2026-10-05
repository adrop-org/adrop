use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::error::AdropError;
use crate::state::{Campaign, CampaignStatus, Config};

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct CreateCampaign<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        init,
        payer = payer,
        space = 8 + Campaign::INIT_SPACE,
        seeds = [b"campaign", id.to_le_bytes().as_ref()],
        bump,
    )]
    pub campaign: Account<'info, Campaign>,
    #[account(address = config.usdc_mint)]
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = payer,
        associated_token::mint = usdc_mint,
        associated_token::authority = campaign,
        associated_token::token_program = token_program,
    )]
    pub escrow_ata: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle_create_campaign(
    ctx: Context<CreateCampaign>,
    id: u64,
    advertiser: Pubkey,
    segment_root: [u8; 32],
    price_per_view: u64,
    min_dwell_ms: u32,
    freq_cap: u8,
) -> Result<()> {
    require!(price_per_view > 0, AdropError::ZeroPrice);
    let c = &mut ctx.accounts.campaign;
    c.id = id;
    c.advertiser = advertiser;
    c.host_ata = None;
    c.segment_root = segment_root;
    c.price_per_view = price_per_view;
    c.min_dwell_ms = min_dwell_ms;
    c.freq_cap = freq_cap;
    c.budget = 0;
    c.spent = 0;
    c.status = CampaignStatus::Draft;
    c.created_at = Clock::get()?.unix_timestamp;
    c.bump = ctx.bumps.campaign;
    Ok(())
}
