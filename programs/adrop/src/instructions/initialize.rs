use anchor_lang::prelude::*;
use anchor_spl::token_interface::TokenAccount;

use crate::state::Config;

#[derive(Accounts)]
#[instruction(attester: Pubkey, sgt_group: Pubkey, usdc_mint: Pubkey)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + Config::INIT_SPACE, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    #[account(constraint = protocol_treasury_ata.mint == usdc_mint)]
    pub protocol_treasury_ata: InterfaceAccount<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
}

pub fn handle_initialize(
    ctx: Context<Initialize>,
    attester: Pubkey,
    sgt_group: Pubkey,
    usdc_mint: Pubkey,
    global_daily_cap: u16,
) -> Result<()> {
    let c = &mut ctx.accounts.config;
    c.admin = ctx.accounts.admin.key();
    c.attester = attester;
    c.protocol_treasury_ata = ctx.accounts.protocol_treasury_ata.key();
    c.sgt_group = sgt_group;
    c.usdc_mint = usdc_mint;
    c.global_daily_cap = global_daily_cap;
    c.bump = ctx.bumps.config;
    Ok(())
}
