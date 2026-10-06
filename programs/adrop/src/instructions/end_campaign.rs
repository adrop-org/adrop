use anchor_lang::prelude::*;

use crate::error::AdropError;
use crate::state::{Campaign, CampaignStatus, Config};

#[derive(Accounts)]
pub struct EndCampaign<'info> {
    pub signer: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"campaign", campaign.id.to_le_bytes().as_ref()], bump = campaign.bump)]
    pub campaign: Account<'info, Campaign>,
}

pub fn handle_end_campaign(ctx: Context<EndCampaign>) -> Result<()> {
    let s = ctx.accounts.signer.key();
    let c = &mut ctx.accounts.campaign;
    require!(s == c.advertiser || s == ctx.accounts.config.admin, AdropError::Unauthorized);
    require!(c.status != CampaignStatus::Ended, AdropError::WrongCampaignStatus);
    c.status = CampaignStatus::Ended;
    Ok(())
}
