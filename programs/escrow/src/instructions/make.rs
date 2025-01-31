use crate::{constants::*, state::*};
use anchor_lang::{prelude::*, Discriminator};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

#[derive(Accounts)]
#[instruction(seed: u64)]
pub struct Make<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,
    #[account(
        init,
        payer = maker,
        space = Escrow::DISCRIMINATOR.len() + Escrow::INIT_SPACE,
        seeds = [ESCROW_SEED, maker.key().as_ref(), seed.to_le_bytes().as_ref()],
        bump,
    )]
    pub escrow: Account<'info, Escrow>,
    #[account(mint::token_program = token_program)]
    pub mint_a: InterfaceAccount<'info, Mint>,
    #[account(mint::token_program = token_program)]
    pub mint_b: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint_a,
        associated_token::authority = maker,
        associated_token::token_program = token_program,
    )]
    pub maker_ata_a: InterfaceAccount<'info, TokenAccount>,
    #[account(
        init,
        payer = maker,
        associated_token::mint = mint_a,
        associated_token::authority = escrow,
        associated_token::token_program = token_program,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl Make<'_> {
    pub fn make(
        ctx: Context<Make>,
        seed: u64,
        deposit_amount: u64,
        receive_amount: u64,
    ) -> Result<()> {
        ctx.accounts.escrow.set_inner(Escrow {
            bump: ctx.bumps.escrow,
            seed,
            receive_amount,
            maker: ctx.accounts.maker.key(),
            mint_a: ctx.accounts.mint_a.key(),
            mint_b: ctx.accounts.mint_b.key(),
        });

        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    authority: ctx.accounts.maker.to_account_info(),
                    from: ctx.accounts.maker_ata_a.to_account_info(),
                    mint: ctx.accounts.mint_a.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            deposit_amount,
            ctx.accounts.mint_a.decimals,
        )
    }
}
