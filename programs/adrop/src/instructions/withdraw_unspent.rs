use anchor_lang::prelude::*;
use anchor_spl::token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::error::AdropError;
use crate::state::{Campaign, CampaignStatus, Config};

#[derive(Accounts)]
pub struct WithdrawUnspent<'info> {
    #[account(address = campaign.advertiser @ AdropError::Unauthorized)]
    pub advertiser: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        seeds = [b"campaign", campaign.id.to_le_bytes().as_ref()],
        bump = campaign.bump,
        constraint = campaign.status != CampaignStatus::Active @ AdropError::WrongCampaignStatus,
    )]
    pub campaign: Account<'info, Campaign>,
    #[account(address = config.usdc_mint @ AdropError::WrongMint)]
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = campaign,
        associated_token::token_program = token_program,
    )]
    pub escrow_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, constraint = advertiser_ata.mint == usdc_mint.key() @ AdropError::WrongMint, constraint = advertiser_ata.owner == advertiser.key())]
    pub advertiser_ata: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handle_withdraw_unspent(ctx: Context<WithdrawUnspent>) -> Result<()> {
    let amount = ctx.accounts.escrow_ata.amount;
    if amount == 0 { return Ok(()); }
    let c = &ctx.accounts.campaign;
    let id_bytes = c.id.to_le_bytes();
    let seeds: &[&[u8]] = &[b"campaign", id_bytes.as_ref(), &[c.bump]];
    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.escrow_ata.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.advertiser_ata.to_account_info(),
                authority: c.to_account_info(),
            },
            &[seeds],
        ),
        amount,
        ctx.accounts.usdc_mint.decimals,
    )
}
