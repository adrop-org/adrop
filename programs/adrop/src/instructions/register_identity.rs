use anchor_lang::prelude::*;
use anchor_spl::token_2022::spl_token_2022::extension::metadata_pointer::MetadataPointer;
use spl_token_group_interface::state::TokenGroupMember;
use anchor_spl::token_interface::{get_mint_extension_data, Mint, TokenAccount, TokenInterface};

use crate::error::AdropError;
use crate::state::{Config, Identity, PROOF_TYPE_SGT};

/// Identity key: sha256 of the SGT mint, so a transferred SGT keeps one identity.
pub fn sgt_nullifier(mint: &Pubkey) -> [u8; 32] {
    solana_sha256_hasher::hash(mint.as_ref()).to_bytes()
}

#[derive(Accounts)]
#[instruction(proof_nullifier: [u8; 32])]
pub struct RegisterIdentity<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        constraint = sgt_token_account.owner == owner.key() @ AdropError::SgtNotOwned,
        constraint = sgt_token_account.mint == sgt_mint.key() @ AdropError::SgtNotOwned,
        constraint = sgt_token_account.amount == 1 @ AdropError::SgtZeroBalance,
    )]
    pub sgt_token_account: InterfaceAccount<'info, TokenAccount>,
    pub sgt_mint: InterfaceAccount<'info, Mint>,
    #[account(constraint = token_program.key() == anchor_spl::token_2022::ID @ AdropError::SgtWrongTokenProgram)]
    pub token_program: Interface<'info, TokenInterface>,
    #[account(
        init,
        payer = owner,
        space = 8 + Identity::INIT_SPACE,
        seeds = [b"identity", proof_nullifier.as_ref()],
        bump,
    )]
    pub identity: Account<'info, Identity>,
    pub system_program: Program<'info, System>,
}

pub fn handle_register_identity(ctx: Context<RegisterIdentity>, proof_nullifier: [u8; 32]) -> Result<()> {
    let mint_key = ctx.accounts.sgt_mint.key();
    require!(proof_nullifier == sgt_nullifier(&mint_key), AdropError::BadNullifier);

    let mint_info = ctx.accounts.sgt_mint.to_account_info();
    let group = ctx.accounts.config.sgt_group.to_bytes();

    let mp = get_mint_extension_data::<MetadataPointer>(&mint_info)
        .map_err(|_| AdropError::SgtMissingExtension)?;
    require!(mp.metadata_address.0.to_bytes() == group, AdropError::SgtWrongMetadataPointer);

    let member = get_mint_extension_data::<TokenGroupMember>(&mint_info)
        .map_err(|_| AdropError::SgtMissingExtension)?;
    require!(member.group.to_bytes() == group, AdropError::SgtWrongGroup);
    require!(member.mint.to_bytes() == mint_key.to_bytes(), AdropError::SgtWrongGroup);

    let id = &mut ctx.accounts.identity;
    id.owner = ctx.accounts.owner.key();
    id.proof_type = PROOF_TYPE_SGT;
    id.proof_nullifier = proof_nullifier;
    id.registered_at = Clock::get()?.unix_timestamp;
    id.last_day = 0;
    id.views_today = 0;
    id.bump = ctx.bumps.identity;
    Ok(())
}
