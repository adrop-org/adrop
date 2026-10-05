use anchor_lang::prelude::*;
use anchor_spl::token_interface::{TokenAccount, TokenInterface};

use crate::error::AdropError;
use crate::state::{Campaign, CampaignStatus, Config};

#[derive(Accounts)]
pub struct ActivateCampaign<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"campaign", campaign.id.to_le_bytes().as_ref()], bump = campaign.bump)]
    pub campaign: Account<'info, Campaign>,
    #[account(
        associated_token::mint = config.usdc_mint,
        associated_token::authority = campaign,
        associated_token::token_program = token_program,
    )]
    pub escrow_ata: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handle_activate_campaign(ctx: Context<ActivateCampaign>) -> Result<()> {
    let c = &mut ctx.accounts.campaign;
    require!(c.status == CampaignStatus::Draft, AdropError::WrongCampaignStatus);
    let balance = ctx.accounts.escrow_ata.amount;
    require!(balance >= c.price_per_view, AdropError::EscrowUnderfunded);
    c.budget = balance;
    c.status = CampaignStatus::Active;
    Ok(())
}
