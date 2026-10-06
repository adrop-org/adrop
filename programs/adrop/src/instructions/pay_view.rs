use anchor_lang::prelude::*;
use anchor_spl::token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::error::AdropError;
use crate::merkle;
use crate::state::{Campaign, CampaignStatus, Config, Identity, Impression};

pub const VIEWER_BPS: u64 = 7000;
pub const HOST_BPS: u64 = 2000;

#[derive(Accounts)]
#[instruction(nonce_hash: [u8; 32])]
pub struct PayView<'info> {
    pub viewer: Signer<'info>,
    #[account(address = config.attester @ AdropError::NotAttester)]
    pub attester: Signer<'info>,
    #[account(mut, constraint = fee_payer.key() != attester.key() @ AdropError::FeePayerIsAttester)]
    pub fee_payer: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        seeds = [b"identity", identity.proof_nullifier.as_ref()],
        bump = identity.bump,
        constraint = identity.owner == viewer.key() @ AdropError::IdentityNotOwned,
    )]
    pub identity: Account<'info, Identity>,
    #[account(mut, seeds = [b"campaign", campaign.id.to_le_bytes().as_ref()], bump = campaign.bump)]
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
    #[account(mut, constraint = viewer_ata.mint == usdc_mint.key() @ AdropError::WrongMint, constraint = viewer_ata.owner == viewer.key())]
    pub viewer_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, constraint = host_ata.mint == usdc_mint.key() @ AdropError::WrongMint)]
    pub host_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, address = config.protocol_treasury_ata)]
    pub protocol_treasury_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(
        init,
        payer = fee_payer,
        space = 8 + Impression::INIT_SPACE,
        seeds = [b"impression", campaign.key().as_ref(), nonce_hash.as_ref()],
        bump,
    )]
    pub impression: Account<'info, Impression>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handle_pay_view(ctx: Context<PayView>, nonce_hash: [u8; 32], merkle_proof: Vec<[u8; 32]>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let cfg = &ctx.accounts.config;
    let campaign = &mut ctx.accounts.campaign;
    require!(campaign.status == CampaignStatus::Active, AdropError::WrongCampaignStatus);

    let leaf = solana_sha256_hasher::hash(&ctx.accounts.identity.proof_nullifier).to_bytes();
    require!(merkle::verify(&campaign.segment_root, &leaf, &merkle_proof), AdropError::BadMerkleProof);

    let identity = &mut ctx.accounts.identity;
    let day = (now / 86_400) as u32;
    if identity.last_day != day {
        identity.last_day = day;
        identity.views_today = 0;
    }
    require!(identity.views_today < cfg.global_daily_cap, AdropError::GlobalCapExceeded);

    let price = campaign.price_per_view;
    require!(ctx.accounts.escrow_ata.amount >= price, AdropError::EscrowUnderfunded);

    identity.views_today += 1;
    campaign.spent = campaign.spent.checked_add(price).unwrap();
    let imp = &mut ctx.accounts.impression;
    imp.campaign = campaign.key();
    imp.nonce_hash = nonce_hash;
    imp.identity = identity.key();
    imp.paid_at = now;
    imp.bump = ctx.bumps.impression;

    let viewer_amt = price * VIEWER_BPS / 10_000;
    let host_amt = price * HOST_BPS / 10_000;
    let protocol_amt = price - viewer_amt - host_amt;
    let id_bytes = campaign.id.to_le_bytes();
    let seeds: &[&[u8]] = &[b"campaign", id_bytes.as_ref(), &[campaign.bump]];
    let decimals = ctx.accounts.usdc_mint.decimals;
    for (to, amt) in [
        (ctx.accounts.viewer_ata.to_account_info(), viewer_amt),
        (ctx.accounts.host_ata.to_account_info(), host_amt),
        (ctx.accounts.protocol_treasury_ata.to_account_info(), protocol_amt),
    ] {
        if amt == 0 { continue; }
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.escrow_ata.to_account_info(),
                    mint: ctx.accounts.usdc_mint.to_account_info(),
                    to,
                    authority: campaign.to_account_info(),
                },
                &[seeds],
            ),
            amt,
            decimals,
        )?;
    }
    Ok(())
}
